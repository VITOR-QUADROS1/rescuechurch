// Carrega config
const cfg = await fetch('assets/config.json').then(r => r.json());

// Utilidades
const $ = s => document.querySelector(s);
const year = new Date().getFullYear();
$('#year').textContent = year;

// Preenche versões no select
const verSel = $('#ver');
Object.keys(cfg.biblia.versions).forEach(label=>{
  const opt = document.createElement('option');
  opt.textContent = label;
  opt.value = cfg.biblia.versions[label];
  if(label === cfg.biblia.defaultVersion) opt.selected = true;
  verSel.appendChild(opt);
});

// ======== HERO (nada a fazer, imagem ajusta pelo CSS) ========

// ======== LIVE (ao vivo) ========
function setLiveEmbed() {
  const ch = cfg.youtube.channelId;
  if(!ch) return;
  $('#liveFrame').src = `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(ch)}&rel=0`;
}
setLiveEmbed();

// ======== BÍBLIA — helpers de fetch ========
const workerBase = cfg.proxy.useWorker ? cfg.proxy.workerBase : null;
const API_BASE = cfg.biblia.apiBase;

async function viaWorker(path) {
  if(!workerBase) throw new Error('worker desativado');
  const url = `${workerBase}${path}`;
  const r = await fetch(url);
  if(!r.ok) throw new Error(`worker ${r.status}`);
  return r;
}
async function viaDirect(pathWithQuery) {
  // ATENÇÃO: sem key aqui; o ideal é o Worker. Mantemos direto apenas se o Worker falhar e você tiver key pública (não recomendado).
  throw new Error('Direto desativado por segurança. Use o Worker.');
}

// busca passagem (ex: "Joao 3:16")
async function getPassage(passage, verCode) {
  // Worker injeta BIBLIA_API_KEY e faz CORS
  const path = `/biblia/bible/content/${encodeURIComponent(verCode)}.txt?passage=${encodeURIComponent(passage)}`;
  try {
    const r = await viaWorker(path);
    return await r.text();
  } catch (e) {
    console.error('getPassage:', e);
    return null;
  }
}

// busca por palavra (modo: versos)
async function searchVerses(query, verCode, limit = 5) {
  const path = `/biblia/bible/search/${encodeURIComponent(verCode)}.js?query=${encodeURIComponent(query)}&mode=verse&start=0&limit=${limit}`;
  try {
    const r = await viaWorker(path);
    const js = await r.json();
    return js.results?.map(v => `• ${v.title}\n${v.preview}\n`).join('\n') || null;
  } catch (e) {
    console.error('searchVerses:', e);
    return null;
  }
}

// ======== VERSÍCULO DO DIA ========
const versList = [
  "Salmos 23:1-3", "Filipenses 4:6-7", "Provérbios 3:5-6", "Romanos 8:28",
  "Mateus 11:28-30", "Isaías 41:10", "Salmos 46:1-2", "João 14:27",
  "Salmos 121:1-2", "Hebreus 11:1", "Jeremias 29:11", "João 3:16"
];
function pickVerseOfDay() {
  const d0 = new Date(Date.UTC(new Date().getUTCFullYear(),0,1));
  const today = new Date();
  const day = Math.floor((today - d0)/86400000);
  return versList[day % versList.length];
}
async function loadVerseOfDay() {
  const ver = verSel.value || cfg.biblia.versions[cfg.biblia.defaultVersion];
  const ref = pickVerseOfDay();
  const txt = await getPassage(ref, ver);
  if(txt) {
    $('#textoDia').textContent = txt.trim();
    $('#refDia').textContent = ref + ' — ' + labelByCode(ver);
  } else {
    $('#textoDia').textContent = 'Não foi possível carregar agora.';
    $('#refDia').textContent = 'Tente novamente mais tarde.';
  }
}
function labelByCode(code){
  return Object.entries(cfg.biblia.versions).find(([,v])=>v===code)?.[0] ?? code;
}
loadVerseOfDay();

// Copiar
$('#btnCopiar').addEventListener('click', ()=>{
  const t = $('#textoDia').textContent.trim();
  const r = $('#refDia').textContent.trim();
  if(!t) return;
  navigator.clipboard.writeText(`${t}\n${r}`);
});

// ======== BUSCA ========
$('#btnBuscar').addEventListener('click', onBuscar);

async function onBuscar(){
  const q = $('#q').value.trim();
  const ver = $('#ver').value;
  const $out = $('#resultado');
  $out.textContent = 'Buscando...';

  if(!q){
    $out.textContent = 'Digite uma referência (ex.: João 3:16) ou palavra (ex.: amor).';
    return;
  }

  // tem número? tratamos como referência (passagem)
  const isRef = /\d/.test(q);
  if(isRef){
    const txt = await getPassage(q, ver);
    $out.textContent = txt ? txt.trim() : 'Nenhum resultado agora. Tente outra referência.';
  }else{
    const list = await searchVerses(q, ver, 8);
    $out.textContent = list || 'Nenhum resultado agora. Tente outra palavra.';
  }
}

// ======== VÍDEOS — Feeds via Worker (CORS ok) ========
async function fetchPlaylistItems(playlistId) {
  const url = `/api/youtube?playlist=${encodeURIComponent(playlistId)}`;
  try{
    const xml = await (await viaWorker(url)).text();
    const dom = new DOMParser().parseFromString(xml, 'application/xml');
    const entries = [...dom.querySelectorAll('entry')];
    return entries.map(e=>{
      const id = e.querySelector('yt\\:videoId, videoId')?.textContent ?? '';
      const title = e.querySelector('title')?.textContent ?? '';
      const published = e.querySelector('published')?.textContent ?? '';
      return { id, title, published };
    });
  }catch(e){
    console.error('playlist fetch', e);
    return [];
  }
}
function ytThumb(id){ return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }
function fmtDate(iso){
  try{
    return new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'}).format(new Date(iso));
  }catch{ return ''; }
}
function renderRow(el, items){
  el.innerHTML = '';
  items.forEach(v=>{
    const c = document.createElement('a');
    c.className = 'card-video';
    c.href = `https://www.youtube.com/watch?v=${v.id}`;
    c.target = '_blank';
    c.rel = 'noopener';
    c.innerHTML = `
      <img class="thumb" alt="" loading="lazy" src="${ytThumb(v.id)}">
      <div class="meta">
        <div class="title">${v.title}</div>
        <div class="when">${fmtDate(v.published)}</div>
      </div>`;
    el.appendChild(c);
  });
}
(async function initPlaylists(){
  const max = cfg.youtube.maxItems || 12;
  if(cfg.youtube.shortsPlaylist){
    const shorts = (await fetchPlaylistItems(cfg.youtube.shortsPlaylist)).slice(0,max);
    renderRow($('#shortsRow'), shorts);
  }
  if(cfg.youtube.fullPlaylist){
    const full = (await fetchPlaylistItems(cfg.youtube.fullPlaylist)).slice(0,max);
    renderRow($('#fullRow'), full);
  }
})();
