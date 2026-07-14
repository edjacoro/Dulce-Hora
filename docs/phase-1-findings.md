# Resumen Fase 1

Fecha: 2026-07-12

## Hallazgos principales

- El workspace local estaba vacio al iniciar la fase.
- No se encontro codigo fuente local de OSS Kaffe.
- La referencia OSS publica permite inferir una app HTML/CSS/JS directa, servida por Netlify, con `app.js`, `styles.css`, SheetJS y endpoints `/api/...`.
- OSS contiene conceptos reutilizables, pero no conviene copiar su arquitectura tecnica.
- El panel de Dulce Hora protege `/panel/facturacion/registros` con redireccion a `/login`.
- Se completo descubrimiento autenticado sin guardar credenciales en archivos.
- Se hizo login solo para lectura. No se ejecutaron acciones mutantes ni se cargo, borro o modifico informacion externa.
- Hay export XLSX de estadisticas y endpoints JSON de detalle por comprobante.

## Endpoints OSS observados

- `GET /api/team`: respondio sin sesion. Riesgo: expone metadata de equipo. No se documentan datos personales.
- `GET /api/state`: respondio `401` sin sesion.
- `GET /api/bistrosoft/status?location=...`: respondio `401` sin sesion.
- `GET /api/bistrosoft/months?location=...`: respondio `401` sin sesion.
- Bundle cliente referencia `GET /api/bistrosoft/sales?...`.
- Bundle cliente referencia `/api/auth/{role}`, `/api/auth/employee` y `/api/auth/logout`.

## Endpoints Dulce Hora observados

- `GET /panel/facturacion/registros`: `302` a `/login`.
- `GET /login`: `200`, HTML con formulario tradicional.
- `POST /login`: usado exclusivamente para crear sesion autenticada.
- `GET /panel/notificaciones/check`: `302` a `/login` sin sesion.
- `GET /panel/notificaciones/leer`: `302` a `/login` sin sesion.
- `GET /panel/facturacion/registros?fecha=YYYYMMDD`: listado diario HTML.
- `GET /panel/facturacion/comprobante?id=<id>`: JSON de comanda.
- `GET /panel/facturacion/comprobante/fiscal?id=<id>`: JSON de comprobante fiscal.
- `GET /panel/facturacion/comprobante/parcial?id=<id>`: JSON de senia.
- `HEAD/GET /panel/estadisticas/local/exportar`: XLSX de estadisticas.

Scripts publicos:

- `/script/login.js`
- `/script/backScript.js`
- `/script/notificaciones.js`
- `/script/mostrarResultados.js`

## Mecanismo de autenticacion Dulce Hora

Confirmado:

- Formulario tradicional con `method="post"` y `action="/login"`.
- Campos `loginUsuario` y `loginPassword`.
- Redireccion a `/login` cuando no hay sesion.
- Sesion server-side con cookies `session` y `session.sig`, ambas `Secure` y `HttpOnly`.
- No se observo JWT, OAuth, `localStorage` ni `sessionStorage` en login.
- No se observo token CSRF visible en el HTML inicial.

## Campos de facturacion

Confirmados:

- Fecha y hora.
- Numero y tipo de comprobante.
- Punto de venta en comprobantes fiscales.
- Total, neto, IVA 10,5%, IVA 21%.
- Medio de pago.
- Items por comprobante en `detalle`.
- Cantidad por item.
- Importe por item.
- ID de producto o boton personalizado.
- Senia.
- CAE.
- Relacion con nota de credito cuando existe.
- Campos Mercado Pago.

Pendientes:

- Catalogo completo producto ID -> nombre/categoria desde una fuente estable.
- Vendedor/caja por comprobante individual.
- Estados/anulaciones completos.

## Riesgos

- El listado de comprobantes es HTML, no JSON.
- El export XLSX es agregado; sirve para dashboard, no para auditoria documento por documento.
- El detalle por comprobante tiene items, pero requiere iterar IDs.
- Si no hay ID externo estable, se necesitara `dedupe_key` calculado.
- Algunas acciones mutantes usan GET; el integrador debe bloquear esas rutas por allowlist estricta.
- No se debe replicar la exposicion publica de datos de equipo observada en OSS.
- No se debe replicar PIN admin o reglas sensibles visibles del lado cliente.

## Estrategia recomendada

1. Implementar importador XLSX para `/panel/estadisticas/local/exportar` como camino MVP de metricas agregadas.
2. Implementar sincronizador server-side por fecha: leer `/panel/facturacion/registros?fecha=YYYYMMDD`, extraer IDs y consultar endpoints JSON de detalle.
3. Usar allowlist de rutas de solo lectura y bloquear nota de credito/facturacion/caja.
4. Mantener Playwright como fallback, no como primera opcion.
5. Pasar a Fase 2: base de datos, auth, migraciones y estructura de app.

## Plan de implementacion por fases

- Fase 2: crear proyecto React/Vite, backend elegido, auth, migraciones y RLS/permisos.
- Fase 3: implementar importador o sincronizador segun descubrimiento autenticado.
- Fase 4: ventas, productos, normalizacion y dashboard.
- Fase 5: gastos, mermas y finanzas.
- Fase 6: auditoria, respaldos, permisos finales y despliegue.
