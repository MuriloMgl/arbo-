/* ============================================================
   ARBO — perto.js : "Ocorrências perto de mim" (lista ordenada por distância)
   Usa o GPS; se não der, usa o centro do mapa. Criado antes do a11y.js.
============================================================ */
(function () {
  function h(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  const overlay = h("div", "overlay modal-gen"); overlay.id = "modal-perto";
  const sheet = h("div", "sheet");
  sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-labelledby", "perto-title");
  const head = h("div", "sheet-header");
  const title = h("h2", null, "Perto de mim"); title.id = "perto-title";
  const close = h("button", "sheet-close", "✕"); close.type = "button"; close.setAttribute("aria-label", "Fechar");
  close.addEventListener("click", () => overlay.classList.remove("open"));
  head.append(title, close);
  const info = h("p", "perto-info");
  const lista = h("div", "perto-lista");
  sheet.append(head, info, lista);
  overlay.append(sheet);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.remove("open"); });
  document.body.append(overlay);

  function dist(a, b, c, d) {
    const R = 6371000, r = x => x * Math.PI / 180;
    const dLat = r(c - a), dLng = r(d - b);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const fmt = m => m < 1000 ? Math.max(10, Math.round(m / 10) * 10) + " m" : (m / 1000).toFixed(1).replace(".", ",") + " km";
  const ROTULO = { analise: "Não verificada", proc: "Procedente" };

  window.abrirPerto = async function () {
    if (typeof arboMap === "undefined" || !arboMap) { showToast("Mapa ainda não carregado."); return; }
    lista.replaceChildren(); info.textContent = "Buscando sua localização…";
    overlay.classList.add("open");
    let ponto, doGps = true;
    try { ponto = await obterPosicao(); }
    catch (e) { const c = arboMap.getCenter(); ponto = { lat: c.lat, lng: c.lng }; doGps = false; showToast(msgErroGeo(e)); }
    info.textContent = doGps ? "Ordenadas pela distância até você." : "Sem GPS: ordenadas pela distância até o centro do mapa.";
    const itens = Object.values(pinMarkers)
      .filter(o => ROTULO[o.status] && o.d.latitude && o.d.longitude)
      .map(o => ({ o, m: dist(ponto.lat, ponto.lng, o.d.latitude, o.d.longitude) }))
      .sort((a, b) => a.m - b.m).slice(0, 15);
    if (!itens.length) { lista.append(estadoVazio({ icone: "leaf", titulo: "Nenhuma ocorrência ativa", texto: "Não há ocorrências abertas no mapa agora." })); return; }
    itens.forEach(({ o, m }) => {
      const b = h("button", "perto-item"); b.type = "button";
      const t = h("div", "perto-txt");
      t.append(h("strong", null, o.d.titulo || "Ocorrência"), h("span", null, (o.d.tipo_categoria || "Outro") + " · " + ROTULO[o.status]));
      b.append(t, h("span", "perto-dist", fmt(m)));
      b.setAttribute("aria-label", (o.d.titulo || "Ocorrência") + ", a " + fmt(m));
      b.addEventListener("click", () => {
        overlay.classList.remove("open");
        arboMap.setView([o.d.latitude, o.d.longitude], 18);
        if (arboMap.hasLayer(o.marker)) o.marker.openPopup();
      });
      lista.append(b);
    });
  };
})();