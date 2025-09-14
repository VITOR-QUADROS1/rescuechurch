/* assets/app.js — RC v8 (PT-first + YouTube RSS fallback) */
const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

const CFG = { proxy: { workerBase: "/api" }, biblia: {}, youtube: {} };

/* --------- boot config (não quebra se falhar) ---------- */
async function loadCfg() {
  try {
    const r = await fetch("assets/config.json", { cache: "no-store" });
    if (r.ok) { Object.assign(CFG, await r.json()); }
  } catch (e) { console.warn("config.json falhou, usando defaults:", e); }
}

function api(path) {
  const base = (CFG?.proxy?.workerBase || "/api").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/* -------------------- Utils -------------------- */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function setLoading(el, on = true) {
  if (!el) return;
  el.classList.toggle("is-loading", !!on);
}

function isEN(t) {
  const s = ` ${String(t || "")} `.toLowerCase();
  return [" the ", " and ", " lord ", " god ", " you ", " your ", " shall ", " now ", " for "].some(w => s.includes(w));
}

async function fetchJSON(url, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok ? await r.json() : null;
  } catch (_) {
    clearTimeout(t);
    return null;
  }
}

/* -------------------- Versículo do Dia -------------------- */
async function loadVDay() {
  const txt = $("#vday-text"), ref = $("#vday-ref"), btn = $("#btn-vday");
  if (!txt || !ref) { return; }
  
  txt.textContent = "Carregando…";
  ref.textContent = "";
  setLoading(btn, true);
  
  try {
    const j = await fetchJSON(api(`/verse-of-day?lang=pt&t=${Date.now()}`), 12000);
    if (j?.text) {
      txt.textContent = j.text.trim();
      ref.textContent = `${j.ref || ""} — ${j.version || "NVI"}`;
    } else {
      txt.textContent = "(erro ao carregar)";
    }
  } catch (e) {
    console.error("Verse of day error:", e);
    txt.textContent = "(erro ao carregar)";
  } finally {
    setLoading(btn, false);
  }
}

/* -------------------- Busca bíblica -------------------- */
function mountVersions() {
  const sel = $("#biblia-ver");
  if (!sel) return;
  
  const versions = CFG?.biblia?.versions || {};
  sel.innerHTML = "";
  
  for (const label of Object.keys(versions)) {
    const opt = document.createElement("option");
    opt.textContent = label;
    opt.value = versions[label];
    sel.appendChild(opt);
  }
  
  const def = CFG?.biblia?.defaultVersion;
  if (def) {
    const i = Array.from(sel.options).findIndex(o => o.value === def);
    if (i >= 0) sel.selectedIndex = i;
  }
}

async function searchBible() {
  const qEl = $("#biblia-q"), out = $("#biblia-out"), btn = $("#btn-buscar");
  if (!qEl || !out) return;
  
  const q = (qEl.value || "").trim();
  if (!q) { qEl.focus(); return; }
  
  out.value = "Buscando…";
  setLoading(btn, true);

  try {
    const url = api(`/biblia/bible/content/NVI.txt?passage=${encodeURIComponent(q)}&lang=pt&t=${Date.now()}`);
    const r = await fetch(url);
    
    if (r.ok) {
      let txt = await r.text();
      if (isEN(txt)) {
        try {
          const tr = await fetchJSON(api(`/translate?q=${encodeURIComponent(txt)}&from=auto&to=pt-BR&t=${Date.now()}`), 12000);
          if (tr?.text) txt = tr.text;
        } catch (e) {
          console.error("Translation failed:", e);
        }
      }
      out.value = (txt || "").trim() || "Nenhum resultado encontrado.";
    } else {
      out.value = "Erro ao buscar. Ex.: João 3:16";
    }
  } catch (e) {
    console.error("Search error:", e);
    out.value = "Erro ao buscar. Ex.: João 3:16";
  } finally {
    setLoading(btn, false);
  }
}

/* -------------------- YouTube (API → fallback RSS) -------------------- */
function cardVideo(v) {
  if (!v?.id) return "";
  
  const thumb = v.thumb || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
  const title = (v.title || "").trim();
  const date = v.published ? new Date(v.published).toLocaleDateString("pt-BR") : "";
  
  return `
    <a class="hitem" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${v.id}">
      <img class="hthumb" loading="lazy" src="${thumb}" alt="${title}">
      <div class="hmeta">
        <div class="t">${title}</div>
        <div class="s">${date}</div>
      </div>
    </a>
  `;
}

async function fetchYTJSON(q) {
  try {
    const j = await fetchJSON(api(q), 12000);
    return j || { items: [] };
  } catch (e) {
    console.error("YouTube fetch error:", e);
    return { items: [] };
  }
}

async function loadLiveOrLatest() {
  const ch = CFG?.youtube?.channelId || "";
  const liveFrame = $("#liveFrame");
  const shortsBox = $("#shorts");
  const fullsBox = $("#fulls");
  
  if (!ch) {
    if (shortsBox) shortsBox.innerHTML = "<div class='muted'>Canal não configurado.</div>";
    if (fullsBox) fullsBox.innerHTML = "<div class='muted'>Canal não configurado.</div>";
    return;
  }

  // 1) Check for live stream
  try {
    const live = await fetchYTJSON(`/youtube/live?channel=${encodeURIComponent(ch)}&t=${Date.now()}`);
    const idToPlay = (live?.isLive && live?.id) ? live.id : null;
    
    if (liveFrame && idToPlay) {
      liveFrame.src = `https://www.youtube.com/embed/${idToPlay}?autoplay=1`;
    } else if (liveFrame) {
      // If no live, load latest videos for channel
      const latest = await fetchYTJSON(`/youtube?channel=${encodeURIComponent(ch)}&t=${Date.now()}`);
      const latestId = latest.items?.[0]?.id;
      if (latestId) {
        liveFrame.src = `https://www.youtube.com/embed/${latestId}`;
      }
    }
  } catch (e) {
    console.error("Live stream error:", e);
  }

  // 2) Load playlists
  try {
    if (CFG?.youtube?.shortsPlaylist) {
      await fillPlaylist(CFG.youtube.shortsPlaylist, "#shorts");
    } else if (shortsBox) {
      shortsBox.innerHTML = "<div class='muted'>Playlist de shorts não configurada.</div>";
    }

    if (CFG?.youtube?.fullPlaylist) {
      await fillPlaylist(CFG.youtube.fullPlaylist, "#fulls");
    } else if (fullsBox) {
      // Fallback to channel videos if no playlist
      const latest = await fetchYTJSON(`/youtube?channel=${encodeURIComponent(ch)}&t=${Date.now()}`);
      fullsBox.innerHTML = (latest.items || []).map(cardVideo).join("") || "<div class='muted'>Sem vídeos recentes.</div>";
    }
  } catch (e) {
    console.error("Playlist error:", e);
    if (shortsBox) shortsBox.innerHTML = "<div class='muted'>Erro ao carregar shorts.</div>";
    if (fullsBox) fullsBox.innerHTML = "<div class='muted'>Erro ao carregar vídeos.</div>";
  }
}

async function fillPlaylist(playlistId, sel) {
  const box = $(sel);
  if (!box || !playlistId) return;
  
  try {
    const j = await fetchYTJSON(`/youtube?playlist=${encodeURIComponent(playlistId)}&t=${Date.now()}`);
    box.innerHTML = (j.items || []).map(cardVideo).join("") || "<div class='muted'>Sem itens na playlist.</div>";
  } catch (e) {
    console.error("Fill playlist error:", e);
    box.innerHTML = "<div class='muted'>Erro ao carregar playlist.</div>";
  }
}

/* -------------------- Boot -------------------- */
function wire() {
  $("#yy") && ($("#yy").textContent = new Date().getFullYear());
  
  $("#btn-buscar")?.addEventListener("click", searchBible);
  $("#biblia-q")?.addEventListener("keydown", e => {
    if (e.key === "Enter") searchBible();
  });
  
  $("#btn-copy")?.addEventListener("click", async () => {
    try {
      const t = ($("#vday-text")?.textContent || "").trim();
      if (t) await navigator.clipboard.writeText(t);
    } catch (_) { }
  });
}

(async function boot() {
  wire();
  await loadCfg();
  mountVersions();
  
  // Load verse of day and videos in parallel
  await Promise.allSettled([
    loadVDay(),
    loadLiveOrLatest()
  ]);
})();
