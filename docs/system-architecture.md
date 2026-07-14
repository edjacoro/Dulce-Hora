# Arquitectura objetivo

Estado: propuesta de Fase 1. No implementada todavia.

## Principios

- Datos reales primero.
- Integracion server-side.
- PostgreSQL como fuente de verdad.
- Validacion fuerte en entrada.
- Auditoria de cambios.
- Separacion entre dato bruto importado y dato normalizado.
- Multi-sucursal desde el modelo inicial.

## Stack recomendado

### Frontend

- React.
- TypeScript estricto.
- Vite.
- React Router.
- TanStack Query.
- React Hook Form.
- Zod.
- Recharts.
- CSS modular o Tailwind si se adopta de forma consistente.

### Backend

Recomendacion provisional: Supabase con PostgreSQL y Edge Functions.

Justificacion:

- PostgreSQL administrado.
- Migraciones versionables.
- Row Level Security.
- Auth y roles integrables.
- Edge Functions para integraciones server-side.
- Buen encaje con Netlify para frontend estatico.

Alternativa viable: PostgreSQL + Netlify Functions si se prefiere controlar auth y sesiones completamente en el backend propio.

## Modulos

- Autenticacion y usuarios.
- Organizaciones y sucursales.
- Integraciones.
- Importaciones.
- Ventas.
- Productos y normalizacion.
- Analisis horario.
- Gastos.
- Mermas.
- Finanzas.
- Alertas.
- Auditoria.
- Exportaciones y backup.

## Integracion Dulce Hora descubierta

La Fase 1 autenticada encontro dos vias utiles:

- XLSX agregado: `GET /panel/estadisticas/local/exportar`.
- Detalle documento por documento: `GET /panel/facturacion/registros?fecha=YYYYMMDD` mas endpoints JSON de comprobante.

Para el MVP conviene implementar ambas capas:

- Importador XLSX para dashboard rapido y validacion de metricas agregadas.
- Sincronizador server-side por fecha para poblar `sales_documents` y `sale_items`.

La automatizacion Playwright queda como fallback si las lecturas HTTP autenticadas dejan de ser estables.

## Modelo de datos inicial

Entidades requeridas:

- `organizations`
- `branches`
- `users`
- `sales_documents`
- `sale_items`
- `products`
- `product_aliases`
- `categories`
- `expenses`
- `expense_categories`
- `waste_records`
- `daily_targets`
- `imports`
- `sync_runs`
- `audit_logs`

Restricciones clave:

- `sales_documents(branch_id, external_id)` unico cuando `external_id` exista.
- Si no existe `external_id`, calcular `dedupe_key` con campos normalizados.
- `sale_items` conserva `original_name` y opcionalmente referencia `normalized_product_id`.
- `raw_data` se guarda para auditoria, sin modificar el dato bruto importado.

## Deduplicacion propuesta

Cuando exista ID externo:

```text
unique(branch_id, external_id)
```

Cuando no exista ID externo:

```text
dedupe_key = sha256(
  branch_id + "|" +
  document_type + "|" +
  document_number + "|" +
  sale_date + "|" +
  total + "|" +
  payment_method
)
```

Si el panel entrega punto de venta o caja, se deben sumar a la clave.

Para Dulce Hora, `id` del comprobante externo debe guardarse como `external_id` cuando provenga de los endpoints JSON. Si no estuviera disponible, usar:

```text
dedupe_key = sha256(
  branch_id + "|" +
  tipo + "|" +
  ptoventa + "|" +
  numero + "|" +
  fechaevento + "|" +
  total
)
```

## Migraciones

Las migraciones se implementaran en Fase 2, despues de cerrar la estrategia de integracion. Deben incluir:

- Tipos enum para roles, estados e import status.
- Indices por fecha, sucursal, documento, producto y fuente.
- RLS por organizacion y sucursal si se usa Supabase.
- Triggers de `audit_logs` para entidades operativas.

## Normalizacion de productos

El dato importado nunca se pisa.

Flujo:

1. Se importa `sale_items.original_name`.
2. Se busca alias en `product_aliases`.
3. Si existe, se asigna `normalized_product_id`.
4. Si no existe, queda en cola de "sin clasificar".
5. Usuario asigna alias, categoria, costo y margen objetivo.

## Roles

- `owner`: acceso total.
- `administrator`: administracion operativa y financiera.
- `manager`: visualizacion y carga limitada.
- `viewer`: solo lectura.

## Limites de Fase 1

No se implementa UI, backend ni migraciones ejecutables en esta fase. El metodo de obtencion de datos ya quedo definido a nivel tecnico para iniciar Fase 2.
