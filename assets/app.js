/* assets/app.js — RC (v6) segurando UI e logs úteis */
console.log("RC app v6");

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const CFG = window.APP_CFG || { yt:{} };

const sleep = ms => new Promise(r=>setTimeout(r,ms));
const isEN  = t => (" "+(t||"")+" ").toLowerCase().match(/\b(the|and|lord|god|you|your|shall)\b/g)?.length >= 2;
const show  = (el,on=true)=>{ if(el) el.style.display = on? "":"none"; };
const setLoading = (el,on=true)=>{ if(el) el.classList.toggle("is-loading",!!on); };

async function fetchWithTimeout(url, opts={}, ms=9000, retries=0){
  for(let i=0;i<=retries;i++){
    const ctrl=new AbortController(); const id=setTimeout(()=>ctrl.abort(),ms);
    try{ const r=await fetch(url,{...opts,signal:ctrl.signal}); clearTimeout(id); if(r.ok) return r; }catch{ clearTimeout(id); }
    if(i<retries) await sleep(200);
  }
  throw new Error("Timeout: "+url);
}

/* ---- helpers ---- */
const VDAY_PT = {
  "João 3:16":"Porque Deus tanto amou o mundo que deu o seu Filho unigênito, para que todo o que nele crer não pereça, mas tenha a vida eterna.",
  "Salmos 23:1":"O Senhor é o meu pastor; de nada terei falta.",
  "Provérbios 3:5-6":"Confie no Senhor de todo o seu coração e não se apoie em seu próprio entendimento; reconheça o Senhor em todos os seus caminhos, e ele endireitará as suas veredas.",
  "Filipenses 4:6":"Não andem ansiosos por coisa alguma, mas em tudo, pela oração e súplicas, e com ação de graças, apresentem seus pedidos a Deus.",
  "Romanos 8:28":"Sabemos que Deus age em todas as coisas para o bem daqueles que o amam, dos que foram chamados segundo o seu propósito.",
  "Isaías 41:10":"Por isso não tema, pois estou com você; não tenha medo, pois sou o seu Deus. Eu o fortalecerei e o ajudarei; eu o segurarei com a minha mão direita vitoriosa."
};

async function translateToPT(text){
  if(!text) return text;
  try{
    const u = `/api/translate?q=${encodeURIComponent(text)}&from=auto&to=pt-BR&t=${Date.now()}`;
    const r = await fetchWithTimeout(u, {}, 10000, 0);
    const j = await r.json().catch(()=>({}));
    return j?.text || text;
  }catch{ return text; }
}

/* ---------------- Versículo do Dia ---------------- */
async function loadVDay(){
  const txt=$("#vday-text"), ref=$("#vday-ref"), err=$("#vday-err"), btn=$("#btn-vday");
  if(!txt||!ref||!err) return;
  try{
    err.textContent=""; show(err,false);
    txt.textContent="Carregando…"; ref.textContent="";
    setLoading(btn,true);

    // 1) ping de saúde (log)
    try{ const p = await fetchWithTimeout(`/api/ping?t=${Date.now()}`, {}, 4000); console.log("PING:", await p.json()); }catch(e){ console.warn("PING falhou:", e); }

    // 2) VDoD (force fallback p/ reduzir variação)
    const r = await fetchWithTimeout(`/api/verse-of-day?force=fallback&t=${Date.now()}`, {}, 9000, 0);
    const j = await r.json().catch(()=>({}));
    let out = j?.text || "";

    // 3) se veio vazio, tenta mapa local (ref já corrigida no Worker)
    if(!out && j?.ref && VDAY_PT[j.ref]) out = VDAY_PT[j.ref];

    if(!out) throw new Error("Sem texto");
    if(isEN(out)) out = await translateToPT(out);

    txt.textContent = out.trim();
    ref.textContent = `${j?.ref||""} — ${j?.version||"NVI"}`;
  }catch(e){
    console.error("VDoD erro:", e);
    txt.textContent="(erro ao carregar)";
    err.textContent="Falha ao consultar /api/verse-of-day (verifique o Worker).";
    show(err,true);
  }finally{
    setLoading($("#btn-vday"), false);
  }
}

/* ---------------- Busca bíblica ---------------- */
async function searchBible(){
  const qEl=$("#biblia-q"), verEl=$("#biblia-ver");
  const out=$("#biblia-text")||$("#biblia-out");
  const err=$("#biblia-err"), btn=$("#btn-buscar");
  if(!qEl||!out||!err) return;

  const q=(qEl.value||"").trim(); if(!q){ qEl.focus(); return; }
  err.textContent=""; show(err,false);
  if(out.value!==undefined) out.value="Buscando…"; else out.textContent="Buscando…";
  setLoading(btn,true);

  try{
    const ver=(verEl?.value||"NVI").trim();
    let txt="";

    // PT-first (duas tentativas curtas)
    try{
      const r = await fetchWithTimeout(`/biblia/bible/content/${encodeURIComponent(ver)}.txt?passage=${encodeURIComponent(q)}&t=${Date.now()}`, {}, 8000, 0);
      txt = await r.text();
    }catch{}

    // fallback (se veio EN, traduz)
    if(!txt) throw new Error("Sem resultado");
    if(isEN(txt)) txt = await translateToPT(txt);

    if(out.value!==undefined) out.value=txt.trim(); else out.textContent=txt.trim();
  }catch(e){
    console.error("Busca erro:", e);
    if(out.value!==undefined) out.value=""; else out.textContent="";
    err.textContent="Não foi possível buscar. Verifique a referência (ex.: João 3:16).";
    show(err,true);
  }finally{
    setLoading(btn,false);
  }
}

/* ---------------- YouTube ---------------- */
function cardVideo(v){
  if(!v?.id) return "";
  const thumb = v.thumb || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
  const title = (v.title||"").trim();
  const date  = v.published ? new Date(v.published).toLocaleDateString("pt-BR") : "";
  return `<a class="yt-card" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${v.id}">
    <img loading="lazy" src="${thumb}" alt="">
    <div class="yt-info"><div class="yt-title">${title}</div><div class="yt-date">${date}</div></div>
  </a>`;
}
async function loadLiveOrLatest(){
  const live=$("#live"), latest=$("#latest"), liveFrame=$("#liveFrame");
  const channelId = CFG?.yt?.channelId || ""; if(!channelId) return;

  try{
    const r = await fetchWithTimeout(`/api/youtube/live?channel=${encodeURIComponent(channelId)}&t=${Date.now()}`, {}, 7000, 0);
    const j = await r.json().catch(()=>({}));
    if(j?.isLive && j?.id){
      if(liveFrame) liveFrame.src=`https://www.youtube.com/embed/${j.id}?autoplay=0`;
      if(live) { live.innerHTML=`<a class="live-banner" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${j.id}"><span class="live-dot"></span> AO VIVO — Clique para assistir</a>`; live.style.display=""; }
    }else{ live && (live.style.display="none"); }
  }catch{ live && (live.style.display="none"); }

  try{
    const r = await fetchWithTimeout(`/api/youtube?channel=${encodeURIComponent(channelId)}&t=${Date.now()}`, {}, 9000, 0);
    const j = await r.json().catch(()=>({items:[]}));
    const html = (j.items||[]).slice(0,8).map(cardVideo).join("");
    latest ? latest.innerHTML = (html || "<div class='muted'>Sem vídeos recentes.</div>") : null;
  }catch{ latest && (latest.innerHTML="<div class='muted'>Falha ao carregar vídeos.</div>"); }
}

/* ---------------- Boot ---------------- */
function boot(){
  $("#yy") && ($("#yy").textContent = new Date().getFullYear());
  $("#btn-vday")?.addEventListener("click", loadVDay);
  $("#btn-copy")?.addEventListener("click", async()=>{ try{ const t=($("#vday-text")?.textContent||"").trim(); if(t) await navigator.clipboard.writeText(t);}catch{} });
  $("#btn-buscar")?.addEventListener("click", searchBible);
  $("#biblia-q")?.addEventListener("keydown",(e)=>{ if(e.key==="Enter") searchBible(); });

  loadLiveOrLatest();
  loadVDay();
}
document.addEventListener("DOMContentLoaded", boot);
