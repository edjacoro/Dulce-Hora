alter table expenses
  add column if not exists status text not null default 'paid';

create unique index if not exists expenses_branch_source_external_idx
  on expenses(branch_id, source, external_id)
  where external_id is not null;

create table if not exists employees (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  role text,
  weekly_hours numeric(8, 2) not null default 0,
  monthly_net_salary numeric(14, 2) not null default 0,
  monthly_gross_salary numeric(14, 2),
  employer_cost numeric(14, 2),
  active boolean not null default true,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists staff_shifts (
  id text primary key,
  branch_id text not null references branches(id) on delete cascade,
  employee_id text not null references employees(id) on delete cascade,
  shift_date date not null,
  start_time time,
  end_time time,
  break_minutes integer not null default 0,
  hours numeric(8, 2) not null default 0,
  is_holiday boolean not null default false,
  is_absence boolean not null default false,
  notes text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, employee_id, shift_date)
);

create index if not exists staff_shifts_branch_date_idx
  on staff_shifts(branch_id, shift_date);

create index if not exists staff_shifts_employee_date_idx
  on staff_shifts(employee_id, shift_date);
