/* RC front — PT-first + YT RSS + Carousel + Modal */
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
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

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
      if(looksEN(out)) out = await translatePT(out);  // failsafe extra
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
    <a class="yt-card" data-vid="${v.id}" href="https://www.youtube.com/watch?v=${v.id}">
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
  setupCarousel(box);
}
async function loadLiveOrLatest(){
  const ch=CFG?.youtube?.channelId; if(!ch) return;
  const frame=$("#liveFrame"), list=$("#fulls");
  const live   = await fetchJSON(api(`/youtube/live?channel=${encodeURIComponent(ch)}&t=${Date.now()}`));
  const latest = await fetchJSON(api(`/youtube?channel=${encodeURIComponent(ch)}&t=${Date.now()}`));
  const items  = (latest?.items||[]).slice(0,18);
  if(list) { list.innerHTML = items.map(cardVideo).join("") || "<div class='muted'>Sem vídeos recentes.</div>"; setupCarousel(list); }

  const id = (live?.isLive && live?.id) ? live.id : (items[0]?.id || null);
  if(frame && id) frame.src = `https://www.youtube.com/embed/${id}`;

  if(CFG?.youtube?.shortsPlaylist) await fillPlaylist(CFG.youtube.shortsPlaylist, "#shorts");
}

/* ---------- Carousel (3 por vez) ---------- */
function setupCarousel(track){
  // evita duplicar
  track.querySelectorAll(".carousel-nav").forEach(n=>n.remove());

  const prev = document.createElement("button");
  prev.className = "carousel-nav prev"; prev.type="button"; prev.innerHTML = "‹";
  const next = document.createElement("button");
  next.className = "carousel-nav next"; next.type="button"; next.innerHTML = "›";
  track.appendChild(prev); track.appendChild(next);

  const getCardWidth = () => {
    const c = track.querySelector(".yt-card");
    if (!c) return 340 + 14; // largura + gap
    const r = c.getBoundingClientRect();
    return r.width + 14; // gap de 14px no CSS
  };

  const page = () => Math.max(1, Math.round(track.clientWidth / getCardWidth()));
  const maxScroll = () => (track.scrollWidth - track.clientWidth);

  prev.addEventListener("click", ()=>{
    track.scrollTo({ left: clamp(track.scrollLeft - page()*getCardWidth(), 0, maxScroll()), behavior:"smooth" });
  });
  next.addEventListener("click", ()=>{
    track.scrollTo({ left: clamp(track.scrollLeft + page()*getCardWidth(), 0, maxScroll()), behavior:"smooth" });
  });

  const syncBtns = ()=>{
    const m = maxScroll();
    prev.toggleAttribute("disabled", track.scrollLeft <= 0);
    next.toggleAttribute("disabled", track.scrollLeft >= m - 1);
  };
  track.addEventListener("scroll", syncBtns, { passive:true });
  window.addEventListener("resize", syncBtns);
  setTimeout(syncBtns, 50);

  // abrir modal ao clicar
  track.querySelectorAll(".yt-card").forEach(a=>{
    a.addEventListener("click",(ev)=>{
      ev.preventDefault();
      openModal(a.getAttribute("data-vid"));
    });
  });
}

/* ---------- Modal YouTube ---------- */
const modal = $("#ytModal");
const modalFrame = $("#ytModalFrame");
function openModal(id){
  if(!modal || !modalFrame) return;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
  modalFrame.src = `https://www.youtube.com/embed/${id}?autoplay=1`;
}
function closeModal(){
  if(!modal || !modalFrame) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden","true");
  modalFrame.src = ""; // para parar o vídeo
}
$(".modal-close")?.addEventListener("click", closeModal);
modal?.addEventListener("click", (e)=>{ if(e.target === modal) closeModal(); });
document.addEventListener("keydown", (e)=>{ if(e.key === "Escape") closeModal(); });

/* ---------- Boot ---------- */
function wire(){
  $("#btn-buscar")?.addEventListener("click", searchBible);
  $("#biblia-q")?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") searchBible(); });
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
