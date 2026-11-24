/* ============================================================
   ARBO — minhas.js : editar minhas denúncias
   (excluir usa o modal-excluir já existente via pedirExcluir(id, true))
============================================================ */
let editarId = null;

function editarMinha(id) {
  const d = window.arboMinhas && window.arboMinhas[id];
  if (!d) { showToast("Não foi possível abrir a edição."); return; }
  if (d.status !== "analise") { showToast("Só dá para editar enquanto estiver Não verificada."); return; }
  editarId = id;
  limparErros(document.getElementById("modal-editar"));
  document.getElementById("ed-titulo").value = d.titulo || "";
  document.getElementById("ed-desc").value = d.descricao || "";
  const sel = document.getElementById("ed-tipo");
  sel.value = [...sel.options].some(o => o.value === d.tipo_categoria) ? d.tipo_categoria : "Desmatamento";
  abrirModal("modal-editar");
}

async function salvarEdicao() {
  const id = editarId;
  if (!id) return;
  const modal = document.getElementById("modal-editar");
  limparErros(modal);
  const titulo = document.getElementById("ed-titulo").value.trim();
  const desc   = document.getElementById("ed-desc").value.trim();
  const tipo   = document.getElementById("ed-tipo").value;
  if (!titulo) return erroCampo("ed-titulo", "Informe um título");
  if (!desc)   return erroCampo("ed-desc", "Descreva o problema");
  setLoading(true);
  const { data, error } = await _supabase.from("denuncias")
    .update({ titulo, descricao: desc, tipo_categoria: tipo })
    .eq("id", id).eq("autor_id", currentUserId).select();
  setLoading(false);
  if (error) { showToast("Erro ao salvar: " + error.message); return; }
  if (!data || !data.length) { showToast("Não foi possível editar. Só é possível enquanto estiver Não verificada. Rode o supabase-novidades.sql."); return; }
  editarId = null;
  fecharModal("modal-editar");
  showToast("✓ Denúncia atualizada");
  if (typeof atualizarPinMapa === "function") atualizarPinMapa(data[0]);
  if (typeof carregarPainelPerfil === "function") carregarPainelPerfil();
}