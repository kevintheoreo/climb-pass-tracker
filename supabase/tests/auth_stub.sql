-- A stand-in for the parts of Supabase that the migration relies on, so the database rules can be
-- tested on a plain PostgreSQL. On a real Supabase project these already exist.
create schema if not exists auth;

create table auth.users (id uuid primary key);

-- Supabase's auth.uid(): the signed-in person, from the request's token claims.
create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ),
    ''
  )::uuid
$$;

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end;
$$;

grant usage on schema public, auth to anon, authenticated;

-- Supabase gives signed-out and signed-in visitors every right on every new table in `public` and
-- leaves it to row-level security (and revokes like the ones in the migration) to narrow that down.
-- Copy that, so the tests would notice a missing revoke or policy.
alter default privileges in schema public grant all on tables to anon, authenticated;
