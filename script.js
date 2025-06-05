// Wordle Solver — Español   v5.2  (con pestaña Comparar ≤25)

/* =================== PARÁMETROS =================== */
const COLORES = ["gris","amarillo","verde"];
const ALFABETO = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");
const EXCEL_THRESHOLD = 800;     // entropía exacta hasta este tamaño

/* ==================== ESTADO ====================== */
const dicList = (typeof diccionario !== "undefined")
  ? diccionario.map(x => x.toUpperCase())
  : [];

let history = [];          // [{word:'RASEN', colors:['gris',…]}]
let candidatas = [];       // se recalcula con “Generar sugerencias”
let entropyCache = {};     // palabra -> H
let cacheVersion = 0;      // invalidar al cambiar candidatas

/* ==================== UTILS ======================= */
const $ = id => document.getElementById(id);
const on = (id, fn) => $(id).addEventListener("click", fn);
function ensureBody(id) {
  const t = $(id); if (!t) return null;
  let b = t.querySelector("tbody");
  if (!b) { b = document.createElement("tbody"); t.appendChild(b); }
  return b;
}
function normal(w) {
  return w.toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/Ü/g,'U');
}

/* ============ INICIALIZACIÓN DE LA UI ============= */
document.addEventListener("DOMContentLoaded", () => {
  construirSelectColores();
  on("btnGuardar", guardarIntento);
  on("btnReset",   resetear);
  on("btnCalcular", generarListas);
  on("btnBuscarUsuario", buscarPalabrasUsuario);
  on("btnRunCompare", runCompare);

  on("tabSolver",  () => showTab("solver"));
  on("tabLetras",  () => showTab("buscar"));
  on("tabCompare", () => showTab("compare"));

  showTab("solver");
});

/* ================ CAMBIO DE PESTAÑA ================ */
function showTab(name){
  $("panelSolver").style.display = name==="solver" ? "" : "none";
  $("panelBuscar").style.display = name==="buscar" ? "" : "none";
  $("panelCompare").style.display= name==="compare"? "" : "none";
  ["tabSolver","tabLetras","tabCompare"].forEach(id=>{
    $(id).classList.toggle("active", id==="tab"+(name==="buscar"?"Letras":name.charAt(0).toUpperCase()+name.slice(1)));
  });
}

/* ========= CONSTRUCCIÓN DE SELECT COLORES ========= */
function construirSelectColores(){
  for(let i=0;i<5;i++){
    const sel = $("color"+i); sel.innerHTML='';
    COLORES.forEach(c=>{
      const opt=document.createElement("option"); opt.value=c; opt.textContent=c;
      sel.appendChild(opt);
    });
    sel.value="gris";
  }
}

/* ================= GESTIÓN INTENTOS ================ */
function leerColores(){ return Array.from({length:5},(_,i)=>$("color"+i).value); }

function guardarIntento(){
  const w = normal($("guess").value.trim());
  if(!/^[A-ZÑ]{5}$/.test(w)){ alert("Introduce 5 letras"); return; }
  history.push({word:w, colors:leerColores()});
  $("guess").value='';
  construirSelectColores();
  renderHistorial();
}

function resetear(){
  history=[]; candidatas=[]; entropyCache={}; cacheVersion++;
  ["tablaResolver","tablaDescartar","tablaVerde","tablaLetras"].forEach(id=>ensureBody(id).innerHTML='');
  $("candCount").textContent='0';
  $("compareArea").innerHTML='';
  renderHistorial();
  toggleCompareBtn();
}

function renderHistorial(){
  $("historial").textContent = history.map(h=>`${h.word} → ${h.colors.join(', ')}`).join('\n');
}

/* ============== FILTRO DE CANDIDATAS =============== */
function construirFiltro(){
  const patron = Array(5).fill('.');
  const setAmar=new Set(), setVerde=new Set(), setGris=new Set();
  const posNo = []; // {ch,pos}

  for(const h of history){
    for(let i=0;i<5;i++){
      const ch=h.word[i], col=h.colors[i];
      if(col==="verde"){ patron[i]=ch; setVerde.add(ch); }
      else if(col==="amarillo"){ setAmar.add(ch); posNo.push({ch,pos:i}); }
      else setGris.add(ch);
    }
  }
  return {pat:new RegExp('^'+patron.join('')+'$'), setAmar,setVerde,setGris,posNo};
}
function filtrar(lista,flt){
  return lista.filter(w=>{
    if(!flt.pat.test(w)) return false;
    for(const {ch,pos} of flt.posNo) if(w[pos]===ch) return false;
    for(const ch of flt.setAmar) if(!w.includes(ch)) return false;
    for(const ch of flt.setGris) if(!flt.setVerde.has(ch)&&!flt.setAmar.has(ch)&&w.includes(ch)) return false;
    return true;
  });
}

/* ================ ENTROPÍA EXACTA ================== */
function keyPatron(sol,guess){
  const res=Array(5).fill(0), usados=Array(5).fill(false);
  for(let i=0;i<5;i++) if(sol[i]===guess[i]){res[i]=2; usados[i]=true;}
  for(let i=0;i<5;i++) if(res[i]===0){
    for(let j=0;j<5;j++) if(!usados[j] && guess[i]===sol[j]){res[i]=1; usados[j]=true; break;}
  }
  return res.join('');
}
function entropia(guess,cands){
  const mapa=new Map(), n=cands.length;
  for(const s of cands){ const k=keyPatron(s,guess); mapa.set(k,(mapa.get(k)||0)+1); }
  const sum2=[...mapa.values()].reduce((a,x)=>a+x*x,0);
  return n - sum2/n;
}

/* ================ SUGERENCIAS RÁPIDO ================ */
function scoreRapido(lista){
  const freq=new Map();
  lista.forEach(w=>w.split('').forEach(ch=>freq.set(ch,(freq.get(ch)||0)+1)));
  const mapa=new Map();
  lista.forEach(w=>{
    let s=0; new Set(w).forEach(ch=>s+=freq.get(ch));
    mapa.set(w,s);
  });
  return mapa;
}

/* ================ TABLAS PRINCIPALES ================ */
function generarListas(){
  const filtro = construirFiltro();
  candidatas   = filtrar(dicList, filtro);
  $("candCount").textContent = candidatas.length;
  toggleCompareBtn();

  if(candidatas.length===0){ alert("Sin palabras posibles"); return; }

  const exact = candidatas.length<=EXCEL_THRESHOLD;
  const mapaRapido = exact? null : scoreRapido(candidatas);

  const base = candidatas.map(w=>({
    w, h: exact? entropia(w,candidatas) : mapaRapido.get(w)
  })).sort((a,b)=>b.h-a.h);

  renderTabla("tablaResolver", base.slice(0,200));

  /* mejor descarte rápido: palabras con más letras nuevas */
  const ya = new Set(); history.forEach(h=>h.word.split('').forEach(ch=>ya.add(ch)));
  const desc = dicList
    .filter(w=>!candidatas.includes(w))
    .map(w=>{
      const uniq = new Set(w);
      let s=0; uniq.forEach(ch=>{ if(!ya.has(ch)) s++; });
      return {w,h:-s};      // negativo → ordenar al revés luego
    })
    .sort((a,b)=>a.h-b.h).slice(0,15);

  renderTabla("tablaDescartar", desc.map(o=>({w:o.w,h:-o.h})));

  /* repetición verde */
  const verde=filtro.pat.source.split('').map((c,i)=>c==='.'?null:filtro.pat.source[i]);
  const rep = dicList.filter(w=>verde.some((ch,i)=>ch&&w[i]!==ch&&w.includes(ch)))
                     .map(w=>({w,h: exact? entropia(w,candidatas):0}))
                     .sort((a,b)=>b.h-a.h).slice(0,15);
  renderTabla("tablaVerde", rep);

  /* frecuencias */
  const freq = ALFABETO.map(ch=>{
    let ap=0,pal=0,rep=0;
    candidatas.forEach(w=>{
      let cnt=0; w.split('').forEach(c=>{ if(c===ch){ap++;cnt++;}});
      if(cnt){pal++; if(cnt>1)rep++; }
    });
    return {ch,ap,pal,rep};
  }).sort((a,b)=>b.pal-a.pal);
  renderTablaFreq("tablaLetras", freq);
}

/* ========= RENDER TABLAS GENERALES ========= */
function renderTabla(id, list){
  const tb=ensureBody(id); if(!tb) return; tb.innerHTML='';
  list.forEach(o=>{
    const tr=document.createElement("tr");
    ["w","h"].forEach(k=>{
      const td=document.createElement("td");
      td.textContent = k==="h" ? o[k].toFixed(2) : o[k];
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
}
function renderTablaFreq(id,list){
  const tb=ensureBody(id); if(!tb) return; tb.innerHTML='';
  list.forEach(r=>{
    const tr=document.createElement("tr");
    [r.ch,r.ap,r.pal,r.rep].forEach(t=>{
      const td=document.createElement("td"); td.textContent=t; tr.appendChild(td);});
    tb.appendChild(tr);
  });
}

/* ================ BUSCAR LETRAS ================ */
function buscarPalabrasUsuario(){
  const raw=normal($("inputLetras").value).replace(/[^A-ZÑ]/g,'');
  if(!raw){alert("Introduce letras");return;}
  const letras=[...new Set(raw.split(''))];
  if(letras.length>5){alert("Máximo 5 letras");return;}
  let res={};
  for(let omit=0;omit<=letras.length;omit++){
    const combs=combinar(letras,letras.length-omit);
    combs.forEach(c=>{
      const hits=dicList.filter(w=>c.every(l=>w.includes(l)));
      if(hits.length) res[c.join('')]=hits;
    });
    if(Object.keys(res).length) break;
  }
  const div=$("resultadoBusqueda");
  if(!Object.keys(res).length){div.textContent="Sin resultados";return;}
  div.innerHTML = Object.entries(res).map(([c,w])=>
    `<h4>Usando ${c} (${w.length})</h4><pre>${w.join(', ')}</pre>`).join('');
}
function combinar(arr,k){
  const out=[], rec=(idx,comb)=>{
    if(comb.length===k){out.push(comb.slice());return;}
    for(let i=idx;i<arr.length;i++){comb.push(arr[i]);rec(i+1,comb);comb.pop();}
  }; rec(0,[]); return out;
}

/* ================ COMPARAR ≤ 25 ================= */
function toggleCompareBtn(){ $("tabCompare").disabled=candidatas.length>25; }

/* paleta 25 colores contrastados */
const palette = [
  '#ffcc00','#4da6ff','#66cc66','#ff6666','#c58aff','#ffa64d',
  '#4dd2ff','#99ff99','#ff80b3','#b3b3ff','#ffd24d','#3399ff',
  '#77dd77','#ff4d4d','#c299ff','#ffb84d','#00bfff','#99e699',
  '#ff99c2','#9999ff','#ffe066','#0080ff','#66ffb3','#ff4da6','#8080ff'
];

function runCompare(){
  if(candidatas.length>25){alert("Necesitas 25 o menos candidatas");return;}
  const extra=normal($("extraInput").value).split(/[^A-ZÑ]/).filter(x=>x.length===5).slice(0,2);
  const words=[...candidatas.slice(0,25-extra.length),...extra];
  const n=words.length; if(!n){$("compareArea").textContent="No words";return;}

  // matriz de patrones
  const pat=words.map(g=>words.map(s=>keyPatron(s,g)));

  let html='<table style="border-collapse:collapse;font-size:11px"><thead><tr><th></th>';
  words.forEach(w=>html+=`<th>${w}</th>`); html+='<th>opciones</th></tr></thead><tbody>';

  for(let i=0;i<n;i++){
    const row=pat[i], grupos={};
    row.forEach((p,idx)=>{ (grupos[p]=grupos[p]||[]).push(idx); });
    let colorIdx=0; Object.values(grupos).forEach(g=>{if(g.length>1) g.color=palette[colorIdx++];});
    let sinJump=0;
    html+=`<tr><th>${words[i]}</th>`;
    for(let j=0;j<n;j++){
      const p=row[j], g=grupos[p];
      const prox=g.find(c=>c>j); const salto=prox?prox-j:0;
      if(salto===0) sinJump++;
      const bg=g.color||'#f2f2f2';
      html+=`<td style="text-align:center;background:${bg}">${p}-${salto}</td>`;
    }
    html+=`<td style="text-align:center;font-weight:bold">${sinJump}</td></tr>`;
  }
  html+='</tbody></table>';
  $("compareArea").innerHTML = html;
}
