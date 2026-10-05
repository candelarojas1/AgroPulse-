-- AgroPulse · 0001 · Esquema
-- Nombres en inglés en SQL; la UI muestra etiquetas en español.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text
);

-- memberships define el perímetro de datos de cada usuario (RLS).
create table public.memberships (
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role text not null check (role in ('producer', 'operator', 'advisor')),
  primary key (user_id, organization_id)
);

-- geom: polígono GeoJSON {"type":"Polygon","coordinates":[[[lng,lat],...]]}.
-- No usamos PostGIS: el único cálculo geográfico (¿estoy en el lote?) se hace en el celular.
create table public.plots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  crop text,
  geom jsonb not null,
  threshold_min numeric(5, 1) not null default 25,
  threshold_max numeric(5, 1) not null default 45,
  constraint plots_threshold_range check (
    threshold_min >= 0 and threshold_min < threshold_max and threshold_max <= 100
  )
);

create table public.stations (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.plots (id) on delete cascade,
  name text not null,
  lat double precision not null,
  lng double precision not null
);

create table public.readings (
  id bigint generated always as identity primary key,
  station_id uuid not null references public.stations (id) on delete cascade,
  measured_at timestamptz not null,
  moisture_pct numeric(5, 1) not null,
  temp_c numeric(4, 1),
  rain_mm numeric(5, 1),
  source text not null default 'sensor' check (source in ('sensor', 'manual'))
);

create index readings_station_measured_idx on public.readings (station_id, measured_at desc);

create table public.valves (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.plots (id) on delete cascade,
  name text not null,
  status text not null default 'closed' check (status in ('open', 'closed'))
);

-- Un comando es un pedido: nace en 'pending' y el worker lo pasa a 'applied' o 'failed'.
-- action 'open' con duration_min = "abrir por N minutos"; sin duration_min = abrir sin límite.
create table public.irrigation_commands (
  id uuid primary key default gen_random_uuid(),
  valve_id uuid not null references public.valves (id) on delete cascade,
  requested_by uuid not null default auth.uid() references auth.users (id),
  requested_by_email text not null default (auth.jwt() ->> 'email'),
  action text not null check (action in ('open', 'close')),
  duration_min integer,
  status text not null default 'pending' check (status in ('pending', 'applied', 'failed')),
  client_request_id uuid not null,
  failure_reason text,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz,
  applied_at timestamptz,
  constraint irrigation_commands_client_request_id_key unique (client_request_id),
  constraint irrigation_commands_duration_check check (
    duration_min is null or (action = 'open' and duration_min between 1 and 120)
  )
);

-- RF-16: como máximo un comando pending por válvula. La base lo garantiza aunque
-- dos celulares manden el comando al mismo tiempo.
create unique index one_pending_per_valve
  on public.irrigation_commands (valve_id)
  where status = 'pending';
