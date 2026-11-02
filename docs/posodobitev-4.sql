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
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tasks' and policyname='opravila delavnice') then
    create policy "opravila delavnice" on public.tasks for all to authenticated
      using (public.is_member(workshop_id)) with check (public.is_member(workshop_id));
  end if;
end $$;
grant select, insert, update, delete on public.tasks to authenticated;
do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when others then null; end $$;

-- ura in trajanje opravila (časovnica dneva)
alter table public.tasks add column if not exists at_time text;
alter table public.tasks add column if not exists dur_min int;
