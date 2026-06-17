/* ============================================================
   ARBO — app.js
   1. Estado da sessão
   2. Autenticação (Supabase Auth)
   3. Navegação + Bottomnav
   4. Carregar denúncias (mapa + feed)
   5. Moderação — aprovar / recusar / filtrar
   6. Modal — Nova Denúncia (com upload real)
   7. Menu de perfil
   8. Toast + Loading
   9. Realtime
   10. Init
============================================================ */

/* ── 1. ESTADO ─────────────────────────────────────────── */

let currentProfile  = "usuario";
let currentUserName = "";
let currentUserId   = null;
let toastTimer      = null;
let fotoFile        = null;   // File selecionado pelo input
let coordsAtuais    = null;   // { lat, lng } da denúncia em curso

/* ── 2. AUTENTICAÇÃO ────────────────────────────────────── */

/** Login com e-mail e senha reais via Supabase Auth */
async function doLogin() {
  const email = document.getElementById("login-email").value.trim();
  const senha  = document.getElementById("login-senha").value;

  if (!email || !senha) {
    showToast("Preencha o e-mail e a senha");
    return;
  }

  setLoading(true);

  const { data, error } = await _supabase.auth.signInWithPassword({ email, password: senha });

  if (error) {
    setLoading(false);
    showToast("E-mail ou senha incorretos");
    return;
  }

  // Busca o perfil no banco
  const { data: perfil, error: perfilErr } = await _supabase
    .from("perfis")
    .select("tipo, nome")
    .eq("id", data.user.id)
    .single();

  setLoading(false);

  if (perfilErr || !perfil) {
    showToast("Perfil não encontrado. Contate o suporte.");
    await _supabase.auth.signOut();
    return;
  }

  currentUserId   = data.user.id;
  currentProfile  = perfil.tipo;       // "usuario" | "ong" | "orgao"
  currentUserName = perfil.nome || email.split("@")[0];

  applySession();

  if (currentProfile === "usuario") {
    navigate("mapa");
  } else {
    navigate("moderacao");
    await carregarFeed();
  }

  iniciarRealtime();
}

/** Logout */
async function doLogout() {
  closeProfileMenu();
  closeModal();
  await _supabase.auth.signOut();
  currentUserId   = null; 
  currentProfile  = "usuario";
  currentUserName = "";
  navigate("login");
}

/** Seleciona perfil na tela de login (apenas visual) */
function selectProfile(perfil) {
  currentProfile = perfil;
  document.querySelectorAll(".profile-option").forEach(b => b.classList.remove("selected"));
  document.getElementById("popt-" + perfil).classList.add("selected");

  const descs = {
    usuario: "Registre e acompanhe denúncias ambientais",
    ong:     "Modere e valide ocorrências da sua região",
    orgao:   "Acompanhe e fiscalize ocorrências reportadas",
  };
  const labels = {
    usuario: "Entrar como Usuário →",
    ong:     "Entrar como ONG →",
    orgao:   "Entrar como Órgão →",
  };
  document.getElementById("profile-desc").textContent = descs[perfil];
  document.getElementById("login-btn").textContent    = labels[perfil];
}

/** Alterna visibilidade da senha */
function toggleSenha() {
  const inp = document.getElementById("login-senha");
  inp.type = inp.type === "password" ? "text" : "password";
}

/** Aplica dados da sessão nos labels da UI */
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

/* ── 3. NAVEGAÇÃO + BOTTOMNAV ───────────────────────────── */

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

  const html = `
    ${firstItem}
    <button class="nav-btn" data-screen="ongs"   onclick="navigate('ongs')">${SVG_NAV.ongs}<span>ONGs</span></button>
    <button class="nav-btn" data-screen="perfil" onclick="navigate('perfil')">${SVG_NAV.perfil}<span>Perfil</span></button>`;

  ["nav-mapa", "nav-moderacao", "nav-ongs", "nav-perfil"].forEach(navId => {
    const el = document.getElementById(navId);
    if (el) el.innerHTML = html;
  });
}

function navigate(screen) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-" + screen).classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.screen === screen);
  });

  closePinPopup();

  // Carrega feed ao entrar na moderação
  if (screen === "moderacao") carregarFeed();
}

/* ── 4. CARREGAR DENÚNCIAS ──────────────────────────────── */

/** Carrega denúncias do Supabase e popula mapa + feed */
async function carregarDenuncias() {
  const lista = await fetchDenuncias();

  // Popula pins no mapa (se mapa já foi iniciado)
  lista.forEach(d => adicionarPinMapa(d));

  // Guarda callback para quando o mapa for iniciado depois
  window._mapReadyCallback = () => lista.forEach(d => adicionarPinMapa(d));

  return lista;
}

/** Carrega e renderiza apenas o feed de moderação */
async function carregarFeed() {
  const grid = document.getElementById("den-grid");
  if (grid) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--muted)">
      <div style="font-size:28px;margin-bottom:8px">⏳</div>Carregando denúncias...</div>`;
  }

  const lista = await fetchDenuncias();
  renderCards(lista);
  updateStatCounters();
}

/* ── 5. MODERAÇÃO ───────────────────────────────────────── */

function updateStatCounters() {
  const analise = document.querySelectorAll('.den-card[data-status="analise"]').length;
  const proc    = document.querySelectorAll('.den-card[data-status="proc"]').length;
  const rec     = document.querySelectorAll('.den-card[data-status="rec"]').length;

  const s = id => document.getElementById(id);
  if (s("s-analise")) s("s-analise").textContent = analise;
  if (s("s-proc"))    s("s-proc").textContent    = proc;
  if (s("s-rec"))     s("s-rec").textContent     = rec;
}

async function aprovar(id) {
  if (currentProfile === "usuario") {
    showToast("Apenas ONGs e Órgãos podem moderar denúncias");
    return;
  }

  const card = document.getElementById("card-" + id);
  if (!card || card.dataset.status !== "analise") return;

  const ok = await atualizarStatus(id, "proc");
  if (!ok) { showToast("Erro ao aprovar. Tente novamente."); return; }

  card.classList.add("approved");
  card.dataset.status = "proc";
  const badge = card.querySelector(".badge-yellow");
  if (badge) { badge.className = "badge badge-green"; badge.textContent = "Procedente"; }
  card.querySelectorAll(".den-actions .btn").forEach(b => b.disabled = true);
  updateStatCounters();
  showToast("✓ Denúncia aprovada como procedente");
}

async function recusar(id) {
  if (currentProfile === "usuario") {
    showToast("Apenas ONGs e Órgãos podem moderar denúncias");
    return;
  }

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

function filterCards(status, btn) {
  document.querySelectorAll(".ftab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.querySelectorAll(".den-card").forEach(card => {
    card.style.display = (status === "todas" || card.dataset.status === status) ? "" : "none";
  });
}

/* ── 6. MODAL — NOVA DENÚNCIA ───────────────────────────── */

function openModal() {
  obterLocalizacao(); // tenta pegar GPS ao abrir
  document.getElementById("modal-nd").classList.add("open");
}

function closeModal() {
  document.getElementById("modal-nd").classList.remove("open");
  resetModal();
}

function resetModal() {
  document.querySelectorAll(".tipo-btn").forEach(b => b.classList.remove("sel"));
  document.getElementById("foto-icon").textContent   = "📷";
  document.getElementById("foto-label").textContent  = "Toque para adicionar";
  document.getElementById("foto-sub").textContent    = "ou arraste uma imagem";
  document.getElementById("foto-drop").style.borderColor = "";
  document.getElementById("nd-desc").value           = "";
  document.getElementById("nd-titulo").value         = "";
  fotoFile     = null;
  coordsAtuais = null;
}

function selTipo(btn) {
  document.querySelectorAll(".tipo-btn").forEach(b => b.classList.remove("sel"));
  btn.classList.add("sel");
}

/** Abre o input de arquivo real para seleção da foto */
function abrirSeletorFoto() {
  document.getElementById("foto-input").click();
}

/** Chamado quando o usuário seleciona uma foto */
function onFotoSelecionada(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Valida tipo e tamanho (máx 5 MB)
  if (!file.type.startsWith("image/")) {
    showToast("Selecione uma imagem válida (JPG, PNG, etc.)");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("A foto deve ter no máximo 5 MB");
    return;
  }

  fotoFile = file;
  document.getElementById("foto-icon").textContent        = "✅";
  document.getElementById("foto-label").textContent       = file.name;
  document.getElementById("foto-sub").textContent         = "Toque para substituir";
  document.getElementById("foto-drop").style.borderColor = "var(--g700)";
}

/** Tenta obter GPS do dispositivo */
function obterLocalizacao() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    pos => {
      coordsAtuais = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const locLabel = document.getElementById("loc-status");
      if (locLabel) {
        locLabel.textContent = "Localização obtida com sucesso ✓";
        locLabel.style.color = "var(--g700)";
      }
    },
    () => {
      const locLabel = document.getElementById("loc-status");
      if (locLabel) {
        locLabel.textContent = "Não foi possível obter localização automática";
        locLabel.style.color = "var(--muted)";
      }
    }
  );
}

/** Envia a denúncia real para o Supabase */
async function enviarDenuncia() {
  const titulo = document.getElementById("nd-titulo")?.value.trim();
  const desc   = document.getElementById("nd-desc").value.trim();
  const tipoBt = document.querySelector(".tipo-btn.sel");

  if (!titulo) { showToast("Informe um título para a ocorrência"); return; }
  if (!tipoBt) { showToast("Selecione o tipo de ocorrência");     return; }
  if (!desc)   { showToast("Descreva o problema encontrado");      return; }

  setLoading(true);

  // Upload da foto (se houver)
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
    latitude:       coordsAtuais?.lat || null,
    longitude:      coordsAtuais?.lng || null,
    localizacao:    coordsAtuais
      ? `${coordsAtuais.lat.toFixed(4)}, ${coordsAtuais.lng.toFixed(4)}`
      : "Localização não informada",
    img_url: imgUrl,
  };

  const nova = await inserirDenuncia(payload);
  setLoading(false);

  if (!nova) {
    showToast("Erro ao enviar denúncia. Tente novamente.");
    return;
  }

  closeModal();
  showToast("✓ Denúncia enviada! Ela já aparece no mapa.");

  // Adiciona pin imediatamente no mapa (status analise = amarelo)
  adicionarPinMapa(nova);
}

document.getElementById("modal-nd").addEventListener("click", e => {
  if (e.target === document.getElementById("modal-nd")) closeModal();
});

/* ── 7. MENU DE PERFIL ──────────────────────────────────── */

function openProfileMenu() {
  markActivePswBtn();
  document.getElementById("modal-profile").classList.add("open");
}

function closeProfileMenu() {
  document.getElementById("modal-profile").classList.remove("open");
}

function markActivePswBtn() {
  ["usuario", "ong", "orgao"].forEach(p => {
    const btn   = document.getElementById("psw-" + p);
    const check = btn?.querySelector(".psw-check");
    if (!btn || !check) return;
    if (p === currentProfile) {
      btn.classList.add("psw-active");
      check.classList.remove("hidden");
    } else {
      btn.classList.remove("psw-active");
      check.classList.add("hidden");
    }
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

  // Desabilita o botão de login enquanto carrega
  const loginBtn = document.getElementById("login-btn");
  if (loginBtn) loginBtn.disabled = on;
}

/* ── 9. REALTIME ────────────────────────────────────────── */

function iniciarRealtime() {
  escutarDenuncias((eventType, denúncia) => {
    if (eventType === "INSERT") {
      // Nova denúncia: adiciona pin no mapa
      adicionarPinMapa(denúncia);

      // Se estiver na tela de moderação, adiciona card no topo
      const grid = document.getElementById("den-grid");
      if (grid && document.getElementById("screen-moderacao").classList.contains("active")) {
        const div = document.createElement("div");
        div.innerHTML = renderCardHTML(denúncia);
        const card = div.firstElementChild;
        if (card) grid.prepend(card);
        updateStatCounters();
      }

      showToast("📍 Nova denúncia registrada no mapa");
    }

    if (eventType === "UPDATE") {
      // Status alterado: atualiza pin e card
      atualizarPinMapa(denúncia);

      const card = document.getElementById("card-" + denúncia.id);
      if (card) {
        card.dataset.status = denúncia.status;
        const badge = card.querySelector(".badge-yellow, .badge-green, .badge-red");
        const badgeClass = { analise: "badge-yellow", proc: "badge-green", rec: "badge-red" }[denúncia.status];
        const badgeText  = { analise: "Não Verificada", proc: "Procedente", rec: "Não procedente" }[denúncia.status];
        if (badge && badgeClass) {
          badge.className = `badge ${badgeClass}`;
          badge.textContent = badgeText;
        }
        updateStatCounters();
      }
    }
  });
}

/* ── 10. INIT ───────────────────────────────────────────── */

(async () => {
  // Verifica se já existe uma sessão ativa (ex: refresh da página)
  const { data: { session } } = await _supabase.auth.getSession();

  if (session) {
    const { data: perfil } = await _supabase
      .from("perfis")
      .select("tipo, nome")
      .eq("id", session.user.id)
      .single();

    if (perfil) {
      currentUserId   = session.user.id;
      currentProfile  = perfil.tipo;
      currentUserName = perfil.nome || session.user.email.split("@")[0];
      applySession();

      if (currentProfile === "usuario") {
        navigate("mapa");
      } else {
        navigate("moderacao");
        await carregarFeed();
      }

      iniciarRealtime();
      await carregarDenuncias();
      return;
    }
  }

  // Sem sessão: mostra tela de login
  navigate("login");
  buildNav("usuario");

  // Carrega denúncias para o mapa quando ele for aberto
  // (o callback _mapReadyCallback é chamado pelo map.js)
  window._mapReadyCallback = async () => {
    const lista = await fetchDenuncias();
    lista.forEach(d => adicionarPinMapa(d));
  };
})();
