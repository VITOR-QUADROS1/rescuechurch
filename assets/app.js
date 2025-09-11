(async function () {
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => [...ctx.querySelectorAll(sel)];
  const byId = id => document.getElementById(id);

  const year = new Date().getFullYear();
  byId('y').textContent = year;

  // Carrega config
  let cfg;
  try {
    const r = await fetch('assets/config.json?v=2', {cache:'no-store'});
    cfg = await r.json();
  } catch (e) {
    console.error('Falha ao ler config.json', e);
    return;
  }

  const workerBase = cfg.proxy?.useWorker ? cfg.proxy.workerBase.replace(/\/+$/,'') : '';
  const API = {
    verseOfDay: (verCode) => `${workerBase}/api/verse-of-day?ver=${encodeURIComponent(verCode||'POR-NVI')}`,
    bibleContent: (verCode, ref) => `${workerBase}/biblia/bible/content/${encodeURIComponent(verCode)}.txt?passage=${encodeURIComponent(ref)}`,
    bibleSearch: (verCode, q) => `${workerBase}/biblia/bible/search/${encodeURIComponent(verCode)}.js?query=${encodeURIComponent(q)}`,
    ytUploads: (channelId) => `${workerBase}/api/youtube/uploads?channel=${encodeURIComponent(channelId)}`,
    ytPlaylist: (playlistId) => `${workerBase}/api/youtube/playlist?id=${encodeURIComponent(playlistId)}`,
    ytLive: (channelId) => `${workerBase}/api/youtube/live?channel=${encodeURIComponent(channelId)}`
  };

  /* ---------- HERO ---------- */
  // usa logo.png por padrão
  $('.hero__bg').style.setProperty('--hero-url', "url('assets/logo.png')");

  /* ---------- SELECT de versões ---------- */
  const selVer = byId('ver');
  const vers = cfg.bible.versions;
  for (const [label, code] of Object.entries(vers)){
    const opt = document.createElement('option');
    opt.textContent = label; opt.value = code;
    if (label === cfg.bible.defaultVersion) opt.selected = true;
    selVer.appendChild(opt);
  }

  /* ---------- Versículo do dia ---------- */
  const votdEl = byId('votd');
  const btnCopy = byId('btnCopy');
  let votdText = '';

  async function loadVOTD() {
    try {
      const ver = selVer.value || vers[cfg.bible.defaultVersion];
      const r = await fetch(API.verseOfDay(ver), {cache:'no-store'});
      if (!r.ok) throw new Error('votd http '+r.status);
      const data = await r.json(); // {ref, version, text}
      votdText = `${data.text}\n— ${data.ref} (${data.version})`;
      votdEl.textContent = votdText;
      votdEl.classList.remove('loading');
    } catch (e) {
      console.error(e);
      votdEl.innerHTML = `<div class="muted">Não foi possível carregar agora.<br/>Tente novamente mais tarde.</div>`;
    }
  }
  loadVOTD();

  votdEl.addEventListener('click', () => copy(votdText));
  btnCopy.addEventListener('click', () => copy(votdText));
  function copy(t){
    if (!t) return;
    navigator.clipboard.writeText(t).then(()=> {
      btnCopy.textContent = 'Copiado ✅';
      setTimeout(()=> btnCopy.textContent = 'Copiar 📋', 1500);
    });
  }

  /* ---------- Busca na Bíblia ---------- */
  const form = byId('formBusca');
  const q = byId('q');
  const resBox = byId('resultado');

  form.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    resBox.innerHTML = '<div class="loading">Procurando...</div>';

    const refOrTerm = q.value.trim();
    const ver = selVer.value;
    if (!refOrTerm){ resBox.textContent = ''; return; }

    // se parece referência (salmos 23:1, joao 3:16), manda pro content; senão, search
    const isRef = /[\d:]/.test(refOrTerm) || /\b(gên|gen|êx|exo|salmos?|jo(á|a)o|mt|mc|lc|jo|atos|rom)/i.test(refOrTerm);

    try{
      if (isRef){
        const r = await fetch(API.bibleContent(ver, refOrTerm), {cache:'no-store'});
        if (!r.ok){ throw new Error('content '+r.status); }
        const txt = await r.text();
        resBox.textContent = normalizeBibleText(txt);
      }else{
        const r = await fetch(API.bibleSearch(ver, refOrTerm), {cache:'no-store'});
        if (!r.ok){ throw new Error('search '+r.status); }
        const data = await r.json();
        if (!data.results || !data.results.length){
          resBox.innerHTML = `<div class="muted">Nenhum resultado agora. Tente outra referência.</div>`;
          return;
        }
        // mostra os 3 primeiros
        const out = data.results.slice(0,3).map(x=>{
          const verseRef = `${x.title?.replace(/\s+/g,' ')} ${x.preview?.match(/\((.*?)\)/)?.[1]??''}`.trim();
          return `• ${x.preview?.replace(/<[^>]+>/g,'').trim()}\n  — ${verseRef}`;
        }).join('\n\n');
        resBox.textContent = out;
      }
    }catch(e){
      console.error(e);
      resBox.innerHTML = `<div class="muted">Erro na consulta. Tente outra palavra ou referência (ex.: João 3:16).</div>`;
    }
  });

  function normalizeBibleText(t){
    // remove cabeçalhos do biblia.com quando vem .txt
    return t.replace(/\r/g,'').replace(/\n{3,}/g,'\n\n').trim();
  }

  /* ---------- YouTube ---------- */
  const channelId = cfg.youtube.channelId;
  const shortsPlaylist = cfg.youtube.shortsPlaylist;
  const fullPlaylist = cfg.youtube.fullPlaylist;

  const livePlayer = byId('livePlayer');
  const railShorts = byId('shorts');
  const railFull = byId('full');

  // Live (tenta pegar live, senão último upload)
  async function loadLive(){
    try{
      const r = await fetch(API.ytLive(channelId), {cache:'no-store'});
      const data = await r.json(); // {live: true/false, id: "VIDEOID"} ou {id: ultimo}
      const vid = data?.id;
      if (!vid){ livePlayer.innerHTML = `<div class="muted">Não encontrado.</div>`; return; }
      livePlayer.innerHTML = `<iframe src="https://www.youtube.com/embed/${vid}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    }catch(e){
      console.error(e);
      livePlayer.innerHTML = `<div class="muted">Falha ao carregar o player.</div>`;
    }
  }

  // Carrossel helper
  function mountRail(el, items){
    el.innerHTML = items.map(v=>{
      const thumb = `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
      const t = (v.title||'').replace(/&amp;/g,'&');
      return `
        <a class="cardThumb" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">
          <img src="${thumb}" alt="">
          <div class="meta">${escapeHtml(t)}</div>
        </a>`;
    }).join('');
  }
  function escapeHtml(s){ return s?.replace(/[<>&]/g, m=>({ '<':'&lt;','>':'&gt;','&':'&amp;'}[m]))??'' }

  async function loadRails(){
    // Shorts
    try{
      let items;
      if (shortsPlaylist){
        const rs = await fetch(API.ytPlaylist(shortsPlaylist));
        items = (await rs.json()).items || [];
      }else{
        const ru = await fetch(API.ytUploads(channelId));
        const up = await ru.json();
        // considera shorts se duração <= 61s (quando o feed traz duração)
        items = (up.items||[]).filter(x => (x.duration||0) <= 61);
      }
      mountRail(railShorts, items.slice(0,12));
    }catch(e){ console.warn('shorts',e); }

    // Completos
    try{
      let items;
      if (fullPlaylist){
        const rp = await fetch(API.ytPlaylist(fullPlaylist));
        items = (await rp.json()).items || [];
      }else{
        const ru = await fetch(API.ytUploads(channelId));
        const up = await ru.json();
        items = (up.items||[]).filter(x => (x.duration||999) > 61);
      }
      mountRail(railFull, items.slice(0,12));
    }catch(e){ console.warn('full',e); }
  }

  loadLive();
  loadRails();
})();
