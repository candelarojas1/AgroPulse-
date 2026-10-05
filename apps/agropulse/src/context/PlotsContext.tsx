import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { useOrg } from '@/context/OrgContext';
import { polygonToCoords, type GeoJsonPolygon, type LatLng } from '@/lib/geo';
import { computePlotStatus, type PlotStatus } from '@/lib/plotStatus';
import { supabase } from '@/lib/supabase';

// Fila de la vista plot_overview: lote + umbrales + última lectura.
type PlotRow = {
  id: string;
  organization_id: string;
  name: string;
  crop: string | null;
  geom: GeoJsonPolygon;
  threshold_min: number;
  threshold_max: number;
  station_id: string | null;
  measured_at: string | null;
  moisture_pct: number | null;
  temp_c: number | null;
  rain_mm: number | null;
};

export type Plot = PlotRow & { status: PlotStatus; coords: LatLng[] };

type Reading = {
  station_id: string;
  measured_at: string;
  moisture_pct: number;
  temp_c: number | null;
  rain_mm: number | null;
};

// Último tick recibido por Realtime (para la pantalla Diagnóstico, RF-23).
export type LastTick = { stationId: string; measuredAt: string; receivedAt: number };

type PlotsContextType = {
  plots: Plot[];
  isLoading: boolean;
  error: unknown;
  lastTick: LastTick | null;
  reload: () => void;
  updatePlot: (plotId: string, changes: Partial<PlotRow>) => void;
};

const PlotsContext = createContext<PlotsContextType>({
  plots: [],
  isLoading: true,
  error: null,
  lastTick: null,
  reload: () => {},
  updatePlot: () => {},
});

const STATUS_REFRESH_MS = 30_000;

export function PlotsProvider({ children }: { children: ReactNode }) {
  const { activeOrg } = useOrg();
  const orgId = activeOrg?.id ?? null;

  const [rows, setRows] = useState<PlotRow[]>([]);
  // estación → lote, para ubicar cada tick que llega por Realtime.
  const [stationToPlot, setStationToPlot] = useState<Record<string, string>>({});
  const [loadedOrgId, setLoadedOrgId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [lastTick, setLastTick] = useState<LastTick | null>(null);

  // Carga inicial: una consulta a la vista (RNF-03) + las estaciones del establecimiento.
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    Promise.all([
      supabase.from('plot_overview').select('*').eq('organization_id', orgId).order('name'),
      supabase.from('stations').select('id, plot_id, plots!inner(organization_id)').eq('plots.organization_id', orgId),
    ]).then(([plotsResult, stationsResult]) => {
      if (cancelled) return;
      const queryError = plotsResult.error ?? stationsResult.error;
      if (queryError) {
        setError(queryError);
      } else {
        setRows(plotsResult.data as PlotRow[]);
        setStationToPlot(Object.fromEntries((stationsResult.data ?? []).map((s) => [s.id, s.plot_id])));
        setError(null);
      }
      setNow(Date.now());
      setLoadedOrgId(orgId);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId, reloadKey]);

  // Realtime: cada lectura nueva actualiza el lote al instante (RNF-04). RLS filtra
  // los eventos: solo llegan lecturas de establecimientos del usuario.
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`readings-${orgId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'readings' }, (payload) => {
        const reading = payload.new as Reading;
        const plotId = stationToPlot[reading.station_id];
        if (!plotId) return; // lectura de otro establecimiento del usuario

        setLastTick({ stationId: reading.station_id, measuredAt: reading.measured_at, receivedAt: Date.now() });
        setNow(Date.now());
        setRows((current) =>
          current.map((row) =>
            row.id === plotId && (!row.measured_at || reading.measured_at > row.measured_at)
              ? {
                  ...row,
                  station_id: reading.station_id,
                  measured_at: reading.measured_at,
                  moisture_pct: Number(reading.moisture_pct),
                  temp_c: reading.temp_c === null ? null : Number(reading.temp_c),
                  rain_mm: reading.rain_mm === null ? null : Number(reading.rain_mm),
                }
              : row,
          ),
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, stationToPlot]);

  // Recalcula el semáforo cada 30 s aunque no lleguen lecturas: así un lote pasa a
  // "sin datos" cuando su estación deja de reportar (H4).
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), STATUS_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const plots: Plot[] = rows.map((row) => ({
    ...row,
    status: computePlotStatus(row, row, now),
    coords: polygonToCoords(row.geom),
  }));

  const value: PlotsContextType = {
    plots,
    isLoading: loadedOrgId !== orgId,
    error,
    lastTick,
    reload: () => setReloadKey((key) => key + 1),
    updatePlot: (plotId, changes) =>
      setRows((current) => current.map((row) => (row.id === plotId ? { ...row, ...changes } : row))),
  };

  return <PlotsContext.Provider value={value}>{children}</PlotsContext.Provider>;
}

export const usePlots = () => useContext(PlotsContext);
