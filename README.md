# 🌿 Arbo — Plataforma Socioambiental

Mapeamento e intervenção colaborativa de crimes ambientais.

## Stack
- **Frontend:** HTML + CSS + JS puro (zero dependências de framework)
- **Banco:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Hospedagem:** Vercel (deploy automático via GitHub)
- **Mapa:** Leaflet.js + CartoDB Positron

## Estrutura de arquivos

```
arbo/
├── index.html          # SPA principal — todas as telas e modais
├── style.css           # Design system completo (tokens de verde)
├── supabase-client.js  # Inicialização do cliente Supabase
├── data.js             # Camada de dados — fetch, insert, update, realtime
├── map.js              # Leaflet — pins dinâmicos por status
├── app.js              # Orquestrador — auth, navegação, moderação, formulários
├── api/
│   └── env.js          # Serverless Function — expõe variáveis de ambiente
├── vercel.json         # Roteamento /env.js → /api/env.js
├── .gitignore
└── .env.example        # Template das variáveis necessárias
```

## Setup — Supabase

### 1. Tabelas SQL

```sql
-- Perfis de usuário (extende auth.users)
create table perfis (
  id    uuid references auth.users on delete cascade primary key,
  nome  text not null,
  tipo  text not null check (tipo in ('usuario', 'ong', 'orgao')),
  created_at timestamptz default now()
);

-- Trigger: cria perfil automaticamente ao cadastrar usuário
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into perfis (id, nome, tipo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'tipo', 'usuario')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Denúncias
create table denuncias (
  id             uuid default gen_random_uuid() primary key,
  titulo         text not null,
  descricao      text,
  autor_nome     text,
  autor_id       uuid references auth.users,
  localizacao    text,
  latitude       double precision,
  longitude      double precision,
  tipo_categoria text,
  status         text default 'analise' check (status in ('analise', 'proc', 'rec')),
  img_url        text,
  created_at     timestamptz default now()
);
```

### 2. Row Level Security (RLS)

```sql
-- Habilitar RLS
alter table perfis   enable row level security;
alter table denuncias enable row level security;

-- Denúncias: qualquer um pode ler
create policy "leitura publica denuncias"
  on denuncias for select using (true);

-- Denúncias: usuário autenticado pode inserir
create policy "usuario insere denuncia"
  on denuncias for insert
  with check (auth.uid() = autor_id);

-- Denúncias: apenas ong/orgao pode atualizar status
create policy "moderadores atualizam status"
  on denuncias for update
  using (
    exists (
      select 1 from perfis
      where id = auth.uid()
      and tipo in ('ong', 'orgao')
    )
  );

-- Perfis: usuário vê e edita apenas o seu
create policy "perfil proprio"
  on perfis for all
  using (auth.uid() = id);
```

### 3. Storage Bucket

No painel do Supabase → Storage → New Bucket:
- Nome: `fotos-denuncias`
- Public bucket: ✅ (marcado)

```sql
-- Política: qualquer autenticado pode fazer upload
create policy "upload de fotos"
  on storage.objects for insert
  with check (bucket_id = 'fotos-denuncias' and auth.role() = 'authenticated');

-- Política: leitura pública
create policy "leitura publica fotos"
  on storage.objects for select
  using (bucket_id = 'fotos-denuncias');
```

### 4. Realtime

No painel do Supabase → Database → Replication:
- Habilite `denuncias` para replicação (INSERT e UPDATE).

---

## Setup — GitHub

```bash
git init
git add .
git commit -m "feat: arbo v2 com supabase integrado"
git remote add origin https://github.com/SEU_USUARIO/arbo.git
git push -u origin main
```

---

## Setup — Vercel

1. Acesse vercel.com → New Project → importe o repositório GitHub
2. Em **Environment Variables**, adicione:
   - `SUPABASE_URL` → `https://xxxxxxxxxxx.supabase.co`
   - `SUPABASE_ANON_KEY` → `eyJhbGciOiJIUzI1NiIsInR5...`
3. Deploy → pronto! Cada push na `main` faz deploy automático.

---

## Fluxo da aplicação

| Perfil   | Tela inicial | Pode fazer                        |
|----------|-------------|-----------------------------------|
| usuario  | Mapa        | Ver pins, enviar denúncias        |
| ong      | Moderação   | Aprovar / recusar denúncias       |
| orgao    | Moderação   | Acompanhar e fiscalizar           |

**Legenda dos pins:**
- 🟡 Amarelo — Não verificada (status: analise)
- 🟢 Verde   — Procedente (status: proc)
- 🔴 Vermelho — Recusada (status: rec)
