/* ================= helpers ================= */
const $ = (q)=>document.querySelector(q);
const strip = s => s?.normalize?.("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim() || "";
function copyToClipboard(t){ navigator.clipboard?.writeText(t).catch(()=>{}); }
function esc(s){ return (s||"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }
async function fetchJson(url, opts={}, timeout=9000){
  const ctrl=new AbortController(); const id=setTimeout(()=>ctrl.abort(), timeout);
  try{ return await fetch(url,{...opts,signal:ctrl.signal}); } finally{ clearTimeout(id); }
}

/* ============ A Bíblia Digital (pública, sem token) ============ */
const ABD_HEADERS = { "Accept":"application/json" };

/* ============ ACF por livro (pt-BR) ============ */
/* Tenta jsDelivr e, se falhar, cai no raw.githubusercontent */
const ACF_BASES = [
  "https://cdn.jsdelivr.net/gh/thiagobodruk/bible/json/pt-br/acf",
  "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt-br/acf"
];

const BOOKS = (()=>{ // nome normalizado -> {name, abbr}
  const map = {};
  const add = (name, abbr, ...aliases)=>{
    const k = strip(name).replace(/\s+/g,"");
    map[k] = { name, abbr };
    aliases.forEach(a=> map[strip(a).replace(/\s+/g,"")] = { name, abbr });
  };
  // VT
  add("Gênesis","gn","genesis","gen","gensis");
  add("Êxodo","ex","exodo");
  add("Levítico","lv","levitico");
  add("Números","nm","numeros");
  add("Deuteronômio","dt","deuteronomio");
  add("Josué","js","josue");
  add("Juízes","jz","juizes","juizes");
  add("Rute","rt");
  add("1 Samuel","1sm","1 samuel","1samuel");
  add("2 Samuel","2sm","2 samuel","2samuel");
  add("1 Reis","1rs","1 reis","1reis");
  add("2 Reis","2rs","2 reis","2reis");
  add("1 Crônicas","1cr","1 cronicas","1cronicas");
  add("2 Crônicas","2cr","2 cronicas","2cronicas");
  add("Esdras","ed");
  add("Neemias","ne");
  add("Ester","et");
  add("Jó","job","jo");
  add("Salmos","sl","salmo","salmos","ps");
  add("Provérbios","pv","proverbios","prov");
  add("Eclesiastes","ec","eclesiastes");
  add("Cantares de Salomão","ct","cantares","canticos","canticosdoscanticos");
  add("Isaías","is","isaias");
  add("Jeremias","jr");
  add("Lamentações","lm","lamentacoes");
  add("Ezequiel","ez");
  add("Daniel","dn");
  add("Oséias","os","oseias");
  add("Joel","jl");
  add("Amós","am","amos");
  add("Obadias","ob");
  add("Jonas","jn");
  add("Miquéias","mq","miqueias");
  add("Naum","na");
  add("Habacuque","hc","habacuc","habacuque");
  add("Sofonias","sf");
  add("Ageu","ag");
  add("Zacarias","zc");
  add("Malaquias","ml");
  // NT
  add("Mateus","mt","matheus","mateus","mt");
  add("Marcos","mc");
  add("Lucas","lc");
  add("João","jo","joao","evangelhodejoao");
  add("Atos","at","atosdosapostolos");
  add("Romanos","rm");
  add("1 Coríntios","1co","1corintios","1 corintios");
  add("2 Coríntios","2co","2corintios","2 corintios");
  add("Gálatas","gl","galatas");
  add("Efésios","ef","efesios");
  add("Filipenses","fp","filipenses","fl","flp");
  add("Colossenses","cl");
  add("1 Tessalonicenses","1ts","1tessalonicenses","1 tessalonicenses");
  add("2 Tessalonicenses","2ts","2tessalonicenses","2 tessalonicenses");
  add("1 Timóteo","1tm","1timoteo");
  add("2 Timóteo","2tm","2timoteo");
  add("Tito","tt");
  add("Filemom","fm","filemon","fm");
  add("Hebreus","hb");
  add("Tiago","tg");
  add("1 Pedro","1pe");
  add("2 Pedro","2pe");
  add("1 João","1jo","1joao");
  add("2 João","2jo","2joao");
  add("3 João","3jo","3joao");
  add("Judas","jd");
  add("Apocalipse","ap");
  return map;
})();

function findBookAbbr(input){
  const key = strip(input).replace(/\s+/g,"");
  return BOOKS[key] || null;
}

async function loadAcfBook(abbr){
  const cacheKey = `rc:acf:${abbr}`;
  const c = localStorage.getItem(cacheKey);
  if (c) try{ return JSON.parse(c); }catch{}
  let data=null;
  for (const base of ACF_BASES){
    try{
      const r = await fetchJson(`${base}/${abbr}.json`);
      if (r.ok){ data = await r.json(); break; }
    }catch{}
  }
  if (!data) throw new Error("ACF book not found: "+abbr);

  // normalizar para { name, chapters: string[][] }
  let name = data.book?.name || data.name || data.book || abbr.toUpperCase();
  let chapters = Array.isArray(data.chapters) ? data.chapters
                : Array.isArray(data) ? data
                : data.chapter || data.capitulos || [];
  const norm = { name, chapters };
  localStorage.setItem(cacheKey, JSON.stringify(norm));
  return norm;
}

/* ============ Versículo do dia ============ */
async function verseOfDay(){
  const t=$("#vday-text"), r=$("#vday-ref");

  // 1) A Bíblia Digital (random NVI)
  try{
    const res = await fetchJson("https://www.abibliadigital.com.br/api/verses/nvi/random", {headers: ABD_HEADERS}, 8000);
    if (res.ok){
      const j=await res.json();
      if (j?.text){
        t.textContent=j.text.trim();
        r.textContent=`${j.book.name} ${j.chapter}:${j.number} — NVI`;
        $("#versiculo").addEventListener("click",()=>copyToClipboard(`${t.textContent} — ${r.textContent}`));
        return;
      }
    }
  }catch{}

  // 2) Fallback ACF por livro (sempre funciona)
  try{
    const abbrs = ["gn","sl","pv","is","jo","mt","mc","lc","jo","rm","ap"];
    const pick = a => a[Math.floor(Math.random()*a.length)];
    const bk = await loadAcfBook(pick(abbrs));
    const ci = Math.floor(Math.random()*bk.chapters.length);
    const vs = bk.chapters[ci];
    const vi = Math.floor(Math.random()*vs.length);
    t.textContent = vs[vi];
    r.textContent = `${bk.name || "ACF"} ${ci+1}:${vi+1} — ACF`;
    $("#versiculo").addEventListener("click",()=>copyToClipboard(`${t.textContent} — ${r.textContent}`));
    return;
  }catch{}

  // 3) Último recurso
  t.textContent="O Senhor é o meu pastor; nada me faltará.";
  r.textContent="Salmo 23:1 — (offline)";
}

/* ============ Busca bíblica ============ */
function parseRefPT(raw){
  // aceita "genesis 2:4", "1 joao 1:9", "joao 3"
  let s = strip(raw).replace(/[,;]+/g," ");
  s = s.replace(/\biii\b/g,"3").replace(/\bii\b/g,"2").replace(/\bi\b/g,"1");
  s = s.replace(/^([1-3])([a-z])/,"$1 $2");
  const m = /^(.+?)\s+(\d+)(?:[:.](\d+))?$/.exec(s);
  if (!m) return null;
  const book = findBookAbbr(m[1]); if (!book) return null;
  return { book, chapter: parseInt(m[2],10), verse: m[3]?parseInt(m[3],10):null };
}

async function searchBible(q, version){
  const results=$("#results"); results.innerHTML="";
  const info=$("#searchInfo"); info.textContent="";

  const render = (text, ref) => {
    const el=document.createElement("div");
    el.className="result";
    el.innerHTML = `<div>${esc(text)}</div><div class="ref">${esc(ref)}</div>`;
    el.addEventListener("click",()=>copyToClipboard(`${text} — ${ref}`));
    results.appendChild(el);
  };

  // 1) Tenta A Bíblia Digital (pública) — referência e busca textual
  try{
    const ref = parseRefPT(q);
    if (ref){
      // Para ABD precisamos da abreviação deles; nossa abrev já bate (pt-br)
      const base = `https://www.abibliadigital.com.br/api/verses/${version}/${ref.book.abbr}/${ref.chapter}`;
      const url  = ref.verse ? `${base}/${ref.verse}` : base;
      const r = await fetchJson(url, {headers: ABD_HEADERS}, 8000);
      if (r.ok){
        const j = await r.json();
        if (j?.text){ render(j.text, `${j.book.name} ${j.chapter}:${j.number} (${version.toUpperCase()})`); return; }
        if (Array.isArray(j?.verses)){
          j.verses.forEach(v=>render(v.text, `${j.book.name} ${j.chapter}:${v.number} (${version.toUpperCase()})`));
          return;
        }
      }
    }
    const r2 = await fetchJson(`https://www.abibliadigital.com.br/api/verses/search?version=${version}&search=${encodeURIComponent(q)}`, {headers: ABD_HEADERS}, 8000);
    if (r2.ok){
      const j2 = await r2.json();
      if (Array.isArray(j2?.verses) && j2.verses.length){
        j2.verses.slice(0,80).forEach(v=>render(v.text, `${v.book.name} ${v.chapter}:${v.number} (${version.toUpperCase()})`));
        return;
      }
    }
    info.textContent = "Não foi possível consultar a API agora. Usando alternativa ACF…";
  }catch{ info.textContent = "Não foi possível consultar a API agora. Usando alternativa ACF…"; }

  // 2) Fallback ACF por livro (pt-BR, sem limites)
  try{
    const ref = parseRefPT(q);
    if (ref){
      const book = await loadAcfBook(ref.book.abbr);
      const verses = book.chapters[ref.chapter-1] || [];
      if (ref.verse){
        const txt = verses[ref.verse-1];
        if (txt){ render(txt, `${book.name} ${ref.chapter}:${ref.verse} (ACF)`); return; }
      }else if (verses.length){
        verses.forEach((txt,i)=>render(txt, `${book.name} ${ref.chapter}:${i+1} (ACF)`));
        return;
      }
    }
    // busca textual simples no ACF (pode ser custoso; limitamos 80 resultados)
    const needle = strip(q);
    const abbrs = Object.values(BOOKS).map(x=>x.abbr);
    let count=0;
    for (const ab of abbrs){
      const book = await loadAcfBook(ab);
      for (let ci=0; ci<book.chapters.length && count<80; ci++){
        const arr = book.chapters[ci] || [];
        for (let vi=0; vi<arr.length && count<80; vi++){
          if (strip(arr[vi]).includes(needle)){
            render(arr[vi], `${book.name} ${ci+1}:${vi+1} (ACF)`); count++;
          }
        }
      }
      if (count>=80) break;
    }
    if (count>0) return;
  }catch{}

  // 3) Último fallback (KJV – inglês)
  try{
    const r = await fetchJson(`https://bible-api.com/${encodeURIComponent(q)}?translation=kjv`);
    const j = await r.json();
    if (Array.isArray(j?.verses) && j.verses.length){
      j.verses.forEach(v=>render(v.text.trim(), `${v.book_name} ${v.chapter}:${v.verse} (KJV)`));
      return;
    }
  }catch{}

  results.innerHTML = `<div class="muted">Nenhum resultado. Tente uma referência (ex.: João 3:16) ou outra palavra.</div>`;
}

/* ============ YouTube (continua como antes) ============ */
function applyYouTubeEmbeds(){
  // Se quiser, preencha os IDs diretamente aqui por enquanto
  const UC = ""; // ex.: UCxxxxxxxx...
  const UU = ""; // ex.: UUxxxxxxxx...
  const PL_SHORTS = ""; // ex.: PLxxxxxxxx...
  const PL_FULL   = ""; // ex.: PLxxxxxxxx...

  $("#liveFrame")?.setAttribute("src", UC ? `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(UC)}&rel=0` : "");
  $("#shortsFrame")?.setAttribute("src", PL_SHORTS
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(PL_SHORTS)}`
    : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent("shorts Rescue Church")}`);
  $("#fullFrame")?.setAttribute("src", PL_FULL
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(PL_FULL)}`
    : (UU ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(UU)}`
          : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent("Rescue Church pregação")}`));
}

/* ============ boot ============ */
document.addEventListener("DOMContentLoaded", ()=>{
  try{ $("#yy").textContent = new Date().getFullYear(); }catch{}
  applyYouTubeEmbeds();
  verseOfDay().catch(()=>{});
  $("#searchForm")?.addEventListener("submit",(e)=>{
    e.preventDefault();
    const q=$("#q").value.trim(); if(!q) return;
    searchBible(q, $("#trad").value);
  });
});
