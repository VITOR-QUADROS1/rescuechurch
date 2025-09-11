/* ===================== helpers & storage ===================== */
const $ = (q) => document.querySelector(q);
const strip = (s)=> s?.normalize?.("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim() || "";
function copyToClipboard(t){ navigator.clipboard?.writeText(t).catch(()=>{}); }
function esc(s){ return s.replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }

async function fetchText(url, timeout=9000){
  const ctrl = new AbortController(); const id = setTimeout(()=>ctrl.abort(), timeout);
  try { const r = await fetch(url, {signal:ctrl.signal}); return await r.text(); }
  finally { clearTimeout(id); }
}
async function fetchJson(url, opts={}, timeout=9000){
  const ctrl = new AbortController(); const id = setTimeout(()=>ctrl.abort(), timeout);
  try { const r = await fetch(url, {...opts, signal:ctrl.signal}); return r; }
  finally { clearTimeout(id); }
}

/* ===================== config.json ===================== */
let CFG = { siteTitle:"Rescue Church", yt:{}, cms:{} };
async function loadConfig(){
  try{
    const r = await fetchJson("assets/config.json");
    if (r.ok) CFG = await r.json();
  }catch{}
}

/* ===================== Google Sheets ===================== */
async function readSheet(sheetId, tab){
  // endpoint "gviz" retorna JS encapsulado; extraímos só o JSON
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}`;
  const raw = await fetchText(url);
  const json = JSON.parse(raw.substring(raw.indexOf('{'), raw.lastIndexOf('}')+1));
  const cols = json.table.cols.map(c => (c.label || c.id || "").toString().trim().toLowerCase());
  const rows = json.table.rows.map(r=>{
    const o={}; r.c?.forEach((c,i)=>{ o[cols[i]||`c${i}`] = c ? (c.v ?? "") : "" }); return o;
  });
  return rows;
}

/* ===================== Bíblia – ACF JSON (fallback) ===================== */
const ACF_JSON_URL = "https://cdn.jsdelivr.net/gh/thiagobodruk/bible/json/pt-br/acf.json";
async function loadAcfJson(){
  const key="rc:acf_json";
  const c = localStorage.getItem(key);
  if (c) try{ return JSON.parse(c); }catch{}
  const r = await fetchJson(ACF_JSON_URL);
  const j = await r.json();
  localStorage.setItem(key, JSON.stringify(j));
  return j;
}
async function buildBookIndex(){
  const idx = {};
  const acf = await loadAcfJson();
  const norm = (s)=> strip(s).replace(/\s+/g,"");
  acf.forEach(b=>{ idx[norm(b.name)] = b.name; });
  Object.assign(idx, {
    mateus:"Mateus", matheus:"Mateus", mt:"Mateus",
    joao:"João", jo:"João", evangelhodejoao:"João",
    salmos:"Salmos", salmo:"Salmos", ps:"Salmos",
    genesis:"Gênesis", gen:"Gênesis", exodo:"Êxodo", ex:"Êxodo",
    proverbios:"Provérbios", prov:"Provérbios",
    cantares:"Cantares de Salomão", canticos:"Cantares de Salomão", canticosdoscanticos:"Cantares de Salomão",
    eclesiastes:"Eclesiastes",
    "1reis":"1 Reis","2reis":"2 Reis",
    "1samuel":"1 Samuel","2samuel":"2 Samuel", samuel:"1 Samuel",
    "1corintios":"1 Coríntios","2corintios":"2 Coríntios", corintios:"1 Coríntios",
    "1joao":"1 João","2joao":"2 João","3joao":"3 João",
    "1timoteo":"1 Timóteo","2timoteo":"2 Timóteo", timoteo:"1 Timóteo"
  });
  return idx;
}
function parseRefPT(raw, idx){
  let s = strip(raw).replace(/[,;]+/g," ");
  s = s.replace(/\biii\b/g,"3").replace(/\bii\b/g,"2").replace(/\bi\b/g,"1");
  s = s.replace(/^([1-3])([a-z])/,"$1 $2");
  const m = /^(.+?)\s+(\d+)(?:[:.](\d+))?$/.exec(s);
  if (!m) return null;
  const bookKey = m[1].replace(/\s+/g,"");
  const bookName = idx[bookKey];
  if (!bookName) return null;
  return { bookName, chapter: parseInt(m[2],10), verse: m[3] ? parseInt(m[3],10) : null };
}

/* ===================== Versículo do Dia ===================== */
// tenta Planilha -> A Bíblia Digital -> ACF JSON
async function loadVerseOfDay(){
  const t=$("#vday-text"), r=$("#vday-ref");
  const today = new Date().toISOString().slice(0,10);

  // 1) Planilha (aba versiculos)
  try{
    if (CFG.cms?.googleSheetId){
      const rows = await readSheet(CFG.cms.googleSheetId, "versiculos");
      const norm = (s)=> (s||"").toString().trim().slice(0,10);
      let row = rows.find(x => norm(x.data) === today || norm(x.date) === today || norm(x.dia) === today);
      if (!row){
        const past = rows.filter(x => (norm(x.data)||norm(x.date)||norm(x.dia)) <= today);
        row = past[past.length-1];
      }
      if (row && (row.texto || row.verso || row.verse)){
        t.textContent = (row.texto || row.verso || row.verse).toString().trim();
        const ref = row.referencia || row.ref || "";
        const ver = row.versao || row.version || "";
        r.textContent = `${ref}${ver ? " — "+ver : ""} • (planilha)`;
        $("#versiculo").addEventListener("click", ()=>copyToClipboard(`${t.textContent} — ${r.textContent}`));
        return;
      }
    }
  }catch{}

  // 2) A Bíblia Digital (NVI, sem token pode limitar)
  try{
    const headers = { "Accept":"application/json" };
    const r1 = await fetchJson("https://www.abibliadigital.com.br/api/verses/nvi/random", { headers }, 8000);
    if (r1.ok){
      const j = await r1.json();
      if (j?.text){
        t.textContent = j.text.trim();
        r.textContent = `${j.book.name} ${j.chapter}:${j.number} — NVI`;
        $("#versiculo").addEventListener("click", ()=>copyToClipboard(`${t.textContent} — ${r.textContent}`));
        return;
      }
    }
  }catch{}

  // 3) ACF JSON (sempre funciona)
  try{
    const acf = await loadAcfJson();
    const pick = (arr)=> arr[Math.floor(Math.random()*arr.length)];
    const book = pick(acf);
    const cIdx = Math.floor(Math.random()*book.chapters.length);
    const verses = book.chapters[cIdx];
    const vIdx = Math.floor(Math.random()*verses.length);
    t.textContent = verses[vIdx];
    r.textContent = `${book.name} ${cIdx+1}:${vIdx+1} — ACF`;
    $("#versiculo").addEventListener("click", ()=>copyToClipboard(`${t.textContent} — ${r.textContent}`));
    return;
  }catch{}

  // 4) último recurso
  t.textContent = "O Senhor é o meu pastor; nada me faltará.";
  r.textContent = "Salmo 23:1 — (offline)";
}

/* ===================== Busca ===================== */
async function searchBible(q, trad){
  const results=$("#results"); results.innerHTML="";
  const info=$("#searchInfo"); info.textContent="";

  const render = (v)=>{
    const el=document.createElement("div");
    el.className="result";
    el.innerHTML = `<div>${esc(v.text)}</div><div class="ref">${esc(v.ref)}</div>`;
    el.addEventListener("click", ()=>copyToClipboard(`${v.text} — ${v.ref}`));
    results.appendChild(el);
  };

  // 1) A Bíblia Digital (se disponível)
  try{
    const headers = { "Accept":"application/json" };
    // referência?
    const idx = await buildBookIndex();
    const ref = parseRefPT(q, idx);
    if (ref){
      // usamos ACF JSON para achar o nome, e A Bíblia Digital exige abreviação; resolvemos buscando /books e batendo por nome
      const rB = await fetchJson("https://www.abibliadigital.com.br/api/books", { headers }, 8000);
      if (rB.ok){
        const books = await rB.json();
        const b = books.find(x => strip(x.name) === strip(ref.bookName));
        if (b){
          const base = `https://www.abibliadigital.com.br/api/verses/${trad}/${b.abbrev.pt || b.abbrev.en}/${ref.chapter}`;
          const url  = ref.verse ? `${base}/${ref.verse}` : base;
          const r = await fetchJson(url, { headers }, 8000);
          if (r.ok){
            const j = await r.json();
            if (j?.text){ render({text:j.text, ref:`${j.book.name} ${j.chapter}:${j.number} (${trad.toUpperCase()})`}); return; }
            if (Array.isArray(j?.verses)){
              j.verses.forEach(v=> render({text:v.text, ref:`${j.book.name} ${j.chapter}:${v.number} (${trad.toUpperCase()})`}));
              return;
            }
          }
        }
      }
    }
    // busca textual (GET evita preflight)
    const rS = await fetchJson(`https://www.abibliadigital.com.br/api/verses/search?version=${trad}&search=${encodeURIComponent(q)}`, { headers }, 8000);
    if (rS.ok){
      const j2 = await rS.json();
      if (Array.isArray(j2?.verses) && j2.verses.length){
        j2.verses.slice(0,80).forEach(v=> render({text:v.text, ref:`${v.book.name} ${v.chapter}:${v.number} (${trad.toUpperCase()})`}));
        return;
      }
    }
    info.textContent = "A busca pública pode estar limitada agora. Usando alternativa ACF…";
  }catch{ info.textContent = "Não foi possível consultar a API agora. Usando alternativa ACF…"; }

  // 2) Fallback PT-BR: ACF JSON (funciona sempre)
  try{
    const acf = await loadAcfJson();
    const idx = await buildBookIndex();
    const ref = parseRefPT(q, idx);

    if (ref){
      const book = acf.find(b => strip(b.name) === strip(ref.bookName));
      if (book){
        const verses = book.chapters[ref.chapter-1] || [];
        if (ref.verse){
          const txt = verses[ref.verse-1];
          if (txt){ render({text:txt, ref:`${book.name} ${ref.chapter}:${ref.verse} (ACF)`}); return; }
        }else{
          verses.forEach((txt,i)=> render({text:txt, ref:`${book.name} ${ref.chapter}:${i+1} (ACF)`}));
          if (verses.length) return;
        }
      }
    }

    // busca textual simples
    const needle = strip(q);
    const hits = [];
    acf.forEach(b=>{
      b.chapters.forEach((arr,ci)=>{
        arr.forEach((txt,vi)=>{
          if (strip(txt).includes(needle)){
            hits.push({text:txt, ref:`${b.name} ${ci+1}:${vi+1} (ACF)`});
          }
        });
      });
    });
    if (hits.length){ hits.slice(0,80).forEach(render); return; }
  }catch{}

  // 3) Último fallback inglês (KJV)
  try{
    const r = await fetchJson(`https://bible-api.com/${encodeURIComponent(q)}?translation=kjv`);
    const j = await r.json();
    if (Array.isArray(j?.verses) && j.verses.length){
      j.verses.forEach(v=> render({text:v.text.trim(), ref:`${v.book_name} ${v.chapter}:${v.verse} (KJV)`}));
      return;
    }
  }catch{}

  results.innerHTML = `<div class="muted">Nenhum resultado. Tente uma referência (ex.: João 3:16) ou outra palavra.</div>`;
}

/* ===================== YouTube ===================== */
function applyYouTubeEmbeds(){
  const yt = CFG.yt || {};
  const uc = (yt.channelUC || "").trim();
  const uu = (yt.uploadsUU || "").trim();
  const plShorts = (yt.shortsPlaylist || "").trim();
  const plFull   = (yt.fullPlaylist || "").trim();

  $("#liveFrame").src = uc.startsWith("UC")
    ? `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(uc)}&rel=0` : "";

  $("#shortsFrame").src = plShorts
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(plShorts)}`
    : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent("shorts Rescue Church")}`;

  $("#fullFrame").src = plFull
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(plFull)}`
    : (uu.startsWith("UU")
        ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(uu)}`
        : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent("Rescue Church pregação")}`);
}

async function applyYouTubeFromSheet(){
  if (!CFG.cms?.googleSheetId) return;
  try{
    const rows = await readSheet(CFG.cms.googleSheetId, "videos");
    const get = (t)=> rows.find(r => (r.tipo||"").toString().trim().toLowerCase() === t)?.valor || "";
    const uc  = get("channel_uc");
    const uu  = get("uploads_uu");
    const pls = get("shorts_playlist");
    const plf = get("full_playlist");
    if (uc || uu || pls || plf){
      CFG.yt = { channelUC: uc, uploadsUU: uu, shortsPlaylist: pls, fullPlaylist: plf };
    }
  }catch{}
}

/* ===================== boot ===================== */
document.addEventListener("DOMContentLoaded", async ()=>{
  try{ $("#yy").textContent = new Date().getFullYear(); }catch{}
  await loadConfig();
  document.title = CFG.siteTitle || document.title;
  $(".brand h1").textContent = CFG.siteTitle || "Rescue Church";

  await applyYouTubeFromSheet();
  applyYouTubeEmbeds();

  loadVerseOfDay().catch(()=>{});

  $("#searchForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    const q = $("#q").value.trim();
    if (!q) return;
    searchBible(q, $("#trad").value);
  });
});
