-- Kje je kos: baza za več delavnic. Vsaka delavnica vidi samo svoje projekte in skene.
-- Zaženi v Supabase: SQL Editor → New query → prilepi vse → Run.

create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,        -- false = naročnina potekla, dostop zaklenjen
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  user_id uuid not null references auth.users(id) on delete cascade,
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  role text not null default 'delavec',         -- 'vodja' ali 'delavec'
  primary key (user_id, workshop_id)
);

create table if not exists public.projects (
  id text primary key,
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  name text not null,
  program text,
  created_at bigint,
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.scans (
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  project_id text not null,
  code text not null,
  at bigint,
  primary key (project_id, code)
);

-- ali je prijavljeni uporabnik član aktivne delavnice
create or replace function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members m join workshops w on w.id = m.workshop_id
                 where m.user_id = auth.uid() and m.workshop_id = ws and w.active);
$$;

alter table public.workshops enable row level security;
alter table public.members enable row level security;
alter table public.projects enable row level security;
alter table public.scans enable row level security;

drop policy if exists "svoja delavnica" on public.workshops;
create policy "svoja delavnica" on public.workshops for select to authenticated using (public.is_member(id));
drop policy if exists "svoje članstvo" on public.members;
create policy "svoje članstvo" on public.members for select to authenticated using (user_id = auth.uid());
drop policy if exists "projekti delavnice" on public.projects;
create policy "projekti delavnice" on public.projects for all to authenticated using (public.is_member(workshop_id)) with check (public.is_member(workshop_id));
drop policy if exists "skeni delavnice" on public.scans;
create policy "skeni delavnice" on public.scans for all to authenticated using (public.is_member(workshop_id)) with check (public.is_member(workshop_id));

-- sprotno osveževanje na vseh napravah
do $$ begin
  begin alter publication supabase_realtime add table public.projects; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.scans; exception when duplicate_object then null; end;
end $$;

-- ===== Nova delavnica (za vsako stranko enkrat) =====
-- 1) Authentication → Users → Add user: e-naslov in geslo stranke (Auto Confirm User).
-- 2) Spodaj vpiši ime delavnice in e-naslov ter zaženi samo ta del:
--
-- with w as (insert into public.workshops(name) values ('Mizarstvo Stajl') returning id)
-- insert into public.members(user_id, workshop_id, role)
-- select u.id, w.id, 'vodja' from auth.users u, w where u.email = 'vas@email.si';
--
-- Zaklep ob neplačani naročnini:  update public.workshops set active = false where name = 'Ime delavnice';

-- Po tej datoteki zaženi še posodobitev-1.sql (samostojna registracija delavnic, koda za sodelavce).
