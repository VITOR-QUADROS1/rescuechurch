// app.js (ESM com top-level await)

const $ = (q, r=document) => r.querySelector(q);

const cfg = await fetch("assets/config.json", { cache:"no-store" }).then(r=>r.json());
const API = cfg.proxy.workerBase.replace(/\/+$/,"");

$("#yy").textContent = new Date().getFullYear();

/* Versões da Bíblia */
const verSel = $("#ver");
Object.entries(cfg.biblia.versions).forEach(([label, val])=>{
  const o = document.createElement("option");
  o.value = val; o.textContent = label;
  if (val === cfg.biblia.defaultVersion) o.selected = true;
  verSel.appendChild(o);
});

/* Versículo do dia */
async function loadVerseOfDay(){
  const ver = verSel.value || cfg.biblia.defaultVersion;
  try{
    const r = await fetch(`${API}/api/verse-of-day?ver=${encodeURIComponent(ver)}`);
    if(!r.ok) throw new Error(await r.text());
    const j = await r.json();
    $("#vday").textContent = j.text || "—";
    $("#vdayRef").textContent = j.ref ? `(${j.ref} — ${j.version})` : "";
  }catch(e){
    console.warn("V-OF-DAY", e);
    $("#vday").textContent = "Não foi possível carregar agora.";
    $("#vdayRef").textContent = "Tente novamente mais tarde.";
  }
}
$("#btnCopy").onclick = () => {
  const t = `${$("#vday").textContent} ${$("#vdayRef").textContent}`;
  navigator.clipboard.writeText(t);
};
await loadVerseOfDay();

/* Busca na Bíblia */
async function runSearch(){
  const q = $("#q").value.trim();
  let ver = $("#ver").value || cfg.biblia.defaultVersion;
  if(!q){ $("#result").textContent=""; return; }
  $("#result").textContent = "Procurando...";
  try{
    let url = `${API}/biblia/bible/content/${encodeURIComponent(ver)}.txt?passage=${encodeURIComponent(q)}&style=oneVerse`;
    let r = await fetch(url, { headers:{Accept:"text/plain"} });
    let text = (await r.text()).trim();

    // Fallback de versão se vier vazio/erro
    if(!r.ok || !text){
      ver = "POR-NTLH";
      url = `${API}/biblia/bible/content/${ver}.txt?passage=${encodeURIComponent(q)}&style=oneVerse`;
      r = await fetch(url, { headers:{Accept:"text/plain"} });
      text = (await r.text()).trim();
    }

    if(!text) throw new Error("sem texto");
    $("#result").textContent = text;
  }catch(e){
    console.warn("SEARCH", e);
    $("#result").textContent = "Erro na consulta. Tente outra palavra ou referência (ex.: João 3:16).";
  }
}
$("#btnSearch").onclick = runSearch;
$("#q").addEventListener("keydown", e=>e.key==="Enter" && runSearch());

/* ======= VÍDEOS ======= */

function card(v){
  const a=document.createElement("a");
  a.className="hitem"; a.href=`https://www.youtube.com/watch?v=${v.id}`; a.target="_blank"; a.rel="noopener";
  a.innerHTML = `
    <img class="hthumb" src="${v.thumb}" alt="">
    <div class="hmeta">
      <div class="t">${v.title}</div>
      <div class="s">${new Date(v.published).toLocaleDateString("pt-BR")}</div>
    </div>
  `;
  return a;
}
function dragScroll(el){
  let down=false,start,orig;
  el.addEventListener("pointerdown",e=>{down=true;start=e.pageX;orig=el.scrollLeft;el.setPointerCapture(e.pointerId);el.style.cursor="grabbing";});
  el.addEventListener("pointermove",e=>{if(!down)return;el.scrollLeft = orig-(e.pageX-start);});
  const up=()=>{down=false;el.style.cursor="grab";};
  el.addEventListener("pointerup",up);el.addEventListener("pointerleave",up);el.addEventListener("pointercancel",up);
  el.style.cursor="grab";
}

async function loadList(by, val, targetSel){
  try{
    const url = by==="playlist"
      ? `${API}/api/youtube?playlist=${encodeURIComponent(val)}`
      : `${API}/api/youtube?channel=${encodeURIComponent(val)}`;
    const r = await fetch(url);
    if(!r.ok) return;
    const j = await r.json();
    const box = $(targetSel); box.innerHTML="";
    j.items.forEach(x=>box.appendChild(card(x)));
    dragScroll(box);
  }catch(e){ console.warn("loadList", e); }
}

async function setupLive(){
  const ch = cfg.youtube.channelId;
  const frame = $("#liveFrame");

  // tenta /live; se não, usa último vídeo
  try{
    const r = await fetch(`${API}/api/youtube/live?channel=${encodeURIComponent(ch)}`);
    const j = await r.json();
    if(j.isLive && j.id){
      frame.src = `https://www.youtube-nocookie.com/embed/${j.id}?autoplay=1&mute=1`;
      return;
    }
  }catch(e){ /* continua */ }

  // Fallback: últimos uploads do canal
  try{
    const up = await fetch(`${API}/api/youtube?channel=${encodeURIComponent(ch)}`);
    const j = await up.json();
    const id = j.items?.[0]?.id;
    if(id) frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1`;
    else frame.src = `https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(ch)}&autoplay=1&mute=1`;
  }catch(e){
    frame.src = `https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(ch)}&autoplay=1&mute=1`;
  }
}
await setupLive();

// Carrosseis — usa playlists se você tiver, senão cai para uploads do canal
const CH = cfg.youtube.channelId;
if (cfg.youtube.shortsPlaylist) await loadList("playlist", cfg.youtube.shortsPlaylist, "#shorts");
else await loadList("channel", CH, "#shorts");

if (cfg.youtube.fullPlaylist) await loadList("playlist", cfg.youtube.fullPlaylist, "#fulls");
else await loadList("channel", CH, "#fulls");
