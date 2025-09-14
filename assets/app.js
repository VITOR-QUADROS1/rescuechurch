/* assets/app.js — RC v11 (carrossel paginado 3x + loop + QR no hero) */
const $  = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

const CFG = { proxy:{workerBase:"/api"}, biblia:{}, youtube:{} };
const api = (p)=> (CFG?.proxy?.workerBase||"/api").replace(/\/$/,"") + (p.startsWith("/")?p:`/${p}`);

/* ---------- Helpers ---------- */
async function loadCfg(){
  try{
    const r=await fetch("assets/config.json",{cache:"no-store"});
    if(r.ok) Object.assign(CFG, await r.json());
  }catch(e){ console.warn("config.json falhou:", e); }
}
function looksEN(s){
  const t=(" "+String(s||"")+" ").toLowerCase();
  const hits=[" the "," and "," lord "," god "," you "," your "," shall "," for "," now "," i will "].filter(w=>t.includes(w));
  return hits.length>=2 || (/[a-z]/.test(t) && !/[áàãâéêíóôõúç]/i.test(t));
}
async function translatePT(s){
  try{
    const u = api(`/translate?q=${encodeURIComponent(s)}&from=auto&to=pt-BR&t=${Date.now()}`);
    const r = await fetch(u);
    const j = r.ok ? await r.json() : null;
    return (j?.text||"").trim() || s;
  }catch(_){ return s; }
}

/* ---------- Versículo do dia ---------- */
async function loadVDay(){
  const txt=$("#vday-text"), ref=$("#vday-ref");
  if(!txt||!ref) return;
  txt.textContent="Carregando…"; ref.textContent="";
  try{
    const r = await fetch(api(`/verse-of-day?lang=pt&t=${Date.now()}`));
    const j = r.ok ? await r.json() : null;
    if(j?.text){
      let out = j.text.trim();
      if(looksEN(out)) out = await translatePT(out);
      txt.textContent = out;
      ref.textContent = `${j.ref||""} — ${j.version||"NVI"}`;
    }else{
      txt.textContent="(erro ao carregar)";
    }
  }catch(_){
    txt.textContent="(erro ao carregar)";
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
    let txt   = r.ok ? (await r.text()) : "";
    if(looksEN(txt)) txt = await translatePT(txt);
    out.value = (txt||"").trim() || "Nenhum resultado encontrado.";
  }catch(_){
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
  markScrollable(box);
}
async function loadLiveOrLatest(){
  const ch=CFG?.youtube?.channelId; if(!ch) return;
  const frame=$("#liveFrame"), list=$("#fulls");
  const live   = await fetchJSON(api(`/youtube/live?channel=${encodeURIComponent(ch)}&t=${Date.now()}`));
  const latest = await fetchJSON(api(`/youtube?channel=${encodeURIComponent(ch)}&t=${Date.now()}`));
  const items  = (latest?.items||[]).slice(0,18);
  if(list) list.innerHTML = items.map(cardVideo).join("") || "<div class='muted'>Sem vídeos recentes.</div>";
  markScrollable(list);
  const id = (live?.isLive && live?.id) ? live.id : (items[0]?.id || null);
  if(frame && id) frame.src = `https://www.youtube.com/embed/${id}`;
  if(CFG?.youtube?.shortsPlaylist) { await fillPlaylist(CFG.youtube.shortsPlaylist, "#shorts"); }
  initCarouselPaged("#shorts");
  initCarouselPaged("#fulls");
}

/* ---------- Carrossel paginado (3 por vez) + loop ---------- */
function markScrollable(track){
  if(!track) return;
  const upd=()=>track.classList.toggle("is-scrollable", track.scrollWidth > track.clientWidth + 10);
  upd();
  new ResizeObserver(upd).observe(track);
}

function cardsPerView(track){
  const card = track.querySelector(".yt-card");
  if(!card) return 3;
  const cardW = card.getBoundingClientRect().width + 12;
  return Math.max(1, Math.round(track.clientWidth / cardW));
}

function pageWidth(track){
  const card = track.querySelector(".yt-card");
  if(!card) return track.clientWidth;
  const cardW = card.getBoundingClientRect().width + 12;
  const n = cardsPerView(track);
  return n * cardW;
}

function initCarouselPaged(selector){
  const track = $(selector);
  if(!track) return;

  // botão explícito no HTML
  const wrap = track.closest(".carousel-wrap");
  const prev = wrap?.querySelector(`.carousel-nav.prev[data-target="${selector}"]`);
  const next = wrap?.querySelector(`.carousel-nav.next[data-target="${selector}"]`);

  if(prev && next){
    const go = (dir)=>{
      const max = track.scrollWidth - track.clientWidth;
      let target = track.scrollLeft + (dir>0 ? pageWidth(track) : -pageWidth(track));
      // loop suave
      if(target < 0) target = max;
      if(target > max) target = 0;
      track.scrollTo({ left: target, behavior:"smooth" });
    };
    prev.onclick = ()=>go(-1);
    next.onclick = ()=>go(1);
  }

  // também habilita rolagem por arraste em dispositivos apontadores
  let isDown=false, startX=0, startLeft=0;
  track.addEventListener("pointerdown",(e)=>{ isDown=true; startX=e.clientX; startLeft=track.scrollLeft; track.setPointerCapture(e.pointerId); });
  track.addEventListener("pointermove",(e)=>{ if(isDown){ track.scrollLeft = startLeft - (e.clientX - startX); }});
  track.addEventListener("pointerup",()=>{ isDown=false; });
}

/* ---------- Boot ---------- */
function wire(){
  $("#btn-buscar")?.addEventListener("click", searchBible);
  $("#biblia-q")?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") searchBible(); });
  $("#btn-copy")?.addEventListener("click", async ()=>{
    try{ const t=($("#vday-text")?.textContent||"").trim(); if(t) await navigator.clipboard.writeText(t); }catch(_){}
  });
  const y=$("#yy"); if(y) y.textContent=new Date().getFullYear();
}
(async function boot(){
  wire();
  await loadCfg();
  mountVersions();
  await Promise.all([loadVDay(), loadLiveOrLatest()]);
})();
