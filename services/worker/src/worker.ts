// Worker: traduce eventos de Kafka a SQL en Supabase. Es el único proceso con la
// service role key (nunca va en la app). Hace cuatro cosas:
//   1. soil.moisture       → inserta la lectura en readings
//   2. comandos pending    → los publica en irrigation.commands
//   3. irrigation.commands → aplica el comando (válvula + estado) y publica valve.status
//   4. cierre automático de válvulas "abrir N min" cuando se cumple el tiempo
import { createClient } from '@supabase/supabase-js';
import {
  createKafka, disconnectOnShutdown, ensureTopics, randomBetween, sleep, TOPICS,
  type IrrigationCommandEvent, type SoilMoistureEvent, type ValveStatusEvent,
} from './kafka.ts';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Cuántos segundos dura un "minuto" de riego. 60 = tiempo real; menos acelera la demo.
const DURATION_MINUTE_SECONDS = Number(process.env.DURATION_MINUTE_SECONDS ?? 60);
const FAILURE_RATE = 0.1; // 10 % de comandos fallan con valve_timeout (camino de error, OA-5)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const kafka = createKafka('agropulse-worker');
const producer = kafka.producer();
const telemetryConsumer = kafka.consumer({ groupId: 'worker-telemetry' });
const commandConsumer = kafka.consumer({ groupId: 'worker-commands' });

async function publishValveStatus(event: ValveStatusEvent) {
  await producer.send({
    topic: TOPICS.valveStatus,
    messages: [{ key: event.valve_id, value: JSON.stringify(event) }],
  });
  console.log(`produced ${TOPICS.valveStatus} valve=${event.valve_id} status=${event.status}`);
}

// 1. Telemetría → readings
async function handleSoilMoisture(raw: string) {
  let event: SoilMoistureEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    console.warn(`descartado ${TOPICS.soilMoisture}: JSON inválido`);
    return;
  }
  console.log(`consumed ${TOPICS.soilMoisture} station=${event.station_id} moisture=${event.moisture_pct}%`);

  const { error } = await supabase.from('readings').insert({
    station_id: event.station_id,
    measured_at: event.ts,
    moisture_pct: event.moisture_pct,
    temp_c: event.temp_c,
    rain_mm: event.rain_mm ?? null,
    source: 'sensor',
  });
  if (error) {
    // 23503 = la estación no existe: se loguea y se descarta, sin cortar el loop (§10).
    const reason = error.code === '23503' ? 'station_id desconocido' : error.message;
    console.warn(`descartado ${TOPICS.soilMoisture} station=${event.station_id}: ${reason}`);
    return;
  }
  console.log(`upsert reading station=${event.station_id} moisture=${event.moisture_pct}%`);
}

// 2. Comandos pending de la base → topic irrigation.commands
async function dispatchPendingCommands() {
  const { data, error } = await supabase
    .from('irrigation_commands')
    .select('id, valve_id, action, duration_min')
    .eq('status', 'pending')
    .is('dispatched_at', null);
  if (error) {
    console.warn(`error leyendo comandos pending: ${error.message}`);
    return;
  }
  for (const command of data) {
    const event: IrrigationCommandEvent = {
      command_id: command.id,
      valve_id: command.valve_id,
      action: command.action,
      duration_min: command.duration_min,
    };
    await producer.send({
      topic: TOPICS.irrigationCommands,
      messages: [{ key: command.valve_id, value: JSON.stringify(event) }],
    });
    await supabase
      .from('irrigation_commands')
      .update({ dispatched_at: new Date().toISOString() })
      .eq('id', command.id);
    console.log(`produced ${TOPICS.irrigationCommands} command=${command.id} action=${command.action}`);
  }
}

// 3. Aplicar comando: la válvula simulada tarda 1–2,5 s en responder (§8: 1–4 s).
//    Cada update lleva .eq('status', 'pending'): si el comando ya no está pending
//    (por ejemplo, un mensaje repetido), no se toca.
async function handleIrrigationCommand(raw: string) {
  const event = JSON.parse(raw) as IrrigationCommandEvent;
  console.log(`consumed ${TOPICS.irrigationCommands} command=${event.command_id}`);
  await sleep(randomBetween(1000, 2500));

  if (Math.random() < FAILURE_RATE) {
    await supabase
      .from('irrigation_commands')
      .update({ status: 'failed', failure_reason: 'valve_timeout' })
      .eq('id', event.command_id)
      .eq('status', 'pending');
    console.log(`command failed command=${event.command_id} reason=valve_timeout`);
    return;
  }

  const { data: updated } = await supabase
    .from('irrigation_commands')
    .update({ status: 'applied', applied_at: new Date().toISOString() })
    .eq('id', event.command_id)
    .eq('status', 'pending')
    .select('id');
  if (!updated?.length) {
    console.log(`ignorado command=${event.command_id}: ya no está pending`);
    return;
  }

  const status = event.action === 'open' ? 'open' : 'closed';
  await supabase.from('valves').update({ status }).eq('id', event.valve_id);
  console.log(`command applied command=${event.command_id} valve=${event.valve_id} status=${status}`);

  await publishValveStatus({
    valve_id: event.valve_id,
    status,
    command_id: event.command_id,
    ts: new Date().toISOString(),
  });
}

// 4. Cierre automático: válvulas abiertas cuyo último comando aplicado fue
//    "abrir N min" y ya pasó applied_at + N minutos.
async function closeExpiredValves() {
  const { data: openValves } = await supabase.from('valves').select('id').eq('status', 'open');
  for (const valve of openValves ?? []) {
    const { data: last } = await supabase
      .from('irrigation_commands')
      .select('id, action, duration_min, applied_at')
      .eq('valve_id', valve.id)
      .eq('status', 'applied')
      .order('applied_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!last || last.action !== 'open' || !last.duration_min || !last.applied_at) continue;

    const closesAt = new Date(last.applied_at).getTime() + last.duration_min * DURATION_MINUTE_SECONDS * 1000;
    if (Date.now() < closesAt) continue;

    await supabase.from('valves').update({ status: 'closed' }).eq('id', valve.id);
    console.log(`auto-close valve=${valve.id} tras ${last.duration_min} min (command=${last.id})`);
    await publishValveStatus({
      valve_id: valve.id,
      status: 'closed',
      command_id: last.id,
      ts: new Date().toISOString(),
    });
  }
}

// Repite una tarea cada `ms`, sin solapar ejecuciones.
async function every(ms: number, task: () => Promise<void>) {
  while (true) {
    try {
      await task();
    } catch (err) {
      console.warn(`error en tarea periódica: ${(err as Error).message}`);
    }
    await sleep(ms);
  }
}

disconnectOnShutdown(telemetryConsumer, commandConsumer, producer);
await ensureTopics(kafka);
await producer.connect();

await telemetryConsumer.connect();
await telemetryConsumer.subscribe({ topic: TOPICS.soilMoisture });
await telemetryConsumer.run({
  eachMessage: async ({ message }) => handleSoilMoisture(message.value?.toString() ?? ''),
});

await commandConsumer.connect();
await commandConsumer.subscribe({ topic: TOPICS.irrigationCommands });
await commandConsumer.run({
  eachMessage: async ({ message }) => handleIrrigationCommand(message.value?.toString() ?? ''),
});

console.log(`worker iniciado · 1 minuto de riego = ${DURATION_MINUTE_SECONDS} s`);
void every(1000, dispatchPendingCommands);
void every(1000, closeExpiredValves);
