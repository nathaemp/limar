-- Paraty Waters · pop-ups do Lima Acervo e do Lima Hub (controle pela administração).
-- Rode uma vez no Supabase: SQL Editor > New query > colar > Run.

create table if not exists public.popups (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('acervo','hub')),
  title text not null default '',
  body text not null default '',
  video_path text,          -- arquivo no bucket "popups"
  poster_path text,         -- capa (opcional)
  cta_label text not null default '',
  cta_url text not null default '',
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Configuração geral (intervalo em minutos)
create table if not exists public.popup_settings (
  id int primary key default 1 check (id = 1),
  every_minutes int not null default 15 check (every_minutes between 1 and 240),
  enabled boolean not null default true
);
insert into public.popup_settings (id) values (1) on conflict (id) do nothing;

alter table public.popups enable row level security;
alter table public.popup_settings enable row level security;

drop policy if exists "popups: todos leem os ativos" on public.popups;
create policy "popups: todos leem os ativos" on public.popups for select to anon, authenticated using (active or public.is_admin());
drop policy if exists "popups: admin gerencia" on public.popups;
create policy "popups: admin gerencia" on public.popups for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "popup_settings: todos leem" on public.popup_settings;
create policy "popup_settings: todos leem" on public.popup_settings for select to anon, authenticated using (true);
drop policy if exists "popup_settings: admin muda" on public.popup_settings;
create policy "popup_settings: admin muda" on public.popup_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.popups, public.popup_settings to anon, authenticated;
grant insert, update, delete on public.popups to authenticated;
grant update on public.popup_settings to authenticated;

-- Vídeos e capas (públicos para leitura; só admin envia/apaga). Até 60 MB por arquivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('popups', 'popups', true, 62914560, array['video/mp4','video/quicktime','video/webm','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "popups: admin envia" on storage.objects;
create policy "popups: admin envia" on storage.objects for insert to authenticated with check (bucket_id = 'popups' and public.is_admin());
drop policy if exists "popups: admin troca" on storage.objects;
create policy "popups: admin troca" on storage.objects for update to authenticated using (bucket_id = 'popups' and public.is_admin());
drop policy if exists "popups: admin apaga" on storage.objects;
create policy "popups: admin apaga" on storage.objects for delete to authenticated using (bucket_id = 'popups' and public.is_admin());

-- Pop-ups iniciais (sem vídeo; troque/adicione vídeos pela administração)
insert into public.popups (kind, title, body, cta_label, cta_url, position)
select 'acervo', 'Imagens profissionais de Paraty', 'Fotos e vídeos da baía, ilhas e centro histórico para divulgar o seu passeio.', 'Baixar no Lima Acervo', 'https://www.limafilmsparaty.com/', 1
where not exists (select 1 from public.popups where kind = 'acervo');
insert into public.popups (kind, title, body, cta_label, cta_url, position)
select 'hub', 'Profissionais de Paraty, a um toque de você', 'Mecânico de barco, marinheiro, eletricista, faxina: encontre no Lima Hub.', 'Abrir o Lima Hub', 'https://limahubparaty.com/', 1
where not exists (select 1 from public.popups where kind = 'hub');
