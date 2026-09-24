-- Pub Bingo 0006: suggestions box (like Guinness & Holley Budgeting).
-- Signed-in users post suggestions and vote; everyone can read them; admins set a status and reply.
-- Run after 0005 (safe to re-run).

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references public.profiles (id) on delete set null,
  category text not null default 'idea' check (category in ('idea', 'pub', 'problem', 'other')),
  message text not null check (char_length(message) between 3 and 1000),
  status text not null default 'new' check (status in ('new', 'reviewed', 'planned', 'in_progress', 'done', 'rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists suggestions_created_idx on public.suggestions (created_at desc);

create table if not exists public.suggestion_votes (
  suggestion_id uuid not null references public.suggestions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (suggestion_id, user_id)
);

-- All reads and writes go through the functions below.
alter table public.suggestions enable row level security;
alter table public.suggestion_votes enable row level security;
revoke all on public.suggestions, public.suggestion_votes from anon, authenticated;

create or replace function public.submit_suggestion(p_category text, p_message text)
returns public.suggestions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_message text := btrim(regexp_replace(coalesce(p_message, ''), '[ \t]+', ' ', 'g'));
  v_row public.suggestions;
begin
  if v_uid is null then
    raise exception 'Sign in to send a suggestion' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Your account has no profile yet';
  end if;
  if char_length(v_message) < 3 then
    raise exception 'Write a bit more first';
  end if;
  if char_length(v_message) > 1000 then
    raise exception 'Keep it under 1000 characters';
  end if;
  if coalesce(p_category, 'idea') not in ('idea', 'pub', 'problem', 'other') then
    raise exception 'Pick a type';
  end if;
  if (select count(*) from public.suggestions where submitted_by = v_uid and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'You''ve sent a lot of suggestions in the last hour. Try again later';
  end if;
  insert into public.suggestions (submitted_by, category, message)
  values (v_uid, coalesce(p_category, 'idea'), v_message)
  returning * into v_row;
  return v_row;
end;
$$;

-- Everyone (even signed out) can read the list; usernames only, never emails.
create or replace function public.list_suggestions()
returns table (
  id uuid, category text, message text, status text, admin_note text, username text,
  created_at timestamptz, updated_at timestamptz, up_votes integer, down_votes integer, my_vote integer, is_mine boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.category, s.message, s.status, s.admin_note, p.username,
         s.created_at, s.updated_at,
         coalesce(sum(case when v.vote = 1 then 1 else 0 end), 0)::integer,
         coalesce(sum(case when v.vote = -1 then 1 else 0 end), 0)::integer,
         coalesce((select mv.vote::integer from public.suggestion_votes mv where mv.suggestion_id = s.id and mv.user_id = auth.uid()), 0),
         coalesce(s.submitted_by = auth.uid(), false)
  from public.suggestions s
  left join public.profiles p on p.id = s.submitted_by
  left join public.suggestion_votes v on v.suggestion_id = s.id
  group by s.id, p.username
  order by coalesce(sum(v.vote), 0) desc, s.created_at desc
  limit 300;
$$;

-- p_vote: 1 = up, -1 = down, 0 = remove my vote.
create or replace function public.vote_suggestion(p_suggestion_id uuid, p_vote integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to vote' using errcode = '28000';
  end if;
  if p_vote not in (-1, 0, 1) then
    raise exception 'Invalid vote';
  end if;
  if not exists (select 1 from public.suggestions where id = p_suggestion_id) then
    raise exception 'Suggestion not found';
  end if;
  if p_vote = 0 then
    delete from public.suggestion_votes where suggestion_id = p_suggestion_id and user_id = auth.uid();
  else
    insert into public.suggestion_votes (suggestion_id, user_id, vote)
    values (p_suggestion_id, auth.uid(), p_vote)
    on conflict (suggestion_id, user_id) do update set vote = excluded.vote;
  end if;
end;
$$;

create or replace function public.admin_update_suggestion(p_suggestion_id uuid, p_status text, p_admin_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_status not in ('new', 'reviewed', 'planned', 'in_progress', 'done', 'rejected') then
    raise exception 'Pick a valid status';
  end if;
  if char_length(coalesce(p_admin_note, '')) > 1000 then
    raise exception 'Keep the reply under 1000 characters';
  end if;
  update public.suggestions
    set status = p_status, admin_note = nullif(btrim(coalesce(p_admin_note, '')), ''),
        reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    where id = p_suggestion_id;
  if not found then
    raise exception 'Suggestion not found';
  end if;
end;
$$;

create or replace function public.admin_delete_suggestion(p_suggestion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  delete from public.suggestions where id = p_suggestion_id;
end;
$$;

revoke execute on function public.submit_suggestion(text, text) from public, anon;
grant execute on function public.submit_suggestion(text, text) to authenticated;
grant execute on function public.list_suggestions() to anon, authenticated;
revoke execute on function public.vote_suggestion(uuid, integer) from public, anon;
grant execute on function public.vote_suggestion(uuid, integer) to authenticated;
revoke execute on function public.admin_update_suggestion(uuid, text, text) from public, anon;
grant execute on function public.admin_update_suggestion(uuid, text, text) to authenticated;
revoke execute on function public.admin_delete_suggestion(uuid) from public, anon;
grant execute on function public.admin_delete_suggestion(uuid) to authenticated;
