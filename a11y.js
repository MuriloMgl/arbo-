/* ============================================================
   ARBO — a11y.js
   Acessibilidade e usabilidade:
   - Preferências (tamanho do texto, alto contraste, menos animação, leitura em voz alta)
   - Leitor de tela: landmarks, rótulos, estados ARIA, foco ao trocar de tela
   - Teclado: foco visível, Esc fecha, foco preso nos diálogos, links/botões acessíveis
   - Mapa: lista de ocorrências (alternativa ao mapa) e marcação de local por teclado
============================================================ */
(function () {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } },
  };

  /* ── Preferências ─────────────────────────────────────── */
  const prefs = Object.assign({ fs: 1, hc: false, rm: false, cb: "none", theme: "auto", dys: false, keys: true }, store.get("arbo-a11y", {}));
  /* Fonte de fácil leitura: só baixa quando a pessoa liga a opção */
  let fonteLeitura = false;
  function carregarFonteLeitura() {
    if (fonteLeitura) return;
    fonteLeitura = true;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap";
    document.head.append(l);
  }

  function applyPrefs() {
    const r = document.documentElement;
    r.style.setProperty("--fs", prefs.fs);
    r.classList.toggle("hc", !!prefs.hc);
    const escuro = prefs.theme === "dark" || (prefs.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    r.classList.toggle("dark", escuro && !prefs.hc);
    r.classList.toggle("gray", prefs.theme === "gray" && !prefs.hc);
    r.classList.toggle("rm", !!prefs.rm);
    r.classList.toggle("dys", !!prefs.dys);
    if (prefs.dys) carregarFonteLeitura();
    r.classList.toggle("cb-rg", prefs.cb === "rg");
    r.classList.toggle("cb-by", prefs.cb === "by");
    store.set("arbo-a11y", prefs);
    sync();
  }

  function speak() {
    if (!("speechSynthesis" in window)) { showToast("Seu navegador não lê em voz alta"); return; }
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
    const scr = $(".screen.active");
    const u = new SpeechSynthesisUtterance((scr ? scr.innerText : "").replace(/\s+/g, " ").slice(0, 3000));
    u.lang = "pt-BR";
    speechSynthesis.speak(u);
  }

  /* ── Painel de acessibilidade ─────────────────────────── */
  const svgI = p => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const ICON = {
    acc:   svgI('<circle cx="12" cy="4.5" r="2"/><path d="M4.5 8.5 12 10l7.5-1.5M12 10v5M8.5 21l3.5-6 3.5 6"/>'),
    gray:  svgI('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>'),
    sun:   svgI('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon:  svgI('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
    auto:  svgI('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>'),
    speak: svgI('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
  };
  const sw = (a, b, c) => `<span class="cb-sw"><i style="background:${a}"></i><i style="background:${b}"></i><i style="background:${c}"></i></span>`;

  const fab = el("button", "a11y-fab");
  fab.type = "button";
  fab.innerHTML = ICON.acc; fab.dataset.tip = "Acessibilidade";
  fab.setAttribute("aria-label", "Opções de acessibilidade");
  fab.setAttribute("aria-haspopup", "dialog");
  fab.setAttribute("aria-expanded", "false");

  const NEXT = { light: "gray", gray: "dark", dark: "light" };
  const curTheme = () => { const c = document.documentElement.classList; return c.contains("dark") ? "dark" : c.contains("gray") ? "gray" : "light"; };
  const tbtn = el("button", "a11y-fab theme-fab");
  tbtn.type = "button"; tbtn.setAttribute("aria-label", "Alternar modo escuro");
  tbtn.addEventListener("click", () => { prefs.theme = NEXT[curTheme()]; applyPrefs(); });

  const panel = el("div", "overlay");
  panel.id = "modal-a11y";
  const ATALHOS = [["/", "Buscar"], ["N", "Nova denúncia"], ["M", "Mapa"], ["O", "ONGs"], ["D", "Moderação"], ["P", "Perfil"], ["T", "Trocar tema"], ["C", "Mapa de calor"], ["S", "Satélite"], ["L", "Perto de mim"], ["?", "Ver esta lista"]];
  const atalhosHTML = ATALHOS.map(([k, t]) => `<div><dt><kbd>${k}</kbd></dt><dd>${t}</dd></div>`).join("");

  panel.innerHTML = `<div class="sheet sheet-sm a11y-sheet">
    <div class="a11y-head">
      <span class="a11y-badge" aria-hidden="true">${ICON.acc}</span>
      <div><h2 id="a11y-title">Acessibilidade</h2><p>Deixe o Arbo do seu jeito</p></div>
      <button type="button" class="sheet-close" data-close>✕</button>
    </div>
    <section class="a11y-card">
      <h3 class="a11y-label" id="th-lbl">Tema</h3>
      <div class="a11y-tiles" role="group" aria-labelledby="th-lbl">
        <button type="button" class="a11y-tile" data-theme="auto">${ICON.auto}<span>Automático</span></button>
        <button type="button" class="a11y-tile" data-theme="light">${ICON.sun}<span>Claro</span></button>
        <button type="button" class="a11y-tile" data-theme="gray">${ICON.gray}<span>Cinza</span></button>
        <button type="button" class="a11y-tile" data-theme="dark">${ICON.moon}<span>Escuro</span></button>
      </div>
    </section>
    <section class="a11y-card">
      <h3 class="a11y-label" id="fs-lbl">Tamanho do texto</h3>
      <div class="a11y-seg-row" role="group" aria-labelledby="fs-lbl">
        <button type="button" class="a11y-seg" data-fs="1"><b style="font-size:15px">A</b><span>Normal</span></button>
        <button type="button" class="a11y-seg" data-fs="1.2"><b style="font-size:20px">A</b><span>Grande</span></button>
        <button type="button" class="a11y-seg" data-fs="1.4"><b style="font-size:26px">A</b><span>Muito grande</span></button>
      </div>
    </section>
    <section class="a11y-card">
      <h3 class="a11y-label" id="cb-lbl">Cores para daltonismo</h3>
      <div class="a11y-chips" role="group" aria-labelledby="cb-lbl">
        <button type="button" class="a11y-chip" data-cb="none">${sw("#D48A0C", "#1565C0", "#1E5C2F")}<span>Padrão</span></button>
        <button type="button" class="a11y-chip" data-cb="rg">${sw("#E69F00", "#0072B2", "#6A3D9A")}<span>Vermelho-verde</span></button>
        <button type="button" class="a11y-chip" data-cb="by">${sw("#D55E00", "#882255", "#1E5C2F")}<span>Azul-amarelo</span></button>
      </div>
    </section>
    <section class="a11y-card">
      <button type="button" class="a11y-switch" role="switch" data-pref="hc"><span><strong>Alto contraste</strong><small>Preto e branco, com bordas fortes</small></span><span class="sw-track" aria-hidden="true"><span class="sw-knob"></span></span></button>
      <button type="button" class="a11y-switch" role="switch" data-pref="rm"><span><strong>Reduzir animações</strong><small>Menos movimento na tela</small></span><span class="sw-track" aria-hidden="true"><span class="sw-knob"></span></span></button>
    </section>
    <section class="a11y-card">
      <button type="button" class="a11y-switch" role="switch" data-pref="dys"><span><strong>Leitura facilitada</strong><small>Fonte mais legível e mais espaço entre letras e linhas</small></span><span class="sw-track" aria-hidden="true"><span class="sw-knob"></span></span></button>
      <button type="button" class="a11y-switch" role="switch" data-pref="keys"><span><strong>Atalhos de teclado</strong><small>Teclas simples para navegar. Desligue se atrapalhar seu leitor de tela</small></span><span class="sw-track" aria-hidden="true"><span class="sw-knob"></span></span></button>
      <details class="a11y-keys"><summary>Ver lista de atalhos</summary><dl>${atalhosHTML}</dl></details>
    </section>
    <div class="a11y-foot">
      <button type="button" class="a11y-primary" id="a11y-speak">${ICON.speak}<span>Ler esta tela em voz alta</span></button>
      <button type="button" class="a11y-reset" id="a11y-reset">Restaurar padrão</button>
    </div>
  </div>`;

  const closePanel = () => { panel.classList.remove("open"); fab.setAttribute("aria-expanded", "false"); };
  fab.addEventListener("click", () => { panel.classList.add("open"); fab.setAttribute("aria-expanded", "true"); });
  /* ── Atalhos de teclado (desligáveis: WCAG 2.1.4) ── */
  function telaAtiva() { return document.querySelector(".screen.active"); }
  function irPara(tela) { const b = document.querySelector('.screen.active .nav-btn[data-screen="' + tela + '"]'); if (b && b.offsetParent !== null) { b.click(); return true; } return false; }
  document.addEventListener("keydown", e => {
    if (!prefs.keys || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    const t = e.target;
    if (t && t.closest && t.closest("input,textarea,select,[contenteditable='true']")) return;
    const k = e.key;
    if (k === "?") { e.preventDefault(); panel.classList.add("open"); fab.setAttribute("aria-expanded", "true"); const d = $(".a11y-keys", panel); if (d) d.open = true; return; }
    if (document.querySelector(".overlay.open")) return;
    const tela = telaAtiva(); if (!tela) return;
    const logado = typeof currentUserId !== "undefined" && currentUserId;
    const acao = {
      "/": () => { const s = $(".search-input", tela); if (s) s.focus(); else return false; },
      n: () => { if (!logado) return false; if (tela.id !== "screen-mapa" && !irPara("mapa")) return false; if (typeof openModal === "function") openModal(); },
      m: () => irPara("mapa"), o: () => irPara("ongs"), d: () => irPara("moderacao"), p: () => irPara("perfil"),
      t: () => tbtn.click(),
      c: () => { const b = $(".legend-toggle-btn[onclick*='toggleHeat']", tela); if (b) b.click(); else return false; },
      s: () => { const b = $(".arbo-ctl-sat", tela); if (b) b.click(); else return false; },
      l: () => { if (tela.id === "screen-mapa" && typeof abrirPerto === "function") abrirPerto(); else return false; },
    }[k.length === 1 ? k.toLowerCase() : ""];
    if (!acao) return;
    if (acao() !== false) e.preventDefault();
  });

  panel.addEventListener("click", e => {
    if (e.target === panel) return closePanel();
    const b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-close")) closePanel();
    else if (b.dataset.fs) { prefs.fs = +b.dataset.fs; applyPrefs(); }
    else if (b.dataset.theme) { prefs.theme = b.dataset.theme; applyPrefs(); }
    else if (b.dataset.cb) { prefs.cb = b.dataset.cb; applyPrefs(); }
    else if (b.dataset.pref) { prefs[b.dataset.pref] = !prefs[b.dataset.pref]; applyPrefs(); }
    else if (b.id === "a11y-reset") { Object.assign(prefs, { fs: 1, hc: false, rm: false, cb: "none", theme: "auto", dys: false, keys: true }); applyPrefs(); }
    else if (b.id === "a11y-speak") speak();
  });

  /* ── Lista de ocorrências (alternativa ao mapa) ───────── */
  const listPanel = el("div", "overlay");
  listPanel.id = "modal-list";
  listPanel.innerHTML = `<div class="sheet">
    <div class="sheet-header"><h2 id="list-title">Ocorrências no mapa</h2><button type="button" class="sheet-close" data-close>✕</button></div>
    <div id="map-list-items"></div></div>`;
  listPanel.addEventListener("click", e => {
    if (e.target === listPanel || e.target.closest("[data-close]")) listPanel.classList.remove("open");
  });

  function buildList() {
    const box = $("#map-list-items");
    box.textContent = "";
    const labels = { analise: "Não verificada", proc: "Procedente", resolvida: "Resolvida" };
    const items = (typeof pinMarkers !== "undefined" ? Object.values(pinMarkers) : [])
      .filter(o => o.d && arboMap && arboMap.hasLayer(o.marker));
    if (!items.length) {
      const p = el("p"); p.textContent = "Nenhuma ocorrência visível no momento."; box.append(p); return;
    }
    items.forEach(o => {
      const b = el("button", "list-item");
      b.type = "button";
      const t = el("strong"); t.textContent = o.d.titulo;
      const s = el("span");
      s.textContent = `${labels[o.status] || o.status} · ${o.d.tipo_categoria || "Outro"} · ${o.d.localizacao || ""}`;
      b.append(t, s);
      b.addEventListener("click", () => {
        listPanel.classList.remove("open");
        arboMap.setView(o.marker.getLatLng(), 16);
        o.marker.openPopup();
        setTimeout(() => { const m = o.marker.getElement(); if (m) m.focus(); }, 150);
      });
      box.append(b);
    });
  }

  /* ── Foco, diálogos e teclado ─────────────────────────── */
  const lastFocus = new WeakMap();
  const focusable = r => $$('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),textarea,select,[tabindex]:not([tabindex="-1"])', r)
    .filter(e => e.offsetParent !== null);
  const bannerActive = () => { const b = $("#map-loc-banner"); return !!b && b.style.display !== "" && b.style.display !== "none"; };

  const overlayObs = new MutationObserver(ms => ms.forEach(m => {
    const o = m.target;
    if (o.classList.contains("open")) {
      lastFocus.set(o, document.activeElement);
      const f = focusable(o);
      (f[0] || o).focus();
    } else if (lastFocus.has(o)) {
      const p = lastFocus.get(o);
      lastFocus.delete(o);
      if (!bannerActive() && p && p.focus) p.focus();
    }
  }));
  const watch = o => overlayObs.observe(o, { attributes: true, attributeFilter: ["class"] });

  document.addEventListener("keydown", e => {
    const o = $(".overlay.open");
    if (e.key === "Escape") {
      if (o) { const c = $(".sheet-close", o); if (c) c.click(); }
      else if (bannerActive() && typeof cancelarLocMapa === "function") cancelarLocMapa();
      return;
    }
    if (e.key === "Tab" && o) {
      const f = focusable(o);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { z.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === z) { a.focus(); e.preventDefault(); }
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches('[role="button"][onclick]')) {
      e.preventDefault();
      e.target.click();
    }
  });

  /* ── Marcar local no mapa por teclado/toque ───────────── */
  function setupBanner() {
    const bn = $("#map-loc-banner");
    if (!bn || $("#btn-confirma-centro")) return;
    bn.setAttribute("role", "alert");
    const c = el("button", "banner-btn");
    c.type = "button"; c.id = "btn-confirma-centro";
    c.textContent = "✓ Usar centro do mapa";
    c.addEventListener("click", () => { if (arboMap) arboMap.fire("click", { latlng: arboMap.getCenter() }); });
    bn.insertBefore(c, bn.lastElementChild);
    const hint = $("p:last-child", bn);
    if (hint) hint.textContent = "Toque no ponto, ou mova o mapa com as setas e confirme o centro";
    const cross = el("div"); cross.id = "map-crosshair"; cross.setAttribute("aria-hidden", "true"); cross.textContent = "+";
    const map = $("#leaflet-map"); if (map) map.append(cross);
    new MutationObserver(() => {
      const on = bannerActive();
      cross.style.display = on ? "block" : "none";
      if (on) setTimeout(() => c.focus(), 80);
    }).observe(bn, { attributes: true, attributeFilter: ["style"] });
  }

  /* ── ARIA / rótulos (reaplicado quando o DOM muda) ────── */
  function setAttrs(id, o) { const e = document.getElementById(id); if (e) Object.entries(o).forEach(([k, v]) => e.setAttribute(k, v)); }

  const EMOJI_RX = /(\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]*|[\u2713\u2715\u2630\u2192])/u;
  function ocultaEmojis(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => {
      const p = n.parentElement;
      if (!p || p.closest('[aria-hidden="true"],script,style,textarea,.sr-only,.leaflet-pane')) return NodeFilter.FILTER_REJECT;
      return EMOJI_RX.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    } });
    const nos = []; while (w.nextNode()) nos.push(w.currentNode);
    nos.forEach(n => {
      const frag = document.createDocumentFragment();
      n.nodeValue.split(EMOJI_RX).forEach(part => {
        if (!part) return;
        if (EMOJI_RX.test(part) && part.length <= 8) { const s = document.createElement("span"); s.setAttribute("aria-hidden", "true"); s.textContent = part; frag.append(s); }
        else frag.append(document.createTextNode(part));
      });
      n.replaceWith(frag);
    });
  }

  function enhance() {
    $$("svg:not([aria-hidden])").forEach(s => s.setAttribute("aria-hidden", "true"));
    $$(".login-left").forEach(e => e.setAttribute("aria-hidden", "true"));
    $$(".logo").forEach(l => { l.setAttribute("aria-hidden", "true"); l.setAttribute("role", "presentation"); l.tabIndex = -1; });
    ocultaEmojis(document.body);
    $$("label.form-label").forEach(l => {
      if (l.htmlFor) return;
      const n = l.nextElementSibling;
      const c = n && (n.matches("input,textarea") ? n : n.querySelector("input,textarea"));
      if (c) { if (!c.id) c.id = "f-" + Math.random().toString(36).slice(2, 8); l.htmlFor = c.id; }
    });
    setAttrs("login-email", { autocomplete: "email", inputmode: "email", "aria-required": "true" });
    setAttrs("login-senha", { autocomplete: "current-password", "aria-required": "true" });
    setAttrs("cad-nome",    { autocomplete: "name", "aria-required": "true" });
    setAttrs("cad-email",   { autocomplete: "email", inputmode: "email", "aria-required": "true" });
    setAttrs("cad-senha",   { autocomplete: "new-password", "aria-required": "true" });
    setAttrs("reset-email", { autocomplete: "email", inputmode: "email" });
    setAttrs("nd-titulo",   { "aria-required": "true" });
    setAttrs("nd-desc",     { "aria-required": "true" });

    $$(".profile-selector").forEach(g => { g.setAttribute("role", "radiogroup"); g.setAttribute("aria-label", "Tipo de perfil"); });
    $$(".tipo-grid").forEach(g => { g.setAttribute("role", "radiogroup"); g.setAttribute("aria-label", "Tipo de ocorrência"); });
    $$(".profile-selector button,.tipo-grid button").forEach(b => b.setAttribute("role", "radio"));
    $$(".filter-tabs").forEach(g => { g.setAttribute("role", "group"); g.setAttribute("aria-label", "Filtrar denúncias por status"); });
    $$(".notif-btn").forEach(b => b.setAttribute("aria-label", "Notificações"));
    $$(".sheet-close:not([aria-label])").forEach(b => b.setAttribute("aria-label", "Fechar"));
    $$(".input-suffix").forEach(s => s.setAttribute("aria-label", "Mostrar ou ocultar senha"));
    
    $$(".bottomnav").forEach(n => n.setAttribute("aria-label", "Navegação principal"));
    $$(".scroll-content,.login-right,.auth-simple-screen").forEach(m => m.setAttribute("role", "main"));
    $$(".overlay .sheet").forEach(s => {
      s.setAttribute("role", "dialog"); s.setAttribute("aria-modal", "true");
      const h = $("h2", s); if (h && h.id) s.setAttribute("aria-labelledby", h.id);
    });
    $$("[onclick]:not(button):not(input):not(a[href])").forEach(e => {
      if (!e.hasAttribute("role")) e.setAttribute("role", "button");
      if (!e.hasAttribute("tabindex")) e.tabIndex = 0;
    });
    
    const map = $("#leaflet-map");
    if (map) { map.setAttribute("role", "region"); map.setAttribute("aria-label", "Mapa de ocorrências"); }
    const ms = $("#screen-mapa");
    if (ms && !$("h1", ms)) { const h = el("h1", "sr-only"); h.textContent = "Mapa de ocorrências"; ms.prepend(h); }
    const lg = $(".map-legend");
    if (lg && !$(".list-btn", lg)) {
      const b = el("button", "legend-toggle-btn list-btn");
      b.type = "button"; b.textContent = "☰ Ver lista de ocorrências";
      b.addEventListener("click", () => { buildList(); listPanel.classList.add("open"); });
      lg.append(b);
    }
    const t = $("#toast"); if (t) { t.removeAttribute("role"); t.removeAttribute("aria-live"); }
    setupBanner();
  }

  function sync() {
    $$(".profile-option,.tipo-btn").forEach(b => b.setAttribute("aria-checked", String(b.classList.contains("selected") || b.classList.contains("sel"))));
    $$(".ftab,.legend-toggle-btn:not(.list-btn)").forEach(b => b.setAttribute("aria-pressed", String(b.classList.contains("active"))));
    $$(".nav-btn").forEach(b => b.classList.contains("active") ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
    const _cur = curTheme(), _nxt = NEXT[_cur], _nm = { light: "claro", gray: "cinza", dark: "escuro" };
    tbtn.removeAttribute("aria-pressed");
    if (tbtn.dataset.ic !== _nxt) { tbtn.dataset.ic = _nxt; tbtn.innerHTML = ICON[{ light: "sun", gray: "gray", dark: "moon" }[_nxt]]; }
    tbtn.dataset.tip = "Modo " + _nm[_nxt];
    tbtn.setAttribute("aria-label", "Tema atual: " + _nm[_cur] + ". Mudar para o modo " + _nm[_nxt]);
    $$("[data-theme]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.theme === prefs.theme)));
    $$("[data-cb]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cb === prefs.cb)));
    $$("[data-fs]").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.fs === prefs.fs)));
    $$("[data-pref]").forEach(b => b.setAttribute("aria-checked", String(!!prefs[b.dataset.pref])));
  }

  /* ── Foco e título ao trocar de tela ──────────────────── */
  const titles = { login: "Entrar", cadastro: "Criar conta", confirmacao: "Confirme seu e-mail", esqueci: "Redefinir senha", novasenha: "Nova senha", mapa: "Mapa", moderacao: "Moderação", ongs: "Parceiros", perfil: "Meu perfil" };
  let currentMain = null;
  const originalNavigate = window.navigate;
  if (typeof originalNavigate === "function") {
    window.navigate = function (screen) {
      originalNavigate.apply(this, arguments);
      document.title = "Arbo — " + (titles[screen] || "");
      const scr = $("#screen-" + screen);
      const m = scr && $(".scroll-content,.login-right,.auth-simple-screen", scr);
      if (m) m.tabIndex = -1;
      currentMain = m || (scr && $("h1", scr)) || null;
      enhance(); sync();
      const h = scr && $("h1", scr);
      if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
    };
  }

  const skip = $(".skip-link");
  if (skip) skip.addEventListener("click", e => { if (currentMain) { e.preventDefault(); currentMain.tabIndex = -1; currentMain.focus(); } });

  /* ── Início ───────────────────────────────────────────── */
  const live = el("div", "sr-only"); live.id = "a11y-live"; live.setAttribute("role", "status"); live.setAttribute("aria-live", "polite");
  const dock = el("div", "a11y-dock"); dock.append(fab, tbtn);
  document.body.append(dock, panel, listPanel, live);
  $$(".overlay").forEach(watch);
  applyPrefs();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyPrefs);
  enhance();
  let queued = false;
  new MutationObserver(muts => {
    if (muts.every(m => m.target.nodeType === 1 && m.target.closest(".leaflet-pane,.leaflet-control-container"))) return;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; enhance(); sync(); });
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
})();