-- Limamar · área administrativa
-- Administradores, cortesias por e-mail, estatísticas de uso e gestão de usuários.
-- Tudo passa por funções que conferem se quem chama é administrador.

-- 1. Administradores ------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 2. Cortesias por e-mail (valem mesmo antes da pessoa criar a conta) ------------
create table if not exists public.cortesias (
  email      text primary key check (email = lower(email) and char_length(email) <= 200),
  ate        date,                      -- vazio = sem prazo
  nota       text check (char_length(nota) <= 200),
  created_at timestamptz not null default now(),
  created_by uuid
);
alter table public.cortesias enable row level security;
revoke all on public.cortesias from anon, authenticated;

-- plano que vale para o usuário logado (pago ou cortesia)
create or replace function public.meu_plano() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'plano', case when c.email is not null and (c.ate is null or c.ate >= (now() at time zone 'America/Sao_Paulo')::date)
                  then 'cortesia' else coalesce(p.plano, 'gratis') end,
    'ate', case when c.email is not null then c.ate::text else p.plano_ate::text end,
    'admin', exists (select 1 from public.admins a where a.user_id = auth.uid()))
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.cortesias c on c.email = lower(u.email)
  where u.id = auth.uid()
$$;
revoke all on function public.meu_plano() from public, anon;
grant execute on function public.meu_plano() to authenticated;

-- 3. Uso do app: eventos e quem está online -------------------------------------
create table if not exists public.app_events (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  visitor_id text not null,
  user_id    uuid,
  tipo       text not null,
  detalhe    text
);
create index if not exists app_events_at on public.app_events (at);
create index if not exists app_events_tipo_at on public.app_events (tipo, at);
create index if not exists app_events_visitor_at on public.app_events (visitor_id, at);
alter table public.app_events enable row level security;
revoke all on public.app_events from anon, authenticated;

create table if not exists public.app_presence (
  visitor_id text primary key,
  user_id    uuid,
  last_seen  timestamptz not null default now()
);
alter table public.app_presence enable row level security;
revoke all on public.app_presence from anon, authenticated;

-- o app manda os eventos em lote (até 50 por vez); valida tudo e limita abusos
create or replace function public.registrar_eventos(visitante text, eventos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare recentes int;
begin
  if visitante is null or char_length(visitante) not between 8 and 64 then return; end if;
  insert into public.app_presence (visitor_id, user_id, last_seen)
  values (visitante, auth.uid(), now())
  on conflict (visitor_id) do update set last_seen = now(), user_id = coalesce(auth.uid(), public.app_presence.user_id);
  if eventos is null or jsonb_typeof(eventos) <> 'array' then return; end if;
  select count(*) into recentes from public.app_events
   where visitor_id = visitante and at > now() - interval '1 hour';
  if recentes > 400 then return; end if;
  insert into public.app_events (at, visitor_id, user_id, tipo, detalhe)
  select case when (e ->> 'at') ~ '^\d{4}-\d{2}-\d{2}T'
               and (e ->> 'at')::timestamptz between now() - interval '7 days' and now() + interval '5 minutes'
              then (e ->> 'at')::timestamptz else now() end,
         visitante, auth.uid(), e ->> 'tipo', left(nullif(trim(e ->> 'detalhe'), ''), 80)
    from (select value as e from jsonb_array_elements(eventos) limit 50) x
   where e ->> 'tipo' in ('abrir', 'aba', 'clique', 'lugar', 'instalar', 'compartilhar');
  -- limpeza ocasional: guarda 1 ano de histórico
  if random() < 0.005 then
    delete from public.app_events where at < now() - interval '365 days';
    delete from public.app_presence where last_seen < now() - interval '30 days';
  end if;
end $$;
revoke all on function public.registrar_eventos(text, jsonb) from public;
grant execute on function public.registrar_eventos(text, jsonb) to anon, authenticated;

-- 4. Painel: estatísticas ------------------------------------------------------
create or replace function public.admin_estatisticas() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  hoje timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  r jsonb;
begin
  if not public.is_admin() then raise exception 'Acesso restrito'; end if;
  with per(nome, desde) as (values ('dia', hoje), ('semana', now() - interval '7 days'), ('mes', now() - interval '30 days'))
  select jsonb_build_object(
    'agora', now(),
    'online', (select count(*) from public.app_presence where last_seen > now() - interval '2 minutes'),
    'online_lista', coalesce((select jsonb_agg(jsonb_build_object('nome', coalesce(nullif(p.nome, ''), u.email), 'email', u.email, 'visto', pr.last_seen) order by pr.last_seen desc)
        from public.app_presence pr join auth.users u on u.id = pr.user_id left join public.profiles p on p.id = u.id
        where pr.last_seen > now() - interval '2 minutes'), '[]'::jsonb),
    'online_anonimos', (select count(*) from public.app_presence where last_seen > now() - interval '2 minutes' and user_id is null),
    'periodos', (select jsonb_object_agg(per.nome, jsonb_build_object(
        'visitantes',  (select count(distinct visitor_id) from public.app_events where tipo = 'abrir' and at >= per.desde),
        'aberturas',   (select count(*) from public.app_events where tipo = 'abrir' and at >= per.desde),
        'usuarios_ativos', (select count(distinct user_id) from public.app_events where user_id is not null and at >= per.desde),
        'cadastros',   (select count(*) from auth.users where created_at >= per.desde),
        'confirmados', (select count(*) from auth.users where email_confirmed_at >= per.desde),
        'cliques',     (select count(*) from public.app_events where tipo = 'clique' and at >= per.desde),
        'lugares',     (select count(*) from public.app_events where tipo = 'lugar' and at >= per.desde),
        'instalacoes', (select count(*) from public.app_events where tipo = 'instalar' and at >= per.desde),
        'compartilhamentos', (select count(*) from public.app_events where tipo = 'compartilhar' and at >= per.desde)))
      from per),
    'serie', (select jsonb_agg(jsonb_build_object('dia', d::date, 'visitantes', coalesce(v.vis, 0), 'aberturas', coalesce(v.ab, 0)) order by d)
        from generate_series((now() at time zone 'America/Sao_Paulo')::date - 13, (now() at time zone 'America/Sao_Paulo')::date, interval '1 day') d
        left join (select (at at time zone 'America/Sao_Paulo')::date dia, count(distinct visitor_id) vis, count(*) ab
                     from public.app_events where tipo = 'abrir' and at >= now() - interval '15 days' group by 1) v on v.dia = d::date),
    'top_cliques', coalesce((select jsonb_agg(jsonb_build_object('item', detalhe, 'n', n) order by n desc) from (
        select detalhe, count(*) n from public.app_events where tipo = 'clique' and at >= now() - interval '30 days' and detalhe is not null
        group by detalhe order by n desc limit 15) t), '[]'::jsonb),
    'top_abas', coalesce((select jsonb_agg(jsonb_build_object('item', detalhe, 'n', n) order by n desc) from (
        select detalhe, count(*) n from public.app_events where tipo = 'aba' and at >= now() - interval '30 days' and detalhe is not null
        group by detalhe order by n desc limit 10) t), '[]'::jsonb),
    'top_lugares', coalesce((select jsonb_agg(jsonb_build_object('item', detalhe, 'n', n) order by n desc) from (
        select detalhe, count(*) n from public.app_events where tipo = 'lugar' and at >= now() - interval '30 days' and detalhe is not null
        group by detalhe order by n desc limit 15) t), '[]'::jsonb),
    'totais', jsonb_build_object(
        'usuarios', (select count(*) from auth.users),
        'confirmados', (select count(*) from auth.users where email_confirmed_at is not null),
        'cadastro_ok', (select count(*) from public.profiles where cadastro_ok),
        'bloqueados', (select count(*) from auth.users where banned_until > now()),
        'cortesias', (select count(*) from public.cortesias where ate is null or ate >= (now() at time zone 'America/Sao_Paulo')::date))
  ) into r;
  return r;
end $$;
revoke all on function public.admin_estatisticas() from public, anon;
grant execute on function public.admin_estatisticas() to authenticated;

-- 5. Painel: usuários ----------------------------------------------------------
create or replace function public.admin_usuarios() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Acesso restrito'; end if;
  return coalesce((select jsonb_agg(x order by x ->> 'criado' desc) from (
    select jsonb_build_object(
      'id', u.id, 'email', u.email, 'nome', p.nome, 'funcao', p.funcao, 'barco', p.barco, 'foto', p.avatar_url,
      'criado', u.created_at, 'ultimo_login', u.last_sign_in_at, 'confirmado', u.email_confirmed_at is not null,
      'cadastro_ok', coalesce(p.cadastro_ok, false), 'plano', coalesce(p.plano, 'gratis'),
      'cortesia', c.email is not null and (c.ate is null or c.ate >= (now() at time zone 'America/Sao_Paulo')::date),
      'cortesia_ate', c.ate, 'bloqueado', coalesce(u.banned_until > now(), false),
      'admin', exists (select 1 from public.admins a where a.user_id = u.id),
      'online', exists (select 1 from public.app_presence pr where pr.user_id = u.id and pr.last_seen > now() - interval '2 minutes'),
      'visto', (select max(pr.last_seen) from public.app_presence pr where pr.user_id = u.id),
      'aberturas_30d', (select count(*) from public.app_events e where e.user_id = u.id and e.tipo = 'abrir' and e.at > now() - interval '30 days')
    ) x
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.cortesias c on c.email = lower(u.email)) t), '[]'::jsonb);
end $$;
revoke all on function public.admin_usuarios() from public, anon;
grant execute on function public.admin_usuarios() to authenticated;

create or replace function public.admin_bloquear(usuario uuid, bloquear boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Acesso restrito'; end if;
  if usuario = auth.uid() then raise exception 'Você não pode bloquear a própria conta'; end if;
  if exists (select 1 from public.admins where user_id = usuario) then raise exception 'Não dá para bloquear um administrador'; end if;
  update auth.users set banned_until = case when bloquear then 'infinity'::timestamptz else null end where id = usuario;
  if bloquear then delete from auth.sessions where user_id = usuario; end if;
end $$;
revoke all on function public.admin_bloquear(uuid, boolean) from public, anon;
grant execute on function public.admin_bloquear(uuid, boolean) to authenticated;

create or replace function public.admin_excluir_usuario(usuario uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Acesso restrito'; end if;
  if usuario = auth.uid() then raise exception 'Para excluir a própria conta, use Minha conta'; end if;
  if exists (select 1 from public.admins where user_id = usuario) then raise exception 'Não dá para excluir um administrador'; end if;
  delete from auth.users where id = usuario;
end $$;
revoke all on function public.admin_excluir_usuario(uuid) from public, anon;
grant execute on function public.admin_excluir_usuario(uuid) to authenticated;

-- 6. Painel: cortesias ---------------------------------------------------------
create or replace function public.admin_cortesias() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Acesso restrito'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'email', c.email, 'ate', c.ate, 'nota', c.nota, 'criada', c.created_at,
      'ativa', c.ate is null or c.ate >= (now() at time zone 'America/Sao_Paulo')::date,
      'tem_conta', exists (select 1 from auth.users u where lower(u.email) = c.email)) order by c.created_at desc)
    from public.cortesias c), '[]'::jsonb);
end $$;
revoke all on function public.admin_cortesias() from public, anon;
grant execute on function public.admin_cortesias() to authenticated;

create or replace function public.admin_cortesia_salvar(e_mail text, valida_ate date, observacao text) returns void
language plpgsql security definer set search_path = '' as $$
declare e text := lower(trim(e_mail));
begin
  if not public.is_admin() then raise exception 'Acesso restrito'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido'; end if;
  insert into public.cortesias (email, ate, nota, created_by)
  values (e, valida_ate, left(nullif(trim(observacao), ''), 200), auth.uid())
  on conflict (email) do update set ate = excluded.ate, nota = excluded.nota;
end $$;
revoke all on function public.admin_cortesia_salvar(text, date, text) from public, anon;
grant execute on function public.admin_cortesia_salvar(text, date, text) to authenticated;

create or replace function public.admin_cortesia_remover(e_mail text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Acesso restrito'; end if;
  delete from public.cortesias c where c.email = lower(trim(e_mail));
end $$;
revoke all on function public.admin_cortesia_remover(text) from public, anon;
grant execute on function public.admin_cortesia_remover(text) to authenticated;

-- 7. Administrador pode apagar a foto de qualquer usuário (ao excluir a conta) ----
drop policy if exists "avatar: admin apaga" on storage.objects;
create policy "avatar: admin apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.is_admin());
drop policy if exists "avatar: admin lista" on storage.objects;
create policy "avatar: admin lista" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.is_admin());

-- 8. Primeiro administrador: a primeira conta criada (a do dono) -------------------
insert into public.admins (user_id)
select id from auth.users order by created_at limit 1
on conflict do nothing;

select u.email as administrador from public.admins a join auth.users u on u.id = a.user_id;
