-- Kosmo posodobitev 3: kdo je skeniral + povezava za ogled pri stranki
alter table public.scans add column if not exists by_user uuid default auth.uid();
alter table public.scans add column if not exists by_name text;

alter table public.projects add column if not exists share_token text;
create unique index if not exists projects_share_token on public.projects(share_token) where share_token is not null;

-- ogled brez prijave: vrne samo projekt z ustreznim (dolgim, naključnim) žetonom
create or replace function public.get_shared_project(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', p.name, 'program', p.program, 'workshop', w.name,
           'data', p.data - 'hw' - 'hwN')
  from projects p join workshops w on w.id = p.workshop_id
  where p_token is not null and length(p_token) >= 20 and p.share_token = p_token
    and (w.active or coalesce(w.trial_until, now()) > now());
$$;
revoke all on function public.get_shared_project(text) from public;
grant execute on function public.get_shared_project(text) to anon, authenticated;
