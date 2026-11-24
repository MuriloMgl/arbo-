/* ============================================================
   ARBO — map.js  v4
   - Bug "selecionar no mapa" corrigido: banner fixo, sem modal subindo
   - Cursor crosshair visível
   - Pins recusadas nunca aparecem
   - Resolvidas ocultas por padrão
   - Foto no popup
============================================================ */

// Ponto inicial: Fatec Ferraz de Vasconcelos (Rua Carlos de Carvalho, 200 - Jd. São João).
// Coordenada do centro da rua (IBGE). Para ajustar, mude os dois números abaixo.
const CENTRO_INICIAL = [-23.53126, -46.3696];
const ZOOM_INICIAL   = 16;

let arboMap           = null;
let locMarker         = null;
let modoLocMapa       = false;
const pinMarkers      = {};
let mostrarResolvidas = false;
let camadaRua = null, camadaSat = null, marcadorEu = null, circuloEu = null;
let filtroCat         = "todas";
function pinVisivel(o) { return (filtroCat === "todas" || o.d.tipo_categoria === filtroCat) && (o.status !== "resolvida" || mostrarResolvidas); }
function aplicarFiltrosMapa() {
  if (!arboMap) return;
  Object.values(pinMarkers).forEach(o => { pinVisivel(o) ? o.marker.addTo(arboMap) : o.marker.remove(); });
  if (typeof refreshHeat === "function") refreshHeat();
}
function filtrarCategoria(cat) {
  filtroCat = cat;
  aplicarFiltrosMapa();
  const n = Object.values(pinMarkers).filter(pinVisivel).length;
  showToast(cat === "todas" ? "Mostrando todas as ocorrências" : n + " ocorrência(s): " + cat);
}

/* ── CORES E ÍCONES ─────────────────────────────────────── */
const PIN_COLORS = {
  analise:   "#D48A0C",
  proc:      "#1E5C2F",
  resolvida: "#1565C0",
};

const PIN_SVG = {
  analise: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="width:17px;height:17px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  proc:     `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="width:17px;height:17px"><polyline points="20 6 9 17 4 12"/></svg>`,
  resolvida:`<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="width:17px;height:17px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
};

/* ── INICIALIZA O MAPA ──────────────────────────────────── */
function initMap() {
  arboMap = L.map("leaflet-map", {
    center: CENTRO_INICIAL,
    zoom: ZOOM_INICIAL,
    zoomControl: true,
    attributionControl: true,
  });

  camadaRua = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  });
  camadaSat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Imagens © Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
  });
  let sat = false;
  try { sat = localStorage.getItem("arbo-sat") === "1"; } catch (e) { /* sem storage */ }
  (sat ? camadaSat : camadaRua).addTo(arboMap);
  arboMap.getContainer().classList.toggle("arbo-sat", sat);
  criarControlesMapa(sat);

  // Botão "Ver detalhes" dentro do popup (o Leaflet bloqueia cliques que subiriam até o document)
  arboMap.on("popupopen", (ev) => {
    const el = ev.popup.getElement && ev.popup.getElement();
    const btn = el && el.querySelector("[data-det]");
    if (btn) btn.addEventListener("click", () => { if (typeof abrirDetalhe === "function") abrirDetalhe(btn.getAttribute("data-det")); });
  });

  // Clique no mapa para selecionar localização
  arboMap.on("click", (e) => {
    if (!modoLocMapa) return;

    const { lat, lng } = e.latlng;
    window._coordsSelecionadas = { lat, lng };

    // Marca o ponto
    if (locMarker) locMarker.remove();
    locMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: "",
        html: `<div style="width:20px;height:20px;background:#1E5C2F;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    }).addTo(arboMap);

    // Desativa modo seleção
    desativarModoLocMapa();

    // Esconde banner
    const banner = document.getElementById("map-loc-banner");
    if (banner) banner.style.display = "none";

    // Atualiza status no modal
    const locStatus = document.getElementById("loc-status");
    if (locStatus) {
      locStatus.textContent = `📍 Ponto selecionado: ${lat.toFixed(4)}, ${lng.toFixed(4)} ✓`;
      locStatus.style.color = "var(--g700)";
    }

    // Reabre o modal
    document.getElementById("modal-nd").classList.add("open");
  });
}

/* ── ATIVA MODO SELEÇÃO DE LOCAL ────────────────────────── */
function ativarModoLocMapa() {
  if (!arboMap) {
    showToast("Mapa ainda não carregado. Tente novamente.");
    return;
  }

  modoLocMapa = true;

  // Fecha o modal completamente
  document.getElementById("modal-nd").classList.remove("open");

  // Mostra banner fixo no topo do mapa
  const banner = document.getElementById("map-loc-banner");
  if (banner) banner.style.display = "flex";

  // Cursor crosshair no mapa
  arboMap.getContainer().style.cursor = "crosshair";
}

function desativarModoLocMapa() {
  modoLocMapa = false;
  if (arboMap) arboMap.getContainer().style.cursor = "";
  const banner = document.getElementById("map-loc-banner");
  if (banner) banner.style.display = "none";
}

/* Cancelar seleção via banner */
function cancelarLocMapa() {
  desativarModoLocMapa();
  document.getElementById("modal-nd").classList.add("open");
}

/* ── TOGGLE RESOLVIDAS ──────────────────────────────────── */
function toggleResolvidas(btn) {
  mostrarResolvidas = !mostrarResolvidas;
  btn.textContent = mostrarResolvidas ? "🟢 Ocultar resolvidas" : "🟢 Mostrar resolvidas";
  btn.classList.toggle("active", mostrarResolvidas);

  aplicarFiltrosMapa();
}

/* ── ÍCONE ──────────────────────────────────────────────── */
function criarIcone(status) {
  const color = PIN_COLORS[status] || PIN_COLORS.analise;
  const svg   = PIN_SVG[status]   || PIN_SVG.analise;
  const cls   = status === "analise" ? "yellow" : status === "proc" ? "green" : "blue";

  return L.divIcon({
    className: "",
    html: `<div class="arbo-pin arbo-pin-${cls}" style="background:${color}">${svg}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

/* ── POPUP ──────────────────────────────────────────────── */
function buildPopupHTMLOld(d) {
  const visual = tipoVisual(d.tipo_categoria);
  const imgSection = d.img_url
    ? `<div class="popup-img"><img src="${esc(d.img_url)}" alt="${esc(d.img_alt || 'Foto da ocorrência: ' + d.titulo)}" style="width:100%;height:100%;object-fit:cover"></div>`
    : `<div class="popup-img" style="background:${visual.bg}"><span style="font-size:calc(50px*var(--fs,1))">${visual.emoji}</span></div>`;

  const badgeMap = {
    analise:   { cls: "popup-badge-yellow", txt: "Não Verificada" },
    proc:      { cls: "popup-badge-green",  txt: "Procedente"     },
    rec:       { cls: "popup-badge-red",    txt: "Não procedente" },
    resolvida: { cls: "popup-badge-blue",   txt: "Resolvida"      },
  };
  const b = badgeMap[d.status] || badgeMap.analise;

  return `
    ${imgSection}
    <div class="popup-body">
      <div class="popup-title">${esc(d.titulo)}</div>
      <div class="popup-meta">
        <span><span aria-hidden="true">📍</span> ${esc(d.localizacao || "Localização não informada")}</span>
        <span><span aria-hidden="true">🕐</span> ${formatarTempo(d.created_at)}</span>
      </div>
      <div class="popup-badges">
        <span class="popup-badge popup-badge-gray">${esc(d.tipo_categoria || "Outro")}</span>
        <span class="popup-badge ${b.cls}">${b.txt}</span>
      </div>
    </div>`;
}

function buildPopupHTML(d) {
  const visual = tipoVisual(d.tipo_categoria);
  const b = ({
    analise:   { cls: "popup-badge-yellow", txt: "Não Verificada" },
    proc:      { cls: "popup-badge-green",  txt: "Procedente"     },
    rec:       { cls: "popup-badge-red",    txt: "Não procedente" },
    resolvida: { cls: "popup-badge-blue",   txt: "Resolvida"      },
  })[d.status] || { cls: "popup-badge-yellow", txt: "Não Verificada" };
  const img = d.img_url
    ? `<img src="${esc(d.img_url)}" alt="${esc(d.img_alt || 'Foto da ocorrência: ' + d.titulo)}" loading="lazy">`
    : `<span class="popup-emoji" aria-hidden="true">${visual.emoji}</span>`;
  const desc = d.descricao ? `<p class="popup-desc">${esc(d.descricao)}</p>` : "";
  return `
    <div class="popup-img" style="background:${visual.bg}">${img}<span class="popup-badge popup-chip ${b.cls}">${b.txt}</span></div>
    <div class="popup-body">
      <div class="popup-cat"><span aria-hidden="true">${visual.emoji}</span> ${esc(d.tipo_categoria || "Outro")}</div>
      <div class="popup-title">${esc(d.titulo)}</div>
      ${desc}
      <div class="popup-meta">
        <span><span aria-hidden="true">📍</span> ${esc(d.localizacao || "Localização não informada")}</span>
        <span><span aria-hidden="true">🕐</span> ${formatarTempo(d.created_at)}</span>
      </div>
      <button type="button" class="popup-more" data-det="${esc(d.id)}">Ver detalhes <span aria-hidden="true">→</span></button>
    </div>`;
}

/* ── ADICIONA PIN ───────────────────────────────────────── */
function adicionarPinMapa(d) {
  if (!arboMap) return;
  if (!d.latitude || !d.longitude) return;
  if (d.status === "rec") return;

  const marker = L.marker([d.latitude, d.longitude], { icon: criarIcone(d.status), keyboard: true,
    title: `${d.titulo} — ${({analise:'Não verificada',proc:'Procedente',resolvida:'Resolvida'})[d.status] || ''}` });
  marker.bindPopup(buildPopupHTML(d), { maxWidth: 265, minWidth: 260, className: "arbo-popup" });

  pinMarkers[d.id] = { marker, status: d.status, d };
  if (pinVisivel(pinMarkers[d.id])) marker.addTo(arboMap);
  window.arboDenCache && (window.arboDenCache[d.id] = d);
  refreshHeat();
}

/* ── ATUALIZA PIN ───────────────────────────────────────── */
function atualizarPinMapa(d) {
  const obj = pinMarkers[d.id];
  if (d.status === "rec") {
    if (obj) { obj.marker.remove(); delete pinMarkers[d.id]; refreshHeat(); }
    return;
  }
  if (!obj) { adicionarPinMapa(d); return; }
  obj.marker.setIcon(criarIcone(d.status));
  obj.marker.setPopupContent(buildPopupHTML(d));
  obj.status = d.status;
  obj.d = d;
  window.arboDenCache && (window.arboDenCache[d.id] = d);
  pinVisivel(obj) ? obj.marker.addTo(arboMap) : obj.marker.remove();
  refreshHeat();
}

/* ── REMOVE PIN (denúncia excluída) ─────────────────────── */
function removerPinMapa(id) {
  const o = pinMarkers[id];
  if (o) { o.marker.remove(); delete pinMarkers[id]; refreshHeat(); }
}

/* ── FECHA POPUP ────────────────────────────────────────── */
function closePinPopup() {
  if (arboMap) arboMap.closePopup();
}

/* ── OBSERVER ───────────────────────────────────────────── */
const mapaScreen = document.getElementById("screen-mapa");
const mapObserver = new MutationObserver(() => {
  if (mapaScreen.classList.contains("active")) {
    if (!arboMap) {
      initMap();
      window._mapReadyCallback && window._mapReadyCallback();
    } else {
      arboMap.invalidateSize();
    }
  }
});
mapObserver.observe(mapaScreen, { attributes: true, attributeFilter: ["class"] });


/* ── MAPA DE CALOR ─────────────────────────────────────────
   Intensidade por ocorrência (procedente pesa mais) e raio que acompanha o zoom,
   para o calor representar área real. Pontos isolados ficam verdes/amarelos;
   onde se acumulam várias ocorrências, vira laranja/vermelho. */
let heatOn = false, heatLayer = null;
const PESO_CALOR = { proc: 1, analise: 0.7 };
function pontosCalor() {
  return Object.values(pinMarkers)
    .filter(o => PESO_CALOR[o.status] && o.d.latitude && o.d.longitude && (filtroCat === "todas" || o.d.tipo_categoria === filtroCat))
    .map(o => [o.d.latitude, o.d.longitude, PESO_CALOR[o.status]]);
}
function raioCalor() { return Math.max(28, Math.min(80, (arboMap.getZoom() - 8) * 6)); }
function ajustarCalor() {
  if (!heatOn || !heatLayer || !arboMap) return;
  const r = raioCalor();
  heatLayer.setOptions({ radius: r, blur: Math.round(r * 0.75) });
}
function refreshHeat() {
  if (!heatOn || !arboMap || !heatLayer) return;
  heatLayer.setLatLngs(pontosCalor());
}
function toggleHeat(btn) {
  if (!arboMap) { showToast("Mapa ainda não carregado."); return; }
  if (typeof L.heatLayer !== "function") { showToast("Não foi possível carregar o mapa de calor (sem internet?)."); return; }
  heatOn = !heatOn;
  if (heatOn) {
    if (!heatLayer) {
      heatLayer = L.heatLayer([], { radius: raioCalor(), blur: Math.round(raioCalor() * 0.75), maxZoom: 18, max: 2.5, minOpacity: 0.3,
        gradient: { 0.15: "#2E7D32", 0.35: "#9CCC65", 0.55: "#FFEB3B", 0.75: "#FF9800", 1: "#C62828" } });
      arboMap.on("zoomend", ajustarCalor);
    }
    heatLayer.setLatLngs(pontosCalor());
    ajustarCalor();
    heatLayer.addTo(arboMap);
  } else if (heatLayer) {
    heatLayer.remove();
  }
  arboMap.getContainer().classList.toggle("heat-on", heatOn);
  const esc = document.getElementById("heat-scale");
  if (esc) esc.hidden = !heatOn;
  btn.classList.toggle("active", heatOn);
  btn.textContent = heatOn ? "🔥 Ocultar mapa de calor" : "🔥 Mapa de calor";
  btn.setAttribute("aria-pressed", String(heatOn));
  showToast(heatOn ? "Mapa de calor ligado: vermelho = mais ocorrências" : "Mapa de calor desligado");
}


/* ── CONTROLES DO MAPA: minha localização + satélite ───────── */
function criarControlesMapa(satInicial) {
  const Ctl = L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const box = L.DomUtil.create("div", "leaflet-bar arbo-ctl");
      const mk = (cls, rotulo, svg, fn) => {
        const b = L.DomUtil.create("button", "arbo-ctl-btn " + cls, box);
        b.type = "button"; b.setAttribute("aria-label", rotulo); b.title = rotulo;
        b.innerHTML = svg;
        L.DomEvent.on(b, "click", (e) => { L.DomEvent.stop(e); fn(b); });
        return b;
      };
      mk("arbo-ctl-loc", "Ir para a minha localização",
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg>', irParaMinhaLocalizacao);
      const sat = mk("arbo-ctl-sat", "Alternar entre mapa de ruas e satélite",
        '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/></svg>', alternarSatelite);
      sat.setAttribute("aria-pressed", String(!!satInicial));
      return box;
    },
  });
  new Ctl().addTo(arboMap);
}

function alternarSatelite() {
  if (!arboMap) return;
  const virarSat = !arboMap.hasLayer(camadaSat);
  if (virarSat) { camadaRua.remove(); camadaSat.addTo(arboMap); } else { camadaSat.remove(); camadaRua.addTo(arboMap); }
  arboMap.getContainer().classList.toggle("arbo-sat", virarSat);
  const b = document.querySelector(".arbo-ctl-sat"); if (b) b.setAttribute("aria-pressed", String(virarSat));
  try { localStorage.setItem("arbo-sat", virarSat ? "1" : "0"); } catch (e) { /* sem storage */ }
  showToast(virarSat ? "Mapa de satélite" : "Mapa de ruas");
}

/* Posição do usuário (reaproveita a última por 60 s); falhas viram mensagens claras */
function obterPosicao() {
  return new Promise((ok, falha) => {
    if (window._ultimaPos && Date.now() - window._ultimaPos.t < 60000) { ok(window._ultimaPos); return; }
    if (!navigator.geolocation) { falha({ code: 0 }); return; }
    navigator.geolocation.getCurrentPosition(
      p => { window._ultimaPos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, t: Date.now() }; ok(window._ultimaPos); },
      e => falha(e), { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  });
}
function msgErroGeo(e) {
  return e && e.code === 1 ? "Permita o acesso à localização no navegador para usar este recurso."
       : e && e.code === 3 ? "A localização demorou demais. Tente de novo."
       : "Não foi possível obter sua localização.";
}

async function irParaMinhaLocalizacao() {
  if (!arboMap) return;
  try {
    const p = await obterPosicao();
    arboMap.setView([p.lat, p.lng], Math.max(arboMap.getZoom(), 17));
    if (marcadorEu) marcadorEu.remove();
    if (circuloEu) circuloEu.remove();
    circuloEu = L.circle([p.lat, p.lng], { radius: Math.min(p.acc || 30, 200), color: "#1565C0", weight: 1, fillOpacity: 0.12, interactive: false }).addTo(arboMap);
    marcadorEu = L.circleMarker([p.lat, p.lng], { radius: 8, color: "#fff", weight: 3, fillColor: "#1565C0", fillOpacity: 1, interactive: false }).addTo(arboMap);
    showToast("Você está aqui");
  } catch (e) { showToast(msgErroGeo(e)); }
}