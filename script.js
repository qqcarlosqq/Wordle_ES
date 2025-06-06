
// Wordle Solver — Español  v5.3.1  (amarillas ignoradas en listas 2-3)

/* ---------- Config ---------- */
const COLORES = ["gris","amarillo","verde"];
const ALFABETO = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");
const EXACTO_HASTA = 800;

/* ---------- Diccionario ---------- */
const dicList = (typeof diccionario !== "undefined")
  ? diccionario.map(w => w.toUpperCase())
  : [];

/* ---------- Estado ---------- */
let history = [];          // [{word, colors:[]}]
let candidatas = [];
let version = 0;
let entCache = new Map();  // palabra -> {v, h}

/* ---------- Helpers DOM ---------- */
const $ = id => document.getElementById(id);
const on = (id, fn) => $(id).addEventListener("click", fn);
const ensureBody = id => {
  const t = $(id); let b = t.querySelector("tbody");
  if(!b){ b=document.createElement("tbody"); t.appendChild(b); }
  return b;
};
const upper = s => s.toUpperCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/Ü/g,'U');

/* ---------- UI init ---------- */
document.addEventListener("DOMContentLoaded", ()=>{
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
function showTab(t){
  $("panelSolver").style.display = t==="solver"?"" :"none";
  $("panelBuscar").style.display = t==="buscar"?"" :"none";
  $("panelCompare").style.display= t==="compare"?"" :"none";
}

/* ---------- Select color ---------- */
function buildColorSelects(){
  for(let i=0;i<5;i++){
    const s=$("color"+i); s.innerHTML='';
    COLORES.forEach(c=>{
      const o=document.createElement("option"); o.value=c; o.textContent=c;
      s.appendChild(o);
    });
    s.value="gris";
  }
}
const readColors=()=>Array.from({length:5},(_,i)=>$("color"+i).value);

/* ---------- Historial ---------- */
function guardarIntento(){
  const w = upper($("guess").value.trim());
  if(!/^[A-ZÑ]{5}$/.test(w)){alert("Introduce 5 letras"); return;}
  history.push({word:w, colors:readColors()});
  $("guess").value=''; buildColorSelects(); renderHist();
}
function resetear(){
  history=[]; candidatas=[]; entCache.clear(); version++;
  ["tablaResolver","tablaDescartar","tablaVerde","tablaLetras"].forEach(id=>ensureBody(id).innerHTML='');
  $("candCount").textContent='0'; $("compareArea").innerHTML='';
  renderHist(); toggleCompareBtn();
}
function renderHist(){
  $("historial").textContent = history.map(h=>`${h.word} → ${h.colors.join(', ')}`).join('\n');
}

/* ---------- Filtro de candidatas ---------- */
function construirFiltro(){
  const pat = Array(5).fill('.');
  const setGreen=new Set(), setYellow=new Set(), setGray=new Set(), posNo=[];
  history.forEach(h=>{
    for(let i=0;i<5;i++){
      const ch=h.word[i], col=h.colors[i];
      if(col==="verde"){pat[i]=ch; setGreen.add(ch);}
      else if(col==="amarillo"){setYellow.add(ch); posNo.push({ch,pos:i});}
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

/* ---------- Entropía memo ---------- */
function patronClave(sol,guess){
  const out=Array(5).fill(0), used=Array(5).fill(false);
  for(let i=0;i<5;i++) if(sol[i]===guess[i]){out[i]=2; used[i]=true;}
  for(let i=0;i<5;i++) if(out[i]===0){
    for(let j=0;j<5;j++) if(!used[j]&&guess[i]===sol[j]){out[i]=1; used[j]=true; break;}
  }
  return out.join('');
}
function entropiaExacta(word){
  const cached=entCache.get(word);
  if(cached && cached.v===version) return cached.h;
  const n=candidatas.length; if(!n) return 0;
  const map=new Map();
  candidatas.forEach(s=>{
    const k=patronClave(s,word); map.set(k,(map.get(k)||0)+1);
  });
  const h=n - [...map.values()].reduce((a,x)=>a+x*x,0)/n;
  entCache.set(word,{v:version,h});
  return h;
}
function scoreRapido(lista){
  const freq=new Map();
  lista.forEach(w=>w.split('').forEach(ch=>freq.set(ch,(freq.get(ch)||0)+1)));
  const map=new Map();
  lista.forEach(w=>{
    let s=0; new Set(w).forEach(ch=>s+=freq.get(ch));
    map.set(w,s);
  });
  return map;
}

/* ---------- Listas principales ---------- */
function generarListas(){
  const filtro=construirFiltro();
  candidatas=filtrar(dicList,filtro);
  $("candCount").textContent=candidatas.length;
  toggleCompareBtn();

  if(candidatas.length===0){alert("Sin palabras posibles");return;}

  entCache.clear(); version++;

  const exact=candidatas.length<=EXACTO_HASTA;
  const rapidoCache = exact?null:scoreRapido(candidatas);

  /* ---------- Lista 1 ---------- */
  const listaRes=candidatas.map(w=>({
    w,
    h: exact? entropiaExacta(w) : rapidoCache.get(w)
  })).sort((a,b)=>b.h-a.h).slice(0,200);
  renderTabla("tablaResolver",listaRes);

  /* ---------- Lista 2 (excluir amarillas) ---------- */
  const {setGreen,setYellow}=filtro;
  function scoreDescartar(w){
    if([...setYellow].some(ch=>w.includes(ch))) return -1;   // descartar si contiene amarilla
    let h = exact? entropiaExacta(w) : rapidoCache.get(w)||0;
    setGreen.forEach(ch=>{ if(w.includes(ch)) h-=5; });
    return h;
  }
  const listaDesc = dicList
    .map(w=>({w,h:scoreDescartar(w)}))
    .filter(o=>o.h>=0)
    .sort((a,b)=>b.h-a.h).slice(0,15);
  renderTabla("tablaDescartar",listaDesc);

  /* ---------- Lista 3 (repetición verde, sin amarillas) ---------- */
  const greensPos = Array(5).fill(null);
  history.forEach(h=>h.colors.forEach((c,i)=>{ if(c==="verde") greensPos[i]=h.word[i]; }));
  const listaVerde = greensPos.some(ch=>ch)
    ? dicList.filter(w=>{
        if([...setYellow].some(ch=>w.includes(ch))) return false;       // excluir amarillas
        return greensPos.every((ch,i)=>!ch || (w.includes(ch)&&w[i]!==ch));
      })
      .map(w=>({w,h: exact? entropiaExacta(w) : 0}))
      .sort((a,b)=>b.h-a.h).slice(0,15)
    : [];
  renderTabla("tablaVerde",listaVerde);

  /* ---------- Frecuencias ---------- */
  const freq=ALFABETO.map(ch=>{
    let ap=0,pal=0,rep=0;
    candidatas.forEach(w=>{
      const cnt=w.split('').filter(c=>c===ch).length;
      if(cnt){ap+=cnt;pal++; if(cnt>1)rep++; }
    });
    return {ch,ap,pal,rep};
  }).sort((a,b)=>b.pal-a.pal);
  renderTablaFreq("tablaLetras",freq);
}

/* ---------- Render tablas ---------- */
function renderTabla(id,list){
  const tb=ensureBody(id); tb.innerHTML='';
  list.forEach(o=>{
    const tr=document.createElement("tr");
    [o.w,o.h.toFixed(2)].forEach(t=>{
      const td=document.createElement("td"); td.textContent=t; tr.appendChild(td);});
    tb.appendChild(tr);
  });
}
function renderTablaFreq(id,list){
  const tb=ensureBody(id); tb.innerHTML='';
  list.forEach(r=>{
    const tr=document.createElement("tr");
    [r.ch,r.ap,r.pal,r.rep].forEach(t=>{
      const td=document.createElement("td"); td.textContent=t; tr.appendChild(td);});
    tb.appendChild(tr);
  });
}

/* ---------- Buscar letras ---------- */
/* … (TODO: se mantiene igual, no se ha tocado) … */

/* ---------- Compare (≤25) ---------- */
/* … (TODO: se mantiene igual, no se ha tocado) … */
