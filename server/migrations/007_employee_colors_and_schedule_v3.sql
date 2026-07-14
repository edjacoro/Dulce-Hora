alter table employees
  add column if not exists color text;

update employees set color = '#2f66b3' where lower(name) = 'diego' and color is null;
update employees set color = '#c05a9e' where lower(name) = 'vicky' and color is null;
update employees set color = '#1f9d55' where lower(name) in ('mica', 'micaela') and color is null;
update employees set color = '#f59e0b' where lower(name) = 'romi' and color is null;
update employees set color = '#64748b' where color is null;

alter table employees
  alter column color set default '#64748b';

update employees
set schedule_template = $${
  "mode": "rotating",
  "label": "Rotacion Vicky",
  "rotation": "vicky",
  "fixedShifts": [
    { "weeks": "Semana 1", "days": "Martes a sabados", "startTime": "13:00", "endTime": "20:00" },
    { "weeks": "Semana 1", "days": "Domingos", "startTime": "11:30", "endTime": "19:30" },
    { "weeks": "Semana 2", "days": "Martes a sabados", "startTime": "13:00", "endTime": "20:00" },
    { "weeks": "Semana 3", "days": "Lunes a sabados", "startTime": "13:00", "endTime": "20:00" },
    { "weeks": "Semana 4", "days": "Lunes a sabados", "startTime": "13:00", "endTime": "20:00" },
    { "weeks": "Semana 4", "days": "Domingos", "startTime": "11:30", "endTime": "19:30" }
  ],
  "notes": "Rotacion corregida: toma los francos que antes estaban en Mica. Domingos 11:30 a 19:30."
}$$
where lower(name) = 'vicky';

update employees
set schedule_template = $${
  "mode": "rotating",
  "label": "Rotacion Mica",
  "rotation": "mica",
  "fixedShifts": [
    { "weeks": "Semana 1", "days": "Lunes a sabados", "startTime": "06:30", "endTime": "13:30" },
    { "weeks": "Semana 2", "days": "Lunes a sabados", "startTime": "06:30", "endTime": "13:30" },
    { "weeks": "Semana 2", "days": "Domingos", "startTime": "11:30", "endTime": "19:30" },
    { "weeks": "Semana 3", "days": "Martes a sabados", "startTime": "06:30", "endTime": "13:30" },
    { "weeks": "Semana 3", "days": "Domingos", "startTime": "11:30", "endTime": "19:30" },
    { "weeks": "Semana 4", "days": "Martes a sabados", "startTime": "06:30", "endTime": "13:30" }
  ],
  "notes": "Rotacion corregida: toma los francos que antes estaban en Vicky. Domingos 11:30 a 19:30."
}$$
where lower(name) in ('mica', 'micaela');

delete from staff_shifts
where source in ('default-schedule', 'default-schedule-v2');

delete from schedule_month_prefills
where source in ('default-schedule', 'default-schedule-v2');
