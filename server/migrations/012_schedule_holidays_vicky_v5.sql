update employees
set schedule_template = $${
  "mode": "rotating",
  "label": "Rotacion Vicky",
  "rotation": "vicky",
  "fixedShifts": [
    { "weeks": "Semanas 1 y 3", "days": "Lunes a sabados", "startTime": "13:00", "endTime": "20:00" },
    { "weeks": "Semanas 2 y 4", "days": "Martes a sabados", "startTime": "13:00", "endTime": "20:00" },
    { "weeks": "Semanas 2 y 4", "days": "Domingos", "startTime": "11:30", "endTime": "19:30" }
  ],
  "notes": "Patron desde domingo 31/05/2026: Vicky descansa domingo en semanas 1 y 3, y lunes en semanas 2 y 4."
}$$,
updated_at = now()
where lower(name) in ('vicky', 'victoria');

delete from staff_shifts
where source = 'default-schedule-v4';

delete from schedule_month_prefills
where source = 'default-schedule-v4';
