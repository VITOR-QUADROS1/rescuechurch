// --- helpers ---
const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

function isLikelyEnglish(s) {
  if (!s) return false;
  const hasAccents = /[áéíóúãõâêôçÁÉÍÓÚÃÕÂÊÔÇ]/.test(s);
  if (hasAccents) return false;
  const englishHits = (s.match(/\b(the|and|will|shall|because|but|world|son|god|him)\b/gi) || []).length;
  const portugueseHits = (s.match(/\b(de|do|da|que|porque|mas|Deus|mundo|filho)\b/gi) || []).length;
  return englishHits >= 2 && portugueseHits < 2;
}

async function translateToPT(text) {
  try {
    const url = `/api/translate?q=${encodeURIComponent(text)}&from=en&to=pt-BR`;
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    return j.text || text;
  } catch {
    return text;
  }
}

// --- Versículo do dia ---
async function loadVerseOfDay() {
  const box = $("#votd-text");
  const refEl = $("#votd-ref");
  box.textContent = "(carregando...)";
  refEl.textContent = "";

  try {
    const r = await fetch("/api/verse-of-day");
    const j = await r.json();
    let txt = j.text || "";
    if (isLikelyEnglish(txt)) {
      txt = await translateToPT(txt);
    }
    if (txt) {
      box.textContent = txt;
      refEl.textContent = `(${j.ref} — ${j.version})`;
    } else {
      box.textContent = "(erro ao carregar)";
      refEl.textContent = `(${j.ref} — ${j.version})`;
    }
  } catch {
    box.textContent = "(erro ao carregar)";
  }
}

// --- Busca na Bíblia ---
async function searchBible() {
  const input = $("#ref-input");
  const select = $("#version-select"); // mantém no layout
  const result = $("#result-box");
  result.textContent = "(buscando...)";

  const ref = (input.value || "").trim();
  if (!ref) { result.textContent = ""; return; }

  try {
    // chamamos sempre a mesma rota; o nome do arquivo é irrelevante
    const url = `/biblia/bible/content/NVI.txt?passage=${encodeURIComponent(ref)}`;
    const r = await fetch(url);
    let txt = await r.text();

    if (!r.ok || !txt) {
      result.textContent = "Nenhum resultado encontrado.";
      return;
    }

    // se vier inglês, traduz no cliente
    if (isLikelyEnglish(txt)) {
      txt = await translateToPT(txt);
    }

    result.textContent = txt;
  } catch {
    result.textContent = "Erro ao consultar a Bíblia.";
  }
}

// --- Copiar VOTD ---
function setupCopy() {
  const btn = $("#copy-votd");
  const box = $("#votd-text");
  btn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(box.textContent.trim());
      btn.classList.add("copied");
      setTimeout(() => btn.classList.remove("copied"), 1500);
    } catch {}
  });
}

// --- binds iniciais ---
function boot() {
  $("#search-btn")?.addEventListener("click", searchBible);
  $("#ref-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchBible();
  });
  setupCopy();
  loadVerseOfDay();
}

document.addEventListener("DOMContentLoaded", boot);
