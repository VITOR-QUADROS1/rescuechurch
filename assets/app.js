// --- helpers ---
const $ = (q) => document.querySelector(q);

// --- Versículo do dia ---
async function loadVerseOfDay() {
  const box = $("#vday-text");
  const refEl = $("#vday-ref");
  if (!box || !refEl) return;

  box.textContent = "(carregando...)";
  refEl.textContent = "";

  try {
    const r = await fetch("/api/verse-of-day");
    if (!r.ok) throw new Error("A API falhou.");
    
    const j = await r.json();
    box.textContent = j.text || "(erro ao carregar)";
    refEl.textContent = `(${j.ref} — ${j.version})`;

  } catch (e) {
    console.error("Erro em loadVerseOfDay:", e);
    box.textContent = "(erro ao carregar)";
  }
}

// --- Busca na Bíblia ---
async function searchBible() {
  const input = $("#biblia-q");
  const result = $("#biblia-out");
  if (!input || !result) return;
  
  result.value = "(buscando...)";
  const ref = (input.value || "").trim();
  if (!ref) { result.value = ""; return; }

  try {
    const url = `/biblia/bible/content/NVI.txt?passage=${encodeURIComponent(ref)}`;
    const r = await fetch(url);
    const txt = await r.text();

    if (!r.ok) {
        result.value = txt || "Nenhum resultado encontrado.";
    } else {
        result.value = txt;
    }
  } catch (e) {
    console.error("Erro em searchBible:", e);
    result.value = "Erro ao consultar a Bíblia.";
  }
}

// --- Vídeos do YouTube ---
function createYtUrl(id) {
    return `https://www.youtube.com/embed/${id}?autoplay=0&rel=0`;
}

async function loadLiveOrLatest(cfg) {
    const frame = $("#liveFrame");
    if (!frame || !cfg.channelId) return;

    try {
        const r = await fetch(`/api/youtube/live?channel=${cfg.channelId}`);
        const live = await r.json();
        if (live && live.isLive && live.id) {
            frame.src = createYtUrl(live.id);
            return;
        }
    } catch {}

    try {
        const r = await fetch(`/api/youtube?channel=${cfg.channelId}`);
        const latest = await r.json();
        const videoId = latest?.items?.[0]?.id;
        if (videoId) {
            frame.src = createYtUrl(videoId);
        }
    } catch (e) {
        console.error("Erro ao carregar vídeo principal:", e);
    }
}

async function fillPlaylist(playlistId, selector) {
    const container = $(selector);
    if (!container || !playlistId) return;
    
    try {
        const r = await fetch(`/api/youtube?playlist=${playlistId}`);
        const data = await r.json();
        container.innerHTML = ""; // Limpa antes de preencher

        for (const item of data.items) {
            const a = document.createElement("a");
            a.href = `https://www.youtube.com/watch?v=${item.id}`;
            a.target = "_blank";
            a.rel = "noopener";
            a.className = "hitem";
            a.innerHTML = `
                <img class="hthumb" src="${item.thumb}" alt="Thumbnail">
                <div class="hmeta">
                    <span class="t">${item.title}</span>
                    <span class="s">${new Date(item.published).toLocaleDateString('pt-BR')}</span>
                </div>
            `;
            container.appendChild(a);
        }
    } catch (e) {
        console.error(`Erro ao preencher playlist ${selector}:`, e);
        container.innerHTML = "<p class='muted'>Não foi possível carregar os vídeos.</p>";
    }
}


// --- Inicialização ---
function boot() {
  // Configurações (embutidas para simplicidade)
  const config = {
      youtube: {
          channelId: 'UC11Km85MPiYbuPmG7Lz2Wjg',
          shortsPlaylistId: 'UUSH11Km85MPiYbuPmG7Lz2Wjg',
          fullPlaylistId: 'UU11Km85MPiYbuPmG7Lz2Wjg'
      }
  };

  // Eventos de busca
  $("#btn-buscar")?.addEventListener("click", searchBible);
  $("#biblia-q")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchBible();
  });

  // Botão de copiar
  $("#btn-copy")?.addEventListener("click", () => {
      const text = $("#vday-text")?.textContent || "";
      navigator.clipboard.writeText(text.trim());
  });
  
  // Ano no rodapé
  $("#yy").textContent = new Date().getFullYear();

  // Carrega dados dinâmicos
  loadVerseOfDay();
  loadLiveOrLatest(config.youtube);
  fillPlaylist(config.youtube.shortsPlaylistId, "#shorts");
  fillPlaylist(config.youtube.fullPlaylistId, "#fulls");
}

document.addEventListener("DOMContentLoaded", boot);
