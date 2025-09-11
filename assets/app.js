(async function () {
  // Helpers rápidos
  const $ = (sel, el = document) => el.querySelector(sel);

  // Carrega config
  const cfg = await fetch("assets/config.json").then(r => r.json());
  const WORKER = cfg.proxy.workerBase.replace(/\/+$/, "");
  const DEF_VER = cfg.biblia.defaultVersion;

  // Preenche select de versões
  const selVer = $("#ver");
  Object.entries(cfg.biblia.versions).forEach(([label, code]) => {
    const opt = document.createElement("option");
    opt.value = code; opt.textContent = label;
    if (code === DEF_VER) opt.selected = true;
    selVer.appendChild(opt);
  });

  // ====== Versículo do dia ======
  const boxVdo = $("#vdo");
  const btnCopiar = $("#btnCopiar");
  btnCopiar.addEventListener("click", () => {
    const txt = boxVdo.textContent.trim();
    if (!txt) return;
    navigator.clipboard.writeText(txt);
    btnCopiar.textContent = "Copiado ✔";
    setTimeout(() => (btnCopiar.textContent = "Copiar 📋"), 1500);
  });
  boxVdo.addEventListener("click", () => btnCopiar.click());

  try {
    // 1) referência do dia
    const vResp = await fetch(`${WORKER}/api/verse-of-day?ver=${encodeURIComponent(DEF_VER)}`);
    const vJson = await vResp.json(); // { ref, version }
    // 2) busca o texto
    const texto = await fetchPassageText(vJson.ref, vJson.version);
    if (texto) {
      boxVdo.textContent = `${vJson.ref}\n${texto.trim()}`;
    } else {
      erroVDia();
    }
  } catch (e) {
    erroVDia();
  }

  function erroVDia(){
    boxVdo.textContent = "Não foi possível carregar agora.\nTente novamente mais tarde.";
  }

  // ====== Busca ======
  $("#btnBuscar").addEventListener("click", onBuscar);
  $("#q").addEventListener("keydown", (e)=>{ if (e.key==="Enter") onBuscar(); });

  async function onBuscar(){
    const q = $("#q").value.trim();
    const verCode = $("#ver").value;
    const out = $("#resultado");
    out.textContent = "";

    if (!q) return;
    const refEN = toEnglishRef(q);
    try{
      const texto = await fetchPassageText(refEN, verCode);
      if (texto && texto.trim()) out.textContent = texto.trim();
      else out.textContent = "Erro na consulta. Tente outra palavra ou referência (ex.: João 3:16).";
    }catch(e){
      out.textContent = "Erro na consulta. Tente outra palavra ou referência (ex.: João 3:16).";
    }
  }

  // ===== Helpers =====

  // Busca texto via proxy Biblia.com
  async function fetchPassageText(ref, version){
    // Ex.: /biblia/bible/content/POR-NTLH.txt?passage=Psalms%2023
    const url = `${WORKER}/biblia/bible/content/${encodeURIComponent(version)}.txt?passage=${encodeURIComponent(ref)}&style=oneVersePerLine`;
    const resp = await fetch(url, { headers: { "accept": "text/plain" }});
    if (!resp.ok) return "";
    return await resp.text();
  }

  // Converte referência PT-BR → EN (melhora acerto da API)
  function toEnglishRef(input){
    const s = deaccent(input.toLowerCase()).replace(/\s+/g," ").trim();
    const map = [
      [/^(gen|genes|genesis|gn)/, "Genesis"],
      [/^(exo|exodo|exodus|ex)/, "Exodus"],
      [/^(lev|levitico)/, "Leviticus"],
      [/^(num|numeros)/, "Numbers"],
      [/^(deu|deuteronomio)/, "Deuteronomy"],
      [/^(jos|josue)/, "Joshua"],
      [/^(jui|juizes|juizes)/, "Judges"],
      [/^(rute)/, "Ruth"],
      [/^(1 ?sam|i ?sam|1samuel)/, "1 Samuel"],
      [/^(2 ?sam|ii ?sam|2samuel)/, "2 Samuel"],
      [/^(1 ?reis|i ?reis)/, "1 Kings"],
      [/^(2 ?reis|ii ?reis)/, "2 Kings"],
      [/^(1 ?cron|i ?cron|1cronicas)/, "1 Chronicles"],
      [/^(2 ?cron|ii ?cron|2cronicas)/, "2 Chronicles"],
      [/^(esd|esdras)/, "Ezra"],
      [/^(neem|neemias)/, "Nehemiah"],
      [/^(est|ester)/, "Esther"],
      [/^(jo\b|job)/, "Job"],
      [/^(salmo?s?|sl\b)/, "Psalms"],
      [/^(prov|proverbios)/, "Proverbs"],
      [/^(ecl|eclesiastes)/, "Ecclesiastes"],
      [/^(cant|cantares|cantico)/, "Song of Solomon"],
      [/^(isa|isaias)/, "Isaiah"],
      [/^(jer|jeremias)/, "Jeremiah"],
      [/^(lam|lamentacoes)/, "Lamentations"],
      [/^(eze|ezequiel)/, "Ezekiel"],
      [/^(dan|daniel)/, "Daniel"],
      [/^(ose|oseias)/, "Hosea"],
      [/^(joe|joel)/, "Joel"],
      [/^(amo|amos)/, "Amos"],
      [/^(oba|obadias)/, "Obadiah"],
      [/^(jon|jonas)/, "Jonah"],
      [/^(miq|miqueias)/, "Micah"],
      [/^(naum)/, "Nahum"],
      [/^(hab|habacuque)/, "Habakkuk"],
      [/^(sof|sofonias)/, "Zephaniah"],
      [/^(ag|ageu)/, "Haggai"],
      [/^(zac|zacarias)/, "Zechariah"],
      [/^(mal|malaquias)/, "Malachi"],
      [/^(mat|mateus)/, "Matthew"],
      [/^(mar|marcos)/, "Mark"],
      [/^(luc|lucas)/, "Luke"],
      [/^(joa|joao)/, "John"],
      [/^(ato|atos)/, "Acts"],
      [/^(rom|romanos)/, "Romans"],
      [/^(1 ?cor|i ?cor)/, "1 Corinthians"],
      [/^(2 ?cor|ii ?cor)/, "2 Corinthians"],
      [/^(gal|galatas)/, "Galatians"],
      [/^(efe|efesios)/, "Ephesians"],
      [/^(fili|filipenses)/, "Philippians"],
      [/^(col|colossenses)/, "Colossians"],
      [/^(1 ?tes|i ?tes|1tessalonicenses)/, "1 Thessalonians"],
      [/^(2 ?tes|ii ?tes|2tessalonicenses)/, "2 Thessalonians"],
      [/^(1 ?tim|i ?tim)/, "1 Timothy"],
      [/^(2 ?tim|ii ?tim)/, "2 Timothy"],
      [/^(tit|tito)/, "Titus"],
      [/^(file|filemon)/, "Philemon"],
      [/^(heb|hebreus)/, "Hebrews"],
      [/^(tia|tiago)/, "James"],
      [/^(1 ?ped|i ?ped)/, "1 Peter"],
      [/^(2 ?ped|ii ?ped)/, "2 Peter"],
      [/^(1 ?joa|i ?joa)/, "1 John"],
      [/^(2 ?joa|ii ?joa)/, "2 John"],
      [/^(3 ?joa|iii ?joa)/, "3 John"],
      [/^(jud|judas)/, "Jude"],
      [/^(apo|apocalipse)/, "Revelation"]
    ];

    let livro = s, resto = "";
    const m = s.match(/^([a-z0-9º ]+?)\s+(.+)$/i);
    if (m) { livro = m[1]; resto = m[2]; }

    let en = "John";
    for (const [regex, name] of map) {
      if (regex.test(livro)) { en = name; break; }
    }
    return (en + " " + resto).trim();
  }

  function deaccent(str){
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  }
})();
