# Descubrimiento de integracion Dulce Hora

Fecha de auditoria: 2026-07-12  
Objetivo: determinar como obtener datos reales de facturacion sin modificar informacion externa.

## Estado de credenciales

Se recibieron credenciales para completar la auditoria autenticada. No se escribieron en archivos del repositorio, documentos, capturas ni codigo fuente.

## Metodo usado

- Navegador controlado para abrir `https://pedidosdulcehora.com.ar/panel/facturacion/registros`.
- Requests HTTP de lectura con pausas de al menos 1 segundo.
- Se hizo `POST /login` exclusivamente para autenticar la sesion.
- No se enviaron formularios.
- No se modifico, borro ni cargo informacion.

## Resultado autenticado y no autenticado

### `GET /panel/facturacion/registros`

- URL: `https://pedidosdulcehora.com.ar/panel/facturacion/registros`
- Resultado: `302`
- Redireccion: `/login`
- Content-Type: `text/plain; charset=utf-8`

El navegador termino en:

- `https://pedidosdulcehora.com.ar/login`
- Titulo: `Panel de control DH`

### `GET /login`

- Status: `200`
- Content-Type: `text/html; charset=utf-8`
- Server: `nginx/1.18.0 (Ubuntu)`
- No se observo token CSRF visible en el HTML del formulario.

Formulario detectado:

```html
<form id="loginForm" action="/login" method="post">
  <input type="text" name="loginUsuario" id="loginUsuario" />
  <input type="password" name="loginPassword" id="loginPassword" />
  <input type="submit" value="ingresar" id="loginIngresar" />
</form>
```

Scripts publicos de login:

- `/script/login.js`
- `/script/backScript.js`
- `/script/notificaciones.js`
- `/script/mostrarResultados.js`

### Sesion autenticada

Despues del login correcto, el servidor usa cookies:

- `session`
- `session.sig`

Ambas cookies fueron observadas con atributos `Secure` y `HttpOnly`.

### Endpoints publicos observados en scripts

En los scripts se observaron llamadas fetch a:

- `GET /panel/notificaciones/check`
- `GET /panel/notificaciones/leer`
- `POST /panel/notificaciones/local/lectura`
- `POST /panel/notificaciones/nueva`

Sin sesion, los endpoints GET de notificaciones probados redirigen a `/login`.

No se detecto una API publica de listado de facturacion en los scripts no autenticados.

## Mecanismo de autenticacion

- El login parece ser un formulario tradicional `POST /login`.
- Los campos son `loginUsuario` y `loginPassword`.
- El acceso a paginas internas se protege por redireccion `302` a `/login`.
- La sesion autenticada usa cookies `session` y `session.sig`.
- No se observo JWT, OAuth, `localStorage` ni `sessionStorage` en la pantalla de login.
- No se observo CSRF token visible en el HTML inicial.

## Registros de facturacion

### Listado diario

Endpoint:

- `GET /panel/facturacion/registros`
- `GET /panel/facturacion/registros?fecha=YYYYMMDD`

La pagina es HTML server-rendered. No se observo DataTables ni fetch/XHR para cargar el listado.

Filtro:

- Input `fechaRegFact`, tipo `date`.
- El script cambia la URL a `?fecha=YYYYMMDD`.

Tabla observada:

- `Fecha`
- `Tipo`
- `Numero`
- `Total`
- `Medio`
- `Detalles`
- `Acciones`

Tipos observados:

- `C`: comprobante fiscal.
- `X`: comanda/no fiscal.

Acciones visibles:

- Reimprimir ticket.
- Crear nota de credito.
- Facturar comanda.

Las acciones de nota de credito y facturar comanda son mutantes y no fueron ejecutadas.

### Detalle por comprobante

Los scripts usan endpoints JSON de solo lectura para reconstruir tickets:

- `GET /panel/facturacion/comprobante?id=<id>` para comandas tipo `X`.
- `GET /panel/facturacion/comprobante/fiscal?id=<id>` para comprobantes fiscales.
- `GET /panel/facturacion/comprobante/parcial?id=<id>` para senias.

Campos observados en comprobante fiscal:

- `id`
- `fecha`
- `fechaevento`
- `local`
- `cuitemisor`
- `ptoventa`
- `tipo`
- `numero`
- `formaPago`
- `detalle`
- `neto`
- `baseiva10`
- `iva10`
- `baseiva21`
- `iva21`
- `total`
- `senia`
- `receptor`
- `CAE`
- `observaciones`
- campos Mercado Pago: `mp_payment_id`, `mp_order_id`, `mp_external_reference`, `mp_estado_conciliacion`, `mp_timeout_at`, `mp_reconciled_at`
- `nc_factura`

Campos observados en comanda:

- `id`
- `cuitemisor`
- `local`
- `fechaevento`
- `numero`
- `fecha`
- `tipo`
- `formaPago`
- `detalle`
- `neto`
- `iva10`
- `iva21`
- `total`
- `senia`
- `observaciones`
- `nc_factura`

`detalle` llega como string JSON. Al parsearlo, cada item es un array de 6 posiciones. Inferencia desde `tickets.js`:

- `item[1]`: importe de linea.
- `item[2]`: tasa usada para mostrar IVA/descuento (`item[2] / 10`).
- `item[3]`: tipo/grupo de origen; el codigo usa umbral `>= 100`.
- `item[4]`: cantidad.
- `item[5]`: id de producto o boton personalizado.
- `item[0]`: pendiente de confirmar semanticamente.

El nombre del producto no viene directamente en el item: el frontend lo resuelve contra `window.productos` o `window.botonesPersonalizados`.

## Campos de facturacion

Confirmados o inferidos:

- Fecha y hora: `fechaevento`.
- Numero de comprobante: `numero`.
- Tipo de comprobante: `tipo`.
- Punto de venta: `ptoventa` en comprobantes fiscales.
- Items/productos: `detalle` JSON.
- Cantidad: `detalle[][4]`.
- Total de linea: `detalle[][1]`.
- IVA: `iva10`, `iva21`, `baseiva10`, `baseiva21` y tasa por item.
- Total: `total`.
- Medio de pago: `formaPago`.
- Senia: `senia`.
- Nota de credito relacionada: `nc_factura`.
- Mercado Pago: campos `mp_*`.
- Sucursal/local: campo `local` y etiqueta visual de la sucursal.
- CAE: `CAE` en comprobantes fiscales.

Pendiente:

- Mapear producto ID a nombre/categoria de forma estable.
- Confirmar vendedor/caja por comprobante individual.
- Confirmar anulaciones y estados completos.

## Exportaciones

Confirmada:

- `HEAD /panel/estadisticas/local/exportar`
- `GET /panel/estadisticas/local/exportar`
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Archivo XLSX de estadisticas.

Hojas detectadas:

- `Estadisticas de Ventas`
- `Cronograma de Ventas`
- `Estadisticas de Productos`

Encabezados relevantes:

- Ventas: `Fecha`, `Total de Ventas`, `Total de operaciones`, `Ticket promedio`, `Total con CAE`, `Total sin CAE`, `Registros con CAE`, `Registros sin CAE`, `Efectivo`, `Debito`, `Credito`, `Virtual`.
- Cronograma: ventas por fecha y hora.
- Productos: cantidades por producto/dia.

No se observo export CSV o PDF en registros de facturacion.

## Otros modulos observados

- `GET /panel/facturacion`: pantalla operativa de facturacion, carrito, pagos, descuentos, senias y carga de gastos/retiros.
- `GET /panel/facturacion/registros/gastos`: registros de gastos/retiros con columnas `Fecha`, `Monto`, `Movimiento`, `Detalles`, `Usuario` y filtro `fechaRegGastos`.
- `GET /panel/desperdicios/local`: desperdicios con filtro de fecha.
- `GET /panel/local/caja/cierre`: cierres de caja con columnas `Numero`, `Fecha`, `Apertura`, `Cierre`, `Reporte`.
- `GET /panel/estadisticas/local`: estadisticas con ApexCharts y boton de descarga XLSX.
- `GET /panel/facturacion/local/productos/personalizados`: productos personalizados con columnas `Codigo`, `Nombre`, `Descripcion`, `Precio`, `IVA`, `Estado`, `Editar`, `Eliminar`.

## Riesgos

- No se observo un endpoint JSON unico para listar todos los comprobantes por rango; el listado principal es HTML.
- El export XLSX es agregado/estadistico, no reemplaza todos los documentos crudos.
- El detalle por comprobante permite items, pero requiere iterar IDs obtenidos del HTML.
- Para cross-selling se necesitan items por ticket; tecnicamente estan disponibles en `detalle`.
- Si no hay identificador externo estable, la deduplicacion debera usar una clave calculada documentada.
- Algunas acciones mutantes usan GET (`/panel/facturacion/nc?...`). El robot debe bloquear explicitamente esas rutas.

## Opciones de integracion evaluadas

### Opcion A: API o endpoint JSON estable

Estado: parcial.

Hay endpoints JSON estables para detalle por comprobante, pero no se observo endpoint JSON para listar registros por rango. El listado por dia se obtiene desde HTML.

### Opcion B: Exportacion Excel/CSV

Estado: confirmada para estadisticas.

Recomendacion para MVP: prioritaria para cargar metricas agregadas de ventas, horarios y productos. No alcanza sola para auditoria documento por documento, deduplicacion fina o cross-selling por comprobante.

### Opcion C: Automatizacion de navegador

Estado: fallback.

Probablemente no sea necesario para el primer MVP si se combina export XLSX con requests HTTP server-side autenticados. Debe usarse solo si el HTML o las descargas requieren ejecucion real de navegador.

## Recomendacion final provisoria

Usar una estrategia hibrida:

1. MVP rapido: importador XLSX desde `/panel/estadisticas/local/exportar` para dashboard agregado.
2. MVP con documentos: backend autenticado que lee `/panel/facturacion/registros?fecha=YYYYMMDD`, extrae IDs y consulta los endpoints JSON de detalle.
3. Fallback: Playwright backend solo si el HTTP server-side no resulta estable.

No ejecutar ni automatizar rutas mutantes como nota de credito, facturar comanda o carga de facturacion/gastos.
