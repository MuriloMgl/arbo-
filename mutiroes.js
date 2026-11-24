/* ============================================================
   ARBO — mutiroes.js
   ONG/Órgão marca mutirão (ligado ou não a uma ocorrência),
   cancela o seu, e cada pessoa vê "Minhas inscrições".
   Banco: supabase-mutiroes.sql
============================================================ */
function atualizarBotaoMutirao() {
  const b = document.getElementById("btn-novo-mut");
  if (b) b.hidden = !(typeof currentProfile !== "undefined" && currentProfile && currentProfile !== "usuario");
}

async function abrirNovoMutirao() {
  limparErros(document.getElementById("modal-mutirao"));
  ["mu-titulo", "mu-local"].forEach(id => { document.getElementById(id).value = ""; });
  const dt = document.getElementById("mu-data");
  const hoje = new Date(); hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
  dt.min = hoje.toISOString().slice(0, 10); dt.value = "";
  document.getElementById("mu-hora").value = "08:00";
  const sel = document.getElementById("mu-denuncia");
  sel.replaceChildren(new Option("— Nenhuma —", ""));
  abrirModal("modal-mutirao");
  const { data } = await _supabase.from("denuncias").select("id,titulo").eq("status", "proc")
    .order("created_at", { ascending: false }).limit(60);
  (data || []).forEach(d => sel.append(new Option(d.titulo, d.id)));
}

async function salvarMutirao() {
  const modal = document.getElementById("modal-mutirao");
  limparErros(modal);
  const titulo = document.getElementById("mu-titulo").value.trim();
  const local  = document.getElementById("mu-local").value.trim();
  const data   = document.getElementById("mu-data").value;
  const hora   = document.getElementById("mu-hora").value || "08:00";
  const sel    = document.getElementById("mu-denuncia");
  const denId  = sel.value || null;
  if (!titulo) return erroCampo("mu-titulo", "Dê um nome ao mutirão");
  if (!local)  return erroCampo("mu-local", "Informe onde o grupo vai se encontrar");
  if (!data)   return erroCampo("mu-data", "Escolha a data");
  const quando = new Date(data + "T" + hora);
  if (isNaN(quando) || quando <= new Date()) return erroCampo("mu-data", "Escolha uma data e hora futuras");
  setLoading(true);
  const { error } = await _supabase.from("mutiroes").insert({
    titulo, local, data_hora: quando.toISOString(), organizacao: currentUserName || "Organização",
    confirmados_base: 0, criado_por: currentUserId, ...(denId ? { denuncia_id: denId } : {}),
  });
  setLoading(false);
  if (error) { showToast("Não foi possível marcar o mutirão: " + error.message + " — rode o supabase-mutiroes.sql"); return; }
  fecharModal("modal-mutirao");
  showToast("✓ Mutirão publicado!");
  if (typeof carregarOngs === "function") carregarOngs();
}

/* Cancelar: dois toques (o botão pede confirmação por 4 s) */
function cancelarMutirao(m, btn) {
  if (btn.dataset.confirma !== "1") {
    btn.dataset.confirma = "1";
    btn.textContent = "Tocar de novo para confirmar";
    setTimeout(() => { if (btn.isConnected) { btn.dataset.confirma = ""; btn.textContent = "Cancelar este mutirão"; } }, 4000);
    return;
  }
  btn.disabled = true;
  _supabase.from("mutiroes").delete().eq("id", m.id).select("id").then(({ data, error }) => {
    if (error || !data || !data.length) { btn.disabled = false; showToast("Não foi possível cancelar o mutirão."); return; }
    showToast("Mutirão cancelado");
    if (typeof carregarOngs === "function") carregarOngs();
  });
}

/* ── Minhas inscrições ───────────────────────────────────── */
async function abrirInscricoes() {
  abrirModal("modal-inscricoes");
  await renderInscricoes();
}

async function renderInscricoes() {
  const box = document.getElementById("insc-lista");
  box.replaceChildren(Object.assign(document.createElement("p"), { textContent: "Carregando…", className: "ongs-vazio" }));
  const i = await _supabase.from("inscricoes").select("mutirao_id");
  const ids = (i.data || []).map(x => x.mutirao_id);
  let lista = [];
  if (ids.length) {
    const m = await _supabase.from("mutiroes_info").select("*").in("id", ids)
      .gte("data_hora", new Date().toISOString()).order("data_hora");
    lista = m.data || [];
  }
  box.replaceChildren();
  if (!lista.length) {
    box.append(estadoVazio({ icone: "cal", titulo: "Você não está inscrito em nenhum mutirão", texto: "Veja os próximos mutirões na tela de ONGs e toque em Participar.",
      botao: "Ver mutirões", acao: () => { fecharModal("modal-inscricoes"); navigate("ongs"); } }));
    return;
  }
  lista.forEach(m => {
    const c = mk("article", "mut-card insc-item");
    c.append(mk("time", "mut-data", fmtData(m.data_hora)), mk("h3", "mut-titulo", m.titulo), mk("p", "mut-org", m.organizacao), mk("p", "mut-loc", m.local || ""));
    const b = mk("button", "btn btn-danger btn-sm", "Cancelar inscrição"); b.type = "button";
    b.setAttribute("aria-label", "Cancelar inscrição no mutirão " + m.titulo);
    b.onclick = async () => {
      b.disabled = true;
      const r = await _supabase.from("inscricoes").delete().eq("mutirao_id", m.id).eq("user_id", currentUserId);
      if (r.error) { b.disabled = false; showToast("Não foi possível cancelar."); return; }
      showToast("Inscrição cancelada");
      await renderInscricoes();
      if (typeof carregarOngs === "function") carregarOngs();
    };
    c.append(b);
    box.append(c);
  });
}