// app.js (ESM)

const $ = (q, r = document) => r.querySelector(q);
const cfg = await fetch("assets/config.json", { cache: "no-store" }).then(r => r.json());
const API = cfg.proxy.workerBase.replace(/\/+$/, "");

$("#yy").textContent = new Date().getFullYear();

/* === Versões === */
const verSel = $("#ver");
Object.entries(cfg.biblia.versions).forEach(([label, val]) => {
  const o = document.createElement("option");
  o.value = val; o.textContent = label;
  if (val === cfg.biblia.defaultVersion) o.selected = true;
  verSel.appendChild(o);
});

/* === Versículo do dia === */
async function loadVerseOfDay() {
  const ver = verSel.value || cfg.biblia.defaultVersion;
  try {
    const r = await fetch(`${API}/api/verse-of-day?ver=${encodeURIComponent(ver)}`);
    if (!r.ok) throw new Error(await r.text());
    const j = await r.json();

    // se o Worker já trouxe o texto, usa; senão busca direto no /biblia/*
    let text = j.text;
    if (!text && j.ref) {
      const url = `${API}/biblia/bible/content/${encodeURIComponent(ver)}.txt?passage=${encodeURIComponent(j.ref)}&style=oneVerse`;
      const rt = await fetch(url, { headers: { Accept: "text/plain" } });
      text = (await rt.text()).trim();
    }

    $("#vday").textContent = text || "—";
    $("#vdayRef").textContent = j.ref ? `(${j.ref} — ${j.version})` : "";
  } catch (e) {
    $("#vday").textContent = "Não foi possível carregar agora.";
    $("#vdayRef").textContent = "Tente novamente mais tarde.";
  }
}
$("#btnCopy")?.addEventListener("click", () => {
  const t = `${$("#vday").textContent} ${$("#vdayRef").textContent}`.trim();
  if (t) navigator.clipboard.writeText(t);
});
await loadVerseOfDay();

/* === Busca na Bíblia === */
function mapPTtoEN(s) {
  const m = {
    "gênesis":"Genesis","genesis":"Genesis",
    "êxodo":"Exodus","exodo":"Exodus",
    "joão":"John","joao":"John",
    "mateus":"Matthew","marcos":"Mark","lucas":"Luke","atos":"Acts",
    "romanos":"Romans","salmos":"Psalms","provérbios":"Proverbs","proverbios":"Proverbs",
    "isaías":"Isaiah","isaias":"Isaiah","jeremias":"Jeremiah","hebreus":"Hebrews"
  };
  const [livro, resto] = String(s).trim().split(/\s+(.+)/);
  const k = livro.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const book = m[k] || livro;
  return resto ? `${book} ${resto}` : book;
}

async function runSearch() {
  const q = $("#q").value.trim();
  let ver = $("#ver").value || cfg.biblia.defaultVersion;
  if (!q) { $("#result").textContent = ""; return; }

  $("#result").textContent = "Procurando...";
  const tryGet = async ref => {
    const url = `${API}/biblia/bible/content/${encodeURIComponent(ver)}.txt?passage=${encodeURIComponent(ref)}&style=oneVerse`;
    const r = await fetch(url, { headers: { Accept: "text/plain" } });
    return (await r.text()).trim();
  };

  try {
    let text = await tryGet(q);
    if (!text) text = await tryGet(mapPTtoEN(q));  // fallback EN
    if (!text) throw new Error("sem texto");
    $("#result").textContent = text;
  } catch {
    $("#result").textContent =
      "Erro na consulta. Tente outra palavra ou referência (ex.: João 3:16).";
  }
}
$("#btnSearch")?.addEventListener("click", runSearch);
$("#q")?.addEventListener("keydown", e => e.key === "Enter" && runSearch());

/* === Vídeos (mantive seu JS; se quiser voltamos depois) === */
// Você comentou que quer manter o layout atual; então não alterei aqui.
