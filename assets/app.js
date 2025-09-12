// assets/app.js — completo
const CONFIG = {
  WORKER_BASE: "https://rescue-proxy.vitorpaulojquadros.workers.dev/", // <<< ajuste aqui
};

// Helpers
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* ---------------- Versículo do dia ---------------- */
async function carregarVersiculoDoDia() {
  const alvo = $("#vday-text");
  const alvoRef = $("#vday-ref");
  const versSel = $("#versao-vday"); // select da versão (opcional)

  try {
    const ver = versSel?.value || "POR-NTLH";
    const u = `${CONFIG.WORKER_BASE}/api/verse-of-day?ver=${encodeURIComponent(ver)}`;
    const r = await fetch(u, { headers: { Accept: "application/json" } });
    const j = await r.json();

    alvo.textContent = j.text?.trim() || "—";
    alvoRef.textContent = j.ref ? `(${j.ref} — ${j.version})` : `(${j.version})`;
  } catch (e) {
    alvo.textContent = "—";
    alvoRef.textContent = "(erro ao carregar)";
  }
}

/* ---------------- Busca na Bíblia ---------------- */
async function fazerBuscaBiblia() {
  const q = $("#biblia-q").value.trim();
  const ver = $("#biblia-ver").value || "POR-NTLH";
  const out = $("#biblia-out");

  out.value = "";
  if (!q) {
    out.value = "Digite uma referência ou termo.";
    return;
  }

  try {
    // chama o Worker: ele usa /content e tem fallback em /search
    const u = `${CONFIG.WORKER_BASE}/biblia/bible/content/${encodeURIComponent(ver)}.txt?passage=${encodeURIComponent(
      q
    )}&style=oneVerse`;
    const r = await fetch(u, { headers: { Accept: "text/plain" } });
    const txt = await r.text();
    out.value = txt || "Nenhum resultado encontrado.";
  } catch (e) {
    out.value = "Erro ao buscar na API da Bíblia.";
  }
}

/* ---------------- UI bindings ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  // Versículo do dia
  $("#btn-copy")?.addEventListener("click", () => {
    const texto = $("#vday-text")?.textContent?.trim() || "";
    const ref = $("#vday-ref")?.textContent?.trim() || "";
    navigator.clipboard.writeText([texto, ref].filter(Boolean).join(" ")).catch(() => {});
  });
  $("#versao-vday")?.addEventListener("change", carregarVersiculoDoDia);
  carregarVersiculoDoDia();

  // Busca
  $("#btn-buscar")?.addEventListener("click", (e) => {
    e.preventDefault();
    fazerBuscaBiblia();
  });
  $("#biblia-q")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      fazerBuscaBiblia();
    }
  });
});
