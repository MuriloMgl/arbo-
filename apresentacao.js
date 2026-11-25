/* ============================================================
   ARBO — apresentacao.js
   Modo apresentação: mapa em tela cheia, passeio automático pelas
   ocorrências e contadores. Sai com Esc ou pelo botão "Sair".
   Para desfazer: remova este arquivo, a linha <script> no index.html
   e o botão "Modo apresentação" da legenda.
============================================================ */
(function () {
  const INTERVALO = 6000;
  let timer = null, ativo = false, fila = [], idx = 0;

  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* ── Elementos fixos ── */
  const box = h("div", "apres-hud");
  box.hidden = true;
  const LOGO_D = "M865.2 535.6C821.3 530.8 786.3 506.2 769.6 468.6C768.4 465.8 766.8 461.6 766.1 459.4C763.0 448.6 762.3 446.2 761.4 441.8C759.1 430.0 759.9 405.1 762.8 393.5C769.2 368.4 781.4 349.8 802.2 333.6C815.7 323.0 835.0 314.9 853.2 312.2C870.5 309.6 880.1 309.5 897.3 311.9C929.9 316.4 956.1 331.2 976.4 356.6C990.7 374.4 998.5 396.7 999.8 422.9C1000.9 447.1 991.9 475.2 977.4 492.8C957.8 516.4 937.5 528.3 906.1 534.3C898.1 535.9 874.3 536.6 865.2 535.6ZM637.8 528.0C621.5 525.9 606.5 519.0 595.9 508.8C589.8 503.0 589.5 503.2 589.2 513.1C588.7 524.8 592.0 523.7 557.5 523.6C529.2 523.5 529.2 523.5 527.3 521.8L525.4 520.2L525.4 384.7C525.3 237.7 525.1 246.5 528.7 244.7C529.9 244.1 537.3 243.9 560.0 243.9C589.8 243.9 589.8 243.9 591.4 245.4C592.9 246.9 592.9 246.9 593.0 280.8C593.1 321.6 593.4 329.8 594.9 330.1C595.5 330.2 598.2 328.6 600.9 326.5C625.8 307.9 665.6 305.6 698.2 320.9C719.6 331.1 737.4 350.5 747.3 374.9C748.1 376.8 749.1 379.3 749.6 380.4C750.0 381.5 750.6 383.4 750.8 384.8C751.1 386.1 751.5 387.7 751.9 388.4C752.2 389.0 753.2 393.7 754.0 398.8C755.6 408.8 756.2 432.9 754.9 438.2C754.5 439.6 754.0 442.6 753.6 444.9C753.2 447.1 752.4 450.7 751.7 452.7C751.0 454.8 749.8 458.6 749.0 461.2C739.9 489.5 719.5 511.2 691.6 522.3C678.6 527.4 653.6 530.1 637.8 528.0ZM315.0 522.0C312.8 520.8 311.4 518.6 309.9 513.6C307.7 506.0 307.0 503.8 305.3 499.4C304.4 496.9 303.2 493.7 302.8 492.1C299.5 481.7 295.5 471.0 294.5 470.3C293.4 469.4 259.0 469.0 205.6 469.2C184.1 469.3 185.1 468.9 182.5 475.8C177.9 487.6 176.5 491.3 175.9 493.1C175.2 495.1 173.7 499.0 169.2 510.7C164.6 522.9 168.6 521.8 128.5 521.7C94.4 521.7 94.4 521.7 92.9 520.2C92.1 519.3 91.4 518.3 91.4 517.9C91.4 517.1 101.6 491.5 106.8 479.2C108.4 475.4 110.3 471.0 110.9 469.4C111.5 467.9 113.2 463.8 114.7 460.3C119.4 448.9 124.7 436.0 132.0 418.1C135.9 408.4 140.1 398.2 141.3 395.4C144.2 388.7 145.5 385.4 148.7 377.4C150.1 373.8 151.9 369.5 152.5 368.0C156.3 358.9 160.3 349.0 161.3 346.3C161.9 344.5 163.3 341.1 164.4 338.8C165.5 336.4 166.4 334.1 166.4 333.7C166.4 333.3 167.3 330.9 168.6 328.4C169.8 325.8 171.5 321.9 172.4 319.6C173.2 317.3 174.5 314.3 175.2 313.0C177.0 309.7 176.2 308.7 170.0 306.3C142.2 295.4 123.9 284.1 107.2 267.2C101.7 261.6 95.5 254.4 89.6 246.4C83.2 237.8 73.9 217.6 69.8 203.5C67.4 195.4 66.8 193.0 65.9 187.1C65.4 184.2 64.7 180.4 64.3 178.6C63.6 175.0 62.7 164.9 61.4 145.5C59.0 108.4 51.1 83.2 33.6 56.7C29.0 49.7 12.2 34.2 5.7 30.9C0.4 28.2 -1.1 25.7 1.3 23.4C3.4 21.5 47.0 11.5 61.1 9.7C63.0 9.5 65.2 9.1 66.0 8.8C66.8 8.5 69.9 7.9 72.9 7.6C76.0 7.2 81.3 6.5 84.8 6.0C101.6 3.5 112.1 2.5 128.5 1.6C138.4 1.1 147.4 0.5 148.5 0.3C150.7 -0.1 169.2 0.8 184.3 1.9C203.2 3.4 229.8 8.9 249.5 15.3C294.2 30.1 336.0 61.0 356.9 95.0C357.9 96.6 359.7 99.5 360.9 101.3C368.9 113.5 376.7 135.2 380.7 156.0C383.3 169.4 382.4 202.1 379.0 213.6C378.5 215.2 378.0 217.6 377.8 219.0C374.9 235.9 359.7 267.5 347.4 282.1C342.3 288.1 341.0 287.1 336.8 273.2C335.1 267.5 334.8 266.6 332.1 259.3C319.2 224.9 296.0 184.0 271.0 151.9C257.6 134.7 228.1 106.7 211.7 95.6C207.8 92.9 203.0 89.7 197.1 85.6C188.0 79.2 158.9 64.6 145.2 59.4C143.0 58.5 129.9 53.9 125.0 52.2C122.7 51.4 121.0 51.8 121.0 53.2C121.0 53.7 124.4 56.0 128.7 58.4C136.9 63.0 146.0 68.7 151.4 72.6C153.2 73.9 155.6 75.6 156.8 76.4C160.2 78.7 174.8 90.4 183.0 97.4C189.6 102.9 209.9 123.8 215.3 130.4C216.3 131.6 219.6 135.6 222.8 139.3C225.9 142.9 229.8 147.7 231.3 150.0C232.9 152.2 235.6 156.0 237.3 158.4C241.1 163.7 243.5 167.3 252.8 182.1C261.6 196.1 276.1 223.7 283.2 240.1C287.6 250.2 292.0 260.6 293.8 265.0C294.5 266.7 295.5 269.1 296.0 270.3C296.5 271.5 297.3 273.7 297.7 275.0C298.2 276.4 299.2 279.1 299.9 281.0C300.7 282.9 302.1 286.9 303.2 289.9C304.2 292.8 305.6 296.5 306.2 298.0C308.6 303.8 311.9 312.4 312.5 314.2C312.8 315.2 313.8 318.0 314.7 320.4C315.7 322.8 317.4 327.7 318.5 331.1C320.8 337.8 325.6 351.4 327.7 357.3C328.4 359.2 329.4 361.9 329.9 363.3C330.4 364.7 332.2 369.6 334.0 374.3C335.8 379.0 337.4 383.6 337.7 384.7C338.7 388.1 347.7 413.2 350.5 420.3C351.4 422.5 353.0 426.9 354.1 430.1C355.1 433.2 356.6 437.3 357.2 439.2C360.2 447.5 372.1 482.6 375.0 491.5C379.6 505.7 380.8 508.5 382.0 507.3C382.4 506.9 382.7 472.0 382.8 412.4C382.9 318.0 382.9 318.0 384.5 316.6C386.0 315.3 386.8 315.2 403.3 314.8C437.6 314.0 441.5 314.1 443.7 316.3C445.5 318.1 445.5 318.1 445.5 328.9C445.5 339.3 445.5 339.6 446.8 339.6C447.6 339.6 448.5 338.9 449.1 337.7C452.5 331.6 461.8 323.0 469.1 319.3C471.2 318.3 476.3 316.3 480.4 315.0C487.8 312.6 488.3 312.5 496.9 312.5C506.1 312.5 511.2 313.4 513.2 315.4C514.1 316.3 514.2 320.0 514.2 344.1C514.2 378.4 515.6 375.3 500.9 373.0C495.0 372.1 484.6 372.6 478.1 374.2C462.6 378.1 451.3 390.3 447.6 407.0C446.2 413.7 446.2 413.7 446.1 466.5C446.1 519.3 446.1 519.3 444.3 521.2C442.4 523.0 442.4 523.0 379.5 523.0C327.6 522.9 316.3 522.7 315.0 522.0ZM892.2 476.3C911.4 471.9 927.6 455.4 930.7 437.0C931.0 435.3 931.5 432.6 931.9 431.0C933.5 424.2 931.8 412.4 927.9 402.8C917.7 377.4 892.1 364.6 864.5 371.1C846.8 375.3 833.4 388.5 827.8 407.1C825.6 414.5 825.8 430.3 828.1 438.5C836.2 466.6 863.6 482.8 892.2 476.3ZM654.8 469.2C682.8 461.0 696.9 433.7 688.8 403.6C679.1 367.5 637.9 353.3 608.4 375.8C589.1 390.4 583.4 421.0 595.4 444.6C605.8 465.1 632.0 476.0 654.8 469.2ZM274.1 409.9C274.6 409.2 274.2 407.2 271.8 400.3C268.2 389.6 267.1 386.5 265.0 380.9C264.1 378.5 262.5 373.9 261.4 370.8C260.3 367.7 259.2 364.6 258.8 363.9C258.5 363.2 257.8 361.4 257.4 359.8C256.9 358.3 255.8 355.0 254.9 352.6C254.0 350.1 253.0 347.1 252.6 345.9C251.9 343.5 250.8 340.5 247.4 331.8C246.2 328.6 244.9 325.1 244.7 323.9C243.6 319.6 240.6 319.7 239.4 324.0C238.7 326.7 237.7 329.3 231.2 345.9C229.4 350.6 226.8 357.4 225.5 361.1C224.2 364.7 221.8 371.1 220.2 375.2C218.6 379.4 216.4 385.6 215.2 389.1C214.0 392.6 212.3 397.4 211.4 399.8C208.5 407.4 208.2 408.7 209.2 409.8C210.3 411.3 272.9 411.4 274.1 409.9Z";
  const marca = h("div", "apres-marca");
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 1000 536.2");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Arbo");
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", LOGO_D);
  path.setAttribute("fill-rule", "evenodd");
  svg.append(path);
  marca.append(svg);
  const contadores = h("div", "apres-cont");
  const rodape = h("div", "apres-rodape");
  const rTitulo = h("strong", null, "");
  const rInfo = h("span", null, "");
  const barra = h("div", "apres-barra");
  const barraFill = h("i");
  barra.append(barraFill);
  rodape.append(rTitulo, rInfo, barra);
  const sair = h("button", "apres-sair", "Sair (Esc)");
  sair.type = "button";
  sair.addEventListener("click", () => sairModo());
  box.append(marca, contadores, rodape, sair);
  document.body.append(box);

  function contar() {
    const lista = typeof pinMarkers !== "undefined" ? Object.values(pinMarkers) : [];
    const n = (st) => lista.filter(o => o.status === st).length;
    return { total: lista.length, analise: n("analise"), proc: n("proc"), resolvida: n("resolvida") };
  }

  function desenharContadores() {
    const c = contar();
    contadores.replaceChildren();
    [["Ocorrências", c.total], ["Em análise", c.analise], ["Procedentes", c.proc], ["Resolvidas", c.resolvida]].forEach(([rot, val]) => {
      const it = h("div", "apres-num");
      it.append(h("b", null, String(val)), h("span", null, rot));
      contadores.append(it);
    });
  }

  function montarFila() {
    const lista = Object.values(pinMarkers).filter(o => o.status !== "resolvida" && o.d && o.d.latitude && o.d.longitude);
    lista.sort((a, b) => new Date(b.d.created_at || 0) - new Date(a.d.created_at || 0));
    fila = lista;
  }

  function passo() {
    if (!ativo) return;
    if (!fila.length || idx >= fila.length) { montarFila(); idx = 0; }
    desenharContadores();
    if (!fila.length) { rTitulo.textContent = "Nenhuma ocorrência no mapa ainda"; rInfo.textContent = ""; return; }
    const o = fila[idx++];
    const d = o.d;
    if (typeof arboMap !== "undefined" && arboMap) {
      arboMap.closePopup();
      arboMap.flyTo([d.latitude, d.longitude], 16, { duration: 1.6 });
      setTimeout(() => { if (ativo && arboMap.hasLayer(o.marker)) o.marker.openPopup(); }, 1700);
    }
    rTitulo.textContent = d.titulo || "Ocorrência";
    rInfo.textContent = [d.tipo_categoria, d.localizacao].filter(Boolean).join(" · ");
    barraFill.style.transition = "none";
    barraFill.style.width = "0%";
    void barraFill.offsetWidth;
    barraFill.style.transition = "width " + INTERVALO + "ms linear";
    barraFill.style.width = "100%";
  }

  function entrarModo() {
    if (ativo) return;
    if (typeof navigate === "function") navigate("mapa");
    if (typeof toggleLegenda === "function") toggleLegenda(false);
    ativo = true;
    document.body.classList.add("apres-on");
    box.hidden = false;
    idx = 0;
    montarFila();
    setTimeout(() => { if (typeof arboMap !== "undefined" && arboMap) arboMap.invalidateSize(); }, 120);
    try { const r = document.documentElement.requestFullscreen; if (r) r.call(document.documentElement).catch(() => {}); } catch (e) { /* sem tela cheia */ }
    passo();
    timer = setInterval(passo, INTERVALO);
  }

  function sairModo() {
    if (!ativo) return;
    ativo = false;
    clearInterval(timer);
    document.body.classList.remove("apres-on");
    box.hidden = true;
    if (typeof arboMap !== "undefined" && arboMap) { arboMap.closePopup(); setTimeout(() => arboMap.invalidateSize(), 120); }
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* ok */ }
  }

  window.alternarApresentacao = function () { ativo ? sairModo() : entrarModo(); };

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && ativo) { sairModo(); return; }
    const t = e.target;
    const digitando = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    if (!digitando && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "f" || e.key === "F") && document.getElementById("screen-mapa")?.classList.contains("active")) {
      e.preventDefault();
      window.alternarApresentacao();
    }
  });
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && ativo) sairModo(); });
})();