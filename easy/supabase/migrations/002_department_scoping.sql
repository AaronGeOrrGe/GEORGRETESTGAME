alter table public.announcements
  add column if not exists department text;

update public.announcements a
set department = coalesce(
  (select p.department from public.profiles p where p.id = a.created_by),
  'Computer Science'
)
where department is null;

alter table public.announcements
  alter column department set not null;

alter table public.profiles
  add constraint profiles_department_check
  check (department in ('Computer Science', 'Information Technology', 'Cyber Security')) not valid;

alter table public.resources
  add constraint resources_department_check
  check (department in ('Computer Science', 'Information Technology', 'Cyber Security')) not valid;

alter table public.announcements
  add constraint announcements_department_check
  check (department in ('Computer Science', 'Information Technology', 'Cyber Security')) not valid;

create or replace function public.current_department()
returns text language sql stable security definer set search_path = public as $$
  select department from public.profiles where id = auth.uid();
$$;

create or replace function public.is_course_rep_for(target_department text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'course_rep'
      and department = target_department
  );
$$;

drop policy if exists "authenticated profiles readable" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "resources readable" on public.resources;
drop policy if exists "reps insert resources" on public.resources;
drop policy if exists "reps update resources" on public.resources;
drop policy if exists "reps delete resources" on public.resources;
drop policy if exists "announcements readable" on public.announcements;
drop policy if exists "reps insert announcements" on public.announcements;
drop policy if exists "reps update announcements" on public.announcements;
drop policy if exists "reps delete announcements" on public.announcements;

create policy "users read own profile" on public.profiles
for select to authenticated using (id = auth.uid());

create policy "users update own identity" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and role = (select p.role from public.profiles p where p.id = auth.uid())
  and department = (select p.department from public.profiles p where p.id = auth.uid())
);

create policy "department resources readable" on public.resources
for select to authenticated using (department = public.current_department());

create policy "department reps insert resources" on public.resources
for insert to authenticated
with check (uploaded_by = auth.uid() and public.is_course_rep_for(department));

create policy "department reps update resources" on public.resources
for update to authenticated
using (public.is_course_rep_for(department))
with check (public.is_course_rep_for(department));

create policy "department reps delete resources" on public.resources
for delete to authenticated using (public.is_course_rep_for(department));

create policy "department announcements readable" on public.announcements
for select to authenticated using (department = public.current_department());

create policy "department reps insert announcements" on public.announcements
for insert to authenticated
with check (created_by = auth.uid() and public.is_course_rep_for(department));

create policy "department reps update announcements" on public.announcements
for update to authenticated
using (public.is_course_rep_for(department))
with check (public.is_course_rep_for(department));

create policy "department reps delete announcements" on public.announcements
for delete to authenticated using (public.is_course_rep_for(department));

create index if not exists resources_department_idx on public.resources(department);
create index if not exists announcements_department_idx on public.announcements(department);
