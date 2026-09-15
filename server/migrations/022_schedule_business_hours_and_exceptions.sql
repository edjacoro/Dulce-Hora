create table if not exists branch_business_hours (
  id text primary key,
  branch_id text not null references branches(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  open_time time,
  close_time time,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, weekday)
);

insert into branch_business_hours (id, branch_id, weekday, open_time, close_time, active)
select 'business-hours:' || branch.id || ':' || schedule.weekday,
       branch.id,
       schedule.weekday,
       schedule.open_time::time,
       schedule.close_time::time,
       true
from branches branch
cross join (
  values
    (0, '08:00', '19:00'),
    (1, '07:30', '19:30'),
    (2, '07:30', '19:30'),
    (3, '07:30', '19:30'),
    (4, '07:30', '19:30'),
    (5, '07:30', '19:30'),
    (6, '07:30', '19:30')
) as schedule(weekday, open_time, close_time)
on conflict (branch_id, weekday) do nothing;

create table if not exists schedule_shift_exceptions (
  id text primary key,
  branch_id text not null references branches(id) on delete cascade,
  employee_id text not null references employees(id) on delete cascade,
  shift_date date not null,
  original_start_time time not null,
  original_end_time time not null,
  reason text not null default 'manual_override',
  created_by text references users(id),
  created_at timestamptz not null default now(),
  unique (branch_id, employee_id, shift_date, original_start_time, original_end_time)
);

create index if not exists schedule_shift_exceptions_branch_date_idx
  on schedule_shift_exceptions(branch_id, shift_date);
