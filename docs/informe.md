# AgroPulse — Informe

**Desarrollo y Arquitectura en Aplicaciones Móviles · 2026**
**Trabajo individual:** `<Nombre y apellido>`
**Repositorio:** https://github.com/candelarojas1/AgroPulse

> Los datos de humedad, clima y ubicación son ficticios: los genera un simulador y los lotes no corresponden a un predio real.

## 1. Qué es AgroPulse

Una app móvil que muestra los lotes de un campo en un mapa con un semáforo de humedad (seco, óptimo, húmedo o sin datos), permite ver el detalle de cada lote y mandar a regar. Los sensores son simulados.

Se implementaron todos los requisitos Must del PRD y los no funcionales obligatorios. De los Should se agregaron el historial de comandos y el paso de los comandos por Kafka.

## 2. Arquitectura

```
 [App] ──── Supabase (Auth · Postgres · Realtime) ──── [Worker] ──── [Redpanda] ──── [Simulador]
```

- **App (Expo + TypeScript):** muestra los datos y manda comandos. Solo habla con Supabase.
- **Supabase:** guarda los datos, controla quién ve qué (RLS) y avisa los cambios en vivo (Realtime).
- **Simulador:** hace de sensor. Publica una lectura cada pocos segundos en Redpanda (Kafka).
- **Worker:** lee los eventos de Redpanda y los guarda en Supabase. También aplica los comandos de riego.

La app nunca se conecta a Redpanda. Solo el worker tiene la clave con permisos totales (service role); la app usa la clave pública (anon key).

## 3. Por qué el celular no usa Kafka

- **Red:** Kafka necesita una conexión estable y en el campo la señal se corta.
- **Seguridad:** Kafka no conoce a los usuarios de la app; habría que abrir el broker a internet.
- **Volumen:** el celular recibiría las lecturas de todas las estaciones, cuando solo necesita las suyas.
- **Cambios:** si cambia el formato de un evento, se rompen las apps instaladas. Con el worker en el medio, el cambio se hace en un solo lugar.
- **Soporte:** no hay un cliente de Kafka confiable para React Native.

## 4. Seguridad (RLS)

Cada usuario pertenece a uno o más establecimientos con un rol. Las reglas de la base (RLS) usan esa pertenencia para decidir qué puede hacer:

| Acción | Productor | Operador | Asesor |
|---|---|---|---|
| Ver lotes, lecturas y válvulas | Sí | Sí | Sí |
| Editar el umbral de humedad | Sí | No | No |
| Mandar a regar | Sí | Sí | No |

Un usuario de otro establecimiento no ve nada de la Estancia. Las lecturas y el estado de las válvulas solo los escribe el worker.

Como las reglas están en la base y no en la app, aunque alguien modifique la app la base rechaza lo que no corresponde. Por eso el asesor ve el botón de regar deshabilitado y, si lo forzara, la base respondería con error 403.

## 5. Cómo funciona un comando de riego

1. La app guarda el comando en la base con estado **pendiente**.
2. El worker lo toma, lo publica en Kafka y lo aplica (espera 1 a 3 segundos, como una válvula real).
3. El comando pasa a **aplicado** (o a **falló** en el 10 % de los casos, para mostrar el error) y la app se entera por Realtime.
4. Si la app no recibe respuesta en 10 segundos, muestra "Sin confirmación" en lugar de quedarse cargando.

Dos reglas las controla la base: no puede haber dos comandos pendientes en la misma válvula, y un mismo comando no se puede enviar dos veces (cada uno lleva un identificador único, el `client_request_id`).

En las pruebas, un comando tardó entre 2 y 3,5 segundos en aplicarse (el PRD pide 5 como máximo), y una lectura tardó menos de 1 segundo en llegar a la app (el PRD pide 3).

## 6. Decisiones tomadas

| Tema | Decisión |
|---|---|
| El PRD se contradice sobre si el operador edita umbrales | Solo el productor los edita |
| No dice qué pasa al terminar "regar N minutos" | La válvula se cierra sola |
| El semáforo depende de la hora (un sensor caído no avisa) | Se calcula en la app y se actualiza cada 30 segundos |
| "¿Estoy en el lote?" | Se calcula en el celular, sin enviar la ubicación |
| Seis horas de lecturas son demasiados datos para el gráfico | Se muestra un promedio cada 5 minutos |

## 7. Flujo H1

El productor ve Costa 2 en rojo, entra al detalle, manda a regar 30 minutos y la válvula queda abierta.

| Mapa | Detalle | Confirmar | Válvula abierta |
|---|---|---|---|
| ![Mapa](img/01-mapa.jpg) | ![Detalle](img/02-detalle-seco.jpg) | ![Confirmar](img/03-confirmar-comando.jpg) | ![Válvula abierta](img/04-valvula-abierta.jpg) |

## 8. Limitaciones

- No se implementaron la carga manual sin conexión, las alertas ni la cancelación de comandos (son opcionales en el PRD).
- Se probó solo en el simulador de iOS.
