// helpers
const $ = q => document.querySelector(q);
const CFG = window.APP_CFG || { yt:{} };

async function fetchWithTimeout(url, opts={}, ms=12000){
  const ctrl=new AbortController(); const id=setTimeout(()=>ctrl.abort(),ms);
  try{ const r=await fetch(url,{...opts,signal:ctrl.signal}); clearTimeout(id); return r; }
  catch(e){ clearTimeout(id); throw e; }
}

function isEN(s){
  if(!s) return false;
  if(/[áéíóúãõâêôçÁÉÍÓÚÃÕÂÊÔÇ]/.test(s)) return false;
  const en=(s.match(/\b(the|and|will|because|but|world|son|god|him|for|so|loved)\b/gi)||[]).length;
  const pt=(s.match(/\b(de|do|da|que|porque|mas|Deus|mundo|filho|Senhor)\b/gi)||[]).length;
  return en>=2 && pt<2;
}

async function translateToPT(text){
  if(!text) return text;
  try{
    const r=await fetchWithTimeout(`/api/translate?q=${encodeURIComponent(text)}&from=en&to=pt-BR`,{},12000);
    const j=await r.json().catch(()=>({})); if(j.text && !/QUERY LENGTH LIMIT EXCEEDED/i.test(j.text)) return j.text;
    const parts=[]; const max=400;
    for(let i=0;i<text.length;i+=max){
      const r2=await fetchWithTimeout(`/api/translate?q=${encodeURIComponent(text.slice(i,i+max))}&from=en&to=pt-BR`,{},12000);
      const j2=await r2.json().catch(()=>({})); parts.push(j2.text||text.slice(i,i+max));
    }
    return parts.join("");
  }catch{ return text; }
}

/* ---- Versículo do dia ---- */
async function loadVDay(){
  const t=$("#vday-text"), ref=$("#vday-ref"), err=$("#vday-err");
  t.textContent="Carregando..."; ref.textContent=""; err.style.display="none";
  try{
    const r=await fetchWithTimeout("/api/verse-of-day?nocache=1",{},12000);
    const j=await r.json().catch(()=>({})); let txt=j.text||"";
    if(!txt && j.ref){
      const r2=await fetchWithTimeout(`/biblia/bible/content/NVI.txt?passage=${encodeURIComponent(j.ref)}&nocache=1`,{},12000);
      if(r2.ok) txt=await r2.text();
    }
    if(!txt) throw new Error("no text");
    if(isEN(txt)) txt=await translateToPT(txt);
    t.textContent=txt; ref.textContent=`(${j.ref||""} — ${j.version||"NVI"})`;
  }catch(e){
    t.textContent="(erro ao carregar)";
    err.textContent="Falha ao consultar /api/verse-of-day ou /biblia/…"; err.style.display="block";
  }
}

/* ---- Busca ---- */
async function searchBible(){
  const q=$("#biblia-q"), out=$("#biblia-out");
  const ref=(q.value||"").trim(); if(!ref){ out.value=""; return; }
  out.value="(buscando...)";
  try{
    const r=await fetchWithTimeout(`/biblia/bible/content/NVI.txt?passage=${encodeURIComponent(ref)}&nocache=1`,{},15000);
    let txt=await r.text(); if(!r.ok||!txt) throw new Error("sem resultado");
    if(isEN(txt)) txt=await translateToPT(txt); out.value=txt;
  }catch{ out.value="Erro ao consultar a Bíblia. (Cheque a rota /biblia/*)."; }
}

/* ---- YouTube ---- */
function yt(id){ return `https://www.youtube.com/embed/${id}?autoplay=0&rel=0`; }
async function loadLiveOrLatest(){
  const frame=$("#liveFrame");
  try{ const live=await fetchWithTimeout(`/api/youtube/live?channel=${CFG.yt.channelId}`,{},10000).then(r=>r.json());
       if(live?.isLive && live?.id){ frame.src=yt(live.id); return; } }catch{}
  try{ const list=await fetchWithTimeout(`/api/youtube?channel=${CFG.yt.channelId}`,{},10000).then(r=>r.json());
       const id=list?.items?.[0]?.id; if(id) frame.src=yt(id); }catch{}
}
async function fillPlaylist(pid,sel){
  const box=$(sel); box.innerHTML="";
  try{
    const data=await fetchWithTimeout(`/api/youtube?playlist=${pid}`,{},12000).then(r=>r.json());
    for(const it of (data.items||[])){
      const a=document.createElement("a");
      a.href=`https://www.youtube.com/watch?v=${it.id}`; a.target="_blank"; a.rel="noopener"; a.className="hitem";
      a.innerHTML=`<img class="hthumb" src="${it.thumb}" alt="">
        <div class="hmeta"><span class="t">${it.title||""}</span>
        <span class="s">${(it.published||"").replace("T"," ").replace("Z","")}</span></div>`;
      box.appendChild(a);
    }
  }catch{}
}

/* ---- binds ---- */
function boot(){
  $("#yy").textContent=new Date().getFullYear();
  $("#btn-buscar")?.addEventListener("click",searchBible);
  $("#biblia-q")?.addEventListener("keydown",e=>{ if(e.key==="Enter") searchBible(); });
  $("#btn-copy")?.addEventListener("click",async()=>{ try{
    await navigator.clipboard.writeText(($("#vday-text").textContent||"").trim()); }catch{} });

  loadVDay(); loadLiveOrLatest();
  if(CFG?.yt?.shortsPlaylistId) fillPlaylist(CFG.yt.shortsPlaylistId,"#shorts");
  if(CFG?.yt?.fullPlaylistId)   fillPlaylist(CFG.yt.fullPlaylistId,"#fulls");
}
document.addEventListener("DOMContentLoaded",boot);
