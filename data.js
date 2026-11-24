/* ============================================================
   ARBO — data.js  v3
   Melhorias:
   - Status "resolvida" adicionado
   - fetchDenuncias(incluirResolvidas) — filtro opcional
   - renderCardHTML com foto + botão "Marcar Resolvida"
============================================================ */

/* ── FETCH DENÚNCIAS ────────────────────────────────────── */
async function fetchDenuncias(incluirResolvidas = false) {
  let query = _supabase
    .from("denuncias")
    .select("*")
    .order("created_at", { ascending: false });

  if (!incluirResolvidas) {
    query = query.neq("status", "resolvida");
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Arbo] Erro ao buscar denúncias:", error.message);
    return [];
  }
  return data;
}

/* ── INSERIR NOVA DENÚNCIA ──────────────────────────────── */
async function inserirDenuncia(payload) {
  const { data, error } = await _supabase
    .from("denuncias")
    .insert([{ ...payload, status: "analise" }])
    .select()
    .single();

  if (error) {
    console.error("[Arbo] Erro ao inserir denúncia:", error.message, error);
    window._ultimoErroInsert = error.message;
    return null;
  }
  return data;
}

/* ── ATUALIZAR STATUS ───────────────────────────────────── */
async function atualizarStatus(id, status) {
  const { error } = await _supabase
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
async function uploadFoto(file, path) {
  const { error } = await _supabase.storage
    .from("fotos-denuncias")
    .upload(path, file, { upsert: false });

  if (error) {
    console.error("[Arbo] Erro no upload da foto:", error.message);
    return null;
  }

  const { data } = _supabase.storage
    .from("fotos-denuncias")
    .getPublicUrl(path);

  return data.publicUrl;
}

/* ── REALTIME ───────────────────────────────────────────── */
function escutarDenuncias(callback) {
  _supabase
    .channel("denuncias-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "denuncias" },
      (payload) => callback(payload.eventType, payload.eventType === "DELETE" ? payload.old : payload.new)
    )
    .subscribe();
}

/* ── HELPERS ────────────────────────────────────────────── */
function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tipoVisual(tipo) {
  const map = {
    "Despejo ilegal": { emoji: "🗑️", bg: "#FFF3E0" },
    "Queimada":       { emoji: "🔥", bg: "#FFF8E1" },
    "Desmatamento":   { emoji: "🌲", bg: "#E8F5E9" },
    "Poluição":       { emoji: "🚯", bg: "#E3F2FD" },
  };
  return map[tipo] || { emoji: "⚠️", bg: "#F5F5F5" };
}

function formatarTempo(iso) {
  if (!iso) return "Agora";
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)    return "Agora mesmo";
  if (diff < 3600)  return `Há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Há ${Math.floor(diff / 3600)} hora${Math.floor(diff / 3600) > 1 ? "s" : ""}`;
  return `Há ${Math.floor(diff / 86400)} dia${Math.floor(diff / 86400) > 1 ? "s" : ""}`;
}

/* ── RENDER CARD ────────────────────────────────────────── */
window.arboDenCache = window.arboDenCache || {};
function renderCardHTML(d) {
  if (d && d.id != null) window.arboDenCache[d.id] = d;
  const visual = tipoVisual(d.tipo_categoria);

  // Foto ou emoji
  const thumb = d.img_url
    ? `<img src="${esc(d.img_url)}" alt="${esc(d.img_alt || 'Foto da ocorrência: ' + d.titulo)}" class="den-thumb-photo">`
    : `<div class="den-thumb-emoji">${visual.emoji}</div>`;

  const badgeClass = {
    analise:   "badge-yellow",
    proc:      "badge-green",
    rec:       "badge-red",
    resolvida: "badge-blue",
  }[d.status] || "badge-yellow";

  const badgeText = {
    analise:   "Não Verificada",
    proc:      "Procedente",
    rec:       "Não procedente",
    resolvida: "Resolvida",
  }[d.status] || "Em análise";

  const loc    = esc(d.localizacao    || "Localização não informada");
  const autor  = esc(d.autor_nome     || "Anônimo");
  const titulo = esc(d.titulo         || "Ocorrência ambiental");
  const desc   = esc(d.descricao      || "");
  const tipo   = esc(d.tipo_categoria || "Outro");
  const tempo  = formatarTempo(d.created_at);
  const id     = esc(d.id);

  // Botões de ação conforme status
  const isAnalise  = d.status === "analise";
  const isProc     = d.status === "proc";
  const botaoExcluir = `
    <button class="btn btn-danger btn-del" type="button" aria-label="Excluir denúncia: ${titulo}" onclick="pedirExcluir('${id}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
    </button>`;
  const acoes = isAnalise ? `
    <button class="btn btn-danger"  onclick="recusar('${id}')">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
      Recusar
    </button>
    <button class="btn btn-primary" onclick="aprovar('${id}')">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      Aprovar
    </button>` : isProc ? `
    <button class="btn btn-resolve" onclick="resolverDenuncia('${id}')">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Marcar Resolvida
    </button>` : `<p style="font-size:calc(11px*var(--fs,1));color:var(--muted);text-align:center;flex:1;align-self:center">Sem ações disponíveis</p>`;

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
        <button type="button" class="den-more" data-det="${id}">Ver detalhes <span aria-hidden="true">→</span></button>
        <div class="den-actions">${acoes}${botaoExcluir}</div>
      </div>
    </div>`;
}

/* ── ESTADO VAZIO (ilustração + frase + botão opcional) ───
   Só texto fixo do próprio app: nada vindo de usuário entra aqui. */
const VAZIO_SVG = {
  leaf:  '<svg viewBox="0 0 120 120" width="96" height="96"><circle cx="60" cy="60" r="54" fill="var(--g100)"/><path d="M60 92V54" stroke="var(--g800)" stroke-width="5" stroke-linecap="round"/><path d="M60 62c-18 0-28-10-28-26 18 0 28 10 28 26z" fill="var(--g700)"/><path d="M60 52c0-16 10-26 28-26 0 16-10 26-28 26z" fill="var(--g500)"/><ellipse cx="60" cy="96" rx="22" ry="5" fill="var(--g200)"/></svg>',
  cal:   '<svg viewBox="0 0 120 120" width="96" height="96"><circle cx="60" cy="60" r="54" fill="var(--g100)"/><rect x="30" y="36" width="60" height="52" rx="9" fill="var(--white)" stroke="var(--g800)" stroke-width="4"/><path d="M30 52h60" stroke="var(--g800)" stroke-width="4"/><path d="M45 30v12M75 30v12" stroke="var(--g800)" stroke-width="5" stroke-linecap="round"/><path d="M52 72l6 6 12-13" fill="none" stroke="var(--g700)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  filtro:'<svg viewBox="0 0 120 120" width="96" height="96"><circle cx="60" cy="60" r="54" fill="var(--g100)"/><circle cx="54" cy="54" r="20" fill="none" stroke="var(--g800)" stroke-width="5"/><path d="M69 69l18 18" stroke="var(--g800)" stroke-width="6" stroke-linecap="round"/><path d="M46 54h16" stroke="var(--g700)" stroke-width="5" stroke-linecap="round"/></svg>',
};
function estadoVazio(o) {
  const box = document.createElement("div");
  box.className = "vazio";
  box.setAttribute("role", "status");
  const art = document.createElement("div");
  art.className = "vazio-art";
  art.setAttribute("aria-hidden", "true");
  art.innerHTML = VAZIO_SVG[o.icone] || VAZIO_SVG.leaf;
  const t = document.createElement("h3"); t.textContent = o.titulo;
  const p = document.createElement("p"); p.textContent = o.texto;
  box.append(art, t, p);
  if (o.botao) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn btn-primary"; b.textContent = o.botao;
    b.addEventListener("click", o.acao);
    box.append(b);
  }
  return box;
}

function renderCards(lista) {
  const grid = document.getElementById("den-grid");
  if (!grid) return;

  if (!lista || lista.length === 0) {
    grid.replaceChildren(estadoVazio({
      icone: "leaf", titulo: "Nenhuma denúncia por aqui ainda",
      texto: "Quando alguém reportar uma ocorrência, ela aparece aqui em tempo real.",
      botao: "Reportar uma ocorrência", acao: () => { if (typeof openModal === "function") openModal(); },
    }));
    return;
  }

  grid.innerHTML = lista.map(renderCardHTML).join("");
}