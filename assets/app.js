// assets/app.js — robusto: tenta /config.json, depois /assets/config.json, depois fallback

const $ = (sel) => document.querySelector(sel);

// Fallback padrão (caso config.json não carregue em nenhum lugar)
const DEFAULT_CONFIG = {
  proxy: { workerBase: "https://rescue-proxy.vitorpaulojquadros.workers.dev" },
  biblia: {
    defaultVersion: "LEB",
    versions: { "LEB (en)": "LEB", "ESV (en)": "ESV" }
  },
  youtube: { channelId: "", shortsPlaylist: "", fullPlaylist: "" }
};

async function tryFetch(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    return await r.json();
  } catch (e) {
    console.warn("[config] falhou:", url, e);
    return null;
  }
}

async function loadConfig() {
  if (window.APP_CONFIG) return window.APP_CONFIG;

  // 1) raiz
  let cfg = await tryFetch("/config.json");
  if (cfg) return cfg;

  // 2) assets
  cfg = await tryFetch("/assets/config.json");
  if (cfg) return cfg;

  console.warn("[config] usando DEFAULT_CONFIG");
  return DEFAULT_CONFIG;
}

async function boot() {
  const cfg = await loadConfig();

  // rodapé
  const y = $("#yy");
  if (y) y.textContent = new Date().getFullYear();

  // montar versões no select
  const selVer = $("#biblia-ver");
  if (selVer && cfg.biblia?.versions) {
    selVer.innerHTML = "";
    Object.entries(cfg.biblia.versions).forEach(([label, code]) => {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = label;
      selVer.appendChild(opt);
    });
    selVer.value = cfg.biblia?.defaultVersion || Object.values(cfg.biblia.versions)[0];
  }

  // ---- Versículo do dia ----
  async function carregarVersiculoDoDia() {
    const alvo = $("#vday-text");
    const alvoRef = $("#vday-ref");
    const ver = (cfg.biblia?.defaultVersion || "LEB").trim();
    try {
      const u = `${cfg.proxy.workerBase}/api/verse-of-day?ver=${encodeURIComponent(ver)}`;
      const r = await fetch(u, { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      alvo.textContent = (j.text || "").trim() || "—";
      alvoRef.textContent = j.ref ? `(${j.ref} — ${j.version})` : `(${j.version || ver})`;
    } catch (e) {
      console.error("[vdia] erro:", e);
      alvo.textContent = "—";
      alvoRef.textContent = "(erro ao carregar)";
    }
  }

  // ---- Busca na Bíblia ----
  async function fazerBuscaBiblia() {
    const q = $("#biblia-q").value.trim();
    const ver = ($("#biblia-ver")?.value || cfg.biblia?.defaultVersion || "LEB").trim();
    const outEl = $("#biblia-out"); // textarea
    outEl.value = "";

    if (!q) {
      outEl.value = "Digite uma referência ou termo.";
      return;
    }

    try {
      const u = `${cfg.proxy.workerBase}/biblia/bible/content/${encodeURIComponent(
        ver
      )}.txt?passage=${encodeURIComponent(q)}&style=oneVerse`;
      const r = await fetch(u, { headers: { Accept: "text/plain" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const txt = await r.text();
      outEl.value = txt || "Nenhum resultado encontrado.";
    } catch (e) {
      console.error("[busca] erro:", e);
      outEl.value = "Erro ao buscar na API da Bíblia.";
    }
  }

  // ---- YouTube (opcional) ----
  async function carregarYouTube() {
    const LIVE_IFRAME = $("#liveFrame");
    if (!cfg.youtube) return;

    try {
      if (cfg.youtube.channelId && LIVE_IFRAME) {
        const liveURL = `${cfg.proxy.workerBase}/api/youtube/live?channel=${encodeURIComponent(
          cfg.youtube.channelId
        )}`;
        const r = await fetch(liveURL);
        const j = await r.json();
        let videoId = j.isLive ? j.id : null;
        if (!videoId) {
          const url = `${cfg.proxy.workerBase}/api/youtube?channel=${encodeURIComponent(
            cfg.youtube.channelId
          )}`;
          const r2 = await fetch(url);
          const d = await r2.json();
          videoId = d.items?.[0]?.id || null;
        }
        if (videoId) LIVE_IFRAME.src = `https://www.youtube.com/embed/${videoId}`;
      }

      // shorts
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

      // fulls
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
    } catch (e) {
      console.warn("[youtube] erro:", e);
    }
  }

  // Bindings
  $("#btn-copy")?.addEventListener("click", () => {
    const texto = $("#vday-text")?.textContent?.trim() || "";
    const ref = $("#vday-ref")?.textContent?.trim() || "";
    navigator.clipboard.writeText([texto, ref].filter(Boolean).join(" ")).catch(() => {});
  });

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

  // Start
  await carregarVersiculoDoDia();
  await carregarYouTube();
}

document.addEventListener("DOMContentLoaded", () => {
  boot().catch((e) => console.error("[boot] erro fatal:", e));
});
