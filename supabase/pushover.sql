-- Limamar · avisos pelo Pushover com som escolhido para cada tipo
-- (as chaves ficam só no banco; o painel nunca devolve as chaves para o navegador)

drop function if exists public.avisar(text, text);
create or replace function public.avisar(titulo text, mensagem text, tipo text default 'cadastro') returns bigint
language plpgsql security definer set search_path = '' as $$
declare canal text; pu text; pt text; som text; rid bigint;
begin
  select value into canal from public.app_config where key = 'ntfy_topic';
  if canal ~ '^[A-Za-z0-9_-]{8,64}$' then
    perform net.http_post(url := 'https://ntfy.sh/',
      body := jsonb_build_object('topic', canal, 'title', 'Limamar · ' || titulo, 'message', coalesce(mensagem, ' '), 'priority', 4),
      headers := '{"Content-Type": "application/json"}'::jsonb);
  end if;
  select value into pu from public.app_config where key = 'pushover_user';
  select value into pt from public.app_config where key = 'pushover_token';
  if pu is not null and pt is not null then
    select value into som from public.app_config where key = 'som_' || tipo;
    select net.http_post(url := 'https://api.pushover.net/1/messages.json',
      body := jsonb_build_object('token', pt, 'user', pu, 'title', 'Limamar · ' || titulo, 'message', coalesce(mensagem, ' '),
                                 'sound', coalesce(som, case tipo when 'cadastro' then 'tugboat' when 'confirmado' then 'magic' else 'pushover' end)),
      headers := '{"Content-Type": "application/json"}'::jsonb) into rid;
  end if;
  return rid;
exception when others then
  return null;  -- aviso nunca pode atrapalhar o cadastro
end $$;
revoke all on function public.avisar(text, text, text) from public, anon, authenticated;

create or replace function public.aviso_cadastro() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.avisar('🆕 Novo cadastro', coalesce(new.raw_user_meta_data ->> 'nome', '') || ' · ' || new.email, 'cadastro');
  elsif old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform public.avisar('✅ E-mail confirmado', coalesce(new.raw_user_meta_data ->> 'nome', '') || ' · ' || new.email, 'confirmado');
  end if;
  return new;
end $$;

-- painel: situação (sem devolver as chaves)
create or replace function public.admin_pushover() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Acesso restrito'; end if;
  return jsonb_build_object(
    'configurado', exists (select 1 from public.app_config where key = 'pushover_token')
                   and exists (select 1 from public.app_config where key = 'pushover_user'),
    'sons', coalesce((select jsonb_object_agg(substr(key, 5), value) from public.app_config where key like 'som\_%'), '{}'::jsonb));
end $$;
revoke all on function public.admin_pushover() from public, anon;
grant execute on function public.admin_pushover() to authenticated;

-- salva chaves (se vierem) e sons; manda um teste e devolve o número do envio
create or replace function public.admin_pushover_salvar(usuario text, token text, sons jsonb, teste text, desligar boolean default false) returns bigint
language plpgsql security definer set search_path = '' as $$
declare k text; v text;
begin
  if not public.is_admin() then raise exception 'Acesso restrito'; end if;
  if desligar then
    delete from public.app_config where key in ('pushover_user', 'pushover_token');
    return null;
  end if;
  if coalesce(usuario, '') <> '' then
    if usuario !~ '^[A-Za-z0-9]{25,40}$' then raise exception 'User Key inválida'; end if;
    insert into public.app_config (key, value) values ('pushover_user', usuario)
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  if coalesce(token, '') <> '' then
    if token !~ '^[A-Za-z0-9]{25,40}$' then raise exception 'API Token inválido'; end if;
    insert into public.app_config (key, value) values ('pushover_token', token)
    on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  if sons is not null and jsonb_typeof(sons) = 'object' then
    for k, v in select key, value #>> '{}' from jsonb_each(sons) loop
      if k in ('cadastro', 'confirmado') and v ~ '^[a-z0-9_-]{1,40}$' then
        insert into public.app_config (key, value) values ('som_' || k, v)
        on conflict (key) do update set value = excluded.value, updated_at = now();
      end if;
    end loop;
  end if;
  if not exists (select 1 from public.app_config where key = 'pushover_user')
     or not exists (select 1 from public.app_config where key = 'pushover_token') then
    raise exception 'Cole a User Key e a API Token do Pushover';
  end if;
  return public.avisar('🔔 Teste de som', 'Assim vai soar este tipo de aviso.', coalesce(teste, 'cadastro'));
end $$;
revoke all on function public.admin_pushover_salvar(text, text, jsonb, text, boolean) from public, anon;
grant execute on function public.admin_pushover_salvar(text, text, jsonb, text, boolean) to authenticated;

-- resultado do envio de teste (o Pushover aceitou ou recusou)
create or replace function public.admin_pushover_resultado(envio bigint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Acesso restrito'; end if;
  return (select jsonb_build_object('status', status_code, 'erro', coalesce(error_msg, case when status_code <> 200 then left(content, 300) end))
            from net._http_response where id = envio);
end $$;
revoke all on function public.admin_pushover_resultado(bigint) from public, anon;
grant execute on function public.admin_pushover_resultado(bigint) to authenticated;

select 'ok' as pushover;
