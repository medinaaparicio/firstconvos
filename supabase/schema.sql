-- firstconvos database schema
-- Paste this into the Supabase SQL editor and run it.

-- 1. Lessons: one row per letter, shared by everyone.
create table if not exists public.lessons (
  letter     text primary key,
  video_url  text,
  sort_order int
);

-- 2. Lesson progress: one row per (user, letter) the user has completed.
create table if not exists public.lesson_progress (
  user_id      uuid not null references auth.users (id) default auth.uid(),
  letter       text not null references public.lessons (letter),
  completed_at timestamptz not null default now(),
  primary key (user_id, letter)
);

-- 3. Turn on Row Level Security. Until policies exist, this denies all access.
alter table public.lessons          enable row level security;
alter table public.lesson_progress  enable row level security;

-- 4. Policies.

-- Any signed-in user can read the lesson list.
create policy "lessons are readable by authenticated users"
  on public.lessons
  for select
  to authenticated
  using (true);

-- A user can read only their own progress rows.
create policy "users can read their own progress"
  on public.lesson_progress
  for select
  to authenticated
  using (user_id = auth.uid());

-- A user can insert progress rows only for themselves.
create policy "users can insert their own progress"
  on public.lesson_progress
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- No update or delete policies: progress rows cannot be changed or removed by clients.

-- 5. Seed the four starter letters (must match STARTER_LETTERS in
--    src/recognition/samples.ts).
insert into public.lessons (letter, video_url, sort_order) values
  ('A', null, 1),
  ('B', null, 2),
  ('C', null, 3),
  ('T', null, 4)
on conflict (letter) do nothing;
