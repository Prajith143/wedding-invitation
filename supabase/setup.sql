-- Run this entire file in Supabase SQL Editor.
-- Create a Storage bucket named wedding-assets and make it PUBLIC.
-- Disable public sign-ups in Supabase Auth. Create your admin user manually in Authentication > Users.

create table if not exists public.invitation_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('image','audio')),
  file_path text not null,
  file_url text not null,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.invitation_settings (
  id integer primary key check (id = 1),
  title text default 'A Beautiful Beginning',
  subtitle text default 'You are cordially invited',
  open_label text default 'OPEN INVITATION',
  music_enabled boolean default true,
  loop boolean default true,
  updated_at timestamptz default now()
);

insert into public.invitation_settings (id) values (1) on conflict (id) do nothing;

alter table public.invitation_assets enable row level security;
alter table public.invitation_settings enable row level security;

drop policy if exists "Public can read published invitation assets" on public.invitation_assets;
create policy "Public can read published invitation assets"
on public.invitation_assets for select to anon, authenticated using (published = true);

drop policy if exists "Authenticated admins can manage assets" on public.invitation_assets;
create policy "Authenticated admins can manage assets"
on public.invitation_assets for all to authenticated using (true) with check (true);

drop policy if exists "Public can read invitation settings" on public.invitation_settings;
create policy "Public can read invitation settings"
on public.invitation_settings for select to anon, authenticated using (true);

drop policy if exists "Authenticated admins can manage settings" on public.invitation_settings;
create policy "Authenticated admins can manage settings"
on public.invitation_settings for all to authenticated using (true) with check (true);

-- Storage policies for the public wedding-assets bucket.
drop policy if exists "Public can view wedding assets" on storage.objects;
create policy "Public can view wedding assets"
on storage.objects for select to anon, authenticated
using (bucket_id = 'wedding-assets');

drop policy if exists "Authenticated users can upload wedding assets" on storage.objects;
create policy "Authenticated users can upload wedding assets"
on storage.objects for insert to authenticated
with check (bucket_id = 'wedding-assets');

drop policy if exists "Authenticated users can update wedding assets" on storage.objects;
create policy "Authenticated users can update wedding assets"
on storage.objects for update to authenticated
using (bucket_id = 'wedding-assets') with check (bucket_id = 'wedding-assets');

drop policy if exists "Authenticated users can delete wedding assets" on storage.objects;
create policy "Authenticated users can delete wedding assets"
on storage.objects for delete to authenticated
using (bucket_id = 'wedding-assets');