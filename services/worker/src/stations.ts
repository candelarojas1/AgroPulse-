// Estaciones que simula el simulador. Los UUID son los fijos de supabase/seed.sql.
// baseMoisture: valor al que tiende la humedad de cada lote cuando la válvula está cerrada.
// Datos ficticios, con fines didácticos.

export type Station = {
  plotName: string;
  stationId: string;
  valveId: string;
  baseMoisture: number;
};

export const STATIONS: Station[] = [
  // Costa 1: dentro del rango óptimo (umbral 25–45) → verde.
  { plotName: 'Costa 1', stationId: 'b0000000-0000-0000-0000-000000000001', valveId: 'c0000000-0000-0000-0000-000000000001', baseMoisture: 35 },
  // Costa 2: por debajo del umbral mínimo (25) → rojo, para demostrar el riego.
  { plotName: 'Costa 2', stationId: 'b0000000-0000-0000-0000-000000000002', valveId: 'c0000000-0000-0000-0000-000000000002', baseMoisture: 18 },
  // Monte A: pausada por defecto (SIM_PAUSED_STATIONS) → stale, para la demo H4.
  { plotName: 'Monte A', stationId: 'b0000000-0000-0000-0000-000000000003', valveId: 'c0000000-0000-0000-0000-000000000003', baseMoisture: 30 },
  { plotName: 'Lote Norte', stationId: 'b0000000-0000-0000-0000-000000000004', valveId: 'c0000000-0000-0000-0000-000000000004', baseMoisture: 32 },
];
