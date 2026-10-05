# AgroPulse — Riego de precisión (demo)

App móvil en **React Native (Expo + TypeScript + Expo Router)** para agricultura de precisión: lotes en un mapa con semáforo de humedad, detalle con lecturas y gráfico, y comandos de riego con acuse. Backend en **Supabase** (Auth, Postgres con RLS, Realtime) y telemetría simulada que viaja por **Redpanda (Kafka)** solo del lado del backend.

> ⚠️ **Datos ficticios.** Las lecturas de humedad, temperatura y lluvia son simuladas y las coordenadas de los lotes son aproximadas a la zona de Concordia (Entre Ríos), no corresponden a un predio real. No es un sistema productivo de campo.

---

## 🗂️ Estructura

```
apps/agropulse/      App Expo
supabase/            Migraciones (esquema + RLS) y semilla
services/worker/     Simulador de sensores y worker (Kafka → Supabase)
infra/               docker-compose (Redpanda + simulador + worker)
scripts/             Creación de usuarios de prueba
docs/                Informe y checklist del PRD
```

---

## 🚀 Cómo correr el proyecto

_En construcción: se completa a medida que se agregan la base de datos, el worker y la app._
