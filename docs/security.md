# Seguridad

Estado: lineamientos de Fase 1.

## Secretos

- Nunca guardar `.env` en Git.
- `.env.example` no debe contener valores reales.
- `DULCE_HORA_USERNAME` y `DULCE_HORA_PASSWORD` solo se usan en backend o scripts de descubrimiento locales.
- No imprimir passwords en logs.
- No capturar screenshots con contrasenas visibles.

## Autenticacion

Requisitos:

- Passwords hasheadas.
- Sesiones seguras.
- Cookies `HttpOnly`, `Secure` y `SameSite`.
- Rotacion de `SESSION_SECRET`.
- Rate limiting en login.
- Registro de accesos.

## Autorizacion

Roles:

- `owner`
- `administrator`
- `manager`
- `viewer`

Si se usa Supabase:

- Activar RLS.
- Filtrar por `organization_id`.
- Filtrar por sucursal segun permisos.
- Usar service role solo en funciones server-side.

## Auditoria

Registrar en `audit_logs`:

- Creacion, edicion y eliminacion logica.
- Importaciones.
- Reintentos de sync.
- Cambios de normalizacion.
- Cambios de costos.
- Cambios de objetivos.
- Cambios de roles.

## Integracion Dulce Hora

- Todo acceso al panel externo debe ser de lectura.
- No automatizar acciones que modifiquen datos.
- No eludir controles de seguridad.
- No superar una solicitud por segundo durante descubrimiento.
- Si se usa Playwright, ejecutarlo solo en backend.
- Implementar una allowlist estricta de rutas permitidas.
- Bloquear rutas mutantes aunque usen metodo GET, especialmente nota de credito y facturar comanda.

Allowlist inicial:

- `GET /panel/facturacion/registros`
- `GET /panel/facturacion/registros?fecha=YYYYMMDD`
- `GET /panel/facturacion/comprobante?id=<id>`
- `GET /panel/facturacion/comprobante/fiscal?id=<id>`
- `GET /panel/facturacion/comprobante/parcial?id=<id>`
- `GET /panel/estadisticas/local/exportar`

## Riesgos detectados en referencia OSS

- No replicar PIN admin visible en bundle.
- No exponer directorios de equipo publicamente.
- No usar `localStorage` como base de datos operativa.
- No mezclar credenciales o reglas sensibles en codigo cliente.
