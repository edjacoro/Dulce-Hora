with target_org as (
  select id
  from organizations
  order by created_at
  limit 1
),
employee_seed (
  id,
  name,
  role,
  weekly_hours,
  monthly_net_salary,
  monthly_gross_salary,
  employer_cost,
  active,
  source,
  schedule_template,
  color,
  photo_url,
  on_payroll
) as (
  values
    (
      '7bd36c95-bf1f-4207-a9f3-8522c65c28f6',
      'Diego',
      'Dueno',
      56,
      0,
      null,
      null,
      true,
      'default-schedule-v6',
      '{"mode":"fixed","label":"Horario fijo Diego","rotation":"diego","fixedShifts":[{"days":"Lunes a sabados","startTime":"06:30","endTime":"11:30"},{"days":"Lunes a sabados","startTime":"16:30","endTime":"20:00"},{"days":"Domingos","startTime":"06:30","endTime":"11:30"}],"notes":"Dueno. Horario base del local."}',
      '#2f66b3',
      null,
      false
    ),
    (
      '542f2e41-a15e-4f35-bf9f-1715c913343f',
      'Vicky',
      'Equipo',
      42,
      0,
      null,
      null,
      true,
      'default-schedule-v6',
      '{"mode":"rotating","label":"Rotacion Vicky","rotation":"vicky","fixedShifts":[{"weeks":"Semanas 1 y 3","days":"Lunes a sabados","startTime":"13:00","endTime":"20:00"},{"weeks":"Semanas 2 y 4","days":"Martes a sabados","startTime":"13:00","endTime":"20:00"},{"weeks":"Semanas 2 y 4","days":"Domingos","startTime":"11:30","endTime":"19:30"}],"notes":"Patron desde domingo 31/05/2026: Vicky descansa domingo en semanas 1 y 3, y lunes en semanas 2 y 4."}',
      '#c05a9e',
      null,
      false
    ),
    (
      '7985f73c-0fbe-4e92-8f78-a35863d4cec7',
      'Mica',
      'Equipo',
      42,
      0,
      null,
      null,
      true,
      'default-schedule-v6',
      '{"mode":"rotating","label":"Rotacion Mica","rotation":"mica","fixedShifts":[{"weeks":"Semanas 1 y 3","days":"Martes a sabados","startTime":"06:30","endTime":"13:30"},{"weeks":"Semanas 1 y 3","days":"Domingos","startTime":"11:30","endTime":"19:30"},{"weeks":"Semanas 2 y 4","days":"Lunes a sabados","startTime":"06:30","endTime":"13:30"}],"notes":"Patron A/B/A/C desde domingo 31/05/2026: Mica descansa lunes en semanas 1 y 3, y domingo en semanas 2 y 4."}',
      '#1f9d55',
      null,
      false
    ),
    (
      'd278d828-535d-431b-8f96-40c73f4ccb40',
      'Romi',
      'Equipo',
      35,
      0,
      null,
      null,
      true,
      'default-schedule-v6',
      '{"mode":"fixed","label":"Horario fijo Romi","rotation":"romi","fixedShifts":[{"days":"Miercoles a sabados","startTime":"13:00","endTime":"20:00"},{"days":"Domingos","startTime":"07:30","endTime":"14:30"}],"notes":"Horario base cargado desde grilla."}',
      '#f59e0b',
      null,
      false
    )
)
insert into employees (
  id,
  organization_id,
  name,
  role,
  weekly_hours,
  monthly_net_salary,
  monthly_gross_salary,
  employer_cost,
  active,
  source,
  schedule_template,
  color,
  photo_url,
  on_payroll
)
select
  employee_seed.id,
  target_org.id,
  employee_seed.name,
  employee_seed.role,
  employee_seed.weekly_hours::numeric,
  employee_seed.monthly_net_salary::numeric,
  employee_seed.monthly_gross_salary::numeric,
  employee_seed.employer_cost::numeric,
  employee_seed.active::boolean,
  employee_seed.source,
  employee_seed.schedule_template,
  employee_seed.color,
  employee_seed.photo_url,
  employee_seed.on_payroll::boolean
from target_org
cross join employee_seed
on conflict (organization_id, name)
do update set
  role = case
    when employees.role is null or employees.role = '' then excluded.role
    else employees.role
  end,
  weekly_hours = case
    when employees.weekly_hours <= 0 then excluded.weekly_hours
    else employees.weekly_hours
  end,
  monthly_net_salary = employees.monthly_net_salary,
  monthly_gross_salary = employees.monthly_gross_salary,
  employer_cost = employees.employer_cost,
  active = true,
  source = case
    when employees.source is null or employees.source = 'manual' then excluded.source
    else employees.source
  end,
  schedule_template = case
    when coalesce(nullif(employees.schedule_template, ''), '{}') = '{}' then excluded.schedule_template
    else employees.schedule_template
  end,
  color = coalesce(employees.color, excluded.color),
  photo_url = coalesce(employees.photo_url, excluded.photo_url),
  on_payroll = employees.on_payroll,
  updated_at = now();
