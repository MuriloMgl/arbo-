/* ============================================================
   ARBO — app.js  v3
   Melhorias:
   - Cadastro real com e-mail (signUp)
   - Localização: GPS ou clique no mapa
   - resolverDenuncia()
   - Foto nos cards de moderação (já via data.js)
   - Filtro "Resolvidas" no mapa
============================================================ */

/* ── 1. ESTADO ─────────────────────────────────────────── */
let currentProfile  = "usuario";
let currentUserName = "";
let currentUserId   = null;
let toastTimer      = null;
let fotoFile        = null;

/* ── 2. AUTH ────────────────────────────────────────────── */

/** Login */
async function doLogin() {
  const email = document.getElementById("login-email").value.trim();
  const senha  = document.getElementById("login-senha").value;
  if (!email || !senha) { showToast("Preencha o e-mail e a senha"); return; }

  setLoading(true);
  const { data, error } = await _supabase.auth.signInWithPassword({ email, password: senha });

  if (error) {
    setLoading(false);
    showToast("E-mail ou senha incorretos");
    return;
  }

  await carregarPerfil(data.user);
  setLoading(false);
}

/** Cadastro */
async function doCadastro() {
  const nome  = document.getElementById("cad-nome").value.trim();
  const email = document.getElementById("cad-email").value.trim();
  const senha  = document.getElementById("cad-senha").value;
  const tipo  = document.getElementById("cad-tipo-val")?.value || "usuario";

  if (!nome || !email || !senha) { showToast("Preencha todos os campos"); return; }
  if (senha.length < 6) { showToast("A senha deve ter ao menos 6 caracteres"); return; }

  setLoading(true);
  const { data, error } = await _supabase.auth.signUp({
    email,
    password: senha,
    options: { data: { nome, tipo } },
  });

  setLoading(false);

  if (error) { showToast("Erro ao cadastrar: " + error.message); return; }

  if (data.user && !data.session) {
    // Confirmação de e-mail ativada
    showToast("Cadastro realizado! Verifique seu e-mail para confirmar.");
    navigate("login");
  } else if (data.session) {
    await carregarPerfil(data.user);
  }
}

/** Carrega perfil após login/cadastro */
async function carregarPerfil(user) {
  const { data: perfil } = await _supabase
    .from("perfis")
    .select("tipo, nome")
    .eq("id", user.id)
    .single();

  if (!perfil) { showToast("Perfil não encontrado. Contate o suporte."); await _supabase.auth.signOut(); return; }

  currentUserId   = user.id;
  currentProfile  = perfil.tipo;
  currentUserName = perfil.nome || user.email.split("@")[0];

  applySession();

  if (currentProfile === "usuario") {
    navigate("mapa");
  } else {
    navigate("moderacao");
    await carregarFeed();
  }

  iniciarRealtime();
  await carregarDenuncias();
}

/** Logout */
async function doLogout() {
  closeProfileMenu();
  closeModal();
  await _supabase.auth.signOut();
  currentUserId = null; currentProfile = "usuario"; currentUserName = "";
  navigate("login");
}

function selectProfile(perfil) {
  currentProfile = perfil;
  document.querySelectorAll(".profile-option").forEach(b => b.classList.remove("selected"));
  document.getElementById("popt-" + perfil)?.classList.add("selected");

  const descs  = { usuario: "Registre e acompanhe denúncias ambientais", ong: "Modere e valide ocorrências da sua região", orgao: "Acompanhe e fiscalize ocorrências reportadas" };
  const labels = { usuario: "Entrar como Usuário →", ong: "Entrar como ONG →", orgao: "Entrar como Órgão →" };
  const el = id => document.getElementById(id);
  if (el("profile-desc"))  el("profile-desc").textContent  = descs[perfil];
  if (el("login-btn"))     el("login-btn").textContent     = labels[perfil];
  if (el("cad-tipo-val"))  el("cad-tipo-val").value        = perfil;
}

/** Seleciona perfil na tela de CADASTRO (IDs separados para não conflitar com login) */
function selectCadPerfil(btn, perfil) {
  document.querySelectorAll("#screen-cadastro .profile-option").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  const input = document.getElementById("cad-tipo-val");
  if (input) input.value = perfil;
}

function toggleSenha(inputId = "login-senha") {
  const inp = document.getElementById(inputId);
  if (inp) inp.type = inp.type === "password" ? "text" : "password";
}

function applySession() {
  const firstName = currentUserName.split(" ")[0];
  const el = id => document.getElementById(id);
  if (el("mapa-user-label"))  el("mapa-user-label").textContent  = firstName;
  if (el("ongs-user-label"))  el("ongs-user-label").textContent  = firstName;
  if (el("mod-org-label"))    el("mod-org-label").textContent    = currentUserName;
  if (el("perfil-name"))      el("perfil-name").textContent      = currentUserName;

  const isOrg = currentProfile !== "usuario";
  document.querySelectorAll(".user-chip-avatar").forEach(av => {
    av.style.background = isOrg ? "var(--g700)" : "var(--g800)";
  });

  buildNav(currentProfile);
  markActivePswBtn();
}

/* ── 3. NAVEGAÇÃO ───────────────────────────────────────── */
const SVG_NAV = {
  mapa:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13 6-3m-6 3V7m6 10 4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-1.447-.894L15 9m0 8V9m0 0L9 7"/></svg>`,
  moderacao: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  ongs:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  perfil:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
};

function buildNav(role) {
  const isOrg = role === "ong" || role === "orgao";
  const firstItem = isOrg
    ? `<button class="nav-btn" data-screen="moderacao" onclick="navigate('moderacao')">${SVG_NAV.moderacao}<span>Moderação</span></button>`
    : `<button class="nav-btn" data-screen="mapa"      onclick="navigate('mapa')">${SVG_NAV.mapa}<span>Mapa</span></button>`;

  const html = `${firstItem}
    <button class="nav-btn" data-screen="ongs"   onclick="navigate('ongs')">${SVG_NAV.ongs}<span>ONGs</span></button>
    <button class="nav-btn" data-screen="perfil" onclick="navigate('perfil')">${SVG_NAV.perfil}<span>Perfil</span></button>`;

  ["nav-mapa","nav-moderacao","nav-ongs","nav-perfil"].forEach(navId => {
    const el = document.getElementById(navId);
    if (el) el.innerHTML = html;
  });
}

function navigate(screen) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-" + screen)?.classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.screen === screen);
  });
  closePinPopup();
  if (screen === "moderacao") carregarFeed();
}

function mostrarCadastro() { navigate("cadastro"); }
function voltarLogin()     { navigate("login"); }

/* ── 4. CARREGAR DADOS ──────────────────────────────────── */
async function carregarDenuncias() {
  const lista = await fetchDenuncias(false);
  const resolvidas = await fetchDenuncias(true);
  resolvidas.forEach(d => adicionarPinMapa(d));
  lista.forEach(d => adicionarPinMapa(d));
  window._mapReadyCallback = async () => {
    const all = await fetchDenuncias(true);
    all.forEach(d => adicionarPinMapa(d));
  };
}

async function carregarFeed() {
  const grid = document.getElementById("den-grid");
  if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--muted)"><div style="font-size:28px;margin-bottom:8px">⏳</div>Carregando denúncias...</div>`;
  const lista = await fetchDenuncias(true);
  renderCards(lista);
  updateStatCounters();
}

/* ── 5. MODERAÇÃO ───────────────────────────────────────── */
function updateStatCounters() {
  const analise   = document.querySelectorAll('.den-card[data-status="analise"]').length;
  const proc      = document.querySelectorAll('.den-card[data-status="proc"]').length;
  const rec       = document.querySelectorAll('.den-card[data-status="rec"]').length;
  const resolvida = document.querySelectorAll('.den-card[data-status="resolvida"]').length;

  const s = id => document.getElementById(id);
  if (s("s-analise"))   s("s-analise").textContent   = analise;
  if (s("s-proc"))      s("s-proc").textContent      = proc;
  if (s("s-rec"))       s("s-rec").textContent       = rec;
  if (s("s-resolvida")) s("s-resolvida").textContent = resolvida;
}

async function aprovar(id) {
  if (currentProfile === "usuario") { showToast("Apenas ONGs e Órgãos podem moderar"); return; }
  const card = document.getElementById("card-" + id);
  if (!card || card.dataset.status !== "analise") return;

  const ok = await atualizarStatus(id, "proc");
  if (!ok) { showToast("Erro ao aprovar. Tente novamente."); return; }

  card.classList.add("approved");
  card.dataset.status = "proc";
  const badge = card.querySelector(".badge-yellow");
  if (badge) { badge.className = "badge badge-green"; badge.textContent = "Procedente"; }
  // Atualiza botões para mostrar "Marcar Resolvida"
  const actions = card.querySelector(".den-actions");
  if (actions) actions.innerHTML = `
    <button class="btn btn-resolve" onclick="resolverDenuncia('${id}')">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Marcar Resolvida
    </button>`;
  updateStatCounters();
  showToast("✓ Denúncia aprovada como procedente");
}

async function recusar(id) {
  if (currentProfile === "usuario") { showToast("Apenas ONGs e Órgãos podem moderar"); return; }
  const card = document.getElementById("card-" + id);
  if (!card || card.dataset.status !== "analise") return;

  const ok = await atualizarStatus(id, "rec");
  if (!ok) { showToast("Erro ao recusar. Tente novamente."); return; }

  card.classList.add("refused");
  card.dataset.status = "rec";
  const badge = card.querySelector(".badge-yellow");
  if (badge) { badge.className = "badge badge-red"; badge.textContent = "Não procedente"; }
  card.querySelectorAll(".den-actions .btn").forEach(b => b.disabled = true);
  updateStatCounters();
  showToast("Denúncia recusada como improcedente");
}

async function resolverDenuncia(id) {
  if (currentProfile === "usuario") { showToast("Apenas ONGs e Órgãos podem moderar"); return; }
  const card = document.getElementById("card-" + id);
  if (!card || card.dataset.status !== "proc") return;

  const ok = await atualizarStatus(id, "resolvida");
  if (!ok) { showToast("Erro ao marcar como resolvida. Tente novamente."); return; }

  card.dataset.status = "resolvida";
  const badge = card.querySelector(".badge-green");
  if (badge) { badge.className = "badge badge-blue"; badge.textContent = "Resolvida"; }
  card.querySelectorAll(".den-actions .btn").forEach(b => b.disabled = true);
  updateStatCounters();
  showToast("✓ Denúncia marcada como resolvida!");
}

function filterCards(status, btn) {
  document.querySelectorAll(".ftab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.querySelectorAll(".den-card").forEach(card => {
    card.style.display = (status === "todas" || card.dataset.status === status) ? "" : "none";
  });
}

/* ── 6. MODAL NOVA DENÚNCIA ─────────────────────────────── */
function openModal() {
  document.getElementById("modal-nd").classList.add("open");
  obterLocalizacaoGPS();
}

function closeModal() {
  document.getElementById("modal-nd").classList.remove("open");
  resetModal();
}

function resetModal() {
  document.querySelectorAll(".tipo-btn").forEach(b => b.classList.remove("sel"));
  document.getElementById("foto-icon").textContent        = "📷";
  document.getElementById("foto-label").textContent       = "Toque para adicionar";
  document.getElementById("foto-sub").textContent         = "JPG, PNG ou WEBP • máx. 5 MB";
  document.getElementById("foto-drop").style.borderColor  = "";
  document.getElementById("nd-desc").value                = "";
  document.getElementById("nd-titulo").value              = "";
  const ls = document.getElementById("loc-status");
  if (ls) { ls.textContent = "Aguardando..."; ls.style.color = "var(--muted)"; }
  fotoFile = null;
  window._coordsSelecionadas = null;
}

function selTipo(btn) {
  document.querySelectorAll(".tipo-btn").forEach(b => b.classList.remove("sel"));
  btn.classList.add("sel");
}

function abrirSeletorFoto() { document.getElementById("foto-input").click(); }

function onFotoSelecionada(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) { showToast("Selecione uma imagem válida"); return; }
  if (file.size > 5 * 1024 * 1024)    { showToast("A foto deve ter no máximo 5 MB"); return; }
  fotoFile = file;
  document.getElementById("foto-icon").textContent        = "✅";
  document.getElementById("foto-label").textContent       = file.name;
  document.getElementById("foto-sub").textContent         = "Toque para substituir";
  document.getElementById("foto-drop").style.borderColor  = "var(--g700)";
}

function obterLocalizacaoGPS() {
  if (!navigator.geolocation) return;
  const ls = document.getElementById("loc-status");
  if (ls) { ls.textContent = "Obtendo localização GPS..."; ls.style.color = "var(--muted)"; }

  navigator.geolocation.getCurrentPosition(
    pos => {
      window._coordsSelecionadas = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (ls) { ls.textContent = "📍 Localização GPS obtida ✓"; ls.style.color = "var(--g700)"; }
    },
    () => {
      if (ls) { ls.textContent = "GPS não disponível — selecione no mapa"; ls.style.color = "var(--muted)"; }
    }
  );
}

async function enviarDenuncia() {
  const titulo = document.getElementById("nd-titulo")?.value.trim();
  const desc   = document.getElementById("nd-desc").value.trim();
  const tipoBt = document.querySelector(".tipo-btn.sel");

  if (!titulo) { showToast("Informe um título para a ocorrência"); return; }
  if (!tipoBt) { showToast("Selecione o tipo de ocorrência");     return; }
  if (!desc)   { showToast("Descreva o problema encontrado");      return; }

  const coords = window._coordsSelecionadas;

  setLoading(true);

  let imgUrl = "";
  if (fotoFile) {
    const ext  = fotoFile.name.split(".").pop();
    const path = `${currentUserId}/${Date.now()}.${ext}`;
    imgUrl = await uploadFoto(fotoFile, path) || "";
  }

  const payload = {
    titulo,
    descricao:      desc,
    autor_nome:     currentUserName,
    autor_id:       currentUserId,
    tipo_categoria: tipoBt.textContent.trim(),
    latitude:       coords?.lat || null,
    longitude:      coords?.lng || null,
    localizacao:    coords
      ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
      : "Localização não informada",
    img_url: imgUrl,
  };

  const nova = await inserirDenuncia(payload);
  setLoading(false);

  if (!nova) { showToast("Erro ao enviar denúncia. Tente novamente."); return; }

  closeModal();
  showToast("✓ Denúncia enviada! Ela já aparece no mapa.");
  adicionarPinMapa(nova);
}

document.getElementById("modal-nd").addEventListener("click", e => {
  if (e.target === document.getElementById("modal-nd")) closeModal();
});

/* ── 7. MENU DE PERFIL ──────────────────────────────────── */
function openProfileMenu() { markActivePswBtn(); document.getElementById("modal-profile").classList.add("open"); }
function closeProfileMenu() { document.getElementById("modal-profile").classList.remove("open"); }

function markActivePswBtn() {
  ["usuario","ong","orgao"].forEach(p => {
    const btn   = document.getElementById("psw-" + p);
    const check = btn?.querySelector(".psw-check");
    if (!btn || !check) return;
    btn.classList.toggle("psw-active", p === currentProfile);
    check.classList.toggle("hidden", p !== currentProfile);
  });
}

document.getElementById("modal-profile").addEventListener("click", e => {
  if (e.target === document.getElementById("modal-profile")) closeProfileMenu();
});

/* ── 8. TOAST + LOADING ─────────────────────────────────── */
function showToast(msg) {
  clearTimeout(toastTimer);
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

function setLoading(on) {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.style.display = on ? "flex" : "none";
  const loginBtn = document.getElementById("login-btn");
  if (loginBtn) loginBtn.disabled = on;
}

/* ── 9. REALTIME ────────────────────────────────────────── */
function iniciarRealtime() {
  escutarDenuncias((eventType, d) => {
    if (eventType === "INSERT") {
      adicionarPinMapa(d);
      const grid = document.getElementById("den-grid");
      if (grid && document.getElementById("screen-moderacao").classList.contains("active")) {
        const div = document.createElement("div");
        div.innerHTML = renderCardHTML(d);
        const card = div.firstElementChild;
        if (card) grid.prepend(card);
        updateStatCounters();
      }
      showToast("📍 Nova denúncia registrada no mapa");
    }
    if (eventType === "UPDATE") {
      atualizarPinMapa(d);
      const card = document.getElementById("card-" + d.id);
      if (card) {
        card.dataset.status = d.status;
        const badgeClass = { analise:"badge-yellow", proc:"badge-green", rec:"badge-red", resolvida:"badge-blue" }[d.status];
        const badgeText  = { analise:"Não Verificada", proc:"Procedente", rec:"Não procedente", resolvida:"Resolvida" }[d.status];
        const badge = card.querySelector(".badge-yellow,.badge-green,.badge-red,.badge-blue");
        if (badge && badgeClass) { badge.className = `badge ${badgeClass}`; badge.textContent = badgeText; }
        updateStatCounters();
      }
    }
  });
}

/* ── 10. INIT ───────────────────────────────────────────── */
(async () => {
  const { data: { session } } = await _supabase.auth.getSession();
  if (session) {
    await carregarPerfil(session.user);
    return;
  }
  navigate("login");
  buildNav("usuario");
  window._mapReadyCallback = async () => {
    const lista = await fetchDenuncias(true);
    lista.forEach(d => adicionarPinMapa(d));
  };
})();
