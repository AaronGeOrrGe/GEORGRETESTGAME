delete from public.resources
where category::text in ('Tutorials', 'Projects', 'Lab Manuals');

alter table public.resources
  alter column category type text using category::text;

drop type public.resource_category;
create type public.resource_category as enum ('Lecture Notes', 'Past Questions', 'Assignments');

alter table public.resources
  alter column category type public.resource_category
  using category::public.resource_category;

create type public.timetable_kind as enum ('class', 'exam');

create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  kind public.timetable_kind not null,
  course_code text not null,
  course_name text not null,
  department text not null check (department in ('Computer Science', 'Information Technology', 'Cyber Security')),
  level integer not null check (level in (100, 200, 300, 400)),
  day_of_week integer check (day_of_week between 1 and 7),
  exam_date date,
  start_time time not null,
  end_time time not null,
  venue text not null default '',
  lecturer text not null default '',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint valid_timetable_schedule check (
    (kind = 'class' and day_of_week is not null and exam_date is null)
    or (kind = 'exam' and exam_date is not null and day_of_week is null)
  ),
  constraint valid_timetable_time check (end_time > start_time)
);

create index timetable_cohort_idx on public.timetable_entries(department, level, kind);
create index timetable_exam_date_idx on public.timetable_entries(exam_date) where kind = 'exam';

alter table public.timetable_entries enable row level security;

create policy "cohort timetable readable" on public.timetable_entries
for select to authenticated
using (department = public.current_department() and level = public.current_level());

create policy "cohort reps insert timetable" on public.timetable_entries
for insert to authenticated
with check (created_by = auth.uid() and public.is_course_rep_for(department, level));

create policy "cohort reps update timetable" on public.timetable_entries
for update to authenticated
using (public.is_course_rep_for(department, level))
with check (public.is_course_rep_for(department, level));

create policy "cohort reps delete timetable" on public.timetable_entries
for delete to authenticated
using (public.is_course_rep_for(department, level));
