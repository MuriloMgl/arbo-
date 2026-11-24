/* ============================================================
   ARBO — ongs.js : mutirões e organizações parceiras (Supabase)
   Tabelas e views: veja supabase-ongs.sql
============================================================ */
const SVG_ONGS = {
  cal:   '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  pin:   '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  link:  '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  tree:  '<path d="M12 3l5 7h-3l4 6H6l4-6H7z"/><line x1="12" y1="16" x2="12" y2="21"/>',
};
function mk(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function icone(nome, cheio) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true");
  s.setAttribute("class", "ico" + (cheio ? " ico-fill" : ""));
  s.innerHTML = SVG_ONGS[nome];
  return s;
}
const ONGS = { insc: new Set(), seg: new Set() };
const fmtData = iso => { const d = new Date(iso); return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }) + " • " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
const fmtNum = n => Number(n || 0).toLocaleString("pt-BR");

function cardMutirao(m) {
  const inscrito = ONGS.insc.has(m.id);
  const c = mk("article", "mut-card");
  const topo = mk("div", "mut-top");
  const cx = mk("span", "ico-box"); cx.append(icone("cal"));
  const t = mk("time", "mut-data", fmtData(m.data_hora)); t.setAttribute("datetime", m.data_hora);
  topo.append(cx, t);
  const loc = mk("p", "mut-loc"); loc.append(icone("pin"), " " + (m.local || ""));
  const conf = mk("span", "mut-conf"); conf.append(icone("users"), ` ${fmtNum(m.confirmados)} confirmados`);
  const b = mk("button", "btn btn-sm " + (inscrito ? "btn-soft" : "btn-primary"), inscrito ? "Inscrito" : "Participar");
  b.type = "button"; b.dataset.mut = m.id;
  b.setAttribute("aria-label", (inscrito ? "Inscrito no mutirão " : "Participar do mutirão ") + m.titulo);
  b.onclick = () => alternarInscricao(m);
  const rodape = mk("div", "mut-foot"); rodape.append(conf, b);
  c.append(topo, mk("h3", "mut-titulo", m.titulo), mk("p", "mut-org", m.organizacao), loc);
  if (m.denuncia_id) {
    const l = mk("button", "mut-link"); l.type = "button";
    l.append(icone("tree"), " Para recuperar: " + (m.denuncia_titulo || "ocorrência"));
    l.setAttribute("aria-label", "Ver a ocorrência ligada a este mutirão: " + (m.denuncia_titulo || ""));
    l.onclick = () => { if (typeof abrirDetalhe === "function") abrirDetalhe(m.denuncia_id); };
    c.append(l);
  }
  c.append(rodape);
  if (typeof currentUserId !== "undefined" && currentUserId && m.criado_por === currentUserId && typeof cancelarMutirao === "function") {
    const x = mk("button", "btn btn-danger btn-sm mut-cancel", "Cancelar este mutirão"); x.type = "button";
    x.onclick = () => cancelarMutirao(m, x);
    c.append(x);
  }
  return c;
}

const CAPAS = [["#1E5C2F", "#4CAF6A"], ["#1565C0", "#4CAF6A"], ["#2E7D45", "#9CCC65"], ["#00695C", "#4DB6AC"], ["#33691E", "#D4A017"]];
function hashTxt(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; }
function iniciais(nome) {
  const p = String(nome || "?").split(/\s+/).filter(w => w.length > 2 && !/^(de|da|do|das|dos|e)$/i.test(w));
  return ((p[0] || "?")[0] + (p[1] ? p[1][0] : "")).toUpperCase();
}
const urlHttps = u => /^https:\/\//.test(u || "") ? u : "";

function cardOrg(o) {
  const seg = ONGS.seg.has(o.id);
  const c = mk("article", "org-card org-card-v2");
  const [c1, c2] = CAPAS[hashTxt(o.nome) % CAPAS.length];
  const capa = mk("div", "org-capa"); capa.setAttribute("aria-hidden", "true");
  capa.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
  if (urlHttps(o.capa_url)) capa.style.backgroundImage = `url("${encodeURI(o.capa_url)}"), linear-gradient(135deg, ${c1}, ${c2})`;
  const logo = mk("span", "org-logo"); logo.setAttribute("aria-hidden", "true");
  if (urlHttps(o.logo_url)) { const im = mk("img"); im.src = o.logo_url; im.alt = ""; logo.append(im); }
  else { logo.textContent = iniciais(o.nome); logo.style.background = c1; }
  const tx = mk("div"); const cid = mk("p", "org-cid"); cid.append(icone("pin"), " " + (o.cidade || ""));
  const nomeLinha = mk("div", "org-nome-linha"); nomeLinha.append(mk("h3", "org-nome", o.nome));
  if (o.verificada) { const v = mk("span", "org-verif"); v.append(icone("check"), " Verificada"); v.title = "Organização verificada pela equipe Arbo"; nomeLinha.append(v); }
  tx.append(nomeLinha, cid);
  const cab = mk("div", "org-cab"); cab.append(logo, tx);
  const est = mk("div", "org-stats");
  [[o.denuncias_auditadas, "Denúncias auditadas"], [o.mutiroes_realizados, "Mutirões realizados"], [o.apoiadores, "Apoiadores"]].forEach(([n, r]) => {
    const s = mk("div", "org-stat"); s.append(mk("strong", "", fmtNum(n)), mk("span", "", r)); est.append(s);
  });
  const b = mk("button", "btn btn-seguir " + (seg ? "btn-outline" : "btn-primary"));
  b.type = "button"; b.dataset.org = o.id;
  b.append(icone("heart", seg), seg ? "Seguindo" : "Seguir");
  b.setAttribute("aria-label", (seg ? "Seguindo " : "Seguir ") + o.nome);
  b.onclick = () => alternarSeguir(o);
  const ac = mk("div", "org-acoes"); ac.append(b);
  if (/^https?:\/\//.test(o.site || "")) {
    const a = mk("a", "btn-icon"); a.href = o.site; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.setAttribute("aria-label", "Abrir o site de " + o.nome + " (nova aba)"); a.append(icone("link")); ac.append(a);
  }
  c.append(capa, cab, mk("p", "org-desc", o.descricao || ""), est, ac);
  return c;
}

async function carregarOngs() {
  const mBox = document.getElementById("ongs-mut"), oBox = document.getElementById("ongs-org");
  if (!mBox || !oBox) return;
  const [m, o, i, s] = await Promise.all([
    _supabase.from("mutiroes_info").select("*").gte("data_hora", new Date().toISOString()).order("data_hora"),
    _supabase.from("organizacoes_info").select("*").order("nome"),
    _supabase.from("inscricoes").select("mutirao_id"),
    _supabase.from("seguidores").select("organizacao_id"),
  ]);
  mBox.textContent = ""; oBox.textContent = "";
  if (m.error || o.error) {
    mBox.append(mk("p", "ongs-vazio", "Não foi possível carregar as ONGs. Rode o arquivo supabase-ongs.sql no Supabase e tente de novo."), mk("p", "ongs-vazio", "Detalhe técnico: " + (m.error || o.error).message));
    return;
  }
  ONGS.insc = new Set((i.data || []).map(x => x.mutirao_id));
  ONGS.seg  = new Set((s.data || []).map(x => x.organizacao_id));
  if (!m.data.length) mBox.append(estadoVazio({ icone: "cal", titulo: "Nenhum mutirão marcado", texto: "Quando uma ONG organizar uma ação de limpeza ou plantio, ela aparece aqui." }));
  m.data.forEach(x => mBox.append(cardMutirao(x)));
  o.data.forEach(x => oBox.append(cardOrg(x)));
  if (typeof atualizarBotaoMutirao === "function") atualizarBotaoMutirao();
  const q = document.querySelector("#screen-ongs .search-input");
  if (q && q.value) buscar(q.value);
}

async function alternarInscricao(m) {
  if (!currentUserId) return;
  const ja = ONGS.insc.has(m.id);
  const r = ja ? await _supabase.from("inscricoes").delete().eq("mutirao_id", m.id).eq("user_id", currentUserId)
               : await _supabase.from("inscricoes").insert({ mutirao_id: m.id, user_id: currentUserId });
  if (r.error) { showToast("Não foi possível atualizar sua inscrição"); return; }
  showToast(ja ? "Inscrição cancelada" : "✓ Você está inscrito no mutirão!");
  await carregarOngs();
  const b = document.querySelector(`[data-mut="${m.id}"]`); if (b) b.focus();
}

async function alternarSeguir(o) {
  if (!currentUserId) return;
  const ja = ONGS.seg.has(o.id);
  const r = ja ? await _supabase.from("seguidores").delete().eq("organizacao_id", o.id).eq("user_id", currentUserId)
               : await _supabase.from("seguidores").insert({ organizacao_id: o.id, user_id: currentUserId });
  if (r.error) { showToast("Não foi possível atualizar"); return; }
  showToast(ja ? "Você deixou de seguir " + o.nome : "✓ Agora você segue " + o.nome);
  await carregarOngs();
  const b = document.querySelector(`[data-org="${o.id}"]`); if (b) b.focus();
}