// app.js — front com tradução automática (PT) e YouTube
(async () => {
  const $  = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => [...el.querySelectorAll(s)];

  // ---- UI ----
  const elVText = $('#vday-text');
  const elVRef  = $('#vday-ref');
  const elCopy  = $('#btn-copy');
  const elQ     = $('#biblia-q');
  const elVer   = $('#biblia-ver');
  const elBtn   = $('#btn-buscar');
  const elOut   = $('#biblia-out');
  const elLive  = $('#liveFrame');
  const elShorts= $('#shorts');
  const elFulls = $('#fulls');
  $('#yy').textContent = new Date().getFullYear();

  // ---- Config ----
  const cfg = await fetch('assets/config.json').then(r => r.json());
  const WORKER = (cfg.proxy.workerBase || '').replace(/\/+$/,'');
  const VER_DEFAULT = cfg.biblia?.defaultVersion || 'LEB';

  // ---- Preenche versões (apenas visual) ----
  if (cfg.biblia?.versions && elVer) {
    elVer.innerHTML = '';
    for (const [label, val] of Object.entries(cfg.biblia.versions)) {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = label;
      if (val === VER_DEFAULT) opt.selected = true;
      elVer.appendChild(opt);
    }
  }

  // ---------------- Tradução (cliente) ----------------
  const trCfg = cfg.translate || {};
  const shouldAutoTranslate = !!trCfg.auto;

  // heurística simples EN
  function looksEnglish(txt) {
    if (!txt) return false;
    const s = txt.toLowerCase();
    const hits = (s.match(/\b(the|and|you|he|she|shall|lord|god|for|with|of|in|your|ways|acknowledge)\b/g) || []).length;
    const hasPT = /[áéíóúâêôãõç]/i.test(s);
    return hits >= 2 && !hasPT;
  }

  async function translateToPT(text) {
    if (!text || !shouldAutoTranslate) return text;

    // DeepL
    if (trCfg.provider === 'deepl' && trCfg.deepl?.apiKey) {
      try {
        const r = await fetch('https://api-free.deepl.com/v2/translate', {
          method:'POST',
          headers:{
            'Content-Type':'application/x-www-form-urlencoded',
            'Authorization':`DeepL-Auth-Key ${trCfg.deepl.apiKey}`
          },
          body:new URLSearchParams({text, target_lang:'PT-BR'})
        });
        if (r.ok) {
          const j = await r.json();
          const out = j?.translations?.[0]?.text;
          if (out) return out;
        }
      } catch(e) { console.warn('DeepL falhou:', e); }
    }

    // LibreTranslate (default)
    const base = trCfg.libre?.base || 'https://libretranslate.com';
    try {
      const r = await fetch(`${base}/translate`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          q:text, source:'en', target:'pt', format:'text',
          api_key: trCfg.libre?.apiKey || undefined
        })
      });
      if (r.ok) {
        const j = await r.json();
        const out = j?.translatedText || j?.translation;
        if (out) return out;
      }
    } catch(e) { console.warn('LibreTranslate falhou:', e); }

    return text; // fallback
  }

  const tidy = t => (t||'').replace(/\r\n/g,'\n').trim();

  // ---------------- Versículo do dia ----------------
  async function loadVerseOfDay() {
    try {
      const r = await fetch(`${WORKER}/api/verse-of-day`);
      const { ref, version, text } = await r.json();
      let showText = tidy(text);
      let showVer  = version || 'NVI';

      if (!showText) {
        elVText.textContent = '(erro ao carregar)';
        elVRef.textContent  = '';
        return;
      }
      // Força tradução se parecer EN ou se a versão for LEB
      if (looksEnglish(showText) || /^leb$/i.test(showVer)) {
        const pt = await translateToPT(showText);
        if (pt && pt !== showText) {
          showText = pt;
          showVer  = 'LEB → pt (auto)';
        }
      }
      elVText.textContent = showText;
      elVRef.textContent  = ref ? `(${ref} — ${showVer})` : '';
    } catch (e) {
      console.warn('vday erro:', e);
      elVText.textContent = '(erro ao carregar)';
      elVRef.textContent  = '';
    }
  }

  // ---------------- Busca ----------------
  async function doSearch() {
    const q = elQ.value.trim();
    if (!q) return;
    elOut.value = 'Carregando...';
    try {
      const ver = elVer.value || VER_DEFAULT;
      const url = `${WORKER}/biblia/bible/content/${encodeURIComponent(ver)}.txt?passage=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      let txt = tidy(await res.text());
      if (looksEnglish(txt)) {
        const pt = await translateToPT(txt);
        if (pt && pt !== txt) txt = pt;
      }
      elOut.value = txt || 'Nenhum resultado encontrado.';
    } catch (e) {
      console.warn('search erro:', e);
      elOut.value = 'Erro ao buscar na API da Bíblia.';
    }
  }

  elBtn?.addEventListener('click', doSearch);
  elQ?.addEventListener('keydown', (e)=>{ if(e.key==='Enter') doSearch(); });
  elCopy?.addEventListener('click', async ()=>{
    const t = `${elVText.textContent}\n\n${elVRef.textContent}`;
    try { await navigator.clipboard.writeText(t.trim()); elCopy.textContent='Copiado! ✅'; }
    catch { elCopy.textContent='Copiar ❌'; }
    setTimeout(()=> elCopy.textContent='Copiar 📋', 1500);
  });

  // ---------------- YouTube ----------------
  function ytWatchUrl(id){ return `https://www.youtube.com/watch?v=${id}`; }
  function fmtDate(s){ try{ return new Date(s).toLocaleDateString('pt-BR'); }catch{ return ''; } }

  function renderStrip(list, hostEl){
    hostEl.innerHTML='';
    (list||[]).forEach(v=>{
      if(!v?.id) return;
      const a = document.createElement('a');
      a.href = ytWatchUrl(v.id); a.target='_blank'; a.rel='noopener';
      a.className='hitem';
      a.innerHTML = `
        <img class="hthumb" src="${v.thumb||''}" alt="">
        <div class="hmeta">
          <div class="t">${(v.title||'').replace(/</g,'&lt;')}</div>
          <div class="s">${fmtDate(v.published)}</div>
        </div>
      `;
      hostEl.appendChild(a);
    });
  }

  async function loadYouTube(){
    const y = cfg.youtube || {};
    if(!y.channelId) return;

    // Live (ou último vídeo)
    try {
      const live = await fetch(`${WORKER}/api/youtube/live?channel=${encodeURIComponent(y.channelId)}`).then(r=>r.json());
      if(live?.isLive && live.id){
        elLive.src = `https://www.youtube.com/embed/${live.id}?autoplay=1`;
      }else{
        const last = await fetch(`${WORKER}/api/youtube?channel=${encodeURIComponent(y.channelId)}`).then(r=>r.json());
        const first = (last.items||[])[0];
        if(first?.id) elLive.src = `https://www.youtube.com/embed/${first.id}`;
      }
    } catch(e){ console.warn('live erro:', e); }

    // Shorts
    if(y.shortsPlaylist){
      try{
        const s = await fetch(`${WORKER}/api/youtube?playlist=${encodeURIComponent(y.shortsPlaylist)}`).then(r=>r.json());
        renderStrip(s.items||[], elShorts);
      }catch(e){ console.warn('shorts erro:', e); }
    }

    // Mensagens completas
    if(y.fullPlaylist){
      try{
        const f = await fetch(`${WORKER}/api/youtube?playlist=${encodeURIComponent(y.fullPlaylist)}`).then(r=>r.json());
        renderStrip(f.items||[], elFulls);
      }catch(e){ console.warn('fulls erro:', e); }
    }
  }

  // ---- init ----
  loadVerseOfDay();
  loadYouTube();
})();
