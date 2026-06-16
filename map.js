/* ============================================================
   ARBO — map.js
   Mapa real com Leaflet.js + CartoDB Positron.
   Pins populados dinamicamente a partir do Supabase.

   Funções públicas (chamadas por app.js):
     initMap()              → inicializa o Leaflet
     adicionarPinMapa(d)    → adiciona um pin a partir de uma denúncia
     atualizarPinMapa(d)    → atualiza cor/popup de pin existente
     closePinPopup()        → fecha qualquer popup aberto
============================================================ */

/* ── ESTADO DO MAPA ─────────────────────────────────────── */
let arboMap     = null;
const pinMarkers = {}; // id → marker Leaflet

/* ── CORES E ÍCONES POR STATUS ──────────────────────────── */
const PIN_COLORS = {
  analise: "#D48A0C",  // amarelo — não verificada
  proc:    "#1E5C2F",  // verde   — procedente
  rec:     "#D63B2F",  // vermelho — recusada
};

const PIN_SVG = {
  analise: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="width:17px;height:17px">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>`,
  proc: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="width:17px;height:17px">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`,
  rec: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="width:17px;height:17px">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>`,
};

/* ── INICIALIZA O MAPA ──────────────────────────────────── */
function initMap() {
  arboMap = L.map("leaflet-map", {
    center: [-23.5505, -46.6333],
    zoom: 12,
    zoomControl: false,
    attributionControl: true,
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(arboMap);
}

/* ── CRIA ÍCONE LEAFLET A PARTIR DO STATUS ──────────────── */
function criarIcone(status) {
  const color = PIN_COLORS[status] || PIN_COLORS.analise;
  const svg   = PIN_SVG[status]   || PIN_SVG.analise;
  const cls   = status === "analise" ? "yellow" : status === "proc" ? "green" : "red";

  return L.divIcon({
    className: "",
    html: `<div class="arbo-pin arbo-pin-${cls}" style="background:${color}">${svg}</div>`,
    iconSize:   [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -22],
  });
}

/* ── MONTA HTML DO POPUP (seguro contra XSS) ────────────── */
function buildPopupHTML(d) {
  const visual = tipoVisual(d.tipo_categoria);

  const imgSection = d.img_url
    ? `<div class="popup-img"><img src="${esc(d.img_url)}" alt="${esc(d.titulo)}"></div>`
    : `<div class="popup-img" style="background:${visual.bg}"><span style="font-size:50px">${visual.emoji}</span></div>`;

  const badgeMap = {
    analise: { cls: "popup-badge-yellow", txt: "Não Verificada" },
    proc:    { cls: "popup-badge-green",  txt: "Procedente"     },
    rec:     { cls: "popup-badge-red",    txt: "Não procedente" },
  };
  const b = badgeMap[d.status] || badgeMap.analise;

  return `
    ${imgSection}
    <div class="popup-body">
      <div class="popup-title">${esc(d.titulo)}</div>
      <div class="popup-meta">
        <span>📍 ${esc(d.localizacao || "Localização não informada")}</span>
        <span>🕐 ${formatarTempo(d.created_at)}</span>
      </div>
      <div class="popup-badges">
        <span class="popup-badge popup-badge-gray">${esc(d.tipo_categoria || "Outro")}</span>
        <span class="popup-badge ${b.cls}">${b.txt}</span>
      </div>
    </div>`;
}

/* ── ADICIONA UM PIN AO MAPA ────────────────────────────── */
function adicionarPinMapa(d) {
  if (!arboMap) return;
  if (!d.latitude || !d.longitude) return;

  const marker = L.marker([d.latitude, d.longitude], {
    icon: criarIcone(d.status),
  }).addTo(arboMap);

  marker.bindPopup(buildPopupHTML(d), {
    maxWidth: 265,
    minWidth: 260,
    className: "arbo-popup",
  });

  pinMarkers[d.id] = marker;
}

/* ── ATUALIZA UM PIN EXISTENTE (após moderação) ─────────── */
function atualizarPinMapa(d) {
  const marker = pinMarkers[d.id];
  if (!marker) {
    adicionarPinMapa(d);
    return;
  }
  marker.setIcon(criarIcone(d.status));
  marker.setPopupContent(buildPopupHTML(d));
}

/* ── FECHA POPUP ABERTO ─────────────────────────────────── */
function closePinPopup() {
  if (arboMap) arboMap.closePopup();
}

/* ── OBSERVA TELA DO MAPA FICAR VISÍVEL ─────────────────── */
// O Leaflet precisa que o container seja visível para calcular dimensões.
const mapaScreen = document.getElementById("screen-mapa");
const mapObserver = new MutationObserver(() => {
  if (mapaScreen.classList.contains("active")) {
    if (!arboMap) {
      initMap();
      // Pins serão adicionados pelo app.js após initMap()
      window._mapReadyCallback && window._mapReadyCallback();
    } else {
      arboMap.invalidateSize();
    }
  }
});
mapObserver.observe(mapaScreen, { attributes: true, attributeFilter: ["class"] });
