/* ====== helpers ====== */
const $ = (q) => document.querySelector(q);
const store = {
  get() { try { return JSON.parse(localStorage.getItem("rc:cfg") || "{}"); } catch { return {}; } },
  set(cfg) { localStorage.setItem("rc:cfg", JSON.stringify(cfg)); }
};
function copyToClipboard(text){ navigator.clipboard?.writeText(text).catch(()=>{}); }
function escapeHTML(s){ return s.replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }

/* ====== Versículo do dia (OurManna → fallback local) ====== */
async function loadVerseOfDay() {
  const vtext = $("#vday-text"); const vref = $("#vday-ref");
  try {
    const r = await fetch("https://www.ourmanna.com/api/v1/get/?format=json");
    if (!r.ok) throw new Error("falha ourmanna");
    const j = await r.json();
    vtext.textContent = j.verse.details.text.trim();
    vref.textContent  = `${j.verse.details.reference} — ${j.verse.details.version}`;
  } catch {
    const pool = [
      {t:"Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito...", r:"João 3:16 (ARA)"},
      {t:"O Senhor é o meu pastor; nada me faltará.", r:"Salmo 23:1 (ARA)"},
      {t:"Posso todas as coisas naquele que me fortalece.", r:"Filipenses 4:13 (ARA)"},
      {t:"Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento.", r:"Provérbios 3:5 (ARA)"},
    ];
    const i = new Date().getDate() % pool.length;
    vtext.textContent = pool[i].t; vref.textContent = pool[i].r + " — (offline)";
  }
  $("#versiculo").addEventListener("click", () => {
    copyToClipboard(`${vtext.textContent} ${vref.textContent}`);
  });
}

/* ====== Busca Bíblica ======
   Agora usando A Bíblia Digital SEM token (PT-BR).
   - Referências (João 3:16): /api/verses/{version}/{ref}
   - Busca textual: /api/verses/search?version={version}&search={q}
   Se a API pública recusar/limitar, caímos no fallback KJV (bible-api.com).
*/
function isReference(q){
  // aceita: "João 3:16", "joao 3:16-18", "sl 23", "gn 1:1"
  const s = q.trim().toLowerCase();
  return /^[^\s]+\s*\d+([:.]\d+(-\d+)?)?$/.test(s) || /^[a-zçãé]+?\s*\d+$/.test(s);
}

async function searchBible(q, trad) {
  const results = $("#results"); results.innerHTML = "";
  const info = $("#searchInfo"); info.textContent = "";

  const refLike = isReference(q);
  const v = trad; // "nvi" | "acf" | "kjv"

  // Normaliza algumas abreviações comuns PT-BR p/ referência
  function normalizeRefPT(s){
    return s
      .replace(/^sl\b/i, "sl")   // Salmos -> sl
      .replace(/^gn\b/i, "gn")   // Gênesis -> gn
      .replace(/^jo\b/i, "jo")   // João -> jo (abbrev da API)
      .trim();
  }

  try {
    if ((v === "nvi" || v === "acf")) {
      if (refLike) {
        const ref = encodeURIComponent(normalizeRefPT(q));
        const r = await fetch(`https://www.abibliadigital.com.br/api/verses/${v}/${ref}`);
        if (r.ok) {
          const j = await r.json();
          if (j?.text) {
            renderItem({ text: j.text, ref: `${j.book.name} ${j.chapter}:${j.number} (${v.toUpperCase()})` });
          } else if (Array.isArray(j?.verses)) {
            j.verses.forEach(x => renderItem({ text: x.text, ref: `${(j.book?.name || x.book?.name)} ${x.chapter}:${x.number} (${v.toUpperCase()})` }));
          } else {
            results.innerHTML = `<div class="muted">Não encontrado.</div>`;
          }
          return;
        }
        // se caiu aqui, vamos tentar fallback KJV
      } else {
        const r = await fetch(`https://www.abibliadigital.com.br/api/verses/search?version=${v}&search=${encodeURIComponent(q)}`);
        if (r.ok) {
          const j = await r.json();
          if (Array.isArray(j?.verses) && j.verses.length) {
            j.verses.slice(0, 50).forEach(x =>
              renderItem({ text: x.text, ref: `${x.book.name} ${x.chapter}:${x.number} (${v.toUpperCase()})` })
            );
            return;
          } else {
            results.innerHTML = `<div class="muted">Nenhum resultado.</div>`;
            return;
          }
        }
        // se a API pública recusar/limitar, cai no fallback KJV abaixo
        info.innerHTML = "A API pública pode ter limitado as requisições no momento. Mostrando resultados em KJV (inglês).";
      }
    }

    // ===== Fallback KJV (bible-api.com) =====
    if (refLike) {
      const r = await fetch(`https://bible-api.com/${encodeURIComponent(q)}?translation=kjv`);
      const j = await r.json();
      if (Array.isArray(j?.verses)) {
        j.verses.forEach(vv => renderItem({ text: vv.text.trim(), ref: `${vv.book_name} ${vv.chapter}:${vv.verse} (KJV)` }));
      } else {
        results.innerHTML = `<div class="muted">Não encontrado.</div>`;
      }
    } else {
      results.innerHTML = `<div class="muted">Para busca textual em português, tente novamente mais tarde ou use uma referência (ex.: João 3:16).</div>`;
    }
  } catch (e) {
    console.error(e);
    results.innerHTML = `<div class="muted">Erro ao buscar. Tente novamente.</div>`;
  }

  function renderItem(v){
    const el = document.createElement("div");
    el.className = "result";
    el.innerHTML = `<div>${escapeHTML(v.text)}</div><div class="ref">${escapeHTML(v.ref)}</div>`;
    el.addEventListener("click", ()=> copyToClipboard(`${v.text} — ${v.ref}`));
    results.appendChild(el);
  }
}

/* ====== YouTube (sem API key; apenas iframes) ====== */
function applyYouTubeEmbeds(cfg){
  const channel = cfg.ytChannel?.trim() || "@youtube";
  const uploads = cfg.ytUploads?.trim() || "";
  $("#liveFrame").src = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(channel)}&rel=0`;
  $("#playlistFrame").src = uploads
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(uploads)}`
    : `https://www.youtube.com/embed?listType=user_uploads&list=${encodeURIComponent(channel.replace(/^@/,""))}`;
}

/* ====== Config (apenas YouTube agora) ====== */
function openConfig(){
  const cfg = store.get();
  $("#ytChannel").value   = cfg.ytChannel   || "";
  $("#ytUploads").value   = cfg.ytUploads   || "";
  $("#configModal").showModal();
}
function saveConfig(){
  const cfg = store.get();
  cfg.ytChannel = $("#ytChannel").value.trim();
  cfg.ytUploads = $("#ytUploads").value.trim();
  store.set(cfg);
  applyYouTubeEmbeds(cfg);
}

/* ====== boot ====== */
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
