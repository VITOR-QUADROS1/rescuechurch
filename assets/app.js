// assets/app.js — completo

// Carrega config.json (ou usa window.APP_CONFIG se já estiver embutido)
async function loadConfig() {
  if (window.APP_CONFIG) return window.APP_CONFIG;
  const r = await fetch("./config.json", { cache: "no-store" });
  if (!r.ok) throw new Error("config.json não encontrado");
  return r.json();
}

const $ = (sel) => document.querySelector(sel);

async function boot() {
  const cfg = await loadConfig();

  // Monta seletor de versões (se existir)
  const selVer = $("#biblia-ver");
  if (selVer && cfg.biblia?.versions) {
    selVer.innerHTML = "";
    Object.entries(cfg.biblia.versions).forEach(([label, code]) => {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = label;
      selVer.appendChild(opt);
    });
    const def = cfg.biblia?.defaultVersion || Object.values(cfg.biblia.versions)[0];
    selVer.value = def;
  }

  // Versículo do dia
  async function carregarVersiculoDoDia() {
    const alvo = $("#vday-text");
    const alvoRef = $("#vday-ref");
    const ver = ($("#versao-vday")?.value || cfg.biblia?.defaultVersion || "LEB").trim();
    try {
      const u = `${cfg.proxy.workerBase}/api/verse-of-day?ver=${encodeURIComponent(ver)}`;
      const r = await fetch(u, { headers: { Accept: "application/json" } });
      const j = await r.json();
      alvo.textContent = j.text?.trim() || "—";
      alvoRef.textContent = j.ref ? `(${j.ref} — ${j.version})` : `(${j.version})`;
    } catch (e) {
      alvo.textContent = "—";
      alvoRef.textContent = "(erro ao carregar)";
    }
  }

  // Busca
  async function fazerBuscaBiblia() {
    const q = $("#biblia-q").value.trim();
    const ver = ($("#biblia-ver")?.value || cfg.biblia?.defaultVersion || "LEB").trim();
    const out = $("#biblia-out");
    out.value = "";

    if (!q) {
      out.value = "Digite uma referência ou termo.";
      return;
    }

    try {
      // O Worker aceita este caminho e faz fallback para LEB se necessário
      const u = `${cfg.proxy.workerBase}/biblia/bible/content/${encodeURIComponent(
        ver
      )}.txt?passage=${encodeURIComponent(q)}&style=oneVerse`;
      const r = await fetch(u, { headers: { Accept: "text/plain" } });
      const txt = await r.text();
      out.value = txt || "Nenhum resultado encontrado.";
    } catch (e) {
      out.value = "Erro ao buscar na API da Bíblia.";
    }
  }

  // Bindings
  $("#btn-copy")?.addEventListener("click", () => {
    const texto = $("#vday-text")?.textContent?.trim() || "";
    const ref = $("#vday-ref")?.textContent?.trim() || "";
    navigator.clipboard.writeText([texto, ref].filter(Boolean).join(" ")).catch(() => {});
  });

  $("#versao-vday")?.addEventListener("change", carregarVersiculoDoDia);
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

  // Inicialização
  await carregarVersiculoDoDia();
}

// Inicia
document.addEventListener("DOMContentLoaded", () => {
  boot().catch((e) => console.error(e));
});
