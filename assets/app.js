/* assets/app.js — Rescue Church (v7-route+rss) */
const $  = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

const API_BASE = "/api"; // seus routes de worker estão sob /api
const CFG = window.APP_CFG || { yt:{} };

const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
function setLoading(el,on=true){ if(!el) return; el.disabled=!!on; el.classList.toggle("is-loading",!!on); }
function looksEN(s){
  const t=(" "+String(s||"")+" ").toLowerCase();
  const hits=[" the "," and "," lord "," god "," you "," your "," shall "," for "," now "].filter(w=>t.includes(w));
  return hits.length>=2 || (/[a-z]/.test(t) && !/[áàãâéêíóôõúç]/i.test(t));
}
async function fetchWithTimeout(url,opts={},ms=12000){ const ctrl=new AbortController(); const id=setTimeout(()=>ctrl.abort(),ms); try{ const r=await fetch(url,{...opts,signal:ctrl.signal}); clearTimeout(id); return r; }catch(e){ clearTimeout(id); throw e; } }
async function translateToPT(text){
  if(!text) return text;
  try{
    const r = await fetchWithTimeout(`${API_BASE}/translate?q=${encodeURIComponent(text)}&from=auto&to=pt-BR&t=${Date.now()}`, {}, 12000);
    const j = await r.json().catch(()=>({}));
    return j?.text || text;
  }catch{ return text; }
}

/* ---------- Versículo do dia ---------- */
async function loadVDay(){
  const txt=$("#vday-text"), ref=$("#vday-ref"), err=$("#vday-err"), btn=$("#btn-vday");
  if(!txt||!ref) return;
  err && (err.style.display="none"); err && (err.textContent="");
  txt.textContent="Carregando…"; ref.textContent="";
  setLoading(btn,true);
  try{
    const r = await fetchWithTimeout(`${API_BASE}/verse-of-day?lang=pt&t=${Date.now()}`, {}, 12000);
    const j = await r.json();
    let out = String(j?.text||"");
    if(looksEN(out)) out = await translateToPT(out);
    txt.textContent = out.trim() || "(sem texto)";
    ref.textContent = `${j?.ref||""} — ${j?.version||"NVI"}`;
  }catch(e){
    txt.textContent="(erro ao carregar)";
    if(err){ err.textContent="Falha ao consultar /api/verse-of-day."; err.style.display="block"; }
  }finally{
    setLoading(btn,false);
  }
}

/* ---------- Busca bíblica ---------- */
async function searchBible(){
  const qEl=$("#biblia-q"), out=$("#biblia-out"), err=$("#biblia-err"), btn=$("#btn-buscar"), sel=$("#biblia-ver");
  if(!qEl||!out) return;
  const q=(qEl.value||"").trim();
  if(!q){ qEl.focus(); return; }
  err && (err.style.display="none"); err && (err.textContent="");
  const versionPath = `${(sel?.value||"NVI").split("(")[0].trim()}.txt`; // "NVI.txt", "NTLH.txt" etc.
  out.value="Buscando…"; setLoading(btn,true);
  try{
    const r  = await fetchWithTimeout(`${API_BASE}/biblia/bible/content/${encodeURIComponent(versionPath)}?passage=${encodeURIComponent(q)}&lang=pt&t=${Date.now()}`, {}, 14000);
    if(!r.ok){ out.value=""; throw new Error("HTTP "+r.status); }
    let txt = await r.text();
    if(looksEN(txt)) txt = await translateToPT(txt);
    out.value = txt.trim() || "Nenhum resultado encontrado.";
  }catch(e){
    out.value = "Nenhum resultado encontrado.";
    if(err){ err.textContent="Verifique a referência (ex.: João 3:16)."; err.style.display="block"; }
  }finally{ setLoading(btn,false); }
}

/* ---------- YouTube ---------- */
function cardVideo(v){
  if(!v?.id) return "";
  const thumb = v.thumb || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
  const title = (v.title||"").trim();
  const date  = v.published ? new Date(v.published).toLocaleDateString("pt-BR") : "";
  return `
    <a class="yt-card" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${v.id}">
      <img loading="lazy" src="${thumb}" alt="">
      <div class="yt-info">
        <div class="yt-title">${title}</div>
        <div class="yt-date">${date}</div>
      </div>
    </a>`;
}
async function loadLiveOrLatest(){
  const liveBox=$("#live"), latestBox=$("#latest");
  const channelId=(CFG?.yt?.channelId)||"";
  if(!channelId){ latestBox && (latestBox.innerHTML="<div class='muted'>Canal não configurado.</div>"); return; }

  // LIVE
  try{
    const r=await fetchWithTimeout(`${API_BASE}/youtube/live?channel=${encodeURIComponent(channelId)}&t=${Date.now()}`, {}, 10000);
    const j=await r.json().catch(()=>({}));
    if(j?.isLive && j?.id){
      liveBox.innerHTML=`
        <a class="live-banner" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${j.id}">
          <span class="live-dot"></span> AO VIVO — Clique para assistir
        </a>`;
      liveBox.style.display="";
    }else{
      liveBox && (liveBox.style.display="none");
    }
  }catch{ liveBox && (liveBox.style.display="none"); }

  // ÚLTIMOS VÍDEOS (API + RSS fallback já é feito no Worker)
  try{
    const r = await fetchWithTimeout(`${API_BASE}/youtube?channel=${encodeURIComponent(channelId)}&t=${Date.now()}`, {}, 12000);
    const j = await r.json().catch(()=>({items:[]}));
    const html = (j.items||[]).slice(0,8).map(cardVideo).join("");
    latestBox.innerHTML = html || "<div class='muted'>Sem vídeos recentes.</div>";
  }catch{
    latestBox && (latestBox.innerHTML="<div class='muted'>Falha ao carregar vídeos.</div>");
  }
}

/* ---------- Boot ---------- */
function boot(){
  $("#yy") && ($("#yy").textContent = new Date().getFullYear());
  $("#btn-vday")?.addEventListener("click", loadVDay);
  $("#btn-copy")?.addEventListener("click", async ()=>{
    try{ const t=($("#vday-text")?.textContent||"").trim(); if(t) await navigator.clipboard.writeText(t); }catch{}
  });
  $("#btn-buscar")?.addEventListener("click", searchBible);
  $("#biblia-q")?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") searchBible(); });

  loadLiveOrLatest();
  loadVDay();
}
document.addEventListener("DOMContentLoaded", boot);
