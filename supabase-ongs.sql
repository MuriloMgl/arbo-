-- ARBO — ONGs, mutirões, inscrições e seguidores. Rode uma vez no SQL Editor do Supabase.
create table if not exists organizacoes (
  id uuid default gen_random_uuid() primary key,
  nome text not null, cidade text, descricao text, site text,
  denuncias_auditadas int default 0, mutiroes_realizados int default 0, apoiadores_base int default 0
);
create table if not exists mutiroes (
  id uuid default gen_random_uuid() primary key,
  titulo text not null, organizacao text not null, local text,
  data_hora timestamptz not null, confirmados_base int default 0
);
create table if not exists inscricoes (
  mutirao_id uuid references mutiroes on delete cascade,
  user_id uuid references auth.users on delete cascade,
  primary key (mutirao_id, user_id)
);
create table if not exists seguidores (
  organizacao_id uuid references organizacoes on delete cascade,
  user_id uuid references auth.users on delete cascade,
  primary key (organizacao_id, user_id)
);

alter table organizacoes enable row level security;
alter table mutiroes     enable row level security;
alter table inscricoes   enable row level security;
alter table seguidores   enable row level security;

drop policy if exists "ver organizacoes" on organizacoes;
create policy "ver organizacoes" on organizacoes for select using (true);
drop policy if exists "ver mutiroes" on mutiroes;
create policy "ver mutiroes" on mutiroes for select using (true);

drop policy if exists "ver minhas inscricoes" on inscricoes;
create policy "ver minhas inscricoes" on inscricoes for select using (auth.uid() = user_id);
drop policy if exists "me inscrever" on inscricoes;
create policy "me inscrever" on inscricoes for insert with check (auth.uid() = user_id);
drop policy if exists "cancelar inscricao" on inscricoes;
create policy "cancelar inscricao" on inscricoes for delete using (auth.uid() = user_id);

drop policy if exists "ver quem sigo" on seguidores;
create policy "ver quem sigo" on seguidores for select using (auth.uid() = user_id);
drop policy if exists "seguir" on seguidores;
create policy "seguir" on seguidores for insert with check (auth.uid() = user_id);
drop policy if exists "deixar de seguir" on seguidores;
create policy "deixar de seguir" on seguidores for delete using (auth.uid() = user_id);

-- Views com as contagens (não expõem quem se inscreveu ou seguiu)
create or replace view mutiroes_info as
  select m.id, m.titulo, m.organizacao, m.local, m.data_hora,
         m.confirmados_base + (select count(*) from inscricoes i where i.mutirao_id = m.id) as confirmados
  from mutiroes m;
create or replace view organizacoes_info as
  select o.id, o.nome, o.cidade, o.descricao, o.site, o.denuncias_auditadas, o.mutiroes_realizados,
         o.apoiadores_base + (select count(*) from seguidores s where s.organizacao_id = o.id) as apoiadores
  from organizacoes o;
grant select on mutiroes_info, organizacoes_info to anon, authenticated;

-- Dados de exemplo (só entram se as tabelas estiverem vazias)
insert into organizacoes (nome, cidade, descricao, site, denuncias_auditadas, mutiroes_realizados, apoiadores_base)
select * from (values
  ('SOS Mata Atlântica', 'São Paulo, SP', 'Organização dedicada à conservação da Mata Atlântica e seus ecossistemas.', 'https://www.sosma.org.br', 847, 34, 12000),
  ('Instituto Socioambiental', 'São Paulo, SP', 'Organização que defende bens e direitos sociais, ambientais e culturais.', 'https://www.socioambiental.org', 212, 19, 5400)
) as v(nome, cidade, descricao, site, a, b, c)
where not exists (select 1 from organizacoes);
insert into mutiroes (titulo, organizacao, local, data_hora, confirmados_base)
select * from (values
  ('Mutirão de Plantio - Parque Linear', 'SOS Mata Atlântica', 'Parque Linear, Ferraz de Vasconcelos', '2026-12-13 08:00-03'::timestamptz, 245),
  ('Mutirão de Plantio - Ferraz de Vasconcelos', 'Instituto Socioambiental', 'Centro, Ferraz de Vasconcelos', '2027-01-18 09:30-03'::timestamptz, 8)
) as v(titulo, organizacao, local, data_hora, c)
where not exists (select 1 from mutiroes);
