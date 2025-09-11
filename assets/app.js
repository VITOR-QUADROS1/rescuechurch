/* ====== helpers ====== */
const $ = (q) => document.querySelector(q);
const store = {
  get() { try { return JSON.parse(localStorage.getItem("rc:cfg") || "{}"); } catch { return {}; } },
  set(cfg) { localStorage.setItem("rc:cfg", JSON.stringify(cfg)); }
};
function copyToClipboard(text){ navigator.clipboard?.writeText(text).catch(()=>{}); }
function escapeHTML(s){ return s.replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }
const strip = (s)=> s.normalize?.("NFD").replace(/[\u0300-\u036f]/g,"") || s;

/* ====== Versículo do dia (OurManna → fallback local) ====== */
async function loadVerseOfDay() {
  const vtext = $("#vday-text"); const vref = $("#vday-ref");
  try {
    const r = await fetch("https://www.ourmanna.com/api/v1/get/?format=json");
    if (!r.ok) throw new Error("falha ourmanna");
    const j = await r.json();
    vtext.textContent = j.verse.details.text.trim();
    vref.textContent  = `${j.verse.details.reference} — ${j.verse.details.version}`;
  } catch {
    const pool = [
      {t:"Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito...", r:"João 3:16 (ARA)"},
      {t:"O Senhor é o meu pastor; nada me faltará.", r:"Salmo 23:1 (ARA)"},
      {t:"Posso todas as coisas naquele que me fortalece.", r:"Filipenses 4:13 (ARA)"},
      {t:"Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento.", r:"Provérbios 3:5 (ARA)"},
    ];
    const i = new Date().getDate() % pool.length;
    vtext.textContent = pool[i].t; vref.textContent = pool[i].r + " — (offline)";
  }
  $("#versiculo").addEventListener("click", () => {
    copyToClipboard(`${vtext.textContent} ${vref.textContent}`);
  });
}

/* ====== Busca Bíblica (PT-BR sem token + fallback KJV) ====== */
function looksLikeReference(q){
  const s = strip(q.trim().toLowerCase());
  return /^[0-3]?\s?[a-z\.]+(\s+[a-z\.]+)?\s+\d+([:.]\d+(-\d+)?)?$/.test(s);
}
async function searchBible(q, trad) {
  const results = $("#results"); results.innerHTML = "";
  const info = $("#searchInfo"); info.textContent = "";
  const version = trad; // "nvi" | "acf" | "kjv"
  const refLike = looksLikeReference(q);

  // 1) PT-BR (A Bíblia Digital – busca pública)
  if (version === "nvi" || version === "acf") {
    try {
      const url = `https://www.abibliadigital.com.br/api/verses/search?version=${version}&search=${encodeURIComponent(q)}`;
      const r = await fetch(url);
      if (r.ok) {
        const j = await r.json();
        if (Array.isArray(j?.verses) && j.verses.length) {
          j.verses.slice(0, 50).forEach(v =>
            renderItem({ text: v.text, ref: `${v.book.name} ${v.chapter}:${v.number} (${version.toUpperCase()})` })
          );
          return;
        }
      }
      info.innerHTML = "A busca pública pode estar limitada agora. Tentando alternativa…";
    } catch {
      info.innerHTML = "A busca pública pode estar limitada agora. Tentando alternativa…";
    }
  }

  // 2) Fallback KJV (somente referência)
  if (refLike) {
    try {
      const r2 = await fetch(`https://bible-api.com/${encodeURIComponent(q)}?translation=kjv`);
      const j2 = await r2.json();
      if (Array.isArray(j2?.verses) && j2.verses.length){
        j2.verses.forEach(v =>
          renderItem({ text: v.text.trim(), ref: `${v.book_name} ${v.chapter}:${v.verse} (KJV)` })
        );
        return;
      }
    } catch {}
  }

  results.innerHTML = `<div class="muted">Nenhum resultado. Dica: tente uma referência (ex.: João 3:16) ou outra palavra.</div>`;

  function renderItem(v){
    const el = document.createElement("div");
    el.className = "result";
    el.innerHTML = `<div>${escapeHTML(v.text)}</div><div class="ref">${escapeHTML(v.ref)}</div>`;
    el.addEventListener("click", ()=> copyToClipboard(`${v.text} — ${v.ref}`));
    results.appendChild(el);
  }
}

/* ====== YouTube (sem API key) ======
   - Live: usa @handle ou UC... diretamente
   - Shorts: se PL... informado → usa playlist; senão usa busca "<canal> shorts"
   - Completos: se PL... informado → usa playlist; senão usa uploads (UU...) se informado; senão uploads do user/handle
*/
function applyYouTubeEmbeds(cfg){
  const channel = (cfg.ytChannel?.trim() || "@youtube");     // @handle ou UC...
  const uploads = cfg.ytUploads?.trim() || "";                // UU...
  const plShorts = cfg.ytShortsPL?.trim() || "";              // PL...
  const plFull   = cfg.ytFullPL?.trim() || "";                // PL...
  const nameForSearch = channel.replace(/^@/, "");

  // live
  $("#liveFrame").src = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(channel)}&rel=0`;

  // shorts
  $("#shortsFrame").src = plShorts
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(plShorts)}`
    : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(nameForSearch + " shorts")}`;

  // completos
  $("#fullFrame").src = plFull
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(plFull)}`
    : (uploads
        ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(uploads)}`
        : `https://www.youtube.com/embed?listType=user_uploads&list=${encodeURIComponent(nameForSearch)}`);
}

/* ====== Config ====== */
function openConfig(){
  const cfg = store.get();
  $("#ytChannel").value = cfg.ytChannel || "";
  $("#ytUploads").value = cfg.ytUploads || "";
  $("#ytShortsPL").value = cfg.ytShortsPL || "";
  $("#ytFullPL").value = cfg.ytFullPL || "";
  $("#configModal").showModal();
}
function saveConfig(){
  const cfg = store.get();
  cfg.ytChannel  = $("#ytChannel").value.trim();
  cfg.ytUploads  = $("#ytUploads").value.trim();
  cfg.ytShortsPL = $("#ytShortsPL").value.trim();
  cfg.ytFullPL   = $("#ytFullPL").value.trim();
  store.set(cfg);
  applyYouTubeEmbeds(cfg);
}

/* ====== boot ====== */
document.addEventListener("DOMContentLoaded", () => {
  $("#yy").textContent = new Date().getFullYear();
  loadVerseOfDay();

  const cfg = store.get();
  applyYouTubeEmbeds(cfg);

  $("#btnConfig").addEventListener("click", openConfig);
  $("#saveCfg").addEventListener("click", saveConfig);

  $("#searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#q").value.trim();
    if (!q) return;
    const trad = $("#trad").value;
    searchBible(q, trad);
  });
});
