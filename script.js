// Wordle Solver – versión web equivalente al Excel v16  (freq‑fix 2025‑06‑04)
document.addEventListener('DOMContentLoaded', init);

// ---------------- Configuración ----------------
const COLORS = ["gris","amarillo","verde"];
const TOP_N_OUT  = 200;
const TOP_N_DESC = 15;
const EXACT_THRESHOLD = 800;

// ---------------- Estado ----------------
let history = [];   // [{word,colors}]
const diccionarioList = (typeof diccionario !== 'undefined')
      ? diccionario.map(w=>w.toUpperCase())
      : [];

// ---------------- Utilidades ----------------
function $(id){ return document.getElementById(id); }
function normalizar(w){ return w.toUpperCase()
        .replace(/Á/g,'A').replace(/É/g,'E').replace(/Í/g,'I')
        .replace(/Ó/g,'O').replace(/Ú/g,'U').replace(/Ü/g,'U'); }

// ---------------- Inicialización ----------------
function init(){
  buildSelects();
  $('btnGuardar').onclick = guardarIntento;
  $('btnReset').onclick   = resetear;
  $('btnCalcular').onclick= generarListas;
}
function buildSelects(){
  for(let i=0;i<5;i++){
    const sel=$('color'+i); sel.innerHTML='';
    for(const c of COLORS){
      const opt=document.createElement('option');
      opt.value=c; opt.textContent=c.charAt(0).toUpperCase()+c.slice(1);
      sel.appendChild(opt);
    }
    sel.value='gris';
  }
}

// ---------------- Captura de intentos ----------------
function leerColores(){ return Array.from({length:5},(_,i)=>$('color'+i).value); }
function guardarIntento(){
  const w=normalizar($('guess').value.trim());
  if(!/^[A-ZÑ]{5}$/.test(w)){ alert('Introduce una palabra de 5 letras'); return;}
  history.push({word:w,colors:leerColores()});
  $('guess').value='';
  for(let i=0;i<5;i++) $('color'+i).value='gris';
  renderHistorial();
}
function resetear(){
  history=[];
  ['tablaResolver','tablaDescartar','tablaVerde','tablaLetras']
    .forEach(id=>$(id).querySelector('tbody').innerHTML='');
  renderHistorial();
}
function renderHistorial(){
  $('historial').textContent = history.map(h=>h.word+' → '+h.colors.join(', ')).join('\\n');
}

// ---------------- Núcleo de cálculo ----------------
function generarListas(){
  const reglas = construirReglasFiltro();
  const cand   = filtrarCandidatas(diccionarioList,reglas);
  if(cand.length===0){ alert('Ninguna palabra cumple las pistas'); return; }

  const useExact = cand.length<=EXACT_THRESHOLD;
  const scoreMap = useExact?null:scoreRapido(cand);

  const listaResolver = cand.map(w=>({
       w,
       h: useExact ? entropiaExacta(w,cand) : scoreMap.get(w)
    }))
    .sort((a,b)=>b.h-a.h).slice(0,TOP_N_OUT);

  const {setKnown,setGreen,setGray}=acumularPistas();

  const listaDescartar = sugerirExploratorias(cand,setKnown,setGray).slice(0,TOP_N_DESC);
  const listaVerde     = sugerirVerdesRep(cand,setKnown,setGreen,setGray,reglas.patron).slice(0,TOP_N_DESC);

  if(useExact){
    listaDescartar.forEach(o=>o.h=entropiaExacta(o.w,cand));
    listaVerde.forEach(o=>o.h=entropiaExacta(o.w,cand));
  }else{
    const m1=scoreRapido(listaDescartar.map(o=>o.w));
    listaDescartar.forEach(o=>o.h=m1.get(o.w));
    const m2=scoreRapido(listaVerde.map(o=>o.w));
    listaVerde.forEach(o=>o.h=m2.get(o.w));
  }

  listaDescartar.sort((a,b)=>b.h-a.h);
  listaVerde.sort((a,b)=>b.h-a.h);

  const tablaFreq = construirTablaLetras(cand);

  renderTabla('tablaResolver',listaResolver);
  renderTabla('tablaDescartar',listaDescartar);
  renderTabla('tablaVerde',listaVerde);
  renderTablaFreq('tablaLetras',tablaFreq);
}

// ---------------- Reglas y filtros ----------------
function construirReglasFiltro(){
  const patronArr=Array(5).fill('?');
  const setYellow=new Set(), setGreen=new Set(), setGray=new Set();
  const posForbidden=[];
  for(const h of history){
    for(let i=0;i<5;i++){
      const ch=h.word[i], col=h.colors[i];
      if(col==='verde'){ patronArr[i]=ch; setGreen.add(ch); setGray.delete(ch); }
      else if(col==='amarillo'){ setYellow.add(ch); posForbidden.push({ch,pos:i}); setGray.delete(ch); }
      else if(!setGreen.has(ch)&&!setYellow.has(ch)) setGray.add(ch);
    }
  }
  return{patron:patronArr.join(''),setYellow,setGreen,setGray,posForbidden};
}
function filtrarCandidatas(base,{patron,setYellow,setGray,posForbidden}){
  return base.filter(w=>{
    for(let i=0;i<5;i++) if(patron[i]!=='?' && w[i]!==patron[i]) return false;
    for(const {ch,pos} of posForbidden) if(w[pos]===ch) return false;
    for(const ch of setYellow) if(!w.includes(ch)) return false;
    for(const ch of setGray) if(w.includes(ch)) return false;
    return true;
  });
}
function acumularPistas(){
  const setKnown=new Set(), setGreen=new Set(), setGray=new Set();
  for(const h of history){
    for(let i=0;i<5;i++){
      const ch=h.word[i], col=h.colors[i];
      if(col!=='gris') setKnown.add(ch);
      if(col==='verde') setGreen.add(ch);
      else if(col==='gris' && !setKnown.has(ch)) setGray.add(ch);
    }
  }
  return {setKnown,setGreen,setGray};
}

// ---------------- Métrica de entropía exacta ----------------
function obtenerPatron(sol,guess){
  const res=Array(5).fill(0), used=Array(5).fill(false);
  for(let i=0;i<5;i++) if(guess[i]===sol[i]){res[i]=2; used[i]=true;}
  for(let i=0;i<5;i++) if(res[i]===0){
    for(let j=0;j<5;j++){
      if(!used[j] && guess[i]===sol[j]){res[i]=1; used[j]=true; break;}
    }
  }
  return res.join('');
}
function entropiaExacta(guess,cand){
  const p={}, N=cand.length;
  for(const sol of cand){const k=obtenerPatron(sol,guess); p[k]=(p[k]||0)+1;}
  let sum=0; for(const v of Object.values(p)) sum+=v*v;
  return N - sum/N;
}

// ---------------- Score rápido ----------------
function scoreRapido(lista){
  const f=new Map();
  for(const w of lista) for(const ch of w) f.set(ch,(f.get(ch)||0)+1);
  const map=new Map();
  for(const w of lista){
    let s=0; const seen=new Set();
    for(const ch of w){ if(!seen.has(ch)){s+=f.get(ch)||0; seen.add(ch);} }
    map.set(w,s);
  }
  return map;
}

// ---------------- Listas de sugerencias ----------------
function sugerirExploratorias(cand,setKnown,setGray){
  const f=new Map(); for(const w of cand) for(const ch of w) f.set(ch,(f.get(ch)||0)+1);
  const arr=[];
  for(const w of diccionarioList){
    let s=0, rep=false; const used=new Set();
    for(const ch of w){
      if(used.has(ch)){rep=true; continue;} used.add(ch);
      if(!setKnown.has(ch)&&!setGray.has(ch)) s+=f.get(ch)||0;
    }
    if(rep) s-=5; if(s>0) arr.push({w,h:s});
  }
  return arr.sort((a,b)=>b.h-a.h);
}
function sugerirVerdesRep(cand,setKnown,setGreen,setGray,patron){
  const f=new Map(); for(const w of cand) for(const ch of w) f.set(ch,(f.get(ch)||0)+1);
  const arr=[];
  for(const w of diccionarioList){
    let ok=false;
    for(let i=0;i<5;i++){const ch=w[i]; if(setGreen.has(ch)&&patron[i]!==ch){ok=true; break;}}
    if(!ok) continue;
    let s=0, rep=false; const used=new Set();
    for(const ch of w){
      if(used.has(ch)){rep=true; continue;} used.add(ch);
      if(!setKnown.has(ch)&&!setGray.has(ch)) s+=f.get(ch)||0;
    }
    if(rep) s-=5; if(s>0) arr.push({w,h:s});
  }
  return arr.sort((a,b)=>b.h-a.h);
}

// ---------------- Tabla de frecuencias ----------------
function construirTablaLetras(cand){
  const total=new Map(), words=new Map(), reps=new Map();
  for(const w of cand){
    const seen=new Map();
    for(const ch of w){
      total.set(ch,(total.get(ch)||0)+1);
      seen.set(ch,(seen.get(ch)||0)+1);
    }
    for(const [ch,cnt] of seen){
      words.set(ch,(words.get(ch)||0)+1);
      if(cnt>1) reps.set(ch,(reps.get(ch)||0)+1);
    }
  }
  // alfabeto castellano (incluyo Ñ)
  const ALFABETO='ABCDEFGHIJKLMNOPQRSTUVWXYZÑ'.split('');
  const arr=[];
  for(const ch of ALFABETO){
    arr.push({
      ch,
      ap: total.get(ch)||0,
      w : words.get(ch)||0,
      rep: reps.get(ch)||0
    });
  }
  arr.sort((a,b)=> b.w!==a.w ? b.w-a.w : b.ap-a.ap);
  return arr;
}

// ---------------- Render ----------------
function renderTabla(id,list){
  const tbody=$(id).querySelector('tbody'); if(!tbody) return; tbody.innerHTML='';
  for(const {w,h} of list){
    const tr=document.createElement('tr');
    [w,h.toFixed(2)].forEach(t=>{
      const td=document.createElement('td'); td.textContent=t; tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
}
function renderTablaFreq(id,list){
  const tbody=$(id).querySelector('tbody'); if(!tbody) return; tbody.innerHTML='';
  for(const {ch,ap,w,rep} of list){
    const tr=document.createElement('tr');
    [ch,ap,w,rep].forEach(t=>{
      const td=document.createElement('td'); td.textContent=t; tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
}