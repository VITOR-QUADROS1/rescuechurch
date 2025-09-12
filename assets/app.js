// app.js — front com auto-tradução para PT
(async () => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---- Carrega config ----
  const cfg = await fetch('assets/config.json').then(r => r.json());

  const WORKER = cfg.proxy.workerBase.replace(/\/+$/, '');
  const VER_DEFAULT = cfg.biblia?.defaultVersion || 'LEB';

  // ---- UI refs ----
  const elVText = $('#vday-text');
  const elVRef  = $('#vday-ref');
  const elCopy  = $('#btn-copy');
  const elQ     = $('#biblia-q');
  const elVer   = $('#biblia-ver');
  const elBtn   = $('#btn-buscar');
  const elOut   = $('#biblia-out');
  $('#yy').textContent = new Date().getFullYear();

  // ---- Preenche versões (apenas visual; o worker ignora) ----
  if (cfg.biblia?.versions) {
    elVer.innerHTML = '';
    for (const [label, val] of Object.entries(cfg.biblia.versions)) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      if (val === VER_DEFAULT) opt.selected = true;
      elVer.appendChild(opt);
    }
  }

  // ---------------- Tradução (cliente) ----------------
  const trCfg = cfg.translate || {};
  const shouldAutoTranslate = !!trCfg.auto;

  // heurística simples de “parece inglês?”
  function looksEnglish(txt) {
    if (!txt) return false;
    const sample = txt.toLowerCase();
    const hits = (sample.match(/\b(the|and|you|he|she|shall|lord|god|for|with|of|in)\b/g) || []).length;
    const hasDiacritics = /[áéíóúâêôãõç]/i.test(sample);
    return hits >= 2 && !hasDiacritics; // palpite forte de EN
  }

  async function translateToPT(text) {
    if (!text || !shouldAutoTranslate) return text;

    if (trCfg.provider === 'deepl' && trCfg.deepl?.apiKey) {
      try {
        const r = await fetch('https://api-free.deepl.com/v2/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `DeepL-Auth-Key ${trCfg.deepl.apiKey}`
          },
          body: new URLSearchParams({ text, target_lang: 'PT-BR' })
        });
        if (r.ok) {
          const j = await r.json();
          const out = j?.translations?.[0]?.text;
          if (out) return out;
        }
      } catch {}
    }

    // LibreTranslate (default)
    const base = trCfg.libre?.base || 'https://libretranslate.com';
    try {
      const r = await fetch(`${base}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text, source: 'en', target: 'pt', format: 'text',
          api_key: trCfg.libre?.apiKey || undefined
        })
      });
      if (r.ok) {
        const j = await r.json();
        const out = j?.translatedText || j?.translation;
        if (out) return out;
      }
    } catch {}

    return text; // fallback: devolve original
  }

  // normaliza \r\n
  const tidy = (t) => (t || '').replace(/\r\n/g, '\n').trim();

  // ---------------- Versículo do dia ----------------
  async function loadVerseOfDay() {
    try {
      const r = await fetch(`${WORKER}/api/verse-of-day`);
      const j = await r.json(); // {ref, version, text}
      let { ref, version, text } = j;

      text = tidy(text);

      // se texto veio vazio, mostra erro discreto
      if (!text) {
        elVText.textContent = '(erro ao carregar)';
        elVRef.textContent = '';
        return;
      }

      // traduz se parecer inglês (fallback LEB)
      if (looksEnglish(text)) {
        const tpt = await translateToPT(text);
        if (tpt && tpt !== text) {
          text = tpt;
          version = 'LEB → pt (auto)';
        }
      }

      elVText.textContent = text;
      elVRef.textContent = ref ? `(${ref} — ${version || 'NVI'})` : '';
    } catch {
      elVText.textContent = '(erro ao carregar)';
      elVRef.textContent = '';
    }
  }

  // ---------------- Busca ----------------
  async function doSearch() {
    const q = elQ.value.trim();
    if (!q) return;

    elOut.value = 'Carregando...';

    try {
      // o worker aceita QUALQUER /{versao}.txt (ele ignora e usa NVI)
      const ver = elVer.value || VER_DEFAULT;
      const url = `${WORKER}/biblia/bible/content/${encodeURIComponent(ver)}.txt?passage=${encodeURIComponent(q)}`;

      const res = await fetch(url);
      let txt = tidy(await res.text());

      // traduz se parecer inglês
      if (looksEnglish(txt)) {
        const tpt = await translateToPT(txt);
        if (tpt && tpt !== txt) txt = tpt;
      }

      elOut.value = txt || 'Nenhum resultado encontrado.';
    } catch {
      elOut.value = 'Erro ao buscar na API da Bíblia.';
    }
  }

  // eventos
  elBtn.addEventListener('click', doSearch);
  elQ.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });
  elCopy?.addEventListener('click', async () => {
    const t = `${elVText.textContent}\n\n${elVRef.textContent}`;
    try { await navigator.clipboard.writeText(t.trim()); elCopy.textContent = 'Copiado! ✅'; }
    catch { elCopy.textContent = 'Copiar ❌'; }
    setTimeout(() => (elCopy.textContent = 'Copiar 📋'), 1500);
  });

  // inicializa
  loadVerseOfDay();
})();
