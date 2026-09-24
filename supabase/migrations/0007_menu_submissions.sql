-- Pub Bingo 0007: menus and price photos sent in by users, seen only by admins.
-- Also lets admins record the date a price was seen, so prices taken from an older menu keep that date.
-- Run after 0006 (safe to re-run).

-- Files: private. Users upload into their own folder; only admins (and the sender) can open them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-submissions', 'menu-submissions', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.menu_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references public.profiles (id) on delete set null,
  pub_id text references public.pubs (id) on delete set null,
  pub_name text check (pub_name is null or char_length(pub_name) between 2 and 100),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  file_kind text not null check (file_kind in ('pdf', 'photo')),
  seen_on date not null,
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'new' check (status in ('new', 'used', 'not_used')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  prices_imported integer not null default 0 check (prices_imported >= 0),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint menu_submissions_pub check (pub_id is not null or pub_name is not null)
);
create index if not exists menu_submissions_created_idx on public.menu_submissions (created_at desc);
create index if not exists menu_submissions_user_idx on public.menu_submissions (submitted_by, created_at desc);

drop policy if exists "menu submission uploads" on storage.objects;
create policy "menu submission uploads" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'menu-submissions'
    and (storage.foldername(objects.name))[1] = auth.uid()::text
    and (select count(*) from public.menu_submissions m
         where m.submitted_by = auth.uid() and m.created_at > now() - interval '1 day') < 10
  );

drop policy if exists "menu submission reads" on storage.objects;
create policy "menu submission reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'menu-submissions' and (public.is_admin() or (storage.foldername(objects.name))[1] = auth.uid()::text));

drop policy if exists "menu submission deletes" on storage.objects;
create policy "menu submission deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'menu-submissions' and (public.is_admin() or (storage.foldername(objects.name))[1] = auth.uid()::text));

-- Senders see their own; admins see all. Writes go through the functions below.
alter table public.menu_submissions enable row level security;
drop policy if exists "own or admin menu submissions" on public.menu_submissions;
create policy "own or admin menu submissions" on public.menu_submissions
  for select to authenticated
  using (submitted_by = auth.uid() or public.is_admin());
revoke all on public.menu_submissions from anon, authenticated;
grant select on public.menu_submissions to authenticated;

create or replace function public.submit_menu_submission(
  p_pub_id text,
  p_pub_name text,
  p_storage_path text,
  p_file_name text,
  p_seen_on date,
  p_note text
)
returns public.menu_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/London')::date;
  v_pub_id text := nullif(btrim(coalesce(p_pub_id, '')), '');
  v_pub_name text := nullif(btrim(regexp_replace(coalesce(p_pub_name, ''), '\s+', ' ', 'g')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_kind text;
  v_row public.menu_submissions;
begin
  if v_uid is null then
    raise exception 'Sign in to send a menu' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Your account has no profile yet';
  end if;
  if p_storage_path is null or p_storage_path !~ ('^' || v_uid::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'Upload the file first';
  end if;
  v_kind := case
    when p_storage_path ~* '\.pdf$' then 'pdf'
    when p_storage_path ~* '\.(jpe?g|png|webp)$' then 'photo'
  end;
  if v_kind is null then
    raise exception 'Send a PDF or a photo (JPEG, PNG or WebP)';
  end if;
  if v_pub_id is not null then
    if not exists (select 1 from public.pubs where id = v_pub_id and is_published) then
      raise exception 'Pick a pub from the list';
    end if;
    v_pub_name := null;
  elsif v_pub_name is null or char_length(v_pub_name) < 2 or char_length(v_pub_name) > 100 then
    raise exception 'Say which pub the menu is from';
  end if;
  if p_seen_on is null then
    raise exception 'Add the date you saw the menu';
  end if;
  if p_seen_on > v_today then
    raise exception 'The date can''t be in the future';
  end if;
  if p_seen_on < v_today - 365 then
    raise exception 'That menu is over a year old, so the prices are probably out of date';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Keep the note under 500 characters';
  end if;
  if (select count(*) from public.menu_submissions where submitted_by = v_uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'You''ve sent 10 menus today. Thanks! Try again tomorrow';
  end if;

  insert into public.menu_submissions (submitted_by, pub_id, pub_name, storage_path, file_name, file_kind, seen_on, note)
  values (v_uid, v_pub_id, v_pub_name, p_storage_path, left(coalesce(nullif(btrim(p_file_name), ''), 'menu'), 200), v_kind, p_seen_on, v_note)
  returning * into v_row;
  return v_row;
end;
$$;

-- Admins: mark as used / not used, reply to the sender, record how many prices came from it.
create or replace function public.admin_review_menu_submission(
  p_submission_id uuid,
  p_status text,
  p_admin_note text,
  p_prices_imported integer default null
)
returns public.menu_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.menu_submissions;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_status not in ('new', 'used', 'not_used') then
    raise exception 'Pick a valid status';
  end if;
  if char_length(coalesce(p_admin_note, '')) > 500 then
    raise exception 'Keep the reply under 500 characters';
  end if;
  if p_prices_imported is not null and p_prices_imported < 0 then
    raise exception 'Invalid number of prices';
  end if;
  update public.menu_submissions
    set status = p_status,
        admin_note = nullif(btrim(coalesce(p_admin_note, '')), ''),
        prices_imported = prices_imported + coalesce(p_prices_imported, 0),
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_submission_id
    returning * into v_row;
  if not found then
    raise exception 'Menu not found';
  end if;
  return v_row;
end;
$$;

-- Returns the file path so the app can remove the file from storage too.
create or replace function public.admin_delete_menu_submission(p_submission_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  delete from public.menu_submissions where id = p_submission_id returning storage_path into v_path;
  return v_path;
end;
$$;

revoke execute on function public.submit_menu_submission(text, text, text, text, date, text) from public, anon;
grant execute on function public.submit_menu_submission(text, text, text, text, date, text) to authenticated;
revoke execute on function public.admin_review_menu_submission(uuid, text, text, integer) from public, anon;
grant execute on function public.admin_review_menu_submission(uuid, text, text, integer) to authenticated;
revoke execute on function public.admin_delete_menu_submission(uuid) from public, anon;
grant execute on function public.admin_delete_menu_submission(uuid) to authenticated;

-- Admin prices can now carry the date the price was seen (e.g. the date on a menu someone sent in).
-- A price from an older date goes into the history, but only replaces the current price if it's newer
-- than it (or the current price is only an estimate).
drop function if exists public.admin_set_drink_price(text, uuid, text, text, text, numeric, text, text, text);

create or replace function public.admin_set_drink_price(
  p_pub_id text,
  p_drink_id uuid,
  p_drink_name text,
  p_category text,
  p_measure text,
  p_price numeric,
  p_source text,
  p_source_url text,
  p_note text,
  p_observed_on date default null
)
returns public.price_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/London')::date;
  v_when timestamptz;
  v_price numeric(5, 2);
  v_name text := btrim(regexp_replace(coalesce(p_drink_name, ''), '\s+', ' ', 'g'));
  v_measure text := coalesce(nullif(p_measure, ''), 'pint');
  v_url text := nullif(btrim(coalesce(p_source_url, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_drink public.drinks;
  v_report public.price_reports;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_source not in ('website', 'admin') then
    raise exception 'Source must be website or admin';
  end if;
  if p_source = 'website' and v_url is null then
    raise exception 'Add the link to the page the price came from';
  end if;
  if v_url is not null and v_url !~ '^https?://[^\s]+$' then
    raise exception 'Source link must start with http:// or https://';
  end if;
  if p_price is null or p_price < 1 or p_price > 25 then
    raise exception 'Price must be between £1.00 and £25.00';
  end if;
  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'Keep notes under 200 characters';
  end if;
  if p_observed_on is not null and p_observed_on > v_today then
    raise exception 'The date seen can''t be in the future';
  end if;
  if p_observed_on is not null and p_observed_on < v_today - 365 then
    raise exception 'That date is over a year ago';
  end if;
  v_price := round(p_price, 2);
  -- Today (or no date) = now; an earlier day = midday London time on that day.
  v_when := case
    when p_observed_on is null or p_observed_on >= v_today then now()
    else (p_observed_on + time '12:00') at time zone 'Europe/London'
  end;

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
    if v_measure not in ('pint', 'half', 'two-thirds', 'schooner', 'bottle', 'can') then
      raise exception 'Pick a valid measure';
    end if;
    select * into v_drink from public.drinks
      where pub_id = p_pub_id and name_normalized = lower(v_name) and measure = v_measure
      for update;
    if not found then
      insert into public.drinks (pub_id, name, category, measure, current_price, source, source_url, last_updated_at)
      values (p_pub_id, v_name, p_category, v_measure, v_price, p_source, v_url, v_when)
      returning * into v_drink;
    end if;
  end if;

  insert into public.price_reports (pub_id, drink_id, drink_name, category, measure, price, note, reporter, source, source_url, reported_at)
  values (p_pub_id, v_drink.id, v_drink.name, v_drink.category, v_drink.measure, v_price, v_note, v_uid, p_source, v_url, v_when)
  returning * into v_report;

  if v_drink.source = 'seed' or v_drink.last_updated_at is null or v_when >= v_drink.last_updated_at then
    update public.drinks
      set current_price = v_price, last_updated_at = v_when, source = p_source, source_url = v_url
      where id = v_drink.id;
  end if;

  return v_report;
end;
$$;

revoke execute on function public.admin_set_drink_price(text, uuid, text, text, text, numeric, text, text, text, date) from public, anon;
grant execute on function public.admin_set_drink_price(text, uuid, text, text, text, numeric, text, text, text, date) to authenticated;
