/* ============================================================
   ARBO — supabase-client.js
   Inicializa o cliente Supabase usando as chaves públicas
   injetadas pela Vercel como variáveis de ambiente.

   Na Vercel, configure:
     SUPABASE_URL      → https://xxxxxxxxxxx.supabase.co
     SUPABASE_ANON_KEY → eyJhbGciOiJIUzI1NiIsInR5...

   O arquivo env.js (gerado pelo build da Vercel via api/env.js)
   expõe essas variáveis em window.ENV antes de qualquer script.
============================================================ */

const SUPABASE_URL      = window.ENV?.SUPABASE_URL      || "";
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "[Arbo] Variáveis de ambiente do Supabase não encontradas. " +
    "Verifique a configuração da Vercel (SUPABASE_URL e SUPABASE_ANON_KEY)."
  );
}

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
