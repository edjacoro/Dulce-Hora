alter table staff_shifts
  drop constraint if exists staff_shifts_branch_id_employee_id_shift_date_key;

create index if not exists staff_shifts_branch_employee_date_idx
  on staff_shifts(branch_id, employee_id, shift_date);

create table if not exists schedule_month_prefills (
  id text primary key,
  branch_id text not null references branches(id) on delete cascade,
  month text not null,
  source text not null default 'default-schedule',
  created_at timestamptz not null default now(),
  unique (branch_id, month, source)
);
