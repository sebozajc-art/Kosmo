-- Kosmo posodobitev 4: opravila z rokom (taski)
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  project_id text,
  title text not null,
  note text,
  due date,
  urgent boolean not null default false,
  assignee text,
  done boolean not null default false,
  done_at bigint,
  created_at bigint not null default (extract(epoch from now())*1000)::bigint,
  created_by text
);
create index if not exists tasks_ws on public.tasks(workshop_id, done, due);
alter table public.tasks enable row level security;
drop policy if exists "opravila delavnice" on public.tasks;
create policy "opravila delavnice" on public.tasks for all to authenticated
  using (public.is_member(workshop_id)) with check (public.is_member(workshop_id));
grant select, insert, update, delete on public.tasks to authenticated;
do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when others then null; end $$;
