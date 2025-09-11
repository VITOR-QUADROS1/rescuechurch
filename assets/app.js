// app.js (ESM com top-level await)

const $ = (q, r=document) => r.querySelector(q);

// carrega config e base do proxy
const cfg = await fetch("assets/config.json", { cache:"no-store" }).then(r=>r.json());
const API = cfg.proxy.workerBase.replace(/\/+$/,""); // ex.: https://rescue-proxy....workers.dev  :contentReference[oaicite:1]{index=1}

$("#yy").textContent = new Date().getFullYear();

/* Versões da Bíblia (mantém seu layout/DOM) */
const verSel = $("#ver");
Object.entries(cfg.biblia.versions).forEach(([label, val])=>{
  const o = document.createElement("option");
  o.value = val; o.textContent = label;
  if (val === cfg.biblia.defaultVersion) o.selected = true;
  verSel.appendChild(o);
});

/* Utilitário para buscar texto de uma referência */
async function getPassageText(ver, ref){
  const url = `${API}/biblia/bible/content/${encodeURIComponent(ver)}.txt?passage=${encodeURIComponent(ref)}&style=oneVerse`;
  const r = await fetch(url, { headers:{Accept:"text/plain"} });
  if (!r.ok) return "";
  return (await r.text()).trim();
}

/* Versículo do dia (com fallback para garantir TEXTO) */
async function loadVerseOfDay(){
  const ver = verSel.value || cfg.biblia.defaultVersion;
  try{
    const r = await fetch(`${API}/api/verse-of-day?ver=${encodeURIComponent(ver)}`);
    if(!r.ok) throw new Error(await r.text());
    const j = await r.json(); // { ref, version, text }

    let text = j.text || "";
    if (!text && j.ref) {
      // fallback: pega o texto da referência via /biblia/...
      text = await getPassageText(ver, j.ref);
    }

    if (text) {
      $("#vday").textContent   = text;
      $("#vdayRef").textContent = `(${j.ref} — ${j.version})`;
    } else {
      $("#vday").textContent    = "Não foi possível carregar agora.";
      $("#vdayRef").textContent = "Tente novamente mais tarde.";
    }
  }catch(e){
    console.warn("V-OF-DAY", e);
    $("#vday").textContent    = "Não foi possível carregar agora.";
    $("#vdayRef").textContent = "Tente novamente mais tarde.";
  }
}
$("#btnCopy").onclick = () => {
  const t = `${$("#vday").textContent} ${$("#vdayRef").textContent}`;
  navigator.clipboard.writeText(t);
};
await loadVerseOfDay();

/* Busca na Bíblia (mesmo layout/DOM) */
async function runSearch(){
  const q = $("#q").value.trim();
  let ver = $("#ver").value || cfg.biblia.defaultVersion;
  if(!q){ $("#result").textContent=""; return; }

  $("#result").textContent = "Procurando...";
  try{
    // primeira tentativa com a versão escolhida
    let url = `${API}/biblia/bible/content/${encodeURIComponent(ver)}.txt?passage=${encodeURIComponent(q)}&style=oneVerse`;
    let r = await fetch(url, { headers:{Accept:"text/plain"} });
    let text = (await r.text()).trim();

    // Fallback para NTLH (caso a versão escolhida retorne vazio/erro)
    if(!r.ok || !text){
      ver = "POR-NTLH";
      url = `${API}/biblia/bible/content/${ver}.txt?passage=${encodeURIComponent(q)}&style=oneVerse`;
      r = await fetch(url, { headers:{Accept:"text/plain"} });
      text = (await r.text()).trim();
    }

    if(!text) throw new Error("sem texto");
    $("#result").textContent = text;
  }catch(e){
    console.warn("SEARCH", e);
    $("#result").textContent = "Erro na consulta. Tente outra palavra ou referência (ex.: João 3:16).";
  }
}
$("#btnSearch").onclick = runSearch;
$("#q").addEventListener("keydown", e=>e.key==="Enter" && runSearch());
