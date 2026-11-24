/* ============================================================
   ARBO — detalhe.js
   Tela de detalhes da ocorrência (foto, descrição, local, andamento).
   Sem innerHTML com dados de usuário: tudo via createElement/textContent.
============================================================ */
(function () {
  const STATUS = {
    analise:   { cls: "badge-yellow", txt: "Não Verificada" },
    proc:      { cls: "badge-green",  txt: "Procedente" },
    rec:       { cls: "badge-red",    txt: "Não procedente" },
    resolvida: { cls: "badge-blue",   txt: "Resolvida" },
  };

  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* ── Estrutura fixa (criada uma vez, antes do a11y.js) ── */
  const overlay = h("div", "overlay modal-gen");
  overlay.id = "modal-det";
  const sheet = h("div", "sheet sheet-det");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-labelledby", "det-title");

  const head = h("div", "sheet-header");
  const title = h("h2", null, "Detalhes da ocorrência");
  title.id = "det-title";
  const close = h("button", "sheet-close", "✕");
  close.type = "button";
  close.setAttribute("aria-label", "Fechar");
  close.addEventListener("click", fechar);
  head.append(title, close);

  const photo = h("div", "det-photo");
  const body = h("div", "det-body");
  sheet.append(head, photo, body);
  overlay.append(sheet);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) fechar(); });
  document.body.append(overlay);

  function fechar() { overlay.classList.remove("open"); }

  function achar(id) {
    id = String(id);
    return (window.arboDenCache && window.arboDenCache[id]) ||
           (typeof pinMarkers !== "undefined" && pinMarkers[id] && pinMarkers[id].d) || null;
  }

  function linhaInfo(dl, rotulo, valor) {
    const row = h("div", "det-row");
    row.append(h("dt", null, rotulo), h("dd", null, valor));
    dl.append(row);
  }

  function passo(estado, nome, detalhe) {
    const li = h("li", "tl-step tl-" + estado);
    li.append(h("strong", null, nome));
    if (detalhe) li.append(h("span", null, detalhe));
    if (estado === "done") li.setAttribute("aria-label", nome + " (concluído)");
    if (estado === "now")  li.setAttribute("aria-current", "step");
    return li;
  }

  function linhaDoTempo(d) {
    const ol = h("ol", "det-timeline");
    const quando = d.created_at ? new Date(d.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
    const st = d.status;
    ol.append(passo("done", "Enviada", quando));
    if (st === "rec") {
      ol.append(passo("bad", "Recusada pela moderação", "Não procedente"));
      return ol;
    }
    ol.append(st === "analise"
      ? passo("now", "Aguardando verificação", "Uma ONG ou órgão público vai analisar")
      : passo("done", "Verificada e aprovada", "Aprovada pela moderação"));
    ol.append(st === "resolvida"
      ? passo("done", "Resolvida", "Problema solucionado")
      : passo(st === "proc" ? "now" : "todo", "Resolução", st === "proc" ? "Em andamento" : "Depois da aprovação"));
    return ol;
  }

  function compartilhar(d) {
    const texto = "Ocorrência no Arbo: " + (d.titulo || "") + (d.localizacao ? " — " + d.localizacao : "");
    const url = location.origin + location.pathname;
    if (navigator.share) {
      navigator.share({ title: "Arbo", text: texto, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(texto + " " + url).then(
        () => showToast("Link copiado!"), () => showToast("Não foi possível copiar."));
    } else {
      showToast("Seu navegador não permite compartilhar.");
    }
  }

  function verNoMapa(d) {
    fechar();
    if (typeof navigate === "function") navigate("mapa");
    let tentativas = 0;
    (function tentar() {
      const o = typeof pinMarkers !== "undefined" ? pinMarkers[d.id] : null;
      if (typeof arboMap !== "undefined" && arboMap && o) {
        arboMap.invalidateSize();
        arboMap.setView([d.latitude, d.longitude], 18);
        if (arboMap.hasLayer(o.marker)) o.marker.openPopup();
        else showToast("Esta ocorrência está resolvida. Use “Mostrar resolvidas”.");
      } else if (++tentativas < 8) {
        setTimeout(tentar, 350);
      }
    })();
  }

  /* ── API pública ── */
  let token = 0;
  window.abrirDetalhe = async function (id) {
    let d = achar(id);
    if (!d && typeof _supabase !== "undefined") {
      try {
        const r = await _supabase.from("denuncias").select("*").eq("id", id).maybeSingle();
        d = r.data;
        if (d && window.arboDenCache) window.arboDenCache[d.id] = d;
      } catch (e) { d = null; }
    }
    if (!d) { showToast("Não foi possível abrir os detalhes."); return; }
    const meu = ++token;
    const visual = typeof tipoVisual === "function" ? tipoVisual(d.tipo_categoria) : { emoji: "⚠️", bg: "#F5F5F5" };

    // foto
    photo.replaceChildren();
    photo.style.background = visual.bg;
    if (d.img_url) {
      const img = document.createElement("img");
      img.src = d.img_url;
      img.alt = d.img_alt || "Foto da ocorrência: " + (d.titulo || "");
      photo.append(img);
    } else {
      const em = h("span", null, visual.emoji);
      em.setAttribute("aria-hidden", "true");
      photo.append(em);
    }

    // corpo
    body.replaceChildren();
    const st = STATUS[d.status] || STATUS.analise;
    const badges = h("div", "det-badges");
    badges.append(h("span", "badge " + st.cls, st.txt), h("span", "badge badge-gray", d.tipo_categoria || "Outro"));
    body.append(badges, h("h3", "det-name", d.titulo || "Ocorrência ambiental"));
    if (d.descricao) body.append(h("p", "det-desc", d.descricao));

    const dl = h("dl", "det-info");
    linhaInfo(dl, "Local", d.localizacao || "Localização não informada");
    linhaInfo(dl, "Enviada por", d.autor_nome || "Anônimo");
    linhaInfo(dl, "Quando", typeof formatarTempo === "function" ? formatarTempo(d.created_at) : "");
    body.append(dl);

    body.append(h("h3", "det-sub", "Andamento"), linhaDoTempo(d));

    const acoes = h("div", "det-actions");
    if (d.latitude && d.longitude) {
      const mapa = h("button", "btn btn-primary", "Ver no mapa");
      mapa.type = "button";
      mapa.addEventListener("click", () => verNoMapa(d));
      acoes.append(mapa);
      const rota = h("a", "btn btn-danger", "Como chegar");
      rota.href = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(d.latitude + "," + d.longitude);
      rota.target = "_blank";
      rota.rel = "noopener noreferrer";
      acoes.append(rota);
    }
    const comp = h("button", "btn btn-danger", "Compartilhar");
    comp.type = "button";
    comp.addEventListener("click", () => compartilhar(d));
    acoes.append(comp);
    body.append(acoes);

    sheet.scrollTop = 0;
    overlay.classList.add("open");
    blocoMutirao(d, meu);
  };

  /* Se houver mutirão marcado para esta ocorrência, mostra no topo do andamento */
  async function blocoMutirao(d, meu) {
    if (typeof _supabase === "undefined") return;
    try {
      const r = await _supabase.from("mutiroes_info").select("titulo,data_hora,local")
        .eq("denuncia_id", d.id).gte("data_hora", new Date().toISOString()).order("data_hora").limit(1);
      const m = r.data && r.data[0];
      if (!m || meu !== token) return;
      const box = h("div", "det-mut");
      const quando = new Date(m.data_hora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
      box.append(h("strong", null, "🌱 Mutirão marcado"), h("span", null, m.titulo + " — " + quando + (m.local ? " · " + m.local : "")));
      const alvo = body.querySelector(".det-sub");
      if (alvo) body.insertBefore(box, alvo);
    } catch (e) { /* sem a coluna denuncia_id ainda: ignora */ }
  }

  /* Clique em qualquer "Ver detalhes" dos cards (delegação) */
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-det]");
    if (b && !b.closest(".leaflet-popup")) window.abrirDetalhe(b.getAttribute("data-det"));
  });
})();