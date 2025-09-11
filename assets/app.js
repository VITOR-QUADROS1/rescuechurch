/* ===================== helpers e config ===================== */
const $ = (q) => document.querySelector(q);
const store = {
  get(){ try{ return JSON.parse(localStorage.getItem("rc:cfg")||"{}"); }catch{ return {}; } },
  set(v){ localStorage.setItem("rc:cfg", JSON.stringify(v)); }
};
function copyToClipboard(t){ navigator.clipboard?.writeText(t).catch(()=>{}); }
function escapeHTML(s){ return s.replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;","~":"~","\"":"&quot;","'":"&#39;" }[m])); } // "~" evita conflito do renderizador
function esc(s){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}
const strip = (s)=> s?.normalize?.("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim() || "";

// ACF JSON (pt-BR) – leve e público (CDN). Se preferir, depois colocamos /assets/bible/acf.json.
const ACF_JSON_URL = "https://cdn.jsdelivr.net/gh/thiagobodruk/bible/json/pt-br/acf.json";

// fetch com timeout (evita travar em “Carregando…”)
async function fetchJson(url, opts={}, timeout=9000){
  const ctrl = new AbortController();
  const id = setTimeout(()=>ctrl.abort(), timeout);
  try{
    const resp = await fetch(url, {...opts, signal: ctrl.signal});
    return resp;
  } finally { clearTimeout(id); }
}

// Cabeçalhos p/ A Bíblia Digital (usa token se existir)
function abdHeaders(){
  const h = { "Accept":"application/json" };
  const tk = store.get()?.abdToken?.trim();
  if (tk) h["Authorization"] = `Bearer ${tk}`;
  return h;
}
async function abdGet(path){ return fetchJson(`https://www.abibliadigital.com.br${path}`, {headers: abdHeaders()}); }

/* ===================== ACF JSON cache ===================== */
async function loadAcfJson(){
  const key="rc:acf_json";
  try{
    const cached = JSON.parse(localStorage.getItem(key)||"null");
    if (cached) return cached; // cache no navegador
  }catch{}
  const r = await fetchJson(ACF_JSON_URL);
  const j = await r.json(); // [{name, chapters:[ [v1,v2,...], ... ]}, ...]
  localStorage.setItem(key, JSON.stringify(j));
  return j;
}

// Índice de livros (usado p/ reconhecer “joao 3:16”, “1joao 1:9”, “matheus 5” etc.)
async function buildBookIndex(){
  const idx = {};
  const acf = await loadAcfJson();
  const norm = (s)=> strip(s).replace(/\s+/g,"");
  acf.forEach(b=>{
    const n = norm(b.name);         // ex.: "joao"
    idx[n] = { name:b.name };
    // variações com numerais romanos aceitas (1joao, 2samuel, etc.)
    idx[n.replace(/\biii\b/g,"3").replace(/\bii\b/g,"2").replace(/\bi\b/g,"1")] = { name:b.name };
  });
  // aliases comuns (erros e abreviações)
  Object.assign(idx, {
    mateus:{name:"Mateus"}, matheus:{name:"Mateus"}, mt:{name:"Mateus"},
    jo:{name:"João"}, evangelhodejoao:{name:"João"}, joao:{name:"João"},
    salmos:{name:"Salmos"}, salmo:{name:"Salmos"}, ps:{name:"Salmos"},
    genesis:{name:"Gênesis"}, gen:{name:"Gênesis"},
    exodo:{name:"Êxodo"}, ex:{name:"Êxodo"},
    proverbios:{name:"Provérbios"}, prov:{name:"Provérbios"},
    cantares:{name:"Cantares de Salomão"}, canticos:{name:"Cantares de Salomão"}, canticosdoscanticos:{name:"Cantares de Salomão"},
    eclesiastes:{name:"Eclesiastes"},
    reis:{name:"1 Reis"}, "1reis":{name:"1 Reis"},"2reis":{name:"2 Reis"},
    samuel:{name:"1 Samuel"},"1samuel":{name:"1 Samuel"},"2samuel":{name:"2 Samuel"},
    corintios:{name:"1 Coríntios"},"1corintios":{name:"1 Coríntios"},"2corintios":{name:"2 Coríntios"},
    timoteo:{name:"1 Timóteo"},"1timoteo":{name:"1 Timóteo"},"2timoteo":{name:"2 Timóteo"},
    "1joao":{name:"1 João"},"2joao":{name:"2 João"},"3joao":{name:"3 João"}
  });
  return idx;
}

function parseRef(raw, idx){
  if (!raw) return null;
  let s = strip(raw).replace(/[,;]+/g," ");
  s = s.replace(/\biii\b/g,"3").replace(/\bii\b/g,"2").replace(/\bi\b/g,"1");
  s = s.replace(/^([1-3])([a-z])/,"$1 $2"); // 1joao -> 1 joao
  const m = /^(.+?)\s+(\d+)(?:[:.](\d+))?$/.exec(s);
  if (!m) return null;
  const bookKey = m[1].replace(/\s+/g,"");
  const hit = idx[bookKey];
  if (!hit) return null;
  return { bookName: hit.name, chapter: parseInt(m[2],10), verse: m[3] ? parseInt(m[3],10) : null };
}

/* ===================== Versículo do Dia ===================== */
async function loadVerseOfDay(){
  const t=$("#vday-text"), r=$("#vday-ref");

  // 1) A Bíblia Digital (com token se houver) – NVI
  try{
    const res = await abdGet("/api/verses/nvi/random");
    if (res.ok){
      const j = await res.json();
      if (j?.text){
        t.textContent = j.text.trim();
        r.textContent = `${j.book.name} ${j.chapter}:${j.number} — NVI`;
        $("#versiculo").addEventListener("click", ()=>copyToClipboard(`${t.textContent} ${r.textContent}`));
        return;
      }
    }
  }catch{}

  // 2) Fallback sem rede: ACF JSON
  try{
    const acf = await loadAcfJson();
    const pick = (arr)=> arr[Math.floor(Math.random()*arr.length)];
    const book = pick(acf);
    const cIdx = Math.floor(Math.random()*book.chapters.length);
    const verses = book.chapters[cIdx];
    const vIdx = Math.floor(Math.random()*verses.length);
    t.textContent = verses[vIdx];
    r.textContent = `${book.name} ${cIdx+1}:${vIdx+1} — ACF`;
    $("#versiculo").addEventListener("click", ()=>copyToClipboard(`${t.textContent} ${r.textContent}`));
    return;
  }catch{}

  // 3) Últimos fallbacks (não devem chegar aqui)
  t.textContent = "O Senhor é o meu pastor; nada me faltará.";
  r.textContent = "Salmo 23:1 — (offline)";
}

/* ===================== Busca bíblica ===================== */
async function searchBible(q, trad){
  const results=$("#results"); results.innerHTML="";
  const info=$("#searchInfo"); info.textContent="";

  const render = (v)=>{
    const el=document.createElement("div");
    el.className="result";
    el.innerHTML=`<div>${esc(v.text)}</div><div class="ref">${esc(v.ref)}</div>`;
    el.addEventListener("click",()=>copyToClipboard(`${v.text} — ${v.ref}`));
    results.appendChild(el);
  };

  // 1) Se KJV, usa bible-api.com (inglês)
  if (trad === "kjv"){
    try{
      const r = await fetchJson(`https://bible-api.com/${encodeURIComponent(q)}?translation=kjv`);
      const j = await r.json();
      if (Array.isArray(j?.verses) && j.verses.length){
        j.verses.forEach(v=>render({text:v.text.trim(), ref:`${v.book_name} ${v.chapter}:${v.verse} (KJV)`}));
        return;
      }
    }catch{}
    results.innerHTML = `<div class="muted">Nada encontrado no KJV. Tente "John 3:16" ou outra referência.</div>`;
    return;
  }

  // 2) Tenta A Bíblia Digital (se houver token)
  const hasToken = !!store.get()?.abdToken?.trim();
  if (hasToken){
    try{
      // referência direta
      const idx = await buildBookIndex();
      const ref = parseRef(q, idx);
      if (ref){
        // precisamos da abreviação da ABD: pegamos por /api/books e batemos pelo nome
        const rBooks = await abdGet("/api/books");
        if (rBooks.ok){
          const books = await rBooks.json();
          const b = books.find(x => strip(x.name) === strip(ref.bookName));
          if (b){
            const base = `/api/verses/${trad}/${b.abbrev.pt || b.abbrev.en}/${ref.chapter}`;
            const url  = ref.verse ? `${base}/${ref.verse}` : base;
            const r = await abdGet(url);
            if (r.ok){
              const j = await r.json();
              if (j?.text){
                render({text:j.text, ref:`${j.book.name} ${j.chapter}:${j.number} (${trad.toUpperCase()})`});
                return;
              } else if (Array.isArray(j?.verses)){
                j.verses.forEach(v=>render({text:v.text, ref:`${j.book.name} ${j.chapter}:${v.number} (${trad.toUpperCase()})`}));
                return;
              }
            }
          }
        }
      }
      // busca textual (GET para evitar preflight)
      const r2 = await abdGet(`/api/verses/search?version=${trad}&search=${encodeURIComponent(q)}`);
      if (r2.ok){
        const j2 = await r2.json();
        if (Array.isArray(j2?.verses) && j2.verses.length){
          j2.verses.slice(0,50).forEach(v=>render({text:v.text, ref:`${v.book.name} ${v.chapter}:${v.number} (${trad.toUpperCase()})`}));
          return;
        }
      }
      info.textContent = "A API pode estar limitando agora. Usando ACF como alternativa…";
    }catch{
      info.textContent = "Houve um erro com a API. Usando ACF como alternativa…";
    }
  }

  // 3) Fallback PT-BR: ACF JSON (funciona sempre, sem token)
  try{
    const acf = await loadAcfJson();
    const idx = await buildBookIndex();
    const ref = parseRef(q, idx);

    if (ref){
      const book = acf.find(b => strip(b.name) === strip(ref.bookName));
      if (book){
        const verses = book.chapters[ref.chapter-1] || [];
        if (ref.verse){
          const txt = verses[ref.verse-1];
          if (txt){ render({text:txt, ref:`${book.name} ${ref.chapter}:${ref.verse} (ACF)`}); return; }
        }else{
          verses.forEach((txt,i)=>render({text:txt, ref:`${book.name} ${ref.chapter}:${i+1} (ACF)`}));
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
    if (hits.length){
      hits.slice(0,80).forEach(render);
      return;
    }
  }catch{}

  results.innerHTML = `<div class="muted">Nenhum resultado. Tente uma referência (ex.: João 3:16) ou outra palavra.</div>`;
}

/* ===================== YouTube (sem API key) ===================== */
function applyYouTubeEmbeds(cfg){
  const uc = (cfg.ytChannel || "").trim(); // **precisa ser UC…** para live
  const uploads = (cfg.ytUploads || "").trim(); // UU…
  const plShorts = (cfg.ytShortsPL || "").trim(); // PL…
  const plFull   = (cfg.ytFullPL || "").trim(); // PL…

  // Ao vivo – precisa do **channelId (UC...)**
  $("#liveFrame").src = uc.startsWith("UC")
    ? `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(uc)}&rel=0`
    : "";

  // Shorts – se não tiver playlist, faço busca por "shorts" no canal (funciona)
  $("#shortsFrame").src = plShorts
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(plShorts)}`
    : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent("shorts Rescue Church")}`;

  // Mensagens completas – playlist específica > uploads (UU)
  $("#fullFrame").src = plFull
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(plFull)}`
    : (uploads.startsWith("UU")
        ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(uploads)}`
        : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent("Rescue Church pregação")}`);
}

/* ===================== Config ===================== */
function openConfig(){
  const c = store.get();
  $("#ytChannel").value = c.ytChannel || "";   // UC…
  $("#ytUploads").value = c.ytUploads || "";   // UU…
  $("#ytShortsPL").value = c.ytShortsPL || ""; // PL…
  $("#ytFullPL").value = c.ytFullPL || "";     // PL…
  $("#abdToken").value  = c.abdToken  || "";
  $("#configModal").showModal();
}
function saveConfig(){
  const c = store.get();
  c.ytChannel  = $("#ytChannel").value.trim();
  c.ytUploads  = $("#ytUploads").value.trim();
  c.ytShortsPL = $("#ytShortsPL").value.trim();
  c.ytFullPL   = $("#ytFullPL").value.trim();
  c.abdToken   = $("#abdToken").value.trim();
  store.set(c);
  applyYouTubeEmbeds(c);
}

/* ===================== boot ===================== */
document.addEventListener("DOMContentLoaded", ()=>{
  try { $("#yy").textContent = new Date().getFullYear(); } catch {}
  loadVerseOfDay().catch(()=>{});
  applyYouTubeEmbeds(store.get());

  $("#btnConfig").addEventListener("click", openConfig);
  $("#saveCfg").addEventListener("click", saveConfig);

  $("#searchForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    const q = $("#q").value.trim();
    if (!q) return;
    searchBible(q, $("#trad").value);
  });
});
