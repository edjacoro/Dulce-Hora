# PedidosYa: importación y conciliación

Estado local al 18/10/2026. El código y los informes históricos están preparados, pero la publicación en Netlify y la carga a la base online todavía deben verificarse. No se guardaron credenciales ni códigos de acceso.

## Qué informa PedidosYa

El CSV de **Pedidos** contiene cada pedido, su venta (`Total parcial`), comisión, servicio de pago online, impuestos, descuentos y un **Ingreso estimado**. Ese ingreso no es necesariamente el depósito final. En **Finanzas → Estado de Cuenta**, PedidosYa muestra por semana ventas y cargos adicionales: servicios, operación, publicidad, reintegros, ajustes, impuestos, efectivo ya cobrado y el neto de la liquidación. El efectivo descontado de la liquidación debe contarse como ingreso de caja, no como comisión.

Por ejemplo, del 05/10 al 11/10/2026 el estado de cuenta indica ventas de $2.557.002, cargos de servicios de $632.447,50, operaciones de $207.845,85, publicidad de $203.401,43, reintegros por $40.736,25, impuestos por $212.688,47 y efectivo ya cobrado de $292.804. La liquidación neta informada es $1.048.551. Los importes estimados por pedido de esa semana no coinciden con esa liquidación. La fecha programada de pago no prueba que el banco haya recibido el dinero.

## Archivos privados preparados

En `data/pedidosya/` hay ocho CSV de pedidos desde el 01/04 hasta el 17/10/2026 y `pedidosya-settlements-2026-04_2026-10.csv` con 24 estados de cuenta semanales del 27/04 al 11/10/2026. Hay 2.472 filas de pedidos; 2.416 pedidos entregados con importes, 40 cancelados y 16 entregados aún sin importes financieros. Estos archivos están excluidos de Git por `.gitignore`; no deben cargarse al repositorio público. Los 16 pendientes requieren volver a exportar su período cuando el portal complete los importes.

El primer estado de cuenta obtenido comienza el 27/04. Los pedidos del 01/04 al 26/04 quedan con estimaciones por pedido hasta conseguir sus liquidaciones. Del 12/10 al 17/10 también quedan estimados hasta que aparezca el estado de cuenta correspondiente.

## Cómo cargarlo después del deploy

1. Publicar la carpeta `netlify-repo` completa en el repositorio que lee Netlify, incluidas `server/migrations/023_pedidosya_settlements.sql` y las funciones. La base persistente del servidor debe estar configurada antes de importar.
2. Abrir **Integraciones** en la web publicada y seleccionar la sucursal correcta.
3. En **PedidosYa: informe de pedidos**, subir los ocho CSV, cada uno con el mismo intervalo elegido al descargarlos. La importación usa el ID del pedido para actualizar registros existentes sin duplicarlos. Si ya hay ventas manuales de PedidosYa para un día, la carga se detiene para revisar el solapamiento.
4. En **PedidosYa: estados de cuenta**, subir `pedidosya-settlements-2026-04_2026-10.csv`. El importador registra el neto y crea un ajuste por la diferencia con el ingreso estimado por pedidos. Volver a subir un archivo corregido actualiza la misma semana.
5. Comprobar **Finanzas** contra el estado de cuenta de una semana de muestra. Reexportar periódicamente las fechas recientes con pedidos pendientes de importes y añadir nuevos estados de cuenta semanales. No hace falta releer todo el histórico en el celular.

La aplicación consulta los registros ya guardados en la base del servidor. Los cargos por pedido se consideran estimados hasta que exista el estado de cuenta semanal; entonces la conciliación ajusta el resultado neto, incluida publicidad y otros descuentos semanales. El total bruto por pedido sigue viniendo del CSV de pedidos, que puede diferir del renglón «Ventas» del estado de cuenta; ambas cifras deben mostrarse y compararse antes de considerar cerrado un período. El calendario de cobro en Finanzas es proyectado si no se importa una fecha real de pago. No se ha verificado un acceso automático o API del portal que evite su inicio de sesión y verificación telefónica.
