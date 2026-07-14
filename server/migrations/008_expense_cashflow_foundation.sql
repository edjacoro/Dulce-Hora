alter table expense_categories
  add column if not exists active boolean not null default true;

alter table expenses
  add column if not exists accounting_month text,
  add column if not exists paid_date date,
  add column if not exists payment_type text not null default 'cash';

update expenses
set accounting_month = substring(expense_date::text from 1 for 7)
where accounting_month is null;

update expenses
set paid_date = expense_date
where status = 'paid'
  and paid_date is null;

update expense_categories
set active = false
where lower(name) in ('inversion', 'inversiones')
   or pnl_group = 'capex';

create index if not exists expenses_branch_accounting_month_idx
  on expenses(branch_id, accounting_month);

create index if not exists expenses_branch_paid_date_idx
  on expenses(branch_id, paid_date)
  where paid_date is not null;

create table if not exists investors (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  ownership_percent numeric(8, 4) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists profit_withdrawals (
  id text primary key,
  branch_id text not null references branches(id) on delete cascade,
  investor_id text not null references investors(id),
  withdrawal_month text not null,
  withdrawal_date date not null,
  amount numeric(14, 2) not null,
  status text not null default 'paid' check (status in ('paid', 'pending')),
  payment_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profit_withdrawals_branch_month_idx
  on profit_withdrawals(branch_id, withdrawal_month);

insert into investors (id, organization_id, name, ownership_percent, active)
select 'investor:' || id || ':diego', id, 'Diego', 50, true
from organizations
on conflict (organization_id, name) do nothing;

insert into investors (id, organization_id, name, ownership_percent, active)
select 'investor:' || id || ':eduardo', id, 'Eduardo', 50, true
from organizations
on conflict (organization_id, name) do nothing;
