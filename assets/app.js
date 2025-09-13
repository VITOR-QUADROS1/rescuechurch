// Carrega config
let appConfig = null;
async function loadConfig() {
  const r = await fetch("assets/config.json");
  appConfig = await r.json();
  window.appConfig = appConfig;
  return appConfig;
}

// Utilidades de tradução no front
function looksEnglish(t) {
  if (!t) return false;
  const hasAccents = /[áàâãéêíóôõúüç]/i.test(t);
  if (hasAccents) return false;
  const englishCue = /\b(the|and|of|in|to|with|will|shall|for|is|are|was|were|but|because|that|this|those|these)\b/i;
  return englishCue.test(t);
}
async function translateClient(text, source = "en", target = "pt") {
  try {
    const base = appConfig?.proxy?.workerBase || location.origin;
    const url = `${base}/api/translate?q=` + encodeURIComponent(text) + `&source=${source}&target=${target}`;
    const r = await fetch(url);
    if (!r.ok) return text;
    const j = await r.json();
    return j.text || text;
  } catch {
    return text;
  }
}
async function ensurePortuguese(text) {
  if (!text) return text;
  if (looksEnglish(text)) return await translateClient(text, "en", "pt");
  return text;
}

// UI helpers
const $ = (s, el = document) => el.querySelector(s);
function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  children.forEach(c => e.appendChild(c));
  return e;
}

// Versículo do dia
async function loadVerseOfDay() {
  const base = appConfig?.proxy?.workerBase || location.origin;
  const outText = $("#vday-text");
  const outRef  = $("#vday-ref");
  outText.textContent = "Carregando..."; outRef.textContent = "";

  try {
    const r = await fetch(`${base}/api/verse-of-day`);
    const j = await r.json();
    let text = j.text || "";
    text = await ensurePortuguese(text);
    outText.textContent = text || "(erro ao carregar)";
    outRef.textContent = j.ref ? `(${j.ref} — ${j.version || ""})` : "";
  } catch {
    outText.textContent = "(erro ao carregar)";
  }
}

// Busca na Bíblia
function fillVersions() {
  const sel = $("#biblia-ver");
  const map = appConfig?.biblia?.versions || {};
  sel.innerHTML = "";
  Object.entries(map).forEach(([label, code]) => {
    const o = document.createElement("option");
    o.value = code; o.textContent = label;
    if (code === (appConfig?.biblia?.defaultVersion || "NVI")) o.selected = true;
    sel.appendChild(o);
  });
}

async function doSearch() {
  const base = appConfig?.proxy?.workerBase || location.origin;
  const q  = $("#biblia-q").value.trim();
  const v  = $("#biblia-ver").value;
  const out = $("#biblia-out");
  if (!q) { out.value = ""; return; }

  out.value = "Procurando...";
  try {
    // o worker ignora o "v" na prática (é só para compor a URL)
    const url = `${base}/biblia/bible/content/${encodeURIComponent(v)}.txt?passage=${encodeURIComponent(q)}`;
    const r = await fetch(url);
    let txt = await r.text();
    txt = await ensurePortuguese(txt);
    out.value = txt || "Nenhum resultado encontrado.";
  } catch {
    out.value = "Erro ao buscar.";
  }
}

// Copiar VOD
function setupCopy() {
  $("#btn-copy").addEventListener("click", async () => {
    const t = $("#vday-text").textContent.trim();
    const r = $("#vday-ref").textContent.trim();
    const clip = [t, r].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(clip);
      $("#btn-copy").textContent = "Copiado ✅";
      setTimeout(() => $("#btn-copy").textContent = "Copiar 📋", 1200);
    } catch {}
  });
}

// YouTube
async function loadYouTube() {
  const base = appConfig?.proxy?.workerBase || location.origin;
  const yt = appConfig?.youtube || {};
  const liveFrame = $("#liveFrame");
  const live = await fetch(`${base}/api/youtube/live?channel=${yt.channelId}`).then(r=>r.json()).catch(()=>({isLive:false}));
  if (live.isLive && live.id) {
    liveFrame.src = `https://www.youtube.com/embed/${live.id}?autoplay=0`;
  } else {
    // usa último vídeo do canal se não estiver ao vivo
    const d = await fetch(`${base}/api/youtube?channel=${yt.channelId}`).then(r=>r.json()).catch(()=>({items:[]}));
    const last = d.items?.[0];
    if (last?.id) liveFrame.src = `https://www.youtube.com/embed/${last.id}`;
  }

  // Shorts
  const shortsBox = $("#shorts");
  if (yt.shortsPlaylist) {
    const s = await fetch(`${base}/api/youtube?playlist=${yt.shortsPlaylist}`).then(r=>r.json()).catch(()=>({items:[]}));
    (s.items||[]).forEach(v=>{
      const a = el("a", {class:"hitem", href:`https://youtu.be/${v.id}`, target:"_blank", rel:"noopener"});
      a.appendChild(el("img", {class:"hthumb", src:v.thumb || "", alt:""}));
      const meta = el("div", {class:"hmeta"});
      meta.appendChild(el("div", {class:"t"}, [document.createTextNode(v.title || "")]));
      shortsBox.appendChild(a); a.appendChild(meta);
    });
  }

  // Mensagens completas
  const fullsBox = $("#fulls");
  if (yt.fullPlaylist) {
    const s = await fetch(`${base}/api/youtube?playlist=${yt.fullPlaylist}`).then(r=>r.json()).catch(()=>({items:[]}));
    (s.items||[]).forEach(v=>{
      const a = el("a", {class:"hitem", href:`https://youtu.be/${v.id}`, target:"_blank", rel:"noopener"});
      a.appendChild(el("img", {class:"hthumb", src:v.thumb || "", alt:""}));
      const meta = el("div", {class:"hmeta"});
      meta.appendChild(el("div", {class:"t"}, [document.createTextNode(v.title || "")]));
      fullsBox.appendChild(a); a.appendChild(meta);
    });
  }
}

// Eventos
document.addEventListener("DOMContentLoaded", async () => {
  await loadConfig();
  $("#yy").textContent = new Date().getFullYear();

  setupCopy();
  fillVersions();
  loadVerseOfDay();
  loadYouTube();

  $("#btn-buscar").addEventListener("click", doSearch);
  $("#biblia-q").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });
});
