const $ = (q, root=document) => root.querySelector(q);
const $$ = (q, root=document) => [...root.querySelectorAll(q)];

const cfg = await fetch("assets/config.json", { cache:"no-store" }).then(r=>r.json());
const API = cfg.proxy.workerBase.replace(/\/+$/,"");

$("#yy").textContent = new Date().getFullYear();

/* -------- HERO: nada a fazer, <img> já usa object-fit:contain -------- */

/* -------- Versões bíblicas -------- */
const verSel = $("#ver");
Object.entries(cfg.biblia.versions).forEach(([label,val])=>{
  const opt = document.createElement("option");
  opt.value = val; opt.textContent = label;
  if (val === cfg.biblia.defaultVersion) opt.selected = true;
  verSel.appendChild(opt);
});

/* -------- Versículo do dia -------- */
async function loadVerseOfDay() {
  const ver = verSel.value || cfg.biblia.defaultVersion;
  try {
    const r = await fetch(`${API}/api/verse-of-day?ver=${encodeURIComponent(ver)}`);
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    $("#vday").textContent = data.text || "—";
    $("#vdayRef").textContent = data.ref ? `(${data.ref} — ${data.version})` : "";
  } catch (e) {
    $("#vday").textContent = "Não foi possível carregar agora.";
    $("#vdayRef").textContent = "Tente novamente mais tarde.";
  }
}
$("#btnCopy").onclick = () => {
  const txt = `${$("#vday").textContent} ${$("#vdayRef").textContent}`;
  navigator.clipboard.writeText(txt);
};
await loadVerseOfDay();

/* -------- Busca bíblica -------- */
async function runSearch() {
  const q = $("#q").value.trim();
  const ver = $("#ver").value || cfg.biblia.defaultVersion;
  if (!q) { $("#result").textContent = ""; return; }
  $("#result").textContent = "Procurando...";
  try {
    // usa /biblia/bible/content/<ver>.txt?passage=...
    const u = `${API}/biblia/bible/content/${encodeURIComponent(ver)}.txt?passage=${encodeURIComponent(q)}&style=oneVerse`;
    const r = await fetch(u, { headers:{ "Accept":"text/plain" }});
    const text = (await r.text()).trim();
    if (!text) throw new Error("sem texto");
    $("#result").textContent = text;
  } catch (e) {
    $("#result").textContent = "Erro na consulta. Tente outra palavra ou referência (ex.: João 3:16).";
  }
}
$("#btnSearch").onclick = runSearch;
$("#q").addEventListener("keydown", e => (e.key==="Enter") && runSearch());

/* -------- Vídeos -------- */
function card(item){
  const el = document.createElement("a");
  el.className="hitem";
  el.href = `https://www.youtube.com/watch?v=${item.id}`;
  el.target = "_blank";
  el.rel = "noopener";
  el.innerHTML = `
    <img class="hthumb" src="${item.thumb}" alt="">
    <div class="hmeta">
      <div class="t">${item.title}</div>
      <div class="s">${new Date(item.published).toLocaleDateString("pt-BR")}</div>
    </div>`;
  return el;
}
async function loadPlaylist(playlistId, containerSel){
  if (!playlistId) return;
  const r = await fetch(`${API}/api/youtube?playlist=${encodeURIComponent(playlistId)}`);
  if (!r.ok) return;
  const data = await r.json();
  const box = $(containerSel);
  box.innerHTML = "";
  data.items.forEach(v => box.appendChild(card(v)));
  // drag-to-scroll suave
  dragScroll(box);
}
function dragScroll(el){
  let isDown=false, startX, scrollLeft;
  el.addEventListener("pointerdown", e=>{
    isDown=true; startX=e.pageX; scrollLeft = el.scrollLeft;
    el.setPointerCapture(e.pointerId);
    el.style.cursor="grabbing";
  });
  el.addEventListener("pointermove", e=>{
    if(!isDown) return;
    const dx = e.pageX - startX;
    el.scrollLeft = scrollLeft - dx;
  });
  const stop=()=>{ isDown=false; el.style.cursor="default"; };
  el.addEventListener("pointerup", stop);
  el.addEventListener("pointercancel", stop);
  el.addEventListener("pointerleave", stop);
}

/* Live: tenta live do canal; se não houver, usa 1º vídeo da playlist full */
async function setupLive(){
  const frame = $("#liveFrame");
  frame.src = `https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(cfg.youtube.channelId)}&autoplay=1&mute=1`;

  // checa live
  try {
    const r = await fetch(`${API}/api/youtube/live?channel=${encodeURIComponent(cfg.youtube.channelId)}`);
    const j = await r.json();
    if (j.isLive && j.id) {
      frame.src = `https://www.youtube-nocookie.com/embed/${j.id}?autoplay=1&mute=1`;
      return;
    }
  } catch (_) {}

  // fallback: pega 1º da playlist de mensagens completas (ou shorts, se preferir)
  try {
    const rr = await fetch(`${API}/api/youtube?playlist=${encodeURIComponent(cfg.youtube.fullPlaylist || cfg.youtube.shortsPlaylist)}`);
    const data = await rr.json();
    const id = data.items?.[0]?.id;
    if (id) frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1`;
  } catch (_){}
}

/* Carregar tudo */
await setupLive();
await loadPlaylist(cfg.youtube.shortsPlaylist, "#shorts");
await loadPlaylist(cfg.youtube.fullPlaylist, "#fulls");
