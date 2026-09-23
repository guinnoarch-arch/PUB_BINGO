-- Pub Bingo 0003: What's on (events) and extra feature tags.
-- Run after 0002 (safe to re-run). Then re-run supabase/seed.sql to add the researched events.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  pub_id text not null references public.pubs (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 100),
  category text not null check (category in ('live-music', 'sports', 'quiz', 'comedy', 'sing-along', 'open-mic', 'tap-takeover', 'food', 'other')),
  description text not null default '' check (char_length(description) <= 500),
  -- weekly: repeats on weekdays (0 = Sunday .. 6 = Saturday) at London local times.
  -- one-off: a single date (e.g. a match) in London local time.
  schedule text not null check (schedule in ('weekly', 'one-off')),
  weekdays smallint[] not null default '{}',
  event_date date,
  start_time time,
  end_time time,
  source text not null default 'admin' check (source in ('website', 'admin', 'research')),
  source_url text check (source_url is null or source_url ~ '^https?://[^\s]+$'),
  is_published boolean not null default false,
  checked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pub_id, title),
  constraint events_weekly_days check (
    schedule <> 'weekly' or (cardinality(weekdays) between 1 and 7 and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
  ),
  constraint events_one_off_date check (schedule <> 'one-off' or event_date is not null)
);
create index if not exists events_pub_idx on public.events (pub_id);
create index if not exists events_date_idx on public.events (event_date) where schedule = 'one-off';

alter table public.events enable row level security;
drop policy if exists "published events of visible pubs" on public.events;
create policy "published events of visible pubs" on public.events
  for select using ((is_published and public.pub_is_visible(pub_id)) or public.is_admin());
revoke insert, update, delete on public.events from anon, authenticated;
grant select on public.events to anon, authenticated;

-- Create or update an event from JSON (id present = update).
create or replace function public.admin_save_event(p_event jsonb)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(p_event ->> 'id', '')::uuid;
  v_row public.events;
  v_constraint text;
  v_days smallint[] := coalesce(array(select (d)::smallint from jsonb_array_elements_text(coalesce(p_event -> 'weekdays', '[]'::jsonb)) d order by 1), '{}');
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  if v_id is null then
    insert into public.events (pub_id, title, category, description, schedule, weekdays, event_date, start_time, end_time,
                               source, source_url, is_published, checked_at, created_by)
    values (
      p_event ->> 'pub_id',
      btrim(coalesce(p_event ->> 'title', '')),
      p_event ->> 'category',
      coalesce(p_event ->> 'description', ''),
      coalesce(p_event ->> 'schedule', 'weekly'),
      v_days,
      nullif(p_event ->> 'event_date', '')::date,
      nullif(p_event ->> 'start_time', '')::time,
      nullif(p_event ->> 'end_time', '')::time,
      coalesce(nullif(p_event ->> 'source', ''), 'admin'),
      nullif(btrim(coalesce(p_event ->> 'source_url', '')), ''),
      coalesce((p_event ->> 'is_published')::boolean, false),
      case when coalesce((p_event ->> 'is_published')::boolean, false) then now() end,
      auth.uid()
    )
    returning * into v_row;
  else
    update public.events set
      title = btrim(coalesce(p_event ->> 'title', '')),
      category = p_event ->> 'category',
      description = coalesce(p_event ->> 'description', ''),
      schedule = coalesce(p_event ->> 'schedule', 'weekly'),
      weekdays = v_days,
      event_date = nullif(p_event ->> 'event_date', '')::date,
      start_time = nullif(p_event ->> 'start_time', '')::time,
      end_time = nullif(p_event ->> 'end_time', '')::time,
      source = coalesce(nullif(p_event ->> 'source', ''), source),
      source_url = nullif(btrim(coalesce(p_event ->> 'source_url', '')), ''),
      is_published = coalesce((p_event ->> 'is_published')::boolean, false),
      checked_at = case when coalesce((p_event ->> 'is_published')::boolean, false) and not is_published then now() else checked_at end,
      updated_at = now()
    where id = v_id
    returning * into v_row;
    if not found then
      raise exception 'Event not found';
    end if;
  end if;
  return v_row;
exception
  when check_violation or not_null_violation or foreign_key_violation then
    get stacked diagnostics v_constraint = constraint_name;
    raise exception '%', case v_constraint
      when 'events_title_check' then 'Event title must be 2-100 characters'
      when 'events_category_check' then 'Pick an event type'
      when 'events_weekly_days' then 'Pick at least one day of the week'
      when 'events_one_off_date' then 'Pick a date for a one-off event'
      when 'events_source_url_check' then 'Link must start with http:// or https://'
      when 'events_description_check' then 'Keep the description under 500 characters'
      when 'events_pub_id_fkey' then 'Unknown pub'
      else 'Some event details are invalid (' || coalesce(v_constraint, sqlerrm) || ')'
    end;
  when unique_violation then
    raise exception 'This pub already has an event with that title';
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
    raise exception 'Check the date and times';
end;
$$;

create or replace function public.admin_delete_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  delete from public.events where id = p_event_id;
end;
$$;

revoke execute on function public.admin_save_event(jsonb) from public, anon;
grant execute on function public.admin_save_event(jsonb) to authenticated;
revoke execute on function public.admin_delete_event(uuid) from public, anon;
grant execute on function public.admin_delete_event(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- One-off data updates for databases seeded before 0003 (safe to re-run).
-- ---------------------------------------------------------------------------
update public.pubs set tags = array(select distinct unnest(tags || array['sports-tv'])) where id = 'the-porterhouse';
update public.pubs set tags = array(select distinct unnest(tags || array['sing-along'])) where id = 'the-coach-and-horses';
update public.pubs set tags = array(select distinct unnest(tags || array['live-music', 'comedy'])) where id = 'the-blue-posts-berwick-street';
update public.pubs set tags = array(select distinct unnest(tags || array['quiz-night'])) where id = 'the-craft-beer-co-holborn';

-- Current Porterhouse drinks menu (Spring 2026), replacing none or the older 2024 menu.
update public.pubs
  set drinks_menu_url = 'https://porterhouse.london/wp-content/uploads/2026/04/QR-Code-Drinks-Menu-Spring-2026-Version-2.pdf'
  where id = 'the-porterhouse'
    and (drinks_menu_url is null or drinks_menu_url like '%/2024/%');

update public.pub_admin
  set prices_online = 'yes',
      notes = notes || E'\n\n[Sep 2026 research] Publishes PDF drinks menus WITH PRICES. Current: Spring 2026 v2 (https://porterhouse.london/wp-content/uploads/2026/04/QR-Code-Drinks-Menu-Spring-2026-Version-2.pdf); prices still to be entered. '
        || 'Older Oct 2024 menu for comparison: Temple Lager £6.60, Yippy IPA £6.80, Oyster Stout £6.80, Budvar £6.90 a pint. '
        || 'Events: https://porterhouse.london/events/ . Sport: 18 screens, on Fanzo https://www.fanzo.com/en/bar/248658/the-porterhouse',
      updated_at = now()
  where pub_id = 'the-porterhouse' and position('[Sep 2026 research]' in notes) = 0;

update public.pub_admin
  set notes = notes || E'\n\n[Sep 2026 research] OWNER UNCLEAR: sources disagree (Greene King vs Fuller''s). Piano sing-along Wed & Sat.',
      updated_at = now()
  where pub_id = 'the-coach-and-horses' and position('[Sep 2026 research]' in notes) = 0;

-- Live updates for events too.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'events') then
    alter publication supabase_realtime add table public.events;
  end if;
end;
$$;
