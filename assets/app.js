/* assets/app.js — Rescue Church
 * - Versículo do dia (sempre PT)
 * - Busca bíblica PT-first (fallback EN->PT)
 * - YouTube (live/últimos/playlist)
 * Requer o Worker com as rotas: /api/verse-of-day, /biblia/bible/content/NVI.txt,
 * /api/translate, /api/youtube e /api/youtube/live
 */

const $  = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

const CFG = window.APP_CFG || { yt:{} };

/* -------------------- Utils -------------------- */
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function isEN(t){
  // heurística simples: presença de palavras comuns em inglês
  const s = (t||"").toLowerCase();
  const hits = [" the ", " and ", " lord ", " god ", " you ", " your ", " shall "].filter(w => s.includes(w));
  return hits.length >= 2;
}
function setLoading(el, on=true){ if(!el) return; el.classList.toggle("is-loading", !!on); }

// fetch com timeout + 1 retry
async function fetchWithTimeout(url, opts={}, ms=10000, retries=1){
  for(let i=0;i<=retries;i++){
    const ctrl = new AbortController();
    const id   = setTimeout(()=>ctrl.abort(), ms);
    try{
      const r = await fetch(url, {...opts, signal: ctrl.signal});
      clearTimeout(id);
      if (r.ok) return r;
    }catch(_){
      clearTimeout(id);
    }
    if (i < retries) await sleep(150);
  }
  throw new Error(`Timeout/erro: ${url}`);
}

async function translateToPT(text){
  if(!text) return text;
  try{
    const r = await fetchWithTimeout(`/api/translate?q=${encodeURIComponent(text)}&from=en&to=pt-BR`, {}, 10000, 1);
    const j = await r.json().catch(()=>({}));
    return j?.text || text;
  }catch{ return text; }
}

/* -------------------- Versículo do Dia -------------------- */
async function loadVDay(){
  const txt  = $("#vday-text");
  const ref  = $("#vday-ref");
  const err  = $("#vday-err");
  const btn  = $("#btn-vday");

  if (!txt || !ref) return;

  err.textContent = "";
  txt.textContent = "Carregando…";
  ref.textContent = "";

  setLoading(btn, true);
  try{
    // 1) chama diretamente o endpoint do Worker (já tem PT-first + fallback)
    let j = null;
    try{
      const r = await fetchWithTimeout("/api/verse-of-day", {}, 9000, 1);
      j = await r.json();
    }catch(_){ j = null; }

    let out = j?.text || "";

    // 2) se ainda vazio, tenta forçar rota PT com a mesma referência
    if(!out && j?.ref){
      try{
        const r2 = await fetchWithTimeout(`/biblia/bible/content/NVI.txt?passage=${encodeURIComponent(j.ref)}`, {}, 9000, 0);
        if (r2.ok) out = await r2.text();
      }catch(_){}
    }

    if(!out) throw new Error("Sem texto retornado");

    // 3) evita “piscar” em EN — traduz antes de renderizar
    if(isEN(out)) out = await translateToPT(out);

    txt.textContent = out.trim();
    ref.textContent = `${j?.ref || ""} — ${j?.version || "NVI"}`;
  }catch(e){
    txt.textContent = "(erro ao carregar)";
    err.textContent = "Falha ao consultar o versículo do dia.";
  }finally{
    setLoading(btn, false);
  }
}

/* -------------------- Busca bíblica -------------------- */
async function searchBible(){
  const qEl  = $("#biblia-q");
  const out  = $("#biblia-text");
  const err  = $("#biblia-err");
  const btn  = $("#btn-buscar");

  if(!qEl || !out) return;
  const q = (qEl.value || "").trim();
  if(!q){ qEl.focus(); return; }

  err.textContent = "";
  out.textContent = "Buscando…";
  setLoading(btn, true);

  try{
    // 1) PT-first
    let txt = "";
    try{
      const r = await fetchWithTimeout(`/biblia/bible/content/NVI.txt?passage=${encodeURIComponent(q)}`, {}, 10000, 1);
      if (r.ok) txt = await r.text();
    }catch(_){}

    // 2) fallback: pede para o Worker resolver (Logos + tradução)
    if(!txt){
      try{
        const r2 = await fetchWithTimeout(`/api/translate?q=${encodeURIComponent(q)}&from=auto&to=auto`, {}, 6000, 0);
        // nada a ver com a busca — apenas aquece o cache de tradução (opcional)
      }catch(_){}
      // usa o mesmo handler do VDoD por trás — o próprio Worker vai traduzir
      const r3 = await fetchWithTimeout(`/biblia/bible/content/NVI.txt?passage=${encodeURIComponent(q)}`, {}, 10000, 1);
      if (r3.ok) txt = await r3.text();
    }

    if(!txt) throw new Error("Sem resultado");

    if(isEN(txt)) txt = await translateToPT(txt);

    out.textContent = txt.trim();
  }catch(e){
    out.textContent = "";
    err.textContent = "Não foi possível buscar. Verifique a referência (ex.: João 3:16).";
  }finally{
    setLoading(btn, false);
  }
}

/* -------------------- YouTube -------------------- */
function cardVideo(v){
  if(!v?.id) return "";
  const thumb = v.thumb || "https://i.ytimg.com/vi/"+v.id+"/mqdefault.jpg";
  const title = (v.title || "").trim();
  const date  = v.published ? new Date(v.published).toLocaleDateString("pt-BR") : "";
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

async function loadLiveOrLatest(){
  const liveBox   = $("#live");
  const latestBox = $("#latest");
  if(!liveBox && !latestBox) return;

  const channelId = CFG?.yt?.channelId || "";
  if(!channelId) return;

  // tenta live
  try{
    const r = await fetchWithTimeout(`/api/youtube/live?channel=${encodeURIComponent(channelId)}`, {}, 7000, 1);
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
  }catch(_){
    liveBox && (liveBox.style.display="none");
  }

  // últimos vídeos
  try{
    const r = await fetchWithTimeout(`/api/youtube?channel=${encodeURIComponent(channelId)}`, {}, 9000, 1);
    const j = await r.json().catch(()=>({ items:[] }));
    const html = (j.items||[]).slice(0,8).map(cardVideo).join("");
    if(latestBox) latestBox.innerHTML = html || "<div class='muted'>Sem vídeos recentes.</div>";
  }catch(_){
    if(latestBox) latestBox.innerHTML = "<div class='muted'>Falha ao carregar vídeos.</div>";
  }
}

async function fillPlaylist(playlistId, containerSel){
  const box = $(containerSel);
  if(!box || !playlistId) return;
  try{
    const r = await fetchWithTimeout(`/api/youtube?playlist=${encodeURIComponent(playlistId)}`, {}, 9000, 1);
    const j = await r.json().catch(()=>({ items:[] }));
    const html = (j.items||[]).map(cardVideo).join("");
    box.innerHTML = html || "<div class='muted'>Sem itens.</div>";
  }catch(_){
    box.innerHTML = "<div class='muted'>Erro ao carregar playlist.</div>";
  }
}

/* -------------------- Boot -------------------- */
function boot(){
  // ano no rodapé, se existir
  $("#yy") && ($("#yy").textContent = new Date().getFullYear());

  // Versículo do dia
  $("#btn-vday")?.addEventListener("click", loadVDay);
  $("#btn-copy")?.addEventListener("click", async ()=>{
    try{
      const t = ($("#vday-text")?.textContent || "").trim();
      if(t) await navigator.clipboard.writeText(t);
    }catch{}
  });

  // Busca bíblica
  $("#btn-buscar")?.addEventListener("click", searchBible);
  $("#biblia-q")?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") searchBible(); });

  // YouTube
  loadLiveOrLatest();
  if(CFG?.yt?.shortsPlaylistId) fillPlaylist(CFG.yt.shortsPlaylistId, "#shorts");
  if(CFG?.yt?.fullPlaylistId)   fillPlaylist(CFG.yt.fullPlaylistId,   "#fulls");

  // Carrega VDoD na entrada
  loadVDay();
}
document.addEventListener("DOMContentLoaded", boot);
