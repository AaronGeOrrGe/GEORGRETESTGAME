alter table public.courses
  add column if not exists level integer not null default 100,
  add column if not exists created_by uuid references public.profiles(id) on delete restrict;

alter table public.courses
  add constraint courses_level_check check (level in (100, 200, 300, 400)) not valid;

alter table public.courses drop constraint if exists courses_code_key;
alter table public.courses
  add constraint courses_cohort_code_unique unique (department, level, code);

alter table public.resources
  add column if not exists course_id uuid references public.courses(id) on delete restrict,
  add column if not exists file_size bigint not null default 0 check (file_size >= 0);

update public.resources r
set course_id = c.id
from public.courses c
where r.course_id is null
  and c.code = r.course_code
  and c.department = r.department
  and c.level = r.level;

create or replace function public.enforce_course_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.courses where department = new.department and level = new.level) >= 11 then
    raise exception 'A department and level can have a maximum of 11 courses.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_course_limit_trigger on public.courses;
create trigger enforce_course_limit_trigger
before insert on public.courses
for each row execute function public.enforce_course_limit();

drop policy if exists "courses readable" on public.courses;
drop policy if exists "reps manage courses" on public.courses;

create policy "cohort courses readable" on public.courses
for select to authenticated
using (department = public.current_department() and level = public.current_level());

create policy "cohort reps insert courses" on public.courses
for insert to authenticated
with check (created_by = auth.uid() and public.is_course_rep_for(department, level));

create policy "cohort reps update courses" on public.courses
for update to authenticated
using (public.is_course_rep_for(department, level))
with check (public.is_course_rep_for(department, level));

create policy "cohort reps delete courses" on public.courses
for delete to authenticated
using (public.is_course_rep_for(department, level));

create index if not exists courses_cohort_idx on public.courses(department, level);
create index if not exists resources_course_idx on public.resources(course_id);
