const $  = (q)=>document.querySelector(q);

const CFG = window.APP_CFG || { yt:{} };

// util: timeout p/ fetch (evita “Carregando...” eterno)
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

/* -------------- VERSÍCULO DO DIA -------------- */
async function loadVDay(){
  const t = $("#vday-text"), ref = $("#vday-ref"), err = $("#vday-err");
  t.textContent = "Carregando...";
  ref.textContent = ""; err.style.display="none";

  try {
    const r = await fetchWithTimeout("/api/verse-of-day", {}, 12000);
    const j = await r.json().catch(()=>({}));
    let txt = j.text || "";

    // Se o texto estiver vazio, busca a versão PT diretamente (fallback)
    if(!txt && j.ref){
      const r2 = await fetchWithTimeout(`/biblia/bible/content/NVI.txt?passage=${encodeURIComponent(j.ref)}`, {}, 12000);
      if(r2.ok) txt = await r2.text();
    }

    if(!txt){ throw new Error("Sem texto retornado"); }

    // A tradução agora é responsabilidade do Worker, então apenas exibimos o resultado
    t.textContent = txt;
    ref.textContent = `(${j.ref || ""} — ${j.version || "NVI"})`;
  } catch(e) {
    t.textContent = "(erro ao carregar)";
    err.textContent = "Falha ao consultar /api/verse-of-day (verifique as rotas do Worker e o cache).";
    err.style.display = "block";
  }
}

/* -------------- BUSCA -------------- */
async function searchBible(){
  const q = $("#biblia-q"), out = $("#biblia-out");
  const ref = (q.value||"").trim();
  if(!ref){ out.value=""; return; }
  out.value="(buscando...)";
  try{
    const r = await fetchWithTimeout(`/biblia/bible/content/NVI.txt?passage=${encodeURIComponent(ref)}`, {}, 15000);
    const txt = await r.text();

    if(!r.ok || !txt) throw new Error("sem resultado");
    
    // A tradução é responsabilidade do Worker, apenas exibimos
    out.value = txt;
  }catch(e){
    out.value = "Erro ao consultar a Bíblia. (Verifique se /biblia/* está roteado para o Worker).";
  }
}

/* -------------- YOUTUBE -------------- */
function yt(id){ return `https://www.youtube.com/embed/${id}?autoplay=0&rel=0`; }

async function loadLiveOrLatest(){
  const frame = $("#liveFrame");
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
  const box = $(sel); box.innerHTML="";
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

/* -------------- binds -------------- */
function boot(){
  $("#yy").textContent = new Date().getFullYear();
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
