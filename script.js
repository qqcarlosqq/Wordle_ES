// Wordle Solver — Español  v5.4  (amarillas sin penalizar en listas 2-3)

/* ---------- Config ---------- */
const COLORES = ["gris","amarillo","verde"];
const ALFABETO = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");
const EXACTO = 800;        // entropía exacta hasta este tamaño
const TOP_OUT = 200, TOP_DESC = 15;

/* ---------- Diccionario ---------- */
const dicList = (typeof diccionario !== "undefined")
  ? diccionario.map(w=>w.toUpperCase())
  : [];

/* ---------- Estado ---------- */
let history = [];          // [{word,colors}]
let candidatas = [];
let entCache = new Map();
let version = 0;

/* ---------- Utils DOM ---------- */
const $ = id => document.getElementById(id);
const on= (id,fn)=>$(id).addEventListener("click",fn);
const ensureBody=id=>{const t=$(id);let b=t.querySelector("tbody");
  if(!b){b=document.createElement("tbody");t.appendChild(b);} return b;};
const upper=s=>s.toUpperCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/Ü/g,"U");

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded",()=>{
  buildSel();
  on("btnGuardar",guardarIntento);
  on("btnReset",resetear);
  on("btnCalcular",generarListas);
  on("tabSolver",()=>showTab("solver"));
  on("tabLetras",()=>showTab("buscar"));
  showTab("solver");
});
function buildSel(){
  for(let i=0;i<5;i++){
    const s=$("color"+i); s.innerHTML="";
    COLORES.forEach(c=>{
      const o=document.createElement("option");o.value=c;o.textContent=c;
      s.appendChild(o);
    });
    s.value="gris";
  }
}
function showTab(t){
  $("panelSolver").style.display = t==="solver" ? "" : "none";
  $("panelBuscar").style.display = t==="buscar" ? "" : "none";
}

/* ---------- Historial ---------- */
function leerColores(){return Array.from({length:5},(_,i)=>$("color"+i).value);}
function guardarIntento(){
  const w=upper($("guess").value.trim());
  if(!/^[A-ZÑ]{5}$/.test(w)){alert("Introduce 5 letras");return;}
  history.push({word:w,colors:leerColores()});
  $("guess").value=""; buildSel(); renderHist();
}
function resetear(){
  history=[]; candidatas=[]; entCache.clear(); version++;
  ["tablaResolver","tablaDescartar","tablaVerde","tablaLetras"].forEach(id=>ensureBody(id).innerHTML='');
  $("candCount").textContent="0"; renderHist();
}
function renderHist(){ $("historial").textContent = history.map(h=>`${h.word} → ${h.colors.join(", ")}`).join("\n"); }

/* ---------- Filtros ---------- */
function buildFiltro(){
  const pat=Array(5).fill(".");
  const setG=new Set(), setY=new Set(), setGray=new Set(), posNo=[];
  history.forEach(h=>{
    for(let i=0;i<5;i++){
      const ch=h.word[i], col=h.colors[i];
      if(col==="verde"){pat[i]=ch;setG.add(ch);}
      else if(col==="amarillo"){setY.add(ch);posNo.push({ch,pos:i});}
      else setGray.add(ch);
    }
  });
  return{regexp:new RegExp("^"+pat.join("")+"$"),setG,setY,setGray,posNo};
}
function filtrar(lista,f){
  return lista.filter(w=>{
    if(!f.regexp.test(w))return false;
    for(const {ch,pos} of f.posNo)if(w[pos]===ch)return false;
    for(const ch of f.setY)if(!w.includes(ch))return false;
    for(const ch of f.setGray)if(!f.setG.has(ch)&&!f.setY.has(ch)&&w.includes(ch))return false;
    return true;
  });
}

/* ---------- Entropía exacta (memo) ---------- */
function keyPat(sol,guess){
  const r=Array(5).fill(0),used=Array(5).fill(false);
  for(let i=0;i<5;i++)if(sol[i]===guess[i]){r[i]=2;used[i]=true;}
  for(let i=0;i<5;i++)if(r[i]===0){
    for(let j=0;j<5;j++)if(!used[j]&&guess[i]===sol[j]){r[i]=1;used[j]=true;break;}
  }return r.join('');
}
function entropia(word){
  const c=entCache.get(word); if(c&&c.v===version)return c.h;
  const n=candidatas.length; if(!n)return 0;
  const m=new Map(); candidatas.forEach(sol=>{
    const k=keyPat(sol,word); m.set(k,(m.get(k)||0)+1);});
  const h=n - [...m.values()].reduce((a,x)=>a+x*x,0)/n;
  entCache.set(word,{v:version,h}); return h;
}
function scoreRapido(lista){
  const f=new Map(); lista.forEach(w=>w.split('').forEach(ch=>f.set(ch,(f.get(ch)||0)+1)));
  const m=new Map();
  lista.forEach(w=>{
    let s=0; new Set(w).forEach(ch=>s+=f.get(ch));
    m.set(w,s);
  }); return m;
}

/* ---------- Listas ---------- */
function generarListas(){
  const filtro=buildFiltro();
  candidatas=filtrar(dicList,filtro);
  $("candCount").textContent=candidatas.length;
  if(!candidatas.length){alert("Sin palabras");return;}
  entCache.clear(); version++;

  const exact=candidatas.length<=EXACTO;
  const rap= exact? null : scoreRapido(candidatas);

  /* Lista 1 */
  const lista1=candidatas.map(w=>({w,h: exact?entropia(w):rap.get(w)}))
                         .sort((a,b)=>b.h-a.h).slice(0,TOP_OUT);
  renderTabla("tablaResolver",lista1);

  /* Conjuntos para penalizar solo verdes */
  const setGreen=new Set(); history.forEach(h=>{
    h.colors.forEach((c,i)=>{if(c==="verde")setGreen.add(h.word[i]);});});

  /* Lista 2 – penaliza SOLO verdes */
  function hDesc(w){
    let h= exact? entropia(w) : (rap.get(w)||0);
    setGreen.forEach(ch=>{if(w.includes(ch))h-=5;});
    return h;
  }
  const lista2=dicList.map(w=>({w,h:hDesc(w)}))
                      .sort((a,b)=>b.h-a.h).slice(0,TOP_DESC);
  renderTabla("tablaDescartar",lista2);

  /* Lista 3 – repetición de verdes (sin penalizar amarillas) */
  const patron=filtro.regexp.source.replace(/[\^$]/g,'');
  const verdesPos = Array(5).fill(null);
  patron.split('').forEach((c,i)=>{if(c!=='.')verdesPos[i]=c;});
  const lista3 = dicList.filter(w=>{
      if(!verdesPos.some(ch=>ch))return false;
      return verdesPos.every((ch,i)=>!ch||(w.includes(ch)&&w[i]!==ch));
    })
    .map(w=>({w,h: exact? entropia(w) : 0}))
    .sort((a,b)=>b.h-a.h).slice(0,TOP_DESC);
  renderTabla("tablaVerde",lista3);

  /* Frecuencias */
  const freq=ALFABETO.map(ch=>{
    let ap=0,pal=0,rep=0;
    candidatas.forEach(w=>{
      const c=w.split('').filter(x=>x===ch).length;
      if(c){ap+=c;pal++;if(c>1)rep++;}
    });
    return{ch,ap,pal,rep};
  }).sort((a,b)=>b.pal-a.pal);
  renderTablaFreq("tablaLetras",freq);
}

/* ---------- Renders ---------- */
function renderTabla(id,list){
  const tb=ensureBody(id); tb.innerHTML='';
  list.forEach(o=>{
    const tr=document.createElement("tr");
    [o.w,o.h.toFixed(2)].forEach(t=>{
      const td=document.createElement("td");td.textContent=t;tr.appendChild(td);});
    tb.appendChild(tr);
  });
}
function renderTablaFreq(id,list){
  const tb=ensureBody(id); tb.innerHTML='';
  list.forEach(r=>{
    const tr=document.createElement("tr");
    [r.ch,r.ap,r.pal,r.rep].forEach(t=>{
      const td=document.createElement("td");td.textContent=t;tr.appendChild(td);});
    tb.appendChild(tr);
  });
}
