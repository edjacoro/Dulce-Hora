alter table waste_records
  add column if not exists source text not null default 'manual';

alter table waste_records
  add column if not exists external_id text;

alter table waste_records
  add column if not exists external_event_id text;

alter table waste_records
  add column if not exists user_name text;

alter table waste_records
  add column if not exists raw_data jsonb not null default '{}'::jsonb;

create unique index if not exists waste_records_branch_external_id_idx
  on waste_records(branch_id, external_id)
  where external_id is not null;
