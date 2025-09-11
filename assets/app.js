(async () => {
  const cfg = await (await fetch("./assets/config.json")).json();
  const proxyBase = cfg.proxy.useWorker ? cfg.proxy.workerBase : cfg.biblia.apiBase;
  const defaultVer = cfg.biblia.defaultVersion || "POR-NTLH";

  // --- util: mapear livros PT -> EN aceitos pelo Biblia.com
  const bookMap = new Map(Object.entries({
    "gênesis":"Genesis","genesis":"Genesis","gn":"Genesis",
    "êxodo":"Exodus","exodo":"Exodus","ex":"Exodus",
    "levítico":"Leviticus","levitico":"Leviticus","lv":"Leviticus",
    "números":"Numbers","numeros":"Numbers","nm":"Numbers",
    "deuteronômio":"Deuteronomy","deuteronomio":"Deuteronomy","dt":"Deuteronomy",
    "josué":"Joshua","josue":"Joshua","js":"Joshua",
    "juízes":"Judges","juizes":"Judges","jz":"Judges",
    "rute":"Ruth","rt":"Ruth",
    "1 samuel":"1 Samuel","1sm":"1 Samuel","i samuel":"1 Samuel",
    "2 samuel":"2 Samuel","2sm":"2 Samuel","ii samuel":"2 Samuel",
    "1 reis":"1 Kings","1rs":"1 Kings","i reis":"1 Kings",
    "2 reis":"2 Kings","2rs":"2 Kings","ii reis":"2 Kings",
    "1 crônicas":"1 Chronicles","1 cronicas":"1 Chronicles","i crônicas":"1 Chronicles",
    "2 crônicas":"2 Chronicles","2 cronicas":"2 Chronicles","ii crônicas":"2 Chronicles",
    "esdras":"Ezra","neemias":"Nehemiah","ester":"Esther","jó":"Job","jo":"Job",
    "salmos":"Psalms","sl":"Psalms",
    "provérbios":"Proverbs","proverbios":"Proverbs","pv":"Proverbs",
    "eclesiastes":"Ecclesiastes","ec":"Ecclesiastes",
    "cantares":"Song of Solomon","cântico dos cânticos":"Song of Solomon","ct":"Song of Solomon",
    "isaías":"Isaiah","isaias":"Isaiah","is":"Isaiah",
    "jeremias":"Jeremiah","jr":"Jeremiah",
    "lamentações":"Lamentations","lamentacoes":"Lamentations","lm":"Lamentations",
    "ezequiel":"Ezekiel","ez":"Ezekiel",
    "daniel":"Daniel","dn":"Daniel",
    "oséias":"Hosea","oseias":"Hosea","os":"Hosea",
    "joel":"Joel","amós":"Amos","amos":"Amos","obadias":"Obadiah",
    "jonas":"Jonah","miqueias":"Micah","naum":"Nahum",
    "habacuque":"Habakkuk","sofonias":"Zephaniah","ageu":"Haggai",
    "zacarias":"Zechariah","malaquias":"Malachi",
    "mateus":"Matthew","mt":"Matthew",
    "marcos":"Mark","mc":"Mark",
    "lucas":"Luke","lc":"Luke",
    "joão":"John","joao":"John","jo":"John",  // atenção pra não confundir com Jó (Job) – acima é "jó/jo"
    "atos":"Acts","rm":"Romans","romanos":"Romans",
    "1 coríntios":"1 Corinthians","1 corintios":"1 Corinthians",
    "2 coríntios":"2 Corinthians","2 corintios":"2 Corinthians",
    "gálatas":"Galatians","galatas":"Galatians",
    "efésios":"Ephesians","efesios":"Ephesians",
    "filipenses":"Philippians","colossenses":"Colossians",
    "1 tessalonicenses":"1 Thessalonians","2 tessalonicenses":"2 Thessalonians",
    "1 timóteo":"1 Timothy","2 timóteo":"2 Timothy",
    "tito":"Titus","filemom":"Philemon",
    "hebreus":"Hebrews","tiago":"James",
    "1 pedro":"1 Peter","2 pedro":"2 Peter",
    "1 joão":"1 John","2 joão":"2 John","3 joão":"3 John",
    "judas":"Jude","apocalipse":"Revelation","ap":"Revelation"
  }));

  function normalizeRefPTtoEN(input) {
    // separa o primeiro “token” (livro) do restante
    const raw = input.trim().replace(/\s+/g, ' ');
    const m = raw.match(/^([1-3]?\s?[^\d:]+)/i);
    if (!m) return raw; // deixa como está
    const bookPT = m[1].toLowerCase().trim();
    const mapped = bookMap.get(bookPT);
    if (!mapped) return raw;
    return mapped + raw.slice(m[1].length); // troca só o livro
  }

  // ---------- elementos
  const verseOut  = document.getElementById("vod-text");
  const verseMeta = document.getElementById("vod-meta");
  const copyBtn   = document.getElementById("btn-copy");
  const qInput    = document.getElementById("q");
  const verSel    = document.getElementById("ver-sel");
  const btnSearch = document.getElementById("btn-search");
  const resBox    = document.getElementById("search-result");

  // popula select de versões
  for (const [label, code] of Object.entries(cfg.biblia.versions)) {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = label;
    if (code === defaultVer) opt.selected = true;
    verSel.appendChild(opt);
  }

  // Versículo do dia
  async function loadVerseOfDay() {
    try {
      verseOut.textContent = "—";
      verseMeta.textContent = "";
      const ver = verSel.value || defaultVer;

      const vod = await (await fetch(`${proxyBase}/api/verse-of-day?ver=${encodeURIComponent(ver)}`)).json();

      // normaliza a ref em PT para EN antes de buscar o texto
      const englishRef = normalizeRefPTtoEN(vod.ref);

      const txtUrl = `${proxyBase}/biblia/bible/content/${ver}.txt?passage=${encodeURIComponent(englishRef)}`;
      const txt = await (await fetch(txtUrl)).text();

      verseOut.textContent  = txt && txt.trim() ? txt.trim() : "—";
      verseMeta.textContent = `(${vod.ref} — ${ver})`;
    } catch (e) {
      verseOut.textContent = "Não foi possível carregar agora. Tente novamente mais tarde.";
      verseMeta.textContent = "";
    }
  }

  // Busca por passagem
  async function search() {
    const raw = (qInput.value || "").trim();
    if (!raw) return;
    resBox.textContent = "Carregando...";

    try {
      const ver = verSel.value || defaultVer;
      const norm = normalizeRefPTtoEN(raw);                // ex.: "Salmos 23" -> "Psalms 23"
      const url  = `${proxyBase}/biblia/bible/content/${ver}.txt?passage=${encodeURIComponent(norm)}`;

      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = (await r.text()).trim();

      resBox.textContent = text || "Nenhum resultado. Tente outra referência (ex.: João 3:16).";
    } catch (e) {
      resBox.textContent = "Erro na consulta. Tente outra palavra ou referência (ex.: João 3:16).";
    }
  }

  copyBtn?.addEventListener("click", () => {
    const t = verseOut.textContent.trim();
    if (!t) return;
    navigator.clipboard.writeText(t);
    copyBtn.classList.add("copied");
    setTimeout(()=>copyBtn.classList.remove("copied"), 900);
  });

  btnSearch?.addEventListener("click", search);
  qInput?.addEventListener("keydown", (e)=>{ if (e.key === "Enter") search(); });

  // start
  loadVerseOfDay();
})();
