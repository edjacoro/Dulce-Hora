# Auditoria tecnica de OSS Kaffe

Fecha de auditoria: 2026-07-12  
Alcance: Fase 1, lectura tecnica sin copiar secretos ni datos personales.

## Disponibilidad del codigo fuente

No se encontro el repositorio fuente de OSS Kaffe en el workspace actual ni en una busqueda acotada dentro de `C:\Users\scumm\OneDrive\Documentos`.

La auditoria se hizo sobre el deploy publico:

- `https://osskaffe-es.netlify.app/`
- `https://osskaffe-es.netlify.app/app.js?v=20`
- `https://osskaffe-es.netlify.app/styles.css?v=12`

Por esta razon, las conclusiones sobre arquitectura son inferencias desde el artefacto desplegado, no desde un repositorio completo.

## Stack observado

- Hosting: Netlify.
- Frontend desplegado: HTML, CSS y JavaScript directo.
- No se observaron artefactos tipicos de React/Vite en el deploy publico.
- Libreria externa relevante: SheetJS mediante `xlsx.full.min.js`.
- Tipografia: Roboto desde Google Fonts.
- Backend/API: endpoints bajo `/api/...`, compatibles con Netlify Functions o un proxy serverless equivalente.

## Estructura observada del deploy

- `index.html`: contiene estructura principal de UI, pantallas de rol, acceso de empleados, admin y visita.
- `styles.css?v=12`: estilos globales.
- `app.js?v=20`: logica principal de aplicacion.
- `xlsx.full.min.js`: lectura de Excel.
- `historical_data.json`: fuente historica consumida por `fetch`.
- `/api/team`: devuelve directorio de equipo.
- `/api/state`: estado compartido protegido por sesion.
- `/api/auth/{role}` y `/api/auth/employee`: autenticacion.
- `/api/auth/logout`: cierre de sesion.
- `/api/bistrosoft/status`, `/api/bistrosoft/sales`, `/api/bistrosoft/months`: integracion Bistrosoft.

## Componentes y modulos funcionales inferidos

El archivo `app.js` contiene funciones para:

- Inicio y render general.
- Seleccion de rol: team, administrador y visita.
- Sucursales/localizaciones.
- Grilla de empleados.
- Fichajes.
- Solicitudes de cambios.
- Trafico y ventas horarias.
- Gastos.
- Mermas.
- Finanzas.
- Importacion Excel/CSV.
- Exportaciones CSV.
- Backup/importacion de estado.
- Sincronizacion Bistrosoft.
- P&L y presupuestos.

La aplicacion parece organizada por funciones grandes dentro de un mismo bundle, no por componentes aislados de framework.

## Persistencia

Se observo la clave:

- `STORAGE_KEY = "oss-barcelona-grid-v1"`

La app usa `localStorage` como snapshot local y tambien llama a `/api/state` para estado compartido. Esto sugiere un modelo hibrido:

- Estado local para recuperacion/uso inmediato.
- Estado remoto protegido por sesion para sincronizar la instalacion.

Para Dulce Hora esto no debe replicarse como base principal. La persistencia principal debe ser PostgreSQL con migraciones, restricciones e indices.

## Autenticacion y roles

Se observaron flujos para:

- Admin.
- Empleado.
- Visita.

Riesgo observado:

- Existe un PIN admin por defecto en el bundle cliente (`0000`) como fallback.
- Parte de la decision de acceso queda visible del lado cliente.
- `/api/team` respondio publicamente sin sesion y expuso metadata de empleados. No se reproducen nombres ni datos personales en este documento.

Para Dulce Hora se debe implementar autenticacion real server-side, hash de passwords, sesiones seguras, roles y permisos.

## Integracion Bistrosoft

Endpoints observados desde el bundle:

- `GET /api/bistrosoft/status?location=...`
- `GET /api/bistrosoft/sales?...`
- `GET /api/bistrosoft/months?location=...`

Sin sesion, los endpoints de Bistrosoft respondieron `401`.

La app distingue ventas y gastos importados desde Bistrosoft con `_source = "bistrosoft"` y permite limpiar o reemplazar datos importados. Esta idea es reutilizable, pero debe reescribirse para Dulce Hora con deduplicacion formal en base de datos.

## Importadores Excel/CSV

Se observaron funciones para:

- Detectar extension `.xlsx`, `.xls` o CSV.
- Usar SheetJS para leer filas.
- Parsear exports tipo Bistrosoft.
- Normalizar fechas y horas.
- Importar ventas y gastos.

Reutilizable conceptualmente:

- Vista previa antes de importar.
- Deteccion de columnas.
- Parseo tolerante de Excel/CSV.
- Historial de importacion.
- Reemplazo seguro por periodo.

Debe reescribirse:

- Validacion con Zod.
- Tests de integracion.
- Deduplicacion con claves unicas en PostgreSQL.
- Reporte de errores por fila.

## Manejo de sucursales

OSS usa localizaciones constantes en el cliente, con IDs observados como `barcelona` y `madrid`. Para Dulce Hora debe migrarse a tabla `branches` con `organization_id`, `external_code`, estado activo y permisos por rol.

## Calculos financieros

Se observaron calculos de:

- Ventas.
- Tickets.
- Ticket promedio.
- Gastos.
- Resultado.
- Proyecciones.
- Presupuesto contra real.
- Gastos por categoria.
- Mermas.
- Analisis por hora.

Para Dulce Hora estos calculos deben centralizarse en servicios testeables y documentarse en `docs/metrics-definitions.md`.

## Que puede reutilizarse

- Navegacion funcional por modulos.
- Concepto de dashboard financiero simple.
- Importacion manual como fallback.
- Exportacion CSV.
- Backup operativo.
- Separacion visual clara entre ventas, gastos, mermas y finanzas.
- Logica de reemplazar datos importados por periodo, si se implementa con transacciones.
- Analisis horario y ranking de productos.

## Que debe reescribirse

- Autenticacion.
- Roles y permisos.
- Persistencia.
- Integracion con facturacion Dulce Hora.
- Importadores con validacion formal.
- Deduplicacion.
- Auditoria.
- Modelo multi-sucursal.
- Calculos financieros compartidos.
- Gestion de secretos.
- Tests.

## Errores de arquitectura o seguridad a no replicar

- PIN admin visible o con fallback del lado cliente.
- Directorio de empleados accesible publicamente.
- `localStorage` como fuente principal de datos operativos.
- Bundle monolitico dificil de testear.
- Datos de negocio mezclados con UI.
- Constantes de sucursal hardcodeadas.
- Falta de trazabilidad robusta por importacion y por cambio.

## Logica acoplada a OSS/Bistrosoft

- IDs de sucursal y nombres de localizacion.
- Formatos de exportacion Bistrosoft.
- Categorias, empleados y reglas horarias propias de OSS.
- Endpoints `/api/bistrosoft/...`.
- Moneda y supuestos de localizacion europeos en partes del bundle.

## Recomendacion para Dulce Hora

Usar OSS como referencia funcional y de simplicidad visual, no como base tecnica directa. Para Dulce Hora conviene construir una arquitectura React + TypeScript + PostgreSQL/Supabase o PostgreSQL + Netlify Functions, con importacion/sincronizacion server-side y auditoria formal.
