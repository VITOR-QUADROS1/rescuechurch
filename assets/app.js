/* globals window, document, fetch, localStorage */
(async () => {
  // ---- carrega config com fallback
  let CFG = {};
  try {
    CFG = await (await fetch('assets/config.json', {cache:'no-store'})).json();
  } catch (e) {
    console.error('config.json não carregado', e);
    CFG = {};
  }

  // --------- helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const proxyBase = (CFG.proxy?.useWorker && CFG.proxy?.workerBase) ?
    CFG.proxy.workerBase.replace(/\/+$/, '') : '';

  const bibliaVerMap = CFG.biblia?.versionMap || {
    'NVI (pt-BR)': 'POR-NVI',
    'ARA (pt-BR)': 'POR-ARA',
    'NTLH (pt-BR)': 'POR-NTLH'
  };
  const defaultVerLabel = CFG.biblia?.defaultVersion || 'NVI (pt-BR)';
  const defaultVerCode  = bibliaVerMap[defaultVerLabel] || 'POR-NVI';

  // ---------- HERO (imagem cobrindo)
  const hero = $('.hero');
  if (hero) {
    hero.style.setProperty('--hero-url', `url('assets/logo.png')`);
  }

  // ---------- UI: popular combo versões
  const verSel = $('#versionSelect');
  if (verSel) {
    verSel.innerHTML = '';
    Object.entries(bibliaVerMap).forEach(([label, code]) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = label;
      if (label === defaultVerLabel) opt.selected = true;
      verSel.appendChild(opt);
    });
  }

  // ---------- Copiar versículo
  $('#copyVerseBtn')?.addEventListener('click', () => {
    const txt = $('#verseText')?.textContent?.trim() || '';
    if (!txt) return;
    navigator.clipboard.writeText(txt).then(() => {
      const btn = $('#copyVerseBtn');
      const old = btn.textContent;
      btn.textContent = 'Copiado!';
      setTimeout(() => (btn.textContent = old), 1200);
    });
  });

  // ---------- Versículo do dia (worker -> /api/verse-of-day?ver=POR-NVI)
  async function loadVerseOfDay() {
    const ver = verSel?.value || defaultVerCode;
    const url = `${proxyBase}/api/verse-of-day?ver=${encodeURIComponent(ver)}`;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { ref } = await r.json();             // ex.: "João 3:16"
      $('#verseText').textContent = ref || '—';
    } catch (e) {
      console.warn('Falha versículo do dia', e);
      $('#verseText').textContent = 'Não foi possível carregar agora.';
    }
  }

  // ---------- Busca na Bíblia (worker -> /biblia/bible/content/{ver}.txt?passage=...)
  function parseRef(raw) {
    if (!raw || !raw.trim()) return null;
    return raw.trim().replace(/\s+/g, ' ');
  }

  async function doSearch() {
    const input = $('#bibleQuery');
    const out = $('#bibleResult');
    out.textContent = '';
    const ref = parseRef(input?.value || '');
    if (!ref) {
      out.textContent = 'Informe uma referência (ex.: João 3:16 ou Salmos 23).';
      return;
    }
    const ver = verSel?.value || defaultVerCode;
    const url = `${proxyBase}/biblia/bible/content/${encodeURIComponent(ver)}.txt?passage=${encodeURIComponent(ref)}`;
    try {
      const r = await fetch(url, { headers: { 'Accept': 'text/plain' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const txt = (await r.text() || '').trim();
      out.textContent = txt || 'Nenhum resultado agora. Tente outra referência.';
    } catch (e) {
      console.warn('Falha na busca', e);
      out.textContent = 'Nenhum resultado agora. Tente outra referência.';
    }
  }

  $('#searchBtn')?.addEventListener('click', doSearch);
  $('#bibleQuery')?.addEventListener('keydown', e => (e.key === 'Enter') && doSearch());

  // ---------- YouTube
  const YT = CFG.youtube || {};
  const channelId = YT.channelId || '';
  const uploadsId = channelId ? ('UU' + channelId.slice(2)) : ''; // regra do YouTube

  async function fetchFeed(kind, id) {
    // worker tem:
    //  - /api/youtube?uploads={UU...}
    //  - /api/youtube?playlist={PL...}
    const p = new URLSearchParams();
    p.set(kind, id);
    const url = `${proxyBase}/api/youtube?${p.toString()}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`yt ${kind} ${r.status}`);
    return r.json(); // [{id,title,thumb,published,seconds,isShort}]
  }

  // último vídeo/live (se não live, pega o mais recente)
  async function renderLive() {
    if (!uploadsId) return;
    try {
      const items = await fetchFeed('uploads', uploadsId);
      const first = items[0];
      if (!first) return;
      $('#liveFrame').src = `https://www.youtube.com/embed/${first.id}?rel=0`;
    } catch (e) {
      console.warn('YT live/latest', e);
    }
  }

  function makeRail(container, items) {
    container.innerHTML = '';
    items.forEach(v => {
      const card = document.createElement('a');
      card.className = 'yt-card';
      card.href = `https://www.youtube.com/watch?v=${v.id}`;
      card.target = '_blank';
      card.rel = 'noopener';
      card.innerHTML = `
        <div class="thumb" style="background-image:url('${v.thumb}')"></div>
        <div class="yt-title" title="${v.title.replace(/"/g,'&quot;')}">${v.title}</div>
      `;
      container.appendChild(card);
    });
  }

  async function renderShorts() {
    const rail = $('#shortsRail');
    if (!uploadsId || !rail) return;
    try {
      let items;
      if (YT.shortsPlaylist && YT.shortsPlaylist.startsWith('PL')) {
        items = await fetchFeed('playlist', YT.shortsPlaylist);
      } else {
        items = await fetchFeed('uploads', uploadsId);
        items = items.filter(v => v.isShort || v.seconds <= 61);
      }
      makeRail(rail, items.slice(0, 12));
    } catch (e) {
      console.warn('YT shorts', e);
    }
  }

  async function renderFull() {
    const rail = $('#fullRail');
    if (!uploadsId || !rail) return;
    try {
      let items;
      if (YT.fullPlaylist && YT.fullPlaylist.startsWith('PL')) {
        items = await fetchFeed('playlist', YT.fullPlaylist);
      } else {
        items = await fetchFeed('uploads', uploadsId);
        items = items.filter(v => !v.isShort && v.seconds >= 1200); // >= 20 min = "completo"
      }
      makeRail(rail, items.slice(0, 12));
    } catch (e) {
      console.warn('YT full', e);
    }
  }

  // dispara
  await loadVerseOfDay();
  await renderLive();
  await renderShorts();
  await renderFull();
})();
