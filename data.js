/* ============================================================
   ARBO — data.js
   Camada de acesso a dados (Supabase).
   Substituiu o array estático pelo banco real.

   Funções exportadas para app.js e map.js:
     fetchDenuncias()          → busca todas as denúncias
     inserirDenuncia(payload)  → insere nova denúncia
     atualizarStatus(id, st)   → atualiza status (ong/orgao)
     uploadFoto(file, path)    → faz upload da foto
     escutarDenuncias(cb)      → Realtime — chama cb em mudanças

   renderCardHTML(d)           → gera HTML seguro (sem XSS)
   renderCards(lista)          → renderiza grid de moderação
============================================================ */

/* ── FETCH TODAS AS DENÚNCIAS ───────────────────────────── */

async function fetchDenuncias() {
  const { data, error } = await supabase
    .from("denuncias")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Arbo] Erro ao buscar denúncias:", error.message);
    return [];
  }
  return data;
}

/* ── INSERIR NOVA DENÚNCIA ──────────────────────────────── */

/**
 * @param {Object} payload
 *   titulo, descricao, autor_nome, autor_id,
 *   latitude, longitude, localizacao,
 *   tipo_categoria, img_url
 */
async function inserirDenuncia(payload) {
  const { data, error } = await supabase
    .from("denuncias")
    .insert([{ ...payload, status: "analise" }])
    .select()
    .single();

  if (error) {
    console.error("[Arbo] Erro ao inserir denúncia:", error.message);
    return null;
  }
  return data;
}

/* ── ATUALIZAR STATUS (moderação) ───────────────────────── */

/**
 * @param {string} id     — UUID da denúncia
 * @param {string} status — "proc" | "rec"
 */
async function atualizarStatus(id, status) {
  const { error } = await supabase
    .from("denuncias")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("[Arbo] Erro ao atualizar status:", error.message);
    return false;
  }
  return true;
}

/* ── UPLOAD DE FOTO ─────────────────────────────────────── */

/**
 * @param {File}   file — arquivo de imagem selecionado
 * @param {string} path — ex: "user-id/timestamp.jpg"
 * @returns {string|null} URL pública da foto ou null se falhar
 */
async function uploadFoto(file, path) {
  const { error } = await supabase.storage
    .from("fotos-denuncias")
    .upload(path, file, { upsert: false });

  if (error) {
    console.error("[Arbo] Erro no upload da foto:", error.message);
    return null;
  }

  const { data } = supabase.storage
    .from("fotos-denuncias")
    .getPublicUrl(path);

  return data.publicUrl;
}

/* ── REALTIME ───────────────────────────────────────────── */

/**
 * Escuta INSERT e UPDATE na tabela denuncias.
 * @param {Function} callback — chamado com (eventType, denúncia)
 */
function escutarDenuncias(callback) {
  supabase
    .channel("denuncias-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "denuncias" },
      (payload) => callback(payload.eventType, payload.new)
    )
    .subscribe();
}

/* ── RENDER: HTML SEGURO (anti-XSS) ────────────────────── */

/**
 * Escapa caracteres HTML para prevenir XSS.
 * @param {string} str
 * @returns {string}
 */
function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Mapeia tipo_categoria para emoji e cor de fundo.
 * @param {string} tipo
 * @returns {{ emoji: string, bg: string }}
 */
function tipoVisual(tipo) {
  const map = {
    "Despejo ilegal": { emoji: "🗑️",  bg: "#FFF3E0" },
    "Queimada":       { emoji: "🔥",  bg: "#FFF8E1" },
    "Desmatamento":   { emoji: "🌲",  bg: "#E8F5E9" },
    "Poluição":       { emoji: "🚯",  bg: "#E3F2FD" },
  };
  return map[tipo] || { emoji: "⚠️", bg: "#F5F5F5" };
}

/**
 * Formata timestamp ISO para texto legível.
 * @param {string} iso
 * @returns {string}
 */
function formatarTempo(iso) {
  if (!iso) return "Agora";
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)   return "Agora mesmo";
  if (diff < 3600) return `Há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Há ${Math.floor(diff / 3600)} hora${Math.floor(diff / 3600) > 1 ? "s" : ""}`;
  return `Há ${Math.floor(diff / 86400)} dia${Math.floor(diff / 86400) > 1 ? "s" : ""}`;
}

/**
 * Gera HTML de um card de denúncia de forma segura.
 * Todos os dados do usuário passam por esc() antes de entrar no DOM.
 * @param {Object} d — linha da tabela denuncias
 * @returns {string} HTML do card
 */
function renderCardHTML(d) {
  const visual = tipoVisual(d.tipo_categoria);
  const thumb  = d.img_url
    ? `<img src="${esc(d.img_url)}" alt="${esc(d.titulo)}" class="den-thumb-photo">`
    : `<div class="den-thumb-emoji">${visual.emoji}</div>`;

  const badgeClass = { analise: "badge-yellow", proc: "badge-green", rec: "badge-red" }[d.status] || "badge-yellow";
  const badgeText  = { analise: "Não Verificada", proc: "Procedente",  rec: "Não procedente" }[d.status] || "Em análise";

  const loc   = esc(d.localizacao   || "Localização não informada");
  const autor = esc(d.autor_nome    || "Anônimo");
  const titulo = esc(d.titulo       || "Ocorrência ambiental");
  const desc   = esc(d.descricao    || "");
  const tipo   = esc(d.tipo_categoria || "Outro");
  const tempo  = formatarTempo(d.created_at);
  const id     = esc(d.id);

  return `
    <div class="den-card" data-status="${esc(d.status)}" id="card-${id}">
      <div class="den-thumb" style="background:${visual.bg}">
        ${thumb}
        <div class="den-thumb-badges">
          <span class="badge ${badgeClass}">${badgeText}</span>
          <span class="badge badge-gray">${tipo}</span>
        </div>
      </div>
      <div class="den-body">
        <h3 class="den-title">${titulo}</h3>
        <p class="den-desc">${desc}</p>
        <ul class="den-meta">
          <li>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            ${autor}
          </li>
          <li>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            ${loc}
          </li>
          <li>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${tempo}
          </li>
        </ul>
        <div class="den-actions">
          <button class="btn btn-danger"  onclick="recusar('${id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            Recusar
          </button>
          <button class="btn btn-primary" onclick="aprovar('${id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Aprovar
          </button>
        </div>
      </div>
    </div>`;
}

/**
 * Renderiza todos os cards no grid de moderação.
 * @param {Array} lista — array de denúncias do Supabase
 */
function renderCards(lista) {
  const grid = document.getElementById("den-grid");
  if (!grid) return;

  if (!lista || lista.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">
        <div style="font-size:40px;margin-bottom:12px">🌿</div>
        <p style="font-weight:600">Nenhuma denúncia encontrada</p>
        <p style="font-size:12px;margin-top:4px">Novas ocorrências aparecerão aqui em tempo real</p>
      </div>`;
    return;
  }

  grid.innerHTML = lista.map(renderCardHTML).join("");
}
