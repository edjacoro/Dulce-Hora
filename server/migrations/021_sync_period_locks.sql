create table if not exists sync_period_locks (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  branch_id text not null references branches(id) on delete cascade,
  source text not null,
  period_type text not null default 'month',
  period_start date not null,
  period_end date not null,
  status text not null default 'locked',
  locked_at timestamptz not null default now(),
  locked_by_user_id text references users(id) on delete set null,
  sales_documents_count integer not null default 0,
  sale_items_count integer not null default 0,
  waste_records_count integer not null default 0,
  notes text,
  unique (organization_id, branch_id, source, period_type, period_start)
);
