create extension if not exists pgcrypto;

create type public.user_role as enum ('student', 'course_rep');
create type public.resource_category as enum ('Lecture Notes', 'Past Questions', 'Assignments', 'Tutorials', 'Projects', 'Lab Manuals');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  student_id text not null unique,
  email text not null,
  role public.user_role not null default 'student',
  department text not null default '',
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  department text not null,
  created_at timestamptz not null default now()
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  course_code text not null,
  course_name text not null,
  department text not null,
  category public.resource_category not null,
  file_url text not null,
  storage_path text not null,
  downloads integer not null default 0 check (downloads >= 0),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, resource_id)
);

create index resources_search_idx on public.resources using gin (to_tsvector('english', title || ' ' || course_code || ' ' || course_name || ' ' || department));
create index resources_created_idx on public.resources(created_at desc);
create index announcements_created_idx on public.announcements(created_at desc);
create index favorites_user_idx on public.favorites(user_id);

create or replace function public.is_course_rep()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'course_rep');
$$;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.resources enable row level security;
alter table public.announcements enable row level security;
alter table public.favorites enable row level security;

create policy "authenticated profiles readable" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy "courses readable" on public.courses for select to authenticated using (true);
create policy "reps manage courses" on public.courses for all to authenticated using (public.is_course_rep()) with check (public.is_course_rep());
create policy "resources readable" on public.resources for select to authenticated using (true);
create policy "reps insert resources" on public.resources for insert to authenticated with check (public.is_course_rep() and uploaded_by = auth.uid());
create policy "reps update resources" on public.resources for update to authenticated using (public.is_course_rep()) with check (public.is_course_rep());
create policy "reps delete resources" on public.resources for delete to authenticated using (public.is_course_rep());
create policy "announcements readable" on public.announcements for select to authenticated using (true);
create policy "reps insert announcements" on public.announcements for insert to authenticated with check (public.is_course_rep() and created_by = auth.uid());
create policy "reps update announcements" on public.announcements for update to authenticated using (public.is_course_rep()) with check (public.is_course_rep());
create policy "reps delete announcements" on public.announcements for delete to authenticated using (public.is_course_rep());
create policy "users read own favorites" on public.favorites for select to authenticated using (user_id = auth.uid());
create policy "users add own favorites" on public.favorites for insert to authenticated with check (user_id = auth.uid());
create policy "users remove own favorites" on public.favorites for delete to authenticated using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resources', 'resources', false, 52428800, array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/zip'])
on conflict (id) do nothing;

create policy "authenticated download resources" on storage.objects for select to authenticated using (bucket_id = 'resources');
create policy "reps upload resources" on storage.objects for insert to authenticated with check (bucket_id = 'resources' and public.is_course_rep());
create policy "reps update resources files" on storage.objects for update to authenticated using (bucket_id = 'resources' and public.is_course_rep());
create policy "reps delete resources files" on storage.objects for delete to authenticated using (bucket_id = 'resources' and public.is_course_rep());

create or replace function public.increment_download(resource_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.resources set downloads = downloads + 1 where id = resource_id and auth.uid() is not null;
end;
$$;
