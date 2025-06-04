// Wordle Solver – versión web equivalente al Excel v16
// ====================================================
// Reescrito 2025‑06‑04 para igualar la lógica del workbook Excel VBA
//   • EntropiaExacta       :  esperanza de eliminadas  (total − Σ cnt² / total)
//   • ScoreRapido          :  suma de frecuencias de letras únicas dentro de la lista
//   • SugerirExploratorias :  port directo de la macro VBA (v16)
//   • SugerirVerdesRep     :  port directo de la macro VBA (v16)
//   • Tabla de letras      :  corrige el cómputo de palabras con letra repetida
//   • Dropdown robusto     :  opciones permanentes, nunca vacías
//
//  Autor: ChatGPT 2025‑06‑04
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', init);

const COLORS = ["gris","amarillo","verde"];
const TOP_N_OUT  = 200; // Máx. filas en tabla «Resolver»
const TOP_N_DESC = 15;  // Longitud de tablas «Descartar» y «Repetición verde»
const EXACT_THRESHOLD = 800; // Límite para usar EntropiaExacta

// ----------------------------------------------------
//  Estado
// ----------------------------------------------------
let history = [];       // [{word:'RASEN', colors:['gris','verde',...]}]
const diccionarioList = (typeof diccionario!=="undefined")
  ? diccionario.map(w=>w.toUpperCase())
  : []; // tomado de diccionario.js

// ----------------------------------------------------
function normalizar(w) {
  return w.toUpperCase()
          .replace(/Á/g,'A').replace(/É/g,'E').replace(/Í/g,'I')
          .replace(/Ó/g,'O').replace(/Ú/g,'U').replace(/Ü/g,'U');
}
function showAlert(msg){ window.alert(msg); }
function $(id){ return document.getElementById(id); }

// ----------------------------------------------------
//  Inicialización
// ----------------------------------------------------
function init() {
  buildSelects();
  $('btnGuardar').onclick = guardarIntento;
  $('btnReset').onclick   = resetear;
  $('btnCalcular').onclick= generarListas;
}

function buildSelects(){
  for (let i=0;i<5;i++){
    const sel = $('color'+i);
    sel.innerHTML = '';
    COLORS.forEach(c=>{
      const opt=document.createElement('option');
      opt.value=c;
      opt.textContent=c.charAt(0).toUpperCase()+c.slice(1);
      sel.appendChild(opt);
    });
    sel.value='gris';
  }
}

// ----------------------------------------------------
//  Captura de intentos
// ----------------------------------------------------
function leerColores(){
  const arr=[];
  for(let i=0;i<5;i++) arr.push($('color'+i).value);
  return arr;
}

function guardarIntento(){
  const word = normalizar($('guess').value.trim());
  if(!/^[A-ZÑ]{5}$/.test(word)){ showAlert('Introduce una palabra de 5 letras.'); return;}
  const colors = leerColores();
  history.push({word,colors});
  $('guess').value='';
  for(let i=0;i<5;i++) $('color'+i).value='gris';
  renderHistorial();
}

function resetear(){
  history=[];
  ['tablaResolver','tablaDescartar','tablaVerde','tablaLetras'].forEach(id=>{
    const tbody=$(id).querySelector('tbody');
    if(tbody) tbody.innerHTML='';
  });
  renderHistorial();
}

function renderHistorial(){
  $('historial').textContent = history.map(h=>h.word+' → '+h.colors.join(', ')).join('\n');
}

// ----------------------------------------------------
//  Generación de listas
// ----------------------------------------------------
function generarListas(){
  const reglas = construirReglasFiltro();
  const cand = filtrarCandidatas(diccionarioList, reglas);
  if(cand.length===0){ showAlert('Ninguna palabra cumple las pistas.'); return; }

  const useExact = cand.length <= EXACT_THRESHOLD;

  // Resolver
  const scoreMapResolver = useExact ? null : scoreRapido(cand);
  const listaResolver = cand.map(w=>{
    const h = useExact ? entropiaExacta(w,cand) : scoreMapResolver.get(w);
    return {w,h};
  }).sort((a,b)=>b.h-a.h).slice(0,TOP_N_OUT);

  // Pistas acumuladas
  const {setKnown,setGreen,setGray} = acumularPistas();

  // Descartar
  const listaDescartar = sugerirExploratorias(cand,setKnown,setGray).slice(0,TOP_N_DESC);

  // Repetición verde
  const listaVerde = sugerirVerdesRep(cand,setKnown,setGreen,setGray,reglas.patron).slice(0,TOP_N_DESC);

  // Ajustar puntuaciones si hace falta
  if(useExact){
    listaDescartar.forEach(o=>o.h=entropiaExacta(o.w,cand));
    listaVerde.forEach(o=>o.h=entropiaExacta(o.w,cand));
  }else{
    const mapDesc=scoreRapido(listaDescartar.map(o=>o.w));
    listaDescartar.forEach(o=>o.h=mapDesc.get(o.w));
    const mapVer=scoreRapido(listaVerde.map(o=>o.w));
    listaVerde.forEach(o=>o.h=mapVer.get(o.w));
  }
  listaDescartar.sort((a,b)=>b.h-a.h);
  listaVerde.sort((a,b)=>b.h-a.h);

  // Tabla de letras
  const tablaFreq = construirTablaLetras(cand);

  // Render
  renderTabla('tablaResolver',listaResolver);
  renderTabla('tablaDescartar',listaDescartar);
  renderTabla('tablaVerde',listaVerde);
  renderTablaFreq('tablaLetras',tablaFreq);
}

// ----------------------------------------------------
//  Filtrado de candidatas
// ----------------------------------------------------
function construirReglasFiltro(){
  const patronArr=Array(5).fill('?');
  const setYellow=new Set(), setGreen=new Set(), setGray=new Set();
  const posForbidden=[];
  for(const h of history){
    for(let i=0;i<5;i++){
      const ch=h.word[i], col=h.colors[i];
      if(col==='verde'){
        patronArr[i]=ch; setGreen.add(ch); setGray.delete(ch);
      }else if(col==='amarillo'){
        setYellow.add(ch); posForbidden.push({ch,pos:i}); setGray.delete(ch);
      }else{ // gris
        if(!setGreen.has(ch) && !setYellow.has(ch)) setGray.add(ch);
      }
    }
  }
  return {patron:patronArr.join(''), setYellow,setGreen,setGray,posForbidden};
}

function filtrarCandidatas(arrBase, reglas){
  if(history.length===0) return arrBase.slice();
  const {patron,setYellow,setGray,posForbidden}=reglas;
  return arrBase.filter(word=>{
    // verdes
    for(let i=0;i<5;i++) if(patron[i]!=='?' && word[i]!==patron[i]) return false;
    // amarillas
    for(const {ch,pos} of posForbidden) if(word[pos]===ch) return false;
    for(const ch of setYellow) if(!word.includes(ch)) return false;
    // grises
    for(const ch of setGray) if(word.includes(ch)) return false;
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

// ----------------------------------------------------
//  Patron / feedback key
// ----------------------------------------------------
function obtenerPatron(sol,guess){
  const res=Array(5).fill(0), usado=Array(5).fill(false);
  // verdes
  for(let i=0;i<5;i++) if(guess[i]===sol[i]){res[i]=2; usado[i]=true;}
  // amarillas
  for(let i=0;i<5;i++){
    if(res[i]===0){
      for(let j=0;j<5;j++){
        if(!usado[j] && guess[i]===sol[j]){res[i]=1; usado[j]=true; break;}
      }
    }
  }
  return res.join('');
}

// ----------------------------------------------------
//  EntropiaExacta
// ----------------------------------------------------
function entropiaExacta(guess,candidatos){
  const patrones=Object.create(null);
  const total=candidatos.length;
  for(const sol of candidatos){
    const key=obtenerPatron(sol,guess);
    patrones[key]=(patrones[key]||0)+1;
  }
  let sumSq=0;
  for(const cnt of Object.values(patrones)) sumSq+=cnt*cnt;
  return total - sumSq/total;
}

// ----------------------------------------------------
//  ScoreRapido
// ----------------------------------------------------
function scoreRapido(lista){
  const freq=new Map();
  for(const w of lista) for(const ch of w) freq.set(ch,(freq.get(ch)||0)+1);
  const map=new Map();
  for(const w of lista){
    let score=0; const seen=new Set();
    for(const ch of w){
      if(seen.has(ch)) continue;
      seen.add(ch); score+=freq.get(ch)||0;
    }
    map.set(w,score);
  }
  return map;
}

// ----------------------------------------------------
//  SugerirExploratorias
// ----------------------------------------------------
function sugerirExploratorias(cand,setKnown,setGray){
  const f=new Map();
  for(const w of cand) for(const ch of w) f.set(ch,(f.get(ch)||0)+1);

  const arr=[];
  for(const w of diccionarioList){
    let score=0, rep=false;
    const used=new Set();
    for(const ch of w){
      if(used.has(ch)) {rep=true; continue;}
      used.add(ch);
      if(!setKnown.has(ch) && !setGray.has(ch)) score+=f.get(ch)||0;
    }
    if(rep) score-=5;
    if(score>0) arr.push({w,h:score});
  }
  return arr.sort((a,b)=>b.h-a.h);
}

// ----------------------------------------------------
//  SugerirVerdesRep
// ----------------------------------------------------
function sugerirVerdesRep(cand,setKnown,setGreen,setGray,patron){
  const f=new Map();
  for(const w of cand) for(const ch of w) f.set(ch,(f.get(ch)||0)+1);

  const arr=[];
  for(const w of diccionarioList){
    // Debe tener al menos una letra verde en otra posición
    let qualifies=false;
    for(let i=0;i<5;i++){
      const ch=w[i];
      if(setGreen.has(ch) && patron[i]!==ch){qualifies=true; break;}
    }
    if(!qualifies) continue;

    let score=0, rep=false;
    const used=new Set();
    for(const ch of w){
      if(used.has(ch)){rep=true; continue;}
      used.add(ch);
      if(!setKnown.has(ch) && !setGray.has(ch)) score+=f.get(ch)||0;
    }
    if(rep) score-=5;
    if(score>0) arr.push({w,h:score});
  }
  return arr.sort((a,b)=>b.h-a.h);
}

// ----------------------------------------------------
//  Tabla de frecuencias de letras
// ----------------------------------------------------
function construirTablaLetras(cand){
  const freq=new Map();
  const repeats=new Map();
  for(const w of cand){
    const seen=new Map();
    for(const ch of w){
      freq.set(ch,(freq.get(ch)||0)+1);
      seen.set(ch,(seen.get(ch)||0)+1);
    }
    for(const [ch,cnt] of seen){
      if(cnt>1) repeats.set(ch,(repeats.get(ch)||0)+1);
    }
  }
  const arr=[];
  for(const [ch,cnt] of freq){
    arr.push({ch, cnt, rep:repeats.get(ch)||0});
  }
  return arr.sort((a,b)=>b.cnt-a.cnt);
}

// ----------------------------------------------------
//  Render de tablas
// ----------------------------------------------------
function renderTabla(id,lista){
  const tbody=$(id).querySelector('tbody');
  if(!tbody) return;
  tbody.innerHTML='';
  for(const {w,h} of lista){
    const tr=document.createElement('tr');
    const td1=document.createElement('td'); td1.textContent=w;
    const td2=document.createElement('td'); td2.textContent=h.toFixed(2);
    tr.appendChild(td1); tr.appendChild(td2);
    tbody.appendChild(tr);
  }
}

function renderTablaFreq(id,lista){
  const tbody=$(id).querySelector('tbody');
  if(!tbody) return;
  tbody.innerHTML='';
  for(const {ch,cnt,rep} of lista){
    const tr=document.createElement('tr');
    [''+ch, cnt, rep].forEach(txt=>{
      const td=document.createElement('td'); td.textContent=txt; tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
}
