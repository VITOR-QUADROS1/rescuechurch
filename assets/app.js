const $ = (q, r = document) => r.querySelector(q);
const cfg = await fetch("assets/config.json", { cache: "no-store" }).then(r => r.json());
const API = cfg.proxy.workerBase.replace(/\/+$/, "");
$("#yy").textContent = new Date().getFullYear();

/* versões */
const verSel = $("#ver");
Object.entries(cfg.biblia.versions).forEach(([label, val]) => {
  const o = document.createElement("option");
  o.value = val; o.textContent = label;
  if (val === cfg.biblia.defaultVersion) o.selected = true;
  verSel.appendChild(o);
});

/* util local (fallback PT->EN) */
function mapPTtoEN(s) {
  const m = {
    "gênesis":"Genesis","genesis":"Genesis","êxodo":"Exodus","exodo":"Exodus",
    "salmos":"Psalms","provérbios":"Proverbs","proverbios":"Proverbs",
    "joão":"John","joao":"John","mateus":"Matthew","marcos":"Mark","lucas":"Luke",
    "isaías":"Isaiah","isaias":"Isaiah","jeremias":"Jeremiah","hebreus":"Hebrews",
    "romanos":"Romans","prov":"Proverbs"
  };
  const [book, rest = ""] = String(s).trim().split(/\s+(.+)/);
  const k = book.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const b = m[k] || book;
  return rest ? `${b} ${rest}` : b;
}
function refVariants(refRaw) {
  const ref = String(refRaw).trim();
  const out = new Set([ref, mapPTtoEN(ref)]);
  const withDot = ref.replace(/:/g, ".");
  out.add(withDot);
  out.add(mapPTtoEN(withDot));
  const glued = withDot.replace(/\s+/g, "");
  out.add(mapPTtoEN(glued));
  // capítulo sem versículo? força :1
  if (!/[:.]/.test(ref)) {
    out.add(mapPTtoEN(ref + ":1"));
    out.add(mapPTtoEN(ref + ".1"));
  }
  return Array.from(out);
}

/* versículo do dia */
async function loadVerseOfDay() {
  const ver = verSel.value || cfg.biblia.defaultVersion;
  try {
    const r = await fetch(`${API}/api/verse-of-day?ver=${encodeURIComponent(ver)}`);
    if (!r.ok) throw new Error(await r.text());
    const j = await r.json();

    let text = j.text?.trim();
    if (!text && j.ref) {
      // fallback local tentando variações
      for (const cand of refVariants(j.ref)) {
        const url = `${API}/biblia/bible/content/${encodeURIComponent(ver)}.txt?passage=${encodeURIComponent(cand)}&style=oneVerse`;
        const rr = await fetch(url, { headers: { Accept: "text/plain" } });
        text = (await rr.text()).trim();
        if (text) break;
      }
    }

    $("#vday").textContent = text || "—";
    $("#vdayRef").textContent = j.ref ? `(${j.ref} — ${j.version})` : "";
  } catch {
    $("#vday").textContent = "Não foi possível carregar agora.";
    $("#vdayRef").textContent = "Tente novamente mais tarde.";
  }
}
$("#btnCopy")?.addEventListener("click", () => {
  const t = `${$("#vday").textContent} ${$("#vdayRef").textContent}`.trim();
  if (t) navigator.clipboard.writeText(t);
});
await loadVerseOfDay();

/* busca */
async function runSearch() {
  const q = $("#q").value.trim();
  let ver = $("#ver").value || cfg.biblia.defaultVersion;
  if (!q) { $("#result").textContent = ""; return; }

  $("#result").textContent = "Procurando...";
  try {
    let text = "";
    for (const cand of refVariants(q)) {
      const url = `${API}/biblia/bible/content/${encodeURIComponent(ver)}.txt?passage=${encodeURIComponent(cand)}&style=oneVerse`;
      const r = await fetch(url, { headers: { Accept: "text/plain" } });
      text = (await r.text()).trim();
      if (text) break;
    }
    if (!text) throw new Error("not found");
    $("#result").textContent = text;
  } catch {
    $("#result").textContent = "Erro na consulta. Tente outra palavra ou referência (ex.: João 3:16).";
  }
}
$("#btnSearch")?.addEventListener("click", runSearch);
$("#q")?.addEventListener("keydown", e => e.key === "Enter" && runSearch());
