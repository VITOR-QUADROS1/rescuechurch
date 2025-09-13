/* assets/app.js — Rescue Church (v7-fix4) */
const $  = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

const CFG = window.APP_CFG || { yt:{} };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function setLoading(el, on=true){ if(!el) return; el.classList.toggle("is-loading", !!on); }
function isEN(t){
  const s = ` ${String(t||"")} `.toLowerCase();
  const hits = [" the "," and "," lord "," god "," you "," your "," shall "," now "," for "].filter(w => s.includes(w));
  return hits.length >= 2;
}
async function fetchWithTimeout(url, opts={}, ms=12000, retries=1){
  let lastErr;
  for(let i=0;i<=retries;i++){
    const ctrl = new AbortController();
    const id   = setTimeout(()=>ctrl.abort(), ms);
    try{
      const r = await fetch(url, {...opts, signal: ctrl.signal});
      clearTimeout(id);
      if (r.ok) return r;
      lastErr = new Error(`HTTP ${r.status}`);
    }catch(e){ lastErr = e; clearTimeout(id); }
    if (i < retries) await sleep(150);
  }
  throw lastErr || new Error(`Timeout/erro: ${url}`);
}
async function translateToPT(text){
  if(!text) return text;
  try{
    // faz 1 tentativa com auto → pt
    let r = await fetchWithTimeout(`/api/translate?q=${encodeURIComponent(text)}&from=auto&to=pt-BR&t=${Date.now()}`, {}, 12000, 0);
    let j = await r.json().catch(()=>({}));
    let out = j?.text || text;
    if(isEN(out)){
      // reforço, se ainda parecer EN
      r = await fetchWithTimeout(`/api/translate?q=${encodeURIComponent(text)}&from=en&to=pt-BR&t=${Date.now()}`, {}, 12000, 0);
      j = await r.json().catch(()=>({}));
      out = j?.text || out;
    }
    return out;
  }catch{ return text; }
}

/* ---------- Versículo do dia ---------- */
async function loadVDay(){
  const txt  = $("#vday-text");
  const ref  = $("#vday-ref");
  const err  = $("#vday-err");
  const btn  = $("#btn-vday");
  if (!txt || !ref) return;

  err && (err.style.display = "none");
  err && (err.textContent = "");
  txt.textContent = "Carregando…";
  ref.textContent = "";
  setLoading(btn, true);

  try{
    const r = await fetchWithTimeout(`/api/verse-of-day?lang=pt&t=${Date.now()}`, {}, 12000, 1);
    const j = await r.json();

    let out = String(j?.text || "");
    if(isEN(out)) out = await translateToPT(out);

    txt.textContent = out.trim() || "(sem texto)";
    ref.textContent = `${j?.ref || ""} — ${j?.version || ""}`;
  }catch(e){
    console.error("VDoD erro:", e);
    txt.textContent = "(erro ao carregar)";
    if(err){ err.textContent = "Falha ao consultar /api/verse-of-day."; err.style.display = "block"; }
  }finally{
    setLoading(btn, false);
  }
}

/* ---------- Busca bíblica ---------- */
async function searchBible(){
  const qEl  = $("#biblia-q");
  const out  = $("#biblia-out");
  const err  = $("#biblia-err");
  const btn  = $("#btn-buscar");
  if(!qEl || !out) return;

  const q = (qEl.value || "").trim();
  if(!q){ qEl.focus(); return; }

  err && (err.style.display="none");
  err && (err.textContent="");

  out.value = "Buscando…";
  setLoading(btn, true);

  try{
    // Rota do Worker — versão no path é só para casar o padrão; o Worker ignora
    const r  = await fetchWithTimeout(`/biblia/bible/content/NVI.txt?passage=${encodeURIComponent(q)}&lang=pt&t=${Date.now()}`, {}, 14000, 1);
    let txt  = await r.text();

    // Reforço no cliente caso ainda venha EN
    if(isEN(txt)) txt = await translateToPT(txt);

    out.value = txt.trim();
  }catch(e){
    console.error("Busca erro:", e);
    out.value = "";
    if(err){
      err.textContent = "Não foi possível buscar. Verifique a referência (ex.: João 3:16).";
      err.style.display = "block";
    }
  }finally{
    setLoading(btn, false);
  }
}

/* ---------- YouTube ---------- */
function cardVideo(v){
  if(!v?.id) return "";
  const thumb = v.thumb || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
  const title = (v.title || "").trim();
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
  const liveBox   = $("#live");
  const latestBox = $("#latest");
  if(!liveBox && !latestBox) return;

  const channelId = (CFG?.yt?.channelId) || "";
  if(!channelId){
    latestBox && (latestBox.innerHTML = "<div class='muted'>Canal não configurado.</div>");
    return;
  }

  // LIVE
  try{
    const r = await fetchWithTimeout(`/api/youtube/live?channel=${encodeURIComponent(channelId)}&t=${Date.now()}`, {}, 10000, 1);
    const j = await r.json().catch(()=>({}));
    if(j?.isLive && j?.id){
      liveBox.innerHTML = `
        <a class="live-banner" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${j.id}">
          <span class="live-dot"></span> AO VIVO — Clique para assistir
        </a>`;
      liveBox.style.display = "";
    }else{
      liveBox.style.display = "none";
    }
  }catch(e){
    console.warn("LIVE erro:", e);
    liveBox && (liveBox.style.display="none");
  }

  // Últimos
  try{
    const r = await fetchWithTimeout(`/api/youtube?channel=${encodeURIComponent(channelId)}&t=${Date.now()}`, {}, 12000, 1);
    const j = await r.json().catch(()=>({ items:[], error:"" }));
    const html = (j.items||[]).slice(0,8).map(cardVideo).join("");
    if(latestBox) latestBox.innerHTML = html || `<div class='muted'>Sem vídeos recentes.${j.error?` (${j.error})`:''}</div>`;
  }catch(e){
    console.error("YT erro:", e);
    if(latestBox) latestBox.innerHTML = "<div class='muted'>Falha ao carregar vídeos.</div>";
  }
}

/* ---------- Boot ---------- */
function boot(){
  $("#yy") && ($("#yy").textContent = new Date().getFullYear());
  $("#btn-vday")?.addEventListener("click", loadVDay);
  $("#btn-copy")?.addEventListener("click", async ()=> {
    try{ const t = ($("#vday-text")?.textContent || "").trim(); if(t) await navigator.clipboard.writeText(t); }catch{}
  });
  $("#btn-buscar")?.addEventListener("click", searchBible);
  $("#biblia-q")?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") searchBible(); });

  loadLiveOrLatest();
  loadVDay();
}
document.addEventListener("DOMContentLoaded", boot);
