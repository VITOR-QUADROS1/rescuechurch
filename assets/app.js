(async () => {
  const ui = {
    year: document.getElementById('year'),
    dailyVerse: document.getElementById('dailyVerse'),
    dailyRef: document.getElementById('dailyRef'),
    dailyHint: document.getElementById('dailyHint'),
    copy: document.getElementById('copyVerse'),
    searchForm: document.getElementById('searchForm'),
    searchInput: document.getElementById('searchInput'),
    versionSelect: document.getElementById('versionSelect'),
    result: document.getElementById('result'),
    liveFrame: document.getElementById('liveFrame'),
    shortsFrame: document.getElementById('shortsFrame'),
    fullFrame: document.getElementById('fullFrame'),
  };

  ui.year.textContent = new Date().getFullYear();

  // Carrega config
  const config = await fetch('assets/config.json').then(r => r.json());

  // Monta opções de versão
  const entries = Object.entries(config.biblia.versions);
  const defaultLabel = config.biblia.defaultVersion;
  for (const [label] of entries) {
    const opt = document.createElement('option');
    opt.value = label;
    opt.textContent = label;
    if (label === defaultLabel) opt.selected = true;
    ui.versionSelect.appendChild(opt);
  }

  // YouTube embeds
  if (config.youtube?.channelId) {
    ui.liveFrame.src = `https://www.youtube.com/embed/live_stream?channel=${config.youtube.channelId}`;
  }
  if (config.youtube?.shortsPlaylist) {
    ui.shortsFrame.src = `https://www.youtube.com/embed/videoseries?list=${config.youtube.shortsPlaylist}`;
  }
  if (config.youtube?.fullPlaylist) {
    ui.fullFrame.src = `https://www.youtube.com/embed/videoseries?list=${config.youtube.fullPlaylist}`;
  }

  // --------- Biblia.com Helpers ----------
  const bibliaBase = config.proxy?.useWorker ? config.proxy.workerBase : config.biblia.apiBase;
  const apiKeyParam = config.proxy?.useWorker ? '' : `&key=${encodeURIComponent(config.biblia.apiKey)}`;

  function bibleIdByLabel(label) {
    return config.biblia.versions[label] || config.biblia.versions[defaultLabel];
  }

  async function fetchPassage(ref, labelVersion) {
    const bibleId = bibleIdByLabel(labelVersion);
    // content endpoint — texto limpo, um versículo por linha
    const url = `${bibliaBase}/bible/content/${bibleId}.json?passage=${encodeURIComponent(ref)}&style=oneVersePerLine&red-letter=false&footnotes=false&formatting=plain${apiKeyParam}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Falha ao buscar passagem');
    const data = await r.json();
    // campos usuais: data.text, data.canonical, data.citation
    return {
      text: data.text?.trim() || '',
      ref: data.citation || data.canonical || ref
    };
  }

  async function searchWord(query, labelVersion) {
    const bibleId = bibleIdByLabel(labelVersion);
    const url = `${bibliaBase}/bible/search/${bibleId}.json?query=${encodeURIComponent(query)}&mode=verse${apiKeyParam}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Falha na busca');
    const data = await r.json();
    // Pega o primeiro resultado de versículo
    const first = data.results?.[0];
    if (!first) return null;
    // geralmente first.reference ou first.title tem “João 3:16”
    const ref = first.reference || first.title || first.verse || first.citation;
    if (!ref) return null;
    return await fetchPassage(ref, labelVersion);
  }

  // ---------- Versículo do dia ----------
  // Lista enxuta (pode crescer até 365 refs)
  const DAILY_REFS = [
    "Salmos 23:1", "Provérbios 3:5", "Isaías 41:10", "Jeremias 29:11",
    "Mateus 6:33", "Mateus 11:28", "João 3:16", "João 14:6",
    "Romanos 8:28", "Filipenses 4:6", "Filipenses 4:13", "1 Pedro 5:7",
    "Hebreus 11:1", "Salmos 121:1-2", "Salmos 91:1-2", "Romanos 12:2",
    "Tiago 1:5", "Salmos 46:1", "João 10:10", "Efésios 2:8-9",
    "Gênesis 1:1", "Mateus 5:9", "Salmos 37:5", "Isaías 53:5"
  ];

  function dayOfYear(d = new Date()) {
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d - start;
    return Math.floor(diff / 86400000);
  }

  async function loadDaily() {
    try {
      const idx = dayOfYear() % DAILY_REFS.length;
      const ref = DAILY_REFS[idx];
      const pass = await fetchPassage(ref, ui.versionSelect.value);
      ui.dailyVerse.textContent = pass.text || '(sem texto)';
      ui.dailyRef.textContent = pass.ref || ref;
      ui.dailyHint.textContent = '';
    } catch (e) {
      ui.dailyVerse.textContent = 'Não foi possível carregar agora.';
      ui.dailyRef.textContent = '';
      ui.dailyHint.textContent = 'Tente novamente em instantes.';
      console.error(e);
    }
  }

  ui.copy.addEventListener('click', async () => {
    try {
      const full = `${ui.dailyRef.textContent} — ${ui.dailyVerse.textContent}`;
      await navigator.clipboard.writeText(full.trim());
      ui.copy.textContent = 'Copiado ✔️';
      setTimeout(() => ui.copy.textContent = 'Copiar 📋', 1800);
    } catch {}
  });

  await loadDaily();

  // ---------- Busca ----------
  ui.searchForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    ui.result.innerHTML = '';
    const q = ui.searchInput.value.trim();
    if (!q) return;

    const labelVersion = ui.versionSelect.value;

    // referência? (algo com número e dois pontos)
    const isRef = /\d+:\d+/.test(q);

    try {
      const data = isRef
        ? await fetchPassage(q, labelVersion)
        : await searchWord(q, labelVersion);

      if (!data) {
        ui.result.innerHTML = `<div class="head">Nenhum resultado agora. Tente outra palavra ou referência (ex.: João 3:16).</div>`;
        return;
      }
      ui.result.innerHTML = `
        <div class="head">${data.ref || ''}</div>
        <div class="text">${(data.text || '').replace(/\n/g,'<br/>')}</div>
      `;
    } catch (e) {
      ui.result.innerHTML = `<div class="head">Falha ao consultar. Verifique a referência ou tente de novo.</div>`;
      console.error(e);
    }
  });

})();
