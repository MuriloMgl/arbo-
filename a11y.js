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
  const prefs = Object.assign({ fs: 1, hc: false, rm: false, cb: "none", theme: "auto" }, store.get("arbo-a11y", {}));
  function applyPrefs() {
    const r = document.documentElement;
    r.style.setProperty("--fs", prefs.fs);
    r.classList.toggle("hc", !!prefs.hc);
    const escuro = prefs.theme === "dark" || (prefs.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    r.classList.toggle("dark", escuro && !prefs.hc);
    r.classList.toggle("rm", !!prefs.rm);
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
  const fab = el("button", "a11y-fab");
  fab.type = "button";
  fab.innerHTML = '<span aria-hidden="true">Aa</span>';
  fab.setAttribute("aria-label", "Opções de acessibilidade");
  fab.setAttribute("aria-haspopup", "dialog");
  fab.setAttribute("aria-expanded", "false");

  const tbtn = el("button", "a11y-fab theme-fab");
  tbtn.type = "button"; tbtn.setAttribute("aria-label", "Alternar modo escuro");
  tbtn.addEventListener("click", () => { prefs.theme = document.documentElement.classList.contains("dark") ? "light" : "dark"; applyPrefs(); });

  const panel = el("div", "overlay");
  panel.id = "modal-a11y";
  panel.innerHTML = `<div class="sheet sheet-sm">
    <div class="sheet-header"><h2 id="a11y-title">Acessibilidade</h2><button type="button" class="sheet-close" data-close>✕</button></div>
    <p class="a11y-label" id="th-lbl">Tema</p>
    <div class="a11y-row" role="group" aria-labelledby="th-lbl">
      <button type="button" class="a11y-opt" data-theme="auto">Automático</button>
      <button type="button" class="a11y-opt" data-theme="light">Claro</button>
      <button type="button" class="a11y-opt" data-theme="dark">Escuro</button>
    </div>
    <p class="a11y-label" id="cb-lbl">Cores para daltonismo</p>
    <div class="a11y-row" role="group" aria-labelledby="cb-lbl">
      <button type="button" class="a11y-opt" data-cb="none">Padrão</button>
      <button type="button" class="a11y-opt" data-cb="rg">Vermelho-verde</button>
      <button type="button" class="a11y-opt" data-cb="by">Azul-amarelo</button>
    </div>
    <p class="a11y-label" id="fs-lbl">Tamanho do texto</p>
    <div class="a11y-row" role="group" aria-labelledby="fs-lbl">
      <button type="button" class="a11y-opt" data-fs="1">Normal</button>
      <button type="button" class="a11y-opt" data-fs="1.2">Grande</button>
      <button type="button" class="a11y-opt" data-fs="1.4">Muito grande</button>
    </div>
    <div class="a11y-row">
      <button type="button" class="a11y-opt" role="switch" data-pref="hc">Alto contraste</button>
      <button type="button" class="a11y-opt" role="switch" data-pref="rm">Reduzir animações</button>
    </div>
    <div class="a11y-row"><button type="button" class="a11y-opt" id="a11y-speak">🔊 Ler esta tela em voz alta</button></div>
  </div>`;

  const closePanel = () => { panel.classList.remove("open"); fab.setAttribute("aria-expanded", "false"); };
  fab.addEventListener("click", () => { panel.classList.add("open"); fab.setAttribute("aria-expanded", "true"); });
  panel.addEventListener("click", e => {
    if (e.target === panel) return closePanel();
    const b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-close")) closePanel();
    else if (b.dataset.fs) { prefs.fs = +b.dataset.fs; applyPrefs(); }
    else if (b.dataset.theme) { prefs.theme = b.dataset.theme; applyPrefs(); }
    else if (b.dataset.cb) { prefs.cb = b.dataset.cb; applyPrefs(); }
    else if (b.dataset.pref) { prefs[b.dataset.pref] = !prefs[b.dataset.pref]; applyPrefs(); }
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
    const _esc = document.documentElement.classList.contains("dark");
    tbtn.setAttribute("aria-pressed", String(_esc)); tbtn.innerHTML = _esc ? '<span aria-hidden="true">☀</span>' : '<span aria-hidden="true">☾</span>';
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
  document.body.append(fab, tbtn, panel, listPanel, live);
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
