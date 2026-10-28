-- Paraty Waters · avisos no celular pelo app ntfy (cadastro novo e e-mail confirmado)
create extension if not exists pg_net with schema extensions;

create table if not exists public.app_config (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

-- envia um aviso para o canal configurado (não faz nada se não houver canal)
create or replace function public.avisar(titulo text, mensagem text) returns void
language plpgsql security definer set search_path = '' as $$
declare canal text;
begin
  select value into canal from public.app_config where key = 'ntfy_topic';
  if canal is null or canal !~ '^[A-Za-z0-9_-]{8,64}$' then return; end if;
  perform net.http_post(
    url := 'https://ntfy.sh/',
    body := jsonb_build_object('topic', canal, 'title', 'Paraty Waters · ' || titulo, 'message', coalesce(mensagem, ' '), 'priority', 4),
    headers := '{"Content-Type": "application/json"}'::jsonb);
exception when others then
  return;  -- aviso nunca pode atrapalhar o cadastro
end $$;
revoke all on function public.avisar(text, text) from public, anon, authenticated;

create or replace function public.aviso_cadastro() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.avisar('🆕 Novo cadastro', coalesce(new.raw_user_meta_data ->> 'nome', '') || ' · ' || new.email);
  elsif old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform public.avisar('✅ E-mail confirmado', coalesce(new.raw_user_meta_data ->> 'nome', '') || ' · ' || new.email);
  end if;
  return new;
end $$;
drop trigger if exists aviso_cadastro on auth.users;
create trigger aviso_cadastro after insert or update of email_confirmed_at on auth.users
  for each row execute function public.aviso_cadastro();

-- painel: ver e trocar o canal (só administrador)
create or replace function public.admin_ntfy() returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Acesso restrito'; end if;
  return (select value from public.app_config where key = 'ntfy_topic');
end $$;
revoke all on function public.admin_ntfy() from public, anon;
grant execute on function public.admin_ntfy() to authenticated;

create or replace function public.admin_ntfy_salvar(canal text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Acesso restrito'; end if;
  if canal is null or canal = '' then
    delete from public.app_config where key = 'ntfy_topic';
    return;
  end if;
  if canal !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'Nome de canal inválido'; end if;
  insert into public.app_config (key, value) values ('ntfy_topic', canal)
  on conflict (key) do update set value = excluded.value, updated_at = now();
  perform public.avisar('🔔 Avisos ativados', 'Você vai receber cada cadastro novo e cada e-mail confirmado.');
end $$;
revoke all on function public.admin_ntfy_salvar(text) from public, anon;
grant execute on function public.admin_ntfy_salvar(text) to authenticated;

-- o canal é definido pelo painel de administração (não fica no código, que é público)
