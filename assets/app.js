/* ====== util ====== */
const $ = (q) => document.querySelector(q);
const $$ = (q) => document.querySelectorAll(q);
const store = {
  get() {
    try { return JSON.parse(localStorage.getItem("rc:cfg") || "{}"); } catch { return {}; }
  },
  set(cfg) { localStorage.setItem("rc:cfg", JSON.stringify(cfg)); }
};

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).catch(()=>{});
}

/* ====== Versículo do dia ======
   1) tenta OurManna (sem chave)
   2) se falhar, escolhe um de uma pequena lista local (PT-BR)
*/
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
   - Preferência: PT-BR via A Bíblia Digital (requer token Bearer).
   - Fallback: bible-api.com (KJV em inglês).
*/
async function searchBible(q, trad, token) {
  const results = $("#results"); results.innerHTML = "";
  const info = $("#searchInfo");
  const isRef = /^[^\s]+\s*\d+[:.]\d+(-\d+)?$/i.test(q.trim()); // "João 3:16" etc.

  if ((trad === "nvi" || trad === "acf") && !token) {
    info.innerHTML = "Para PT-BR, informe um token da <a href='https://www.abibliadigital.com.br/' target='_blank' rel='noopener'>A Bíblia Digital</a> em ⚙️ Configurações. Usaremos KJV (inglês) como alternativa.";
    trad = "kjv";
  } else {
    info.textContent = "";
  }

  try {
    if ((trad === "nvi" || trad === "acf") && token) {
      // A Bíblia Digital – documentação: https://www.abibliadigital.com.br/
      // 1) referência direta (ex.: João 3:16)
      if (isRef) {
        const ref = encodeURIComponent(q.trim());
        const r = await fetch(`https://www.abibliadigital.com.br/api/verses/${trad}/${ref}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const j = await r.json();
        if (j?.text) renderItem({ text: j.text, ref: `${j.book.name} ${j.chapter}:${j.number} (${trad.toUpperCase()})` });
        else if (Array.isArray(j?.verses)) {
          j.verses.forEach(v => renderItem({ text: v.text, ref: `${j.book?.name || v.book?.name} ${v.chapter}:${v.number} (${trad.toUpperCase()})` }));
        } else throw new Error("sem resultado");
      } else {
        // 2) busca textual
        const r = await fetch(`https://www.abibliadigital.com.br/api/verses/search?version=${trad}&search=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const j = await r.json();
        (j?.verses || []).slice(0, 50).forEach(v =>
          renderItem({ text: v.text, ref: `${v.book.name} ${v.chapter}:${v.number} (${trad.toUpperCase()})` })
        );
        if (!j?.verses?.length) results.innerHTML = `<div class="muted">Nenhum resultado.</div>`;
      }
      return;
    }

    // Fallback: bible-api.com (KJV)
    if (isRef) {
      const r = await fetch(`https://bible-api.com/${encodeURIComponent(q)}?translation=kjv`);
      const j = await r.json();
      if (Array.isArray(j?.verses)) {
        j.verses.forEach(v => renderItem({ text: v.text.trim(), ref: `${v.book_name} ${v.chapter}:${v.verse} (KJV)` }));
      } else {
        results.innerHTML = `<div class="muted">Não encontrado.</div>`;
      }
    } else {
      results.innerHTML = `<div class="muted">Para a busca em PT-BR sem token, digite uma referência (ex.: João 3:16) ou cadastre o token nas configurações.</div>`;
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

function escapeHTML(s){ return s.replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])) }

/* ====== YouTube ======
   Sem API key: usamos iframes.
   - Live: https://www.youtube.com/embed/live_stream?channel=CHANNEL_ID
           ou ...?channel=@handle (YouTube já aceita handle)
   - Playlist de uploads: https://www.youtube.com/embed/videoseries?list=UU...
*/
function applyYouTubeEmbeds(cfg){
  const channel = cfg.ytChannel?.trim() || "@youtube";
  const uploads = cfg.ytUploads?.trim() || "";
  $("#liveFrame").src = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(channel)}&rel=0`;
  $("#playlistFrame").src = uploads
    ? `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(uploads)}`
    : `https://www.youtube.com/embed?listType=user_uploads&list=${encodeURIComponent(channel.replace(/^@/,""))}`;
}

/* ====== Config modal ====== */
function openConfig(){
  const cfg = store.get();
  $("#bibliaToken").value = cfg.bibliaToken || "";
  $("#ytChannel").value   = cfg.ytChannel   || "";
  $("#ytUploads").value   = cfg.ytUploads   || "";
  $("#configModal").showModal();
}
function saveConfig(){
  const cfg = store.get();
  cfg.bibliaToken = $("#bibliaToken").value.trim();
  cfg.ytChannel   = $("#ytChannel").value.trim();
  cfg.ytUploads   = $("#ytUploads").value.trim();
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
    const token = (store.get().bibliaToken || "").trim();
    searchBible(q, trad, token);
  });
});
