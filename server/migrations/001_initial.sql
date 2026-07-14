create table organizations (
  id text primary key,
  name text not null,
  tax_id text,
  currency text not null default 'ARS',
  timezone text not null default 'America/Argentina/Buenos_Aires',
  created_at timestamptz not null default now()
);

create table branches (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  address text,
  external_code text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table users (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  email text not null,
  password_hash text not null,
  role text not null check (role in ('owner', 'administrator', 'manager', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table categories (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  target_margin numeric(8, 4),
  active boolean not null default true,
  unique (organization_id, name)
);

create table products (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  canonical_name text not null,
  category_id text references categories(id),
  cost numeric(14, 2),
  active boolean not null default true,
  unique (organization_id, canonical_name)
);

create table product_aliases (
  id text primary key,
  product_id text not null references products(id) on delete cascade,
  source text not null,
  external_name text not null,
  external_id text,
  unique (source, external_id),
  unique (product_id, source, external_name)
);

create table sales_documents (
  id text primary key,
  branch_id text not null references branches(id) on delete cascade,
  external_id text,
  dedupe_key text,
  document_number text,
  document_type text not null,
  sale_date date not null,
  sale_time time,
  customer_name text,
  subtotal numeric(14, 2),
  discount numeric(14, 2) not null default 0,
  total numeric(14, 2) not null,
  payment_method text,
  status text not null default 'active',
  source text not null,
  raw_data jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now()
);

create unique index sales_documents_branch_external_id_idx
  on sales_documents(branch_id, external_id)
  where external_id is not null;

create unique index sales_documents_branch_dedupe_key_idx
  on sales_documents(branch_id, dedupe_key)
  where dedupe_key is not null;

create index sales_documents_branch_sale_date_idx
  on sales_documents(branch_id, sale_date);

create table sale_items (
  id text primary key,
  sales_document_id text not null references sales_documents(id) on delete cascade,
  external_product_id text,
  original_name text not null,
  normalized_product_id text references products(id),
  quantity numeric(14, 3) not null,
  unit_price numeric(14, 2),
  discount numeric(14, 2) not null default 0,
  line_total numeric(14, 2) not null
);

create index sale_items_document_idx on sale_items(sales_document_id);
create index sale_items_normalized_product_idx on sale_items(normalized_product_id);

create table expense_categories (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  pnl_group text not null,
  unique (organization_id, name)
);

create table expenses (
  id text primary key,
  branch_id text not null references branches(id) on delete cascade,
  expense_date date not null,
  category_id text references expense_categories(id),
  supplier text,
  description text,
  amount numeric(14, 2) not null,
  payment_method text,
  deferred boolean not null default false,
  due_date date,
  source text not null default 'manual',
  external_id text,
  created_by text references users(id),
  created_at timestamptz not null default now()
);

create index expenses_branch_date_idx on expenses(branch_id, expense_date);

create table waste_records (
  id text primary key,
  branch_id text not null references branches(id) on delete cascade,
  date date not null,
  product_id text references products(id),
  quantity numeric(14, 3) not null,
  unit_cost numeric(14, 2),
  total_cost numeric(14, 2),
  notes text,
  created_at timestamptz not null default now()
);

create index waste_records_branch_date_idx on waste_records(branch_id, date);

create table daily_targets (
  id text primary key,
  branch_id text not null references branches(id) on delete cascade,
  date date not null,
  sales_target numeric(14, 2),
  ticket_target numeric(14, 2),
  average_ticket_target numeric(14, 2),
  unique (branch_id, date)
);

create table imports (
  id text primary key,
  branch_id text not null references branches(id) on delete cascade,
  source text not null,
  filename text,
  date_from date,
  date_to date,
  rows_processed integer not null default 0,
  rows_created integer not null default 0,
  rows_updated integer not null default 0,
  rows_rejected integer not null default 0,
  status text not null,
  error_log jsonb,
  created_at timestamptz not null default now()
);

create index imports_branch_created_idx on imports(branch_id, created_at desc);

create table sync_runs (
  id text primary key,
  branch_id text not null references branches(id) on delete cascade,
  integration text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null,
  records_received integer not null default 0,
  records_created integer not null default 0,
  records_updated integer not null default 0,
  error_message text
);

create index sync_runs_branch_started_idx on sync_runs(branch_id, started_at desc);

create table audit_logs (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  user_id text references users(id),
  action text not null,
  entity text not null,
  entity_id text,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_org_created_idx on audit_logs(organization_id, created_at desc);
