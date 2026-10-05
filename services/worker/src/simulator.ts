// Simulador de sensores IoT. Hace de "hardware": publica ticks en Kafka y no conoce la base
// de datos (no tiene credenciales de Supabase). Solo escucha valve.status para saber qué
// válvulas están abiertas y subir la humedad de esos lotes.
//
// Frecuencia: 1 tick cada 3–8 s por estación, para ver Realtime en clase.
// En un campo real sería un tick cada varios minutos.
import { STATIONS } from './stations.ts';
import {
  createKafka, disconnectOnShutdown, ensureTopics, randomBetween, sleep, TOPICS,
  type SoilMoistureEvent, type ValveStatusEvent,
} from './kafka.ts';

// Lotes "apagados" para la demo de stale (H4). Ej.: SIM_PAUSED_STATIONS="Monte A"
const paused = new Set(
  (process.env.SIM_PAUSED_STATIONS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
);

const IRRIGATION_STEP = 1.0; // % que sube la humedad por tick con la válvula abierta
const REVERSION = 0.1; // fracción que se acerca al valor base por tick con la válvula cerrada
const MAX_MOISTURE = 60;

const kafka = createKafka('agropulse-simulator');
const producer = kafka.producer();
// groupId nuevo en cada arranque + fromBeginning: relee el historial de valve.status y así
// sabe qué válvulas quedaron abiertas aunque el simulador se haya reiniciado.
const consumer = kafka.consumer({ groupId: `simulator-${Date.now()}` });

const openValves = new Set<string>();
const moisture = new Map(STATIONS.map((s) => [s.stationId, s.baseMoisture]));

async function tickLoop(station: (typeof STATIONS)[number]) {
  while (true) {
    await sleep(randomBetween(3000, 8000));

    const previous = moisture.get(station.stationId) ?? station.baseMoisture;
    const target = openValves.has(station.valveId)
      ? previous + IRRIGATION_STEP
      : previous + (station.baseMoisture - previous) * REVERSION;
    const next = Math.min(MAX_MOISTURE, Math.max(0, target + randomBetween(-0.4, 0.4)));
    moisture.set(station.stationId, next);

    const hour = new Date().getUTCHours();
    const event: SoilMoistureEvent = {
      station_id: station.stationId,
      moisture_pct: Number(next.toFixed(1)),
      temp_c: Number((22 + 5 * Math.sin((hour / 24) * 2 * Math.PI) + randomBetween(-0.5, 0.5)).toFixed(1)),
      // Lluvia opcional en el tick (RF-08): de vez en cuando llovizna.
      rain_mm: Math.random() < 0.05 ? Number(randomBetween(0.2, 2).toFixed(1)) : 0,
      ts: new Date().toISOString(),
    };

    await producer.send({
      topic: TOPICS.soilMoisture,
      messages: [{ key: station.stationId, value: JSON.stringify(event) }],
    });
    console.log(`produced ${TOPICS.soilMoisture} lote="${station.plotName}" moisture=${event.moisture_pct}%`);
  }
}

disconnectOnShutdown(consumer, producer);
await ensureTopics(kafka);
await producer.connect();
await consumer.connect();
await consumer.subscribe({ topic: TOPICS.valveStatus, fromBeginning: true });
await consumer.run({
  eachMessage: async ({ message }) => {
    const event = JSON.parse(message.value?.toString() ?? '{}') as ValveStatusEvent;
    if (event.status === 'open') openValves.add(event.valve_id);
    else openValves.delete(event.valve_id);
  },
});

console.log(`simulator iniciado · pausadas: ${[...paused].join(', ') || 'ninguna'}`);
for (const station of STATIONS) {
  if (paused.has(station.plotName)) continue;
  void tickLoop(station);
}
