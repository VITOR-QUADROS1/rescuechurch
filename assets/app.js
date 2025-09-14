/* assets/app.js — RC v9 (PT-first + YouTube RSS fallback) */
const $  = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

const CFG = { proxy:{workerBase:"/api"}, biblia:{}, youtube:{} };
const api = (p)=> (CFG?.proxy?.workerBase||"/api").replace(/\/$/,"") + (p.startsWith("/")?p:`/${p}`);

async function loadCfg(){
  try{
    const r=await fetch("assets/config.json",{cache:"no-store"});
    if(r.ok) Object.assign(CFG, await r.json());
  }catch(e){ console.warn("config.json falhou:", e); }
}

/* ---------- Versículo do dia ---------- */
async function loadVDay(){
  const txt=$("#vday-text"), ref=$("#vday-ref"), btn=$("#btn-vday"), err=$("#vday-err");
  if(!txt||!ref) return;
  if(err){ err.style.display="none"; err.textContent=""; }
  txt.textContent="Carregando…"; ref.textContent="";
  btn && btn.classList.add("is-loading");

  try{
    const r = await fetch(api(`/verse-of-day?lang=pt&t=${Date.now()}`));
    const j = r.ok ? await r.json() : null;
    if(j?.text){
      txt.textContent = j.text.trim();
      ref.textContent = `${j.ref||""} — ${j.version||"NVI"}`;
    }else{
      txt.textContent="(erro ao carregar)";
      if(err){ err.textContent="Falha ao consultar /api/verse-of-day."; err.style.display="block"; }
    }
  }catch(_){
    txt.textContent="(erro ao carregar)";
  }finally{
    btn && btn.classList.remove("is-loading");
  }
}

/* ---------- Bíblia (busca) ---------- */
function mountVersions(){
  const sel=$("#biblia-ver"); if(!sel) return;
  const vers = CFG?.biblia?.versions || {};
  sel.innerHTML="";
  Object.entries(vers).forEach(([label,val])=>{
    const o=document.createElement("option"); o.textContent=label; o.value=val; sel.appendChild(o);
  });
  const def=CFG?.biblia?.defaultVersion;
  if(def){ const i=[...sel.options].findIndex(o=>o.value===def); if(i>=0) sel.selectedIndex=i; }
}
async function searchBible(){
  const qEl=$("#biblia-q"), out=$("#biblia-out"), btn=$("#btn-buscar");
  if(!qEl||!out) return;
  const q=(qEl.value||"").trim(); if(!q){ qEl.focus(); return; }
  out.value="Buscando…"; btn && btn.classList.add("is-loading");
  try{
    const url = api(`/biblia/bible/content/NVI.txt?passage=${encodeURIComponent(q)}&lang=pt&t=${Date.now()}`);
    const r   = await fetch(url);
    const txt = r.ok ? (await r.text()) : "";
    out.value = (txt||"").trim() || "Nenhum resultado encontrado.";
  }catch(e){
    out.value="Erro ao buscar. Ex.: João 3:16";
  }finally{ btn && btn.classList.remove("is-loading"); }
}

/* ---------- YouTube ---------- */
function cardVideo(v){
  const thumb=v.thumb || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
  const title=(v.title||"").trim();
  const date = v.published ? new Date(v.published).toLocaleDateString("pt-BR") : "";
  return `
    <a class="yt-card" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${v.id}">
      <img loading="lazy" src="${thumb}" alt="">
      <div class="yt-info">
        <div class="yt-title">${title}</div>
        <div class="yt-date">${date}</div>
      </div>
    </a>
  `;
}
async function fetchJSON(url){
  try{ const r=await fetch(url); return r.ok ? await r.json() : null; }catch(_){ return null; }
}
async function fillPlaylist(pid, sel){
  const box=$(sel); if(!box||!pid) return;
  const j = await fetchJSON(api(`/youtube?playlist=${encodeURIComponent(pid)}&t=${Date.now()}`));
  box.innerHTML = (j?.items||[]).map(cardVideo).join("") || "<div class='muted'>Sem itens.</div>";
}
async function loadLiveOrLatest(){
  const ch=CFG?.youtube?.channelId; if(!ch) return;
  const frame=$("#liveFrame"), list=$("#fulls");
  const live = await fetchJSON(api(`/youtube/live?channel=${encodeURIComponent(ch)}&t=${Date.now()}`));
  const latest = await fetchJSON(api(`/youtube?channel=${encodeURIComponent(ch)}&t=${Date.now()}`));
  const items=(latest?.items||[]).slice(0,12);
  if(list) list.innerHTML = items.map(cardVideo).join("") || "<div class='muted'>Sem vídeos recentes.</div>";
  const id = (live?.isLive && live?.id) ? live.id : (items[0]?.id || null);
  if(frame && id) frame.src = `https://www.youtube.com/embed/${id}`;
  if(CFG?.youtube?.shortsPlaylist) fillPlaylist(CFG.youtube.shortsPlaylist, "#shorts");
}

/* ---------- Boot ---------- */
function wire(){
  $("#btn-buscar")?.addEventListener("click", searchBible);
  $("#biblia-q")?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") searchBible(); });
  $("#btn-vday")?.addEventListener("click", loadVDay);
  $("#btn-copy")?.addEventListener("click", async ()=>{
    try{ const t=($("#vday-text")?.textContent||"").trim(); if(t) await navigator.clipboard.writeText(t); }catch(_){}
  });
  $("#yy") && ($("#yy").textContent = new Date().getFullYear());
}
(async function boot(){
  wire();
  await loadCfg();
  mountVersions();
  await Promise.all([loadVDay(), loadLiveOrLatest()]);
})();
