// Semáforo del lote (§8 del PRD). Es una función pura: misma entrada → misma salida.
// Se calcula en la app porque "stale" depende del reloj: cuando un sensor deja de
// reportar no llega ningún evento, así que la app lo recalcula periódicamente.
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type PlotStatus = 'stale' | 'dry' | 'optimal' | 'wet';

export const STALE_AFTER_MS = 15 * 60 * 1000; // 15 min sin lecturas → sin datos
export const DEFAULT_THRESHOLD_MIN = 25;
export const DEFAULT_THRESHOLD_MAX = 45;

type LastReading = { moisture_pct: number | null; measured_at: string | null };
type Thresholds = { threshold_min: number | null; threshold_max: number | null };

// La primera condición que se cumple gana: stale → dry → wet → optimal.
export function computePlotStatus(reading: LastReading, thresholds: Thresholds, now: number): PlotStatus {
  if (reading.moisture_pct === null || reading.measured_at === null) return 'stale';
  if (now - new Date(reading.measured_at).getTime() > STALE_AFTER_MS) return 'stale';

  const min = thresholds.threshold_min ?? DEFAULT_THRESHOLD_MIN;
  const max = thresholds.threshold_max ?? DEFAULT_THRESHOLD_MAX;
  if (reading.moisture_pct < min) return 'dry';
  if (reading.moisture_pct > max) return 'wet';
  return 'optimal';
}

// Accesibilidad (§12): cada estado tiene color, ícono y texto; no depende solo del color.
export const STATUS_INFO: Record<
  PlotStatus,
  { label: string; color: string; icon: ComponentProps<typeof Ionicons>['name'] }
> = {
  dry: { label: 'Seco', color: '#D32F2F', icon: 'alert-circle' },
  optimal: { label: 'Óptimo', color: '#2E7D32', icon: 'checkmark-circle' },
  wet: { label: 'Húmedo', color: '#1565C0', icon: 'water' },
  stale: { label: 'Sin datos', color: '#8A8F87', icon: 'cloud-offline' },
};

export const STATUS_ORDER: PlotStatus[] = ['dry', 'optimal', 'wet', 'stale'];
