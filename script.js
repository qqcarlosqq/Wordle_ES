// Wordle Solver — Español  v5.6  (penaliza solo verdes)

/* ---------- Config ---------- */
const COLORES = ["gris","amarillo","verde"];
const ALFABETO = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");
const EXACTO_HASTA = 800;

/* ---------- Diccionario ---------- */
const dicList = (typeof diccionario !== "undefined")
  ? diccionario.map(w => w.toUpperCase())
  : [];

/* ---------- Estado ---------- */
let history = [];
let candidatas = [];
let version = 0;
const entCache = new Map(); // palabra -> {v,h}

/* ---------- Helpers DOM ---------- */
const $ = id => document.getElementById(id);
const on = (id,fn)=>$(id).addEventListener("click",fn);
const ensureBody = id => {
  const t = $(id); let b = t.querySelector("tbody");
  if(!b){ b=document.createElement("tbody"); t.appendChild(b); }
  return b;
};
const up = s => s.toUpperCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/Ü/g,"U");

/* ---------- UI ---------- */
document.addEventListener("DOMContentLoaded",()=>{
  buildSelects();
  on("btnGuardar",saveGuess);
  on("btnReset",resetAll);
  on("btnCalcular",genLists);
  on("tabSolver", ()=>show("solver"));
  on("tabLetras", ()=>show("buscar"));
  show("solver");
});
function buildSelects(){
  for(let i=0;i<5;i++){
    const s=$("color"+i); s.innerHTML='';
    COLORES.forEach(c=>{
      const o=document.createElement("option");o.value=c;o.textContent=c;
      s.appendChild(o);
    });
    s.value="gris";
  }
}
function show(tab){
  $("panelSolver").style.display = tab==="solver"?"" :"none";
  $("panelBuscar").style.display = tab==="buscar"?"" :"none";
}

/* ---------- Historial ---------- */
const readCols = ()=>Array.from({length:5},(_,i)=>$("color"+i).value);
function saveGuess(){
  const w = up($("guess").value.trim());
  if(!/^[A-ZÑ]{5}$/.test(w)){alert("Introduce 5 letras");return;}
  history.push({word:w,colors:readCols()});
  $("guess").value=''; buildSelects(); renderHist();
}
function resetAll(){
  history=[]; candidatas=[]; entCache.clear(); version++;
  ["tablaResolver","tablaDescartar","tablaVerde","tablaLetras"].forEach(id=>ensureBody(id).innerHTML='');
  $("candCount").textContent="0"; renderHist();
}
function renderHist(){
  $("historial").textContent = history.map(h=>`${h.word} → ${h.colors.join(', ')}`).join('\n');
}

/* ---------- Filtro ---------- */
function buildFiltro(){
  const pat=Array(5).fill('.');
  const setG=new Set(), setY=new Set(), setGray=new Set(), posNo=[];
  history.forEach(h=>{
    for(let i=0;i<5;i++){
      const ch=h.word[i], col=h.colors[i];
      if(col==="verde"){pat[i]=ch; setG.add(ch);}
      else if(col==="amarillo"){setY.add(ch); posNo.push({ch,pos:i});}
      else setGray.add(ch);
    }
  });
  return{re:new RegExp('^'+pat.join('')+'$'),setG,setY,setGray,posNo};
}
function filtrar(lista,f){
  return lista.filter(w=>{
    if(!f.re.test(w))return false;
    for(const {ch,pos} of f.posNo) if(w[pos]===ch) return false;
    for(const ch of f.setY) if(!w.includes(ch)) return false;
    for(const ch of f.setGray)
      if(!f.setG.has(ch)&&!f.setY.has(ch)&&w.includes(ch)) return false;
    return true;
  });
}

/* ---------- Entropía ---------- */
function pat(sol,guess){
  const r=Array(5).fill(0),u=Array(5).fill(false);
  for(let i=0;i<5;i++) if(sol[i]===guess[i]){r[i]=2;u[i]=true;}
  for(let i=0;i<5;i++) if(r[i]===0)
    for(let j=0;j<5;j++) if(!u[j]&&guess[i]===sol[j]){r[i]=1;u[j]=true;break;}
  return r.join('');
}
function H(word){
  const c=entCache.get(word); if(c&&c.v===version) return c.h;
  const n=candidatas.length;
  const m=new Map(); candidatas.forEach(s=>{
    const k=pat(s,word); m.set(k,(m.get(k)||0)+1);});
  const h=n - [...m.values()].reduce((a,x)=>a+x*x,0)/n;
  entCache.set(word,{v:version,h}); return h;
}
function fastScore(lista){
  const f=new Map();
  lista.forEach(w=>w.split('').forEach(ch=>f.set(ch,(f.get(ch)||0)+1)));
  const m=new Map();
  lista.forEach(w=>{
    let s=0; new Set(w).forEach(ch=>s+=f.get(ch));
    m.set(w,s);
  });
  return m;
}

/* ---------- Listas ---------- */
function genLists(){
  const filt=buildFiltro();
  candidatas=filtrar(dicList,filt);
  $("candCount").textContent=candidatas.length;
  if(!candidatas.length){alert("Sin palabras");return;}
  entCache.clear(); version++;

  const exact=candidatas.length<=EXACTO_HASTA;
  const rap = exact?null:fastScore(candidatas);

  /* Lista 1 */
  render("tablaResolver",
    candidatas.map(w=>({w,h:exact?H(w):rap.get(w)}))
      .sort((a,b)=>b.h-a.h).slice(0,200));

  /* ----- penalizar SOLO verdes ----- */
  const setGreen=new Set();
  history.forEach(h=>h.colors.forEach((c,i)=>{if(c==="verde")setGreen.add(h.word[i]);}));

  function scoreDesc(w){
    let h = exact? H(w) : rap.get(w)||0;
    setGreen.forEach(ch=>{ if(w.includes(ch)) h-=5; });
    return h;
  }
  render("tablaDescartar",
    dicList.map(w=>({w,h:scoreDesc(w)}))
           .sort((a,b)=>b.h-a.h).slice(0,15));

  /* Repetición verde (ya ignoraba amarillas) */
  const gPos=Array(5).fill(null);
  filt.re.source.replace(/[\^$]/g,'').split('').forEach((c,i)=>{if(c!=='.')gPos[i]=c;});
  const listaV = gPos.some(x=>x)
     ? dicList.filter(w=>gPos.every((ch,i)=>!ch||(w.includes(ch)&&w[i]!==ch)))
              .map(w=>({w,h:exact?H(w):0}))
              .sort((a,b)=>b.h-a.h).slice(0,15)
     : [];
  render("tablaVerde",listaV);

  /* Frecuencias */
  const freq=ALFABETO.map(ch=>{
    let ap=0,pal=0,rep=0;
    candidatas.forEach(w=>{
      const c=w.split('').filter(x=>x===ch).length;
      if(c){ap+=c;pal++;if(c>1)rep++;}
    });
    return{ch,ap,pal,rep};
  }).sort((a,b)=>b.pal-a.pal);
  renderFreq(freq);
}

/* ---------- Render ---------- */
function render(id,list){
  const tb=ensureBody(id);tb.innerHTML='';
  list.forEach(o=>{
    const tr=document.createElement("tr");
    [o.w,o.h.toFixed(2)].forEach(t=>{
      const td=document.createElement("td");td.textContent=t;tr.appendChild(td);});
    tb.appendChild(tr);
  });
}
function renderFreq(list){
  const tb=ensureBody("tablaLetras");tb.innerHTML='';
  list.forEach(r=>{
    const tr=document.createElement("tr");
    [r.ch,r.ap,r.pal,r.rep].forEach(t=>{
      const td=document.createElement("td");td.textContent=t;tr.appendChild(td);});
    tb.appendChild(tr);
  });
}
