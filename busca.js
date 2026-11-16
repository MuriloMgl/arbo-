/* ============================================================
   ARBO — busca.js : pesquisa do mapa
   Mostra ocorrências cadastradas e endereços/lugares (OpenStreetMap).
   Ao escolher um resultado, o mapa vai até lá.
============================================================ */
(function () {
  const ROTULO = { analise: "Não verificada", proc: "Procedente", resolvida: "Resolvida" };
  let box, lista, aviso, timer, ctrl, marcador;
  const campo = () => document.querySelector("#screen-mapa .search-input");

  function criar() {
    if (box) return;
    box = document.createElement("div"); box.className = "busca-res"; box.id = "busca-res"; box.hidden = true;
    lista = document.createElement("ul"); lista.className = "busca-lista";
    aviso = document.createElement("p"); aviso.className = "sr-only"; aviso.setAttribute("role", "status"); aviso.setAttribute("aria-live", "polite");
    box.append(lista, aviso);
    document.getElementById("screen-mapa").append(box);
    const c = campo(); if (c) { c.setAttribute("aria-controls", "busca-res"); c.setAttribute("aria-expanded", "false"); c.setAttribute("autocomplete", "off"); }
  }
  function fechar() { if (!box) return; box.hidden = true; const c = campo(); if (c) c.setAttribute("aria-expanded", "false"); }
  function abrir() { box.hidden = false; const c = campo(); if (c) c.setAttribute("aria-expanded", "true"); }

  function grupo(rot) { const li = document.createElement("li"); li.className = "busca-grupo"; li.textContent = rot; return li; }
  function item(titulo, sub, icone, acao) {
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.className = "busca-item";
    const i = document.createElement("span"); i.setAttribute("aria-hidden", "true"); i.textContent = icone;
    const t = document.createElement("span"); t.className = "busca-txt";
    const s1 = document.createElement("strong"); s1.textContent = titulo;
    const s2 = document.createElement("small"); s2.textContent = sub || "";
    t.append(s1, s2); b.append(i, t); b.addEventListener("click", acao); li.append(b); return li;
  }

  function ocorrencias(q) {
    const t = q.toLowerCase();
    return (typeof pinMarkers !== "undefined" ? Object.values(pinMarkers) : [])
      .filter(o => o.d && arboMap && arboMap.hasLayer(o.marker) && [o.d.titulo, o.d.localizacao, o.d.tipo_categoria, o.d.descricao].join(" ").toLowerCase().includes(t))
      .slice(0, 5);
  }
  async function lugares(q) {
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=br&accept-language=pt-BR&viewbox=-46.65,-23.40,-46.25,-23.70&q=" + encodeURIComponent(q);
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error("busca indisponível");
    return r.json();
  }

  function irOcorrencia(o) { fechar(); arboMap.setView(o.marker.getLatLng(), 17); o.marker.openPopup(); }
  function irLugar(p) {
    fechar();
    const ll = [parseFloat(p.lat), parseFloat(p.lon)];
    arboMap.flyTo(ll, 17);
    if (marcador) marcador.remove();
    marcador = L.circleMarker(ll, { radius: 9, color: "#fff", weight: 3, fillColor: "#0B57D0", fillOpacity: 1 }).addTo(arboMap);
    setTimeout(() => { if (marcador) { marcador.remove(); marcador = null; } }, 12000);
  }

  function mostrar(oc, lug, carregando, erro) {
    lista.textContent = "";
    if (oc.length) { lista.append(grupo("Ocorrências")); oc.forEach(o => lista.append(item(o.d.titulo, (ROTULO[o.status] || "") + " · " + (o.d.localizacao || ""), "⚠", () => irOcorrencia(o)))); }
    if (lug && lug.length) { lista.append(grupo("Locais")); lug.forEach(p => lista.append(item((p.name || p.display_name.split(",")[0]), p.display_name, "📍", () => irLugar(p)))); }
    const total = oc.length + (lug ? lug.length : 0);
    const msg = carregando ? "Buscando endereços…" : erro ? "Não foi possível buscar endereços agora." : (!total ? "Nenhum resultado encontrado." : "");
    if (msg) { const li = document.createElement("li"); li.className = "busca-msg"; li.textContent = msg; lista.append(li); }
    abrir();
    aviso.textContent = carregando ? "" : (total + (total === 1 ? " resultado" : " resultados"));
  }

  function pesquisar(q) {
    criar(); q = (q || "").trim(); clearTimeout(timer);
    if (q.length < 2) { if (ctrl) ctrl.abort(); fechar(); return; }
    const oc = ocorrencias(q);
    if (q.length < 3) { mostrar(oc, null, false); return; }
    mostrar(oc, null, true);
    timer = setTimeout(async () => {
      try { const lug = await lugares(q); if (campo() && campo().value.trim() === q) mostrar(oc, lug, false); }
      catch (e) { if (e.name !== "AbortError") mostrar(oc, [], false, true); }
    }, 450);
  }
  window.buscarMapa = pesquisar;

  document.addEventListener("keydown", e => {
    const c = campo();
    if (!box || box.hidden) return;
    const botoes = [...box.querySelectorAll(".busca-item")];
    if (e.target === c) {
      if (e.key === "ArrowDown" && botoes[0]) { e.preventDefault(); botoes[0].focus(); }
      else if (e.key === "Enter" && botoes[0]) { e.preventDefault(); botoes[0].click(); }
      else if (e.key === "Escape") { fechar(); }
    } else if (box.contains(e.target)) {
      const i = botoes.indexOf(e.target);
      if (e.key === "ArrowDown") { e.preventDefault(); (botoes[i + 1] || botoes[0]).focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (i > 0) botoes[i - 1].focus(); else c.focus(); }
      else if (e.key === "Escape") { fechar(); c.focus(); }
    }
  });
  document.addEventListener("click", e => { if (box && !box.hidden && !box.contains(e.target) && !e.target.closest("#screen-mapa .search-bar")) fechar(); });
})();
