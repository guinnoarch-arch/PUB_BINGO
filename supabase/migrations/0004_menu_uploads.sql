-- Pub Bingo 0004: PDF drinks menus uploaded by admins (used to import prices).
-- Run after 0003 (safe to re-run).

-- Files: public read (so a price's "Pub website" badge can link to the menu it came from),
-- admin-only upload and delete. PDFs only, 10 MB max.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menus', 'menus', true, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin menu uploads" on storage.objects;
create policy "admin menu uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'menus' and public.is_admin());

drop policy if exists "admin menu deletes" on storage.objects;
create policy "admin menu deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'menus' and public.is_admin());

-- A record of each uploaded menu, per pub.
create table if not exists public.menu_uploads (
  id uuid primary key default gen_random_uuid(),
  pub_id text not null references public.pubs (id) on delete cascade,
  storage_path text not null unique check (storage_path like pub_id || '/%'),
  file_name text not null check (char_length(file_name) between 1 and 200),
  uploaded_by uuid references public.profiles (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  prices_imported integer not null default 0 check (prices_imported >= 0)
);
create index if not exists menu_uploads_pub_idx on public.menu_uploads (pub_id, uploaded_at desc);

alter table public.menu_uploads enable row level security;
drop policy if exists "admins manage menu uploads" on public.menu_uploads;
create policy "admins manage menu uploads" on public.menu_uploads
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin() and uploaded_by = auth.uid());
revoke all on public.menu_uploads from anon, authenticated;
grant select, insert, update, delete on public.menu_uploads to authenticated;
