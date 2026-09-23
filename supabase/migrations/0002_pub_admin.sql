-- Pub Bingo 0002: hidden pubs, websites, price sources and admin research notes.
-- Run after 0001_init.sql (safe to re-run). Then re-run supabase/seed.sql to fill in websites and notes.

-- ---------------------------------------------------------------------------
-- Pubs: publish switch, website details. Hidden pubs may have incomplete info.
-- ---------------------------------------------------------------------------
alter table public.pubs
  add column if not exists is_published boolean not null default true,
  add column if not exists website text,
  add column if not exists drinks_menu_url text,
  add column if not exists operator text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.pubs alter column address drop not null;
alter table public.pubs alter column lat drop not null;
alter table public.pubs alter column lng drop not null;

alter table public.pubs drop constraint if exists pubs_area_check;
alter table public.pubs add constraint pubs_area_check check (char_length(area) between 2 and 40);
alter table public.pubs drop constraint if exists pubs_website_format;
alter table public.pubs add constraint pubs_website_format check (website is null or website ~ '^https?://[^\s]+$');
alter table public.pubs drop constraint if exists pubs_menu_url_format;
alter table public.pubs add constraint pubs_menu_url_format check (drinks_menu_url is null or drinks_menu_url ~ '^https?://[^\s]+$');
alter table public.pubs drop constraint if exists pubs_operator_length;
alter table public.pubs add constraint pubs_operator_length check (operator is null or char_length(operator) <= 60);
-- The public only ever sees complete pubs.
alter table public.pubs drop constraint if exists pubs_published_complete;
alter table public.pubs add constraint pubs_published_complete
  check (not is_published or (address is not null and lat is not null and lng is not null));

-- ---------------------------------------------------------------------------
-- Admin-only research notes per pub (never visible to the public)
-- ---------------------------------------------------------------------------
create table if not exists public.pub_admin (
  pub_id text primary key references public.pubs (id) on delete cascade,
  prices_online text not null default 'unknown' check (prices_online in ('yes', 'partial', 'no', 'unknown')),
  notes text not null default '' check (char_length(notes) <= 4000),
  prices_checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.pub_admin enable row level security;
drop policy if exists "admins read pub admin" on public.pub_admin;
create policy "admins read pub admin" on public.pub_admin for select to authenticated using (public.is_admin());
revoke all on public.pub_admin from anon, authenticated;
grant select on public.pub_admin to authenticated;

-- ---------------------------------------------------------------------------
-- Price sources: seed estimate, community report, pub website, checked by admin
-- ---------------------------------------------------------------------------
alter table public.drinks drop constraint if exists drinks_source_check;
alter table public.drinks add constraint drinks_source_check check (source in ('seed', 'community', 'website', 'admin'));
alter table public.drinks add column if not exists source_url text;
alter table public.drinks drop constraint if exists drinks_source_url_format;
alter table public.drinks add constraint drinks_source_url_format check (source_url is null or source_url ~ '^https?://[^\s]+$');

alter table public.price_reports drop constraint if exists price_reports_source_check;
alter table public.price_reports add constraint price_reports_source_check check (source in ('seed', 'community', 'website', 'admin'));
alter table public.price_reports add column if not exists source_url text;
alter table public.price_reports drop constraint if exists price_reports_source_url_format;
alter table public.price_reports add constraint price_reports_source_url_format check (source_url is null or source_url ~ '^https?://[^\s]+$');

-- ---------------------------------------------------------------------------
-- Visibility: hidden pubs (and their drinks, reports and photos) are admin-only
-- ---------------------------------------------------------------------------
create or replace function public.pub_is_visible(p_pub_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.pubs where id = p_pub_id and (is_published or public.is_admin()));
$$;
grant execute on function public.pub_is_visible(text) to anon, authenticated;

drop policy if exists "pubs are public" on public.pubs;
drop policy if exists "published pubs are public" on public.pubs;
create policy "published pubs are public" on public.pubs for select using (is_published or public.is_admin());

drop policy if exists "drinks are public" on public.drinks;
drop policy if exists "drinks of visible pubs" on public.drinks;
create policy "drinks of visible pubs" on public.drinks for select using (public.pub_is_visible(pub_id));

drop policy if exists "visible reports are public" on public.price_reports;
create policy "visible reports are public" on public.price_reports
  for select using ((not is_hidden or public.is_admin()) and public.pub_is_visible(pub_id));

drop policy if exists "visible photos are public" on public.pub_photos;
create policy "visible photos are public" on public.pub_photos
  for select using ((not is_hidden or public.is_admin()) and public.pub_is_visible(pub_id));

-- ---------------------------------------------------------------------------
-- Community reports: same rules as before, but not for hidden pubs, and they clear
-- any website link on the drink (the community price is now the latest).
-- ---------------------------------------------------------------------------
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
  if not public.pub_is_visible(p_pub_id) then
    raise exception 'Unknown pub';
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
    if char_length(v_name) < 2 or char_length(v_name) > 60 then
      raise exception 'Drink names must be 2-60 characters';
    end if;
    if p_category is null or p_category not in ('Lager', 'IPA', 'Pale Ale', 'Real Ale', 'Stout', 'Cider', 'Wheat Beer', 'Other') then
      raise exception 'Pick a valid category';
    end if;
    if v_measure not in ('pint', 'half', 'two-thirds', 'schooner') then
      raise exception 'Pick a valid measure';
    end if;
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
    set current_price = v_price, last_updated_at = v_report.reported_at, source = 'community', source_url = null
    where id = v_drink.id;

  return v_report;
end;
$$;

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
      set current_price = v_latest.price, last_updated_at = v_latest.reported_at,
          source = v_latest.source, source_url = v_latest.source_url
      where id = v_drink_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin editing
-- ---------------------------------------------------------------------------

-- Create or update a pub from a JSON object. uploads_paused and created_at are left alone.
create or replace function public.admin_save_pub(p_pub jsonb)
returns public.pubs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := btrim(coalesce(p_pub ->> 'id', ''));
  v_row public.pubs;
  v_constraint text;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if v_id !~ '^[a-z0-9-]{2,80}$' then
    raise exception 'Pub id must be 2-80 lowercase letters, numbers or dashes';
  end if;

  insert into public.pubs (id, name, address, area, lat, lng, opened_year, tags, description,
                           is_published, website, drinks_menu_url, operator, updated_at)
  values (
    v_id,
    btrim(coalesce(p_pub ->> 'name', '')),
    nullif(btrim(coalesce(p_pub ->> 'address', '')), ''),
    btrim(coalesce(p_pub ->> 'area', '')),
    nullif(p_pub ->> 'lat', '')::double precision,
    nullif(p_pub ->> 'lng', '')::double precision,
    nullif(p_pub ->> 'opened_year', '')::integer,
    coalesce(array(select btrim(t) from jsonb_array_elements_text(coalesce(p_pub -> 'tags', '[]'::jsonb)) t where btrim(t) <> ''), '{}'),
    coalesce(p_pub ->> 'description', ''),
    coalesce((p_pub ->> 'is_published')::boolean, false),
    nullif(btrim(coalesce(p_pub ->> 'website', '')), ''),
    nullif(btrim(coalesce(p_pub ->> 'drinks_menu_url', '')), ''),
    nullif(btrim(coalesce(p_pub ->> 'operator', '')), ''),
    now()
  )
  on conflict (id) do update set
    name = excluded.name, address = excluded.address, area = excluded.area,
    lat = excluded.lat, lng = excluded.lng, opened_year = excluded.opened_year,
    tags = excluded.tags, description = excluded.description, is_published = excluded.is_published,
    website = excluded.website, drinks_menu_url = excluded.drinks_menu_url, operator = excluded.operator,
    updated_at = now()
  returning * into v_row;

  insert into public.pub_admin (pub_id) values (v_id) on conflict (pub_id) do nothing;
  return v_row;
exception
  when check_violation or not_null_violation then
    get stacked diagnostics v_constraint = constraint_name;
    raise exception '%', case v_constraint
      when 'pubs_published_complete' then 'To publish a pub it needs an address and a map position (lat/lng). Save it hidden until then.'
      when 'pubs_website_format' then 'Website must start with http:// or https://'
      when 'pubs_menu_url_format' then 'Drinks menu link must start with http:// or https://'
      when 'pubs_name_check' then 'Pub name must be 2-100 characters'
      when 'pubs_area_check' then 'Area must be 2-40 characters'
      when 'pubs_address_check' then 'Address must be 5-200 characters'
      when 'pubs_opened_year_check' then 'Opening year must be between 1000 and 2100'
      when 'pubs_lat_check' then 'Latitude must be between -90 and 90'
      when 'pubs_lng_check' then 'Longitude must be between -180 and 180'
      else 'Some pub details are invalid (' || coalesce(v_constraint, sqlerrm) || ')'
    end;
  when invalid_text_representation then
    raise exception 'Latitude, longitude and opening year must be numbers';
end;
$$;

create or replace function public.admin_save_pub_admin(p_pub_id text, p_prices_online text, p_notes text, p_mark_checked boolean)
returns public.pub_admin
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pub_admin;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if coalesce(p_prices_online, 'unknown') not in ('yes', 'partial', 'no', 'unknown') then
    raise exception 'Prices online must be yes, partial, no or unknown';
  end if;
  if char_length(coalesce(p_notes, '')) > 4000 then
    raise exception 'Keep notes under 4000 characters';
  end if;
  insert into public.pub_admin (pub_id, prices_online, notes, prices_checked_at, updated_at)
  values (p_pub_id, coalesce(p_prices_online, 'unknown'), coalesce(p_notes, ''), case when p_mark_checked then now() end, now())
  on conflict (pub_id) do update set
    prices_online = excluded.prices_online,
    notes = excluded.notes,
    prices_checked_at = case when p_mark_checked then now() else public.pub_admin.prices_checked_at end,
    updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

-- Admin sets a price from the pub's website or from checking in person. Kept in the same
-- history as community reports, with its source (and link) recorded.
create or replace function public.admin_set_drink_price(
  p_pub_id text,
  p_drink_id uuid,
  p_drink_name text,
  p_category text,
  p_measure text,
  p_price numeric,
  p_source text,
  p_source_url text,
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
  v_price := round(p_price, 2);

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
    select * into v_drink from public.drinks
      where pub_id = p_pub_id and name_normalized = lower(v_name) and measure = v_measure
      for update;
    if not found then
      insert into public.drinks (pub_id, name, category, measure, current_price, source, source_url, last_updated_at)
      values (p_pub_id, v_name, p_category, v_measure, v_price, p_source, v_url, now())
      returning * into v_drink;
    end if;
  end if;

  insert into public.price_reports (pub_id, drink_id, drink_name, category, measure, price, note, reporter, source, source_url)
  values (p_pub_id, v_drink.id, v_drink.name, v_drink.category, v_drink.measure, v_price, v_note, v_uid, p_source, v_url)
  returning * into v_report;

  update public.drinks
    set current_price = v_price, last_updated_at = v_report.reported_at, source = p_source, source_url = v_url
    where id = v_drink.id;

  return v_report;
end;
$$;

create or replace function public.admin_update_drink(p_drink_id uuid, p_name text, p_category text, p_measure text)
returns public.drinks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.drinks;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  update public.drinks
    set name = btrim(regexp_replace(p_name, '\s+', ' ', 'g')), category = p_category, measure = p_measure
    where id = p_drink_id
    returning * into v_row;
  if not found then
    raise exception 'Drink not found';
  end if;
  return v_row;
exception
  when check_violation then
    raise exception 'Check the drink name (2-60 characters), category and measure';
  when unique_violation then
    raise exception 'This pub already lists a drink with that name and measure';
end;
$$;

create or replace function public.admin_delete_drink(p_drink_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  delete from public.drinks where id = p_drink_id;
end;
$$;

revoke execute on function public.admin_save_pub(jsonb) from public, anon;
grant execute on function public.admin_save_pub(jsonb) to authenticated;
revoke execute on function public.admin_save_pub_admin(text, text, text, boolean) from public, anon;
grant execute on function public.admin_save_pub_admin(text, text, text, boolean) to authenticated;
revoke execute on function public.admin_set_drink_price(text, uuid, text, text, text, numeric, text, text, text) from public, anon;
grant execute on function public.admin_set_drink_price(text, uuid, text, text, text, numeric, text, text, text) to authenticated;
revoke execute on function public.admin_update_drink(uuid, text, text, text) from public, anon;
grant execute on function public.admin_update_drink(uuid, text, text, text) to authenticated;
revoke execute on function public.admin_delete_drink(uuid) from public, anon;
grant execute on function public.admin_delete_drink(uuid) to authenticated;
