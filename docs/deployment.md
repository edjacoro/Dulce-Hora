# Despliegue

Estado: guia preliminar de Fase 1.

## Netlify

Frontend recomendado:

- Build: `npm run build`
- Publish: `dist`
- Variables de entorno en Netlify UI, no en archivos.

Variables esperadas:

```text
DULCE_HORA_USERNAME
DULCE_HORA_PASSWORD
DATABASE_URL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
APP_URL
SESSION_SECRET
ENCRYPTION_KEY
```

## Backend

Opcion recomendada:

- Supabase PostgreSQL.
- Supabase Auth o auth propia con sesiones seguras.
- Edge Functions para sincronizacion con Dulce Hora.

Si se usa Netlify Functions:

- Mantener secretos solo en entorno server-side.
- Implementar rate limit.
- Usar `DATABASE_URL` server-side.
- No exponer service keys al cliente.

## Integracion Dulce Hora

Las credenciales del panel externo deben configurarse solo como variables de entorno server-side:

- `DULCE_HORA_USERNAME`
- `DULCE_HORA_PASSWORD`

El frontend nunca debe recibir estas credenciales. Las funciones de sincronizacion deben usar allowlist de rutas de lectura y logs estructurados sin cookies ni passwords.

## Backups

Politica inicial:

- Backup diario de PostgreSQL.
- Export manual CSV para ventas, gastos, mermas y productos.
- Backup antes de migraciones.
- Prueba de restauracion mensual.

## Recuperacion

Procedimiento esperado:

1. Congelar importaciones automaticas.
2. Restaurar snapshot PostgreSQL.
3. Validar conteos por tabla.
4. Reejecutar sync/importaciones faltantes por periodo.
5. Revisar `audit_logs` y `sync_runs`.

## Pendiente para Fase 2

- Crear proyecto Vite.
- Configurar Netlify.
- Definir migraciones.
- Configurar CI/tests.
- Documentar comandos reales de instalacion cuando exista `package.json`.
