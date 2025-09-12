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

  // Ano no rodapé (se existir)
  const y = document.querySelector("#yy");
  if (y) y.textContent = new Date().getFullYear();

  // Monta seletor de versões (se existir no config)
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

  // Busca na Bíblia
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

  // YouTube (opcional – popular listas se tiver channel/playlist no config)
  async function carregarYouTube() {
    if (!cfg.youtube) return;

    const LIVE_URL = `${cfg.proxy.workerBase}/api/youtube/live?channel=${encodeURIComponent(
      cfg.youtube.channelId || ""
    )}`;
    const LIVE_IFRAME = $("#liveFrame");

    try {
      if (cfg.youtube.channelId && LIVE_IFRAME) {
        const res = await fetch(LIVE_URL);
        const j = await res.json();
        const videoId = j.isLive ? j.id : null;

        if (videoId) {
          LIVE_IFRAME.src = `https://www.youtube.com/embed/${videoId}?autoplay=0`;
        } else {
          // pega o último vídeo do canal
          const url = `${cfg.proxy.workerBase}/api/youtube?channel=${encodeURIComponent(
            cfg.youtube.channelId
          )}`;
          const r = await fetch(url);
          const d = await r.json();
          const first = d.items?.[0]?.id;
          if (first) LIVE_IFRAME.src = `https://www.youtube.com/embed/${first}`;
        }
      }

      // Shorts
      if (cfg.youtube.shortsPlaylist) {
        const url = `${cfg.proxy.workerBase}/api/youtube?playlist=${encodeURIComponent(
          cfg.youtube.shortsPlaylist
        )}`;
        const r = await fetch(url);
        const d = await r.json();
        const el = document.querySelector("#shorts");
        if (el) {
          el.innerHTML = (d.items || [])
            .map(
              (v) => `
              <a class="thumb" href="https://youtu.be/${v.id}" target="_blank" rel="noopener">
                <img src="${v.thumb}" alt="${v.title}">
                <span>${v.title}</span>
              </a>`
            )
            .join("");
        }
      }

      // Mensagens completas
      if (cfg.youtube.fullPlaylist) {
        const url = `${cfg.proxy.workerBase}/api/youtube?playlist=${encodeURIComponent(
          cfg.youtube.fullPlaylist
        )}`;
        const r = await fetch(url);
        const d = await r.json();
        const el = document.querySelector("#fulls");
        if (el) {
          el.innerHTML = (d.items || [])
            .map(
              (v) => `
              <a class="thumb" href="https://youtu.be/${v.id}" target="_blank" rel="noopener">
                <img src="${v.thumb}" alt="${v.title}">
                <span>${v.title}</span>
              </a>`
            )
            .join("");
        }
      }
    } catch (_) {}
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
  await carregarYouTube();
}

// Inicia
document.addEventListener("DOMContentLoaded", () => {
  boot().catch((e) => console.error(e));
});
