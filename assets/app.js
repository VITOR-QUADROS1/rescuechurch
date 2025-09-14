/* assets/app.js — Versão Simplificada */
const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

const CFG = { proxy: { workerBase: "/api" }, biblia: {}, youtube: {} };

/* --------- boot config ---------- */
async function loadCfg() {
  try {
    const r = await fetch("assets/config.json", { cache: "no-store" });
    if (r.ok) { Object.assign(CFG, await r.json()); }
  } catch (e) { 
    console.warn("config.json falhou, usando defaults");
  }
}

function api(path) {
  const base = (CFG?.proxy?.workerBase || "/api").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/* -------------------- Utils -------------------- */
function setLoading(el, on = true) {
  if (!el) return;
  el.classList.toggle("is-loading", !!on);
}

async function fetchJSON(url, ms = 8000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok ? await r.json() : null;
  } catch (_) {
    return null;
  }
}

async function fetchText(url, ms = 8000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok ? await r.text() : null;
  } catch (_) {
    return null;
  }
}

/* -------------------- Versículo do Dia -------------------- */
async function loadVDay() {
  const txt = $("#vday-text"), ref = $("#vday-ref");
  if (!txt || !ref) return;
  
  txt.textContent = "Carregando…";
  ref.textContent = "";
  
  try {
    const j = await fetchJSON(api(`/verse-of-day?lang=pt&t=${Date.now()}`), 5000);
    if (j?.text) {
      txt.textContent = j.text;
      ref.textContent = `${j.ref || ""} — ${j.version || "NVI"}`;
    } else {
      txt.textContent = "Porque Deus tanto amou o mundo que deu o seu Filho unigênito...";
      ref.textContent = "João 3:16 — NVI";
    }
  } catch (e) {
    txt.textContent = "Porque Deus tanto amou o mundo que deu o seu Filho unigênito...";
    ref.textContent = "João 3:16 — NVI";
  }
}

/* -------------------- Busca bíblica -------------------- */
function mountVersions() {
  const sel = $("#biblia-ver");
  if (!sel) return;
  
  const versions = {
    "NVI (pt-BR)": "POR-NVI",
    "NTLH (pt-BR)": "POR-NTLH", 
    "ARA (pt-BR)": "POR-ARA",
    "LEB (en)": "LEB",
    "ESV (en)": "ESV"
  };
  
  sel.innerHTML = "";
  for (const label of Object.keys(versions)) {
    const opt = document.createElement("option");
    opt.textContent = label;
    opt.value = versions[label];
    sel.appendChild(opt);
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
    const txt = await fetchText(url, 10000);
    
    if (txt) {
      out.value = txt;
    } else {
      out.value = `Busca por: ${q}\n\n(Resultados apareceriam aqui)`;
    }
  } catch (e) {
    out.value = "Erro ao buscar. Tente: João 3:16";
  } finally {
    setLoading(btn, false);
  }
}

/* -------------------- YouTube -------------------- */
function cardVideo(v) {
  if (!v?.id) return "";
  
  const thumb = v.thumb || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
  const title = (v.title || "Sem título").trim();
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
    const j = await fetchJSON(api(q), 8000);
    return j || { items: [] };
  } catch (e) {
    return { items: [] };
  }
}

async function loadLiveOrLatest() {
  const ch = "UC11Km85MPiYbuPmG7Lz2Wjg"; // Channel ID fixo
  const liveFrame = $("#liveFrame");
  const shortsBox = $("#shorts");
  const fullsBox = $("#fulls");
  
  // Live stream
  try {
    const live = await fetchYTJSON(`/youtube/live?channel=${ch}&t=${Date.now()}`);
    if (liveFrame) {
      if (live?.isLive && live?.id) {
        liveFrame.src = `https://www.youtube.com/embed/${live.id}?autoplay=1`;
      } else {
        // Load latest video as fallback
        const latest = await fetchYTJSON(`/youtube?channel=${ch}&t=${Date.now()}`);
        const latestId = latest.items?.[0]?.id;
        liveFrame.src = latestId ? `https://www.youtube.com/embed/${latestId}` : "about:blank";
      }
    }
  } catch (e) {
    if (liveFrame) liveFrame.src = "about:blank";
  }

  // Playlists - usando fallback fixo
  try {
    // Shorts
    if (shortsBox) {
      const shorts = await fetchYTJSON(`/youtube?playlist=UUSH11Km85MPiYbuPmG7Lz2Wjg&t=${Date.now()}`);
      shortsBox.innerHTML = (shorts.items || []).map(cardVideo).join("") || 
        "<div class='muted'>Sem vídeos curtos no momento.</div>";
    }

    // Full messages
    if (fullsBox) {
      const fulls = await fetchYTJSON(`/youtube?playlist=UU11Km85MPiYbuPmG7Lz2Wjg&t=${Date.now()}`);
      fullsBox.innerHTML = (fulls.items || []).map(cardVideo).join("") || 
        "<div class='muted'>Sem mensagens completas no momento.</div>";
    }
  } catch (e) {
    if (shortsBox) shortsBox.innerHTML = "<div class='muted'>Erro ao carregar shorts.</div>";
    if (fullsBox) fullsBox.innerHTML = "<div class='muted'>Erro ao carregar vídeos.</div>";
  }
}

/* -------------------- Boot -------------------- */
function wire() {
  $("#yy") && ($("#yy").textContent = new Date().getFullYear());
  
  $("#btn-buscar")?.addEventListener("click", searchBible);
  $("#biblia-q")?.addEventListener("keydown", e => {
    if (e.key === "Enter") searchBible();
  });
  
  $("#btn-copy")?.addEventListener("click", () => {
    const t = ($("#vday-text")?.textContent || "").trim();
    if (t) navigator.clipboard.writeText(t).catch(() => {});
  });
}

// Boot simplificado
async function boot() {
  wire();
  mountVersions();
  
  // Carregar versículo do dia imediatamente
  loadVDay();
  
  // Carregar vídeos com pequeno delay
  setTimeout(loadLiveOrLatest, 1000);
}

// Iniciar
boot();
