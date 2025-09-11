(async function () {
  const cfg = await fetch("/assets/config.json").then(r => r.json());
  const W = cfg.workerBase.replace(/\/$/, "");

  // ---------- HERO ----------
  const hero = document.querySelector(".hero");
  if (hero) hero.classList.add("hero-cover");

  // ---------- BÍBLIA ----------
  const versionSelect = document.querySelector("#version");
  const input = document.querySelector("#search");
  const btn = document.querySelector("#btnSearch");
  const results = document.querySelector("#results");
  const verseText = document.querySelector("#verseText");
  const copyBtn = document.querySelector("#btnCopy");

  // versões
  if (versionSelect) {
    versionSelect.innerHTML = "";
    Object.keys(cfg.biblia.versions).forEach(name => {
      const v = document.createElement("option");
      v.value = name;
      v.textContent = name;
      if (name === cfg.biblia.defaultVersion) v.selected = true;
      versionSelect.appendChild(v);
    });
  }
  const getVer = () => cfg.biblia.versions[versionSelect.value];

  // Verso do dia
  async function loadVerseOfDay() {
    try {
      const j = await fetch(`${W}/api/verse-of-day`).then(r => r.json());
      const ref = j.ref;
      const ver = getVer();
      const txt = await fetch(`${W}/biblia/bible/content/${ver}.txt?passage=${encodeURIComponent(ref)}`).then(r => r.text());
      verseText.innerHTML = `<strong>${ref}</strong> — ${txt}`;
    } catch {
      verseText.textContent = "Não foi possível carregar agora. Tente novamente mais tarde.";
    }
  }
  if (verseText) loadVerseOfDay();

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const t = verseText?.innerText?.trim();
      if (t) navigator.clipboard.writeText(t);
    });
  }

  // Busca
  function looksLikeReference(q) {
    return /\d+\s*[:.]\s*\d+/.test(q) || /\b(gn|ex|lv|nm|dt|js|rt|1s|2s|1r|2r|ne|et|jó|sl|pv|ec|ct|is|jr|lm|ez|dn|os|jl|am|ob|jn|mq|na|hc|sf|ag|zc|ml|mt|mc|lc|jo|at|rm|1c|2c|gl|ef|fp|cl|1t|2t|tt|fm|hb|tg|1p|2p|1j|2j|3j|jd|ap|joao|jo|salmo|salmos)/i.test(q);
  }

  async function doSearch() {
    results.innerHTML = "";
    const q = (input.value || "").trim();
    if (!q) return;

    const ver = getVer();
    try {
      if (looksLikeReference(q)) {
        const txt = await fetch(`${W}/biblia/bible/content/${ver}.txt?passage=${encodeURIComponent(q)}`).then(r => r.text());
        results.innerHTML = `<div class="result ref"><strong>${q}</strong><br>${txt}</div>`;
      } else {
        const j = await fetch(`${W}/biblia/bible/search/${ver}.json?query=${encodeURIComponent(q)}`).then(r => r.json());
        if (!j.results?.length) {
          results.innerHTML = `<div class="muted">Nenhum resultado agora. Tente outra referência.</div>`;
          return;
        }
        results.innerHTML = j.results.slice(0, 10).map(r => `
          <div class="result">
            <div class="ref">${r.reference}</div>
            <div class="txt">${r.text}</div>
          </div>`).join("");
      }
    } catch {
      results.innerHTML = `<div class="muted">Erro ao consultar. Tente novamente.</div>`;
    }
  }

  if (btn) btn.addEventListener("click", doSearch);
  if (input) input.addEventListener("keydown", e => (e.key === "Enter") && doSearch());
  if (versionSelect) versionSelect.addEventListener("change", () => {
    if (verseText) loadVerseOfDay();
    if (results.innerHTML) doSearch();
  });

  // ---------- VÍDEOS ----------
  const liveBox = document.querySelector("#live");
  const shortsRail = document.querySelector("#shortsRail");
  const fullRail = document.querySelector("#fullRail");

  async function getFeed(url) {
    const xml = await fetch(url).then(r => r.text());
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    return [...doc.querySelectorAll("entry")].map(e => ({
      id: e.querySelector("yt\\:videoId, videoId")?.textContent,
      title: e.querySelector("title")?.textContent || ""
    })).filter(x => x.id);
  }

  async function loadLive() {
    if (!liveBox || !cfg.youtube.channelId) return;
    const items = await getFeed(`${W}/api/youtube?uploads=${encodeURIComponent(cfg.youtube.channelId)}`);
    if (!items.length) return;
    const vid = items[0].id;
    liveBox.innerHTML = `<iframe class="yt" loading="lazy"
      src="https://www.youtube.com/embed/${vid}" title="Live/Último vídeo"
      frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen></iframe>`;
  }

  async function loadPlaylist(playlistId, railEl) {
    if (!playlistId || !railEl) return;
    const items = await getFeed(`${W}/api/youtube?playlist=${encodeURIComponent(playlistId)}`);
    railEl.innerHTML = items.slice(0, 12).map(v => {
      const thumb = `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
      return `<a class="card" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">
        <img src="${thumb}" alt="${escapeHTML(v.title)}">
        <span class="title">${escapeHTML(v.title)}</span>
      </a>`;
    }).join("");
  }

  function escapeHTML(s) {
    return (s || "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
  }

  loadLive();
  loadPlaylist(cfg.youtube.shortsPlaylist, shortsRail);
  loadPlaylist(cfg.youtube.fullPlaylist, fullRail);
})();
