-- AgroPulse · 0002 · Permisos y Row Level Security
-- La app usa la anon key + el JWT del usuario (rol "authenticated").
-- El worker usa la service role, que saltea RLS: nunca va en la app.

-- Permisos de tabla (RLS filtra después qué filas).
grant usage on schema public to authenticated, service_role;
grant select on all tables in schema public to authenticated;
grant update on public.plots to authenticated;
grant insert on public.irrigation_commands to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.plots enable row level security;
alter table public.stations enable row level security;
alter table public.readings enable row level security;
alter table public.valves enable row level security;
alter table public.irrigation_commands enable row level security;

-- Cada usuario ve solo sus propias membresías.
create policy "memberships: ver las propias"
  on public.memberships for select to authenticated
  using (user_id = auth.uid());

create policy "organizations: ver si soy miembro"
  on public.organizations for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.organization_id = organizations.id and m.user_id = auth.uid()
  ));

create policy "plots: ver si soy miembro"
  on public.plots for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.organization_id = plots.organization_id and m.user_id = auth.uid()
  ));

-- Solo el productor edita umbrales (§5: el operador solo comanda).
create policy "plots: editar si soy productor"
  on public.plots for update to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.organization_id = plots.organization_id and m.user_id = auth.uid()
      and m.role = 'producer'
  ))
  with check (exists (
    select 1 from public.memberships m
    where m.organization_id = plots.organization_id and m.user_id = auth.uid()
      and m.role = 'producer'
  ));

create policy "stations: ver si soy miembro"
  on public.stations for select to authenticated
  using (exists (
    select 1 from public.plots p
    join public.memberships m on m.organization_id = p.organization_id
    where p.id = stations.plot_id and m.user_id = auth.uid()
  ));

-- Las lecturas de sensor solo las inserta el worker (service role): no hay policy de insert.
create policy "readings: ver si soy miembro"
  on public.readings for select to authenticated
  using (exists (
    select 1 from public.stations s
    join public.plots p on p.id = s.plot_id
    join public.memberships m on m.organization_id = p.organization_id
    where s.id = readings.station_id and m.user_id = auth.uid()
  ));

-- El estado de las válvulas solo lo cambia el worker.
create policy "valves: ver si soy miembro"
  on public.valves for select to authenticated
  using (exists (
    select 1 from public.plots p
    join public.memberships m on m.organization_id = p.organization_id
    where p.id = valves.plot_id and m.user_id = auth.uid()
  ));

create policy "irrigation_commands: ver si soy miembro"
  on public.irrigation_commands for select to authenticated
  using (exists (
    select 1 from public.valves v
    join public.plots p on p.id = v.plot_id
    join public.memberships m on m.organization_id = p.organization_id
    where v.id = irrigation_commands.valve_id and m.user_id = auth.uid()
  ));

-- Crear un comando: solo productor u operador de la organización dueña de la válvula,
-- siempre en 'pending', a nombre propio (no se puede falsificar el actor).
create policy "irrigation_commands: crear si soy productor u operador"
  on public.irrigation_commands for insert to authenticated
  with check (
    status = 'pending'
    and requested_by = auth.uid()
    and requested_by_email = (auth.jwt() ->> 'email')
    and exists (
      select 1 from public.valves v
      join public.plots p on p.id = v.plot_id
      join public.memberships m on m.organization_id = p.organization_id
      where v.id = irrigation_commands.valve_id and m.user_id = auth.uid()
        and m.role in ('producer', 'operator')
    )
  );
