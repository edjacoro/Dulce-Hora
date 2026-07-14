-- Snapshot local operativo generado 2026-07-14T13:56:15.723Z
-- Fuente: app local de escritorio. Carga gastos, retiros societarios, fichas y grilla de 2026-07.

with target_org as (
  select id from organizations order by created_at limit 1
),
category_seed (name, pnl_group) as (
  values
    ('Alquiler', 'operating'),
    ('Cargas sociales', 'operating'),
    ('Comisiones', 'operating'),
    ('Franquicia y regalias', 'operating'),
    ('Impuestos', 'operating'),
    ('Logistica', 'operating'),
    ('Mantenimiento', 'operating'),
    ('Marketing', 'operating'),
    ('Materia prima', 'cogs'),
    ('Otros', 'operating'),
    ('Pago Imp Empleados', 'operating'),
    ('Pago Sueldos', 'operating'),
    ('Pago alquiler', 'operating'),
    ('Pago de servicios públicos', 'operating'),
    ('Pago mantenimiento', 'operating'),
    ('Pago proveedor Dulce Hora', 'cogs'),
    ('Pago proveedor Externo', 'cogs'),
    ('Pago publicidad', 'operating'),
    ('Personal', 'operating'),
    ('Servicios', 'operating')
)
insert into expense_categories (id, organization_id, name, pnl_group, active)
select 'snapshot:expense-category:' || md5(target_org.id || ':' || category_seed.name),
       target_org.id,
       category_seed.name,
       category_seed.pnl_group,
       true
from target_org
cross join category_seed
where category_seed.name <> '__empty__'
on conflict (organization_id, name)
do update set pnl_group = excluded.pnl_group,
              active = true;

with target_org as (
  select id from organizations order by created_at limit 1
),
target_branch as (
  select b.id
  from branches b
  join target_org on target_org.id = b.organization_id
  order by b.created_at
  limit 1
),
target_user as (
  select u.id
  from users u
  join target_org on target_org.id = u.organization_id
  where u.active = true
  order by case when u.role = 'owner' then 0 else 1 end, u.created_at
  limit 1
),
expense_seed (id, expense_date, accounting_month, category_name, supplier, description, amount, payment_method, payment_type, status, deferred, paid_date, due_date, cash_account, source, external_id, created_at) as (
  values
    ('fdd99ae9-c6a3-4d3c-9305-90eefb9fbdc7', '2026-07-01', '2026-07', 'Pago de servicios públicos', null, 'Edenor Julio ( Medición 3914 )', 665500.00, 'Otro', 'other', 'pending', true, null, null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:194:2026-07-01:pago-de-servicios-publicos:665500.00:edenor-julio-(-medicion-3914-)', '2026-07-14T05:21:24.840Z'),
    ('9d329213-5dca-4101-a307-cf0ce419d1a6', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Pasteleria - Dulce Hora - Sábado 11/7', 475718.84, 'Otro', 'other', 'pending', true, null, null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:197:2026-07-01:pago-proveedor-dulce-hora:475718.84:pasteleria---dulce-hora---sabado-11/7', '2026-07-14T05:21:24.840Z'),
    ('ac7b9976-8945-4bfa-8357-ad9414770571', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Panadería - Dulce Hora - Sábado 11/7', 1277548.87, 'Otro', 'other', 'pending', true, null, null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:196:2026-07-01:pago-proveedor-dulce-hora:1277548.87:panaderia---dulce-hora---sabado-11/7', '2026-07-14T05:21:24.840Z'),
    ('62e28878-f2b7-4984-a6b8-c56935258ac0', '2026-07-01', '2026-07', 'Pago proveedor Externo', null, 'Sol de Galicia ( Churros )', 136297.30, 'Otro', 'other', 'pending', true, null, null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:183:2026-07-01:pago-proveedor-externo:136297.30:sol-de-galicia-(-churros-)', '2026-07-14T05:21:24.840Z'),
    ('f3b6b5b6-9c87-4bcb-86d0-94f038a2a662', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Distribuidora - Dulce Hora - Sábado 11/7', 140500.01, 'Otro', 'other', 'pending', true, null, null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:195:2026-07-01:pago-proveedor-dulce-hora:140500.01:distribuidora---dulce-hora---sabado-11/7', '2026-07-14T05:21:24.840Z'),
    ('3e7fc592-1d89-4a1b-9fe4-f95583992b6c', '2028-06-01', '2028-06', 'Pago proveedor Externo', null, 'Pepsi', 142000.00, 'Otro', 'other', 'paid', false, '2028-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:150:2028-06-01:pago-proveedor-externo:142000.00:pepsi', '2026-07-14T05:21:24.840Z'),
    ('60449b61-d47c-4aeb-898a-05a4f77cbc9f', '2026-07-11', '2026-07', 'Pago Imp Empleados', null, 'VEP Cargas Sociales (Mayo)', 597820.00, 'Otro', 'other', 'paid', false, '2026-07-11', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:112:2026-07-11:pago-imp-empleados:597820.00:vep-cargas-sociales-(mayo)', '2026-07-14T05:21:24.840Z'),
    ('80e44ef9-ebf4-477b-8034-34eb2a0d0874', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Pasteleria - Dulce Hora - Martes 7/7', 636498.95, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:186:2026-07-01:pago-proveedor-dulce-hora:636498.95:pasteleria---dulce-hora---martes-7/7', '2026-07-14T05:21:24.840Z'),
    ('454170d7-a298-44d1-93f1-855c61f821c8', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Panadería - Dulce Hora - Martes 7/7', 1278353.82, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:185:2026-07-01:pago-proveedor-dulce-hora:1278353.82:panaderia---dulce-hora---martes-7/7', '2026-07-14T05:21:24.840Z'),
    ('5a2621e5-fadd-4341-9932-7b475c970c32', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Distribuidora - Dulce Hora - Martes 7/7', 104000.01, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:184:2026-07-01:pago-proveedor-dulce-hora:104000.01:distribuidora---dulce-hora---martes-7/7', '2026-07-14T05:21:24.840Z'),
    ('8df40d19-5e82-43a8-b936-67874e6b5a81', '2026-07-01', '2026-07', 'Pago mantenimiento', null, 'Arreglo Cafetera', 286000.00, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:182:2026-07-01:pago-mantenimiento:286000.00:arreglo-cafetera', '2026-07-14T05:21:24.840Z'),
    ('3dd8c0a5-6418-4624-ae23-d7dce45709d3', '2026-07-01', '2026-07', 'Pago Sueldos', null, 'Semana Romi', 330000.00, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:181:2026-07-01:pago-sueldos:330000.00:semana-romi', '2026-07-14T05:21:24.840Z'),
    ('a6476117-c1a8-4d49-951b-311e29c5f350', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Pasteleria - Dulce Hora - Sábado 4/7', 217437.94, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:180:2026-07-01:pago-proveedor-dulce-hora:217437.94:pasteleria---dulce-hora---sabado-4/7', '2026-07-14T05:21:24.840Z'),
    ('c2dedc08-f8df-424d-93a7-686083a29848', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Panadería - Dulce Hora - Sábado 4/7', 1331144.81, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:179:2026-07-01:pago-proveedor-dulce-hora:1331144.81:panaderia---dulce-hora---sabado-4/7', '2026-07-14T05:21:24.840Z'),
    ('54d704c3-1615-4a00-8e3c-444c35e4c32d', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Distribuidora - Dulce Hora - Sábado 4/7', 109000.03, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:178:2026-07-01:pago-proveedor-dulce-hora:109000.03:distribuidora---dulce-hora---sabado-4/7', '2026-07-14T05:21:24.840Z'),
    ('e0cdf17e-7632-40e5-97e5-ec355975573a', '2026-07-01', '2026-07', 'Pago proveedor Externo', null, 'Sol de Galicia (Churros + Dona)', 138478.06, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:177:2026-07-01:pago-proveedor-externo:138478.06:sol-de-galicia-(churros-+-dona)', '2026-07-14T05:21:24.840Z'),
    ('46ed721f-657d-47c9-b59f-fc6e9f85ac7c', '2026-07-01', '2026-07', 'Pago proveedor Externo', null, 'FG Cocina (Empanadas )', 28800.00, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:176:2026-07-01:pago-proveedor-externo:28800.00:fg-cocina-(empanadas-)', '2026-07-14T05:21:24.840Z'),
    ('84d5aea1-1c23-45c3-932a-470d89927651', '2026-07-01', '2026-07', 'Pago Imp Empleados', null, 'Telegrama', 24000.00, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:175:2026-07-01:pago-imp-empleados:24000.00:telegrama', '2026-07-14T05:21:24.840Z'),
    ('01a061c0-4c2f-471a-bbdb-f801815f229d', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Pasteleria - Dulce Hora - Jueves 2/7', 395479.89, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:174:2026-07-01:pago-proveedor-dulce-hora:395479.89:pasteleria---dulce-hora---jueves-2/7', '2026-07-14T05:21:24.840Z'),
    ('2969e6e4-7e13-487c-9b9a-b556aece8b9c', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Panadería - Dulce Hora - Jueves 2/7', 1151302.84, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:173:2026-07-01:pago-proveedor-dulce-hora:1151302.84:panaderia---dulce-hora---jueves-2/7', '2026-07-14T05:21:24.840Z'),
    ('9295829d-be0d-4b1d-a38c-57d826454cd7', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Distribuidora - Dulce Hora - Jueves/2', 141400.00, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:172:2026-07-01:pago-proveedor-dulce-hora:141400.00:distribuidora---dulce-hora---jueves/2', '2026-07-14T05:21:24.840Z'),
    ('b3332da6-c589-4094-8192-2c9b1f6db994', '2026-07-01', '2026-07', 'Pago proveedor Externo', null, 'Papelera + Almacen + Puente', 229800.00, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:171:2026-07-01:pago-proveedor-externo:229800.00:papelera-+-almacen-+-puente', '2026-07-14T05:21:24.840Z'),
    ('6bff34f8-9a8b-4eca-b7c9-83e8a14f19f7', '2026-07-01', '2026-07', 'Pago de servicios públicos', null, 'Personal Internet', 25905.00, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:170:2026-07-01:pago-de-servicios-publicos:25905.00:personal-internet', '2026-07-14T05:21:24.840Z'),
    ('78349ba9-2557-4070-a156-d10f8f5e10f4', '2026-07-01', '2026-07', 'Pago de servicios públicos', null, 'Seguro BBVA', 31922.00, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:169:2026-07-01:pago-de-servicios-publicos:31922.00:seguro-bbva', '2026-07-14T05:21:24.840Z'),
    ('67f7310d-3d79-4aab-afdd-c82d6cba8d9f', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Pasteleria - Dulce Hora - Martes 30/6', 296705.97, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:168:2026-07-01:pago-proveedor-dulce-hora:296705.97:pasteleria---dulce-hora---martes-30/6', '2026-07-14T05:21:24.840Z'),
    ('5519d415-06dc-4e9c-afee-4b8cf1a43182', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Panadería - Dulce Hora - Martes 30/6', 804443.96, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:167:2026-07-01:pago-proveedor-dulce-hora:804443.96:panaderia---dulce-hora---martes-30/6', '2026-07-14T05:21:24.840Z'),
    ('f3ec99b8-c783-4a49-952c-c3ffd965f829', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Distribuidora - Dulce Hora - Martes 30/6', 88091.00, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:166:2026-07-01:pago-proveedor-dulce-hora:88091.00:distribuidora---dulce-hora---martes-30/6', '2026-07-14T05:21:24.840Z'),
    ('64a4c6a2-e199-4d15-913f-711f8388b95b', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Panadería - Dulce Hora - Sabado 27/6', 853042.95, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:164:2026-07-01:pago-proveedor-dulce-hora:853042.95:panaderia---dulce-hora---sabado-27/6', '2026-07-14T05:21:24.840Z'),
    ('943c1182-35c7-4a0c-8b80-ed7786149158', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Distribuidora - Dulce Hora - Sabado 27/6', 48000.00, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:163:2026-07-01:pago-proveedor-dulce-hora:48000.00:distribuidora---dulce-hora---sabado-27/6', '2026-07-14T05:21:24.840Z'),
    ('e659d539-0846-4e20-b971-370dae05696f', '2026-07-01', '2026-07', 'Pago alquiler', null, 'Expensas', 37944.00, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:162:2026-07-01:pago-alquiler:37944.00:expensas', '2026-07-14T05:21:24.840Z'),
    ('08911746-f46a-4d86-a5b1-5df334bbd3d7', '2026-07-01', '2026-07', 'Pago alquiler', null, 'Alquiler Julio', 1070000.00, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:161:2026-07-01:pago-alquiler:1070000.00:alquiler-julio', '2026-07-14T05:21:24.840Z'),
    ('ddcd67d8-4c9c-4cd1-8c5e-be069c7fda76', '2026-07-01', '2026-07', 'Pago Imp Empleados', null, 'Monotributo Diego (Julio)', 55300.00, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:160:2026-07-01:pago-imp-empleados:55300.00:monotributo-diego-(julio)', '2026-07-14T05:21:24.840Z'),
    ('126b906b-50b8-488e-aaab-dcc9b47b3d7b', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Pasteleria - Dulce Hora - Sabado 27/6', 148912.90, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:165:2026-07-01:pago-proveedor-dulce-hora:148912.90:pasteleria---dulce-hora---sabado-27/6', '2026-07-14T05:21:24.840Z'),
    ('1f392d49-57ec-4349-9d28-0224fc083376', '2026-07-01', '2026-07', 'Pago proveedor Externo', null, 'TC MercadoPago', 124000.00, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:193:2026-07-01:pago-proveedor-externo:124000.00:tc-mercadopago', '2026-07-14T05:21:24.840Z'),
    ('2d9b89a6-7163-42fd-87a8-ca4a4c653e03', '2026-07-01', '2026-07', 'Pago Sueldos', null, 'Semana Romi', 240000.00, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:192:2026-07-01:pago-sueldos:240000.00:semana-romi', '2026-07-14T05:21:24.840Z'),
    ('a3d356d7-2af2-4b95-8648-79409fbd1548', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Pasteleria - Dulce Hora - Jueves 9/7', 352881.99, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:190:2026-07-01:pago-proveedor-dulce-hora:352881.99:pasteleria---dulce-hora---jueves-9/7', '2026-07-14T05:21:24.840Z'),
    ('3caad01f-93bf-4a63-ae45-2faa0d6c9e49', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Panadería - Dulce Hora - Jueves 9/7', 1065026.89, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:189:2026-07-01:pago-proveedor-dulce-hora:1065026.89:panaderia---dulce-hora---jueves-9/7', '2026-07-14T05:21:24.840Z'),
    ('efd69685-5f13-4090-b31d-7b7c78e6d107', '2026-07-01', '2026-07', 'Pago proveedor Dulce Hora', null, 'Distribuidora - Dulce Hora - Jueves 9/7', 36450.00, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:188:2026-07-01:pago-proveedor-dulce-hora:36450.00:distribuidora---dulce-hora---jueves-9/7', '2026-07-14T05:21:24.840Z'),
    ('07f54233-d961-4b4e-b2ed-df6bf442219c', '2026-07-01', '2026-07', 'Pago Sueldos', null, 'Sueldo Mica semana (hasta 8/7)', 252000.00, 'Otro', 'other', 'paid', false, '2026-07-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:187:2026-07-01:pago-sueldos:252000.00:sueldo-mica-semana-(hasta-8/7)', '2026-07-14T05:21:24.840Z'),
    ('05c47d0d-15c2-44fc-848c-119daf16d41d', '2026-06-23', '2026-06', 'Pago de servicios públicos', null, 'Edenor Mes de Junio (2269 medicion (1419))', 555570.00, 'Otro', 'other', 'paid', false, '2026-06-23', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:116:2026-06-23:pago-de-servicios-publicos:555570.00:edenor-mes-de-junio-(2269-medicion-(1419))', '2026-07-14T05:21:24.840Z'),
    ('5b724a73-61f9-4e91-a249-b727a7e61e7d', '2026-06-22', '2026-06', 'Pago Imp Empleados', null, 'Monotributo Diego (Junio)', 55250.00, 'Otro', 'other', 'paid', false, '2026-06-22', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:115:2026-06-22:pago-imp-empleados:55250.00:monotributo-diego-(junio)', '2026-07-14T05:21:24.840Z'),
    ('f2fac914-a70f-404a-af91-3d10ced09dcf', '2026-06-15', '2026-06', 'Pago Imp Empleados', null, 'Boletas Sindicales', 82212.00, 'Otro', 'other', 'paid', false, '2026-06-15', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:120:2026-06-15:pago-imp-empleados:82212.00:boletas-sindicales', '2026-07-14T05:21:24.840Z'),
    ('bcc66265-1b9f-463c-a447-fbbf47a19f81', '2026-06-06', '2026-06', 'Pago Imp Empleados', null, 'Contador', 75000.00, 'Otro', 'other', 'paid', false, '2026-06-06', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:128:2026-06-06:pago-imp-empleados:75000.00:contador', '2026-07-14T05:21:24.840Z'),
    ('2e722b38-559c-40a9-883f-7202f4341f38', '2026-06-05', '2026-06', 'Pago alquiler', null, 'Alquiler', 1000000.00, 'Otro', 'other', 'paid', false, '2026-06-05', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:98:2026-06-05:pago-alquiler:1000000.00:alquiler', '2026-07-14T05:21:24.840Z'),
    ('580c77eb-c868-45d3-9dbf-9db6b21d7099', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Panaderia - Dulce Hora - Sábado 13/6', 1186209.85, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:126:2026-06-01:pago-proveedor-dulce-hora:1186209.85:panaderia---dulce-hora---sabado-13/6', '2026-07-14T05:21:24.840Z'),
    ('4685fe14-fa6a-4c85-bfad-58fec5389733', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Distribuidora - Sábado 30/5', 53248.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:84:2026-06-01:pago-proveedor-dulce-hora:53248.00:dulce-hora---distribuidora---sabado-30/5', '2026-07-14T05:21:24.840Z'),
    ('7ce9f8d7-044d-4495-bff6-a25bac0435c5', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Pastelería - Sábado 30/5', 159281.06, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:85:2026-06-01:pago-proveedor-dulce-hora:159281.06:dulce-hora---pasteleria---sabado-30/5', '2026-07-14T05:21:24.840Z'),
    ('2bc49a47-cde0-483e-9486-60e83c76bb48', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panadería - Sábado 30/11', 872955.90, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:86:2026-06-01:pago-proveedor-dulce-hora:872955.90:dulce-hora---panaderia---sabado-30/11', '2026-07-14T05:21:24.840Z'),
    ('43034b92-c5dc-49f6-9fd1-73dfc413bad1', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panadería - Lunes 1/6', 134817.98, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:87:2026-06-01:pago-proveedor-dulce-hora:134817.98:dulce-hora---panaderia---lunes-1/6', '2026-07-14T05:21:24.840Z'),
    ('69d1d3b1-9769-4199-b0b3-193e8c9b6295', '2026-06-01', '2026-06', 'Pago mantenimiento', null, 'Ferreteria', 19000.00, 'B. Virtual', 'virtual', 'paid', false, '2026-06-01', null, 'mercado_pago', 'google-sheet-expenses', 'expense-sheet:89:2026-06-01:pago-mantenimiento:19000.00:ferreteria', '2026-07-14T05:21:24.840Z'),
    ('f3e2f2da-237f-4b99-8621-87c75123be18', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Pasteleria - Dulce Hora - Martes 2/6', 381655.90, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:90:2026-06-01:pago-proveedor-dulce-hora:381655.90:pasteleria---dulce-hora---martes-2/6', '2026-07-14T05:21:24.840Z'),
    ('2b38055f-095e-49b4-b1d9-9c077c44bdcc', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Distribuidora - Dulce Hora - Martes 2/6', 96500.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:91:2026-06-01:pago-proveedor-dulce-hora:96500.00:distribuidora---dulce-hora---martes-2/6', '2026-07-14T05:21:24.840Z'),
    ('82a90f56-b2f8-4d81-be60-930e2c217fb4', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Panadería - Dulce Hora - Martes 2/6', 834336.88, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:92:2026-06-01:pago-proveedor-dulce-hora:834336.88:panaderia---dulce-hora---martes-2/6', '2026-07-14T05:21:24.840Z'),
    ('991077aa-0212-41e1-862c-faf998f049f8', '2026-06-01', '2026-06', 'Pago alquiler', null, 'Expensas Local', 43836.00, 'B. Virtual', 'virtual', 'paid', false, '2026-06-01', null, 'mercado_pago', 'google-sheet-expenses', 'expense-sheet:93:2026-06-01:pago-alquiler:43836.00:expensas-local', '2026-07-14T05:21:24.840Z'),
    ('36ef77dd-b6a1-4ac9-8488-7dc63402621c', '2026-06-01', '2026-06', 'Pago mantenimiento', null, 'Seguro BBVA', 31200.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:94:2026-06-01:pago-mantenimiento:31200.00:seguro-bbva', '2026-07-14T05:21:24.840Z'),
    ('a86943c4-09e4-48d4-a620-bef9ddb85f81', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Distribuidora - Dulce Hora - Jueves 4/6', 90008.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:95:2026-06-01:pago-proveedor-dulce-hora:90008.00:distribuidora---dulce-hora---jueves-4/6', '2026-07-14T05:21:24.840Z'),
    ('009a54a4-47d0-4a45-a5d2-a25dee4bb3ed', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Pasteleria - Dulce Hora - Jueves 4/6', 593261.99, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:96:2026-06-01:pago-proveedor-dulce-hora:593261.99:pasteleria---dulce-hora---jueves-4/6', '2026-07-14T05:21:24.840Z'),
    ('a75aec86-bbb7-46c1-854d-065d90d750a1', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Panadería - Dulce Hora - Jueves 4/6', 1102092.83, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:97:2026-06-01:pago-proveedor-dulce-hora:1102092.83:panaderia---dulce-hora---jueves-4/6', '2026-07-14T05:21:24.840Z'),
    ('c283768a-e34d-4203-89a5-cd47246f8976', '2026-06-01', '2026-06', 'Pago proveedor Externo', null, 'Almacen', 128800.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:102:2026-06-01:pago-proveedor-externo:128800.00:almacen', '2026-07-14T05:21:24.840Z'),
    ('c62a1974-8757-4c01-b251-752662c8c665', '2026-06-01', '2026-06', 'Pago Sueldos', null, 'Semana Romi 3/6 a 7/6', 300000.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:104:2026-06-01:pago-sueldos:300000.00:semana-romi-3/6-a-7/6', '2026-07-14T05:21:24.840Z'),
    ('64910079-b987-41d8-9286-40b69fe28edf', '2026-06-01', '2026-06', 'Pago proveedor Externo', null, 'Bolsas Papelera (Edu)', 118000.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:105:2026-06-01:pago-proveedor-externo:118000.00:bolsas-papelera-(edu)', '2026-07-14T05:21:24.840Z'),
    ('ed171c65-7694-425c-a033-323dd0d5ed1f', '2026-06-01', '2026-06', 'Pago de servicios públicos', null, 'Internet Personal', 25300.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:106:2026-06-01:pago-de-servicios-publicos:25300.00:internet-personal', '2026-07-14T05:21:24.840Z'),
    ('666b3941-b3e1-4b1b-a41f-280efe2a54cd', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Pasteleria - Dulce Hora - Sabado 6/6', 627372.94, 'Efectivo', 'cash', 'paid', false, '2026-06-01', null, 'cash', 'google-sheet-expenses', 'expense-sheet:107:2026-06-01:pago-proveedor-dulce-hora:627372.94:pasteleria---dulce-hora---sabado-6/6', '2026-07-14T05:21:24.840Z'),
    ('fcc25b3e-13c4-468f-a748-2f87f5768880', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Panaderia - Dulce Hora - Sabado 6/6', 1063882.85, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:108:2026-06-01:pago-proveedor-dulce-hora:1063882.85:panaderia---dulce-hora---sabado-6/6', '2026-07-14T05:21:24.840Z'),
    ('c6a563e1-5312-4e9e-87a3-7e9eb67f7098', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Distribuidora - Dulce Hora - Sabado 6/6', 100529.03, 'Efectivo', 'cash', 'paid', false, '2026-06-01', null, 'cash', 'google-sheet-expenses', 'expense-sheet:109:2026-06-01:pago-proveedor-dulce-hora:100529.03:distribuidora---dulce-hora---sabado-6/6', '2026-07-14T05:21:24.840Z'),
    ('aded501f-9cca-4be6-80d8-e90951f784bc', '2026-06-01', '2026-06', 'Pago proveedor Externo', null, 'Makro', 38600.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:110:2026-06-01:pago-proveedor-externo:38600.00:makro', '2026-07-14T05:21:24.840Z'),
    ('e250a39a-616c-43f1-ba29-772fae4c140e', '2026-06-01', '2026-06', 'Pago mantenimiento', null, 'Sergio (cambio termica)', 80000.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:111:2026-06-01:pago-mantenimiento:80000.00:sergio-(cambio-termica)', '2026-07-14T05:21:24.840Z'),
    ('b9d97cec-e4d3-4cf2-adf0-474737ad95ed', '2026-06-01', '2026-06', 'Pago proveedor Externo', null, 'TC Mercado', 394000.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:113:2026-06-01:pago-proveedor-externo:394000.00:tc-mercado', '2026-07-14T05:21:24.840Z'),
    ('3a6533d8-6c80-4e02-b994-382a254f28e8', '2026-06-01', '2026-06', 'Pago proveedor Externo', null, 'Puente + Papelera + tupper + Imprenta', 226000.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:114:2026-06-01:pago-proveedor-externo:226000.00:puente-+-papelera-+-tupper-+-imprenta', '2026-07-14T05:21:24.840Z'),
    ('23173608-a3e6-4505-8b17-0a1ad220c25d', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Pasteleria - Dulce Hora - Martes 9/6', 131523.95, 'Efectivo', 'cash', 'paid', false, '2026-06-01', null, 'cash', 'google-sheet-expenses', 'expense-sheet:117:2026-06-01:pago-proveedor-dulce-hora:131523.95:pasteleria---dulce-hora---martes-9/6', '2026-07-14T05:21:24.840Z'),
    ('fb4352ee-7330-4f21-82aa-ef2f7c7bf9ff', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Panaderia - Dulce Hora - Martes 9/6', 864323.90, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:118:2026-06-01:pago-proveedor-dulce-hora:864323.90:panaderia---dulce-hora---martes-9/6', '2026-07-14T05:21:24.840Z'),
    ('eb6d05f4-1d8d-439b-b121-c77c177acde9', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Distribuidora - Dulce Hora - Martes 9/6', 157106.02, 'Efectivo', 'cash', 'paid', false, '2026-06-01', null, 'cash', 'google-sheet-expenses', 'expense-sheet:119:2026-06-01:pago-proveedor-dulce-hora:157106.02:distribuidora---dulce-hora---martes-9/6', '2026-07-14T05:21:24.840Z'),
    ('61522d17-5b54-4e84-b212-73efdf6baacd', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Pasteleria - Dulce Hora - Jueves 11/6', 163699.02, 'Efectivo', 'cash', 'paid', false, '2026-06-01', null, 'cash', 'google-sheet-expenses', 'expense-sheet:121:2026-06-01:pago-proveedor-dulce-hora:163699.02:pasteleria---dulce-hora---jueves-11/6', '2026-07-14T05:21:24.840Z'),
    ('330a473f-94b6-4a59-b5ff-87e0b22d1151', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Panaderia - Dulce Hora - Jueves 11/6', 867569.91, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:122:2026-06-01:pago-proveedor-dulce-hora:867569.91:panaderia---dulce-hora---jueves-11/6', '2026-07-14T05:21:24.840Z'),
    ('3df767e9-47c8-40f4-a8b2-0cbf36f2a54d', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Distribuidora - Dulce Hora - Jueves 11/6', 56000.01, 'Efectivo', 'cash', 'paid', false, '2026-06-01', null, 'cash', 'google-sheet-expenses', 'expense-sheet:123:2026-06-01:pago-proveedor-dulce-hora:56000.01:distribuidora---dulce-hora---jueves-11/6', '2026-07-14T05:21:24.840Z'),
    ('5c7e1ba9-422f-4a43-94d5-49b98a3fc06c', '2026-06-01', '2026-06', 'Pago Sueldos', null, 'Sueldo Romi', 240000.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:124:2026-06-01:pago-sueldos:240000.00:sueldo-romi', '2026-07-14T05:21:24.840Z'),
    ('eb07ebee-7d49-48b1-90de-92fe7d53048f', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Pasteleria - Dulce Hora - Sábado 13/6', 358869.87, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:125:2026-06-01:pago-proveedor-dulce-hora:358869.87:pasteleria---dulce-hora---sabado-13/6', '2026-07-14T05:21:24.840Z'),
    ('f4b5251f-b797-420f-9d0a-4ea8019b7f55', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Distribuidora - Dulce Hora - Sábado 13/6', 139700.04, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:127:2026-06-01:pago-proveedor-dulce-hora:139700.04:distribuidora---dulce-hora---sabado-13/6', '2026-07-14T05:21:24.840Z'),
    ('8340e2c6-a7de-4288-ad9e-a9fd5af456a9', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Panaderia - Dulce Hora - Martes 16/6', 926034.92, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:129:2026-06-01:pago-proveedor-dulce-hora:926034.92:panaderia---dulce-hora---martes-16/6', '2026-07-14T05:21:24.840Z'),
    ('31b70c3f-f156-4886-909d-3d161b5c4340', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Pasteleria - Dulce Hora - Martes 16/6', 505132.85, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:130:2026-06-01:pago-proveedor-dulce-hora:505132.85:pasteleria---dulce-hora---martes-16/6', '2026-07-14T05:21:24.840Z'),
    ('3a34317f-c702-47e8-94f6-9081a91123a1', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Distribuidora - Dulce Hora - Martes 16/6', 56000.01, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:131:2026-06-01:pago-proveedor-dulce-hora:56000.01:distribuidora---dulce-hora---martes-16/6', '2026-07-14T05:21:24.840Z'),
    ('8e6e3bda-f2f8-4e4f-82ba-e2261b670627', '2026-06-01', '2026-06', 'Pago proveedor Externo', null, 'Chipsy (Producto SIN TACC)', 91260.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:132:2026-06-01:pago-proveedor-externo:91260.00:chipsy-(producto-sin-tacc)', '2026-07-14T05:21:24.840Z'),
    ('85cac2ae-3c51-4543-89a4-344c5f901a98', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Distribuidora - Dulce Hora - Jueves 18/6', 43920.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:133:2026-06-01:pago-proveedor-dulce-hora:43920.00:distribuidora---dulce-hora---jueves-18/6', '2026-07-14T05:21:24.840Z'),
    ('e341dcef-a133-4656-bdae-e02d9fd461fb', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Pasteleria - Dulce Hora - Jueves 18/6', 629808.84, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:134:2026-06-01:pago-proveedor-dulce-hora:629808.84:pasteleria---dulce-hora---jueves-18/6', '2026-07-14T05:21:24.840Z'),
    ('881c6bbd-65c7-48b0-b527-61ef97073f06', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Panadería - Dulce Hora - Jueves 18/6', 1117299.84, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:135:2026-06-01:pago-proveedor-dulce-hora:1117299.84:panaderia---dulce-hora---jueves-18/6', '2026-07-14T05:21:24.840Z'),
    ('455436fb-9a2f-4ce4-a8fe-dae2a5828fe2', '2026-06-01', '2026-06', 'Pago Sueldos', null, 'Día Micaela Viernes 19', 42000.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:136:2026-06-01:pago-sueldos:42000.00:dia-micaela-viernes-19', '2026-07-14T05:21:24.840Z'),
    ('43f3d4a1-59e7-44c5-ba29-7628390de837', '2026-06-01', '2026-06', 'Pago Sueldos', null, 'Romi (Feriado y Sábado Doble + 2 horas)', 495000.00, 'B. Virtual', 'virtual', 'paid', false, '2026-06-01', null, 'mercado_pago', 'google-sheet-expenses', 'expense-sheet:137:2026-06-01:pago-sueldos:495000.00:romi-(feriado-y-sabado-doble-+-2-horas)', '2026-07-14T05:21:24.840Z'),
    ('fdef24ed-d896-4b2b-90b4-c5fc588a109b', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Distribuidora - Dulce Hora - Sábado 20/6', 101248.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:138:2026-06-01:pago-proveedor-dulce-hora:101248.00:distribuidora---dulce-hora---sabado-20/6', '2026-07-14T05:21:24.840Z'),
    ('5001b67f-4aa2-4973-af28-83e9fd8fead7', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Panadería - Dulce Hora - Sábado 20/6', 1170596.81, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:139:2026-06-01:pago-proveedor-dulce-hora:1170596.81:panaderia---dulce-hora---sabado-20/6', '2026-07-14T05:21:24.840Z'),
    ('e3f4c7ad-c2e0-42dc-8152-72bd0576063b', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Pasteleria - Dulce Hora - Sábado 20/6', 412049.95, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:140:2026-06-01:pago-proveedor-dulce-hora:412049.95:pasteleria---dulce-hora---sabado-20/6', '2026-07-14T05:21:24.840Z'),
    ('6b784701-5255-4632-8895-80175a6aab39', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Panadería - Dulce Hora - Lunes 22/6 (refuerzo)', 25373.98, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:141:2026-06-01:pago-proveedor-dulce-hora:25373.98:panaderia---dulce-hora---lunes-22/6-(refuerz', '2026-07-14T05:21:24.840Z'),
    ('9e1ff7f1-0eef-4766-92c0-46aa08f4e0cf', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Distribuidora - Dulce Hora - Martes 23/6', 94350.02, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:142:2026-06-01:pago-proveedor-dulce-hora:94350.02:distribuidora---dulce-hora---martes-23/6', '2026-07-14T05:21:24.840Z'),
    ('dce7ef9d-89cd-42b3-b127-fafdb9d96d4b', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Panadería - Dulce Hora - Martes 23/6', 845605.84, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:143:2026-06-01:pago-proveedor-dulce-hora:845605.84:panaderia---dulce-hora---martes-23/6', '2026-07-14T05:21:24.840Z'),
    ('ed178ce4-6b40-4e56-85c2-79b7dcd44868', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Pasteleria - Dulce Hora - Martes 23/6', 507174.84, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:144:2026-06-01:pago-proveedor-dulce-hora:507174.84:pasteleria---dulce-hora---martes-23/6', '2026-07-14T05:21:24.840Z'),
    ('fafebaba-8f15-4a17-b97a-8b67a3068f54', '2026-06-01', '2026-06', 'Pago publicidad', null, 'Publicidad - Somos Urquiza Instagram', 191000.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:145:2026-06-01:pago-publicidad:191000.00:publicidad---somos-urquiza-instagram', '2026-07-14T05:21:24.840Z'),
    ('e67060c3-033f-435e-af01-1d13a70fbdb8', '2026-06-01', '2026-06', 'Pago proveedor Externo', null, 'Papelera', 110000.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:146:2026-06-01:pago-proveedor-externo:110000.00:papelera', '2026-07-14T05:21:24.840Z'),
    ('d938458d-ae8d-4087-8a3c-816470a3e01d', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Distribuidora - Dulce Hora - Jueves 25/6', 181250.03, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:147:2026-06-01:pago-proveedor-dulce-hora:181250.03:distribuidora---dulce-hora---jueves-25/6', '2026-07-14T05:21:24.840Z'),
    ('0a6588dc-e7bb-4dac-b9d2-04c68ceb1d6d', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Panadería - Dulce Hora - Jueves 25/6', 1219208.81, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:148:2026-06-01:pago-proveedor-dulce-hora:1219208.81:panaderia---dulce-hora---jueves-25/6', '2026-07-14T05:21:24.840Z'),
    ('fd1b5e29-36fd-4da9-bf2e-2cc5146b4ec3', '2026-06-01', '2026-06', 'Pago proveedor Dulce Hora', null, 'Pasteleria - Dulce Hora - Jueves 25/6', 564465.95, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:149:2026-06-01:pago-proveedor-dulce-hora:564465.95:pasteleria---dulce-hora---jueves-25/6', '2026-07-14T05:21:24.840Z'),
    ('a8a942c7-add1-4451-b62e-c87c61fbaf15', '2026-06-01', '2026-06', 'Pago proveedor Externo', null, 'Café Grano', 138100.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:151:2026-06-01:pago-proveedor-externo:138100.00:cafe-grano', '2026-07-14T05:21:24.840Z'),
    ('d2339d9b-2bc4-43b3-9dd6-4d8a0c4fb9ef', '2026-06-01', '2026-06', 'Pago Sueldos', null, 'Aguinaldo Viky', 140000.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:152:2026-06-01:pago-sueldos:140000.00:aguinaldo-viky', '2026-07-14T05:21:24.840Z'),
    ('b494d104-33be-476d-a48f-65a31f698acb', '2026-06-01', '2026-06', 'Pago Sueldos', null, 'Aguinaldo Belen', 160000.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:153:2026-06-01:pago-sueldos:160000.00:aguinaldo-belen', '2026-07-14T05:21:24.840Z'),
    ('6af71448-0221-4af0-bf2d-73d0df6e3d32', '2026-06-01', '2026-06', 'Pago Sueldos', null, 'Semana Romi', 360000.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:154:2026-06-01:pago-sueldos:360000.00:semana-romi', '2026-07-14T05:21:24.840Z'),
    ('05186611-35fe-4dd1-9529-0f4aaa77f146', '2026-06-01', '2026-06', 'Pago Sueldos', null, 'Semana Mica', 252000.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:155:2026-06-01:pago-sueldos:252000.00:semana-mica', '2026-07-14T05:21:24.840Z'),
    ('0a8c78f2-7dd5-4aee-b846-51294f640275', '2026-06-01', '2026-06', 'Pago Sueldos', null, 'Sueldo Belen', 934600.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:156:2026-06-01:pago-sueldos:934600.00:sueldo-belen', '2026-07-14T05:21:24.840Z'),
    ('24a943af-fbea-4b50-afee-565f8d7b77b0', '2026-06-01', '2026-06', 'Pago Sueldos', null, 'Sueldo Vicky', 934600.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:157:2026-06-01:pago-sueldos:934600.00:sueldo-vicky', '2026-07-14T05:21:24.840Z'),
    ('b2f001c2-abae-4cb7-b2c1-a8a788662d4a', '2026-06-01', '2026-06', 'Pago Sueldos', null, 'Sueldo Diego', 1600000.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:158:2026-06-01:pago-sueldos:1600000.00:sueldo-diego', '2026-07-14T05:21:24.840Z'),
    ('9e583382-92dc-47c1-99b1-9d6f51dbc9d2', '2026-06-01', '2026-06', 'Pago publicidad', null, 'Publicidad Google', 192861.00, 'Otro', 'other', 'paid', false, '2026-06-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:159:2026-06-01:pago-publicidad:192861.00:publicidad-google', '2026-07-14T05:21:24.840Z'),
    ('1eeb355d-bd90-46b0-bad3-e1c5ce5ce362', '2026-05-31', '2026-05', 'Pago Sueldos', null, 'Sueldo Diego', 1730000.00, 'B. Virtual', 'virtual', 'paid', false, '2026-05-31', null, 'mercado_pago', 'google-sheet-expenses', 'expense-sheet:81:2026-05-31:pago-sueldos:1730000.00:sueldo-diego', '2026-07-14T05:21:24.840Z'),
    ('ee0347bf-a610-4a5d-bc87-e385a81f28b4', '2026-05-30', '2026-05', 'Pago Imp Empleados', null, 'Contador', 60000.00, 'B. Virtual', 'virtual', 'paid', false, '2026-05-30', null, 'mercado_pago', 'google-sheet-expenses', 'expense-sheet:76:2026-05-30:pago-imp-empleados:60000.00:contador', '2026-07-14T05:21:24.840Z'),
    ('571af08d-2e65-42fc-811a-260304d6f371', '2026-05-30', '2026-05', 'Pago publicidad', null, 'Publicicad Google', 197200.00, 'B. Virtual', 'virtual', 'paid', false, '2026-05-30', null, 'mercado_pago', 'google-sheet-expenses', 'expense-sheet:77:2026-05-30:pago-publicidad:197200.00:publicicad-google', '2026-07-14T05:21:24.840Z'),
    ('2005d776-9cca-4e8b-b038-684acc87ab66', '2026-05-30', '2026-05', 'Pago Sueldos', null, 'Semana Romi - 29/30/31', 150000.00, 'Otro', 'other', 'paid', false, '2026-05-30', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:80:2026-05-30:pago-sueldos:150000.00:semana-romi---29/30/31', '2026-07-14T05:21:24.840Z'),
    ('8f68442e-bdb4-4b86-9eb4-9d55b51f4ee7', '2026-05-25', '2026-05', 'Pago de servicios públicos', null, 'Edenor Mayo', 313943.24, 'TC MP', 'credit_card', 'paid', true, '2026-05-25', null, 'mercado_pago', 'google-sheet-expenses', 'expense-sheet:68:2026-05-25:pago-de-servicios-publicos:313943.24:edenor-mayo', '2026-07-14T05:21:24.840Z'),
    ('d0d74959-5e87-45ed-9c43-4d4ccfeac98d', '2026-05-23', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Distribuidora - Sábado 23/5', 169506.03, 'Otro', 'other', 'paid', false, '2026-05-23', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:65:2026-05-23:pago-proveedor-dulce-hora:169506.03:dulce-hora---distribuidora---sabado-23/5', '2026-07-14T05:21:24.840Z'),
    ('84e348ca-50e7-4638-846f-47e977c49781', '2026-05-23', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panadería - Sábado 23/5', 1311449.74, 'Otro', 'other', 'paid', false, '2026-05-23', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:66:2026-05-23:pago-proveedor-dulce-hora:1311449.74:dulce-hora---panaderia---sabado-23/5', '2026-07-14T05:21:24.840Z'),
    ('c28aae98-3c72-4991-a7b2-ba7d1526bcaa', '2026-05-23', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Pastelería - Sábado 23/5', 365898.95, 'Otro', 'other', 'paid', false, '2026-05-23', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:67:2026-05-23:pago-proveedor-dulce-hora:365898.95:dulce-hora---pasteleria---sabado-23/5', '2026-07-14T05:21:24.840Z'),
    ('c1e5b98e-e9ab-4f7e-a2f5-68f9522948f3', '2026-05-21', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Pasteleria - Jueves 21/5', 367704.94, 'Otro', 'other', 'paid', false, '2026-05-21', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:61:2026-05-21:pago-proveedor-dulce-hora:367704.94:dulce-hora---pasteleria---jueves-21/5', '2026-07-14T05:21:24.840Z'),
    ('3bff4d7a-d8d7-42e6-a685-08eefea81ef1', '2026-05-21', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Distribuidora - Jueves 21/5', 101550.02, 'Otro', 'other', 'paid', false, '2026-05-21', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:62:2026-05-21:pago-proveedor-dulce-hora:101550.02:dulce-hora---distribuidora---jueves-21/5', '2026-07-14T05:21:24.840Z'),
    ('2cd19d7c-a376-4e91-bec9-f0371f33cb34', '2026-05-21', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panadería - Jueves 21/5', 1031949.83, 'Efectivo', 'cash', 'paid', false, '2026-05-21', null, 'cash', 'google-sheet-expenses', 'expense-sheet:60:2026-05-21:pago-proveedor-dulce-hora:1031949.83:dulce-hora---panaderia---jueves-21/5', '2026-07-14T05:21:24.840Z'),
    ('0924b03d-f41b-4a9e-bc52-9301face06c7', '2026-05-21', '2026-05', 'Pago proveedor Externo', null, 'Chpsi Foods', 394162.00, 'Otro', 'other', 'paid', false, '2026-05-21', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:59:2026-05-21:pago-proveedor-externo:394162.00:chpsi-foods', '2026-07-14T05:21:24.840Z'),
    ('b9d563d2-9454-42cd-90f0-68581fdffc33', '2026-05-19', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Distribuidora - Martes 19/5', 118008.01, 'Otro', 'other', 'paid', false, '2026-05-19', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:56:2026-05-19:pago-proveedor-dulce-hora:118008.01:dulce-hora---distribuidora---martes-19/5', '2026-07-14T05:21:24.840Z'),
    ('f7493b29-d00a-4b69-b8bc-d0590894b3b5', '2026-05-19', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panadería - Martes 19/5', 716504.87, 'Otro', 'other', 'paid', false, '2026-05-19', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:57:2026-05-19:pago-proveedor-dulce-hora:716504.87:dulce-hora---panaderia---martes-19/5', '2026-07-14T05:21:24.840Z'),
    ('05301d7a-2887-4b38-b3c1-8159002f4e94', '2026-05-19', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Pastelería - Martes 19/5', 356617.78, 'Otro', 'other', 'paid', false, '2026-05-19', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:58:2026-05-19:pago-proveedor-dulce-hora:356617.78:dulce-hora---pasteleria---martes-19/5', '2026-07-14T05:21:24.840Z'),
    ('d2724da0-1947-4741-85a0-b181b9083fc5', '2026-05-18', '2026-05', 'Pago Sueldos', null, 'Romina 15 al 18 Mayo', 150000.00, 'B. Virtual', 'virtual', 'paid', false, '2026-05-18', null, 'mercado_pago', 'google-sheet-expenses', 'expense-sheet:51:2026-05-18:pago-sueldos:150000.00:romina-15-al-18-mayo', '2026-07-14T05:21:24.840Z'),
    ('bc973b82-e815-4e34-b521-d3e05c95878d', '2026-05-14', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Pasteleria - Jueves 14/5', 557350.87, 'Otro', 'other', 'paid', false, '2026-05-14', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:49:2026-05-14:pago-proveedor-dulce-hora:557350.87:dulce-hora---pasteleria---jueves-14/5', '2026-07-14T05:21:24.840Z'),
    ('9c8e727e-95e1-48e3-bcdb-f128d9d81711', '2026-05-11', '2026-05', 'Pago proveedor Externo', null, 'ElPuente + Descartables', 86000.00, 'Otro', 'other', 'paid', false, '2026-05-11', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:39:2026-05-11:pago-proveedor-externo:86000.00:elpuente-+-descartables', '2026-07-14T05:21:24.840Z'),
    ('52ea92c8-ae0e-475f-b980-efd3c8bedadf', '2026-05-10', '2026-05', 'Pago Sueldos', null, 'Romina Domingo 10/5', 50000.00, 'Otro', 'other', 'paid', false, '2026-05-10', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:38:2026-05-10:pago-sueldos:50000.00:romina-domingo-10/5', '2026-07-14T05:21:24.840Z'),
    ('edca589a-b022-4e11-a324-92c16f1c32fa', '2026-05-05', '2026-05', 'Pago alquiler', null, 'Alquiler', 980000.00, 'Otro', 'other', 'paid', false, '2026-05-05', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:25:2026-05-05:pago-alquiler:980000.00:alquiler', '2026-07-14T05:21:24.840Z'),
    ('0d84d6bb-0fbc-4d58-81ed-8cf74de22cd3', '2026-05-05', '2026-05', 'Pago alquiler', null, 'Expensas', 58410.00, 'Otro', 'other', 'paid', false, '2026-05-05', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:26:2026-05-05:pago-alquiler:58410.00:expensas', '2026-07-14T05:21:24.840Z'),
    ('4ec184a3-8d57-4e03-8ccb-471f9b8aad66', '2026-05-05', '2026-05', 'Pago proveedor Externo', null, 'Puente + Descartables', 60000.00, 'Otro', 'other', 'paid', false, '2026-05-05', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:29:2026-05-05:pago-proveedor-externo:60000.00:puente-+-descartables', '2026-07-14T05:21:24.840Z'),
    ('339f44b9-ba86-4540-963c-95d8e293715c', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panadería - sabado 16/5', 727175.94, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:54:2026-05-01:pago-proveedor-dulce-hora:727175.94:dulce-hora---panaderia---sabado-16/5', '2026-07-14T05:21:24.840Z'),
    ('27123d06-895c-4e8b-ae96-afa4dd93bc09', '2026-05-01', '2026-05', 'Pago proveedor Externo', null, 'Papelera 20/5', 47500.00, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:55:2026-05-01:pago-proveedor-externo:47500.00:papelera-20/5', '2026-07-14T05:21:24.840Z'),
    ('a7962054-8108-4714-8a2f-30d134264b73', '2026-05-01', '2026-05', 'Pago publicidad', null, 'Imprenta (Vinilos exterior + tarjeta)', 23200.00, 'B. Virtual', 'virtual', 'paid', false, '2026-05-01', null, 'mercado_pago', 'google-sheet-expenses', 'expense-sheet:63:2026-05-01:pago-publicidad:23200.00:imprenta-(vinilos-exterior-+-tarjeta)', '2026-07-14T05:21:24.840Z'),
    ('8f854da2-68a9-419d-88d0-9f54a21ea1b9', '2026-05-01', '2026-05', 'Pago Sueldos', null, 'Romina 23 y 24 Mayo', 100000.00, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:64:2026-05-01:pago-sueldos:100000.00:romina-23-y-24-mayo', '2026-07-14T05:21:24.840Z'),
    ('d527f423-e9ce-4aac-8a92-f81065e41954', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Distribuidora - Martes 26/5', 67332.00, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:69:2026-05-01:pago-proveedor-dulce-hora:67332.00:dulce-hora---distribuidora---martes-26/5', '2026-07-14T05:21:24.840Z'),
    ('c86ceb58-f3be-4d99-9e6f-15b629fda3bb', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Pastelería - Martes 26/5', 222184.91, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:70:2026-05-01:pago-proveedor-dulce-hora:222184.91:dulce-hora---pasteleria---martes-26/5', '2026-07-14T05:21:24.840Z'),
    ('701e536b-ac65-4239-bbf2-7ac4e1a7c7d3', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panadería - Martes 26/5', 466274.97, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:71:2026-05-01:pago-proveedor-dulce-hora:466274.97:dulce-hora---panaderia---martes-26/5', '2026-07-14T05:21:24.840Z'),
    ('13f55323-f495-4361-a012-9c1e896444de', '2026-05-01', '2026-05', 'Pago proveedor Externo', null, 'Papelera + Cajas 28/5', 60000.00, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:72:2026-05-01:pago-proveedor-externo:60000.00:papelera-+-cajas-28/5', '2026-07-14T05:21:24.840Z'),
    ('4f636bf5-27f2-4528-9941-a05de95e5608', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Distribuidora - Jueves 28/5', 71400.01, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:73:2026-05-01:pago-proveedor-dulce-hora:71400.01:dulce-hora---distribuidora---jueves-28/5', '2026-07-14T05:21:24.840Z'),
    ('fcca1743-e034-4a0a-9d41-732ce9e0cba1', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panadería - Jueves 28/5', 635759.93, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:74:2026-05-01:pago-proveedor-dulce-hora:635759.93:dulce-hora---panaderia---jueves-28/5', '2026-07-14T05:21:24.840Z'),
    ('f9a50a98-49fb-4b9a-9cfa-cc793fe6d9f1', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Pastelería - Jueves 28/5', 317914.96, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:75:2026-05-01:pago-proveedor-dulce-hora:317914.96:dulce-hora---pasteleria---jueves-28/5', '2026-07-14T05:21:24.840Z'),
    ('00289806-4066-40eb-b04c-4b7cdbf2e29d', '2026-05-01', '2026-05', 'Pago Sueldos', null, 'Sueldo Vicky', 900000.00, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:78:2026-05-01:pago-sueldos:900000.00:sueldo-vicky', '2026-07-14T05:21:24.840Z'),
    ('3fb5eb31-fb92-42d7-b778-b917cc4db7ad', '2026-05-01', '2026-05', 'Pago Sueldos', null, 'Sueldo Belen', 1003000.00, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:79:2026-05-01:pago-sueldos:1003000.00:sueldo-belen', '2026-07-14T05:21:24.840Z'),
    ('77091617-cd30-45ba-bbcb-b2b2cee9d6ad', '2026-05-01', '2026-05', 'Pago proveedor Externo', null, 'Uber (Envios y buscar cosas)', 20000.00, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:83:2026-05-01:pago-proveedor-externo:20000.00:uber-(envios-y-buscar-cosas)', '2026-07-14T05:21:24.840Z'),
    ('1d89ca59-5cc7-40fe-a0ba-71bd6f869a93', '2026-05-01', '2026-05', 'Pago proveedor Externo', null, 'Comision entrada PedidosYa', 45000.00, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:100:2026-05-01:pago-proveedor-externo:45000.00:comision-entrada-pedidosya', '2026-07-14T05:21:24.840Z'),
    ('bf5eecbc-cd29-47c6-8186-23a47259a9e8', '2026-05-01', '2026-05', 'Pago proveedor Externo', null, 'Comisiones Mercadopago extras', 86973.00, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:101:2026-05-01:pago-proveedor-externo:86973.00:comisiones-mercadopago-extras', '2026-07-14T05:21:24.840Z'),
    ('a4bf9fa4-15df-43be-9d01-8ad0555d8b8c', '2026-05-01', '2026-05', 'Pago proveedor Externo', null, 'Café', 110000.00, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:22:2026-05-01:pago-proveedor-externo:110000.00:cafe', '2026-07-14T05:21:24.840Z'),
    ('3482b124-78a9-4976-b8ba-299be0a35b2e', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panaderia - Lunes 11/5', 159694.00, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:44:2026-05-01:pago-proveedor-dulce-hora:159694.00:dulce-hora---panaderia---lunes-11/5', '2026-07-14T05:21:24.840Z'),
    ('77640629-f74c-4978-a852-ab9b649a0465', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Distribuidora - Martes 12/5', 92075.99, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:43:2026-05-01:pago-proveedor-dulce-hora:92075.99:dulce-hora---distribuidora---martes-12/5', '2026-07-14T05:21:24.840Z'),
    ('8e36d837-fd95-4080-b6c3-c4382fb7686b', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panaderia - Sabado 9/5', 656170.93, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:40:2026-05-01:pago-proveedor-dulce-hora:656170.93:dulce-hora---panaderia---sabado-9/5', '2026-07-14T05:21:24.840Z'),
    ('e9cc0c47-bedf-4118-b838-9307419403bf', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Distribuidora - Lunes 11/5', 48000.00, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:42:2026-05-01:pago-proveedor-dulce-hora:48000.00:dulce-hora---distribuidora---lunes-11/5', '2026-07-14T05:21:24.840Z'),
    ('1be4c1c5-22df-49ee-b2f1-d6f965648d6a', '2026-05-01', '2026-05', 'Pago Imp Empleados', null, 'Monotributo Diego', 55300.00, 'B. Virtual', 'virtual', 'paid', false, '2026-05-01', null, 'mercado_pago', 'google-sheet-expenses', 'expense-sheet:37:2026-05-01:pago-imp-empleados:55300.00:monotributo-diego', '2026-07-14T05:21:24.840Z'),
    ('ee2b6855-1c09-4cca-9e2a-616e7f33db40', '2026-05-01', '2026-05', 'Pago proveedor Externo', null, 'TC MP', 523200.00, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:36:2026-05-01:pago-proveedor-externo:523200.00:tc-mp', '2026-07-14T05:21:24.840Z'),
    ('19b9735a-a63e-415a-abc5-990f50cbe2f6', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panadería - Jueves 7/5', 619893.92, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:35:2026-05-01:pago-proveedor-dulce-hora:619893.92:dulce-hora---panaderia---jueves-7/5', '2026-07-14T05:21:24.840Z'),
    ('b27f83bf-9d2e-4b7c-ad6b-70de7a2d5bc4', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Pastelería - Jueves 7/5', 398433.01, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:34:2026-05-01:pago-proveedor-dulce-hora:398433.01:dulce-hora---pasteleria---jueves-7/5', '2026-07-14T05:21:24.840Z'),
    ('ae38afe0-0a9b-460e-a73c-9eec7fb39526', '2026-05-01', '2026-05', 'Pago publicidad', null, 'Imprenta (Vinilos exterior + tarjeta)', 40000.00, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:33:2026-05-01:pago-publicidad:40000.00:imprenta-(vinilos-exterior-+-tarjeta)', '2026-07-14T05:21:24.840Z'),
    ('d198ee28-84ce-42de-a2a3-1af65bb3e483', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Distribuidora - Martes 5/5', 158677.17, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:32:2026-05-01:pago-proveedor-dulce-hora:158677.17:dulce-hora---distribuidora---martes-5/5', '2026-07-14T05:21:24.840Z'),
    ('bbb040e5-e07e-46cb-8046-4fec246d4723', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Pasteleria - Sabado 9/5', 187187.01, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:41:2026-05-01:pago-proveedor-dulce-hora:187187.01:dulce-hora---pasteleria---sabado-9/5', '2026-07-14T05:21:24.840Z'),
    ('29a5f4fa-f3a3-4710-8131-d708cce597a5', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panadería - Martes 5/5', 375175.91, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:31:2026-05-01:pago-proveedor-dulce-hora:375175.91:dulce-hora---panaderia---martes-5/5', '2026-07-14T05:21:24.840Z'),
    ('8e0b9d0b-faf3-48f8-9bbf-498012647d41', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Pastelería - Martes 5/5', 414217.90, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:30:2026-05-01:pago-proveedor-dulce-hora:414217.90:dulce-hora---pasteleria---martes-5/5', '2026-07-14T05:21:24.840Z'),
    ('14af0862-be0c-4d8f-b512-c77b37249f0e', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panaderia - sabado 2/5', 505793.86, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:28:2026-05-01:pago-proveedor-dulce-hora:505793.86:dulce-hora---panaderia---sabado-2/5', '2026-07-14T05:21:24.840Z'),
    ('b02e77c8-16f0-4577-aa60-8035173a416a', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Pasteleria - sabado 2/5', 369142.02, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:27:2026-05-01:pago-proveedor-dulce-hora:369142.02:dulce-hora---pasteleria---sabado-2/5', '2026-07-14T05:21:24.840Z'),
    ('6f100401-1b26-4258-b1ed-4d04e0013f33', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panadería - Martes 12/5', 807370.87, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:46:2026-05-01:pago-proveedor-dulce-hora:807370.87:dulce-hora---panaderia---martes-12/5', '2026-07-14T05:21:24.840Z'),
    ('6c7e2c41-590c-4878-9193-640c48a6566e', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Distribuidora - Jueves 14/5', 58200.00, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:47:2026-05-01:pago-proveedor-dulce-hora:58200.00:dulce-hora---distribuidora---jueves-14/5', '2026-07-14T05:21:24.840Z'),
    ('3aa5bcb7-5d5a-4746-8cdc-37db970621cb', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panaderia - Jueves 14/5', 781472.92, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:48:2026-05-01:pago-proveedor-dulce-hora:781472.92:dulce-hora---panaderia---jueves-14/5', '2026-07-14T05:21:24.840Z'),
    ('ecd98cff-4287-40c2-abf1-555b4953aa20', '2026-05-01', '2026-05', 'Pago publicidad', null, 'Banner Publicidad Calle', 90000.00, 'B. Virtual', 'virtual', 'paid', false, '2026-05-01', null, 'mercado_pago', 'google-sheet-expenses', 'expense-sheet:50:2026-05-01:pago-publicidad:90000.00:banner-publicidad-calle', '2026-07-14T05:21:24.840Z'),
    ('e0c062cf-c390-4242-9f4b-464681b4576f', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Distribuidora - Sabado 16/5', 104387.01, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:52:2026-05-01:pago-proveedor-dulce-hora:104387.01:dulce-hora---distribuidora---sabado-16/5', '2026-07-14T05:21:24.840Z'),
    ('6a037f02-24f8-451e-a26c-ffd222046d2d', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Pastelería - Sabado 16/5', 272984.97, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:53:2026-05-01:pago-proveedor-dulce-hora:272984.97:dulce-hora---pasteleria---sabado-16/5', '2026-07-14T05:21:24.840Z'),
    ('8a609e54-1d1a-4de5-968c-ce10c9743773', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panadería - Jueves 30/4', 582715.88, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:24:2026-05-01:pago-proveedor-dulce-hora:582715.88:dulce-hora---panaderia---jueves-30/4', '2026-07-14T05:21:24.840Z'),
    ('ca581ea1-42ce-4e96-a8f8-7b4fddd8e6a9', '2026-05-01', '2026-05', 'Pago proveedor Externo', null, 'Almacen + Ferreteria', 108200.00, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:23:2026-05-01:pago-proveedor-externo:108200.00:almacen-+-ferreteria', '2026-07-14T05:21:24.840Z'),
    ('dbe8c2d1-e543-4ebd-a966-ebdf964e8bac', '2026-05-01', '2026-05', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Pastelería - Martes 12/5', 346010.86, 'Otro', 'other', 'paid', false, '2026-05-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:45:2026-05-01:pago-proveedor-dulce-hora:346010.86:dulce-hora---pasteleria---martes-12/5', '2026-07-14T05:21:24.840Z'),
    ('e8eb6133-b939-4ef1-9341-8e57178e9dba', '2026-04-30', '2026-04', 'Pago Sueldos', null, 'Sueldo Viky', 240000.00, 'Otro', 'other', 'paid', false, '2026-04-30', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:16:2026-04-30:pago-sueldos:240000.00:sueldo-viky', '2026-07-14T05:21:24.840Z'),
    ('5bef42c8-05ac-4f24-87a3-878088bc5299', '2026-04-30', '2026-04', 'Pago proveedor Externo', null, 'Papelera', 20000.00, 'Otro', 'other', 'paid', false, '2026-04-30', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:15:2026-04-30:pago-proveedor-externo:20000.00:papelera', '2026-07-14T05:21:24.840Z'),
    ('61a6b776-f7b9-435d-9dc1-32cf51d909d6', '2026-04-28', '2026-04', 'Pago proveedor Externo', null, 'Descartable + Super', 29320.00, 'Otro', 'other', 'paid', false, '2026-04-28', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:11:2026-04-28:pago-proveedor-externo:29320.00:descartable-+-super', '2026-07-14T05:21:24.840Z'),
    ('3c1aff10-937e-496f-8321-11a6a747e4e3', '2026-04-27', '2026-04', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panaderia - Lunes 27/4 Refuerzo', 46584.98, 'Otro', 'other', 'paid', false, '2026-04-27', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:10:2026-04-27:pago-proveedor-dulce-hora:46584.98:dulce-hora---panaderia---lunes-27/4-refuerzo', '2026-07-14T05:21:24.840Z'),
    ('fc6a0c33-b231-4119-bb3e-472456c1b3a8', '2026-04-26', '2026-04', 'Pago proveedor Externo', null, 'Almacen', 16600.00, 'B. Virtual', 'virtual', 'paid', false, '2026-04-26', null, 'mercado_pago', 'google-sheet-expenses', 'expense-sheet:4:2026-04-26:pago-proveedor-externo:16600.00:almacen', '2026-07-14T05:21:24.840Z'),
    ('0c58f14c-26c3-410c-9561-59653ceb310b', '2026-04-25', '2026-04', 'Pago proveedor Externo', null, 'Papelera', 20000.00, 'Efectivo', 'cash', 'paid', false, '2026-04-25', null, 'cash', 'google-sheet-expenses', 'expense-sheet:3:2026-04-25:pago-proveedor-externo:20000.00:papelera', '2026-07-14T05:21:24.840Z'),
    ('cdaea1fb-9602-4895-a18e-21fc110b57ba', '2026-04-25', '2026-04', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panadería - Sabado 25', 700745.86, 'Otro', 'other', 'paid', false, '2026-04-25', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:9:2026-04-25:pago-proveedor-dulce-hora:700745.86:dulce-hora---panaderia---sabado-25', '2026-07-14T05:21:24.840Z'),
    ('84edb8d2-c331-46f6-871a-e6bfcd60d1af', '2026-04-25', '2026-04', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Pastelería - Sabado 25', 110520.01, 'Otro', 'other', 'paid', false, '2026-04-25', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:8:2026-04-25:pago-proveedor-dulce-hora:110520.01:dulce-hora---pasteleria---sabado-25', '2026-07-14T05:21:24.840Z'),
    ('82db30e5-8708-402e-a230-889a124abe12', '2026-04-25', '2026-04', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Distribuidora - Sabado 25', 71883.98, 'Otro', 'other', 'paid', false, '2026-04-25', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:7:2026-04-25:pago-proveedor-dulce-hora:71883.98:dulce-hora---distribuidora---sabado-25', '2026-07-14T05:21:24.840Z'),
    ('92f4ab04-30a3-4207-98cd-9efc9b43fa99', '2026-04-25', '2026-04', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panadería - Viernes 24', 111803.94, 'B. Virtual', 'virtual', 'paid', false, '2026-04-25', null, 'mercado_pago', 'google-sheet-expenses', 'expense-sheet:6:2026-04-25:pago-proveedor-dulce-hora:111803.94:dulce-hora---panaderia---viernes-24', '2026-07-14T05:21:24.840Z'),
    ('76728096-362a-4487-bce0-77ecb4d27376', '2026-04-23', '2026-04', 'Pago proveedor Externo', null, 'Leches / Puente', 20000.00, 'Otro', 'other', 'paid', false, '2026-04-23', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:5:2026-04-23:pago-proveedor-externo:20000.00:leches-/-puente', '2026-07-14T05:21:24.840Z'),
    ('85cf8b9e-64db-41b0-afdd-1f477bbbadf1', '2026-04-23', '2026-04', 'Pago de servicios públicos', null, 'Edenor Abril', 56670.00, 'Banco', 'bank', 'paid', false, '2026-04-23', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:2:2026-04-23:pago-de-servicios-publicos:56670.00:edenor-abril', '2026-07-14T05:21:24.840Z'),
    ('646cddd8-e5dc-4007-8465-b262d7a43138', '2026-04-01', '2026-04', 'Pago publicidad', null, 'Imprenta (Vinilos exterior)', 50000.00, 'Otro', 'other', 'paid', false, '2026-04-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:19:2026-04-01:pago-publicidad:50000.00:imprenta-(vinilos-exterior)', '2026-07-14T05:21:24.840Z'),
    ('ad675f26-cbce-4ca7-8ddf-2486245e1872', '2026-04-01', '2026-04', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Distribuidora - Jueves 30/4', 28000.00, 'Otro', 'other', 'paid', false, '2026-04-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:20:2026-04-01:pago-proveedor-dulce-hora:28000.00:dulce-hora---distribuidora---jueves-30/4', '2026-07-14T05:21:24.840Z'),
    ('a30d1393-56f7-4140-be8d-c63dca5dec75', '2026-04-01', '2026-04', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Pastelería - Jueves 30/4', 457752.09, 'Otro', 'other', 'paid', false, '2026-04-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:21:2026-04-01:pago-proveedor-dulce-hora:457752.09:dulce-hora---pasteleria---jueves-30/4', '2026-07-14T05:21:24.840Z'),
    ('f6361e97-1d22-40ac-bb17-f23b352bd87f', '2026-04-01', '2026-04', 'Pago Sueldos', null, 'Sueldo Belen', 240000.00, 'Otro', 'other', 'paid', false, '2026-04-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:17:2026-04-01:pago-sueldos:240000.00:sueldo-belen', '2026-07-14T05:21:24.840Z'),
    ('23d8e0bc-e441-4801-b7a1-9222b6b27d7e', '2026-04-01', '2026-04', 'Pago Sueldos', null, 'Sueldo Diego', 450000.00, 'Otro', 'other', 'paid', false, '2026-04-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:18:2026-04-01:pago-sueldos:450000.00:sueldo-diego', '2026-07-14T05:21:24.840Z'),
    ('d30d33a1-19fa-4eac-b2e3-8694346a5efd', '2026-04-01', '2026-04', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Panadería - Martes 28/4', 449856.87, 'Otro', 'other', 'paid', false, '2026-04-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:14:2026-04-01:pago-proveedor-dulce-hora:449856.87:dulce-hora---panaderia---martes-28/4', '2026-07-14T05:21:24.840Z'),
    ('4593ad84-c2f4-490d-8543-7f8586c328fb', '2026-04-01', '2026-04', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Pastelería - Martes 28/4', 270874.00, 'Otro', 'other', 'paid', false, '2026-04-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:13:2026-04-01:pago-proveedor-dulce-hora:270874.00:dulce-hora---pasteleria---martes-28/4', '2026-07-14T05:21:24.840Z'),
    ('aee4a4f9-4c6a-4cdf-bb5d-04dfc6a2eb10', '2026-04-01', '2026-04', 'Pago proveedor Dulce Hora', null, 'Dulce Hora - Insumo - Martes 28/4', 63800.00, 'Otro', 'other', 'paid', false, '2026-04-01', null, 'banco_provincia', 'google-sheet-expenses', 'expense-sheet:12:2026-04-01:pago-proveedor-dulce-hora:63800.00:dulce-hora---insumo---martes-28/4', '2026-07-14T05:21:24.840Z'),
    ('1e1fd990-4d1b-4fd3-b70f-4e6570c0d9c0', '2026-01-02', '2026-01', 'Pago proveedor Externo', null, 'Puente + Papelera', 117700.00, 'B. Virtual', 'virtual', 'paid', false, '2026-01-02', null, 'mercado_pago', 'google-sheet-expenses', 'expense-sheet:88:2026-01-02:pago-proveedor-externo:117700.00:puente-+-papelera', '2026-07-14T05:21:24.840Z')
)
insert into expenses (
  id, branch_id, expense_date, category_id, supplier, description, amount,
  payment_method, deferred, due_date, source, external_id, created_by, created_at,
  status, accounting_month, paid_date, payment_type, cash_account
)
select expense_seed.id,
       target_branch.id,
       expense_seed.expense_date::date,
       ec.id,
       expense_seed.supplier,
       expense_seed.description,
       expense_seed.amount::numeric,
       expense_seed.payment_method,
       expense_seed.deferred::boolean,
       expense_seed.due_date::date,
       expense_seed.source,
       expense_seed.external_id,
       target_user.id,
       coalesce(expense_seed.created_at::timestamptz, now()),
       expense_seed.status,
       expense_seed.accounting_month,
       expense_seed.paid_date::date,
       expense_seed.payment_type,
       expense_seed.cash_account
from expense_seed
cross join target_branch
cross join target_user
cross join target_org
left join expense_categories ec
  on ec.organization_id = target_org.id
 and lower(ec.name) = lower(expense_seed.category_name)
where expense_seed.id <> '__empty__'
on conflict (branch_id, source, external_id) where external_id is not null
do update set expense_date = excluded.expense_date,
              category_id = excluded.category_id,
              supplier = excluded.supplier,
              description = excluded.description,
              amount = excluded.amount,
              payment_method = excluded.payment_method,
              deferred = excluded.deferred,
              due_date = excluded.due_date,
              status = excluded.status,
              accounting_month = excluded.accounting_month,
              paid_date = excluded.paid_date,
              payment_type = excluded.payment_type,
              cash_account = excluded.cash_account;

with target_org as (
  select id from organizations order by created_at limit 1
),
employee_seed (id, name, role, weekly_hours, monthly_net_salary, monthly_gross_salary, employer_cost, photo_url, on_payroll, active, source, color, address, cuil, contact_phone, birth_date, observations, schedule_template) as (
  values
    ('7bd36c95-bf1f-4207-a9f3-8522c65c28f6', 'Diego', 'Dueño', 53, 1500000.00, 0.00, 1500000.00, null, false, true, 'default-schedule-v6', '#2f66b3', null, null, null, null, null, '{"mode":"fixed","label":"Horario fijo Diego","rotation":"diego","fixedShifts":[{"weeks":"","days":"Lunes a sabados","startTime":"06:30","endTime":"11:30"},{"weeks":"","days":"Lunes a sabados","startTime":"17:00","endTime":"20:00"},{"weeks":"","days":"Domingos","startTime":"06:30","endTime":"11:30"}],"notes":"Dueño. Horario base del local."}'),
    ('7985f73c-0fbe-4e92-8f78-a35863d4cec7', 'Mica', 'Equipo', 42.5, 900000.00, 315000.00, 1215000.00, null, true, true, 'default-schedule-v6', '#1f9d55', null, null, null, null, null, '{"mode":"rotating","label":"Rotacion Mica","rotation":"mica","fixedShifts":[{"weeks":"Semanas 1 y 3","days":"Martes a sabados","startTime":"06:30","endTime":"13:30"},{"weeks":"Semanas 1 y 3","days":"Domingos","startTime":"11:30","endTime":"19:30"},{"weeks":"Semanas 2 y 4","days":"Lunes a sabados","startTime":"06:30","endTime":"13:30"}],"notes":"Patron A/B/A/C desde domingo 31/05/2026: Mica descansa lunes en semanas 1 y 3, y domingo en semanas 2 y 4."}'),
    ('d278d828-535d-431b-8f96-40c73f4ccb40', 'Romi', 'Equipo', 35, 1200000.00, 0.00, 1200000.00, null, false, true, 'default-schedule-v6', '#f59e0b', null, null, null, null, null, '{"mode":"fixed","label":"Horario fijo Romi","rotation":"romi","fixedShifts":[{"weeks":"","days":"Miercoles a sabados","startTime":"13:00","endTime":"20:00"},{"weeks":"","days":"Domingos","startTime":"07:30","endTime":"14:30"}],"notes":"Horario base cargado desde grilla."}'),
    ('542f2e41-a15e-4f35-bf9f-1715c913343f', 'Vicky', 'Equipo', 42.5, 900000.00, 315000.00, 1215000.00, null, true, true, 'default-schedule-v6', '#c05a9e', null, null, null, null, null, '{"mode":"rotating","label":"Rotacion Vicky","rotation":"vicky","fixedShifts":[{"weeks":"Semanas 1 y 3","days":"Lunes a sabados","startTime":"13:00","endTime":"20:00"},{"weeks":"Semanas 2 y 4","days":"Martes a sabados","startTime":"13:00","endTime":"20:00"},{"weeks":"Semanas 2 y 4","days":"Domingos","startTime":"11:30","endTime":"19:30"}],"notes":"Patron desde domingo 31/05/2026: Vicky descansa domingo en semanas 1 y 3, y lunes en semanas 2 y 4."}')
)
insert into employees (
  id, organization_id, name, role, weekly_hours, monthly_net_salary,
  monthly_gross_salary, employer_cost, photo_url, on_payroll, active, source, color,
  address, cuil, contact_phone, birth_date, observations, schedule_template
)
select employee_seed.id,
       target_org.id,
       employee_seed.name,
       employee_seed.role,
       employee_seed.weekly_hours::numeric,
       employee_seed.monthly_net_salary::numeric,
       employee_seed.monthly_gross_salary::numeric,
       employee_seed.employer_cost::numeric,
       employee_seed.photo_url,
       employee_seed.on_payroll::boolean,
       employee_seed.active::boolean,
       employee_seed.source,
       employee_seed.color,
       employee_seed.address,
       employee_seed.cuil,
       employee_seed.contact_phone,
       employee_seed.birth_date::date,
       employee_seed.observations,
       employee_seed.schedule_template
from target_org
cross join employee_seed
where employee_seed.id <> '__empty__'
on conflict (organization_id, name)
do update set role = excluded.role,
              weekly_hours = excluded.weekly_hours,
              monthly_net_salary = excluded.monthly_net_salary,
              monthly_gross_salary = excluded.monthly_gross_salary,
              employer_cost = excluded.employer_cost,
              photo_url = excluded.photo_url,
              on_payroll = excluded.on_payroll,
              active = excluded.active,
              source = excluded.source,
              color = excluded.color,
              address = excluded.address,
              cuil = excluded.cuil,
              contact_phone = excluded.contact_phone,
              birth_date = excluded.birth_date,
              observations = excluded.observations,
              schedule_template = excluded.schedule_template,
              updated_at = now();

with target_org as (
  select id from organizations order by created_at limit 1
),
target_branch as (
  select b.id
  from branches b
  join target_org on target_org.id = b.organization_id
  order by b.created_at
  limit 1
)
delete from staff_shifts ss
using target_branch
where ss.branch_id = target_branch.id
  and ss.shift_date >= '2026-07-01'::date
  and ss.shift_date <= '2026-07-31'::date;

with target_org as (
  select id from organizations order by created_at limit 1
),
target_branch as (
  select b.id
  from branches b
  join target_org on target_org.id = b.organization_id
  order by b.created_at
  limit 1
),
shift_seed (id, employee_name, shift_date, start_time, end_time, break_minutes, hours, is_holiday, is_absence, notes, source) as (
  values
    ('ee2b8f48-9410-4b61-8d09-1a6838d42976', 'Diego', '2026-07-01', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('17289832-aad7-4ae4-86bb-0ca27c43e1a4', 'Mica', '2026-07-01', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('1d3ec1a5-93f7-4f49-a75b-1a5bd92ec9e4', 'Romi', '2026-07-01', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('e22e0556-bbd1-4dfa-a56e-0e9b711f4d50', 'Vicky', '2026-07-01', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('641e1e00-e14a-4481-9518-8d714c2df138', 'Diego', '2026-07-01', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('98b96591-d6a4-4bb7-8801-90c2fff00ed7', 'Diego', '2026-07-02', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('416a5d02-8bfa-4104-95eb-1b055237699c', 'Mica', '2026-07-02', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('82423b58-d8aa-4124-afa7-21a2527d77e4', 'Romi', '2026-07-02', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('2f52029d-b0b3-4f97-9078-efd30cd14d24', 'Vicky', '2026-07-02', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('1cb6a0fb-c0b7-4fe2-a652-454d22f371e1', 'Diego', '2026-07-02', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('021971b4-578d-4449-8b91-ad60297261e6', 'Diego', '2026-07-03', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('2d279254-abb3-4d6a-ae59-11cc5011c98a', 'Mica', '2026-07-03', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('35902f7c-b3f3-4667-a8cc-9aa9cad3eb53', 'Romi', '2026-07-03', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('02f35058-ff0b-42ef-aff6-dbb51e31e82c', 'Vicky', '2026-07-03', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('52a3a6fe-540b-419b-acc0-240fec8acde7', 'Diego', '2026-07-03', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('598f2812-6738-49e1-9696-09cf9560aa5a', 'Diego', '2026-07-04', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('afc621b8-2105-4e13-87a7-32d2025cdcff', 'Mica', '2026-07-04', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('846aed36-2a13-46f9-a44e-d85a1802ce52', 'Romi', '2026-07-04', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('79ee3213-00f2-4e98-bfb8-36696f5c6d34', 'Vicky', '2026-07-04', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('384aaf38-f029-4241-826a-f895f05d6464', 'Diego', '2026-07-04', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('14ae43a4-e6f0-44a7-b76b-d24da6435e09', 'Diego', '2026-07-05', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('836c63c6-1550-4cba-a350-f471f129b43c', 'Romi', '2026-07-05', '07:30', '14:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('0c6382df-1348-45fb-a39d-04293c25e288', 'Vicky', '2026-07-05', '11:30', '19:30', 0, 8, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('7d368419-23e9-4859-8d8d-06f9e8bec69c', 'Diego', '2026-07-06', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('c43405dd-db7e-485a-ad53-e305dd4f0ef2', 'Mica', '2026-07-06', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('64714a0c-accc-4a81-836a-5dd108a7e4c7', 'Diego', '2026-07-06', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('81e8f518-4f8d-49c2-bf39-fd743b197cb0', 'Diego', '2026-07-07', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('61063925-17e0-4fc9-a0c1-9ad94a2097bd', 'Mica', '2026-07-07', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('ff71998d-ca86-44cc-a14e-9c405e56a4c5', 'Vicky', '2026-07-07', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('7df7e2dc-9fb3-4e8f-9718-fee216e812b0', 'Diego', '2026-07-07', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('aed85ffd-64d9-44a2-bc8a-ebed6ccb8742', 'Diego', '2026-07-08', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('c8b0b268-0d39-4665-a73a-5b917c7de81b', 'Mica', '2026-07-08', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('4e23b344-9018-43ba-ac3a-852cc52d4804', 'Romi', '2026-07-08', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('cfd22575-ec61-45d6-ac8a-ba7a283dbaa4', 'Vicky', '2026-07-08', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('00437cae-68d7-49a6-a6a5-dd96767bd59a', 'Diego', '2026-07-08', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('46eeca04-86a8-4208-a0b7-c1ba80c94460', 'Diego', '2026-07-09', '06:30', '11:30', 0, 5, true, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('75472fdc-6869-4976-8ebb-9a76b2e733cd', 'Mica', '2026-07-09', '06:30', '13:30', 0, 7, true, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('cf0f1124-d925-4b84-b109-6651ef7c73fb', 'Romi', '2026-07-09', '13:00', '20:00', 0, 7, true, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('5cf368ca-03cc-4bda-8012-144274d9684d', 'Vicky', '2026-07-09', '13:00', '20:00', 0, 7, true, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('34863de7-5dfb-4e67-a602-da5127d7eb42', 'Diego', '2026-07-09', '16:30', '20:00', 0, 3.5, true, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('004acc9c-7c2d-4c54-bdd7-be380704a2e6', 'Diego', '2026-07-10', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('957bb967-1861-4f9a-b6dd-dc610ea21ff4', 'Mica', '2026-07-10', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('b292c619-56d3-4201-835e-d95691555113', 'Romi', '2026-07-10', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('57aa79bf-4812-4020-b244-b67e32c91afd', 'Vicky', '2026-07-10', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('a39ebe40-d80f-4759-a3e3-65acacc4c273', 'Diego', '2026-07-10', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('88a33f35-059e-4d04-82ba-b8c2e57513bf', 'Diego', '2026-07-11', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('96607fbe-8353-4abe-8e8f-886679e50dde', 'Mica', '2026-07-11', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('a292a700-9dfe-4f34-b556-83e1396f9629', 'Romi', '2026-07-11', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('34abcc5d-ed0a-4095-8a08-cf47d2ca4083', 'Vicky', '2026-07-11', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('90bba9b2-d2fc-4f57-aad3-42e3c9a7d926', 'Diego', '2026-07-11', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('93cada9e-f43a-4f1c-9553-b48dadefaaa9', 'Diego', '2026-07-12', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('d05d40d1-e16b-456a-bf50-5a8eb3d86516', 'Romi', '2026-07-12', '07:30', '14:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('412f59ec-1428-44fe-a3b6-8b90965d4082', 'Mica', '2026-07-12', '11:30', '19:30', 0, 8, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('be424643-2a19-4f88-aa87-350cedd41e92', 'Diego', '2026-07-13', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('d52ffdd5-a326-4309-9bea-6a501737cef3', 'Vicky', '2026-07-13', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('7e34fa9f-1527-453d-8538-e35dc1f9d70b', 'Diego', '2026-07-13', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('75b227aa-cd04-4fd1-a00d-643bcc4995d2', 'Diego', '2026-07-14', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('a3484793-773c-4960-a1f2-6d7342b917b9', 'Mica', '2026-07-14', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('38a1804e-a1af-4e99-b953-814b971cbd26', 'Romi', '2026-07-14', '13:00', '20:00', 0, 7, false, false, null, 'manual'),
    ('5cf5bfa7-beec-467a-8281-c669120b350f', 'Vicky', '2026-07-14', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('5d82e936-794b-4e84-8968-bdde4cffa956', 'Diego', '2026-07-14', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('ef9a22fd-1dff-4d33-a801-514cc65f55c6', 'Diego', '2026-07-15', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('23a24e10-fece-4e33-bf05-1f20bec6fe0b', 'Mica', '2026-07-15', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('276b0a2b-ca4e-480d-9832-0e090cf42b94', 'Romi', '2026-07-15', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('7e41c4ee-1823-45b3-a6bf-45d22401080b', 'Vicky', '2026-07-15', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('1ca21747-dbda-49b9-8fa2-59cff1c78adb', 'Diego', '2026-07-15', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('91e39a14-3182-4cbc-9ccf-f91478d49e96', 'Diego', '2026-07-16', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('f0eaef82-ca55-4063-8eac-6b36aa1618c7', 'Mica', '2026-07-16', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('c7e29b05-5cf8-4dfa-adc3-917794af0584', 'Romi', '2026-07-16', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('60407abd-ae73-4bcf-b3e5-ddb308e46b8a', 'Vicky', '2026-07-16', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('f18b86b6-7a84-47ed-a5cd-b77334ff7e46', 'Diego', '2026-07-16', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('7e4cbca1-1cee-4b81-b746-13514ce49bd7', 'Diego', '2026-07-17', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('dc70a731-e0a4-4513-8883-e3a887c4ac94', 'Mica', '2026-07-17', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('17e1ff4b-bfcf-41b6-a9c2-e0ab7f72f45e', 'Romi', '2026-07-17', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('03ec2619-1840-4f8d-b918-af60ed3e0d17', 'Vicky', '2026-07-17', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('aceae774-e8d8-4b1a-89d1-8f97d350145d', 'Diego', '2026-07-17', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('9f8600f7-5f16-44b3-b179-8e59f035fe74', 'Diego', '2026-07-18', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('ce200c43-756c-4b26-ad96-2380ff2bddf7', 'Mica', '2026-07-18', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('b422dd1c-a785-434c-b291-3487b186e76b', 'Romi', '2026-07-18', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('f3c6be43-582c-4085-a892-64bf8328fa8d', 'Vicky', '2026-07-18', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('f5f4eda5-ece6-4973-a343-c59660aa7a9b', 'Diego', '2026-07-18', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('03343632-7447-4405-95db-47e408d11734', 'Diego', '2026-07-19', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('563a3459-ac82-4685-bff1-77dc875ffacc', 'Romi', '2026-07-19', '07:30', '14:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('145c06a6-524b-4bae-9ca3-08aad9f96894', 'Vicky', '2026-07-19', '11:30', '19:30', 0, 8, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('cb907efa-2624-4639-a15e-80b30c04df8b', 'Diego', '2026-07-20', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('15a0c42e-0d11-49a5-8b97-5665a8a002c1', 'Mica', '2026-07-20', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('9505ee9b-2097-4e73-8e52-2930590fdb41', 'Diego', '2026-07-20', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('6c04b7ec-ee04-4390-bf53-e40e553ce41a', 'Diego', '2026-07-21', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('e038f1f2-bbb0-4c57-94bd-92b1caf6fbf9', 'Mica', '2026-07-21', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('4d110706-e4f7-4197-b795-deef450baefc', 'Vicky', '2026-07-21', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('9252b399-aed3-4853-a9d2-0e39104e8b8c', 'Diego', '2026-07-21', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('a78d31e2-d03c-443b-895e-f21975736f27', 'Diego', '2026-07-22', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('721e4ac4-2dd0-4f08-9b50-16ca25bb781d', 'Mica', '2026-07-22', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('3b7c1dea-0e63-45e0-95e6-2b490178d810', 'Romi', '2026-07-22', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('8d11167f-3139-4e53-a05b-fb27c8675c46', 'Vicky', '2026-07-22', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('816afdf9-978c-4743-ad5c-28cdfda85621', 'Diego', '2026-07-22', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('f1403524-d07c-474c-8ab9-8c97259a4a11', 'Diego', '2026-07-23', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('22b860ed-44b7-4327-a4e8-fb344a52e6c7', 'Mica', '2026-07-23', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('97700293-39a5-4d08-bd4f-a85cfe16dd30', 'Romi', '2026-07-23', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('5afa3066-7c09-4f01-8655-2daef5074fcc', 'Vicky', '2026-07-23', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('409beb5c-10fb-479c-8365-7ec7fff4c6e9', 'Diego', '2026-07-23', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('abb89756-250d-4e06-bfdc-5b21677527d1', 'Diego', '2026-07-24', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('8e057239-d113-4629-b214-19cf8a925b5d', 'Mica', '2026-07-24', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('ea08e7eb-40ec-4e4c-8e2c-301d3af0e393', 'Romi', '2026-07-24', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('c0087c34-eda5-41b3-9487-949c3adbfe8b', 'Vicky', '2026-07-24', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('dcef31c7-66ec-4680-8e0b-fdc7f22032a6', 'Diego', '2026-07-24', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('83c0b534-6037-40c8-806b-3fd34a33702d', 'Diego', '2026-07-25', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('5b465399-0d99-4782-a1e9-b5f602831a5b', 'Mica', '2026-07-25', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('1224e25e-f86c-4f49-93d2-942583643f47', 'Romi', '2026-07-25', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('59a4a5f4-325d-47ad-b6c7-5654af0f3245', 'Vicky', '2026-07-25', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('a42ad54d-6c24-48bc-bf27-65a7c9bfd251', 'Diego', '2026-07-25', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('5a760005-36f4-4831-9720-c49540bfc613', 'Diego', '2026-07-26', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('f9c387fb-e5cb-4dc8-acb3-11d83a76f885', 'Romi', '2026-07-26', '07:30', '14:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('67d196d1-e25f-4ec0-907e-646e31033d85', 'Mica', '2026-07-26', '11:30', '19:30', 0, 8, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('c96b5452-316f-4cda-bbdf-ce4d787f33f9', 'Diego', '2026-07-27', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('877ad0de-e417-4d97-bda7-a1145b9dd590', 'Vicky', '2026-07-27', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('28b4944c-3d73-4956-8b72-47cfddc266c9', 'Diego', '2026-07-27', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('add809b5-6554-4bd5-b5c1-dc64cac5dc51', 'Diego', '2026-07-28', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('87d58ea2-6824-4012-8399-d0b20da3dc09', 'Mica', '2026-07-28', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('50dd579b-d79c-4bc7-83eb-405df04d7b76', 'Vicky', '2026-07-28', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('df72bb6a-e2b9-4dda-8fa3-d9a55c2f0b68', 'Diego', '2026-07-28', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('1484f61d-2b3d-4e23-ae91-5cf362cb8112', 'Diego', '2026-07-29', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('1916c335-6ee7-4368-ad95-729aa0a0b6ce', 'Mica', '2026-07-29', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('af6ceeea-487b-4dbd-894f-02064869faf9', 'Romi', '2026-07-29', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('33c876d9-5f2e-42fa-9776-a8d8c35308f2', 'Vicky', '2026-07-29', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('8b692ebe-2ab6-4657-a334-b5b40beed443', 'Diego', '2026-07-29', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('3f88387c-5faa-4b74-aa86-d305e2010dce', 'Diego', '2026-07-30', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('b41fddb8-773d-4cd6-a003-d459375d99bd', 'Mica', '2026-07-30', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('98357a8f-9dc0-40ec-af47-dce5315abcd3', 'Romi', '2026-07-30', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('9cb94158-58a6-4aa0-b95d-44e49c0b10a6', 'Vicky', '2026-07-30', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('df6e321d-b326-46d5-8f7a-6fa5477ae9de', 'Diego', '2026-07-30', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('cee17b03-ade6-42ef-9cb7-62d19a84c6a5', 'Diego', '2026-07-31', '06:30', '11:30', 0, 5, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('6ba4831f-579b-408c-a414-a03a46c95846', 'Mica', '2026-07-31', '06:30', '13:30', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('3688a75b-424f-4af2-aab6-5940b70aa7af', 'Romi', '2026-07-31', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('77dbd5f9-d5c8-40ad-a538-385741ab9294', 'Vicky', '2026-07-31', '13:00', '20:00', 0, 7, false, false, 'Grilla base precargada', 'default-schedule-v6'),
    ('ca1d3678-4bec-4149-ae97-9e6639802b8c', 'Diego', '2026-07-31', '16:30', '20:00', 0, 3.5, false, false, 'Grilla base precargada', 'default-schedule-v6')
)
insert into staff_shifts (
  id, branch_id, employee_id, shift_date, start_time, end_time, break_minutes,
  hours, is_holiday, is_absence, notes, source
)
select shift_seed.id,
       target_branch.id,
       e.id,
       shift_seed.shift_date::date,
       shift_seed.start_time::time,
       shift_seed.end_time::time,
       shift_seed.break_minutes::integer,
       shift_seed.hours::numeric,
       shift_seed.is_holiday::boolean,
       shift_seed.is_absence::boolean,
       shift_seed.notes,
       shift_seed.source
from shift_seed
cross join target_branch
cross join target_org
join employees e
  on e.organization_id = target_org.id
 and lower(e.name) = lower(shift_seed.employee_name)
where shift_seed.id <> '__empty__'
on conflict (id)
do update set employee_id = excluded.employee_id,
              shift_date = excluded.shift_date,
              start_time = excluded.start_time,
              end_time = excluded.end_time,
              break_minutes = excluded.break_minutes,
              hours = excluded.hours,
              is_holiday = excluded.is_holiday,
              is_absence = excluded.is_absence,
              notes = excluded.notes,
              source = excluded.source,
              updated_at = now();

with target_org as (
  select id from organizations order by created_at limit 1
),
target_branch as (
  select b.id
  from branches b
  join target_org on target_org.id = b.organization_id
  order by b.created_at
  limit 1
)
insert into schedule_month_prefills (id, branch_id, month, source)
select 'snapshot:prefill:2026-07:default-schedule-v6', target_branch.id, '2026-07', 'default-schedule-v6'
from target_branch
on conflict (branch_id, month, source) do nothing;

with target_org as (
  select id from organizations order by created_at limit 1
),
investor_seed (id, name, ownership_percent, active) as (
  values
    ('2d7abe2c-d067-4b58-90f4-b57ff6a00538', 'Diego', 50, true),
    ('1c6c125d-05fd-4cbb-915a-f77f458bc012', 'Eduardo', 50, true)
)
insert into investors (id, organization_id, name, ownership_percent, active)
select investor_seed.id, target_org.id, investor_seed.name, investor_seed.ownership_percent::numeric, investor_seed.active::boolean
from target_org
cross join investor_seed
where investor_seed.id <> '__empty__'
on conflict (organization_id, name)
do update set ownership_percent = excluded.ownership_percent,
              active = excluded.active,
              updated_at = now();

with target_org as (
  select id from organizations order by created_at limit 1
),
target_branch as (
  select b.id
  from branches b
  join target_org on target_org.id = b.organization_id
  order by b.created_at
  limit 1
),
withdrawal_seed (id, investor_name, withdrawal_month, withdrawal_date, amount, status, payment_method, notes, cash_account) as (
  values
    ('4eea788b-6ca6-4c0b-95b0-da1fc339ef28', 'Eduardo', '2026-07', '2026-07-07', 3000000.00, 'paid', null, null, 'mercado_pago'),
    ('625e0aa4-d6b2-4850-a494-9e8d7bcf36b0', 'Diego', '2026-07', '2026-07-03', 3000000.00, 'paid', null, null, 'cash'),
    ('937af134-932e-433d-a035-02db4b1c90fa', 'Diego', '2026-07', '2026-06-01', 2500000.00, 'paid', null, null, 'cash'),
    ('b77a446d-b594-4ea8-b505-ad290dd25a96', 'Eduardo', '2026-07', '2026-06-01', 2500000.00, 'paid', null, null, 'cash')
)
insert into profit_withdrawals (
  id, branch_id, investor_id, withdrawal_month, withdrawal_date, amount,
  status, payment_method, notes, cash_account
)
select withdrawal_seed.id,
       target_branch.id,
       i.id,
       withdrawal_seed.withdrawal_month,
       withdrawal_seed.withdrawal_date::date,
       withdrawal_seed.amount::numeric,
       withdrawal_seed.status,
       withdrawal_seed.payment_method,
       withdrawal_seed.notes,
       withdrawal_seed.cash_account
from withdrawal_seed
cross join target_branch
cross join target_org
join investors i
  on i.organization_id = target_org.id
 and lower(i.name) = lower(withdrawal_seed.investor_name)
where withdrawal_seed.id <> '__empty__'
on conflict (id)
do update set investor_id = excluded.investor_id,
              withdrawal_month = excluded.withdrawal_month,
              withdrawal_date = excluded.withdrawal_date,
              amount = excluded.amount,
              status = excluded.status,
              payment_method = excluded.payment_method,
              notes = excluded.notes,
              cash_account = excluded.cash_account,
              updated_at = now();
