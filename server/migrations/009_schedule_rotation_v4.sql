update employees
set schedule_template = $${
  "mode": "rotating",
  "label": "Rotacion Vicky",
  "rotation": "vicky",
  "fixedShifts": [
    { "weeks": "Semanas 1, 2 y 3", "days": "Lunes a sabados", "startTime": "13:00", "endTime": "20:00" },
    { "weeks": "Semana 4", "days": "Martes a sabados", "startTime": "13:00", "endTime": "20:00" },
    { "weeks": "Semanas 2 y 4", "days": "Domingos", "startTime": "11:30", "endTime": "19:30" }
  ],
  "notes": "Patron A/B/A/C desde domingo 31/05/2026: Vicky descansa domingo en semanas 1 y 3, y lunes en semana 4."
}$$,
updated_at = now()
where lower(name) in ('vicky', 'victoria');

update employees
set schedule_template = $${
  "mode": "rotating",
  "label": "Rotacion Mica",
  "rotation": "mica",
  "fixedShifts": [
    { "weeks": "Semanas 1 y 3", "days": "Martes a sabados", "startTime": "06:30", "endTime": "13:30" },
    { "weeks": "Semanas 1 y 3", "days": "Domingos", "startTime": "11:30", "endTime": "19:30" },
    { "weeks": "Semanas 2 y 4", "days": "Lunes a sabados", "startTime": "06:30", "endTime": "13:30" }
  ],
  "notes": "Patron A/B/A/C desde domingo 31/05/2026: Mica descansa lunes en semanas 1 y 3, y domingo en semanas 2 y 4."
}$$,
updated_at = now()
where lower(name) in ('mica', 'micaela');

delete from staff_shifts
where source = 'default-schedule-v3';

delete from schedule_month_prefills
where source = 'default-schedule-v3';
