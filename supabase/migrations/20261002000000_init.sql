-- Climb Pass Tracker: the account database (PRD section 7, plan step 2.1).
--
-- Every table a person owns has a `user_id`, row-level security so people see only their own
-- rows, and the same soft-delete columns as the on-device database. Ids are made on the device
-- (UUIDs), so a row is the same row on every device. Dates are plain `date`s and amounts are whole
-- Singapore cents, as on the device.
--
-- Run this once in the Supabase dashboard (SQL Editor), or with `supabase db push`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------------------------
-- Built-in gyms: names only (D11). Everyone can read them; nobody can change them through the API.
-- ---------------------------------------------------------------------------------------------
create table public.gyms (
  id          uuid primary key,
  name        text not null check (length(btrim(name)) between 1 and 100),
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- The stamp every synced row gets on every write, and the last-write-wins rule (FR-40).
--
-- `updated_at` is the device's clock for that edit. If a write arrives that is not newer than what
-- the server already has, it is ignored (the old row is kept), so a device that was offline cannot
-- undo a newer edit made elsewhere. A write that is accepted gets a fresh `server_updated_at`
-- (the server's clock at that moment): that is what devices ask for when they pull ("everything
-- changed since I last looked").
-- ---------------------------------------------------------------------------------------------
create function public.sync_stamp() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.server_updated_at := clock_timestamp();
    return new;
  end if;

  -- Rows never change owner or creation time.
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id cannot be changed';
  end if;
  new.created_at := old.created_at;

  -- Last write wins: an edit that is not newer than the stored row is dropped.
  if new.updated_at <= old.updated_at then
    return old;
  end if;

  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Gyms a person added by typing a name (D24, FR-25). Private.
-- ---------------------------------------------------------------------------------------------
create table public.user_gyms (
  id                 uuid primary key,
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name               text not null check (length(btrim(name)) between 1 and 100),
  created_at         timestamptz not null,
  updated_at         timestamptz not null,
  deleted_at         timestamptz,
  server_updated_at  timestamptz not null default clock_timestamp()
);

-- ---------------------------------------------------------------------------------------------
-- Passes: one row on the main screen. The checks repeat the app's own rules (FR-22), so a
-- bad row from a bug or a hand-made request is refused here as well.
-- ---------------------------------------------------------------------------------------------
create table public.passes (
  id                 uuid primary key,
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,

  gym_kind           text not null check (gym_kind in ('builtin', 'user')),
  gym_id             uuid not null,
  pass_type          text not null
                       check (pass_type in ('multipass', 'class_pack', 'single_entry', 'membership')),
  purchase_date      date not null,
  expiry_date        date,
  price_cents        integer check (price_cents is null or price_cents >= 0),
  comments           text check (comments is null or length(comments) <= 500),

  -- multipass, class pack and single entry
  total_entries      integer,
  initial_used       integer,
  -- membership
  monthly_entries    integer,
  reset_day          integer,

  created_at         timestamptz not null,
  updated_at         timestamptz not null,
  deleted_at         timestamptz,
  server_updated_at  timestamptz not null default clock_timestamp(),

  constraint passes_expiry_after_purchase
    check (expiry_date is null or expiry_date >= purchase_date),

  constraint passes_fields_match_type check (
    case
      when pass_type in ('multipass', 'class_pack') then
        total_entries between 1 and 1000
        and initial_used between 0 and total_entries
        and expiry_date is not null
        and monthly_entries is null and reset_day is null
      when pass_type = 'single_entry' then
        total_entries = 1
        and initial_used between 0 and 1
        and monthly_entries is null and reset_day is null
      when pass_type = 'membership' then
        expiry_date is not null
        and total_entries is null and initial_used is null
        and (monthly_entries is null or monthly_entries between 1 and 1000)
        and (reset_day is null or (reset_day between 1 and 31 and monthly_entries is not null))
      else false
    end
  ),

  -- Lets a use or a freeze point at a pass of the same person, and nobody else's.
  constraint passes_id_user_unique unique (id, user_id)
);

create index passes_user_server_updated on public.passes (user_id, server_updated_at);
create index user_gyms_user_server_updated on public.user_gyms (user_id, server_updated_at);

-- ---------------------------------------------------------------------------------------------
-- Freezes (memberships) and uses (the silent timestamp of every "−").
-- ---------------------------------------------------------------------------------------------
create table public.freezes (
  id                 uuid primary key,
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pass_id            uuid not null,
  start_date         date not null,
  end_date           date not null,
  created_at         timestamptz not null,
  updated_at         timestamptz not null,
  deleted_at         timestamptz,
  server_updated_at  timestamptz not null default clock_timestamp(),
  constraint freezes_end_after_start check (end_date >= start_date),
  constraint freezes_pass_fkey foreign key (pass_id, user_id)
    references public.passes (id, user_id) on delete cascade
);

create table public.uses (
  id                 uuid primary key,
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pass_id            uuid not null,
  used_at            timestamptz not null,
  created_at         timestamptz not null,
  updated_at         timestamptz not null,
  deleted_at         timestamptz,
  server_updated_at  timestamptz not null default clock_timestamp(),
  constraint uses_pass_fkey foreign key (pass_id, user_id)
    references public.passes (id, user_id) on delete cascade
);

create index freezes_user_server_updated on public.freezes (user_id, server_updated_at);
create index uses_user_server_updated on public.uses (user_id, server_updated_at);
create index uses_pass on public.uses (pass_id);
create index freezes_pass on public.freezes (pass_id);

-- ---------------------------------------------------------------------------------------------
-- Settings: one row per person (FR-33, FR-44).
-- ---------------------------------------------------------------------------------------------
create table public.user_settings (
  user_id                   uuid primary key default auth.uid()
                              references auth.users (id) on delete cascade,
  expiry_reminder_days      integer[] not null default '{14,3}'
                              check (cardinality(expiry_reminder_days) <= 5
                                     and 0 < all (expiry_reminder_days)
                                     and 365 >= all (expiry_reminder_days)),
  low_entries_threshold     integer not null default 2 check (low_entries_threshold between 0 and 100),
  expiry_reminders_enabled  boolean not null default true,
  low_reminders_enabled     boolean not null default true,
  reset_reminders_enabled   boolean not null default true,
  dismissed_reminders       jsonb not null default '{}' check (jsonb_typeof(dismissed_reminders) = 'object'),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null,
  server_updated_at         timestamptz not null default clock_timestamp()
);

-- ---------------------------------------------------------------------------------------------
-- Triggers: stamp and last-write-wins on every synced table.
-- ---------------------------------------------------------------------------------------------
create trigger sync_stamp before insert or update on public.user_gyms
  for each row execute function public.sync_stamp();
create trigger sync_stamp before insert or update on public.passes
  for each row execute function public.sync_stamp();
create trigger sync_stamp before insert or update on public.freezes
  for each row execute function public.sync_stamp();
create trigger sync_stamp before insert or update on public.uses
  for each row execute function public.sync_stamp();
create trigger sync_stamp before insert or update on public.user_settings
  for each row execute function public.sync_stamp();

-- ---------------------------------------------------------------------------------------------
-- Who can do what. Signed-out visitors may read the built-in gym names and nothing else. Signed-in
-- people may read, add and change only their own rows. Nobody deletes through the API: deletions
-- are rows with `deleted_at` set, so they sync; real deletion happens when an account is deleted
-- (the `on delete cascade` links above).
-- ---------------------------------------------------------------------------------------------
alter table public.gyms          enable row level security;
alter table public.user_gyms     enable row level security;
alter table public.passes        enable row level security;
alter table public.freezes       enable row level security;
alter table public.uses          enable row level security;
alter table public.user_settings enable row level security;

revoke all on all tables in schema public from anon, authenticated;

grant select on public.gyms to anon, authenticated;
create policy gyms_read on public.gyms for select to anon, authenticated using (true);

do $$
declare
  t text;
begin
  foreach t in array array['user_gyms', 'passes', 'freezes', 'uses', 'user_settings'] loop
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated '
      || 'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_update_own', t);
  end loop;
end;
$$;
