-- Kje je kos, posodobitev 1: stranke si same ustvarijo račun in delavnico (30 dni preizkusa),
-- sodelavci se pridružijo s kodo delavnice. Zaženi enkrat v Supabase: SQL Editor → New query → Run.

alter table public.workshops add column if not exists trial_until timestamptz default (now() + interval '30 days');
alter table public.workshops add column if not exists invite_code text;
update public.workshops set invite_code = upper(substr(md5(random()::text || id::text), 1, 6)) where invite_code is null;
alter table public.workshops alter column invite_code set default upper(substr(md5(random()::text), 1, 6));
create unique index if not exists workshops_invite_code on public.workshops(invite_code);
alter table public.workshops alter column active set default false;   -- nove delavnice začnejo s preizkusom

-- dostop ima, kdor je član delavnice s plačano naročnino ali veljavnim preizkusom
create or replace function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members m join workshops w on w.id = m.workshop_id
                 where m.user_id = auth.uid() and m.workshop_id = ws
                   and (w.active or coalesce(w.trial_until, now()) > now()));
$$;

-- nova delavnica za prijavljenega uporabnika (postane vodja)
create or replace function public.create_workshop(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare wid uuid;
begin
  if auth.uid() is null then raise exception 'Ni prijave'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'Račun je že povezan z delavnico'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Vpiši ime delavnice'; end if;
  insert into workshops(name, active) values (left(trim(p_name), 80), false) returning id into wid;
  insert into members(user_id, workshop_id, role) values (auth.uid(), wid, 'vodja');
  return wid;
end $$;

-- pridružitev obstoječi delavnici s kodo
create or replace function public.join_workshop(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare wid uuid;
begin
  if auth.uid() is null then raise exception 'Ni prijave'; end if;
  select id into wid from workshops where invite_code = upper(trim(p_code));
  if wid is null then raise exception 'Napačna koda'; end if;
  insert into members(user_id, workshop_id, role) values (auth.uid(), wid, 'delavec') on conflict do nothing;
  return wid;
end $$;

revoke all on function public.create_workshop(text) from public, anon;
revoke all on function public.join_workshop(text) from public, anon;
grant execute on function public.create_workshop(text) to authenticated;
grant execute on function public.join_workshop(text) to authenticated;

-- Mizarstvo Stajl ostane aktivna brez omejitve preizkusa
update public.workshops set active = true where name = 'Mizarstvo Stajl';
