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

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(arboMap);

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

  Object.values(pinMarkers).forEach(obj => {
    if (obj.status === "resolvida") {
      mostrarResolvidas ? obj.marker.addTo(arboMap) : obj.marker.remove();
    }
  });
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
function buildPopupHTML(d) {
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

/* ── ADICIONA PIN ───────────────────────────────────────── */
function adicionarPinMapa(d) {
  if (!arboMap) return;
  if (!d.latitude || !d.longitude) return;
  if (d.status === "rec") return;

  const marker = L.marker([d.latitude, d.longitude], { icon: criarIcone(d.status), keyboard: true,
    title: `${d.titulo} — ${({analise:'Não verificada',proc:'Procedente',resolvida:'Resolvida'})[d.status] || ''}` });
  marker.bindPopup(buildPopupHTML(d), { maxWidth: 265, minWidth: 260, className: "arbo-popup" });

  if (d.status !== "resolvida" || mostrarResolvidas) marker.addTo(arboMap);
  pinMarkers[d.id] = { marker, status: d.status, d };
}

/* ── ATUALIZA PIN ───────────────────────────────────────── */
function atualizarPinMapa(d) {
  const obj = pinMarkers[d.id];
  if (d.status === "rec") {
    if (obj) { obj.marker.remove(); delete pinMarkers[d.id]; }
    return;
  }
  if (!obj) { adicionarPinMapa(d); return; }
  obj.marker.setIcon(criarIcone(d.status));
  obj.marker.setPopupContent(buildPopupHTML(d));
  obj.status = d.status;
  obj.d = d;
  if (d.status === "resolvida" && !mostrarResolvidas) obj.marker.remove();
}

/* ── REMOVE PIN (denúncia excluída) ─────────────────────── */
function removerPinMapa(id) {
  const o = pinMarkers[id];
  if (o) { o.marker.remove(); delete pinMarkers[id]; }
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
