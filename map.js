/* ============================================================
   ARBO — map.js  v3
   Melhorias:
   - Pins recusadas nunca aparecem
   - Pins resolvidas ocultos por padrão, toggle via showResolvidas
   - Foto aparece no popup
   - Toggle de localização no modal (GPS ou clique no mapa)
============================================================ */

let arboMap      = null;
let locMarker    = null;   // marcador temporário de localização no modal
let modoLocMapa  = false;  // true = usuário está clicando no mapa para escolher local
const pinMarkers = {};     // id → { marker, status }
let mostrarResolvidas = false;

/* ── CORES E ÍCONES POR STATUS ──────────────────────────── */
const PIN_COLORS = {
  analise:   "#D48A0C",
  proc:      "#1E5C2F",
  resolvida: "#1565C0",
};

const PIN_SVG = {
  analise: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="width:17px;height:17px">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>`,
  proc: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="width:17px;height:17px">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`,
  resolvida: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="width:17px;height:17px">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
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

  // Clique no mapa para selecionar localização da denúncia
  arboMap.on("click", (e) => {
    if (!modoLocMapa) return;
    const { lat, lng } = e.latlng;
    window._coordsSelecionadas = { lat, lng };

    if (locMarker) locMarker.remove();
    locMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;background:#1E5C2F;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
    }).addTo(arboMap);

    // Atualiza label no modal
    const locStatus = document.getElementById("loc-status");
    if (locStatus) {
      locStatus.textContent = `Ponto selecionado: ${lat.toFixed(4)}, ${lng.toFixed(4)} ✓`;
      locStatus.style.color = "var(--g700)";
    }

    // Sai do modo de seleção
    modoLocMapa = false;
    arboMap.getContainer().style.cursor = "";
    const btn = document.getElementById("btn-selecionar-mapa");
    if (btn) btn.textContent = "📍 Selecionar no mapa";
  });
}

/* ── TOGGLE MODO SELEÇÃO DE LOCAL ───────────────────────── */
function ativarModoLocMapa() {
  if (!arboMap) return;
  modoLocMapa = true;
  arboMap.getContainer().style.cursor = "crosshair";

  // Fecha o modal e avisa o usuário
  document.getElementById("modal-nd").classList.remove("open");
  showToast("Clique no mapa para marcar o local da ocorrência");

  const btn = document.getElementById("btn-selecionar-mapa");
  if (btn) btn.textContent = "🔄 Aguardando clique no mapa...";

  // Reabre o modal após 200ms para não capturar o clique atual
  setTimeout(() => {
    document.getElementById("modal-nd").classList.add("open");
  }, 200);
}

/* ── TOGGLE RESOLVIDAS ──────────────────────────────────── */
function toggleResolvidas(btn) {
  mostrarResolvidas = !mostrarResolvidas;
  btn.textContent = mostrarResolvidas ? "🔵 Ocultar resolvidas" : "🔵 Mostrar resolvidas";
  btn.classList.toggle("active", mostrarResolvidas);

  Object.entries(pinMarkers).forEach(([id, obj]) => {
    if (obj.status === "resolvida") {
      if (mostrarResolvidas) {
        obj.marker.addTo(arboMap);
      } else {
        obj.marker.remove();
      }
    }
  });
}

/* ── CRIA ÍCONE ─────────────────────────────────────────── */
function criarIcone(status) {
  const color = PIN_COLORS[status] || PIN_COLORS.analise;
  const svg   = PIN_SVG[status]   || PIN_SVG.analise;
  const cls   = status === "analise" ? "yellow" : status === "proc" ? "green" : "blue";

  return L.divIcon({
    className: "",
    html: `<div class="arbo-pin arbo-pin-${cls}" style="background:${color}">${svg}</div>`,
    iconSize:   [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -22],
  });
}

/* ── POPUP HTML ─────────────────────────────────────────── */
function buildPopupHTML(d) {
  const visual = tipoVisual(d.tipo_categoria);

  const imgSection = d.img_url
    ? `<div class="popup-img"><img src="${esc(d.img_url)}" alt="${esc(d.titulo)}" style="width:100%;height:100%;object-fit:cover"></div>`
    : `<div class="popup-img" style="background:${visual.bg}"><span style="font-size:50px">${visual.emoji}</span></div>`;

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
        <span>📍 ${esc(d.localizacao || "Localização não informada")}</span>
        <span>🕐 ${formatarTempo(d.created_at)}</span>
      </div>
      <div class="popup-badges">
        <span class="popup-badge popup-badge-gray">${esc(d.tipo_categoria || "Outro")}</span>
        <span class="popup-badge ${b.cls}">${b.txt}</span>
      </div>
    </div>`;
}

/* ── ADICIONA PIN ───────────────────────────────────────── */
function adicionarPinMapa(d) {
  if (!arboMap) return;
  if (!d.latitude || !d.longitude) return;
  if (d.status === "rec") return; // recusadas nunca aparecem

  const marker = L.marker([d.latitude, d.longitude], {
    icon: criarIcone(d.status),
  });

  marker.bindPopup(buildPopupHTML(d), {
    maxWidth: 265,
    minWidth: 260,
    className: "arbo-popup",
  });

  // Resolvidas ficam ocultas por padrão
  if (d.status !== "resolvida" || mostrarResolvidas) {
    marker.addTo(arboMap);
  }

  pinMarkers[d.id] = { marker, status: d.status };
}

/* ── ATUALIZA PIN ───────────────────────────────────────── */
function atualizarPinMapa(d) {
  const obj = pinMarkers[d.id];

  if (d.status === "rec") {
    // Remove do mapa se foi recusada
    if (obj) { obj.marker.remove(); delete pinMarkers[d.id]; }
    return;
  }

  if (!obj) {
    adicionarPinMapa(d);
    return;
  }

  obj.marker.setIcon(criarIcone(d.status));
  obj.marker.setPopupContent(buildPopupHTML(d));
  obj.status = d.status;

  if (d.status === "resolvida" && !mostrarResolvidas) {
    obj.marker.remove();
  }
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
