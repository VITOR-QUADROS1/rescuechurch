const $  = (q)=>document.querySelector(q);
const CFG = window.APP_CFG || { yt:{} };

/* ========== Fetch com timeout ========== */
async function fetchWithTimeout(url, opts={}, ms=12000){
  const ctrl = new AbortController();
  const id = setTimeout(()=>ctrl.abort(), ms);
  try{
    const r = await fetch(url, {...opts, signal: ctrl.signal});
    clearTimeout(id);
    return r;
  }catch(e){
    clearTimeout(id);
    throw e;
  }
}

/* ========== Detecção simples EN/PT ========== */
function isEN(s){
  if(!s) return false;
  if(/[áéíóúãõâêôçÁÉÍÓÚÃÕÂÊÔÇ]/.test(s)) return false;
  const en = (s.match(/\b(the|and|will|because|but|world|son|god|him|for|so|loved|be|with)\b/gi)||[]).length;
  const pt = (s.match(/\b(de|do|da|que|porque|mas|Deus|mundo|filho|Senhor|com|para|não)\b/gi)||[]).length;
  return en>=2 && pt<2;
}

/* ========== Tradução via POST (Worker chunking) ========== */
async function translateToPT(text){
  try{
    const r = await fetchWithTimeout(`/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, from: "en", to: "pt-BR" })
    }, 15000);
    const j = await r.json().catch(()=>({}));
    return j.text || text;
  }catch{ return text; }
}

/* ========== Versículo do dia ========== */
async function loadVDay(){
  const t = $("#vday-text"), ref = $("#vday-ref"), err = $("#vday-err");
  if(!t || !ref) return;

  t.textContent = "Carregando...";
  ref.textContent = ""; err && (err.style.display="none");

  try{
    // força bust de cache no caminho (query)
    const r = await fetchWithTimeout(`/api/verse-of-day?ts=${Date.now()}`, {}, 12000);
    const j = await r.json().catch(()=>({}));
    let txt = j.text || "";

    if(!txt && j.ref){
      const r2 = await fetchWithTimeout(`/biblia/bible/content/NVI.txt?passage=${encodeURIComponent(j.ref)}`, {}, 12000);
      if(r2.ok) txt = await r2.text();
    }
    if(!txt){ throw new Error("Sem texto retornado"); }

    if(isEN(txt)) txt = await translateToPT(txt);

    t.textContent = txt;
    ref.textContent = `(${j.ref || ""} — ${j.version || "NVI"})`;
  }catch(e){
    t.textContent = "(erro ao carregar)";
    if(err){
      err.textContent = "Falha ao consultar /api/verse-of-day ou /biblia/…";
      err.style.display = "block";
    }
  }
}

/* ========== Busca na Bíblia ========== */
async function searchBible(){
  const q = $("#biblia-q"), out = $("#biblia-out");
  const ref = (q.value||"").trim();
  if(!ref){ out.value=""; return; }
  out.value="(buscando...)";
  try{
    const r = await fetchWithTimeout(`/biblia/bible/content/NVI.txt?passage=${encodeURIComponent(ref)}`, {}, 15000);
    let txt = await r.text();
    if(!r.ok || !txt) throw new Error("sem resultado");

    if(isEN(txt)) txt = await translateToPT(txt);
    out.value = txt;
  }catch(e){
    out.value = "Erro ao consultar a Bíblia.";
  }
}

/* ========== YouTube ========== */
function yt(id){ return `https://www.youtube.com/embed/${id}?autoplay=0&rel=0`; }

async function loadLiveOrLatest(){
  const frame = $("#liveFrame");
  if(!frame || !CFG?.yt?.channelId) return;
  try{
    const live = await fetchWithTimeout(`/api/youtube/live?channel=${CFG.yt.channelId}`, {}, 10000).then(r=>r.json());
    if(live?.isLive && live?.id){ frame.src = yt(live.id); return; }
  }catch{}

  try{
    const list = await fetchWithTimeout(`/api/youtube?channel=${CFG.yt.channelId}`, {}, 10000).then(r=>r.json());
    const id = list?.items?.[0]?.id;
    if(id) frame.src = yt(id);
  }catch{}
}

async function fillPlaylist(pid, sel){
  const box = $(sel); if(!box) return;
  box.innerHTML="";
  try{
    const data = await fetchWithTimeout(`/api/youtube?playlist=${pid}`, {}, 12000).then(r=>r.json());
    for(const it of (data.items||[])){
      const a = document.createElement("a");
      a.href = `https://www.youtube.com/watch?v=${it.id}`; a.target="_blank"; a.rel="noopener";
      a.className = "hitem";
      a.innerHTML = `
        <img class="hthumb" src="${it.thumb}" alt="">
        <div class="hmeta">
          <span class="t">${it.title||""}</span>
          <span class="s">${(it.published||"").replace("T"," ").replace("Z","")}</span>
        </div>`;
      box.appendChild(a);
    }
  }catch{}
}

/* ========== binds ========== */
function boot(){
  $("#yy") && ($("#yy").textContent = new Date().getFullYear());
  $("#btn-buscar")?.addEventListener("click", searchBible);
  $("#biblia-q")?.addEventListener("keydown", e=>{ if(e.key==="Enter") searchBible(); });

  $("#btn-copy")?.addEventListener("click", async ()=>{
    try{ await navigator.clipboard.writeText(($("#vday-text").textContent||"").trim()); }catch{}
  });

  loadVDay();
  loadLiveOrLatest();
  if(CFG?.yt?.shortsPlaylistId) fillPlaylist(CFG.yt.shortsPlaylistId, "#shorts");
  if(CFG?.yt?.fullPlaylistId)   fillPlaylist(CFG.yt.fullPlaylistId,   "#fulls");
}
document.addEventListener("DOMContentLoaded", boot);
