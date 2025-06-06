// Wordle Solver — Español  v5.7  (amarillas ≡ grises en listas 2-3)

/* ---------- Config ---------- */
const COLORES = ["gris","amarillo","verde"];
const ALFABETO = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");
const EXACTO_HASTA = 800;

/* ---------- Diccionario ---------- */
const dicList = (typeof diccionario !== "undefined")
  ? diccionario.map(w=>w.toUpperCase())
  : [];

/* ---------- Estado ---------- */
let history=[], candidatas=[], version=0;
const entCache = new Map();

/* ---------- Helpers DOM ---------- */
const $ = id => document.getElementById(id);
const on = (id,fn)=>$(id).addEventListener("click",fn);
const ensureBody=id=>{const t=$(id);let b=t.querySelector("tbody");
  if(!b){b=document.createElement("tbody");t.appendChild(b);} return b;};
const up=s=>s.toUpperCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/Ü/g,"U");

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded",()=>{
  buildSelects();
  on("btnGuardar",saveGuess);
  on("btnReset",resetAll);
  on("btnCalcular",genLists);
  show("solver");
});
function buildSelects(){
  for(let i=0;i<5;i++){
    const s=$("color"+i); s.innerHTML='';
    COLORES.forEach(c=>{const o=document.createElement("option");o.value=c;o.textContent=c;s.appendChild(o);});
    s.value="gris";
  }
}
function show(t){$("panelSolver").style.display=t==="solver"?"" :"none";}

/* ---------- Historial ---------- */
const readCols=()=>Array.from({length:5},(_,i)=>$("color"+i).value);
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
function renderHist(){ $("historial").textContent = history.map(h=>`${h.word} → ${h.colors.join(', ')}`).join('\n'); }

/* ---------- Filtro ---------- */
function buildFiltro(){
  const pat=Array(5).fill('.'), setG=new Set(), setY=new Set(), setGray=new Set(), posNo=[];
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
    for(const {ch,pos} of f.posNo)if(w[pos]===ch)return false;
    for(const ch of f.setY)if(!w.includes(ch))return false;
    for(const ch of f.setGray)if(!f.setG.has(ch)&&!f.setY.has(ch)&&w.includes(ch))return false;
    return true;
  });
}

/* ---------- Entropía ---------- */
function pat(sol,guess){
  const r=Array(5).fill(0),u=Array(5).fill(false);
  for(let i=0;i<5;i++)if(sol[i]===guess[i]){r[i]=2;u[i]=true;}
  for(let i=0;i<5;i++)if(r[i]===0)
    for(let j=0;j<5;j++)if(!u[j]&&guess[i]===sol[j]){r[i]=1;u[j]=true;break;}
  return r.join('');
}
function H(word){
  const c=entCache.get(word); if(c&&c.v===version)return c.h;
  const n=candidatas.length; if(!n)return 0;
  const m=new Map();
  candidatas.forEach(s=>{const k=pat(s,word);m.set(k,(m.get(k)||0)+1);});
  const h=n - [...m.values()].reduce((a,x)=>a+x*x,0)/n;
  entCache.set(word,{v:version,h}); return h;
}
function fastScore(lista){
  const freq=new Map();
  lista.forEach(w=>w.split('').forEach(ch=>freq.set(ch,(freq.get(ch)||0)+1)));
  const map=new Map();
  lista.forEach(w=>{let s=0; new Set(w).forEach(ch=>s+=freq.get(ch)); map.set(w,s);});
  return map;
}

/* ---------- Listas ---------- */
function genLists(){
  const filt=buildFiltro();
  candidatas=filtrar(dicList,filt);
  $("candCount").textContent=candidatas.length;
  if(!candidatas.length){alert("Sin palabras");return;}
  entCache.clear(); version++;

  const exact=candidatas.length<=EXACTO_HASTA;
  const rap=exact?null:fastScore(candidatas);

  /* Lista 1 */
  render("tablaResolver",
    candidatas.map(w=>({w,h:exact?H(w):rap.get(w)}))
              .sort((a,b)=>b.h-a.h).slice(0,200));

  /* ----- conjuntos de letras ----- */
  const setGreen=new Set(), setYellow=filt.setY;
  history.forEach(h=>h.colors.forEach((c,i)=>{if(c==="verde")setGreen.add(h.word[i]);}));

  /* Lista 2 – descartar (amarillas = grises => se excluyen) */
  function hDesc(w){
    if([...setYellow].some(ch=>w.includes(ch))) return -1; // excluir
    let h=exact?H(w):rap.get(w)||0;
    setGreen.forEach(ch=>{if(w.includes(ch))h-=5;});
    return h;
  }
  const lista2=dicList
    .map(w=>({w,h:hDesc(w)}))
    .filter(o=>o.h>=0)
    .sort((a,b)=>b.h-a.h).slice(0,15);
  render("tablaDescartar",lista2);

  /* Lista 3 – repetición verde (también excluye amarillas) */
  const gPos=Array(5).fill(null);
  filt.re.source.replace(/[\^$]/g,'').split('').forEach((c,i)=>{if(c!=='.')gPos[i]=c;});
  const lista3 = gPos.some(x=>x)
     ? dicList.filter(w=>{
         if([...setYellow].some(ch=>w.includes(ch)))return false;
         return gPos.every((ch,i)=>!ch||(w.includes(ch)&&w[i]!==ch));
       })
       .map(w=>({w,h:exact?H(w):0}))
       .sort((a,b)=>b.h-a.h).slice(0,15)
     : [];
  render("tablaVerde",lista3);

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
  const tb=ensureBody(id); tb.innerHTML='';
  list.forEach(o=>{
    const tr=document.createElement("tr");
    [o.w,o.h.toFixed(2)].forEach(t=>{const td=document.createElement("td");td.textContent=t;tr.appendChild(td);});
    tb.appendChild(tr);
  });
}
function renderFreq(list){
  const tb=ensureBody("tablaLetras"); tb.innerHTML='';
  list.forEach(r=>{
    const tr=document.createElement("tr");
    [r.ch,r.ap,r.pal,r.rep].forEach(t=>{const td=document.createElement("td");td.textContent=t;tr.appendChild(td);});
    tb.appendChild(tr);
  });
}
