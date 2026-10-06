# AgroPulse — Checklist del PRD

## Requisitos funcionales

| ID | Requisito | Estado | Cómo se comprueba |
|---|---|---|---|
| RF-01 | Iniciar y cerrar sesión | Sí | Con una contraseña incorrecta aparece un error. Al cerrar y abrir la app, la sesión sigue. |
| RF-02 | Ver solo los campos propios | Sí | El usuario `otro@` no ve los lotes de la Estancia. |
| RF-03 | Elegir establecimiento | Sí | El productor cambia de campo en Cuenta y el mapa cambia. |
| RF-04 | Lista de lotes | Sí | La pestaña Lotes muestra cada lote con su estado. |
| RF-05 | Mapa de lotes | Sí | Al tocar un lote se abre su detalle. |
| RF-06 | "Estoy en el lote" | Sí | Indica en qué lote estás. Sin permiso de ubicación muestra un aviso. |
| RF-08 | Estaciones con lecturas | Sí | Cada lote tiene una estación con humedad, temperatura y lluvia. |
| RF-09 | Última lectura | Sí | El detalle muestra la humedad y hace cuánto se midió. |
| RF-10 | Gráfico de 6 horas | Sí | El gráfico se actualiza solo cuando llega una lectura. |
| RF-11 | Umbral de humedad | Sí | El productor lo cambia y el color del lote se actualiza. |
| RF-12 | Semáforo | Sí | Rojo seco, verde óptimo, azul húmedo, gris sin datos. |
| RF-13 | Válvulas | Sí | El detalle muestra si cada válvula está abierta o cerrada. |
| RF-14 | Mandar a regar | Sí | Se puede abrir, cerrar o abrir por unos minutos. |
| RF-15 | Confirmación del riego | Sí | En menos de 5 segundos el pedido figura como aplicado. |
| RF-16 | Un riego pendiente por válvula | Sí | Un segundo pedido muestra "Ya hay un comando pendiente". |
| RF-18 | Historial de riegos (opcional) | Sí | Muestra fecha, usuario y resultado de los últimos riegos. |
| RF-23 | Pantalla Diagnóstico | Sí | Muestra el usuario, el campo y la última lectura recibida. |
| RF-24 | Registros del worker | Sí | La consola del worker muestra cada lectura procesada. |

## Requisitos no funcionales

| ID | Requisito | Estado | Cómo se cumple |
|---|---|---|---|
| RNF-01 | Tecnologías pedidas | Sí | Expo, TypeScript y Expo Router. |
| RNF-02 | Claves seguras | Sí | La app no contiene la clave secreta de Supabase. |
| RNF-03 | Mapa rápido | Sí | El mapa carga todos los lotes con una sola consulta. |
| RNF-04 | Datos en vivo | Sí | Una lectura llega a la app en menos de 1 segundo. |
| RNF-05 | Errores claros | Sí | Ante un error la app muestra un mensaje y no se queda cargando. |
| RNF-06 | Instrucciones | Sí | El README explica cómo instalar y probar todo. |
| RNF-10 | Datos ficticios | Sí | Se aclara en el README, el informe y la app. |

## Historias de usuario

| Historia | Estado |
|---|---|
| H1 — El productor riega un lote seco | Sí |
| H2 — El asesor no puede regar | Sí |
| H3 — Carga manual sin conexión (opcional) | No |
| H4 — Un sensor caído se ve como "sin datos" | Sí |
