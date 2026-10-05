-- AgroPulse · 0004 · Serie de humedad para el gráfico (RF-10)

-- Promedio de humedad cada 5 minutos de las últimas 6 h, por estación.
-- Con un tick cada pocos segundos, 6 h son miles de lecturas (y la API devuelve como
-- máximo 1000 filas por consulta); agrupadas quedan como máximo 72 puntos por estación.
-- security_invoker = true: respeta RLS (cada usuario solo ve sus estaciones).
create view public.moisture_last_6h
with (security_invoker = true) as
select
  station_id,
  date_bin('5 minutes', measured_at, timestamptz '2000-01-01') as measured_at,
  round(avg(moisture_pct), 1) as moisture_pct
from public.readings
where measured_at > now() - interval '6 hours'
group by station_id, 2;

grant select on public.moisture_last_6h to authenticated;
