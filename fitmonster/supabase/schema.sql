-- FitMonster: tabelas do clã online. Cole TUDO no Supabase > SQL Editor > Run.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Guerreiro',
  level int not null default 1,
  xp int not null default 0,
  streak int not null default 0,
  gym text,
  invite_code text unique not null default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  updated_at timestamptz not null default now()
);

create table if not exists public.friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;

-- Cada pessoa vê o próprio perfil e o dos amigos; edita só o seu.
create policy "perfil: ver o seu e o dos amigos" on public.profiles for select to authenticated
  using (id = auth.uid() or exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = profiles.id));
create policy "perfil: editar o seu" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "amizades: ver as suas" on public.friendships for select to authenticated
  using (user_id = auth.uid());

grant select, update on public.profiles to authenticated;
grant select on public.friendships to authenticated;

-- Cria o perfil automaticamente quando alguém cria a conta.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), 'Guerreiro'));
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Adicionar amigo por código de convite (a amizade vale nos dois sentidos).
create or replace function public.add_friend_by_code(code text) returns text
language plpgsql security definer set search_path = public as $$
declare f uuid; fname text;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta primeiro'; end if;
  select id, name into f, fname from public.profiles where invite_code = upper(trim(code));
  if f is null then raise exception 'Código não encontrado'; end if;
  if f = auth.uid() then raise exception 'Esse é o seu próprio código'; end if;
  insert into public.friendships (user_id, friend_id) values (auth.uid(), f), (f, auth.uid()) on conflict do nothing;
  return fname;
end; $$;
revoke all on function public.add_friend_by_code(text) from public, anon;
grant execute on function public.add_friend_by_code(text) to authenticated;
