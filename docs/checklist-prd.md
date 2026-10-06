# AgroPulse — Checklist del PRD

Estado de cada requisito obligatorio, dónde está implementado y cómo se comprueba en la demo.

## Requisitos funcionales (Must)

| ID | Requisito | Estado | Dónde | Cómo se comprueba |
|---|---|---|---|---|
| RF-01 | Login / logout con Supabase Auth | Sí | `src/app/login.tsx`, `src/context/AuthContext.tsx` | Contraseña incorrecta → *"Email o contraseña incorrectos"*. Cerrar la app a la fuerza y reabrir → entra sin login. |
| RF-02 | Solo ve sus establecimientos | Sí | `supabase/migrations/0002_rls.sql` | `otro@agropulse.test` solo ve *Lote Norte*, no los lotes de la Estancia. |
| RF-03 | Selector de establecimiento | Sí | `src/context/OrgContext.tsx`, tab Cuenta | El productor cambia de establecimiento y el mapa y la lista cambian. |
| RF-04 | Lista de lotes con semáforo | Sí | `src/app/(app)/(tabs)/plots.tsx` | 3 lotes en la Estancia (4 en total en la semilla). |
| RF-05 | Mapa con polígono y color | Sí | `src/app/(app)/(tabs)/index.tsx` | Tap en un polígono abre el detalle. |
| RF-06 | "Estoy en el lote" | Sí | `src/lib/geo.ts`, botón del mapa | GPS simulado en Costa 2 → *"Estás en Costa 2"*. Sin permiso → *"Ubicación no disponible"*, sin crash. |
| RF-08 | Estación con moisture, temp, rain | Sí | `supabase/seed.sql`, `services/worker/src/simulator.ts` | Una estación por lote; ticks con `moisture_pct`, `temp_c` y `rain_mm` opcional. |
| RF-09 | Última lectura y antigüedad | Sí | `src/app/(app)/plot/[id]/index.tsx` | *"hace 3 s"* se actualiza cada segundo; > 15 min → *Sin datos*. |
| RF-10 | Gráfico de humedad de 6 h (≥ 12 puntos) | Sí | `src/components/MoistureChart.tsx`, vista `moisture_last_6h` | Hasta 72 puntos; se actualiza con cada tick por Realtime y con pull-to-refresh. |
| RF-11 | Umbral mínimo por lote | Sí | Detalle del lote | El productor lo cambia, se guarda en Postgres y el color cambia al instante. |
| RF-12 | Semáforo (§8) | Sí | `src/lib/plotStatus.ts` | stale → dry → wet → optimal, defaults 25/45. |
| RF-13 | Válvulas del lote | Sí | Detalle del lote | Una válvula por lote; Abierta/Cerrada en vivo por Realtime. |
| RF-14 | Emitir comando (abrir, cerrar, abrir N min) | Sí | `src/app/(app)/plot/[id]/command.tsx` | Se crea la fila en `irrigation_commands` en `pending`. |
| RF-15 | Pasa a applied o failed en ≤ 5 s | Sí | `services/worker/src/worker.ts` | Medido: 2–3,5 s. La UI se actualiza por Realtime sin reiniciar. |
| RF-16 | Un solo pending por válvula | Sí | Índice `one_pending_per_valve` | Con el worker frenado, el segundo comando → *"Ya hay un comando pendiente"*. No se duplica. |
| RF-23 | Pantalla Diagnóstico | Sí | `src/app/(app)/diagnostics.tsx` | Usuario, establecimiento, último tick y lag aparente (≈ 0,5 s). |
| RF-24 | Logs del worker | Sí | `docker compose -f infra/docker-compose.yml logs -f` | Se ven `produced`, `consumed` y `upsert reading`. |

## Should incluidos

| ID | Requisito | Estado | Dónde |
|---|---|---|---|
| RF-18 | Historial de los últimos 20 comandos | Sí | `src/app/(app)/plot/[id]/history.tsx` (fecha, actor, resultado) |
| — | Topic `irrigation.commands` (§10) | Sí | El worker publica los comandos pending y los consume para aplicarlos |

## Requisitos no funcionales obligatorios

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| RNF-01 | Expo SDK actual, TS strict, Expo Router | Sí | Expo SDK 57, `"strict": true` en `tsconfig.json`, rutas en `src/app` |
| RNF-02 | Sin service role en el binario | Sí | La app usa solo `EXPO_PUBLIC_SUPABASE_ANON_KEY`; la service role vive en el `.env` del backend |
| RNF-03 | Mapa usable en < 3 s | Sí | Una sola consulta a `plot_overview` |
| RNF-04 | Tick visible en ≤ 3 s | Sí | Lag aparente en Diagnóstico: 0,5–0,7 s |
| RNF-05 | Sin spinner infinito ante fallos y 401/403 | Sí | Mensajes de error claros; timeout de 10 s → *"Sin confirmación del sistema"* |
| RNF-06 | README con env example, compose y usuarios | Sí | `README.md`, `.env.example`, `infra/docker-compose.yml` |
| RNF-10 | Datos ficticios explícitos | Sí | README, informe, pantalla de login y Cuenta |

## Historias de usuario

| Historia | Estado | Cómo |
|---|---|---|
| H1 — Productor riega Costa 2 | Sí | Costa 2 rojo → Regar → abrir 30 min → *Aplicado* en ≤ 5 s y válvula abierta |
| H2 — Asesor no puede regar | Sí | Botón deshabilitado y la base responde 403 |
| H4 — Sensor caído | Sí | Monte A pausado → gris *Sin datos*, no rojo |
| H3 — Lectura manual offline | No | Should, no implementado |

## Entregables (§15)

| # | Artefacto | Estado | Ubicación |
|---|---|---|---|
| 1 | App Expo | Sí | `apps/agropulse` |
| 2 | Migraciones + políticas RLS + semilla | Sí | `supabase/migrations`, `supabase/seed.sql` |
| 3 | docker-compose | Sí | `infra/docker-compose.yml` |
| 4 | Informe corto | Sí | `docs/informe.md` |
| 5 | Video o defensa | Pendiente | Recorrer H1, H2 y RF-16 (guía en el README) |
| 6 | PRD cumplido | Sí | Este checklist |
