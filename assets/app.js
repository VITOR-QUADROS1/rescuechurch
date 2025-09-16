/* assets/app.js - v12.3 (playlist Gospel + Instagram) */
const $ = (q) => document.querySelector(q);

// --- FUNÇÕES GLOBAIS ---
const CFG = { proxy: { workerBase: "/api" }, biblia: {}, youtube: {} };
const api = (p) => (CFG?.proxy?.workerBase || "/api").replace(/\/$/, "") + (p.startsWith("/") ? p : `/${p}`);

// Heurística rápida para “parece inglês?”
const looksEN = (s) => {
  const t = (" " + String(s || "") + " ").toLowerCase();
  const hits = [" the ", " and ", " lord ", " god ", " you ", " your ", " shall ", " for ", " now ", " i will "]
    .filter(w => t.includes(w));
  // tem palavras super comuns do inglês e não tem acento típico do PT
  return hits.length >= 2 && !/[áàãâéêíóôõúç]/i.test(t);
};

async function loadCfg() {
  try {
    const r = await fetch("assets/config.json", { cache: "no-store" });
    if (r.ok) Object.assign(CFG, await r.json());
  } catch (e) { console.warn("config.json falhou:", e); }
}

async function fetchJSON(url) {
  try {
    const r = await fetch(url);
    return r.ok ? await r.json() : null;
  } catch (_) { return null; }
}

// --- VERSÍCULO DO DIA ---
async function loadVDay() {
  const txt = $("#vday-text"), ref = $("#vday-ref");
  if (!txt || !ref) return;
  txt.textContent = "Carregando…"; ref.textContent = "";
  try {
    const j = await fetchJSON(api(`/verse-of-day?lang=pt&t=${Date.now()}`));
    if (j?.text) {
      txt.textContent = j.text.trim();
      ref.textContent = `${j.ref || ""} — ${j.version || "NVI"}`;
    } else {
      txt.textContent = "(erro ao carregar)";
    }
  } catch (_) {
    txt.textContent = "(erro ao carregar)";
  }
}

// --- BUSCA NA BÍBLIA ---
function mountVersions() {
  const sel = $("#biblia-ver"); if (!sel) return;
  const vers = CFG?.biblia?.versions || {};
  sel.innerHTML = "";
  Object.entries(vers).forEach(([label, val]) => {
    const o = document.createElement("option"); o.textContent = label; o.value = val; sel.appendChild(o);
  });
  const def = CFG?.biblia?.defaultVersion;
  if (def) { const i = [...sel.options].findIndex(o => o.value === def); if (i >= 0) sel.selectedIndex = i; }
}

async function searchBible() {
  const qEl = $("#biblia-q"), out = $("#biblia-out"), btn = $("#btn-buscar");
  if (!qEl || !out) return;
  const q = (qEl.value || "").trim(); if (!q) { qEl.focus(); return; }
  out.value = "Buscando…"; btn && btn.classList.add("is-loading");
  try {
    // pede ao worker já com lang=pt
    const r = await fetch(api(`/biblia/bible/content/NVI.txt?passage=${encodeURIComponent(q)}&lang=pt&t=${Date.now()}`));
    const raw = r.ok ? (await r.text()).trim() : "";
    if (!raw) {
      out.value = "Nenhum resultado encontrado.";
    } else if (looksEN(raw)) {
      // FALLBACK: se ainda veio em EN, usa o tradutor do próprio worker
      const j = await fetchJSON(api(`/translate?q=${encodeURIComponent(raw)}&from=auto&to=pt-BR&t=${Date.now()}`));
      out.value = (j?.text || raw).trim();
    } else {
      out.value = raw;
    }
  } catch (e) {
    out.value = "Erro ao buscar. Ex.: João 3:16";
  } finally { btn && btn.classList.remove("is-loading"); }
}

// --- YOUTUBE ---
const cardVideo = (v) => {
  const thumb = v.thumb || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
  const title = (v.title || "").trim();
  const date = v.published ? new Date(v.published).toLocaleDateString("pt-BR", { year: 'numeric', month: '2-digit', day: '2-digit' }) : "";
  return `
  <a class="yt-card" href="https://www.youtube.com/watch?v=${v.id}" data-vid="${v.id}">
    <img loading="lazy" class="yt-thumb" src="${thumb}" alt="Thumbnail do vídeo">
    <div class="yt-info">
      <div class="yt-title">${title}</div>
      <div class="yt-date">${date}</div>
    </div>
  </a>`;
};

async function fillPlaylist(pid, sel) {
  const box = $(sel); if (!box || !pid) return;
  const j = await fetchJSON(api(`/youtube?playlist=${encodeURIComponent(pid)}&t=${Date.now()}`));
  box.innerHTML = (j?.items || []).map(cardVideo).join("") || "<div class='muted' style='padding:8px'>Sem itens.</div>";
  setupCarousel(box.parentElement);
}

async function loadLiveOrLatest() {
  const ch = CFG?.youtube?.channelId; if (!ch) return;
  const frame = $("#liveFrame"), list = $("#fulls");
  const live = await fetchJSON(api(`/youtube/live?channel=${encodeURIComponent(ch)}&t=${Date.now()}`));
  const latest = await fetchJSON(api(`/youtube?channel=${encodeURIComponent(ch)}&t=${Date.now()}`));
  const items = (latest?.items || []).slice(0, 18);
  if (list) {
    list.innerHTML = items.map(cardVideo).join("") || "<div class='muted' style='padding:8px'>Sem vídeos recentes.</div>";
    setupCarousel(list.parentElement);
  }
  const id = (live?.isLive && live?.id) ? live.id : (items[0]?.id || null);
  if (frame && id) frame.src = `https://www.youtube.com/embed/${id}?rel=0&autoplay=1`;
  if (CFG?.youtube?.shortsPlaylist) await fillPlaylist(CFG.youtube.shortsPlaylist, "#shorts");
}

// --- NOVO: carregar a playlist “Gospel” ---
async function loadExtraPlaylists() {
  if (CFG?.youtube?.gospelPlaylist) {
    await fillPlaylist(CFG.youtube.gospelPlaylist, "#gospel");
  }
}

// --- NOVO: Instagram (10 últimos vídeos) ---
const escapeHtml = (s="") => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cardIG = (p) => {
  const title = escapeHtml((p.title || "Vídeo no Instagram").trim());
  const date  = p.published ? new Date(p.published).toLocaleDateString("pt-BR") : "";
  const thumb = p.thumb || "";
  return `
  <a class="yt-card" href="${p.permalink}" target="_blank" rel="noopener">
    <img loading="lazy" class="yt-thumb" src="${thumb}" alt="Vídeo do Instagram">
    <div class="yt-info">
      <div class="yt-title">${title}</div>
      <div class="yt-date">${date}</div>
    </div>
  </a>`;
};
async function loadInstagram() {
  const box = $("#insta"); if (!box) return;
  const j = await fetchJSON(api(`/instagram?max=10&t=${Date.now()}`));
  box.innerHTML = (j?.items || []).map(cardIG).join("") || "<div class='muted' style='padding:8px'>Sem vídeos do Instagram no momento.</div>";
  setupCarousel(box.parentElement);
}

// --- CARROSSEL ---
function setupCarousel(carouselEl) {
  const track = carouselEl.querySelector('.hscroll');
  if (!track) return;
  const hasOverflow = track.scrollWidth > track.clientWidth;
  if (!hasOverflow || carouselEl.querySelector(".carousel-nav")) return;

  const mkBtn = (dir) => {
    const b = document.createElement("button");
    b.className = `carousel-nav ${dir}`;
    b.textContent = dir === "next" ? "›" : "‹";
    b.addEventListener("click", () => {
      const card = track.querySelector('.yt-card');
      if (card) {
        const scrollAmount = card.offsetWidth + parseInt(getComputedStyle(track).gap);
        track.scrollBy({ left: dir === 'next' ? scrollAmount : -scrollAmount, behavior: 'smooth' });
      }
    });
    return b;
  };
  carouselEl.appendChild(mkBtn("prev"));
  carouselEl.appendChild(mkBtn("next"));
}

// --- MODAL DE VÍDEO ---
const modal = $("#ytModal");
const iframe = $("#ytFrame");
function openModal(videoId) {
  if (!modal || !iframe) return;
  iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModal() {
  if (!modal || !iframe) return;
  iframe.src = "";
  modal.hidden = true;
  document.body.style.overflow = "";
}

// --- INICIALIZAÇÃO ---
function wireEventListeners() {
  $("#btn-buscar")?.addEventListener("click", searchBible);
  $("#biblia-q")?.addEventListener("keydown", (e) => { if (e.key === "Enter") searchBible(); });
  $("#btn-copy")?.addEventListener("click", async () => {
    const textToCopy = ($("#vday-text")?.textContent || "").trim() + "\n" + ($("#vday-ref")?.textContent || "").trim();
    if (textToCopy) await navigator.clipboard.writeText(textToCopy);
  });
  
  document.addEventListener("click", (e) => {
    const card = e.target.closest(".yt-card[data-vid]");
    if (card) {
      e.preventDefault();
      openModal(card.dataset.vid);
    }
    if (e.target.closest(".yt-close") || e.target === modal) {
      closeModal();
    }
  });

  window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  
  $("#yy") && ($("#yy").textContent = new Date().getFullYear());
}

(async function boot() {
  wireEventListeners();
  await loadCfg();
  mountVersions();
  await Promise.all([loadVDay(), loadLiveOrLatest()]);
  await loadExtraPlaylists();   // Gospel
  await loadInstagram();        // Instagram (10 vídeos)
})();
