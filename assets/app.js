// ======== Config do site ========
const API_BASE = "/api"; // estamos servindo pelo mesmo domínio

// Preencha seus IDs:
const YT_CHANNEL_ID = "UC11Km85MPiYbuPmG7Lz2Wjg"; // exemplo
const YT_PLAYLIST_SHORTS = "UUSH11Km85MPiYbuPmG7Lz2Wjg";    // opcional
const YT_PLAYLIST_MESSAGES = "UU11Km85MPiYbuPmG7Lz2Wjg";  // opcional

// ======== Versículo do dia ========
export async function loadVerseOfDay() {
  const box = document.querySelector("#votd-text");
  const ref = document.querySelector("#votd-ref");
  box.textContent = "Carregando...";
  try {
    const r = await fetch(`${API_BASE}/verse-of-day?lang=pt`);
    const j = await r.json();
    box.textContent = j.text || "(sem texto)";
    ref.textContent = `${j.ref || ""} — ${j.version || ""}`.trim();
  } catch (e) {
    box.textContent = "Falha ao carregar o versículo do dia.";
  }
}

// ======== Buscar na Bíblia ========
export async function searchBible(passage) {
  const out = document.querySelector("#bible-output");
  out.value = "Carregando...";
  try {
    const url = `${API_BASE}/biblia/bible/content/NVI.txt?passage=${encodeURIComponent(passage)}&lang=pt&t=${Date.now()}`;
    const r = await fetch(url);
    if (!r.ok) {
      out.value = "Nenhum resultado encontrado.";
      return;
    }
    const txt = await r.text();
    out.value = txt || "Nenhum resultado encontrado.";
  } catch (e) {
    out.value = "Erro ao consultar a Bíblia.";
  }
}

// Wire do formulário
export function wireBibleForm() {
  const form = document.querySelector("#bible-form");
  const input = document.querySelector("#bible-input");
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const q = (input.value || "").trim();
    if (!q) return;
    searchBible(q);
  });
}

// ======== YouTube ========
function renderList(el, items) {
  el.innerHTML = "";
  if (!items?.length) {
    el.innerHTML = `<div class="muted">Nenhum vídeo encontrado.</div>`;
    return;
  }
  for (const it of items) {
    const a = document.createElement("a");
    a.href = `https://www.youtube.com/watch?v=${it.id}`;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.className = "yt-item";
    a.innerHTML = `
      <img src="${it.thumb || ""}" alt="">
      <div class="meta">
        <div class="title">${it.title || "Sem título"}</div>
        <div class="date">${(it.published || "").replace("T"," ").replace("Z","")}</div>
      </div>
    `;
    el.appendChild(a);
  }
}

async function fetchYT(params) {
  const qs = new URLSearchParams(params);
  const r = await fetch(`${API_BASE}/youtube?${qs.toString()}&t=${Date.now()}`);
  return r.json();
}

export async function loadYouTube() {
  const liveBox = document.querySelector("#live-embed");
  const shortsBox = document.querySelector("#yt-shorts");
  const msgsBox = document.querySelector("#yt-messages");

  // Live
  try {
    const live = await (await fetch(`${API_BASE}/youtube/live?channel=${encodeURIComponent(YT_CHANNEL_ID)}&t=${Date.now()}`)).json();
    if (live.isLive && live.id) {
      liveBox.innerHTML = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${live.id}" frameborder="0" allowfullscreen></iframe>`;
    } else {
      // fallback: mostra último vídeo normal (canal)
      const data = await fetchYT({ channel: YT_CHANNEL_ID });
      const id = data.items?.[0]?.id;
      liveBox.innerHTML = id ? `<iframe width="560" height="315" src="https://www.youtube.com/embed/${id}" frameborder="0" allowfullscreen></iframe>` : `<div class="muted">Sem live no momento.</div>`;
    }
  } catch {
    liveBox.innerHTML = `<div class="muted">Não foi possível carregar o player.</div>`;
  }

  // Shorts e Mensagens
  try {
    const shorts = YT_PLAYLIST_SHORTS ? await fetchYT({ playlist: YT_PLAYLIST_SHORTS }) : await fetchYT({ channel: YT_CHANNEL_ID });
    renderList(shortsBox, shorts.items || []);
  } catch {
    shortsBox.innerHTML = `<div class="muted">Falha ao carregar a lista de vídeos.</div>`;
  }

  try {
    const msgs = YT_PLAYLIST_MESSAGES ? await fetchYT({ playlist: YT_PLAYLIST_MESSAGES }) : await fetchYT({ channel: YT_CHANNEL_ID });
    renderList(msgsBox, msgs.items || []);
  } catch {
    msgsBox.innerHTML = `<div class="muted">Falha ao carregar a lista de vídeos.</div>`;
  }
}

// ======== Init ========
export function initRescue() {
  wireBibleForm();
  loadVerseOfDay();
  loadYouTube();
}
document.addEventListener("DOMContentLoaded", initRescue);
