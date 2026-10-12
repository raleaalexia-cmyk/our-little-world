-- Starter schema: each user's rows are private to that account.
-- Shared two-account workspaces require a couple_members membership model.
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
create index if not exists bucket_items_user_created_idx on public.bucket_items(user_id, completed, created_at);
alter table public.bucket_items enable row level security;
create policy "Users can view their own bucket items" on public.bucket_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their own bucket items" on public.bucket_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own bucket items" on public.bucket_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own bucket items" on public.bucket_items for delete to authenticated using ((select auth.uid()) = user_id);
create table if not exists public.couple_notes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 3000),
  updated_at timestamptz not null default now()
);
alter table public.couple_notes enable row level security;
create policy "Users can view their own note" on public.couple_notes for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own note" on public.couple_notes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own note" on public.couple_notes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);