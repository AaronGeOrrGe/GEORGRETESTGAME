alter table public.profiles
  add column if not exists level integer not null default 100;

alter table public.resources
  add column if not exists level integer not null default 100;

alter table public.announcements
  add column if not exists level integer not null default 100;

alter table public.profiles
  add constraint profiles_level_check check (level in (100, 200, 300, 400)) not valid;

alter table public.resources
  add constraint resources_level_check check (level in (100, 200, 300, 400)) not valid;

alter table public.announcements
  add constraint announcements_level_check check (level in (100, 200, 300, 400)) not valid;

create or replace function public.current_level()
returns integer language sql stable security definer set search_path = public as $$
  select level from public.profiles where id = auth.uid();
$$;

create or replace function public.is_course_rep_for(target_department text, target_level integer)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'course_rep'
      and department = target_department
      and level = target_level
  );
$$;

drop policy if exists "users update own identity" on public.profiles;
drop policy if exists "department resources readable" on public.resources;
drop policy if exists "department reps insert resources" on public.resources;
drop policy if exists "department reps update resources" on public.resources;
drop policy if exists "department reps delete resources" on public.resources;
drop policy if exists "department announcements readable" on public.announcements;
drop policy if exists "department reps insert announcements" on public.announcements;
drop policy if exists "department reps update announcements" on public.announcements;
drop policy if exists "department reps delete announcements" on public.announcements;

create policy "users update own identity" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and role = (select p.role from public.profiles p where p.id = auth.uid())
  and department = (select p.department from public.profiles p where p.id = auth.uid())
  and level = (select p.level from public.profiles p where p.id = auth.uid())
);

create policy "cohort resources readable" on public.resources
for select to authenticated
using (department = public.current_department() and level = public.current_level());

create policy "cohort reps insert resources" on public.resources
for insert to authenticated
with check (uploaded_by = auth.uid() and public.is_course_rep_for(department, level));

create policy "cohort reps update resources" on public.resources
for update to authenticated
using (public.is_course_rep_for(department, level))
with check (public.is_course_rep_for(department, level));

create policy "cohort reps delete resources" on public.resources
for delete to authenticated
using (public.is_course_rep_for(department, level));

create policy "cohort announcements readable" on public.announcements
for select to authenticated
using (department = public.current_department() and level = public.current_level());

create policy "cohort reps insert announcements" on public.announcements
for insert to authenticated
with check (created_by = auth.uid() and public.is_course_rep_for(department, level));

create policy "cohort reps update announcements" on public.announcements
for update to authenticated
using (public.is_course_rep_for(department, level))
with check (public.is_course_rep_for(department, level));

create policy "cohort reps delete announcements" on public.announcements
for delete to authenticated
using (public.is_course_rep_for(department, level));

create index if not exists resources_cohort_idx on public.resources(department, level);
create index if not exists announcements_cohort_idx on public.announcements(department, level);
create index if not exists profiles_cohort_idx on public.profiles(department, level);
