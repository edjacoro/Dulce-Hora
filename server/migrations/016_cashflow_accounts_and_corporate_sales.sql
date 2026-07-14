alter table expenses
  add column if not exists cash_account text;

alter table profit_withdrawals
  add column if not exists cash_account text;

create table if not exists cashflow_transfers (
  id text primary key,
  branch_id text not null references branches(id) on delete cascade,
  transfer_date date not null,
  from_account text not null,
  to_account text not null,
  amount numeric(14, 2) not null,
  notes text,
  created_by text references users(id),
  created_at timestamptz not null default now()
);

create index if not exists cashflow_transfers_branch_date_idx
  on cashflow_transfers(branch_id, transfer_date);

create table if not exists cashflow_account_adjustments (
  id text primary key,
  branch_id text not null references branches(id) on delete cascade,
  adjustment_date date not null,
  account text not null,
  amount numeric(14, 2) not null,
  notes text,
  created_by text references users(id),
  created_at timestamptz not null default now()
);

create index if not exists cashflow_account_adjustments_branch_date_idx
  on cashflow_account_adjustments(branch_id, adjustment_date);
