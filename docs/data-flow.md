# Flujo de datos

Estado: propuesta de Fase 1.

## Flujo preferido

```mermaid
flowchart LR
  A["Panel Dulce Hora"] --> B["XLSX estadisticas o HTML registros"]
  B --> C["Backend de integracion"]
  C --> D["Validacion Zod"]
  D --> E["Staging de importacion"]
  E --> F["Deduplicacion"]
  F --> G["PostgreSQL"]
  G --> H["Servicios de metricas"]
  H --> I["Dashboard React"]
  G --> J["Auditoria y backups"]
```

## Flujo documento por documento

```mermaid
flowchart LR
  A["Backend con sesion Dulce Hora"] --> B["GET registros por fecha"]
  B --> C["Extraer IDs y tipos"]
  C --> D["GET detalle JSON"]
  D --> E["Parsear detalle items"]
  E --> F["Deduplicar documentos"]
  F --> G["PostgreSQL sales_documents"]
  E --> H["PostgreSQL sale_items"]
```

Allowlist inicial de lectura:

- `/panel/facturacion/registros?fecha=YYYYMMDD`
- `/panel/facturacion/comprobante?id=<id>`
- `/panel/facturacion/comprobante/fiscal?id=<id>`
- `/panel/facturacion/comprobante/parcial?id=<id>`
- `/panel/estadisticas/local/exportar`

## Flujo con importacion manual

```mermaid
flowchart LR
  A["Usuario descarga Excel/CSV desde Dulce Hora"] --> B["Carga archivo en Dulce Hora Control"]
  B --> C["Preview y deteccion de columnas"]
  C --> D["Validacion por fila"]
  D --> E["Confirmacion de importacion"]
  E --> F["Transaccion PostgreSQL"]
  F --> G["Historial de importaciones"]
```

## Flujo con Playwright backend

```mermaid
flowchart LR
  A["Scheduler o boton sincronizar"] --> B["Funcion backend"]
  B --> C["Playwright server-side"]
  C --> D["Login con variables de entorno"]
  D --> E["Filtros de fecha"]
  E --> F["Descarga o lectura de registros"]
  F --> G["Cierre de navegador"]
  G --> H["Parser y validacion"]
  H --> I["PostgreSQL"]
```

## Politicas

- No ejecutar Playwright en el navegador del usuario.
- No guardar contrasenas en logs.
- No superar una solicitud por segundo durante descubrimiento.
- Importaciones deben ser idempotentes.
- Reimportar un periodo debe reemplazar solo ese periodo y esa fuente.
- Cada importacion debe generar `imports` y, si es sync automatica, `sync_runs`.
