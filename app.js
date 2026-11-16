/* ============================================================
   ARBO — app.js  v4
   - "Esqueci a senha" com e-mail real
   - "Selecionar no mapa" corrigido
   - Mobile friendly
   - Cadastro com confirmação de e-mail
============================================================ */

/* ── 1. ESTADO ─────────────────────────────────────────── */
let currentProfile  = "usuario";
let currentUserName = "";
let currentUserId   = null;
let toastTimer      = null;
let fotoFile        = null;

/* ── 2. AUTH ────────────────────────────────────────────── */

async function doLogin() {
  const escolhido = loginPerfilEscolhido;
  limparErros(document.getElementById("screen-login"));
  const email = document.getElementById("login-email").value.trim();
  const senha  = document.getElementById("login-senha").value;
  if (!email) return erroCampo("login-email", "Informe seu e-mail");
  if (!senha) return erroCampo("login-senha", "Informe sua senha");

  setLoading(true);
  const { data, error } = await _supabase.auth.signInWithPassword({ email, password: senha });
  setLoading(false);

  if (error) {
    if (error.message.includes("Email not confirmed")) {
      erroCampo("login-email", "Confirme seu e-mail antes de entrar (veja a caixa de entrada)");
    } else {
      erroCampo("login-senha", "E-mail ou senha incorretos");
    }
    return;
  }

  if (["usuario", "ong", "orgao"].includes(escolhido)) await _supabase.from("perfis").update({ tipo: escolhido }).eq("id", data.user.id);
  await carregarPerfil(data.user);
}

async function doCadastro() {
  limparErros(document.getElementById("screen-cadastro"));
  const nome  = document.getElementById("cad-nome").value.trim();
  const email = document.getElementById("cad-email").value.trim();
  const senha  = document.getElementById("cad-senha").value;
  const tipo  = document.getElementById("cad-tipo-val")?.value || "usuario";

  if (!nome)  return erroCampo("cad-nome", "Informe seu nome");
  if (!email) return erroCampo("cad-email", "Informe seu e-mail");
  if (!senha) return erroCampo("cad-senha", "Crie uma senha");
  if (senha.length < 6) return erroCampo("cad-senha", "A senha deve ter ao menos 6 caracteres");

  setLoading(true);
  const { data, error } = await _supabase.auth.signUp({
    email,
    password: senha,
    options: { data: { nome, tipo } },
  });
  setLoading(false);

  if (error) { showToast("Erro ao cadastrar: " + error.message); return; }

  if (data.user && !data.session) {
    // E-mail de confirmação enviado
    mostrarTelaConfirmacao(email);
  } else if (data.session) {
    await carregarPerfil(data.user);
  }
}

function mostrarTelaConfirmacao(email) {
  navigate("confirmacao");
  const el = document.getElementById("conf-email");
  if (el) el.textContent = email;
}

async function doEsqueciSenha() {
  limparErros(document.getElementById("screen-esqueci"));
  const email = document.getElementById("reset-email").value.trim();
  if (!email) return erroCampo("reset-email", "Informe seu e-mail");

  setLoading(true);
  const { error } = await _supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  setLoading(false);

  if (error) { showToast("Erro ao enviar e-mail: " + error.message); return; }

  showToast("✓ E-mail de redefinição enviado!");
  navigate("login");
}

async function carregarPerfil(user) {
  const { data: perfil } = await _supabase
    .from("perfis")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!perfil) { showToast("Perfil não encontrado. Contate o suporte."); await _supabase.auth.signOut(); return; }

  currentUserId   = user.id;
  currentProfile  = perfil.tipo;
  currentUserName = perfil.nome || user.email.split("@")[0];
  currentAvatar   = perfil.avatar_url || "";
  currentEmail    = user.email || "";

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

async function doLogout() {
  closeProfileMenu();
  closeModal();
  await _supabase.auth.signOut();
  currentUserId = null; currentProfile = "usuario"; currentUserName = ""; currentEmail = ""; aplicarAvatar("");
  navigate("login");
}

let loginPerfilEscolhido = null;
function selectProfile(perfil) {
  loginPerfilEscolhido = perfil;
  currentProfile = perfil;
  document.querySelectorAll("#screen-login .profile-option").forEach(b => b.classList.remove("selected"));
  document.getElementById("popt-" + perfil)?.classList.add("selected");

  const descs  = { usuario: "Registre e acompanhe denúncias ambientais", ong: "Modere e valide ocorrências da sua região", orgao: "Acompanhe e fiscalize ocorrências reportadas" };
  const labels = { usuario: "Entrar como Usuário →", ong: "Entrar como ONG →", orgao: "Entrar como Órgão →" };
  const el = id => document.getElementById(id);
  if (el("profile-desc")) el("profile-desc").textContent = descs[perfil];
  }

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
  aplicarAvatar(currentAvatar);
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
  if (screen === "perfil") carregarPainelPerfil();
  if (screen === "ongs") {
    const caixa = document.getElementById("ongs-mut");
    if (typeof carregarOngs !== "function") { if (caixa) caixa.textContent = "Arquivo ongs.js não encontrado. Copie o ongs.js para a mesma pasta do index.html."; }
    else carregarOngs().catch(e => { if (caixa) caixa.textContent = "Erro ao carregar: " + e.message; });
  }
}

function mostrarCadastro()    { navigate("cadastro"); }
function voltarLogin()        { navigate("login"); }
function mostrarEsqueci()     { navigate("esqueci"); }

/* ── 4. DADOS ───────────────────────────────────────────── */
async function carregarDenuncias() {
  const all = await fetchDenuncias(true);
  all.forEach(d => adicionarPinMapa(d));
  window._mapReadyCallback = async () => {
    const lista = await fetchDenuncias(true);
    lista.forEach(d => adicionarPinMapa(d));
  };
}

async function carregarFeed() {
  const grid = document.getElementById("den-grid");
  if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--muted)"><div style="font-size:calc(28px*var(--fs,1));margin-bottom:8px">⏳</div>Carregando denúncias...</div>`;
  const lista = await fetchDenuncias(true);
  renderCards(lista);
  updateStatCounters();
}

/* ── 5. MODERAÇÃO ───────────────────────────────────────── */
function updateStatCounters() {
  const s = id => document.getElementById(id);
  if (s("s-analise"))   s("s-analise").textContent   = document.querySelectorAll('.den-card[data-status="analise"]').length;
  if (s("s-proc"))      s("s-proc").textContent      = document.querySelectorAll('.den-card[data-status="proc"]').length;
  if (s("s-rec"))       s("s-rec").textContent       = document.querySelectorAll('.den-card[data-status="rec"]').length;
  if (s("s-resolvida")) s("s-resolvida").textContent = document.querySelectorAll('.den-card[data-status="resolvida"]').length;
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
  const actions = card.querySelector(".den-actions");
  if (actions) { const del = actions.querySelector(".btn-del"); actions.innerHTML = `
    <button class="btn btn-resolve" onclick="resolverDenuncia('${id}')">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Marcar Resolvida
    </button>`; if (del) actions.append(del); }
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
  card.querySelectorAll(".den-actions .btn:not(.btn-del)").forEach(b => b.disabled = true);
  updateStatCounters();
  showToast("Denúncia recusada como improcedente");
}

async function resolverDenuncia(id) {
  if (currentProfile === "usuario") { showToast("Apenas ONGs e Órgãos podem moderar"); return; }
  const card = document.getElementById("card-" + id);
  if (!card || card.dataset.status !== "proc") return;

  const ok = await atualizarStatus(id, "resolvida");
  if (!ok) { showToast("Erro ao marcar como resolvida."); return; }

  card.dataset.status = "resolvida";
  const badge = card.querySelector(".badge-green");
  if (badge) { badge.className = "badge badge-blue"; badge.textContent = "Resolvida"; }
  card.querySelectorAll(".den-actions .btn:not(.btn-del)").forEach(b => b.disabled = true);
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
  // Cancela modo loc mapa se estiver ativo
  if (typeof desativarModoLocMapa === "function") desativarModoLocMapa();
  resetModal();
}

function resetModal() {
  limparErros(document.getElementById("modal-nd"));
  const fa = document.getElementById("nd-foto-alt"); if (fa) fa.value = "";
  document.querySelectorAll(".tipo-btn").forEach(b => b.classList.remove("sel"));
  document.getElementById("foto-icon").textContent        = "📷";
  document.getElementById("foto-label").textContent       = "Toque para adicionar";
  document.getElementById("foto-sub").textContent         = "JPG, PNG ou WEBP • máx. 5 MB";
  document.getElementById("foto-drop").style.borderColor  = "";
  document.getElementById("nd-desc").value                = "";
  document.getElementById("nd-titulo").value              = "";
  const ls = document.getElementById("loc-status");
  if (ls) { ls.textContent = "Aguardando localização..."; ls.style.color = "var(--muted)"; }
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
  limparErros(document.getElementById("modal-nd"));
  const fotoAlt = document.getElementById("nd-foto-alt")?.value.trim();
  const titulo = document.getElementById("nd-titulo")?.value.trim();
  const desc   = document.getElementById("nd-desc").value.trim();
  const tipoBt = document.querySelector(".tipo-btn.sel");

  if (!titulo) return erroCampo("nd-titulo", "Informe um título para a ocorrência");
  if (!tipoBt) return erroCampo(document.querySelector(".tipo-grid"), "Selecione o tipo de ocorrência", document.querySelector(".tipo-btn"));
  if (!desc) return erroCampo("nd-desc", "Descreva o problema encontrado");

  const coords = window._coordsSelecionadas;
  if (!coords) return erroCampo(document.querySelector(".loc-opcoes"), "Defina o local: use o GPS ou toque em marcar no mapa", document.getElementById("btn-selecionar-mapa"));
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
    ...(fotoAlt ? { img_alt: fotoAlt } : {}),
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
function limparErros(escopo) {
  const r = escopo || document;
  r.querySelectorAll(".campo-erro").forEach(e => e.remove());
  r.querySelectorAll('[aria-invalid="true"]').forEach(i => { i.removeAttribute("aria-invalid"); i.removeAttribute("aria-describedby"); i.classList.remove("input-erro"); });
}

function erroCampo(alvo, msg, foco) {
  const el = typeof alvo === "string" ? document.getElementById(alvo) : alvo;
  if (!el) { showToast(msg); return false; }
  const p = document.createElement("p");
  p.className = "campo-erro";
  p.id = "erro-" + (el.id || Math.random().toString(36).slice(2, 7));
  p.textContent = msg;
  (el.closest(".input-wrap") || el).insertAdjacentElement("afterend", p);
  el.setAttribute("aria-invalid", "true");
  el.setAttribute("aria-describedby", p.id);
  el.classList.add("input-erro");
  (foco || el).focus();
  return false;
}

document.addEventListener("input", e => {
  const i = e.target;
  if (i.getAttribute && i.getAttribute("aria-invalid") === "true") {
    const id = i.getAttribute("aria-describedby");
    if (id) document.getElementById(id)?.remove();
    i.removeAttribute("aria-invalid"); i.removeAttribute("aria-describedby"); i.classList.remove("input-erro");
  }
});

function showToast(msg) {
  clearTimeout(toastTimer);
  const t = document.getElementById("toast");
  t.textContent = "";
  const s = document.createElement("span"); s.textContent = msg;
  const b = document.createElement("button");
  b.type = "button"; b.className = "toast-close"; b.setAttribute("aria-label", "Fechar aviso"); b.textContent = "✕";
  b.onclick = () => t.classList.remove("show");
  t.append(s, b);
  t.classList.add("show");
  const agenda = () => { clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), Math.max(6000, msg.length * 90)); };
  t.onmouseenter = t.onfocusin = () => clearTimeout(toastTimer);
  t.onmouseleave = t.onfocusout = agenda;
  agenda();
  const live = document.getElementById("a11y-live");
  if (live) { live.textContent = ""; setTimeout(() => { live.textContent = msg; }, 60); }
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
    if (eventType === "DELETE") { removerDenunciaDaTela(d.id, false); return; }
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

/* ── PERFIL: foto, nome, números e minhas denúncias ──────── */
const NOMES_TIPO = { usuario: "Cidadão", ong: "ONG", orgao: "Órgão público" };
let currentAvatar = "";
let currentEmail  = "";

function aplicarAvatar(url) {
  currentAvatar = (url && /^https:\/\//.test(url)) ? url : "";
  document.querySelectorAll(".user-chip-avatar, .profile-avatar").forEach(av => {
    av.style.backgroundImage    = currentAvatar ? `url("${currentAvatar}")` : "";
    av.style.backgroundSize     = "cover";
    av.style.backgroundPosition = "center";
    const svg = av.querySelector("svg");
    if (svg) svg.style.display = currentAvatar ? "none" : "";
  });
}

async function carregarPainelPerfil() {
  if (!currentUserId) return;
  const el = id => document.getElementById(id);
  const isOrg = currentProfile !== "usuario";
  let q = _supabase.from("denuncias").select("id,titulo,status,created_at,tipo_categoria").order("created_at", { ascending: false });
  if (!isOrg) q = q.eq("autor_id", currentUserId);
  const { data, error } = await q;
  if (error) return;

  const n = s => data.filter(d => d.status === s).length;
  const aprovadas = n("proc") + n("resolvida");
  const set = (i, num, rot) => { el("pf-n" + i).textContent = num; el("pf-l" + i).textContent = rot; };
  if (isOrg) { set(1, n("analise"), "Na fila"); set(2, aprovadas, "Aprovadas"); set(3, n("rec"), "Recusadas"); }
  else       { set(1, data.length, "Denúncias"); set(2, aprovadas, "Procedentes"); set(3, n("resolvida"), "Resolvidas"); }

  el("perfil-since").textContent = "Conta: " + NOMES_TIPO[currentProfile];
  el("perfil-level").textContent = isOrg ? NOMES_TIPO[currentProfile] : (aprovadas >= 10 ? "Guardião Verde" : aprovadas >= 3 ? "Muda" : "Semente");
  if (document.activeElement !== el("pf-nome")) el("pf-nome").value = currentUserName;
  el("pf-email").textContent = currentEmail ? "E-mail: " + currentEmail : "";

  el("pf-count").textContent = data.length;
  el("mi-minhas").style.display = isOrg ? "none" : "";
  el("pf-conq-wrap").style.display = isOrg ? "none" : "";
  const eh = el("pf-email-hero"); if (eh) eh.textContent = currentEmail;
  const conq = el("pf-conq"); conq.textContent = "";
  [["🌱", "Primeiro passo", "Primeira denúncia registrada", data.length >= 1], ["🌳", "Guardião verde", "3 denúncias procedentes", aprovadas >= 3], ["🔥", "Vigilante", "Uma denúncia resolvida", n("resolvida") >= 1]].forEach(([ic, t, d, ok]) => {
    const c = document.createElement("div"); c.className = "ach-card" + (ok ? "" : " ach-off");
    const a = document.createElement("div"); a.className = "ach-icon"; a.textContent = ic;
    const b = document.createElement("p"); b.className = "ach-name"; b.textContent = t;
    const e = document.createElement("p"); e.className = "ach-desc"; e.textContent = ok ? d : d + " (bloqueada)";
    c.append(a, b, e); conq.append(c);
  });
  el("pf-lista-titulo").style.display = isOrg ? "none" : "";
  const box = el("pf-lista");
  box.textContent = "";
  if (isOrg) return;
  if (!data.length) { const v = document.createElement("p"); v.style.color = "var(--muted)"; v.textContent = "Você ainda não enviou denúncias."; box.append(v); return; }
  const cls = { analise: "badge-yellow", proc: "badge-green", rec: "badge-red", resolvida: "badge-blue" };
  const txt = { analise: "Não verificada", proc: "Procedente", rec: "Não procedente", resolvida: "Resolvida" };
  data.forEach(d => {
    const c = document.createElement("div"); c.className = "ong-card";
    const t = document.createElement("p");  t.className = "ong-name"; t.style.fontSize = "14px"; t.textContent = d.titulo;
    const m = document.createElement("p");  m.className = "ong-loc"; m.textContent = `${d.tipo_categoria || "Outro"} · ${formatarTempo(d.created_at)}`;
    const b = document.createElement("span"); b.className = "badge " + (cls[d.status] || "badge-yellow"); b.textContent = txt[d.status] || d.status;
    c.append(t, m, b); box.append(c);
  });
}


async function trocarPerfil(tipo) {
  if (!["usuario", "ong", "orgao"].includes(tipo) || !currentUserId) return;
  closeProfileMenu();
  setLoading(true);
  const { error } = await _supabase.from("perfis").update({ tipo }).eq("id", currentUserId);
  setLoading(false);
  if (error) { showToast("Não foi possível trocar o tipo de conta"); return; }
  currentProfile = tipo;
  applySession();
  navigate(tipo === "usuario" ? "mapa" : "moderacao");
  showToast("Entrando como " + NOMES_TIPO[tipo] + " ✓");
}

async function salvarNome() {
  const nome = document.getElementById("pf-nome").value.trim();
  if (nome.length < 2) return erroCampo("pf-nome", "Digite um nome com ao menos 2 letras");
  setLoading(true);
  const { error } = await _supabase.from("perfis").update({ nome }).eq("id", currentUserId);
  setLoading(false);
  if (error) { showToast("Não foi possível salvar o nome"); return; }
  currentUserName = nome;
  applySession();
  showToast("✓ Nome atualizado");
  fecharModal("modal-dados");
}

async function onAvatarSelecionado(ev) {
  const file = ev.target.files[0];
  ev.target.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) { showToast("Selecione uma imagem válida"); return; }
  if (file.size > 3 * 1024 * 1024)    { showToast("A foto deve ter no máximo 3 MB"); return; }
  setLoading(true);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const url = await uploadFoto(file, `avatars/${currentUserId}/${Date.now()}.${ext}`);
  if (!url) { setLoading(false); showToast("Erro ao enviar a foto"); return; }
  const { error } = await _supabase.from("perfis").update({ avatar_url: url }).eq("id", currentUserId);
  setLoading(false);
  if (error) { showToast("Foto enviada, mas falta criar a coluna avatar_url no banco"); return; }
  aplicarAvatar(url);
  showToast("✓ Foto de perfil atualizada");
}

function abrirModal(id) { document.getElementById(id).classList.add("open"); }
function fecharModal(id) { document.getElementById(id).classList.remove("open"); }
document.querySelectorAll(".overlay.modal-gen").forEach(o => o.addEventListener("click", e => { if (e.target === o) o.classList.remove("open"); }));

let excluirId = null;
function pedirExcluir(id) {
  if (currentProfile === "usuario") { showToast("Apenas ONGs e Órgãos podem excluir denúncias"); return; }
  excluirId = id;
  const t = document.querySelector("#card-" + CSS.escape(id) + " .den-title");
  document.getElementById("excluir-texto").textContent = "“" + (t ? t.textContent : "Esta denúncia") + "” vai sair do mapa e desta tela. Essa ação não pode ser desfeita.";
  abrirModal("modal-excluir");
}
function removerDenunciaDaTela(id, foco = true) {
  const c = document.getElementById("card-" + id); if (c) c.remove();
  if (typeof removerPinMapa === "function") removerPinMapa(id);
  updateStatCounters();
  const g = document.getElementById("den-grid");
  if (g && !g.querySelector(".den-card")) renderCards([]);
  if (foco && g) { g.tabIndex = -1; g.focus(); }
}
async function confirmarExcluir() {
  const id = excluirId; excluirId = null;
  fecharModal("modal-excluir");
  if (!id) return;
  setLoading(true);
  const { error, count } = await _supabase.from("denuncias").delete({ count: "exact" }).eq("id", id);
  setLoading(false);
  if (error || !count) { showToast("Não foi possível excluir. Rode o arquivo supabase-excluir.sql no Supabase."); return; }
  removerDenunciaDaTela(id);
  showToast("✓ Denúncia excluída");
}

const RECOVERY = /type=recovery/.test(location.hash);
_supabase.auth.onAuthStateChange((evento) => { if (evento === "PASSWORD_RECOVERY") navigate("novasenha"); });

async function doNovaSenha() {
  limparErros(document.getElementById("screen-novasenha"));
  const s1 = document.getElementById("nova-senha").value;
  const s2 = document.getElementById("nova-senha2").value;
  if (s1.length < 6) return erroCampo("nova-senha", "A senha deve ter ao menos 6 caracteres");
  if (s1 !== s2) return erroCampo("nova-senha2", "As senhas não conferem");
  setLoading(true);
  const { data, error } = await _supabase.auth.updateUser({ password: s1 });
  setLoading(false);
  if (error) { showToast("Erro ao salvar a senha: " + error.message); return; }
  history.replaceState(null, "", location.pathname);
  showToast("✓ Senha alterada com sucesso!");
  await carregarPerfil(data.user);
}

function buscar(q) {
  q = (q || "").trim().toLowerCase();
  const tela = document.querySelector(".screen.active")?.id;
  const acha = t => t.toLowerCase().includes(q);
  if (tela === "screen-moderacao") document.querySelectorAll(".den-card").forEach(c => { c.style.display = acha(c.textContent) ? "" : "none"; });
  if (tela === "screen-ongs") document.querySelectorAll(".org-card,.mut-card").forEach(c => { c.style.display = acha(c.textContent) ? "" : "none"; });
  if (tela === "screen-mapa" && typeof buscarMapa === "function") buscarMapa(q);
}

(async () => {
  if (RECOVERY) { navigate("novasenha"); return; }
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
