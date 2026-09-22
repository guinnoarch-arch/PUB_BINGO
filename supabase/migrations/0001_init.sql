-- Pub Bingo: initial schema.
-- Run in the Supabase SQL editor (or `supabase db push`), then run supabase/seed.sql.
-- Every table has Row Level Security. Writes that need validation go through
-- SECURITY DEFINER functions, so the browser can never write prices directly.

-- ---------------------------------------------------------------------------
-- Profiles (one per Supabase Auth user)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  username_normalized text not null unique,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  constraint profiles_username_normalized check (username_normalized = lower(username))
);

-- Creates the profile from sign-up metadata. A bad or duplicate username makes sign-up fail
-- cleanly instead of leaving an account with no profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := btrim(coalesce(new.raw_user_meta_data ->> 'username', ''));
begin
  if v_username !~ '^[A-Za-z0-9_]{3,24}$' then
    raise exception 'Usernames must be 3-24 letters, numbers or underscores';
  end if;
  insert into public.profiles (id, username, username_normalized)
  values (new.id, v_username, lower(v_username));
  return new;
exception
  when unique_violation then
    raise exception 'That username is already taken';
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- Sign in with username: resolves an exact username to its email so Supabase Auth can check the password.
-- Trade-off (same as Guinness & Holley Budgeting): anyone who knows a username can find its email.
-- Swap for an Edge Function, or email-only sign-in, if that isn't acceptable.
create or replace function public.resolve_username_login(username_input text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username_normalized = lower(btrim(username_input))
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Pubs, drinks and price reports
-- ---------------------------------------------------------------------------
create table if not exists public.pubs (
  id text primary key check (id ~ '^[a-z0-9-]{2,80}$'),
  name text not null check (char_length(name) between 2 and 100),
  address text not null check (char_length(address) between 5 and 200),
  area text not null check (area in ('Soho', 'Covent Garden', 'Holborn')),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  opened_year integer check (opened_year between 1000 and 2100),
  tags text[] not null default '{}',
  description text not null default '' check (char_length(description) <= 1000),
  uploads_paused boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.drinks (
  id uuid primary key default gen_random_uuid(),
  pub_id text not null references public.pubs (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  name_normalized text generated always as (lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))) stored,
  category text not null check (category in ('Lager', 'IPA', 'Pale Ale', 'Real Ale', 'Stout', 'Cider', 'Wheat Beer', 'Other')),
  measure text not null default 'pint' check (measure in ('pint', 'half', 'two-thirds', 'schooner')),
  current_price numeric(5, 2) not null check (current_price between 1 and 25),
  last_updated_at timestamptz not null default now(),
  source text not null default 'seed' check (source in ('seed', 'community')),
  created_at timestamptz not null default now(),
  unique (pub_id, name_normalized, measure)
);
create index if not exists drinks_pub_idx on public.drinks (pub_id);

-- Full history: every report is kept; drinks.current_price is the latest visible report.
create table if not exists public.price_reports (
  id uuid primary key default gen_random_uuid(),
  pub_id text not null references public.pubs (id) on delete cascade,
  drink_id uuid not null references public.drinks (id) on delete cascade,
  drink_name text not null,
  category text not null,
  measure text not null default 'pint',
  price numeric(5, 2) not null check (price between 1 and 25),
  note text check (note is null or char_length(note) <= 200),
  reported_at timestamptz not null default now(),
  reporter uuid references public.profiles (id) on delete set null,
  source text not null default 'community' check (source in ('seed', 'community')),
  is_hidden boolean not null default false
);
create index if not exists price_reports_drink_idx on public.price_reports (drink_id, reported_at desc);
create index if not exists price_reports_recent_idx on public.price_reports (reported_at desc);
create index if not exists price_reports_reporter_idx on public.price_reports (reporter, reported_at desc);

-- The only way to write a price. Validates input, rate-limits, creates the drink if it's new,
-- stores the report and updates the drink's current price, all in one transaction.
create or replace function public.submit_price_report(
  p_pub_id text,
  p_drink_id uuid,
  p_drink_name text,
  p_category text,
  p_measure text,
  p_price numeric,
  p_note text
)
returns public.price_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_price numeric(5, 2);
  v_note text := nullif(btrim(regexp_replace(coalesce(p_note, ''), '\s+', ' ', 'g')), '');
  v_name text := btrim(regexp_replace(coalesce(p_drink_name, ''), '\s+', ' ', 'g'));
  v_measure text := coalesce(nullif(p_measure, ''), 'pint');
  v_drink public.drinks;
  v_report public.price_reports;
begin
  if v_uid is null then
    raise exception 'Sign in to report a price' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Your account has no profile yet';
  end if;

  if p_price is null or p_price < 1 or p_price > 25 then
    raise exception 'Price must be between £1.00 and £25.00';
  end if;
  v_price := round(p_price, 2);

  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'Keep notes under 200 characters';
  end if;

  if (select count(*) from public.price_reports
      where reporter = v_uid and reported_at > now() - interval '1 hour') >= 20 then
    raise exception 'You have reported a lot of prices in the last hour. Try again later';
  end if;

  if p_drink_id is not null then
    select * into v_drink from public.drinks where id = p_drink_id and pub_id = p_pub_id for update;
    if not found then
      raise exception 'That drink is not listed at this pub';
    end if;
  else
    if not exists (select 1 from public.pubs where id = p_pub_id) then
      raise exception 'Unknown pub';
    end if;
    if char_length(v_name) < 2 or char_length(v_name) > 60 then
      raise exception 'Drink names must be 2-60 characters';
    end if;
    if p_category is null or p_category not in ('Lager', 'IPA', 'Pale Ale', 'Real Ale', 'Stout', 'Cider', 'Wheat Beer', 'Other') then
      raise exception 'Pick a valid category';
    end if;
    if v_measure not in ('pint', 'half', 'two-thirds', 'schooner') then
      raise exception 'Pick a valid measure';
    end if;

    -- Reuse an existing drink with the same name and measure rather than creating a duplicate.
    select * into v_drink from public.drinks
      where pub_id = p_pub_id and name_normalized = lower(v_name) and measure = v_measure
      for update;
    if not found then
      insert into public.drinks (pub_id, name, category, measure, current_price, source, last_updated_at)
      values (p_pub_id, v_name, p_category, v_measure, v_price, 'community', now())
      returning * into v_drink;
    end if;
  end if;

  if exists (select 1 from public.price_reports
             where reporter = v_uid and drink_id = v_drink.id and reported_at > now() - interval '10 minutes') then
    raise exception 'You reported this drink a few minutes ago';
  end if;

  insert into public.price_reports (pub_id, drink_id, drink_name, category, measure, price, note, reporter, source)
  values (p_pub_id, v_drink.id, v_drink.name, v_drink.category, v_drink.measure, v_price, v_note, v_uid, 'community')
  returning * into v_report;

  update public.drinks
    set current_price = v_price, last_updated_at = v_report.reported_at, source = 'community'
    where id = v_drink.id;

  return v_report;
end;
$$;

-- Admin moderation: hide/unhide a report, then recompute the drink's current price
-- from its latest visible report.
create or replace function public.admin_set_report_hidden(p_report_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_drink_id uuid;
  v_latest public.price_reports;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  update public.price_reports set is_hidden = p_hidden where id = p_report_id returning drink_id into v_drink_id;
  if v_drink_id is null then
    raise exception 'Report not found';
  end if;
  select * into v_latest from public.price_reports
    where drink_id = v_drink_id and not is_hidden
    order by reported_at desc limit 1;
  if found then
    update public.drinks
      set current_price = v_latest.price, last_updated_at = v_latest.reported_at, source = v_latest.source
      where id = v_drink_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Favourites and bingo progress (private to each user)
-- ---------------------------------------------------------------------------
create table if not exists public.favourites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  pub_id text not null references public.pubs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, pub_id)
);

create table if not exists public.bingo_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  tile_id text not null check (tile_id ~ '^[a-z0-9-]{1,40}$'),
  completed_at timestamptz not null default now(),
  primary key (user_id, tile_id)
);

-- ---------------------------------------------------------------------------
-- Photos (files live in the pub-photos storage bucket, at <pub_id>/<user_id>/<file>)
-- ---------------------------------------------------------------------------
create table if not exists public.pub_photos (
  id uuid primary key default gen_random_uuid(),
  pub_id text not null references public.pubs (id) on delete cascade,
  storage_path text not null unique,
  caption text check (caption is null or char_length(caption) <= 140),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  is_hidden boolean not null default false
);
create index if not exists pub_photos_pub_idx on public.pub_photos (pub_id, created_at desc);

create or replace function public.admin_set_uploads_paused(p_pub_id text, p_paused boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  update public.pubs set uploads_paused = p_paused where id = p_pub_id;
  if not found then
    raise exception 'Unknown pub';
  end if;
end;
$$;

create or replace function public.admin_set_photo_hidden(p_photo_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  update public.pub_photos set is_hidden = p_hidden where id = p_photo_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.pubs enable row level security;
alter table public.drinks enable row level security;
alter table public.price_reports enable row level security;
alter table public.favourites enable row level security;
alter table public.bingo_progress enable row level security;
alter table public.pub_photos enable row level security;

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (true);

drop policy if exists "pubs are public" on public.pubs;
create policy "pubs are public" on public.pubs for select using (true);

drop policy if exists "drinks are public" on public.drinks;
create policy "drinks are public" on public.drinks for select using (true);

drop policy if exists "visible reports are public" on public.price_reports;
create policy "visible reports are public" on public.price_reports
  for select using (not is_hidden or public.is_admin());

drop policy if exists "own favourites" on public.favourites;
create policy "own favourites" on public.favourites
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "own bingo progress" on public.bingo_progress;
create policy "own bingo progress" on public.bingo_progress
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "visible photos are public" on public.pub_photos;
create policy "visible photos are public" on public.pub_photos
  for select using (not is_hidden or public.is_admin());

-- Upload allowed only when signed in, into your own folder, for a pub whose uploads aren't paused,
-- and at most 10 photos a day.
drop policy if exists "upload photo records" on public.pub_photos;
create policy "upload photo records" on public.pub_photos
  for insert to authenticated
  with check (
    pub_photos.uploaded_by = auth.uid()
    and pub_photos.storage_path like pub_photos.pub_id || '/' || auth.uid()::text || '/%'
    and exists (select 1 from public.pubs p where p.id = pub_photos.pub_id and not p.uploads_paused)
    and (select count(*) from public.pub_photos mine
         where mine.uploaded_by = auth.uid() and mine.created_at > now() - interval '1 day') < 10
  );

drop policy if exists "delete own photos or admin" on public.pub_photos;
create policy "delete own photos or admin" on public.pub_photos
  for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_admin());

-- Table privileges: read for everyone; writes only where a policy or function allows.
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.pubs, public.drinks, public.price_reports, public.pub_photos to anon, authenticated;
revoke insert, update, delete on public.profiles, public.pubs, public.drinks, public.price_reports from anon, authenticated;
grant select, insert, delete on public.favourites, public.bingo_progress to authenticated;
grant insert, delete on public.pub_photos to authenticated;
revoke all on public.favourites, public.bingo_progress from anon;

revoke execute on function public.submit_price_report(text, uuid, text, text, text, numeric, text) from public, anon;
grant execute on function public.submit_price_report(text, uuid, text, text, text, numeric, text) to authenticated;
revoke execute on function public.admin_set_report_hidden(uuid, boolean) from public, anon;
grant execute on function public.admin_set_report_hidden(uuid, boolean) to authenticated;
revoke execute on function public.admin_set_uploads_paused(text, boolean) from public, anon;
grant execute on function public.admin_set_uploads_paused(text, boolean) to authenticated;
revoke execute on function public.admin_set_photo_hidden(uuid, boolean) from public, anon;
grant execute on function public.admin_set_photo_hidden(uuid, boolean) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.resolve_username_login(text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket for photos: public read, 5 MB max, images only
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pub-photos', 'pub-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "pub photo uploads" on storage.objects;
create policy "pub photo uploads" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pub-photos'
    -- Always qualify objects.name: inside the subquery a bare "name" would mean pubs.name.
    and (storage.foldername(objects.name))[2] = auth.uid()::text
    and exists (select 1 from public.pubs p where p.id = (storage.foldername(objects.name))[1] and not p.uploads_paused)
  );

drop policy if exists "pub photo deletes" on storage.objects;
create policy "pub photo deletes" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pub-photos'
    and ((storage.foldername(objects.name))[2] = auth.uid()::text or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- Live feed: broadcast new price reports and drink updates over Supabase Realtime
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'price_reports') then
      alter publication supabase_realtime add table public.price_reports;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'drinks') then
      alter publication supabase_realtime add table public.drinks;
    end if;
  end if;
end;
$$;
