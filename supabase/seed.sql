-- AgroPulse · Semilla de datos
-- ⚠️ Datos FICTICIOS: coordenadas aproximadas de la zona de Concordia / Federal (Entre Ríos)
-- que no corresponden a un predio real, y humedades simuladas (no calibradas a un sensor real).
--
-- Se puede volver a ejecutar para resetear la demo: borra y recrea lotes, estaciones,
-- lecturas, válvulas y comandos. Las organizaciones y las membresías se mantienen.
-- Los UUID son fijos porque el simulador los usa (services/worker/src/stations.ts).

insert into public.organizations (id, name, region) values
  ('11111111-1111-1111-1111-111111111111', 'Estancia Didáctica Concordia', 'Concordia, Entre Ríos'),
  ('22222222-2222-2222-2222-222222222222', 'Campo Demo Federal', 'Federal, Entre Ríos')
on conflict (id) do nothing;

-- Borra en cascada estaciones, lecturas, válvulas y comandos.
delete from public.plots
where organization_id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

insert into public.plots (id, organization_id, name, crop, geom) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Costa 1', 'Citrus',
   '{"type":"Polygon","coordinates":[[[-58.1300,-31.3300],[-58.1250,-31.3300],[-58.1250,-31.3260],[-58.1300,-31.3260],[-58.1300,-31.3300]]]}'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Costa 2', 'Citrus',
   '{"type":"Polygon","coordinates":[[[-58.1240,-31.3300],[-58.1190,-31.3300],[-58.1190,-31.3260],[-58.1240,-31.3260],[-58.1240,-31.3300]]]}'),
  ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Monte A', 'Soja',
   '{"type":"Polygon","coordinates":[[[-58.1300,-31.3250],[-58.1190,-31.3250],[-58.1190,-31.3210],[-58.1300,-31.3210],[-58.1300,-31.3250]]]}'),
  ('a0000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'Lote Norte', 'Maíz',
   '{"type":"Polygon","coordinates":[[[-58.7900,-30.9500],[-58.7850,-30.9500],[-58.7850,-30.9460],[-58.7900,-30.9460],[-58.7900,-30.9500]]]}');

-- Una estación por lote, en el centro del polígono.
insert into public.stations (id, plot_id, name, lat, lng) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Estación Costa 1', -31.3280, -58.1275),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Estación Costa 2', -31.3280, -58.1215),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Estación Monte A', -31.3230, -58.1245),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'Estación Lote Norte', -30.9480, -58.7875);

-- Una válvula por lote, cerrada.
insert into public.valves (id, plot_id, name, status) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Válvula Costa 1', 'closed'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Válvula Costa 2', 'closed'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Válvula Monte A', 'closed'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'Válvula Lote Norte', 'closed');

-- 24 h de historial, una lectura cada 10 min, oscilando alrededor de un valor base:
--   Costa 1 ≈ 35 % (óptimo, verde) · Costa 2 ≈ 18 % (seco, rojo, umbral 25)
--   Monte A ≈ 30 %, pero su última lectura es de hace 20 min → stale (gris) desde el inicio
--   Lote Norte ≈ 32 %
insert into public.readings (station_id, measured_at, moisture_pct, temp_c, rain_mm, source)
select
  s.station_id,
  t,
  round((s.base + 2 * sin(extract(epoch from t) / 3600) + (random() - 0.5))::numeric, 1),
  round((22 + 5 * sin(extract(epoch from t) / 13750))::numeric, 1),
  0,
  'sensor'
from (values
  ('b0000000-0000-0000-0000-000000000001'::uuid, 35, interval '1 minute'),
  ('b0000000-0000-0000-0000-000000000002'::uuid, 18, interval '1 minute'),
  ('b0000000-0000-0000-0000-000000000003'::uuid, 30, interval '20 minutes'),
  ('b0000000-0000-0000-0000-000000000004'::uuid, 32, interval '1 minute')
) as s (station_id, base, last_offset)
cross join lateral generate_series(
  now() - interval '24 hours',
  now() - s.last_offset,
  interval '10 minutes'
) as t;
