/* =========================================================================
 * Rescue Church — app.js (client-only, GitHub Pages)
 * - Lê assets/config.json
 * - Usa o Cloudflare Worker como proxy (sem servidor próprio)
 * - Carrega "Versículo do dia" e consulta de passagens
 * - Mantém o layout: só preenche elementos já existentes
 * ========================================================================= */

(() => {
  // ---------- Ajuste rápido de seletores (se precisar) ----------
  const SELECTORS = {
    // Versículo do dia
    vodText:    ['#vod-text', '#vodText', '#versiculoTexto', '.vod-text'],
    vodMeta:    ['#vod-meta', '#vodMeta', '#versiculoMeta', '.vod-meta'],
    vodCopyBtn: ['#vod-copy', '#btnCopyVod', '.btn-copy-vod'],

    // Busca na Bíblia
    input:      ['#searchRef', '#search-input', '#buscaRef', '#input-ref', '.search-input'],
    version:    ['#version', '#versionSelect', '#versao', '.version-select'],
    searchBtn:  ['#searchBtn', '#btnSearch', '.btn-search'],
    result:     ['#resultado-biblia', '#resultBible', '#resultado', '.resultado-biblia'],

    // Avisos/erros (opcional)
    vodCard:    ['#vod-card', '.vod-card'],
    resultBox:  ['#result-box', '.result-box']
  };

  // Encontra o primeiro seletor existente na página
  function pick(selArr) {
    for (const s of selArr) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  // ---------- Estado global ----------
  const state = {
    config: null,
    proxyBase: '',
    versions: {},            // { "NVI (pt-BR)": "POR-NVI", ... }
    defaultVersionLabel: '', // "NTLH (pt-BR)"
    currentVerCode: ''       // "POR-NTLH"
  };

  // ---------- Utilitários ----------
  const escapeHtml = (s) => String(s || '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
  const br = (s) => escapeHtml(s).replace(/\r?\n/g, '<br>');

  function setText(el, text) { if (el) el.textContent = text; }
  function setHtml(el, html) { if (el) el.innerHTML = html; }

  // Mostra erro "humano" no VOD
  function showVodError() {
    const textEl = pick(SELECTORS.vodText);
    const metaEl = pick(SELECTORS.vodMeta);
    if (textEl) setText(textEl, 'Não foi possível carregar agora. Tente novamente mais tarde.');
    if (metaEl) setText(metaEl, '');
  }

  // Mostra erro "humano" na busca
  function showSearchError() {
    const resEl = pick(SELECTORS.result);
    if (resEl) {
      setText(resEl, 'Erro na consulta. Tente outra palavra ou referência (ex.: João 3:16).');
    }
  }

  // Lê config.json (forma nova e antiga)
  async function loadConfig() {
    // Caminho padrão para GitHub Pages
    const url = window.CONFIG_URL || 'assets/config.json';

    const r = await fetch(url, { cache: 'no-cache' });
    const cfg = await r.json();

    // Suporta duas formas de config:
    // 1) simples
    // {
    //   "proxyBase": "https://SEU-WORKER.workers.dev",
    //   "versions": { "NVI (pt-BR)": "POR-NVI", ... },
    //   "defaultVersion": "NTLH (pt-BR)"
    // }
    //
    // 2) antiga (com biblia/proxy)
    // {
    //   "biblia": { "versions": {...}, "defaultVersion": "..." },
    //   "proxy": { "workerBase": "https://..." }
    // }

    const proxyBase =
      cfg.proxyBase ||
      cfg?.proxy?.workerBase ||
      cfg?.proxy?.proxyBase ||
      '';

    const versions =
      cfg.versions ||
      cfg?.biblia?.versions ||
      {};

    const defaultVersionLabel =
      cfg.defaultVersion ||
      cfg?.biblia?.defaultVersion ||
      Object.keys(versions)[0] ||
      '';

    if (!proxyBase) {
      throw new Error('proxyBase não definido em assets/config.json');
    }

    state.config = cfg;
    state.proxyBase = proxyBase.replace(/\/+$/, ''); // sem barra no fim
    state.versions = versions;
    state.defaultVersionLabel = defaultVersionLabel;
    state.currentVerCode = versions[defaultVersionLabel] || Object.values(versions)[0];

    return cfg;
  }

  // Preenche o <select> de versões mantendo label do layout
  function populateVersions() {
    const sel = pick(SELECTORS.version);
    if (!sel) return;

    // Limpa
    sel.innerHTML = '';

    // Cria opções conforme config
    Object.entries(state.versions).forEach(([label, code]) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = label;
      if (label === state.defaultVersionLabel) opt.selected = true;
      sel.appendChild(opt);
    });

    // Ouça alterações
    sel.addEventListener('change', () => {
      state.currentVerCode = sel.value;
      // Se quiser, recarrega o VOD quando mudar versão:
      carregarVersiculoDoDia();
    });
  }

  // ---------- VOD ----------
  async function carregarVersiculoDoDia() {
    try {
      const ver = state.currentVerCode || 'POR-NTLH';
      const url = `${state.proxyBase}/api/verse-of-day?ver=${encodeURIComponent(ver)}`;

      const r = await fetch(url);
      const data = await r.json();

      const textEl = pick(SELECTORS.vodText);
      const metaEl = pick(SELECTORS.vodMeta);

      if (data?.ok && (data.text || '').trim()) {
        if (textEl) setHtml(textEl, br(data.text));
        if (metaEl) setText(metaEl, `(${data.ref} — ${data.version})`);
      } else {
        showVodError();
      }
    } catch (e) {
      showVodError();
    }
  }

  function configurarBotaoCopiarVOD() {
    const btn = pick(SELECTORS.vodCopyBtn);
    const textEl = pick(SELECTORS.vodText);
    const metaEl = pick(SELECTORS.vodMeta);
    if (!btn || !textEl) return;

    btn.addEventListener('click', async () => {
      try {
        const plain = `${(textEl.textContent || '').trim()} ${metaEl ? metaEl.textContent : ''}`.trim();
        await navigator.clipboard.writeText(plain);
        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), 800);
      } catch (_) {}
    });
  }

  // ---------- Busca ----------
  async function buscarPassagem() {
    const input = pick(SELECTORS.input);
    const resEl = pick(SELECTORS.result);
    if (!input || !resEl) return;

    const passage = (input.value || '').trim();
    const ver = (pick(SELECTORS.version)?.value) || state.currentVerCode || 'POR-NTLH';

    if (!passage) return;

    // Troca ponto por dois-pontos se o usuário digitar "23.1"
    const normalized = passage.replace(/(\d+)\.(\d+)/g, '$1:$2');

    try {
      const url = `${state.proxyBase}/biblia/content?ver=${encodeURIComponent(ver)}&passage=${encodeURIComponent(normalized)}`;

      const r = await fetch(url);
      const data = await r.json();

      if (data?.ok && (data.text || '').trim()) {
        setHtml(
          resEl,
          `
          <div class="ref">${escapeHtml(data.ref)} — ${escapeHtml(data.ver || ver)}</div>
          <div class="texto">${br(data.text)}</div>
          `
        );
      } else {
        showSearchError();
      }
    } catch (e) {
      showSearchError();
    }
  }

  function wireSearch() {
    const btn = pick(SELECTORS.searchBtn);
    const input = pick(SELECTORS.input);
    if (btn) btn.addEventListener('click', buscarPassagem);
    if (input) {
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') buscarPassagem();
      });
    }
  }

  // ---------- Init ----------
  async function init() {
    try {
      await loadConfig();       // lê config.json
      populateVersions();       // popula select
      configurarBotaoCopiarVOD();
      wireSearch();

      // Carrega VOD no carregamento
      carregarVersiculoDoDia();
    } catch (err) {
      // Falha de config: mostra feedback amigável
      console.error(err);
      showVodError();
      showSearchError();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
