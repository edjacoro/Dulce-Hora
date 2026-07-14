alter table employees
  add column if not exists address text,
  add column if not exists cuil text,
  add column if not exists contact_phone text,
  add column if not exists birth_date date,
  add column if not exists observations text,
  add column if not exists schedule_template text not null default '{}';

update employees
set role = 'Dueño'
where lower(name) = 'diego';

update employees
set schedule_template = '{
  "mode": "fixed",
  "label": "Horario fijo Diego",
  "rotation": "diego",
  "fixedShifts": [
    { "days": "Lunes a sabados", "startTime": "06:30", "endTime": "11:30" },
    { "days": "Lunes a sabados", "startTime": "16:30", "endTime": "20:00" },
    { "days": "Domingos", "startTime": "06:30", "endTime": "11:30" }
  ],
  "notes": "Dueño. Horario base del local."
}'
where lower(name) = 'diego'
  and coalesce(nullif(schedule_template, ''), '{}') = '{}';

update employees
set schedule_template = '{
  "mode": "rotating",
  "label": "Rotacion Vicky",
  "rotation": "vicky",
  "fixedShifts": [
    { "weeks": "Semana 1", "days": "Lunes a sabados", "startTime": "13:00", "endTime": "20:00" },
    { "weeks": "Semana 2", "days": "Lunes a sabados", "startTime": "13:00", "endTime": "20:00" },
    { "weeks": "Semana 2", "days": "Domingos", "startTime": "12:30", "endTime": "19:30" },
    { "weeks": "Semana 3", "days": "Martes a sabados", "startTime": "13:00", "endTime": "20:00" },
    { "weeks": "Semana 3", "days": "Domingos", "startTime": "12:30", "endTime": "19:30" },
    { "weeks": "Semana 4", "days": "Martes a sabados", "startTime": "13:00", "endTime": "20:00" }
  ],
  "notes": "Rotacion de francos: semana 1 domingo, semana 2 sin franco semanal, semana 3 lunes, semana 4 domingo y lunes."
}'
where lower(name) = 'vicky'
  and coalesce(nullif(schedule_template, ''), '{}') = '{}';

update employees
set schedule_template = '{
  "mode": "rotating",
  "label": "Rotacion Mica",
  "rotation": "mica",
  "fixedShifts": [
    { "weeks": "Semana 1", "days": "Martes a sabados", "startTime": "06:30", "endTime": "13:30" },
    { "weeks": "Semana 1", "days": "Domingos", "startTime": "07:00", "endTime": "14:00" },
    { "weeks": "Semana 2", "days": "Martes a sabados", "startTime": "06:30", "endTime": "13:30" },
    { "weeks": "Semana 3", "days": "Lunes a sabados", "startTime": "06:30", "endTime": "13:30" },
    { "weeks": "Semana 4", "days": "Lunes a sabados", "startTime": "06:30", "endTime": "13:30" },
    { "weeks": "Semana 4", "days": "Domingos", "startTime": "07:00", "endTime": "14:00" }
  ],
  "notes": "Rotacion de francos: semana 1 lunes, semana 2 domingo y lunes, semana 3 domingo, semana 4 sin franco semanal."
}'
where lower(name) = 'mica'
  and coalesce(nullif(schedule_template, ''), '{}') = '{}';

update employees
set schedule_template = '{
  "mode": "fixed",
  "label": "Horario fijo Romi",
  "rotation": "romi",
  "fixedShifts": [
    { "days": "Miercoles a sabados", "startTime": "13:00", "endTime": "20:00" },
    { "days": "Domingos", "startTime": "07:30", "endTime": "14:30" }
  ],
  "notes": "Horario base cargado desde grilla."
}'
where lower(name) = 'romi'
  and coalesce(nullif(schedule_template, ''), '{}') = '{}';
