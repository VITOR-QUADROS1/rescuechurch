/* ===========================
   Rescue Church — Front App
   =========================== */

const els = {
  year: () => document.getElementById('year'),
  verseText: () => document.getElementById('verseText'),
  verseRef: () => document.getElementById('verseRef'),
  verseHint: () => document.getElementById('verseHint'),
  copyVerse: () => document.getElementById('copyVerse'),
  searchForm: () => document.getElementById('searchForm'),
  searchInput: () => document.getElementById('searchInput'),
  versionSelect: () => document.getElementById('versionSelect'),
  results: () => document.getElementById('searchResults'),
  liveWrap: () => document.getElementById('liveWrap'),
  shortsWrap: () => document.getElementById('shortsWrap'),
  fullWrap: () => document.getElementById('fullWrap')
};

const BOOKS_PT = {
  'genesis':'gn','gênesis':'gn','gn':'gn',
  'exodo':'ex','êxodo':'ex','ex':'ex',
  'levitico':'lv','levítico':'lv','lv':'lv',
  'numeros':'nm','números':'nm','nm':'nm',
  'deuteronomio':'dt','deuteronômio':'dt','dt':'dt',
  'josue':'js','josué':'js','js':'js',
  'juizes':'jz','juízes':'jz','jz':'jz',
  'rute':'rt','rt':'rt',
  '1samuel':'1sm','1 samuel':'1sm','1sm':'1sm',
  '2samuel':'2sm','2 samuel':'2sm','2sm':'2sm',
  '1reis':'1rs','1 rs':'1rs','1rs':'1rs',
  '2reis':'2rs','2 rs':'2rs','2rs':'2rs',
  '1cronicas':'1cr','1 crônicas':'1cr','1cr':'1cr',
  '2cronicas':'2cr','2 crônicas':'2cr','2cr':'2cr',
  'esdras':'ed','ed':'ed','neemias':'ne','ne':'ne','ester':'et','et':'et',
  'jo':'jó','jó':'jó','jb':'jó',
  'salmos':'sl','salmo':'sl','sl':'sl',
  'proverbios':'pv','provérbios':'pv','pv':'pv',
  'eclesiastes':'ec','ec':'ec','cantares':'ct','ct':'ct',
  'isaías':'is','isaias':'is','is':'is','jeremias':'jr','jr':'jr','lamentações':'lm','lm':'lm',
  'ezequiel':'ez','ez':'ez','daniel':'dn','dn':'dn',
  'oseias':'os','oséias':'os','os':'os','joel':'jl','jl':'jl','amos':'am','amós':'am','am':'am',
  'obadias':'ob','ob':'ob','jonas':'jn','jn':'jn','miqueias':'mq','mq':'mq',
  'naum':'na','na':'na','habacuque':'hc','hc':'hc','sofonias':'sf','sf':'sf',
  'ageu':'ag','ag':'ag','zacarias':'zc','zc':'zc','malaquias':'ml','ml':'ml',
  'mateus':'mt','mt':'mt','marcos':'mc','mc':'mc','lucas':'lc','lc':'lc',
  'joao':'jo','joão':'jo','jo':'jo',
  'atos':'at','at':'at','romanos':'rm','rm':'rm',
  '1corintios':'1co','1 corintios':'1co','1co':'1co',
  '2corintios':'2co','2 corintios':'2co','2co':'2co',
  'galatas':'gl','gálatas':'gl','gl':'gl','efesios':'ef','efésios':'ef','ef':'ef',
  'filipenses':'fp','fp':'fp','colossenses':'cl','cl':'cl',
  '1tessalonicenses':'1ts','1 ts':'1ts','1ts':'1ts',
  '2tessalonicenses':'2ts','2 ts':'2ts','2ts':'2ts',
  '1timoteo':'1tm','1 timóteo':'1tm','1tm':'1tm',
  '2timoteo':'2tm','2 timóteo':'2tm','2tm':'2tm',
  'tito':'tt','tt':'tt','filemom':'fm','fm':'fm',
  'hebreus':'hb','hb':'hb','tiago':'tg','tg':'tg',
  '1pedro':'1pe','1 pe':'1pe','1pe':'1pe',
  '2pedro':'2pe','2 pe':'2pe','2pe':'2pe',
  '1joao':'1jo','1 jo':'1jo','1jo':'1jo',
  '2joao':'2jo','2 jo':'2jo','2jo':'2jo',
  '3joao':'3jo','3 jo':'3jo','3jo':'3jo',
  'judas':'jd','jd':'jd','apocalipse':'ap','ap':'ap'
};

// util
const $ = (fn)=>fn();
const setYear = ()=> els.year().textContent = new Date().getFullYear();

// tenta varias traduções e depois entra num fallback local
async function fetchRandomVerse(preferred='nvi'){
  const chain = [preferred,'acf','kjv'];
  for (const v of chain){
    try{
      const r = await fetch(`https://www.abibliadigital.com.br/api/verses/${v}/random`);
      if (!r.ok) throw new Error('bad status');
      const data = await r.json();
      // formatos dif. entre kjv e pt são tratados
      if (data.text && data.book){
        return {
          text: data.text,
          ref: `${data.book.name} ${data.chapter}:${data.number}`,
          version: v.toUpperCase()
        };
      }
    }catch(_){}
  }
  // último recurso: versículo local
  const local = [
    {text:'Porque Deus amou o mundo de tal maneira, que deu o seu Filho unigênito...',ref:'João 3:16',version:'(offline)'},
    {text:'O Senhor é o meu pastor; nada me faltará.',ref:'Salmos 23:1',version:'(offline)'},
    {text:'Confia no Senhor de todo o teu coração...',ref:'Provérbios 3:5',version:'(offline)'}
  ];
  return local[Math.floor(Math.random()*local.length)];
}

function parseReference(q){
  // "Joao 3:16", "Salmos 23", etc
  const m = q.trim().toLowerCase().match(/^([1-3]?\s*[a-záéíóúãõâêôç]+)\s+(\d+)(?::(\d+))?$/i);
  if(!m) return null;
  const bookRaw = m[1].replace(/\s+/g,'');
  const book = BOOKS_PT[bookRaw];
  if(!book) return null;
  return {abbrev: book, chapter: m[2], verse: m[3] || null};
}

async function fetchByReference(version, ref){
  const base = `https://www.abibliadigital.com.br/api/verses/${version}/${ref.abbrev}/${ref.chapter}`;
  const url  = ref.verse ? `${base}/${ref.verse}` : base;
  const r = await fetch(url);
  if(!r.ok) throw new Error('bad status');
  const data = await r.json();
  if (Array.isArray(data.verses)){ // capítulo
    const v1 = data.verses[0];
    return { text: v1.text, ref: `${data.book.name} ${data.chapter.number}:${v1.number}`, version: version.toUpperCase() };
  } else { // único verso
    return { text: data.text, ref: `${data.book.name} ${data.chapter}:${data.number}`, version: version.toUpperCase() };
  }
}

async function searchByKeyword(version, query){
  // API pública (rate limit) – se falhar, cai no KJV via bible-api
  try{
    const r = await fetch('https://www.abibliadigital.com.br/api/verses/search',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ version, search: query })
    });
    if (!r.ok) throw new Error('bad status');
    const data = await r.json();
    if (data.verses && data.verses.length){
      return data.verses.slice(0,5).map(v => ({
        text: v.text,
        ref: `${v.book.name} ${v.chapter}:${v.number}`,
        version: version.toUpperCase()
      }));
    }
  }catch(_){}

  // Fallback KJV (inglês)
  try{
    const r = await fetch(`https://bible-api.com/${encodeURIComponent(query)}?translation=kjv`);
    if (!r.ok) throw new Error();
    const data = await r.json();
    if (data && data.text){
      return [{
        text: data.text.trim(),
        ref: `${data.reference}`,
        version: 'KJV'
      }];
    }
  }catch(_){}

  return [];
}

function renderVerse(v){
  $(els.verseText).textContent = v.text;
  $(els.verseRef).textContent = `${v.ref} — ${v.version}`;
  $(els.verseHint).textContent = 'Dica: clique em "Copiar" para copiar o texto. Se não veio em pt-BR, a API pública pode estar limitada e usamos um fallback.';
}

function copyVerse(){
  const text = `${$(els.verseText).textContent} — ${$(els.verseRef).textContent}`;
  navigator.clipboard.writeText(text).then(()=>{
    $(els.copyVerse).textContent = 'Copiado ✅';
    setTimeout(()=>$(els.copyVerse).textContent='Copiar 📋', 1200);
  });
}

function renderResults(list){
  const box = $(els.results);
  box.innerHTML = '';
  if (!list.length){
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Nenhum resultado agora. Tente outra palavra ou referência (ex.: João 3:16).';
    box.appendChild(p);
    return;
  }
  for (const v of list){
    const c = document.createElement('div');
    c.className = 'result-card';
    c.innerHTML = `<div>${v.text}</div><div class="result-ref">${v.ref} — ${v.version}</div>`;
    box.appendChild(c);
  }
}

function mountIframe(container, src){
  container.innerHTML = '';
  const wrap = document.createElement('iframe');
  wrap.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  wrap.referrerPolicy = "strict-origin-when-cross-origin";
  wrap.src = src;
  container.appendChild(wrap);
}

/* ---------- Boot ---------- */
(async function init(){
  setYear();
  $(els.copyVerse).addEventListener('click', copyVerse);

  // carrega config
  let config = { bible:{defaultVersion:'nvi'}, youtube:{} };
  try{
    const r = await fetch('assets/config.json'); if(r.ok) config = await r.json();
  }catch(_){}

  // define versão default
  if (config?.bible?.defaultVersion){
    $(els.versionSelect).value = config.bible.defaultVersion.toLowerCase();
  }

  // Versículo do dia
  try{
    const v = await fetchRandomVerse($(els.versionSelect).value);
    renderVerse(v);
  }catch(_){
    renderVerse({text:'Não foi possível carregar agora.', ref:'', version:''});
  }

  // Busca
  $(els.searchForm).addEventListener('submit', async (e)=>{
    e.preventDefault();
    const q = $(els.searchInput).value.trim();
    const version = $(els.versionSelect).value || 'nvi';
    if(!q){ return; }

    const ref = parseReference(q);
    try{
      if (ref){
        // por referência
        // tenta na versão escolhida, depois alterna
        const order = [version,'acf','kjv'];
        for (const v of order){
          try{
            const res = await fetchByReference(v, ref);
            renderResults([res]);
            return;
          }catch(_){}
        }
        renderResults([]);
      } else {
        // por palavra
        const res = await searchByKeyword(version, q);
        renderResults(res);
      }
    }catch(_){
      renderResults([]);
    }
  });

  // YouTube
  const yt = config.youtube || {};
  if (yt.channelId){
    mountIframe($(els.liveWrap), `https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(yt.channelId)}&autoplay=0`);
  }
  if (yt.shortsPlaylistId){
    mountIframe($(els.shortsWrap), `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(yt.shortsPlaylistId)}`);
  }
  if (yt.fullPlaylistId){
    mountIframe($(els.fullWrap), `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(yt.fullPlaylistId)}`);
  }
})();
