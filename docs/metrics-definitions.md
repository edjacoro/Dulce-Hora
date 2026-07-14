# Definiciones de metricas

Zona horaria: `America/Argentina/Buenos_Aires`  
Moneda: `ARS`

Estas formulas son la base para Fase 2+. Deben implementarse en servicios testeables.

## Venta neta

Formula:

```text
sum(sales_documents.total) excluyendo documentos anulados y ajustando notas de credito
```

Fuente: `sales_documents`.

Exclusiones:

- Comprobantes anulados.
- Duplicados detectados.

Notas de credito:

- Restan ventas si la fuente permite identificarlas.
- Si la fuente no permite identificarlas, marcar metrica como incompleta.

## Tickets

Formula:

```text
count(distinct sales_documents.id) de documentos validos
```

Exclusiones:

- Anulados.
- Notas de credito si no representan venta.

## Ticket promedio

Formula:

```text
venta_neta / tickets
```

Si `tickets = 0`, devolver `0` y estado "sin datos".

## Unidades por ticket

Formula:

```text
sum(sale_items.quantity) / tickets
```

Requiere items por comprobante. Si la fuente no trae items, marcar como no disponible.

## Variacion porcentual

Formula:

```text
(valor_actual - valor_base) / abs(valor_base) * 100
```

Si `valor_base = 0`, no mostrar porcentaje; mostrar diferencia absoluta.

## Proyeccion mensual

Formula inicial:

```text
venta_acumulada_mes / dias_transcurridos_con_datos * dias_del_mes
```

Debe distinguir dias sin datos de dias con venta cero real.

## Margen bruto estimado

Formula:

```text
venta_neta - costo_estimado_mercaderia
```

Fuente de costos: `products.cost` y `sale_items.quantity`.

Regla:

- No presentar como margen real si faltan costos suficientes.
- Mostrar cobertura de costos, por ejemplo: porcentaje de items con costo.

## Resultado operativo

Formula:

```text
margen_bruto_estimado - gastos_operativos
```

Debe rotularse como estimado si los costos no estan completos.

## Costo de merma

Formula:

```text
sum(waste_records.quantity * waste_records.unit_cost)
```

Si `total_cost` viene persistido, debe coincidir con cantidad por costo unitario o registrar diferencia.

## Cumplimiento de objetivos

Formula:

```text
venta_neta / daily_targets.sales_target * 100
```

Si no hay objetivo, mostrar "sin objetivo".

## Cross-selling

Formula:

```text
tickets_compartidos(producto_a, producto_b) / tickets_con_producto_a * 100
```

Requiere items por comprobante. No inferir asociaciones si la fuente no permite identificar articulos por ticket.

## Redondeo

- Importes: 2 decimales.
- Porcentajes: 1 decimal.
- Cantidades: conservar precision de origen, mostrar hasta 2 decimales.
