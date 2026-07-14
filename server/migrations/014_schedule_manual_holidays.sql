create table if not exists schedule_holidays (
  id text primary key,
  branch_id text not null references branches(id) on delete cascade,
  holiday_date date not null,
  name text not null,
  source text not null default 'manual' check (source in ('manual')),
  active boolean not null default true,
  created_by text references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, holiday_date, source)
);

create index if not exists schedule_holidays_branch_date_idx
  on schedule_holidays(branch_id, holiday_date);
