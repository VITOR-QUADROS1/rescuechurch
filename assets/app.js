/* ========= CONFIG ========= */
const API_BASE = "https://rescue-proxy.vitorpauloquadros.workers.dev/api"; // seu Worker
const $ = s => document.querySelector(s);

/* ========= UTIL ========= */
const esc = s => (s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();

/* ========= VERSÍCULO DO DIA ========= */
async function loadVerseOfDay(){
  const txt=$("#vday-text"), ref=$("#vday-ref");
  try{
    const r = await fetch(`${API_BASE}/verse-of-day?version=nvi`);
    if(!r.ok) throw 0;
    const j = await r.json();
    if(j?.text){
      txt.textContent = j.text.trim();
      ref.textContent = `${j.book.name} ${j.chapter}:${j.number} — ${ (j.book.version || "NVI").toUpperCase() }`;
      $("#versiculo").addEventListener("click", ()=>navigator.clipboard?.writeText(`${txt.textContent} — ${ref.textContent}`));
      return;
    }
  }catch{}
  txt.textContent = "Não foi possível carregar agora."; ref.textContent = "Tente novamente em instantes.";
}

/* ========= BUSCA ========= */
// "joao 3:16", "1 corintios 13", etc.
function parseRefPT(raw){
  let s = norm(raw).replace(/^([1-3])([a-z])/,"$1 $2");
  const m = /^(.+?)\s+(\d+)(?::(\d+))?/.exec(s);
  if(!m) return null;
  return { book:m[1], chapter:m[2], verse:m[3]||"" };
}

async function searchBible(q, version){
  const results=$("#results"); results.innerHTML="";
  const info=$("#searchInfo"); info.textContent="";

  const add = (text,ref) => {
    const el = document.createElement("div");
    el.className = "result";
    el.innerHTML = `<div>${esc(text)}</div><div class="ref">${esc(ref)}</div>`;
    el.addEventListener("click",()=>navigator.clipboard?.writeText(`${text} — ${ref}`));
    results.appendChild(el);
  };

  const ref = parseRefPT(q);

  // 1) Referência direta
  if(ref){
    try{
      const p = new URLSearchParams({version, book:ref.book, chapter:ref.chapter});
      if(ref.verse) p.set("verse", ref.verse);
      const r = await fetch(`${API_BASE}/referenceByName?`+p.toString());
      const j = await r.json();
      if(j?.text){ add(j.text, `${j.book.name} ${j.chapter}:${j.number} (${version.toUpperCase()})`); return; }
      if(Array.isArray(j?.verses)){
        j.verses.forEach(v=>add(v.text, `${j.book.name} ${j.chapter}:${v.number} (${version.toUpperCase()})`));
        return;
      }
    }catch{}
  }

  // 2) Busca textual
  try{
    const r = await fetch(`${API_BASE}/search?version=${encodeURIComponent(version)}&q=${encodeURIComponent(q)}`);
    const j = await r.json();
    if(Array.isArray(j?.verses) && j.verses.length){
      j.verses.slice(0,80).forEach(v=>add(v.text, `${v.book.name} ${v.chapter}:${v.number} (${version.toUpperCase()})`));
      return;
    }
  }catch{}

  info.textContent="Nenhum resultado agora. Tente outra palavra ou referência (ex.: João 3:16).";
}

/* ========= YOUTUBE ========= */
function applyYouTubeEmbeds(){
  const UC = "";           // ex.: UCxxxxxxxxxxxxxxxxxxxxxx
  const UU = "";           // ex.: UUxxxxxxxxxxxxxxxxxxxxxx (uploads)
  const PL_SHORTS = "";    // playlist curtos
  const PL_FULL   = "";    // playlist mensagens completas

  $("#liveFrame").src = UC
    ? `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(UC)}&rel=0`
    : "";

  $("#shortsFrame").src = PL_SHORTS
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(PL_SHORTS)}`
    : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent("shorts Igreja de Resgate")}`;

  $("#fullFrame").src = PL_FULL
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(PL_FULL)}`
    : (UU ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(UU)}`
          : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent("Igreja de Resgate pregação")}`);
}

/* ========= BOOT ========= */
document.addEventListener("DOMContentLoaded", ()=>{
  $("#yy").textContent = new Date().getFullYear();
  loadVerseOfDay();
  applyYouTubeEmbeds();

  $("#searchForm")?.addEventListener("submit", (e)=>{
    e.preventDefault();
    const q = $("#q").value.trim();
    if(!q) return;
    searchBible(q, $("#trad").value);
  });
});
