// Conexión a Redpanda (compatible con Kafka), compartida por el simulador y el worker.
import kafkajs from 'kafkajs';

const { Kafka, logLevel } = kafkajs;

export const TOPICS = {
  soilMoisture: 'soil.moisture',
  irrigationCommands: 'irrigation.commands',
  valveStatus: 'valve.status',
} as const;

// Payloads de los eventos (§10 del PRD). Timestamps en ISO-8601 UTC.
export type SoilMoistureEvent = {
  station_id: string;
  moisture_pct: number;
  temp_c: number;
  rain_mm?: number;
  ts: string;
};

export type IrrigationCommandEvent = {
  command_id: string;
  valve_id: string;
  action: 'open' | 'close';
  duration_min: number | null;
};

export type ValveStatusEvent = {
  valve_id: string;
  status: 'open' | 'closed';
  command_id: string | null;
  ts: string;
};

export function createKafka(clientId: string) {
  return new Kafka({
    clientId,
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    // Solo errores: al arrancar puede aparecer alguno transitorio mientras Redpanda inicia.
    logLevel: logLevel.ERROR,
  });
}

// Crea los topics si no existen, para no depender del orden de arranque.
export async function ensureTopics(kafka: ReturnType<typeof createKafka>) {
  const admin = kafka.admin();
  await admin.connect();
  await admin.createTopics({
    topics: Object.values(TOPICS).map((topic) => ({ topic })),
  });
  await admin.disconnect();
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

// Al apagar el contenedor (SIGTERM), se avisa a Kafka que el consumer se va. Si no, Kafka
// espera ~30 s antes de reasignar los mensajes y el primer comando tras un reinicio se demora.
export function disconnectOnShutdown(...clients: { disconnect: () => Promise<void> }[]) {
  const shutdown = async () => {
    console.log('apagando: cerrando conexiones con Kafka');
    setTimeout(() => process.exit(0), 3000); // por si la desconexión se demora
    await Promise.allSettled(clients.map((client) => client.disconnect()));
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
