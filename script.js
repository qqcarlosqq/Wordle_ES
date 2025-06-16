// Wordle Solver — Español  v5.8  (heurística rápida con peso de posición)

/* ---------- Config ---------- */
const COLORES = ["gris", "amarillo", "verde"];
const ALFABETO = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");
const EXACTO_HASTA = 2000;   // umbral para usar entropía exacta

/* ---------- Diccionario ---------- */
const dicList = (typeof diccionario !== "undefined")
  ? diccionario.map(w => w.toUpperCase())
  : [];

/* ---------- Estado ---------- */
let history = [];           // [{word, colors:[] }]
let candidatas = [];
let version   = 0;
let entCache  = new Map();  // memo entropías exactas

/* ---------- Helpers DOM ---------- */
const $  = id => document.getElementById(id);
const on = (id, fn) => $(id).addEventListener("click", fn);
const ensureBody = id => { const t=$(id); if(!t) return null; let b=t.querySelector("tbody"); if(!b){b=document.createElement("tbody"); t.appendChild(b);} return b; };

/* ---------- Upper que conserva la Ñ ---------- */
const upper = s => s.toUpperCase()
  .normalize("NFD")
  .replace(/N\u0303/g,"Ñ")
  .replace(/[\u0300-\u036f]/g,"")
  .replace(/Ü/g,"U");

/* ---------- UI init ---------- */
document.addEventListener("DOMContentLoaded",()=>{
  buildColorSelects();
  on("btnGuardar",guardarIntento);
  on("btnReset",resetear);
  on("btnCalcular",generarListas);
  on("btnBuscarUsuario",buscarPalabrasUsuario);
  on("btnRunCompare",runCompare);
  on("tabSolver", ()=>showTab("solver"));
  on("tabLetras", ()=>showTab("buscar"));
  on("tabCompare",()=>showTab("compare"));
  showTab("solver");
});

/* ---------- Tabs & color selects ---------- */
function showTab(t){
  $("panelSolver").style.display=t==="solver"?"":"none";
  $("panelBuscar").style.display=t==="buscar"?"":"none";
  $("panelCompare").style.display=t==="compare"?"":"none";
  ["tabSolver","tabLetras","tabCompare"].forEach(id=>$(id).classList.toggle("active", id==="tab"+(t==="buscar"?"Letras":t.charAt(0).toUpperCase()+t.slice(1))));
}
function buildColorSelects(){
  for(let i=0;i<5;i++){
    const s=$("color"+i); if(!s) continue;
    s.innerHTML="";
    COLORES.forEach(c=>{const o=document.createElement("option"); o.value=o.textContent=c; s.appendChild(o);} );
    s.value="gris";
  }
}
const readColors = () => Array.from({length:5},(_,i)=>$("color"+i).value);

/* ---------- Historial ---------- */
function guardarIntento(){
  const w = upper($("guess").value.trim());
  if(!/^[A-ZÑ]{5}$/.test(w)) { alert("Introduce 5 letras"); return; }

  // --- Comprobación en diccionario ---
  if(!dicList.includes(w)) {
    const seguir = confirm(`La palabra "${w}" no está en el diccionario español.
¿Deseas continuar de todos modos?`);
    if(!seguir) {
      // Abortar: se limpia la entrada y los selectores de color
      $("guess").value = "";
      buildColorSelects();
      return;
    }
  }

  history.push({ word: w, colors: readColors() });
  $("guess").value = "";
  buildColorSelects();
  renderHist();
}
function resetear(){
  history=[]; candidatas=[]; entCache.clear(); version++;
  ["tablaResolver","tablaDescartar","tablaVerde","tablaLetras"].forEach(id=>ensureBody(id).innerHTML="");
  $("candCount").textContent="0";
  $("compareArea").innerHTML="";
  renderHist();
  compareSelectMode=false; $("btnRunCompare").textContent="Comparar";
  toggleCompareBtn();
}
function renderHist(){
  $("historial").textContent = history.map(h=>`${h.word} → ${h.colors.join(', ')}`).join("\n");
}

/* ---------- Filtro de candidatas ---------- */
function construirFiltro(){
  const pat=Array(5).fill('.');
  const setGreen=new Set(), setYellow=new Set(), setGray=new Set();
  const posNo=[];
  history.forEach(h=>{
    for(let i=0;i<5;i++){
      const ch=h.word[i], col=h.colors[i];
      if(col==="verde"){ pat[i]=ch; setGreen.add(ch); }
      else if(col==="amarillo"){ setYellow.add(ch); posNo.push({ch,pos:i}); }
      else setGray.add(ch);
    }
  });
  return {regexp:new RegExp('^'+pat.join('')+'$'), setGreen,setYellow,setGray,posNo};
}
function filtrar(lista,f){
  return lista.filter(w=>{
    if(!f.regexp.test(w)) return false;
    for(const {ch,pos} of f.posNo) if(w[pos]===ch) return false;
    for(const ch of f.setYellow) if(!w.includes(ch)) return false;
    for(const ch of f.setGray) if(!f.setGreen.has(ch)&&!f.setYellow.has(ch)&&w.includes(ch)) return false;
    return true;
  });
}

/* ---------- Métricas ---------- */
function patronClave(sol,guess){
  const out=Array(5).fill(0), used=Array(5).fill(false);
  for(let i=0;i<5;i++) if(sol[i]===guess[i]){ out[i]=2; used[i]=true; }
  for(let i=0;i<5;i++) if(out[i]===0){
    for(let j=0;j<5;j++) if(!used[j]&&guess[i]===sol[j]){ out[i]=1; used[j]=true; break; }
  }
  return out.join('');
}
function entropiaExacta(word){
  const c=entCache.get(word); if(c&&c.v===version) return c.h;
  const n=candidatas.length;
  const m=new Map();
  candidatas.forEach(s=>{ const k=patronClave(s,word); m.set(k,(m.get(k)||0)+1); });
  const sum=[...m.values()].reduce((a,x)=>a+x*x,0);
  const h=n - sum/n;
  entCache.set(word,{v:version,h});
  return h;
}

/* ---------- Heurística rápida con peso de posición ---------- */
let rapidoHelper=null; // {freq,posFreq,scale,map,calc}
function buildRapido(lista){
  const freq=new Map();
  const posFreq = Array.from({length:5},()=>new Map());
  // recuentos
  lista.forEach(w=>{
    w.split('').forEach((ch,i)=>{
      freq.set(ch,(freq.get(ch)||0)+1);
      posFreq[i].set(ch,(posFreq[i].get(ch)||0)+1);
    });
  });

  // score: 30 % letras únicas, 70 % posición
  const rawScore=w=>{
    let sUniq=0; new Set(w).forEach(ch=> sUniq+=(freq.get(ch)||0));
    let sPos=0;  w.split('').forEach((ch,i)=> sPos+=(posFreq[i].get(ch)||0));
    return 0.3*sUniq + 0.7*sPos;
  };

  let maxRaw=0; lista.forEach(w=>{ const v=rawScore(w); if(v>maxRaw) maxRaw=v; });
  const scale=(lista.length-1)/maxRaw;
  const map=new Map(); lista.forEach(w=>map.set(w, +(rawScore(w)*scale).toFixed(2)));
  const calc=w=> +(rawScore(w)*scale).toFixed(2);
  return {freq,posFreq,scale,map,calc};
}

/* ---------- Listas principales ---------- */
function generarListas(){
  const filtro=construirFiltro();
  candidatas=filtrar(dicList,filtro);
  $("candCount").textContent=candidatas.length;
  toggleCompareBtn();
  compareSelectMode=false; $("btnRunCompare").textContent="Comparar";
  $("compareArea").innerHTML="";
  if(!candidatas.length){ alert("Sin palabras posibles"); return; }

  entCache.clear(); version++;
  const exact = candidatas.length <= EXACTO_HASTA;
  if(!exact) rapidoHelper=buildRapido(candidatas);

  const getH = w => exact ? entropiaExacta(w) : (rapidoHelper.map.get(w) || rapidoHelper.calc(w));
  const yellow=filtro.setYellow;
  const contieneY = w=>[...yellow].some(ch=>w.includes(ch));

  const listaRes = candidatas.map(w=>({w,h:getH(w)})).sort((a,b)=>b.h-a.h).slice(0,200);
  renderTabla("tablaResolver", listaRes);

  const listaDesc = dicList.filter(w=>!candidatas.includes(w) && !contieneY(w))
    .map(w=>({w,h:getH(w)}))
    .sort((a,b)=>b.h-a.h).slice(0,200);
  renderTabla("tablaDescartar", listaDesc);

  const listaVerde = candidatas
    .filter(w=>{ const s=new Set(w); return s.size<5 && ![...s].some(ch=>yellow.has(ch)); })
    .map(w=>({w,h: exact? entropiaExacta(w) : 0}))
    .sort((a,b)=>b.h-a.h)
    .slice(0,15);
  renderTabla("tablaVerde", listaVerde);

  /* ---------- Frecuencias de letras ---------- */
  const freq = ALFABETO.map(ch=>{
    let ap=0,pal=0,rep=0;
    candidatas.forEach(w=>{
      const cnt=w.split('').filter(c=>c===ch).length;
      if(cnt){ ap+=cnt; pal++; if(cnt>1) rep++; }
    });
    return {ch,ap,pal,rep};
  }).sort((a,b)=>b.pal-a.pal);
  renderTablaFreq("tablaLetras", freq);
}

/* ---------- Render tablas ---------- */
function renderTabla(id,list){
  const tb=ensureBody(id); if(!tb) return; tb.innerHTML="";
  list.forEach(r=>{
    const tr=document.createElement("tr");
    [r.w,r.h].forEach(t=>{ const td=document.createElement("td"); td.textContent=t; tr.appendChild(td); });
    tb.appendChild(tr);
  });
}
function renderTablaFreq(id,list){
  const tb=ensureBody(id); if(!tb) return; tb.innerHTML="";
  list.forEach(r=>{
    const tr=document.createElement("tr");
    [r.ch,r.ap,r.pal,r.rep].forEach(t=>{ const td=document.createElement("td"); td.textContent=t; tr.appendChild(td); });
    tb.appendChild(tr);
  });
}

/*/* ---------- Buscar letras ---------- */
function buscarPalabrasUsuario(){
  const raw = upper($("inputLetras").value).replace(/[^A-ZÑ]/g,"");
  if(!raw){ alert("Introduce letras"); return; }
  const letras=[...new Set(raw.split(''))];
  if(letras.length>10){ alert("Máx 10 letras"); return; }

  // buscamos el mayor k cuyo conjunto de combinaciones produzca al menos 1 palabra
  const resultados={};
  for(let k=letras.length; k>=1; k--){
    combinar(letras,k).forEach(c=>{
      const hits = dicList.filter(w=> c.every(ch=>w.includes(ch)) );
      if(hits.length) resultados[c.join('')] = hits;
    });
    if(Object.keys(resultados).length) break; // nivel más alto con resultados encontrado
  }

  const html = Object.entries(resultados)
    .sort((a,b)=>b[0].length-a[0].length || a[0].localeCompare(b[0]))
    .map(([c,w])=>`<h4>Usando ${c} (${w.length})</h4><pre style="white-space:pre-wrap">${w.join(', ')}</pre>`)
    .join('');
  $("resultadoBusqueda").innerHTML = html || '<p>No se encontró ninguna palabra</p>';
}

function combinar(arr,k){
  const out=[];
  const rec=(s,a)=>{
    if(a.length===k){ out.push(a.slice()); return; }
    for(let i=s;i<arr.length;i++){ a.push(arr[i]); rec(i+1,a); a.pop(); }
  };
  rec(0,[]);
  return out;
}

/* ---------- Compare (≤100 con selección) ---------- *//* ---------- Compare (≤100 con selección) ---------- */
function toggleCompareBtn(){ $("tabCompare").disabled = candidatas.length===0 || candidatas.length>100; }

// paleta alto contraste (25 colores)
const palette=[
  "#ffcc00","#4da6ff","#66cc66","#ff6666","#c58aff","#ffa64d",
  "#4dd2ff","#99ff99","#ff80b3","#b3b3ff","#ffd24d","#3399ff",
  "#77dd77","#ff4d4d","#c299ff","#ffb84d","#00bfff","#99e699",
  "#ff99c2","#9999ff","#ffe066","#0080ff","#66ffb3","#ff4da6",
  "#8080ff"
];

let compareSelectMode=false; // true = estamos seleccionando palabras

function buildSelectionList(lista, preselectAll){
  let html='<p><strong>Selecciona hasta 25 palabras</strong> y pulsa de nuevo "Comparar seleccionadas":</p>';
  html+='<div style="max-height:300px;overflow:auto;columns:140px auto;">';
  lista.forEach(w=>{
    const ck=preselectAll?'checked':'';
    html+=`<label style="display:block;white-space:nowrap;"><input type="checkbox" class="selWord" value="${w}" ${ck}> ${w}</label>`;
  });
  html+='</div>';
  $("compareArea").innerHTML=html;
}

function drawCompareTable(words){
  const n=words.length; if(!n){ $("compareArea").textContent="No words"; return; }
  const pat = words.map(g=>words.map(s=>patronClave(s,g)));
  let html='<table style="border-collapse:collapse;font-size:11px"><thead><tr><th></th>';
  words.forEach(w=>html+=`<th>${w}</th>`);
  html+='<th>opciones</th></tr></thead><tbody>';
  for(let i=0;i<n;i++){
    const row=pat[i], groups={};
    row.forEach((p,idx)=>{ (groups[p]=groups[p]||[]).push(idx); });
    let idxColor=0; Object.values(groups).forEach(g=>{ if(g.length>1) g.color=palette[idxColor++%palette.length]; });
    let zeros=0;
    html+=`<tr><th>${words[i]}</th>`;
    for(let j=0;j<n;j++){
      const p=row[j], g=groups[p];
      const jump=g.find(x=>x>j)?g.find(x=>x>j)-j:0;
      if(jump===0) zeros++;
      const bg=g.color||"#f2f2f2";
      html+=`<td style="text-align:center;background:${bg}">${p}-${jump}</td>`;
    }
    html+=`<td style="text-align:center;font-weight:bold">${zeros}</td></tr>`;
  }
  html+='</tbody></table>';
  $("compareArea").innerHTML=html;
}

function runCompare(){
  if(!compareSelectMode){
    if(candidatas.length>100){ alert('Demasiadas candidatas (máx 100)'); return; }
    buildSelectionList(candidatas, candidatas.length<=25);
    compareSelectMode=true;
    $("btnRunCompare").textContent="Comparar seleccionadas";
    return;
  }
  const sel=Array.from(document.querySelectorAll('#compareArea input.selWord:checked')).map(cb=>cb.value);
  if(!sel.length){ alert('Selecciona al menos una palabra'); return; }
  if(sel.length>25){ alert('Máx 25 palabras'); return; }
  const extra=upper($("extraInput").value).split(/[^A-ZÑ]/).filter(x=>x.length===5).slice(0,2);
  drawCompareTable([...sel,...extra]);
  compareSelectMode=false;
  $("btnRunCompare").textContent="Comparar";
}

