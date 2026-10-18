create table if not exists pedidosya_settlements (
  id text primary key,
  branch_id text not null references branches(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  sales numeric(14, 2) not null,
  services numeric(14, 2) not null,
  operations numeric(14, 2) not null,
  advertising numeric(14, 2) not null,
  refunds numeric(14, 2) not null,
  adjustments numeric(14, 2) not null,
  taxes numeric(14, 2) not null,
  cash_collected numeric(14, 2) not null,
  net_settlement numeric(14, 2) not null,
  payout_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, period_start, period_end)
);

create index if not exists pedidosya_settlements_branch_period_idx
  on pedidosya_settlements(branch_id, period_start, period_end);
