-- Pub Bingo 0008: new features, each behind an on/off switch the admin controls (Admin → Features).
-- A feature that's off is hidden from the public, but admins can still use it to try it out.
-- Run after 0007 (safe to re-run). If you ever re-run an older migration, run this one again after it.

-- ---------------------------------------------------------------------------
-- Feature switches
-- ---------------------------------------------------------------------------
create table if not exists public.app_features (
  key text primary key check (key ~ '^[a-z0-9_]{2,40}$'),
  is_live boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
insert into public.app_features (key) values
  ('still_right'), ('needs_checking'), ('price_trends'), ('happy_hours'), ('pub_filters'),
  ('crawl_planner'), ('round_calculator'), ('trusted_reporters'), ('receipts'), ('weekly_bingo'),
  ('badges'), ('top_reporters'), ('check_ins'), ('guinness_score'), ('price_watch'),
  ('push_alerts'), ('email_digest'), ('chain_menus')
on conflict (key) do nothing;

alter table public.app_features enable row level security;
drop policy if exists "feature switches are public" on public.app_features;
create policy "feature switches are public" on public.app_features for select using (true);
revoke all on public.app_features from anon, authenticated;
grant select on public.app_features to anon, authenticated;

-- On for everyone, or for admins trying it out before launch.
create or replace function public.feature_on(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_live from public.app_features where key = p_key), false) or public.is_admin();
$$;

create or replace function public.admin_set_feature(p_key text, p_live boolean)
returns public.app_features
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.app_features;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_key in ('push_alerts', 'email_digest', 'chain_menus') and p_live then
    raise exception 'This feature needs setting up before it can be launched';
  end if;
  update public.app_features set is_live = coalesce(p_live, false), updated_at = now(), updated_by = auth.uid()
    where key = p_key returning * into v_row;
  if not found then
    raise exception 'Unknown feature';
  end if;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Price reports: "Still right?" confirmations, reports held for review, receipts
-- ---------------------------------------------------------------------------
alter table public.price_reports add column if not exists kind text not null default 'report';
alter table public.price_reports drop constraint if exists price_reports_kind_check;
alter table public.price_reports add constraint price_reports_kind_check check (kind in ('report', 'confirm'));
alter table public.price_reports add column if not exists held boolean not null default false;
alter table public.price_reports add column if not exists receipt_path text;
alter table public.price_reports drop constraint if exists price_reports_receipt_path_check;
alter table public.price_reports add constraint price_reports_receipt_path_check
  check (receipt_path is null or receipt_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$');

-- Reporters can see their own reports while they wait for review.
drop policy if exists "visible reports are public" on public.price_reports;
create policy "visible reports are public" on public.price_reports
  for select using (
    (not is_hidden or public.is_admin() or (held and reporter = auth.uid()))
    and public.pub_is_visible(pub_id)
  );

-- A reporter is trusted once 5 of their reports were matched by someone else (within 10p, within
-- 14 days) and none of their reports were hidden by an admin in the last 90 days. Admins are trusted.
create or replace function public.is_trusted_reporter(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = p_user_id), false)
    or (
      (select count(*) from public.price_reports r
        where r.reporter = p_user_id and r.source = 'community' and not r.is_hidden
          and exists (
            select 1 from public.price_reports o
            where o.drink_id = r.drink_id and o.id <> r.id and not o.is_hidden and o.source <> 'seed'
              and o.reporter is distinct from p_user_id
              and abs(o.price - r.price) <= 0.10
              and o.reported_at between r.reported_at - interval '14 days' and r.reported_at + interval '14 days'
          )) >= 5
      and not exists (
        select 1 from public.price_reports h
        where h.reporter = p_user_id and h.is_hidden and not h.held and h.source = 'community'
          and h.reported_at > now() - interval '90 days'
      )
    );
$$;

create or replace function public.trusted_usernames()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select p.username from public.profiles p
  where exists (select 1 from public.price_reports r where r.reporter = p.id and r.source = 'community')
    and public.is_trusted_reporter(p.id);
$$;

-- Same as 0005's version, plus: when "trusted_reporters" is live, a report more than 40% away from a
-- confirmed current price, from someone who isn't trusted yet, is held for an admin to review.
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
  v_existing boolean := true;
  v_hold boolean := false;
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
      v_existing := false;
      insert into public.drinks (pub_id, name, category, measure, current_price, source, last_updated_at)
      values (p_pub_id, v_name, p_category, v_measure, v_price, 'community', now())
      returning * into v_drink;
    end if;
  end if;

  if exists (select 1 from public.price_reports
             where reporter = v_uid and drink_id = v_drink.id and reported_at > now() - interval '10 minutes') then
    raise exception 'You reported this drink a few minutes ago';
  end if;

  v_hold := v_existing
    and coalesce((select is_live from public.app_features where key = 'trusted_reporters'), false)
    and v_drink.source <> 'seed'
    and v_drink.current_price > 0
    and abs(v_price - v_drink.current_price) / v_drink.current_price > 0.4
    and not public.is_trusted_reporter(v_uid);

  insert into public.price_reports (pub_id, drink_id, drink_name, category, measure, price, note, reporter, source, is_hidden, held)
  values (p_pub_id, v_drink.id, v_drink.name, v_drink.category, v_drink.measure, v_price, v_note, v_uid, 'community', v_hold, v_hold)
  returning * into v_report;

  if not v_hold then
    update public.drinks
      set current_price = v_price, last_updated_at = v_report.reported_at, source = 'community', source_url = null
      where id = v_drink.id;
  end if;

  return v_report;
end;
$$;

-- "Still right?": one tap to say the current price is still correct.
create or replace function public.confirm_price(p_drink_id uuid)
returns public.price_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_drink public.drinks;
  v_report public.price_reports;
begin
  if v_uid is null then
    raise exception 'Sign in to confirm a price' using errcode = '28000';
  end if;
  if not public.feature_on('still_right') then
    raise exception 'This feature isn''t available yet';
  end if;
  select * into v_drink from public.drinks where id = p_drink_id for update;
  if not found or not public.pub_is_visible(v_drink.pub_id) then
    raise exception 'Drink not found';
  end if;
  if (select count(*) from public.price_reports
      where reporter = v_uid and reported_at > now() - interval '1 hour') >= 20 then
    raise exception 'You have reported a lot of prices in the last hour. Try again later';
  end if;
  if exists (select 1 from public.price_reports
             where reporter = v_uid and drink_id = v_drink.id and reported_at > now() - interval '12 hours') then
    raise exception 'You''ve already checked this price today. Thanks!';
  end if;
  insert into public.price_reports (pub_id, drink_id, drink_name, category, measure, price, note, reporter, source, kind)
  values (v_drink.pub_id, v_drink.id, v_drink.name, v_drink.category, v_drink.measure, v_drink.current_price, 'Still right', v_uid, 'community', 'confirm')
  returning * into v_report;
  update public.drinks
    set last_updated_at = v_report.reported_at, source = 'community', source_url = null
    where id = v_drink.id;
  return v_report;
end;
$$;

-- Admins: approve (goes live, price updates) or reject (stays hidden) a held report.
create or replace function public.admin_review_held_report(p_report_id uuid, p_approve boolean)
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
  update public.price_reports set held = false, is_hidden = not coalesce(p_approve, false)
    where id = p_report_id and held
    returning drink_id into v_drink_id;
  if v_drink_id is null then
    raise exception 'That report isn''t waiting for review';
  end if;
  select * into v_latest from public.price_reports
    where drink_id = v_drink_id and not is_hidden order by reported_at desc limit 1;
  if found then
    update public.drinks
      set current_price = v_latest.price, last_updated_at = v_latest.reported_at, source = v_latest.source, source_url = v_latest.source_url
      where id = v_drink_id;
  end if;
end;
$$;

-- Receipts: private photos (only the reporter and admins can open them), attached within an hour of reporting.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "receipt uploads" on storage.objects;
create policy "receipt uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(objects.name))[1] = auth.uid()::text);
drop policy if exists "receipt reads" on storage.objects;
create policy "receipt reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (public.is_admin() or (storage.foldername(objects.name))[1] = auth.uid()::text));
drop policy if exists "receipt deletes" on storage.objects;
create policy "receipt deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (public.is_admin() or (storage.foldername(objects.name))[1] = auth.uid()::text));

create or replace function public.attach_receipt(p_report_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if not public.feature_on('receipts') then
    raise exception 'This feature isn''t available yet';
  end if;
  if p_path is null or p_path !~ ('^' || auth.uid()::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'Upload the receipt first';
  end if;
  update public.price_reports set receipt_path = p_path
    where id = p_report_id and reporter = auth.uid() and reported_at > now() - interval '1 hour';
  if not found then
    raise exception 'You can only add a receipt to your own report, within an hour';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard of reporters and personal stats (for badges)
-- ---------------------------------------------------------------------------
create or replace function public.community_stats(p_since timestamptz default null)
returns table (username text, reports integer, confirms integer, receipts integer, menus_used integer, trusted boolean)
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select reporter,
           count(*) filter (where kind = 'report')::integer as reports,
           count(*) filter (where kind = 'confirm')::integer as confirms,
           count(*) filter (where receipt_path is not null)::integer as receipts
    from public.price_reports
    where source = 'community' and not is_hidden and reporter is not null
      and (p_since is null or reported_at >= p_since)
    group by reporter
  ), m as (
    select submitted_by, count(*)::integer as menus_used
    from public.menu_submissions
    where status = 'used' and submitted_by is not null and (p_since is null or created_at >= p_since)
    group by submitted_by
  )
  select p.username, coalesce(r.reports, 0), coalesce(r.confirms, 0), coalesce(r.receipts, 0), coalesce(m.menus_used, 0),
         public.is_trusted_reporter(p.id)
  from public.profiles p
  left join r on r.reporter = p.id
  left join m on m.submitted_by = p.id
  where r.reporter is not null or m.submitted_by is not null
  order by coalesce(r.reports, 0) + coalesce(r.confirms, 0) + 3 * coalesce(m.menus_used, 0) desc, p.username
  limit 50;
$$;

-- ---------------------------------------------------------------------------
-- Happy hours / deals
-- ---------------------------------------------------------------------------
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  pub_id text not null references public.pubs (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  days smallint[] not null check (cardinality(days) between 1 and 7 and days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  start_time time not null,
  end_time time not null,
  drink_id uuid references public.drinks (id) on delete cascade,
  category text check (category is null or category in ('Lager', 'IPA', 'Pale Ale', 'Real Ale', 'Stout', 'Cider', 'Wheat Beer', 'Other')),
  deal_price numeric(5, 2) check (deal_price is null or deal_price between 1 and 25),
  discount_pct integer check (discount_pct is null or discount_pct between 5 and 75),
  source text not null default 'admin' check (source in ('website', 'admin', 'research')),
  source_url text check (source_url is null or source_url ~ '^https?://[^\s]+$'),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deals_has_price check ((deal_price is null) <> (discount_pct is null)),
  constraint deals_times check (start_time <> end_time)
);
create index if not exists deals_pub_idx on public.deals (pub_id);

alter table public.deals enable row level security;
drop policy if exists "published deals are public" on public.deals;
create policy "published deals are public" on public.deals
  for select using ((is_published or public.is_admin()) and public.pub_is_visible(pub_id));
revoke all on public.deals from anon, authenticated;
grant select on public.deals to anon, authenticated;

create or replace function public.admin_save_deal(p_deal jsonb)
returns public.deals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.deals;
  v_id uuid := nullif(p_deal ->> 'id', '')::uuid;
  v_days smallint[];
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct d::smallint order by d::smallint), '{}') into v_days
    from jsonb_array_elements_text(coalesce(p_deal -> 'days', '[]'::jsonb)) as d;
  if nullif(p_deal ->> 'drink_id', '') is not null and not exists (
    select 1 from public.drinks where id = (p_deal ->> 'drink_id')::uuid and pub_id = p_deal ->> 'pub_id'
  ) then
    raise exception 'That drink is not listed at this pub';
  end if;
  begin
    if v_id is null then
      insert into public.deals (pub_id, title, days, start_time, end_time, drink_id, category, deal_price, discount_pct, source, source_url, is_published)
      values (
        p_deal ->> 'pub_id', btrim(p_deal ->> 'title'), v_days, (p_deal ->> 'start_time')::time, (p_deal ->> 'end_time')::time,
        nullif(p_deal ->> 'drink_id', '')::uuid, nullif(p_deal ->> 'category', ''),
        nullif(p_deal ->> 'deal_price', '')::numeric, nullif(p_deal ->> 'discount_pct', '')::integer,
        coalesce(nullif(p_deal ->> 'source', ''), 'admin'), nullif(btrim(coalesce(p_deal ->> 'source_url', '')), ''),
        coalesce((p_deal ->> 'is_published')::boolean, false)
      ) returning * into v_row;
    else
      update public.deals set
        title = btrim(p_deal ->> 'title'), days = v_days,
        start_time = (p_deal ->> 'start_time')::time, end_time = (p_deal ->> 'end_time')::time,
        drink_id = nullif(p_deal ->> 'drink_id', '')::uuid, category = nullif(p_deal ->> 'category', ''),
        deal_price = nullif(p_deal ->> 'deal_price', '')::numeric, discount_pct = nullif(p_deal ->> 'discount_pct', '')::integer,
        source = coalesce(nullif(p_deal ->> 'source', ''), 'admin'), source_url = nullif(btrim(coalesce(p_deal ->> 'source_url', '')), ''),
        is_published = coalesce((p_deal ->> 'is_published')::boolean, false), updated_at = now()
      where id = v_id and pub_id = p_deal ->> 'pub_id'
      returning * into v_row;
      if not found then
        raise exception 'Deal not found';
      end if;
    end if;
  exception
    when check_violation then
      raise exception 'Check the deal: a title (3-80 characters), at least one day, different start and end times, and either a price (£1-£25) or a discount (5-75%%)';
    when invalid_datetime_format or invalid_text_representation then
      raise exception 'Check the times and numbers';
  end;
  return v_row;
end;
$$;

create or replace function public.admin_delete_deal(p_deal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  delete from public.deals where id = p_deal_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Opening hours: {"0": [["12:00", "22:30"]], "5": [["11:00", "01:00"]], ...} (0 = Sunday).
-- A closing time before the opening time means after midnight.
-- ---------------------------------------------------------------------------
alter table public.pubs add column if not exists opening_hours jsonb;

create or replace function public.admin_set_opening_hours(p_pub_id text, p_hours jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_ranges jsonb;
  v_range jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_hours is not null then
    if jsonb_typeof(p_hours) <> 'object' then
      raise exception 'Invalid opening hours';
    end if;
    for v_key, v_ranges in select * from jsonb_each(p_hours) loop
      if v_key !~ '^[0-6]$' or jsonb_typeof(v_ranges) <> 'array' or jsonb_array_length(v_ranges) > 3 then
        raise exception 'Invalid opening hours';
      end if;
      for v_range in select * from jsonb_array_elements(v_ranges) loop
        if jsonb_typeof(v_range) <> 'array' or jsonb_array_length(v_range) <> 2
           or (v_range ->> 0) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (v_range ->> 1) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
          raise exception 'Times must look like 11:00 or 23:30';
        end if;
      end loop;
    end loop;
  end if;
  update public.pubs set opening_hours = nullif(p_hours, '{}'::jsonb) where id = p_pub_id;
  if not found then
    raise exception 'Unknown pub';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Check-ins (pub passport, "busy now")
-- ---------------------------------------------------------------------------
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  pub_id text not null references public.pubs (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists checkins_user_idx on public.checkins (user_id, created_at desc);
create index if not exists checkins_pub_idx on public.checkins (pub_id, created_at desc);
alter table public.checkins enable row level security;
drop policy if exists "own checkins" on public.checkins;
create policy "own checkins" on public.checkins for select to authenticated using (user_id = auth.uid());
revoke all on public.checkins from anon, authenticated;
grant select on public.checkins to authenticated;

-- You need to be within 200 m of the pub (the app sends your location).
create or replace function public.check_in(p_pub_id text, p_lat double precision, p_lng double precision)
returns public.checkins
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pub public.pubs;
  v_metres double precision;
  v_row public.checkins;
begin
  if v_uid is null then
    raise exception 'Sign in to check in' using errcode = '28000';
  end if;
  if not public.feature_on('check_ins') then
    raise exception 'This feature isn''t available yet';
  end if;
  select * into v_pub from public.pubs where id = p_pub_id;
  if not found or not public.pub_is_visible(p_pub_id) or v_pub.lat is null then
    raise exception 'Unknown pub';
  end if;
  if p_lat is null or p_lng is null then
    raise exception 'Share your location to check in';
  end if;
  v_metres := 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(p_lat - v_pub.lat) / 2), 2)
    + cos(radians(v_pub.lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - v_pub.lng) / 2), 2)
  )));
  if v_metres > 200 then
    raise exception 'You need to be at the pub to check in (you look about % m away)', round(v_metres)::integer;
  end if;
  if exists (select 1 from public.checkins where user_id = v_uid and pub_id = p_pub_id and created_at > now() - interval '3 hours') then
    raise exception 'You''re already checked in here';
  end if;
  if (select count(*) from public.checkins where user_id = v_uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'That''s a lot of pubs for one day! Try again tomorrow';
  end if;
  insert into public.checkins (user_id, pub_id) values (v_uid, p_pub_id) returning * into v_row;
  return v_row;
end;
$$;

-- People checked in over the last 90 minutes, per pub (counts only, no names).
create or replace function public.pub_busy()
returns table (pub_id text, people integer)
language sql
stable
security definer
set search_path = public
as $$
  select c.pub_id, count(distinct c.user_id)::integer
  from public.checkins c
  where c.created_at > now() - interval '90 minutes' and public.pub_is_visible(c.pub_id)
  group by c.pub_id;
$$;

-- ---------------------------------------------------------------------------
-- Guinness score: rate the pour, 1-5, once per pub per day
-- ---------------------------------------------------------------------------
create table if not exists public.pour_ratings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  pub_id text not null references public.pubs (id) on delete cascade,
  rated_on date not null default ((now() at time zone 'Europe/London')::date),
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (user_id, pub_id, rated_on)
);
alter table public.pour_ratings enable row level security;
drop policy if exists "own pour ratings" on public.pour_ratings;
create policy "own pour ratings" on public.pour_ratings for select to authenticated using (user_id = auth.uid());
revoke all on public.pour_ratings from anon, authenticated;
grant select on public.pour_ratings to authenticated;

create or replace function public.rate_pour(p_pub_id text, p_rating integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to rate the pour' using errcode = '28000';
  end if;
  if not public.feature_on('guinness_score') then
    raise exception 'This feature isn''t available yet';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Pick 1 to 5';
  end if;
  if not public.pub_is_visible(p_pub_id)
     or not exists (select 1 from public.drinks where pub_id = p_pub_id and name_normalized like '%guinness%') then
    raise exception 'This pub doesn''t list Guinness';
  end if;
  insert into public.pour_ratings (user_id, pub_id, rating)
  values (auth.uid(), p_pub_id, p_rating)
  on conflict (user_id, pub_id, rated_on) do update set rating = excluded.rating, created_at = now();
end;
$$;

-- Average over the last 6 months.
create or replace function public.pour_scores()
returns table (pub_id text, score numeric, ratings integer)
language sql
stable
security definer
set search_path = public
as $$
  select r.pub_id, round(avg(r.rating), 1), count(*)::integer
  from public.pour_ratings r
  where r.created_at > now() - interval '180 days' and public.pub_is_visible(r.pub_id)
  group by r.pub_id;
$$;

-- ---------------------------------------------------------------------------
-- Price watches ("tell me when Guinness is under £6")
-- ---------------------------------------------------------------------------
create table if not exists public.price_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  query text not null check (char_length(query) between 2 and 60),
  max_price numeric(5, 2) not null check (max_price between 1 and 25),
  area text check (area is null or char_length(area) <= 40),
  created_at timestamptz not null default now()
);
create index if not exists price_watches_user_idx on public.price_watches (user_id);
alter table public.price_watches enable row level security;
drop policy if exists "own price watches" on public.price_watches;
create policy "own price watches" on public.price_watches for select to authenticated using (user_id = auth.uid());
drop policy if exists "delete own price watches" on public.price_watches;
create policy "delete own price watches" on public.price_watches for delete to authenticated using (user_id = auth.uid());
revoke all on public.price_watches from anon, authenticated;
grant select, delete on public.price_watches to authenticated;

create or replace function public.add_price_watch(p_query text, p_max_price numeric, p_area text)
returns public.price_watches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'));
  v_row public.price_watches;
begin
  if auth.uid() is null then
    raise exception 'Sign in to watch prices' using errcode = '28000';
  end if;
  if not public.feature_on('price_watch') then
    raise exception 'This feature isn''t available yet';
  end if;
  if char_length(v_query) < 2 or char_length(v_query) > 60 then
    raise exception 'Type a drink, like Guinness or IPA';
  end if;
  if p_max_price is null or p_max_price < 1 or p_max_price > 25 then
    raise exception 'Price must be between £1.00 and £25.00';
  end if;
  if (select count(*) from public.price_watches where user_id = auth.uid()) >= 10 then
    raise exception 'You can watch up to 10 prices. Remove one first';
  end if;
  insert into public.price_watches (user_id, query, max_price, area)
  values (auth.uid(), v_query, round(p_max_price, 2), nullif(btrim(coalesce(p_area, '')), ''))
  returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
grant execute on function public.feature_on(text) to anon, authenticated;
revoke execute on function public.admin_set_feature(text, boolean) from public, anon;
grant execute on function public.admin_set_feature(text, boolean) to authenticated;
grant execute on function public.is_trusted_reporter(uuid) to anon, authenticated;
grant execute on function public.trusted_usernames() to anon, authenticated;
revoke execute on function public.submit_price_report(text, uuid, text, text, text, numeric, text) from public, anon;
grant execute on function public.submit_price_report(text, uuid, text, text, text, numeric, text) to authenticated;
revoke execute on function public.confirm_price(uuid) from public, anon;
grant execute on function public.confirm_price(uuid) to authenticated;
revoke execute on function public.admin_review_held_report(uuid, boolean) from public, anon;
grant execute on function public.admin_review_held_report(uuid, boolean) to authenticated;
revoke execute on function public.attach_receipt(uuid, text) from public, anon;
grant execute on function public.attach_receipt(uuid, text) to authenticated;
grant execute on function public.community_stats(timestamptz) to anon, authenticated;
revoke execute on function public.admin_save_deal(jsonb) from public, anon;
grant execute on function public.admin_save_deal(jsonb) to authenticated;
revoke execute on function public.admin_delete_deal(uuid) from public, anon;
grant execute on function public.admin_delete_deal(uuid) to authenticated;
revoke execute on function public.admin_set_opening_hours(text, jsonb) from public, anon;
grant execute on function public.admin_set_opening_hours(text, jsonb) to authenticated;
revoke execute on function public.check_in(text, double precision, double precision) from public, anon;
grant execute on function public.check_in(text, double precision, double precision) to authenticated;
grant execute on function public.pub_busy() to anon, authenticated;
revoke execute on function public.rate_pour(text, integer) from public, anon;
grant execute on function public.rate_pour(text, integer) to authenticated;
grant execute on function public.pour_scores() to anon, authenticated;
revoke execute on function public.add_price_watch(text, numeric, text) from public, anon;
grant execute on function public.add_price_watch(text, numeric, text) to authenticated;

-- Live updates for switches and deals.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.app_features;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.deals;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;
