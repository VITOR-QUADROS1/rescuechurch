/* assets/app.js — v7-fix5 */
const $  = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));
const CFG = window.APP_CFG || { yt:{} };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function setLoading(el, on=true){ if(!el) return; el.classList.toggle("is-loading", !!on); }
function isEN(t){ const s=` ${String(t||"")} `.toLowerCase(); return [" the "," and "," lord "," god "," you "," your "," shall "," now "," for "].some(w=>s.includes(w)); }
async function fetchWithTimeout(url, opts={}, ms=12000, retries=1){
  let last; for(let i=0;i<=retries;i++){ const c=new AbortController(); const id=setTimeout(()=>c.abort(),ms);
    try{ const r=await fetch(url,{...opts,signal:c.signal}); clearTimeout(id); if(r.ok) return r; last=new Error(`HTTP ${r.status}`);}catch(e){ last=e; clearTimeout(id);} if(i<retries) await sleep(150); }
  throw last || new Error(`Timeout/erro: ${url}`);
}
async function translateToPT(text){
  if(!text) return text;
  try{
    let r=await fetchWithTimeout(`/api/translate?q=${encodeURIComponent(text)}&from=auto&to=pt-BR&t=${Date.now()}`,{},12000,0);
    let j=await r.json().catch(()=>({})); let out=j?.text||text;
    if(isEN(out)){ r=await fetchWithTimeout(`/api/translate?q=${encodeURIComponent(text)}&from=en&to=pt-BR&t=${Date.now()}`,{},12000,0); j=await r.json().catch(()=>({})); out=j?.text||out; }
    return out;
  }catch{ return text; }
}

/* Versículo do dia */
async function loadVDay(){
  const txt=$("#vday-text"), ref=$("#vday-ref"), err=$("#vday-err"), btn=$("#btn-vday");
  if(!txt||!ref) return;
  err&&(err.style.display="none"); err&&(err.textContent=""); txt.textContent="Carregando…"; ref.textContent=""; setLoading(btn,true);
  try{
    const r=await fetchWithTimeout(`/api/verse-of-day?lang=pt&t=${Date.now()}`,{},12000,1);
    const j=await r.json(); let out=String(j?.text||""); if(isEN(out)) out=await translateToPT(out);
    txt.textContent=out.trim()||"(sem texto)"; ref.textContent=`${j?.ref||""} — ${j?.version||""}`;
  }catch(e){ console.error("VDoD erro:",e); txt.textContent="(erro ao carregar)"; if(err){ err.textContent="Falha ao consultar /api/verse-of-day."; err.style.display="block"; } }
  finally{ setLoading(btn,false); }
}

/* Busca bíblica */
async function searchBible(){
  const qEl=$("#biblia-q"), out=$("#biblia-out"), err=$("#biblia-err"), btn=$("#btn-buscar");
  if(!qEl||!out) return; const q=(qEl.value||"").trim(); if(!q){ qEl.focus(); return; }
  err&&(err.style.display="none"); err&&(err.textContent=""); out.value="Buscando…"; setLoading(btn,true);
  try{
    const r=await fetchWithTimeout(`/biblia/bible/content/NVI.txt?passage=${encodeURIComponent(q)}&lang=pt&t=${Date.now()}`,{},14000,1);
    let txt=await r.text(); if(isEN(txt)) txt=await translateToPT(txt); out.value=txt.trim();
  }catch(e){ console.error("Busca erro:",e); out.value=""; if(err){ err.textContent="Não foi possível buscar. Ex.: João 3:16"; err.style.display="block"; } }
  finally{ setLoading(btn,false); }
}

/* YouTube */
function cardVideo(v){ if(!v?.id) return ""; const thumb=v.thumb||`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`; const title=(v.title||"").trim(); const date=v.published?new Date(v.published).toLocaleDateString("pt-BR"):""; return `<a class="yt-card" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${v.id}"><img loading="lazy" src="${thumb}" alt=""><div class="yt-info"><div class="yt-title">${title}</div><div class="yt-date">${date}</div></div></a>`; }
async function fillPlaylist(playlistId, sel){ const box=$(sel); if(!box||!playlistId) return; try{ const r=await fetchWithTimeout(`/api/youtube?playlist=${encodeURIComponent(playlistId)}&t=${Date.now()}`,{},12000,1); const j=await r.json().catch(()=>({items:[]})); box.innerHTML=(j.items||[]).map(cardVideo).join("")||"<div class='muted'>Sem itens.</div>"; }catch(e){ console.error("Playlist erro:",e); box.innerHTML="<div class='muted'>Erro ao carregar playlist.</div>"; } }
async function loadLiveOrLatest(){
  const liveBox=$("#live"), latestBox=$("#latest"); if(!liveBox&&!latestBox) return;
  const ytCfg=CFG?.yt||{}; const channelId=ytCfg.channelId||"";
  // aceitar shortsPlaylist / shortsPlaylistId e fullPlaylist / fullPlaylistId
  const shortsId=ytCfg.shortsPlaylistId||ytCfg.shortsPlaylist||""; const fullId=ytCfg.fullPlaylistId||ytCfg.fullPlaylist||"";
  if(channelId){
    try{
      const r=await fetchWithTimeout(`/api/youtube/live?channel=${encodeURIComponent(channelId)}&t=${Date.now()}`,{},10000,1);
      const j=await r.json().catch(()=>({})); if(j?.isLive && j?.id){ liveBox.innerHTML=`<a class="live-banner" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${j.id}"><span class="live-dot"></span> AO VIVO — Clique para assistir</a>`; liveBox.style.display=""; } else { liveBox.style.display="none"; }
    }catch{ liveBox&&(liveBox.style.display="none"); }
    try{
      const r=await fetchWithTimeout(`/api/youtube?channel=${encodeURIComponent(channelId)}&t=${Date.now()}`,{},12000,1);
      const j=await r.json().catch(()=>({items:[],error:""})); const html=(j.items||[]).slice(0,8).map(cardVideo).join("");
      if(latestBox) latestBox.innerHTML = html || `<div class='muted'>Sem vídeos/quotas. ${j.error?`(${j.error})`:''}</div>`;
    }catch(e){ console.error("YT erro:",e); if(latestBox) latestBox.innerHTML="<div class='muted'>Falha ao carregar vídeos.</div>"; }
  }
  if(shortsId) fillPlaylist(shortsId,"#shorts");
  if(fullId)   fillPlaylist(fullId,"#fulls");
}

/* Boot */
function boot(){
  $("#yy") && ($("#yy").textContent = new Date().getFullYear());
  $("#btn-vday")?.addEventListener("click", loadVDay);
  $("#btn-copy")?.addEventListener("click", async ()=>{ try{ const t=($("#vday-text")?.textContent||"").trim(); if(t) await navigator.clipboard.writeText(t);}catch{} });
  $("#btn-buscar")?.addEventListener("click", searchBible);
  $("#biblia-q")?.addEventListener("keydown", e=>{ if(e.key==="Enter") searchBible(); });
  loadLiveOrLatest(); loadVDay();
}
document.addEventListener("DOMContentLoaded", boot);
