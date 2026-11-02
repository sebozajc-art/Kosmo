-- Kosmo posodobitev 2: seznam kosov za ponoven razrez (poškodovani kosi)
create table if not exists public.recuts (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  project_id text not null,
  code text,
  part_idx int,
  part jsonb not null default '{}'::jsonb,   -- ime, element, mere, material, robovi ob času prijave
  reason text,
  note text,
  photo text,                                 -- majhna JPEG slika (data URL)
  done boolean not null default false,
  created_at bigint not null default (extract(epoch from now())*1000)::bigint,
  created_by uuid default auth.uid()
);
create index if not exists recuts_project on public.recuts(project_id);
alter table public.recuts enable row level security;
drop policy if exists "razrez delavnice" on public.recuts;
create policy "razrez delavnice" on public.recuts for all to authenticated
  using (public.is_member(workshop_id)) with check (public.is_member(workshop_id));
grant select, insert, update, delete on public.recuts to authenticated;
do $$ begin
  alter publication supabase_realtime add table public.recuts;
exception when others then null; end $$;
