insert into organizations (id, name, tax_id, currency, timezone)
select '01a107e0-c4ea-4ada-825f-ea4b04bcee46',
       'Dulce Hora Villa Urquiza',
       null,
       'ARS',
       'America/Argentina/Buenos_Aires'
where not exists (select 1 from organizations);

insert into branches (id, organization_id, name, address, external_code, active)
select '9be53715-a7c0-4232-9a85-503831b64bc2',
       o.id,
       'Villa Urquiza',
       'Juramento 4823',
       'villa-urquiza',
       true
from organizations o
where not exists (
  select 1
  from branches b
  where b.organization_id = o.id
)
order by o.created_at
limit 1;
