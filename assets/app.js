/* assets/app.js — RC v11 (PT-first + YT + Carousel autônomo + Bible PT failsafe) */
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
  const txt=$("#vday-text"), ref=$("#vday-ref"), btn=$("#btn-vday"), err=$("#vday-err");
  if(!txt||!ref) return;
  if(err){ err.style.display="none"; err.textContent=""; }
  txt.textContent="Carregando…"; ref.textContent="";
  btn && btn.classList.add("is-loading");

  try{
    const r = await fetch(api(`/verse-of-day?lang=pt&t=${Date.now()}`));
    const j = r.ok ? await r.json() : null;
    if(j?.text){
      let out = j.text.trim();
      if(looksEN(out)) out = await translatePT(out);            // ✅ failsafe extra no front
      txt.textContent = out;
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
    const ver = $("#biblia-ver")?.value || "NVI";
    const url = api(`/biblia/bible/content/${encodeURIComponent(ver)}.txt?passage=${encodeURIComponent(q)}&lang=pt&t=${Date.now()}`);
    const r   = await fetch(url);
    let txt   = r.ok ? (await r.text()) : "";
    if(looksEN(txt)) txt = await translatePT(txt);              // ✅ garante PT-BR na saída
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
  // ✅ Usa teu CSS (.hitem / .hthumb / .hmeta)
  return `
    <a class="hitem" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${v.id}">
      <img class="hthumb" loading="lazy" src="${thumb}" alt="">
      <div class="hmeta">
        <div class="t">${title}</div>
        <div class="s">${date}</div>
      </div>
    </a>
  `;
}
async function fetchJSON(url){
  try{ const r=await fetch(url); return r.ok ? await r.json() : null; }catch(_){ return null; }
}
function renderHScroll(sel, items){
  const box=$(sel); if(!box) return;
  box.innerHTML = items.length ? items.map(cardVideo).join("") : "<div class='muted' style='padding:8px;'>Sem itens.</div>";
  setupCarousel(box);                                           // ✅ ativa carrossel na faixa
}
async function fillPlaylist(pid, sel){
  if(!pid) return renderHScroll(sel, []);
  const j = await fetchJSON(api(`/youtube?playlist=${encodeURIComponent(pid)}&t=${Date.now()}`));
  const items = (j?.items||[]).slice(0, 15);
  renderHScroll(sel, items);
}
async function loadLiveOrLatest(){
  const ch=CFG?.youtube?.channelId; if(!ch) return;
  const frame=$("#liveFrame");
  const live   = await fetchJSON(api(`/youtube/live?channel=${encodeURIComponent(ch)}&t=${Date.now()}`));
  const latest = await fetchJSON(api(`/youtube?channel=${encodeURIComponent(ch)}&t=${Date.now()}`));
  const items  = (latest?.items||[]).slice(0,12);

  renderHScroll("#fulls", items);

  const id = (live?.isLive && live?.id) ? live.id : (items[0]?.id || null);
  if(frame && id) frame.src = `https://www.youtube.com/embed/${id}`;

  if(CFG?.youtube?.shortsPlaylist) await fillPlaylist(CFG.youtube.shortsPlaylist, "#shorts");
  else renderHScroll("#shorts", []);
}

/* ---------- Carousel (auto-setas, 3+ por vez) ---------- */
function setupCarousel(scroller){
  if (!scroller || scroller._hasCarousel) return;
  scroller._hasCarousel = true;

  // Mostrar gradientes laterais quando houver rolagem
  const toggleScrollable = () => {
    const canScroll = scroller.scrollWidth > scroller.clientWidth + 4;
    scroller.classList.toggle('is-scrollable', canScroll);
  };
  new ResizeObserver(toggleScrollable).observe(scroller);
  toggleScrollable();

  const prev = document.createElement('button');
  prev.className = 'carousel-nav prev';
  prev.setAttribute('aria-label','Anterior');
  prev.textContent = '‹';

  const next = document.createElement('button');
  next.className = 'carousel-nav next';
  next.setAttribute('aria-label','Próximo');
  next.textContent = '›';

  scroller.append(prev, next);

  const getStep = () => {
    const card = scroller.querySelector('.hitem');
    const gap = parseFloat(getComputedStyle(scroller).gap || 12);
    return card ? Math.round(card.getBoundingClientRect().width + gap) : Math.round(scroller.clientWidth * 0.9);
  };

  prev.addEventListener('click', () => scroller.scrollBy({ left: -getStep(), behavior: 'smooth' }));
  next.addEventListener('click', () => scroller.scrollBy({ left:  getStep(), behavior: 'smooth' }));

  // Scroll vertical do mouse → horizontal (desktop)
  scroller.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scroller.scrollBy({ left: e.deltaY, behavior: 'smooth' });
      e.preventDefault();
    }
  }, { passive:false });

  // Teclado
  scroller.tabIndex = 0;
  scroller.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft')  prev.click();
    if (e.key === 'ArrowRight') next.click();
  });
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
