-- Our Little World: secure two-account setup.
-- IMPORTANT: Before running, replace REPLACE_WITH_A_PRIVATE_CODE_YOU_CHOOSE with a private code of at least 16 characters.
-- Enter that same code only while creating the two accounts. Do not publish the chosen code.

create extension if not exists pgcrypto with schema extensions;

-- The app supports exactly two membership slots: her and him.
create table if not exists public.couple_settings (
  id boolean primary key default true check (id = true),
  setup_code_hash text not null,
  created_at timestamptz not null default now()
);
insert into public.couple_settings (id, setup_code_hash)
values (true, extensions.crypt('REPLACE_WITH_A_PRIVATE_CODE_YOU_CHOOSE', extensions.gen_salt('bf')))
on conflict (id) do nothing;

create table if not exists public.couple_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile text not null unique check (profile in ('her','him')),
  created_at timestamptz not null default now()
);
alter table public.couple_members enable row level security;
drop policy if exists "Members can view their own membership" on public.couple_members;
create policy "Members can view their own membership" on public.couple_members
for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.couple_settings from public, anon, authenticated;
revoke all on public.couple_members from public, anon, authenticated;
grant select on public.couple_members to authenticated;

-- Security-definer helpers avoid recursive row-level security checks.
create or replace function public.is_couple_member()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.couple_members where user_id = (select auth.uid()));
$$;
revoke all on function public.is_couple_member() from public, anon;
grant execute on function public.is_couple_member() to authenticated;

-- Safe status only: this exposes occupied slots, never account emails or the setup-code hash.
create or replace function public.get_couple_status()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'her_taken', exists(select 1 from public.couple_members where profile = 'her'),
    'him_taken', exists(select 1 from public.couple_members where profile = 'him'),
    'complete', (select count(*) >= 2 from public.couple_members)
  );
$$;
revoke all on function public.get_couple_status() from public;
grant execute on function public.get_couple_status() to anon, authenticated;

create or replace function public.get_my_couple_profile()
returns text
language sql stable security definer
set search_path = public
as $$
  select profile from public.couple_members where user_id = (select auth.uid()) limit 1;
$$;
revoke all on function public.get_my_couple_profile() from public, anon;
grant execute on function public.get_my_couple_profile() to authenticated;

-- A valid code and an authenticated Supabase user are both required to claim a slot.
-- Unique constraints enforce at most one account for each role, so there can never be a third member.
create or replace function public.claim_couple_account(p_setup_code text, p_profile text)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_existing text;
begin
  if (select auth.uid()) is null then
    raise exception 'Please sign in before completing account setup.';
  end if;

  select profile into v_existing
  from public.couple_members
  where user_id = (select auth.uid());

  if v_existing is not null then
    return v_existing;
  end if;

  if p_profile is null or p_profile not in ('her','him') then
    raise exception 'Choose either the her or him profile.';
  end if;

  select setup_code_hash into v_hash
  from public.couple_settings
  where id = true
  for update;

  if v_hash is null or p_setup_code is null or extensions.crypt(p_setup_code, v_hash) <> v_hash then
    raise exception 'The private couple setup code is incorrect.';
  end if;

  if exists(select 1 from public.couple_members where profile = p_profile) then
    raise exception 'That profile already has an account. Each profile can be registered only once.';
  end if;

  begin
    insert into public.couple_members(user_id, profile)
    values ((select auth.uid()), p_profile);
  exception when unique_violation then
    raise exception 'That profile or account has already been registered. Only the two original accounts are allowed.';
  end;

  return p_profile;
end;
$$;
revoke all on function public.claim_couple_account(text,text) from public, anon;
grant execute on function public.claim_couple_account(text,text) to authenticated;

-- Shared bucket list. user_id identifies who originally added an item; both members may see and manage all items.
create table if not exists public.bucket_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 400),
  category text not null default 'little' check (category in ('date','travel','food','adventure','little')),
  priority text not null default 'someday' check (priority in ('someday','soon','must')),
  dream_date date,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.bucket_items enable row level security;
drop policy if exists "Users can view their own bucket items" on public.bucket_items;
drop policy if exists "Users can create their own bucket items" on public.bucket_items;
drop policy if exists "Users can update their own bucket items" on public.bucket_items;
drop policy if exists "Users can delete their own bucket items" on public.bucket_items;
drop policy if exists "Couple members can view the shared bucket list" on public.bucket_items;
drop policy if exists "Couple members can add to the shared bucket list" on public.bucket_items;
drop policy if exists "Couple members can update the shared bucket list" on public.bucket_items;
drop policy if exists "Couple members can delete from the shared bucket list" on public.bucket_items;
create policy "Couple members can view the shared bucket list" on public.bucket_items
for select to authenticated using (public.is_couple_member());
create policy "Couple members can add to the shared bucket list" on public.bucket_items
for insert to authenticated with check (public.is_couple_member() and user_id = (select auth.uid()));
create policy "Couple members can update the shared bucket list" on public.bucket_items
for update to authenticated using (public.is_couple_member()) with check (public.is_couple_member());
create policy "Couple members can delete from the shared bucket list" on public.bucket_items
for delete to authenticated using (public.is_couple_member());
create index if not exists bucket_items_completed_created_idx on public.bucket_items(completed, created_at);

-- Custom folders and metadata for the private cloud photo album.
create table if not exists public.couple_photo_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 32),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists couple_photo_folders_name_lower_uidx on public.couple_photo_folders(lower(name));
alter table public.couple_photo_folders enable row level security;
drop policy if exists "Couple members can view photo folders" on public.couple_photo_folders;
drop policy if exists "Couple members can create photo folders" on public.couple_photo_folders;
drop policy if exists "Couple members can delete photo folders" on public.couple_photo_folders;
create policy "Couple members can view photo folders" on public.couple_photo_folders
for select to authenticated using (public.is_couple_member());
create policy "Couple members can create photo folders" on public.couple_photo_folders
for insert to authenticated with check (public.is_couple_member() and created_by = (select auth.uid()));
create policy "Couple members can delete photo folders" on public.couple_photo_folders
for delete to authenticated using (public.is_couple_member());

create table if not exists public.couple_photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  name text not null,
  folder text not null default 'Us',
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.couple_photos enable row level security;
drop policy if exists "Couple members can view photos" on public.couple_photos;
drop policy if exists "Couple members can add photos" on public.couple_photos;
drop policy if exists "Couple members can delete photos" on public.couple_photos;
create policy "Couple members can view photos" on public.couple_photos
for select to authenticated using (public.is_couple_member());
create policy "Couple members can add photos" on public.couple_photos
for insert to authenticated with check (public.is_couple_member() and uploaded_by = (select auth.uid()));
create policy "Couple members can delete photos" on public.couple_photos
for delete to authenticated using (public.is_couple_member());
create index if not exists couple_photos_folder_created_idx on public.couple_photos(folder, created_at desc);

-- Private storage bucket for trip and couple photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('couple-photos','couple-photos',false,15728640,array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'])
on conflict (id) do update set public = false, file_size_limit = 15728640;

drop policy if exists "Couple members can view shared photos" on storage.objects;
drop policy if exists "Couple members can upload shared photos" on storage.objects;
drop policy if exists "Couple members can delete shared photos" on storage.objects;
create policy "Couple members can view shared photos" on storage.objects
for select to authenticated using (bucket_id = 'couple-photos' and public.is_couple_member());
create policy "Couple members can upload shared photos" on storage.objects
for insert to authenticated with check (bucket_id = 'couple-photos' and public.is_couple_member());
create policy "Couple members can delete shared photos" on storage.objects
for delete to authenticated using (bucket_id = 'couple-photos' and public.is_couple_member());

-- Old note table, if present, is intentionally unused by this version of the website.
