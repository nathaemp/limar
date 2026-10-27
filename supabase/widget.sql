-- Limamar · números para o widget do iPhone (app Scriptable)
-- O widget não faz login: usa uma chave secreta que só o administrador vê no painel.

create or replace function public.widget_estatisticas(chave text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  certa text;
  hoje timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
begin
  select value into certa from public.app_config where key = 'widget_key';
  if certa is null or chave is null or char_length(chave) < 24 or chave <> certa then return null; end if;
  return jsonb_build_object(
    'ready', true,
    'updatedAt', now(),
    'online', (select count(*) from public.app_presence where last_seen > now() - interval '2 minutes'),
    'visitantes', jsonb_build_object(
      'day',  (select count(distinct visitor_id) from public.app_events where tipo = 'abrir' and at >= hoje),
      'week', (select count(distinct visitor_id) from public.app_events where tipo = 'abrir' and at >= now() - interval '7 days')),
    'ativos', jsonb_build_object(
      'day',  (select count(distinct user_id) from public.app_events where user_id is not null and at >= hoje),
      'week', (select count(distinct user_id) from public.app_events where user_id is not null and at >= now() - interval '7 days')),
    'cadastros', jsonb_build_object(
      'day',  (select count(*) from auth.users where created_at >= hoje),
      'week', (select count(*) from auth.users where created_at >= now() - interval '7 days')),
    'confirmados', jsonb_build_object(
      'day',  (select count(*) from auth.users where email_confirmed_at >= hoje),
      'week', (select count(*) from auth.users where email_confirmed_at >= now() - interval '7 days')),
    'cliques', jsonb_build_object(
      'day',  (select count(*) from public.app_events where tipo = 'clique' and at >= hoje),
      'week', (select count(*) from public.app_events where tipo = 'clique' and at >= now() - interval '7 days')),
    'usuarios', (select count(*) from auth.users));
end $$;
revoke all on function public.widget_estatisticas(text) from public;
grant execute on function public.widget_estatisticas(text) to anon, authenticated;

-- painel: mostra a chave do widget (cria na primeira vez; "nova" troca e desliga o widget antigo)
create or replace function public.admin_widget_chave(nova boolean default false) returns text
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  if not public.is_admin() then raise exception 'Acesso restrito'; end if;
  select value into k from public.app_config where key = 'widget_key';
  if k is null or nova then
    k := encode(extensions.gen_random_bytes(18), 'hex');
    insert into public.app_config (key, value) values ('widget_key', k)
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  return k;
end $$;
revoke all on function public.admin_widget_chave(boolean) from public, anon;
grant execute on function public.admin_widget_chave(boolean) to authenticated;

select 'ok' as widget;
