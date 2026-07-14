alter table users
  add column if not exists avatar_url text;

alter table users
  drop constraint if exists users_organization_id_email_key;

create unique index if not exists users_organization_email_name_idx
  on users(organization_id, email, name);

update users
set name = 'Eduardo',
    email = 'dulcehoraurquiza@gmail.com',
    password_hash = '$2b$12$Ot6RuPQnUDNIPEjDmankveiAewAo8/alDEujoCFISW88bhaAllbMi',
    role = 'owner',
    active = true,
    avatar_url = null
where id = (
  select id
  from users
  order by created_at
  limit 1
);

insert into users (id, organization_id, name, email, password_hash, role, active, avatar_url)
select '2104ec47-43c7-4660-8796-617d21395c31',
       organization_id,
       'Diego',
       'dulcehoraurquiza@gmail.com',
       '$2b$12$SfJRpDgCVuJt9DnJGBqd5.lzy1DBTQkrUtBQSlJO6Keoesf0fti0a',
       'owner',
       true,
       '/users/diego.png'
from users
where lower(name) = 'eduardo'
order by created_at
limit 1
on conflict (organization_id, email, name)
do update set password_hash = excluded.password_hash,
              role = excluded.role,
              active = excluded.active,
              avatar_url = excluded.avatar_url;
