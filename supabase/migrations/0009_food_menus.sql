-- Pub Bingo 0009: food menu links, plus the 25 Sep 2026 research pass (menus and events).
-- Run after 0008 (safe to re-run). Then re-run supabase/seed.sql: it fills in food menu links, adds the
-- new researched events (unpublished until an admin checks them) and appends the new research notes.
-- If you ever re-run 0002_pub_admin.sql, run this one again after it (it replaces admin_save_pub).

-- ---------------------------------------------------------------------------
-- Pubs: a link to the food menu, shown on the pub page next to the drinks menu.
-- ---------------------------------------------------------------------------
alter table public.pubs add column if not exists food_menu_url text;
alter table public.pubs drop constraint if exists pubs_food_menu_url_format;
alter table public.pubs add constraint pubs_food_menu_url_format check (food_menu_url is null or food_menu_url ~ '^https?://[^\s]+$');

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
                           is_published, website, drinks_menu_url, food_menu_url, operator, updated_at)
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
    nullif(btrim(coalesce(p_pub ->> 'food_menu_url', '')), ''),
    nullif(btrim(coalesce(p_pub ->> 'operator', '')), ''),
    now()
  )
  on conflict (id) do update set
    name = excluded.name, address = excluded.address, area = excluded.area,
    lat = excluded.lat, lng = excluded.lng, opened_year = excluded.opened_year,
    tags = excluded.tags, description = excluded.description, is_published = excluded.is_published,
    website = excluded.website, drinks_menu_url = excluded.drinks_menu_url, food_menu_url = excluded.food_menu_url, operator = excluded.operator,
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
      when 'pubs_food_menu_url_format' then 'Food menu link must start with http:// or https://'
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

revoke execute on function public.admin_save_pub(jsonb) from public, anon;
grant execute on function public.admin_save_pub(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Research (25 Sep 2026): feature tags found for existing pubs (only adds, never removes).
-- ---------------------------------------------------------------------------
update public.pubs set tags = array(select distinct unnest(tags || array['food'])) where id = 'the-french-house';
update public.pubs set tags = array(select distinct unnest(tags || array['food'])) where id = 'the-coach-and-horses';
update public.pubs set tags = array(select distinct unnest(tags || array['live-music'])) where id = 'the-toucan';
update public.pubs set tags = array(select distinct unnest(tags || array['food'])) where id = 'the-coal-hole';
update public.pubs set tags = array(select distinct unnest(tags || array['food'])) where id = 'the-cross-keys';
update public.pubs set tags = array(select distinct unnest(tags || array['live-music'])) where id = 'the-ship-tavern';
update public.pubs set tags = array(select distinct unnest(tags || array['food', 'live-music'])) where id = 'lamb-and-flag';
update public.pubs set tags = array(select distinct unnest(tags || array['food'])) where id = 'the-porterhouse';
update public.pubs set tags = array(select distinct unnest(tags || array['food', 'sports-tv'])) where id = 'the-punch-and-judy';
update public.pubs set tags = array(select distinct unnest(tags || array['food'])) where id = 'the-salisbury';

-- Blue Posts music nights start at 7pm (only fills a blank time).
update public.events
  set start_time = '19:00', description = 'Tuesday: open mic, blues and jazz. Thursday: The Black Diamonds (blues and jazz).', updated_at = now()
  where pub_id = 'the-blue-posts-berwick-street' and title = 'Music night: open mic, blues and jazz' and start_time is null;
