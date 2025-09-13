// helpers
const $  = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

const CFG = {
  yt: {
    // IDs do seu canal (descobertos no DevTools)
    channelId: 'UC11Km85MPiYbuPmG7Lz2Wjg',
    fullPlaylistId: 'UU11Km85MPiYbuPmG7Lz2Wjg',
    shortsPlaylistId: 'UUSH11Km85MPiYbuPmG7Lz2Wjg',
  }
};

function isLikelyEnglish(s) {
  if (!s) return false;
  const hasAccents = /[áéíóúãõâêôçÁÉÍÓÚÃÕÂÊÔÇ]/.test(s);
  if (hasAccents) return false;
  const englishHits = (s.match(/\b(the|and|will|shall|because|but|world|son|god|him|for|so|loved)\b/gi) || []).length;
  const portugueseHits = (s.match(/\b(de|do|da|que|porque|mas|Deus|mundo|filho|Senhor)\b/gi) || []).length;
  return englishHits >= 2 && portugueseHits < 2;
}

async function translateToPT(text) {
  try {
    const url = `/api/translate?q=${encodeURIComponent(text)}&from=en&to=pt-BR`;
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    return j.text || text;
  } catch {
    return text;
  }
}

/* ================= Versículo do dia ================ */
async function loadVerseOfDay() {
  const box  = $("#vday-text");
  const refEl = $("#vday-ref");
  box.textContent = "Carregando...";
  refEl.textContent = "";

  try {
    const r = await fetch("/api/verse-of-day");
    const j = await r.json();

    let txt = j.text || "";

    // fallback: se o worker não trouxe o texto, busca pela rota PT
    if (!txt && j.ref) {
      const r2 = await fetch(`/biblia/bible/content/NVI.txt?passage=${encodeURIComponent(j.ref)}`);
      if (r2.ok) txt = await r2.text();
    }

    if (isLikelyEnglish(txt)) {
      txt = await translateToPT(txt);
    }

    if (txt) {
      box.textContent = txt;
      refEl.textContent = `(${j.ref} — ${j.version})`;
    } else {
      box.textContent = "(erro ao carregar)";
      if (j?.ref) refEl.textContent = `(${j.ref} — ${j.version})`;
    }
  } catch {
    box.textContent = "(erro ao carregar)";
  }
}

/* ================= Busca na Bíblia ================= */
async function searchBible() {
  const input = $("#biblia-q");
  const result = $("#biblia-out");
  const ref = (input.value || "").trim();
  if (!ref) { result.value = ""; return; }

  result.value = "(buscando...)";
  try {
    // o worker ignora o nome do arquivo, então usamos sempre NVI.txt
    const url = `/biblia/bible/content/NVI.txt?passage=${encodeURIComponent(ref)}`;
    const r = await fetch(url);
    let txt = await r.text();

    if (!r.ok || !txt) {
      result.value = "Nenhum resultado encontrado.";
      return;
    }

    if (isLikelyEnglish(txt)) {
      txt = await translateToPT(txt);
    }

    result.value = txt;
  } catch {
    result.value = "Erro ao consultar a Bíblia.";
  }
}

/* =================== YouTube =================== */
function ytEmbed(id) {
  return `https://www.youtube.com/embed/${id}?autoplay=0&rel=0`;
}

async function loadLiveOrLatest() {
  const frame = $("#liveFrame");
  try {
    // 1) Tenta live
    const live = await fetch(`/api/youtube/live?channel=${CFG.yt.channelId}`).then(r => r.json());
    if (live?.isLive && live?.id) {
      frame.src = ytEmbed(live.id);
      return;
    }
    // 2) Pega o mais recente do canal
    const latest = await fetch(`/api/youtube?channel=${CFG.yt.channelId}`).then(r => r.json());
    const id = latest?.items?.[0]?.id;
    if (id) frame.src = ytEmbed(id);
  } catch {
    // fica sem vídeo, mas não quebra a página
  }
}

async function fillPlaylist(playlistId, containerSel) {
  const box = $(containerSel);
  box.innerHTML = "";
  try {
    const data = await fetch(`/api/youtube?playlist=${playlistId}`).then(r => r.json());
    for (const it of (data.items || [])) {
      const a = document.createElement("a");
      a.href = `https://www.youtube.com/watch?v=${it.id}`;
      a.target = "_blank";
      a.rel = "noopener";
      a.className = "hitem";
      a.innerHTML = `
        <img class="hthumb" src="${it.thumb}" alt="">
        <div class="hmeta">
          <span class="t">${it.title || ""}</span>
          <span class="s">${(it.published || "").replace("T"," ").replace("Z","")}</span>
        </div>`;
      box.appendChild(a);
    }
  } catch {
    // silencioso
  }
}

/* =================== binds =================== */
function setupCopy() {
  const btn = $("#btn-copy");
  const box = $("#vday-text");
  btn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText((box.textContent || "").trim());
      btn.textContent = "Copiado ✅";
      setTimeout(() => (btn.textContent = "Copiar 📋"), 1500);
    } catch {}
  });
}

function boot() {
  $("#yy").textContent = new Date().getFullYear();

  $("#btn-buscar")?.addEventListener("click", searchBible);
  $("#biblia-q")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchBible();
  });

  setupCopy();
  loadVerseOfDay();
  loadLiveOrLatest();
  fillPlaylist(CFG.yt.shortsPlaylistId, "#shorts");
  fillPlaylist(CFG.yt.fullPlaylistId,   "#fulls");
}

document.addEventListener("DOMContentLoaded", boot);
