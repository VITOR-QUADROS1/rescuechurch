/* ========= helpers ========= */
const $ = (q) => document.querySelector(q);
const store = {
  get() { try { return JSON.parse(localStorage.getItem("rc:cfg") || "{}"); } catch { return {}; } },
  set(cfg) { localStorage.setItem("rc:cfg", JSON.stringify(cfg)); }
};
function copyToClipboard(text){ navigator.clipboard?.writeText(text).catch(()=>{}); }
function escapeHTML(s){ return s.replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }
const strip = (s)=> s?.normalize?.("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim() || "";

/* ========= Versículo do Dia =========
   1) A Bíblia Digital (NVI) – /api/verses/nvi/random (sem token)
   2) OurManna
   3) Lista local
*/
async function loadVerseOfDay() {
  const vtext = $("#vday-text"); const vref = $("#vday-ref");

  // 1) Random em NVI (PT-BR)
  try {
    const r = await fetch("https://www.abibliadigital.com.br/api/verses/nvi/random");
    if (!r.ok) throw new Error("random nvi falhou");
    const j = await r.json();
    if (j?.text && j?.book?.name) {
      vtext.textContent = j.text.trim();
      vref.textContent  = `${j.book.name} ${j.chapter}:${j.number} — NVI`;
      $("#versiculo").addEventListener("click", () =>
        copyToClipboard(`${vtext.textContent} ${vref.textContent}`)
      );
      return;
    }
  } catch {}

  // 2) OurManna
  try {
    const r = await fetch("https://www.ourmanna.com/api/v1/get/?format=json");
    if (!r.ok) throw new Error("falha ourmanna");
    const j = await r.json();
    vtext.textContent = j.verse.details.text.trim();
    vref.textContent  = `${j.verse.details.reference} — ${j.verse.details.version}`;
    $("#versiculo").addEventListener("click", () =>
      copyToClipboard(`${vtext.textContent} ${vref.textContent}`)
    );
    return;
  } catch {}

  // 3) fallback local
  const pool = [
    {t:"Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito...", r:"João 3:16 (ARA)"},
    {t:"O Senhor é o meu pastor; nada me faltará.", r:"Salmo 23:1 (ARA)"},
    {t:"Posso todas as coisas naquele que me fortalece.", r:"Filipenses 4:13 (ARA)"},
    {t:"Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento.", r:"Provérbios 3:5 (ARA)"},
  ];
  const i = new Date().getDate() % pool.length;
  vtext.textContent = pool[i].t; vref.textContent = pool[i].r + " — (offline)";
  $("#versiculo").addEventListener("click", () =>
    copyToClipboard(`${vtext.textContent} ${vref.textContent}`)
  );
}

/* ========= Catálogo de livros (pt/en/abrev) =========
   Baixa uma vez e guarda por 7 dias no localStorage
*/
async function getBooksIndex(){
  const key = "rc:books";
  try{
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    if (cached && Date.now() - cached.ts < 7*24*60*60*1000) return cached.idx;

    const r = await fetch("https://www.abibliadigital.com.br/api/books");
    const arr = await r.json(); // 66 livros
    const idx = {}; // chave normalizada -> abrev.pt (ex.: "joao" -> "jo")
    const norm = (s)=> strip(s).replace(/\s+/g,"");

    // Variações com numerais (1, 2, 3 / i, ii, iii)
    const roman = (s)=> s.replace(/\biii\b/g,"3").replace(/\bii\b/g,"2").replace(/\bi\b/g,"1");

    arr.forEach(b=>{
      const abpt = b.abbrev?.pt || b.abbrev?.en;
      const name = norm(b.name);
      idx[name] = abpt;

      // também indexa o nome sem espaços/acentos e variações com numerais
      idx[roman(name)] = abpt;

      // indexa abreviações pt/en
      if (b.abbrev?.pt) idx[norm(b.abbrev.pt)] = abpt;
      if (b.abbrev?.en) idx[norm(b.abbrev.en)] = abpt;
    });

    localStorage.setItem(key, JSON.stringify({ts: Date.now(), idx}));
    return idx;
  }catch{
    return null;
  }
}

/* ========= Busca Bíblica =========
   - Texto: POST /api/verses/search  (sem token)
   - Referência: GET /api/verses/:version/:abbrev/:chapter(/:number)
   - Fallback: bible-api.com (KJV) apenas para referência
*/
function parseReference(raw, idx){
  // Ex.: "1 João 2:3-4", "João 3:16", "Sl 23"
  const s = strip(raw);
  const m = /^(.+?)\s+(\d+)(?:[:.](\d+)(?:-\d+)?)?$/.exec(s); // book, chapter, verse?
  if (!m) return null;

  const bookRaw = m[1].replace(/\s+/g,"");
  const bookKey = bookRaw.replace(/\biii\b/g,"3").replace(/\bii\b/g,"2").replace(/\bi\b/g,"1");
  const abrev = idx?.[bookKey];
  if (!abrev) return null;

  const chapter = m[2];
  const verse = m[3] || null;
  return { abrev, chapter, verse };
}

async function searchBible(q, trad) {
  const results = $("#results"); results.innerHTML = "";
  const info = $("#searchInfo"); info.textContent = "";
  const version = trad; // "nvi" | "acf" | "kjv"

  // 1) se NVI/ACF, tenta referência precisa
  if (version === "nvi" || version === "acf") {
    try {
      const idx = await getBooksIndex();
      const ref = parseReference(q, idx);

      if (ref) {
        // referência exata
        const base = `https://www.abibliadigital.com.br/api/verses/${version}/${ref.abrev}/${ref.chapter}`;
        const url  = ref.verse ? `${base}/${re
