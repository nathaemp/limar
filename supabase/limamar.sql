-- Limamar · contas de usuário
-- Rodar uma vez no SQL Editor do projeto Supabase do Limamar.

-- 1. Perfil de cada usuário (criado sozinho quando a conta é criada)
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text check (char_length(nome) <= 80),
  funcao      text check (char_length(funcao) <= 40),
  barco       text check (char_length(barco) <= 80),
  avatar_url  text check (char_length(avatar_url) <= 500),
  cadastro_ok boolean not null default false,
  plano       text not null default 'gratis',      -- muda só pelo servidor (futuro: Kiwify)
  plano_ate   timestamptz,
  kiwify_id   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "ver o proprio perfil" on public.profiles;
create policy "ver o proprio perfil" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "editar o proprio perfil" on public.profiles;
create policy "editar o proprio perfil" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- o usuário só mexe nestes campos; plano e pagamento ficam fora do alcance dele
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (nome, funcao, barco, avatar_url, cadastro_ok) on public.profiles to authenticated;

create or replace function public.profiles_touch() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.profiles_touch();

create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'nome', ''), 80))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.novo_usuario();

-- 2. Excluir a própria conta (apaga o usuário; o perfil vai junto)
create or replace function public.excluir_minha_conta() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;

-- 3. Fotos de perfil: pasta pública só para leitura; cada um grava só na própria pasta
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "avatar: listar a propria pasta" on storage.objects;
create policy "avatar: listar a propria pasta" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "avatar: enviar na propria pasta" on storage.objects;
create policy "avatar: enviar na propria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "avatar: trocar na propria pasta" on storage.objects;
create policy "avatar: trocar na propria pasta" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "avatar: apagar na propria pasta" on storage.objects;
create policy "avatar: apagar na propria pasta" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
