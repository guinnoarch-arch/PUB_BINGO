-- Pub Bingo 0005: bottles and cans (with their size), and removing The Rocket's estimates.
-- Run after 0004 (safe to re-run). Then re-run supabase/seed.sql to add The Rocket's real menu prices.

alter table public.drinks drop constraint if exists drinks_measure_check;
alter table public.drinks add constraint drinks_measure_check
  check (measure in ('pint', 'half', 'two-thirds', 'schooner', 'bottle', 'can'));
alter table public.drinks add column if not exists volume_ml integer;
alter table public.drinks drop constraint if exists drinks_volume_ml_check;
alter table public.drinks add constraint drinks_volume_ml_check check (volume_ml is null or volume_ml between 100 and 2000);

-- Same functions as 0002, now accepting bottle and can.
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
    if v_measure not in ('pint', 'half', 'two-thirds', 'schooner', 'bottle', 'can') then
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
    if v_measure not in ('pint', 'half', 'two-thirds', 'schooner', 'bottle', 'can') then
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

-- Edit a drink, now including its size (for bottles and cans).
drop function if exists public.admin_update_drink(uuid, text, text, text);
create or replace function public.admin_update_drink(p_drink_id uuid, p_name text, p_category text, p_measure text, p_volume_ml integer default null)
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
    set name = btrim(regexp_replace(p_name, '\s+', ' ', 'g')), category = p_category, measure = p_measure,
        volume_ml = case when p_measure in ('bottle', 'can') then p_volume_ml else null end
    where id = p_drink_id
    returning * into v_row;
  if not found then
    raise exception 'Drink not found';
  end if;
  return v_row;
exception
  when check_violation then
    raise exception 'Check the drink name (2-60 characters), category, measure and size (100-2000 ml)';
  when unique_violation then
    raise exception 'This pub already lists a drink with that name and measure';
end;
$$;
revoke execute on function public.admin_update_drink(uuid, text, text, text, integer) from public, anon;
grant execute on function public.admin_update_drink(uuid, text, text, text, integer) to authenticated;

-- The Rocket's starting estimates are replaced by real prices from its own menu (seed.sql).
-- Only estimates are removed; anything reported or checked is kept.
delete from public.drinks where pub_id = 'the-rocket' and source = 'seed';

-- If 0007 has been run, it replaced admin_set_drink_price with a version that also takes the date the
-- price was seen. Re-running this file must not bring the old one back alongside it.
do $$
begin
  if to_regprocedure('public.admin_set_drink_price(text, uuid, text, text, text, numeric, text, text, text, date)') is not null then
    drop function if exists public.admin_set_drink_price(text, uuid, text, text, text, numeric, text, text, text);
  end if;
end;
$$;
