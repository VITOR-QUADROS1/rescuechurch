/* assets/app.js — RC v11 (PT-first + YT RSS + Carousel + Modal) */
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
async function fetchJSON(url){
  try{ const r=await fetch(url); return r.ok ? await r.json() : null; }catch(_){ return null; }
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
      if(looksEN(out)) out = await translatePT(out); // extra failsafe
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

/* ---------- YouTube (cards + live) ---------- */
const cardVideo = (v) => {
  const thumb=v.thumb || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
  const title=(v.title||"").trim();
  const date = v.published ? new Date(v.published).toLocaleDateString("pt-BR") : "";
  return `
    <a class="yt-card" href="https://www.youtube.com/watch?v=${v.id}" data-vid="${v.id}">
      <img loading="lazy" class="yt-thumb" src="${thumb}" alt="">
      <div class="yt-info">
        <div class="yt-title">${title}</div>
        <div class="yt-date">${date}</div>
      </div>
    </a>
  `;
};
async function fillPlaylist(pid, sel){
  const box=$(sel); if(!box||!pid) return;
  const j = await fetchJSON(api(`/youtube?playlist=${encodeURIComponent(pid)}&t=${Date.now()}`));
  box.innerHTML = (j?.items||[]).map(cardVideo).join("") || "<div class='muted' style='padding:8px'>Sem itens.</div>";
  setupCarousel(box.parentElement); // Passar o elemento .carousel
}
async function loadLiveOrLatest(){
  const ch=CFG?.youtube?.channelId; if(!ch) return;
  const frame=$("#liveFrame"), list=$("#fulls");
  const live   = await fetchJSON(api(`/youtube/live?channel=${encodeURIComponent(ch)}&t=${Date.now()}`));
  const latest = await fetchJSON(api(`/youtube?channel=${encodeURIComponent(ch)}&t=${Date.now()}`));
  const items  = (latest?.items||[]).slice(0,18);
  if(list){
    list.innerHTML = items.map(cardVideo).join("") || "<div class='muted' style='padding:8px'>Sem vídeos recentes.</div>";
    setupCarousel(list.parentElement); // Passar o elemento .carousel
  }
  const id = (live?.isLive && live?.id) ? live.id : (items[0]?.id || null);
  if(frame && id) frame.src = `https://www.youtube.com/embed/${id}?rel=0`;
  if(CFG?.youtube?.shortsPlaylist) await fillPlaylist(CFG.youtube.shortsPlaylist, "#shorts");
}

/* ---------- Carousel (paginado) ---------- */
function setupCarousel(carouselEl){
  const track = carouselEl.querySelector('.hscroll');
  if(!track) return;
  
  // cria setas apenas se houver overflow
  const hasOverflow = track.scrollWidth > track.clientWidth;
  if(!hasOverflow) return;

  // evita setas duplicadas
  if(carouselEl.querySelector(".carousel-nav")) return;

  const mkBtn = (dir) => {
    const b = document.createElement("button");
    b.className = `carousel-nav ${dir}`;
    b.type = "button";
    b.textContent = dir === "next" ? "›" : "‹";
    b.addEventListener("click", () => pageScroll(track, dir === "next" ? 1 : -1));
    return b;
  };
  carouselEl.appendChild(mkBtn("prev"));
  carouselEl.appendChild(mkBtn("next"));
}
function cardWidth(track){
  const card = track.querySelector(".yt-card");
  return card ? (card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap||"14")) : Math.max(280, track.clientWidth/3);
}
function pageScroll(track, dir){
  const cw = cardWidth(track);
  const visible = Math.max(1, Math.round(track.clientWidth / cw));
  track.scrollBy({ left: dir * visible * cw, behavior:"smooth" });
}

/* ---------- Modal de vídeo ---------- */
const modal = $("#yt-modal");
const iframe = $("#yt-iframe");
const closeModalBtn = $(".modal-close");

function openModal(videoId){
  if(!modal || !iframe) return;
  iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModal(){
  if(!modal || !iframe) return;
  iframe.src = "";
  modal.hidden = true;
  document.body.style.overflow = "";
}
modal?.addEventListener("click", (e)=>{ if(e.target === modal) closeModal(); });
closeModalBtn?.addEventListener("click", closeModal);
window.addEventListener("keydown", (e)=>{ if(e.key === "Escape") closeModal(); });

// Delegação: ouvir cliques nos cards para abrir modal
document.addEventListener("click", (e)=>{
  const a = e.target.closest(".yt-card");
  if(!a) return;
  const vid = a.getAttribute("data-vid");
  if(!vid) return;
  e.preventDefault();
  openModal(vid);
});

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
