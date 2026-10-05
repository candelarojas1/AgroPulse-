-- AgroPulse · 0003 · Vista para el mapa + Realtime

-- Cada lote con sus umbrales y su última lectura (la más reciente entre sus estaciones).
-- El mapa carga con una sola consulta. security_invoker = true hace que la vista
-- respete las políticas RLS del usuario que consulta.
-- El semáforo (stale/dry/optimal/wet) lo calcula la app con la fórmula del §8,
-- porque "stale" depende del reloj y no llega ningún evento cuando un sensor deja de reportar.
create view public.plot_overview
with (security_invoker = true) as
select
  p.id,
  p.organization_id,
  p.name,
  p.crop,
  p.geom,
  p.threshold_min,
  p.threshold_max,
  r.station_id,
  r.measured_at,
  r.moisture_pct,
  r.temp_c,
  r.rain_mm
from public.plots p
left join lateral (
  select r.*
  from public.readings r
  join public.stations s on s.id = r.station_id
  where s.plot_id = p.id
  order by r.measured_at desc
  limit 1
) r on true;

grant select on public.plot_overview to authenticated;

-- La app recibe por Realtime los cambios de estas tablas (filtrados por RLS).
alter publication supabase_realtime
  add table public.readings, public.valves, public.irrigation_commands;
