/* ===== helpers ===== */
const $ = (q) => document.querySelector(q);
const store = {
  get() { try { return JSON.parse(localStorage.getItem("rc:cfg") || "{}"); } catch { return {}; } },
  set(cfg) { localStorage.setItem("rc:cfg", JSON.stringify(cfg)); }
};
function copyToClipboard(t){ navigator.clipboard?.writeText(t).catch(()=>{}); }
function escapeHTML(s){ return s.replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }
const strip = (s)=> s?.normalize?.("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim() || "";

/* ===== Versículo do Dia (PT-BR primeiro) =====
   1) A Bíblia Digital /verses/nvi/random
   2) A Bíblia Digital manual: sorteia livro/capítulo e escolhe 1 verso
   3) OurManna
   4) Pool offline
*/
async function loadVerseOfDay() {
  const vtext = $("#vday-text"), vref = $("#vday-ref");

  // 1) random (NVI)
  try {
    const r = await fetch("https://www.abibliadigital.com.br/api/verses/nvi/random");
    if (!r.ok) throw new Error("random nvi falhou");
    const j = await r.json();
    if (j?.text) {
      vtext.textContent = j.text.trim();
      vref.textContent  = `${j.book.name} ${j.chapter}:${j.number} — NVI`;
      $("#versiculo").addEventListener("click", ()=>copyToClipboard(`${vtext.textContent} ${vref.textContent}`));
      return;
    }
  } catch {}

  // 2) random manual com /books e /verses/:abbrev/:chapter
  try {
    const booksResp = await fetch("https://www.abibliadigital.com.br/api/books");
    const books = await booksResp.json();
    const pick = (arr)=> arr[Math.floor(Math.random()*arr.length)];
    const book = pick(books);
    const chapter = 1 + Math.floor(Math.random() * (book.chapters || 1));
    const chapResp = await fetch(`https://www.abibliadigital.com.br/api/verses/nvi/${book.abbrev.pt || book.abbrev.en}/${chapter}`);
    if (chapResp.ok) {
      const j = await chapResp.json();
      const v = pick(j.verses || []);
      if (v?.text) {
        vtext.textContent = v.text.trim();
        vref.textContent  = `${j.book.name} ${j.chapter}:${v.number} — NVI`;
        $("#versiculo").addEventListener("click", ()=>copyToClipboard(`${vtext.textContent} ${vref.textContent}`));
        return;
      }
    }
  } catch {}

  // 3) OurManna
  try {
    const r = await fetch("https://www.ourmanna.com/api/v1/get/?format=json");
    if (!r.ok) throw new Error("falha ourmanna");
    const j = await r.json();
    vtext.textContent = j.verse.details.text.trim();
    vref.textContent  = `${j.verse.details.reference} — ${j.verse.details.version}`;
    $("#versiculo").addEventListener("click", ()=>copyToClipboard(`${vtext.textContent} ${vref.textContent}`));
    return;
  } catch {}

  // 4) offline
  const pool = [
    {t:"Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito...", r:"João 3:16 (ARA)"},
    {t:"O Senhor é o meu pastor; nada me faltará.", r:"Salmo 23:1 (ARA)"},
    {t:"Posso todas as coisas naquele que me fortalece.", r:"Filipenses 4:13 (ARA)"},
    {t:"Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento.", r:"Provérbios 3:5 (ARA)"},
  ];
  const i = new Date().getDate() % pool.length;
  vtext.textContent = pool[i].t; vref.textContent = pool[i].r + " — (offline)";
  $("#versiculo").addEventListener("click", ()=>copyToClipboard(`${vtext.textContent} ${vref.textContent}`));
}

/* ===== índice de livros + aliases =====
   - baixa /api/books e indexa nomes/abreviações
   - adiciona aliases para variações comuns (ex.: "matheus" → "mt")
*/
async function getBooksIndex(){
  const key = "rc:books";
  try{
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    if (cached && Date.now() - cached.ts < 7*24*60*60*1000) return cached.idx;

    const r = await fetch("https://www.abibliadigital.com.br/api/books");
    const arr = await r.json();
    const idx = {};
    const norm = (s)=> strip(s).replace(/\s+/g,"");
    const roman = (s)=> s.replace(/\biii\b/g,"3").replace(/\bii\b/g,"2").replace(/\bi\b/g,"1");

    arr.forEach(b=>{
      const abpt = b.abbrev?.pt || b.abbrev?.en;
      const name = norm(b.name);
      idx[name] = abpt;
      idx[roman(name)] = abpt;

      if (b.abbrev?.pt) idx[norm(b.abbrev.pt)] = abpt;
      if (b.abbrev?.en) idx[norm(b.abbrev.en)] = abpt;
    });

    // aliases manuais (variações/erros comuns)
    const aliases = {
      matheus:"mt", mateus:"mt", mt:"mt", matt:"mt",
      joao:"jo", jo:"jo", evangelhodejoao:"jo",
      salmo:"sl", salmos:"sl", ps:"sl",
      genesis:"gn", gen:"gn",
      exodo:"ex", ex:"ex",
      proverbios:"pv", prov:"pv",
      eclesiastes:"ec", cantares:"ct", canticos:"ct", "canticosdoscanticos":"ct",
      reis:"1rs", "1reis":"1rs", "2reis":"2rs",
      corintios:"1co", "1corintios":"1co", "2corintios":"2co",
      samuel:"1sm", "1samuel":"1sm", "2samuel":"2sm",
      timoteo:"1tm", "1timoteo":"1tm", "2timoteo":"2tm"
    };
    Object.entries(aliases).forEach(([k,v])=> idx[norm(k)] = v);

    localStorage.setItem(key, JSON.stringify({ts: Date.now(), idx}));
    return idx;
  }catch{
    return null;
  }
}

/* ===== interpretar referência =====
   Aceita “Matheus 3:4”, “Mateus 3”, “1 Jo 1:9”, “1joao 1:9”, etc.
*/
function parseReference(raw, idx){
  if (!raw) return null;
  let s = strip(raw).replace(/[,;]+/g," ");
  s = s.replace(/\biii\b/g,"3").replace(/\bii\b/g,"2").replace(/\bi\b/g,"1");
  s = s.replace(/^([1-3])([a-z])/,"$1 $2"); // 1joao -> 1 joao

  const m = /^(.+?)\s+(\d+)(?:[:.](\d+)(?:-\d+)?)?$/.exec(s);
  if (!m) return null;

  const bookKey = m[1].replace(/\s+/g,"");
  const abrev   = idx?.[bookKey];
  if (!abrev) return null;

  return { abrev, chapter: m[2], verse: m[3] || null };
}

/* ===== Busca Bíblica =====
   - Referência precisa: GET /api/verses/:version/:abbrev/:chapter(/:number)
   - Texto: POST /api/verses/search
   - Fallback: bible-api.com (KJV) só p/ referência
*/
async function searchBible(q, trad) {
  const results = $("#results"); results.innerHTML = "";
  const info = $("#searchInfo"); info.textContent = "";
  const version = trad; // nvi | acf | kjv

  if (version === "nvi" || version === "acf") {
    try {
      const idx = await getBooksIndex();
      const ref = parseReference(q, idx);

      if (ref) {
        // referência direta
        const base = `https://www.abibliadigital.com.br/api/verses/${version}/${ref.abrev}/${ref.chapter}`;
        const url  = ref.verse ? `${base}/${ref.verse}` : base;
        const r = await fetch(url);
        if (r.ok) {
          const j = await r.json();
          if (j?.text) {
            render({ text:j.text, ref:`${j.book.name} ${j.chapter}:${j.number} (${version.toUpperCase()})` });
            return;
          }
          if (Array.isArray(j?.verses)) {
            j.verses.forEach(v => render({ text:v.text, ref:`${j.book.name} ${j.chapter}:${v.number} (${version.toUpperCase()})` }));
            return;
          }
        }
      }

      // busca textual
      const r2 = await fetch("https://www.abibliadigital.com.br/api/verses/search", {
        method: "POST",
        headers: { "Accept":"application/json", "Content-Type":"application/json" },
        body: JSON.stringify({ version, search: q })
      });
      if (r2.ok) {
        const j2 = await r2.json();
        if (Array.isArray(j2?.verses) && j2.verses.length) {
          j2.verses.slice(0,50).forEach(v => render({ text:v.text, ref:`${v.book.name} ${v.chapter}:${v.number} (${version.toUpperCase()})` }));
          return;
        }
      }
      info.textContent = "A busca pública pode estar limitada agora. Tentando alternativa…";
    } catch {
      info.textContent = "A busca pública pode estar limitada agora. Tentando alternativa…";
    }
  }

  // fallback KJV para referência
  if (/^[^\d]+?\s+\d+([:.]\d+)?/.test(q.trim())) {
    try {
      const rr = await fetch(`https://bible-api.com/${encodeURIComponent(q)}?translation=kjv`);
      const jj = await rr.json();
      if (Array.isArray(jj?.verses) && jj.verses.length) {
        jj.verses.forEach(v => render({ text:v.text.trim(), ref:`${v.book_name} ${v.chapter}:${v.verse} (KJV)` }));
        return;
      }
    } catch {}
  }

  results.innerHTML = `<div class="muted">Nenhum resultado. Tente outra palavra ou uma referência (ex.: João 3:16).</div>`;

  function render(v){
    const el = document.createElement("div");
    el.className = "result";
    el.innerHTML = `<div>${escapeHTML(v.text)}</div><div class="ref">${escapeHTML(v.ref)}</div>`;
    el.addEventListener("click", ()=> copyToClipboard(`${v.text} — ${v.ref}`));
    results.appendChild(el);
  }
}

/* ===== YouTube (sem API key) ===== */
function applyYouTubeEmbeds(cfg){
  const channel = (cfg.ytChannel?.trim() || "@youtube");
  const uploads = cfg.ytUploads?.trim() || "";
  const plShorts = cfg.ytShortsPL?.trim() || "";
  const plFull   = cfg.ytFullPL?.trim() || "";
  const nameForSearch = channel.replace(/^@/,"");

  $("#liveFrame").src =
    `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(channel)}&rel=0`;

  $("#shortsFrame").src = plShorts
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(plShorts)}`
    : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(nameForSearch + " shorts")}`;

  $("#fullFrame").src = plFull
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(plFull)}`
    : (uploads
        ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(uploads)}`
        : `https://www.youtube.com/embed?listType=user_uploads&list=${encodeURIComponent(nameForSearch)}`);
}

/* ===== Config ===== */
function openConfig(){
  const cfg = store.get();
  $("#ytChannel").value = cfg.ytChannel || "";
  $("#ytUploads").value = cfg.ytUploads || "";
  $("#ytShortsPL").value = cfg.ytShortsPL || "";
  $("#ytFullPL").value = cfg.ytFullPL || "";
  $("#configModal").showModal();
}
function saveConfig(){
  const cfg = store.get();
  cfg.ytChannel  = $("#ytChannel").value.trim();
  cfg.ytUploads  = $("#ytUploads").value.trim();
  cfg.ytShortsPL = $("#ytShortsPL").value.trim();
  cfg.ytFullPL   = $("#ytFullPL").value.trim();
  store.set(cfg);
  applyYouTubeEmbeds(cfg);
}

/* ===== boot ===== */
document.addEventListener("DOMContentLoaded", () => {
  $("#yy").textContent = new Date().getFullYear();
  loadVerseOfDay();

  const cfg = store.get();
  applyYouTubeEmbeds(cfg);

  $("#btnConfig").addEventListener("click", openConfig);
  $("#saveCfg").addEventListener("click", saveConfig);

  $("#searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#q").value.trim();
    if (!q) return;
    const trad = $("#trad").value;
    searchBible(q, trad);
  });
});
