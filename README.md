# Dulce Hora Control

Aplicacion administrativa para Dulce Hora Villa Urquiza, en fase de diagnostico tecnico.

Este repositorio empieza por la Fase 1 solicitada: auditar la referencia OSS Kaffe, investigar el panel de facturacion de Dulce Hora en modo lectura y definir una estrategia de integracion antes de construir pantallas o datos ficticios.

## Estado actual

- Workspace local inspeccionado: no habia codigo fuente previo en `C:\Users\scumm\OneDrive\Documentos\Dulce Hora App`.
- Codigo fuente local de OSS Kaffe: no encontrado en el workspace ni en la busqueda acotada de `Documentos`.
- Deploy publico de OSS Kaffe revisado: `https://osskaffe-es.netlify.app/`.
- Panel Dulce Hora revisado sin autenticacion: `https://pedidosdulcehora.com.ar/panel/facturacion/registros` redirige a `/login`.
- Descubrimiento autenticado de Dulce Hora completado.
- Se hizo login solo para lectura; no se modifico informacion externa.
- Se confirmo export XLSX de estadisticas y endpoints JSON de detalle por comprobante.
- Fase 2 iniciada: app local React/TypeScript con backend Express, autenticacion y base embebida compatible con PostgreSQL.

## Ejecutar localmente

Instalar dependencias:

```bash
pnpm install
```

Iniciar app y backend:

```bash
pnpm dev
```

Abrir:

```text
http://127.0.0.1:5173
```

En Windows tambien podes hacer doble click en `iniciar-app.bat`.

Para sincronizar directo desde el panel de Dulce Hora, usar `iniciar-app-con-sync.bat`; ese iniciador pide usuario y contrasena en consola y no los guarda en archivos.

Para detener los servidores locales, usar `detener-app.bat`.

En el primer ingreso la app muestra la configuracion inicial para crear el usuario owner. No hay credenciales por defecto.

## Sincronizacion operativa con Neon

La app online lee y escribe la base Postgres persistente configurada en `DATABASE_URL`. Netlify puede tomar una fecha puntual desde el portal de Dulce Hora, guardarla en Neon y dejarla disponible para todos los paneles.

Scripts de Windows incluidos:

```text
iniciar-app-online-neon.bat
sincronizar-meses-cerrados-neon.bat
sincronizar-mes-actual-neon.bat
sincronizar-rango-neon.bat
sincronizar-historial-neon.bat
```

Flujo recomendado:

- Dia en curso: Netlify tiene una funcion programada `sync-today` que intenta actualizar las ventas del dia cada 15 minutos y guardarlas en Neon. Tambien se puede forzar manualmente desde Importaciones o Finanzas.
- Dias ya importados: quedan guardados en Neon; no dependen del ordenador.
- Meses cerrados: quedan registrados en `sync_period_locks` como `locked` y no hace falta volver a leerlos completos.
- Herramientas locales: los `.bat` quedan como respaldo tecnico para reintentos grandes o mantenimiento, pero no son necesarios para operar la app online.

No subir `.env.local` al repositorio. Las variables reales se cargan en Netlify y en el entorno local.

## Deploy en Netlify

El repositorio incluye `netlify.toml` y una Function en `netlify/functions/api.ts`.
Netlify publica el frontend desde `dist` y redirige `/api/*` al backend serverless.

Importante: para que exista backend online, Netlify tiene que construir y desplegar Functions. Usar un deploy conectado a Git o Netlify CLI desde la raiz del repositorio. Si se arrastra solamente `dist` como sitio estatico, `/api/*` no va a existir y la app no va a poder conectarse al backend.

Variables minimas en Netlify:

```bash
DATABASE_URL=
DULCE_HORA_USERNAME=
DULCE_HORA_PASSWORD=
NODE_VERSION=22.18.0
```

`DATABASE_URL` debe apuntar a una base Postgres online, por ejemplo Neon o Supabase. Si no se configura una base persistente externa, la base embebida usada por la Function corre en `/tmp` y puede reiniciarse en cold starts. Eso sirve para validar el modelo, pero no para operar el comercio.

## Documentacion

- [Auditoria OSS](docs/oss-architecture-analysis.md)
- [Descubrimiento integracion Dulce Hora](docs/dulce-hora-integration-discovery.md)
- [Resumen Fase 1](docs/phase-1-findings.md)
- [Arquitectura objetivo](docs/system-architecture.md)
- [Flujo de datos](docs/data-flow.md)
- [Definicion de metricas](docs/metrics-definitions.md)
- [Seguridad](docs/security.md)
- [Despliegue](docs/deployment.md)

## Proxima accion necesaria

Para desarrollo y despliegue, definir estas variables de entorno fuera del codigo fuente:

```bash
DULCE_HORA_USERNAME=
DULCE_HORA_PASSWORD=
```

La integracion recomendada para el MVP combina export XLSX de estadisticas con lectura server-side de registros por fecha y detalle JSON por comprobante.

## Reglas del proyecto

- No guardar credenciales reales en el repositorio.
- No usar `localStorage` como base de datos principal.
- No modificar, borrar ni cargar datos en el panel de Dulce Hora durante descubrimiento.
- No construir pantallas demo hasta cerrar el metodo correcto de obtencion de datos.
