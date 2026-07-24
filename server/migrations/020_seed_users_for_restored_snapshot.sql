insert into users (id, organization_id, name, email, password_hash, role, active, avatar_url)
select '6f797501-313f-4f35-bdc3-7b95f761cbb7',
       o.id,
       'Eduardo',
       'dulcehoraurquiza@gmail.com',
       '$2b$12$Ot6RuPQnUDNIPEjDmankveiAewAo8/alDEujoCFISW88bhaAllbMi',
       'owner',
       true,
       null
from organizations o
where not exists (
  select 1
  from users u
  where u.organization_id = o.id
)
order by o.created_at
limit 1
on conflict (organization_id, email, name)
do update set password_hash = excluded.password_hash,
              role = excluded.role,
              active = excluded.active,
              avatar_url = excluded.avatar_url;

insert into users (id, organization_id, name, email, password_hash, role, active, avatar_url)
select '2104ec47-43c7-4660-8796-617d21395c31',
       o.id,
       'Diego',
       'dulcehoraurquiza@gmail.com',
       '$2b$12$SfJRpDgCVuJt9DnJGBqd5.lzy1DBTQkrUtBQSlJO6Keoesf0fti0a',
       'owner',
       true,
       '/users/diego.png'
from organizations o
where exists (
  select 1
  from users u
  where u.organization_id = o.id
    and lower(u.name) = 'eduardo'
)
  and not exists (
    select 1
    from users u
    where u.organization_id = o.id
      and lower(u.name) = 'diego'
  )
order by o.created_at
limit 1
on conflict (organization_id, email, name)
do update set password_hash = excluded.password_hash,
              role = excluded.role,
              active = excluded.active,
              avatar_url = excluded.avatar_url;
