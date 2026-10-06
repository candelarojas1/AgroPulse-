# AgroPulse — Riego de precisión (demo)

App móvil en **React Native (Expo + TypeScript + Expo Router)** para agricultura de precisión: lotes en un mapa con semáforo de humedad, detalle con lecturas y gráfico de 6 h, y comandos de riego con acuse. Backend en **Supabase** (Auth, Postgres con RLS, Realtime) y telemetría simulada que viaja por **Redpanda (Kafka)** solo del lado del backend: la app nunca se conecta al broker.

> ⚠️ **Datos ficticios.** Las lecturas de humedad, temperatura y lluvia son simuladas y no están calibradas a un sensor real. Las coordenadas de los lotes son aproximadas a la zona de Concordia y Federal (Entre Ríos) y no corresponden a un predio real. No es un sistema productivo de campo.

| Componente | Responsabilidad |
|---|---|
| App (`apps/agropulse`) | UI, GPS, comandos. Usa solo la anon key + RLS. Nunca habla con Kafka. |
| Supabase | Fuente de verdad: Auth, Postgres con RLS, Realtime. |
| Redpanda | Bus de eventos (topics `soil.moisture`, `irrigation.commands`, `valve.status`). |
| Simulador (`services/worker/src/simulator.ts`) | Hace de sensor: publica ticks cada 3–8 s por estación. No tiene credenciales de Supabase. |
| Worker (`services/worker/src/worker.ts`) | Traduce eventos → SQL con la service role: guarda lecturas y aplica comandos. |

El detalle de las decisiones está en el [informe](docs/informe.md), el cumplimiento de requisitos en el [checklist](docs/checklist-prd.md).

## 🗂️ Estructura

```
apps/agropulse/          App Expo
  src/app/               Pantallas (Expo Router): login, tabs Mapa/Lotes/Cuenta, detalle, comando, historial, diagnóstico
  src/context/           Sesión, establecimiento activo y lotes (con Realtime)
  src/lib/               Semáforo, geometría, formato, errores, cliente Supabase
supabase/migrations/     Esquema, RLS, vistas y Realtime (0001 → 0004)
supabase/seed.sql        Semilla de datos (re-ejecutable para resetear la demo)
services/worker/         Simulador de sensores y worker (Node 24 + TypeScript + kafkajs)
infra/docker-compose.yml Redpanda + simulador + worker
scripts/create-users.mjs Crea los usuarios de prueba
docs/                    Informe, checklist del PRD y capturas
```

---

## ✅ Requisitos previos

- **Node.js ≥ 20.19.4** (lo pide Expo SDK 57).
- **Docker Desktop** abierto (para Redpanda, el simulador y el worker).
- **Simulador de iOS** (Xcode) o emulador de Android con **Expo Go**.
- Un **proyecto en [Supabase](https://supabase.com)** (el plan gratuito alcanza).

## ⚙️ Puesta en marcha

### 1. Clonar el repositorio

```bash
git clone https://github.com/candelarojas1/AgroPulse.git
cd AgroPulse
```

### 2. Crear la base en Supabase

En el dashboard del proyecto → **SQL Editor** → **New query**, ejecutar **en este orden** el contenido de:

1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_rls.sql`
3. `supabase/migrations/0003_view_realtime.sql`
4. `supabase/migrations/0004_moisture_chart_view.sql`
5. `supabase/seed.sql`

Cada uno debe terminar con *"Success. No rows returned"*.

### 3. Variables de entorno

Los valores están en **Project Settings → API** del proyecto de Supabase.

```bash
cp .env.example .env                                   # worker, simulador y script de usuarios
cp apps/agropulse/.env.example apps/agropulse/.env     # app
```

| Archivo | Variable | Valor |
|---|---|---|
| `.env` | `SUPABASE_URL` | URL del proyecto (`https://<id>.supabase.co`) |
| `.env` | `SUPABASE_SERVICE_ROLE_KEY` | clave **service_role** (secreta: nunca va en la app) |
| `.env` | `TEST_USERS_PASSWORD` | contraseña común de los usuarios de prueba (mín. 6 caracteres) |
| `apps/agropulse/.env` | `EXPO_PUBLIC_SUPABASE_URL` | URL del proyecto |
| `apps/agropulse/.env` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | clave **anon** (pública) |

### 4. Crear los usuarios de prueba

```bash
node --env-file=.env scripts/create-users.mjs
```

### 5. Levantar el backend de eventos

```bash
DURATION_MINUTE_SECONDS=5 docker compose -f infra/docker-compose.yml up -d --build
docker compose -f infra/docker-compose.yml logs -f simulator worker   # ver produced / consumed / upsert reading
```

| Variable opcional | Default | Uso |
|---|---|---|
| `DURATION_MINUTE_SECONDS` | `60` | Segundos que dura un "minuto" de riego. Con `5`, "abrir 30 min" cierra a los 2,5 min (útil para la demo). |
| `SIM_PAUSED_STATIONS` | `Monte A` | Lotes cuyo sensor no envía ticks (demo de "sin datos"). Vacío = todos activos. |

Para frenarlo: `docker compose -f infra/docker-compose.yml stop`.

### 6. Correr la app

```bash
cd apps/agropulse
npm install
npx expo start
```

Presionar **`i`** para abrir en el simulador de iOS (o **`a`** para Android).

**Plataforma probada:** iOS Simulator (iPhone 17, iOS 27) con Expo Go.

---

## 👥 Usuarios de prueba

Todos usan la contraseña definida en `TEST_USERS_PASSWORD`.

| Usuario | Rol | Establecimientos | Para mostrar |
|---|---|---|---|
| `productor@agropulse.test` | Productor | Estancia Didáctica Concordia + Paraje Demo Federal | H1, edición de umbrales, selector de establecimiento |
| `operador@agropulse.test` | Operador de riego | Estancia | Puede regar, no editar umbrales |
| `asesor@agropulse.test` | Asesor | Estancia | H2: ve todo, no puede regar |
| `otro@agropulse.test` | Productor | Paraje Demo Federal | Aislamiento: no ve los lotes de la Estancia |

