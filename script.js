// Wordle Solver — Español  v5.5  (lista 2 exploratoria sin penalizar amarillas)

/* ---------- Parámetros ---------- */
const COLORES = ["gris","amarillo","verde"];
const ALFABETO = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");
const EXACTO = 800;
const TOP_OUT = 200, TOP_DESC = 15;

/* ---------- Diccionario ---------- */
const dicList = (typeof diccionario !== "undefined")
  ? diccionario.map(w=>w.toUpperCase())
  : [];

/* ---------- Estado ---------- */
let history=[], candidatas=[], version=0;
const entCache=new Map();

/* ---------- Utiles DOM ---------- */
const $=id=>document.getElementById(id);
const on=(id,fn)=>$(id).addEventListener("click",fn);
const ensureBody=id=>{const t=$(id);let b=t.querySelector("tbody");
  if(!b){b=document.createElement("tbody");t.appendChild(b);}return b;};
const up=s=>s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/Ü/g,"U");

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded",()=>{
  buildSelects();
  on("btnGuardar",saveGuess); on("btnReset",resetAll); on("btnCalcular",genLists);
  on("tabSolver",()=>show("solver")); on("tabLetras",()=>show("buscar"));
  show("solver");
});
function buildSelects(){
  for(let i=0;i<5;i++){
    const s=$("color"+i); s.innerHTML='';
    COLORES.forEach(c=>{const o=document.createElement("option");o.value=c;o.textContent=c;s.appendChild(o);});
    s.value="gris";
  }
}
function show(t){$("panelSolver").style.display=t==="solver"?"" :"none";
  $("panelBuscar").style.display=t==="buscar"?"" :"none";}

/* ---------- Historial ---------- */
function readCols(){return Array.from({length:5},(_,i)=>$("color"+i).value);}
function saveGuess(){
  const w=up($("guess").value.trim());
  if(!/^[A-ZÑ]{5}$/.test(w)){alert("Introduce 5 letras");return;}
  history.push({word:w,colors:readCols()});
  $("guess").value=''; buildSelects(); renderHist();
}
function resetAll(){
  history=[]; candidatas=[]; entCache.clear(); version++;
  ["tablaResolver","tablaDescartar","tablaVerde","tablaLetras"].forEach(id=>ensureBody(id).innerHTML='');
  $("candCount").textContent='0'; renderHist();
}
function renderHist(){ $("historial").textContent=history.map(h=>`${h.word} → ${h.colors.join(', ')}`).join('\n'); }

/* ---------- Filtros ---------- */
function buildFiltro(){
  const pat=Array(5).fill('.'), setG=new Set(), setY=new Set(), setGray=new Set(), posNo=[];
  history.forEach(h=>{
    for(let i=0;i<5;i++){
      const ch=h.word[i], col=h.colors[i];
      if(col==="verde"){pat[i]=ch;setG.add(ch);}
      else if(col==="amarillo"){setY.add(ch);posNo.push({ch,pos:i});}
      else setGray.add(ch);
    }
  });
  return{re:new RegExp('^'+pat.join('')+'$'),setG,setY,setGray,posNo};
}
function filtrar(lista,f){
  return lista.filter(w=>{
    if(!f.re.test(w))return false;
    for(const {ch,pos} of f.posNo)if(w[pos]===ch)return false;
    for(const ch of f.setY)if(!w.includes(ch))return false;
    for(const ch of f.setGray)if(!f.setG.has(ch)&&!f.setY.has(ch)&&w.includes(ch))return false;
    return true;
  });
}

/* ---------- Entropía exacta (memo) ---------- */
function patClave(sol,guess){
  const r=Array(5).fill(0),u=Array(5).fill(false);
  for(let i=0;i<5;i++)if(sol[i]===guess[i]){r[i]=2;u[i]=true;}
  for(let i=0;i<5;i++)if(r[i]===0)for(let j=0;j<5;j++)if(!u[j]&&guess[i]===sol[j]){r[i]=1;u[j]=true;break;}
  return r.join('');
}
function H(word){
  const c=entCache.get(word); if(c&&c.v===version)return c.h;
  const n=candidatas.length; if(!n)return 0;
  const m=new Map(); candidatas.forEach(s=>{
    const k=patClave(s,word); m.set(k,(m.get(k)||0)+1);});
  const h=n - [...m.values()].reduce((a,x)=>a+x*x,0)/n;
  entCache.set(word,{v:version,h}); return h;
}
function scoreRapido(lista){
  const f=new Map(); lista.forEach(w=>w.split('').forEach(ch=>f.set(ch,(f.get(ch)||0)+1)));
  const m=new Map(); lista.forEach(w=>{
    let s=0; new Set(w).forEach(ch=>s+=f.get(ch)); m.set(w,s);});
  return m;
}

/* ---------- Generar listas ---------- */
function genLists(){
  const filt=buildFiltro();
  candidatas=filtrar(dicList,filt);
  $("candCount").textContent=candidatas.length;
  if(!candidatas.length){alert("Sin palabras");return;}
  entCache.clear(); version++;

  const exact=candidatas.length<=EXACTO;
  const rap=exact?null:scoreRapido(candidatas);

  /* Lista 1 */
  renderTabla("tablaResolver",
    candidatas.map(w=>({w,h:exact?H(w):rap.get(w)}))
      .sort((a,b)=>b.h-a.h).slice(0,TOP_OUT));

  /* -------- Lista 2 exploratoria (sólo verdes se ignoran) -------- */
  const setGreen=new Set(); history.forEach(h=>{
    h.colors.forEach((c,i)=>{if(c==="verde")setGreen.add(h.word[i]);});
  });
  const freq=new Map(); candidatas.forEach(w=>w.split('').forEach(ch=>freq.set(ch,(freq.get(ch)||0)+1)));
  function scoreExplor(w){
    let s=0, rep=false, seen=new Set();
    for(const ch of w){
      if(seen.has(ch)){rep=true; continue;}
      seen.add(ch);
      if(!setGreen.has(ch)) s+=freq.get(ch)||0;
    }
    if(rep) s-=5;
    return s;
  }
  const listaDesc=dicList.map(w=>({w,h:scoreExplor(w)}))
                   .sort((a,b)=>b.h-a.h).slice(0,TOP_DESC);
  renderTabla("tablaDescartar",listaDesc);

  /* -------- Lista 3 repetición verde -------- */
  const verdePos=Array(5).fill(null);
  filt.re.source.replace(/[\^$]/g,'').split('').forEach((c,i)=>{if(c!=='.')verdePos[i]=c;});
  const listaVerde = verdePos.some(x=>x)
     ? dicList.filter(w=>verdePos.every((ch,i)=>!ch||(w.includes(ch)&&w[i]!==ch)))
              .map(w=>({w,h:exact?H(w):0}))
              .sort((a,b)=>b.h-a.h).slice(0,TOP_DESC)
     : [];
  renderTabla("tablaVerde",listaVerde);

  /* Frecuencias */
  const freqTab=ALFABETO.map(ch=>{
    let ap=0,pal=0,rep=0;
    candidatas.forEach(w=>{
      const c=w.split('').filter(x=>x===ch).length;
      if(c){ap+=c;pal++; if(c>1)rep++;}
    });
    return{ch,ap,pal,rep};
  }).sort((a,b)=>b.pal-a.pal);
  renderTablaFreq("tablaLetras",freqTab);
}

/* ---------- Render tablas ---------- */
function renderTabla(id,list){
  const tb=ensureBody(id);tb.innerHTML='';
  list.forEach(o=>{
    const tr=document.createElement("tr");
    [o.w,o.h.toFixed(2)].forEach(t=>{const td=document.createElement("td");td.textContent=t;tr.appendChild(td);});
    tb.appendChild(tr);
  });
}
function renderTablaFreq(id,list){
  const tb=ensureBody(id);tb.innerHTML='';
  list.forEach(r=>{
    const tr=document.createElement("tr");
    [r.ch,r.ap,r.pal,r.rep].forEach(t=>{const td=document.createElement("td");td.textContent=t;tr.appendChild(td);});
    tb.appendChild(tr);
  });
}
