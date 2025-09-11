/* ============ helpers ============ */
const $ = (q) => document.querySelector(q);
const store = {
  get(){ try{ return JSON.parse(localStorage.getItem("rc:cfg")||"{}"); }catch{ return {}; } },
  set(v){ localStorage.setItem("rc:cfg", JSON.stringify(v)); }
};
function copyToClipboard(t){ navigator.clipboard?.writeText(t).catch(()=>{}); }
function escapeHTML(s){ return s.replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }
const strip = (s)=> s?.normalize?.("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim() || "";

// fetch com timeout
async function fetchJson(url, opts={}, timeout=7000){
  const ctrl = new AbortController();
  const id = setTimeout(()=>ctrl.abort(), timeout);
  try{
    const res = await fetch(url, {...opts, signal: ctrl.signal});
    return res;
  } finally {
    clearTimeout(id);
  }
}

// helper para A Bíblia Digital (inclui token se existir)
function abdHeaders(){
  const h = { "Accept":"application/json" };
  const tk = store.get()?.abdToken?.trim();
  if (tk) h["Authorization"] = `Bearer ${tk}`;
  return h;
}
async function abdGet(path){ return fetchJson(`https://www.abibliadigital.com.br${path}`, {headers: abdHeaders()}); }

/* ============ Versículo do Dia ============ 
   Ordem:
   1) ABD random (NVI)
   2) ABD manual (sorteia livro/capítulo e escolhe 1 versículo)
   3) OurManna
   4) Offline
*/
async function loadVerseOfDay(){
  const t=$("#vday-text"), r=$("#vday-ref");

  // 1) random NVI
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

  // 2) manual: /books -> /verses/:abbrev/:cap
  try{
    const resB = await abdGet("/api/books");
    if (resB.ok){
      const books = await resB.json();
      const pick = (arr)=> arr[Math.floor(Math.random()*arr.length)];
      const bk = pick(books);
      const cap = 1 + Math.floor(Math.random() * (bk.chapters || 1));
      const resC = await abdGet(`/api/verses/nvi/${bk.abbrev.pt || bk.abbrev.en}/${cap}`);
      if (resC.ok){
        const j = await resC.json();
        const v = pick(j.verses || []);
        if (v?.text){
          t.textContent = v.text.trim();
          r.textContent = `${j.book.name} ${j.chapter}:${v.number} — NVI`;
          $("#versiculo").addEventListener("click", ()=>copyToClipboard(`${t.textContent} ${r.textContent}`));
          return;
        }
      }
    }
  }catch{}

  // 3) OurManna
  try{
    const res = await fetchJson("https://www.ourmanna.com/api/v1/get/?format=json");
    if (res.ok){
      const j = await res.json();
      t.textContent = j.verse.details.text.trim();
      r.textContent = `${j.verse.details.reference} — ${j.verse.details.version}`;
      $("#versiculo").addEventListener("click", ()=>copyToClipboard(`${t.textContent} ${r.textContent}`));
      return;
    }
  }catch{}

  // 4) offline
  const pool = [
    {t:"Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito...", r:"João 3:16 (ARA)"},
    {t:"O Senhor é o meu pastor; nada me faltará.", r:"Salmo 23:1 (ARA)"},
    {t:"Posso todas as coisas naquele que me fortalece.", r:"Filipenses 4:13 (ARA)"},
    {t:"Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento.", r:"Provérbios 3:5 (ARA)"}
  ];
  const i = new Date().getDate() % pool.length;
  t.textContent = pool[i].t; r.textContent = pool[i].r + " — (offline)";
  $("#versiculo").addEventListener("click", ()=>copyToClipboard(`${t.textContent} ${r.textContent}`));
}

/* ============ Índice de livros + aliases (PT) ============ */
async function getBooksIndex(){
  const key = "rc:books";
  try{
    const cached = JSON.parse(localStorage.getItem(key)||"null");
    if (cached && Date.now()-cached.ts < 7*24*60*60*1000) return cached.idx;

    const res = await abdGet("/api/books");
    const arr = res.ok ? await res.json() : [];
    const idx = {};
    const norm = (s)=> strip(s).replace(/\s+/g,"");
    const roman = (s)=> s.replace(/\biii\b/g,"3").replace(/\bii\b/g,"2").replace(/\bi\b/g,"1");

    arr.forEach(b=>{
      const ab = b.abbrev?.pt || b.abbrev?.en;
      const name = norm(b.name);
      idx[name]=ab; idx[roman(name)]=ab;
      if (b.abbrev?.pt) idx[norm(b.abbrev.pt)] = ab;
      if (b.abbrev?.en) idx[norm(b.abbrev.en)] = ab;
    });

    // aliases comuns / erros de digitação
    Object.assign(idx, {
      matheus:"mt", mateus:"mt", matt:"mt", mt:"mt",
      joao:"jo", evangelhodejoao:"jo", jo:"jo",
      salmos:"sl", salmo:"sl", ps:"sl",
      genesis:"gn", gen:"gn",
      exodo:"ex", ex:"ex",
      proverbios:"pv", prov:"pv",
      cantares:"ct", canticos:"ct", "canticosdoscanticos":"ct",
      eclesiastes:"ec",
      "1reis":"1rs","2reis":"2rs","reis":"1rs",
      "1samuel":"1sm","2samuel":"2sm","samuel":"1sm",
      "1corintios":"1co","2corintios":"2co","corintios":"1co",
      "1joao":"1jo","2joao":"2jo","3joao":"3jo",
      "1timoteo":"1tm","2timoteo":"2tm","timoteo":"1tm"
    });

    localStorage.setItem(key, JSON.stringify({ts: Date.now(), idx}));
    return idx;
  }catch{
    return null;
  }
}

function parseReference(raw, idx){
  let s = strip(raw).replace(/[,;]+/g," ");
  s = s.replace(/\biii\b/g,"3").replace(/\bii\b/g,"2").replace(/\bi\b/g,"1");
  s = s.replace(/^([1-3])([a-z])/,"$1 $2"); // 1joao -> 1 joao
  const m = /^(.+?)\s+(\d+)(?:[:.](\d+)(?:-\d+)?)?$/.exec(s);
  if (!m) return null;
  const bookKey = m[1].replace(/\s+/g,"");
  const abrev = idx?.[bookKey];
  if (!abrev) return null;
  return { abrev, chapter: m[2], verse: m[3] || null };
}

/* ============ Busca bíblica ============ */
async function searchBible(q, trad){
  const results = $("#results"); results.innerHTML = "";
  const info = $("#searchInfo"); info.textContent = "";

  const version = trad; // nvi | acf | kjv

  // PT-BR (NVI/ACF): tenta referência direta
  if (version === "nvi" || version === "acf"){
    try{
      const idx = await getBooksIndex();
      const ref = parseReference(q, idx);

      if (ref){
        const base = `/api/verses/${version}/${ref.abrev}/${ref.chapter}`;
        const url  = ref.verse ? `${base}/${ref.verse}` : base;
        const r1 = await abdGet(url);
        if (r1.ok){
          const j = await r1.json();
          if (j?.text){
            render({text:j.text, ref:`${j.book.name} ${j.chapter}:${j.number} (${version.toUpperCase()})`});
            return;
          } else if (Array.isArray(j?.verses)){
            j.verses.forEach(v=>render({text:v.text, ref:`${j.book.name} ${j.chapter}:${v.number} (${version.toUpperCase()})`}));
            return;
          }
        }
      }

      // busca textual (GET para evitar CORS de POST)
      const r2 = await abdGet(`/api/verses/search?version=${version}&search=${encodeURIComponent(q)}`);
      if (r2.ok){
        const j2 = await r2.json();
        if (Array.isArray(j2?.verses) && j2.verses.length){
          j2.verses.slice(0,50).forEach(v=>render({text:v.text, ref:`${v.book.name} ${v.chapter}:${v.number} (${version.toUpperCase()})`}));
          return;
        }
      }

      info.textContent = "A busca pública pode estar limitada agora. Tentando alternativa…";
    }catch{
      info.textContent = "A busca pública pode estar limitada agora. Tentando alternativa…";
    }
  }

  // fallback KJV para referência
  if (/^[^\d]+?\s+\d+([:.]\d+)?/.test(q.trim())){
    try{
      const r = await fetchJson(`https://bible-api.com/${encodeURIComponent(q)}?translation=kjv`);
      const j = await r.json();
      if (Array.isArray(j?.verses) && j.verses.length){
        j.verses.forEach(v=>render({text:v.text.trim(), ref:`${v.book_name} ${v.chapter}:${v.verse} (KJV)`}));
        return;
      }
    }catch{}
  }

  results.innerHTML = `<div class="muted">Nenhum resultado. Tente uma referência (ex.: João 3:16) ou outra palavra.</div>`;

  function render(v){
    const el = document.createElement("div");
    el.className = "result";
    el.innerHTML = `<div>${escapeHTML(v.text)}</div><div class="ref">${escapeHTML(v.ref)}</div>`;
    el.addEventListener("click", ()=>copyToClipboard(`${v.text} — ${v.ref}`));
    results.appendChild(el);
  }
}

/* ============ YouTube (sem API key) ============ */
function applyYouTubeEmbeds(cfg){
  const channel = (cfg.ytChannel?.trim() || "@youtube");
  const uploads = cfg.ytUploads?.trim() || "";
  const plShorts = cfg.ytShortsPL?.trim() || "";
  const plFull   = cfg.ytFullPL?.trim() || "";
  const nameForSearch = channel.replace(/^@/,"");

  $("#liveFrame").src = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(channel)}&rel=0`;
  $("#shortsFrame").src = plShorts
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(plShorts)}`
    : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(nameForSearch + " shorts")}`;
  $("#fullFrame").src = plFull
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(plFull)}`
    : (uploads
        ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(uploads)}`
        : `https://www.youtube.com/embed?listType=user_uploads&list=${encodeURIComponent(nameForSearch)}`);
}

/* ============ Config ============ */
function openConfig(){
  const c = store.get();
  $("#ytChannel").value = c.ytChannel || "";
  $("#ytUploads").value = c.ytUploads || "";
  $("#ytShortsPL").value = c.ytShortsPL || "";
  $("#ytFullPL").value = c.ytFullPL || "";
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

/* ============ boot ============ */
document.addEventListener("DOMContentLoaded", ()=>{
  $("#yy").textContent = new Date().getFullYear();
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
