/* ===== Helpers ===== */
const $ = (q)=>document.querySelector(q);
const strip = s=>s?.normalize?.("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()||"";
function esc(s){return (s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}
function copyToClipboard(t){navigator.clipboard?.writeText(t).catch(()=>{});}

/* ===== Config ===== */
const ABD_BASE = "https://www.abibliadigital.com.br/api"; // público, sem token
const CACHE_VDAY_KEY = "rc:vday";
const CACHE_SEARCH_KEY = "rc:search:";
const CACHE_REF_KEY = "rc:ref:";
const SEARCH_TTL_MS = 10*60*1000; // 10 min

/* ===== Abreviações (batem com A Bíblia Digital PT) ===== */
const BOOKS = (()=>{ 
  const map={}; const add=(name,abbr,...aliases)=>{ 
    const k=strip(name).replace(/\s+/g,""); map[k]={name,abbr}; 
    aliases.forEach(a=>map[strip(a).replace(/\s+/g,"")]={name,abbr});
  };
  // VT
  add("Gênesis","gn","genesis","gen"); add("Êxodo","ex","exodo"); add("Levítico","lv","levitico");
  add("Números","nm","numeros"); add("Deuteronômio","dt","deuteronomio");
  add("Josué","js","josue"); add("Juízes","jz","juizes"); add("Rute","rt");
  add("1 Samuel","1sm","1samuel"); add("2 Samuel","2sm","2samuel");
  add("1 Reis","1rs","1reis"); add("2 Reis","2rs","2reis");
  add("1 Crônicas","1cr","1cronicas"); add("2 Crônicas","2cr","2cronicas");
  add("Esdras","ed"); add("Neemias","ne"); add("Ester","et");
  add("Jó","jo","job"); add("Salmos","sl","salmo","ps"); add("Provérbios","pv","proverbios","prov");
  add("Eclesiastes","ec"); add("Cantares de Salomão","ct","cantares","canticos","canticosdoscanticos");
  add("Isaías","is","isaias"); add("Jeremias","jr"); add("Lamentações","lm","lamentacoes");
  add("Ezequiel","ez"); add("Daniel","dn"); add("Oséias","os","oseias"); add("Joel","jl");
  add("Amós","am","amos"); add("Obadias","ob"); add("Jonas","jn"); add("Miquéias","mq","miqueias");
  add("Naum","na"); add("Habacuque","hc","habacuc","habacuque"); add("Sofonias","sf"); add("Ageu","ag");
  add("Zacarias","zc"); add("Malaquias","ml");
  // NT
  add("Mateus","mt","matheus"); add("Marcos","mc"); add("Lucas","lc");
  add("João","joao","evangelhodejoao","ev joao"); // <- joão é "joao"
  add("Atos","at"); add("Romanos","rm");
  add("1 Coríntios","1co","1corintios"); add("2 Coríntios","2co","2corintios");
  add("Gálatas","gl","galatas"); add("Efésios","ef","efesios"); add("Filipenses","fp","fl","flp");
  add("Colossenses","cl"); add("1 Tessalonicenses","1ts"); add("2 Tessalonicenses","2ts");
  add("1 Timóteo","1tm","1timoteo"); add("2 Timóteo","2tm","2timoteo");
  add("Tito","tt"); add("Filemom","fm","filemon"); add("Hebreus","hb"); add("Tiago","tg");
  add("1 Pedro","1pe"); add("2 Pedro","2pe");
  add("1 João","1jo","1joao"); add("2 João","2jo","2joao"); add("3 João","3jo","3joao");
  add("Judas","jd"); add("Apocalipse","ap");
  return map;
})();

function parseRefPT(raw){
  let s=strip(raw).replace(/[,;]+/g," ").replace(/\biii\b/g,"3").replace(/\bii\b/g,"2").replace(/\bi\b/g,"1");
  s=s.replace(/^([1-3])([a-z])/,"$1 $2");
  const m=/^(.+?)\s+(\d+)(?::(\d+))?/.exec(s);
  if(!m) return null;
  const k=m[1].replace(/\s+/g,"");
  const book=BOOKS[k]; if(!book) return null;
  return { book, chapter:parseInt(m[2],10), verse:m[3]?parseInt(m[3],10):null };
}

/* ===== ACF por livro (fallback offline) ===== */
const ACF_BASES=[
  "https://cdn.jsdelivr.net/gh/thiagobodruk/bible/json/pt-br/acf",
  "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt-br/acf"
];
async function loadAcfBook(abbr){
  const key=`rc:acf:${abbr}`; const c=localStorage.getItem(key); if(c){try{return JSON.parse(c);}catch{}}
  let data=null;
  for(const base of ACF_BASES){
    try{ const r=await fetch(`${base}/${abbr}.json`); if(r.ok){ data=await r.json(); break; } }catch{}
  }
  if(!data) throw new Error("ACF not found: "+abbr);
  const name=data.book?.name||data.name||abbr.toUpperCase();
  const chapters=Array.isArray(data.chapters)?data.chapters:(Array.isArray(data)?data:[]);
  const norm={name,chapters}; localStorage.setItem(key,JSON.stringify(norm)); return norm;
}

/* ===== Cache helpers (localStorage com TTL) ===== */
function setCache(k, obj, ttlMs){
  const rec={t:Date.now(), ttl:ttlMs, v:obj}; localStorage.setItem(k, JSON.stringify(rec));
}
function getCache(k){
  const raw=localStorage.getItem(k); if(!raw) return null;
  try{ const rec=JSON.parse(raw); if(rec.ttl && Date.now()-rec.t>rec.ttl) return null; return rec.v; }catch{return null;}
}

/* ===== Versículo do dia ===== */
async function loadVerseOfDay(){
  const t=$("#vday-text"), r=$("#vday-ref");
  // cache por data (até meia-noite)
  const today=new Date(); const end=new Date(today); end.setHours(23,59,59,999);
  const ttl=end - today;
  const key=CACHE_VDAY_KEY+"-"+today.toISOString().slice(0,10);
  const cached=getCache(key); if(cached){ t.textContent=cached.text; r.textContent=cached.ref; return; }

  // 1) Tenta A Bíblia Digital (público)
  try{
    const res=await fetch(`${ABD_BASE}/verses/nvi/random`,{headers:{Accept:"application/json"}});
    if(res.ok){ const j=await res.json();
      if(j?.text){ const txt=j.text.trim(); const ref=`${j.book.name} ${j.chapter}:${j.number} — NVI`;
        t.textContent=txt; r.textContent=ref; setCache(key,{text:txt,ref},ttl);
        $("#versiculo").addEventListener("click",()=>copyToClipboard(`${txt} — ${ref}`)); return;
      }
    }
  }catch{}

  // 2) Fallback ACF: verso "do dia" determinístico (parece aleatório, mas é por data)
  try{
    const abbrs=["sl","pv","mt","joao","rm","gn","is","hb","ap"];
    const seed = parseInt(today.toISOString().slice(0,10).replace(/-/g,""),10);
    function rnd(n){ return Math.abs(Math.sin(seed*n))*0.9999; }
    const ab=abbrs[Math.floor(rnd(7)*abbrs.length)];
    const bk=await loadAcfBook(ab);
    const ci=Math.floor(rnd(11)*bk.chapters.length);
    const vs=bk.chapters[ci]; const vi=Math.floor(rnd(13)*vs.length);
    const txt=vs[vi]; const ref=`${bk.name} ${ci+1}:${vi+1} — ACF`;
    t.textContent=txt; r.textContent=ref; setCache(key,{text:txt,ref},ttl);
    $("#versiculo").addEventListener("click",()=>copyToClipboard(`${txt} — ${ref}`));
    return;
  }catch{}
  t.textContent="O Senhor é o meu pastor; nada me faltará."; r.textContent="Salmo 23:1 — (offline)";
}

/* ===== Busca ===== */
async function searchBible(q, version){
  const results=$("#results"); results.innerHTML="";
  const info=$("#searchInfo"); info.textContent="";

  const render=(text,ref)=>{
    const el=document.createElement("div");
    el.className="result"; el.innerHTML=`<div>${esc(text)}</div><div class="ref">${esc(ref)}</div>`;
    el.addEventListener("click",()=>copyToClipboard(`${text} — ${ref}`));
    results.appendChild(el);
  };

  const cacheKey = CACHE_SEARCH_KEY+version+":"+strip(q);
  const hit = getCache(cacheKey);
  if(hit){ hit.forEach(x=>render(x.text,x.ref)); return; }

  const out=[]; const push=(t,ref)=>{ out.push({text:t,ref}); render(t,ref); };

  /* 1) Referência direta? (João 4:5) → ABD pública */
  const ref=parseRefPT(q);
  if(ref){
    try{
      const base=`${ABD_BASE}/verses/${version}/${ref.book.abbr}/${ref.chapter}`;
      const url = ref.verse ? `${base}/${ref.verse}` : base;
      const res=await fetch(url,{headers:{Accept:"application/json"}});
      if(res.ok){
        const j=await res.json();
        if(j?.text){ push(j.text, `${j.book.name} ${j.chapter}:${j.number} (${version.toUpperCase()})`);
          setCache(cacheKey,out,SEARCH_TTL_MS); return; }
        if(Array.isArray(j?.verses)){ j.verses.forEach(v=>push(v.text,`${j.book.name} ${j.chapter}:${v.number} (${version.toUpperCase()})`));
          setCache(cacheKey,out,SEARCH_TTL_MS); return; }
      }
      info.textContent="A API pública pode estar no limite. Usando alternativa ACF…";
    }catch{ info.textContent="A API pública pode estar no limite. Usando alternativa ACF…"; }
  }

  /* 2) Busca textual na ABD (GET sem body) */
  try{
    const res=await fetch(`${ABD_BASE}/verses/search?version=${encodeURIComponent(version)}&search=${encodeURIComponent(q)}`,
                          {headers:{Accept:"application/json"}});
    if(res.ok){
      const j=await res.json();
      if(Array.isArray(j?.verses) && j.verses.length){
        j.verses.slice(0,80).forEach(v=>push(v.text,`${v.book.name} ${v.chapter}:${v.number} (${version.toUpperCase()})`));
        setCache(cacheKey,out,SEARCH_TTL_MS); return;
      }
    }
    if(!info.textContent) info.textContent="A API pública pode estar no limite. Usando alternativa ACF…";
  }catch{ if(!info.textContent) info.textContent="A API pública pode estar no limite. Usando alternativa ACF…"; }

  /* 3) Fallback ACF (pt-BR) – referência ou busca simples */
  try{
    if(ref){
      const book=await loadAcfBook(ref.book.abbr);
      const verses=book.chapters[ref.chapter-1]||[];
      if(ref.verse){
        const txt=verses[ref.verse-1]; if(txt){ push(txt,`${book.name} ${ref.chapter}:${ref.verse} (ACF)`); setCache(cacheKey,out,SEARCH_TTL_MS); return; }
      }else if(verses.length){
        verses.forEach((t,i)=>push(t,`${book.name} ${ref.chapter}:${i+1} (ACF)`)); setCache(cacheKey,out,SEARCH_TTL_MS); return;
      }
    }
    const needle=strip(q);
    const abbrs=[...new Set(Object.values(BOOKS).map(b=>b.abbr))];
    let cnt=0;
    for(const ab of abbrs){
      const book=await loadAcfBook(ab);
      for(let ci=0; ci<book.chapters.length && cnt<80; ci++){
        const arr=book.chapters[ci]||[];
        for(let vi=0; vi<arr.length && cnt<80; vi++){
          if(strip(arr[vi]).includes(needle)){ push(arr[vi],`${book.name} ${ci+1}:${vi+1} (ACF)`); cnt++; }
        }
      }
      if(cnt>=80) break;
    }
    if(out.length){ setCache(cacheKey,out,SEARCH_TTL_MS); return; }
  }catch{}

  results.innerHTML=`<div class="muted">Nenhum resultado. Tente uma referência (ex.: João 3:16) ou outra palavra.</div>`;
}

/* ===== YouTube (igual) – preencha se quiser IDs/Playlists) ===== */
function applyYouTubeEmbeds(){
  const UC=""; const UU=""; const PL_SHORTS=""; const PL_FULL="";
  $("#liveFrame")?.setAttribute("src", UC ? `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(UC)}&rel=0` : "");
  $("#shortsFrame")?.setAttribute("src", PL_SHORTS
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(PL_SHORTS)}`
    : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent("shorts Igreja de Resgate")}`);
  $("#fullFrame")?.setAttribute("src", PL_FULL
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(PL_FULL)}`
    : (UU ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(UU)}`
          : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent("Igreja de Resgate pregação")}`));
}

/* ===== boot ===== */
document.addEventListener("DOMContentLoaded", ()=>{
  try{$("#yy").textContent=new Date().getFullYear();}catch{}
  applyYouTubeEmbeds();
  loadVerseOfDay().catch(()=>{});
  $("#searchForm")?.addEventListener("submit", e=>{
    e.preventDefault();
    const q=$("#q").value.trim(); if(!q) return;
    searchBible(q, $("#trad").value);
  });
});
