/* ============================================================
   ARBO — api/env.js
   Serverless Function da Vercel.
   Expõe as variáveis de ambiente PÚBLICAS (anon key)
   como um script JS que o browser pode carregar.

   Nunca exponha a service_role key aqui.
   Apenas SUPABASE_URL e SUPABASE_ANON_KEY são seguras
   para o client-side — são projetadas para serem públicas.
============================================================ */

export default function handler(req, res) {
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(`window.ENV = {
  SUPABASE_URL: "${process.env.SUPABASE_URL || ""}",
  SUPABASE_ANON_KEY: "${process.env.SUPABASE_ANON_KEY || ""}"
};`);
}
