-- Paraty Waters · pontos dos barqueiros e localização ao vivo
-- Rodar uma vez no Supabase (SQL Editor). Pode rodar de novo sem problema.

/* ---------- pontos dos barqueiros (perigos, fundeios, combustível...) ---------- */
create table if not exists public.pontos (
  id          bigint generated always as identity primary key,
  tipo        text not null check (tipo in ('perigo','raso','fundeio','combustivel','comida','pier','mergulho','pesca','outro')),
  nome        text not null check (char_length(nome) between 1 and 60),
  descricao   text check (descricao is null or char_length(descricao) <= 400),
  lat         double precision not null check (lat between -23.70 and -22.70),
  lon         double precision not null check (lon between -45.30 and -44.10),
  autor       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status      text not null default 'pendente' check (status in ('pendente','aprovado','recusado')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists pontos_status on public.pontos (status);
alter table public.pontos enable row level security;
revoke all on public.pontos from anon, authenticated;
grant select, insert, delete on public.pontos to authenticated;

drop policy if exists pontos_ler on public.pontos;
create policy pontos_ler on public.pontos for select to authenticated
  using (status = 'aprovado' or autor = auth.uid() or public.is_admin());
drop policy if exists pontos_criar on public.pontos;
create policy pontos_criar on public.pontos for insert to authenticated
  with check (autor = auth.uid());
drop policy if exists pontos_apagar on public.pontos;
create policy pontos_apagar on public.pontos for delete to authenticated
  using (autor = auth.uid() or public.is_admin());

-- quem cria não escolhe o status: do administrador já entra aprovado; dos outros, espera aprovação
create or replace function public.pontos_antes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.autor := auth.uid();
  new.created_at := now(); new.updated_at := now();
  if public.is_admin() then new.status := 'aprovado';
  else
    new.status := 'pendente';
    if (select count(*) from public.pontos where autor = auth.uid() and status = 'pendente') >= 20 then
      raise exception 'Você já tem 20 pontos esperando aprovação. Aguarde a revisão.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists pontos_antes on public.pontos;
create trigger pontos_antes before insert on public.pontos for each row execute function public.pontos_antes();

create or replace function public.pontos_aviso() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'pendente' then
    perform public.avisar('📍 Ponto novo para aprovar', new.nome || ' (' || new.tipo || ')', 'ponto');
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists pontos_aviso on public.pontos;
create trigger pontos_aviso after insert on public.pontos for each row execute function public.pontos_aviso();

-- administração: lista com o nome de quem marcou, e aprovar / recusar
create or replace function public.admin_pontos() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Acesso restrito'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'tipo', p.tipo, 'nome', p.nome, 'descricao', p.descricao, 'lat', p.lat, 'lon', p.lon,
      'status', p.status, 'criado', p.created_at,
      'autor_email', u.email, 'autor_nome', coalesce(u.raw_user_meta_data ->> 'nome', ''))
      order by (p.status = 'pendente') desc, p.created_at desc)
    from public.pontos p left join auth.users u on u.id = p.autor), '[]'::jsonb);
end $$;
revoke all on function public.admin_pontos() from public, anon;
grant execute on function public.admin_pontos() to authenticated;

create or replace function public.admin_ponto_status(pid bigint, novo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Acesso restrito'; end if;
  if novo not in ('pendente','aprovado','recusado') then raise exception 'Status inválido'; end if;
  update public.pontos set status = novo, updated_at = now() where id = pid;
end $$;
revoke all on function public.admin_ponto_status(bigint, text) from public, anon;
grant execute on function public.admin_ponto_status(bigint, text) to authenticated;

/* ---------- localização ao vivo (link para a família acompanhar o barco) ---------- */
create table if not exists public.ao_vivo (
  token       text primary key default encode(extensions.gen_random_bytes(12), 'hex'),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  barco       text check (barco is null or char_length(barco) <= 60),
  lat         double precision,
  lon         double precision,
  spd         real,
  hdg         real,
  acc         real,
  updated_at  timestamptz,
  created_at  timestamptz not null default now(),
  expira      timestamptz not null
);
alter table public.ao_vivo enable row level security;
revoke all on public.ao_vivo from anon, authenticated;

create or replace function public.ao_vivo_iniciar(horas int, barco text) returns text
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta'; end if;
  delete from public.ao_vivo where user_id = auth.uid() and expira < now() - interval '1 day';
  update public.ao_vivo set expira = now() where user_id = auth.uid() and expira > now();
  insert into public.ao_vivo (user_id, barco, expira)
    values (auth.uid(), nullif(left(coalesce(barco, ''), 60), ''), now() + make_interval(hours => greatest(1, least(coalesce(horas, 4), 12))))
    returning token into k;
  return k;
end $$;
revoke all on function public.ao_vivo_iniciar(int, text) from public, anon;
grant execute on function public.ao_vivo_iniciar(int, text) to authenticated;

create or replace function public.ao_vivo_enviar(k text, la double precision, lo double precision, v real, h real, a real) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.ao_vivo set lat = la, lon = lo, spd = v, hdg = h, acc = a, updated_at = now()
   where token = k and user_id = auth.uid() and expira > now();
  return found;
end $$;
revoke all on function public.ao_vivo_enviar(text, double precision, double precision, real, real, real) from public, anon;
grant execute on function public.ao_vivo_enviar(text, double precision, double precision, real, real, real) to authenticated;

create or replace function public.ao_vivo_parar(k text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.ao_vivo set expira = now() where token = k and user_id = auth.uid() and expira > now();
end $$;
revoke all on function public.ao_vivo_parar(text) from public, anon;
grant execute on function public.ao_vivo_parar(text) to authenticated;

-- página pública do link: só mostra a posição enquanto o compartilhamento está ativo
create or replace function public.ver_ao_vivo(k text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.ao_vivo%rowtype;
begin
  if k is null or char_length(k) <> 24 then return null; end if;
  select * into r from public.ao_vivo where token = k;
  if not found then return null; end if;
  if r.expira <= now() then return jsonb_build_object('ativo', false, 'barco', r.barco, 'expira', r.expira); end if;
  return jsonb_build_object('ativo', true, 'barco', r.barco, 'lat', r.lat, 'lon', r.lon, 'spd', r.spd, 'hdg', r.hdg,
                            'acc', r.acc, 'atualizado', r.updated_at, 'expira', r.expira, 'agora', now());
end $$;
revoke all on function public.ver_ao_vivo(text) from public;
grant execute on function public.ver_ao_vivo(text) to anon, authenticated;

select 'ok' as ferramentas;
