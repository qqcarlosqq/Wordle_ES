// Wordle Solver – versión web equivalente al Excel v16
// ====================================================

// ------------ Config --------------------------------
document.addEventListener('DOMContentLoaded', buildSelects);
const COLORS = ["gris","amarillo","verde"];
const TOP_N_OUT = 200;       // máx. filas por tabla (resolver)
const TOP_N_DESC = 15;       // descartar / verde

// ------------ Estado --------------------------------
let history = [];   // [{word:'RASEN', colors:[...]}]

// ------------ Utilidades ----------------------------
function normalizar(w){return w.toUpperCase().replace(/Á/g,'A').replace(/É/g,'E').replace(/Í/g,'I').replace(/Ó/g,'O').replace(/Ú/g,'U').replace(/Ü/g,'U');}

function showAlert(msg){window.alert(msg);}

// Crea opciones para selects
function buildSelects(){
  for(let i=0;i<5;i++){
    const sel=document.getElementById('color'+i);
    COLORS.forEach(c=>{
      const opt=document.createElement('option');opt.value=c;opt.textContent=c.charAt(0).toUpperCase()+c.slice(1);
      sel.appendChild(opt);
    });
    sel.value='gris';
  }
}


// ------------ Entrada y validación ------------------
function leerColores(){
  const arr=[];
  for(let i=0;i<5;i++){arr.push(document.getElementById('color'+i).value);}
  return arr;
}

function guardarIntento(){
  const word = normalizar(document.getElementById('guess').value.trim());
  if(!/^[A-ZÑ]{5}$/.test(word)){showAlert("Introduce exactamente 5 letras (A‑Z/Ñ).");return;}
  if(!diccionario.includes(word)){if(!confirm("La palabra '"+word+"' no está en el diccionario ¿continuar?"))return;}
  history.push({word,colors:leerColores()});
  document.getElementById('guess').value='';
  for(let i=0;i<5;i++)document.getElementById('color'+i).value='gris';
  renderHistorial();
}

function resetear(){
  history=[];
  ['tablaResolver','tablaDescartar','tablaVerde','tablaLetras'].forEach(id=>document.getElementById(id).querySelector('tbody').innerHTML='');
  renderHistorial();
}

function renderHistorial(){
  const div=document.getElementById('historial');
  div.textContent = history.map(h=>h.word+' → '+h.colors.join(', ')).join('\n');
}

// ------------ Motor Wordle --------------------------
function filtrar(dic){
  let posibles=dic;
  for(const h of history){
    posibles = posibles.filter(pal=>cumplePatron(pal,h.word,h.colors));
  }
  return posibles;
}

function cumplePatron(pal, intento, colores){
  for(let i=0;i<5;i++){
    const letra=intento[i];
    switch(colores[i]){
      case 'verde': if(pal[i]!==letra) return false; break;
      case 'amarillo': if(!pal.includes(letra)||pal[i]===letra) return false; break;
      case 'gris':
        // letra gris excepto si aparece en otra posición marcada verde/amarilla
        let presenteEnOtra=false;
        for(let j=0;j<5;j++){if(j!==i && intento[j]===letra && colores[j]!=='gris'){presenteEnOtra=true;break;}}
        if(!presenteEnOtra && pal.includes(letra)) return false;
        break;
    }
  }
  return true;
}

// patrón codificado 0 gris,1 amarillo,2 verde (string de 5 dígitos)
function obtenerPatron(secret, intento){
  const res=Array(5).fill(0);
  const usado=Array(5).fill(false);
  for(let i=0;i<5;i++){ if(intento[i]===secret[i]){res[i]=2;usado[i]=true;} }
  for(let i=0;i<5;i++){
    if(res[i]===0){
      for(let j=0;j<5;j++){
        if(!usado[j]&&intento[i]===secret[j]){
          res[i]=1;usado[j]=true;break;
        }
      }
    }
  }
  return res.join('');
}

function entropiaExacta(pal,candidatos){
  const patrones={};
  for(const sec of candidatos){
    const pat=obtenerPatron(sec,pal);
    patrones[pat]=(patrones[pat]||0)+1;
  }
  let e=0,total=candidatos.length;
  for(const k in patrones){
    const p=patrones[k]/total;
    e+=p*Math.log2(1/p);
  }
  return e;
}

// ------------ Listas y scores -----------------------
function generarListas(){
  const cand=filtrar(diccionario);
  if(cand.length===0){showAlert("Ninguna palabra cumple las pistas.");return;}

  // --- lista resolver (sobre candidatas)
  const listaResolver = cand.map(w=>({w, h:entropiaExacta(w,cand)}))
                            .sort((a,b)=>b.h-a.h)
                            .slice(0,TOP_N_OUT);

  // --- lista descartadoras (todas palabras vs cand) con penalización por letras vistas
  const knownLetters = new Set();
  for(const h of history){
    h.colors.forEach((c,i)=>{ if(c!=='gris') knownLetters.add(h.word[i]); });
  }

  function scoreExploratoria(w){
    let rep=false, total=0;
    const usadas=new Set();
    for(const ch of w){
      if(usadas.has(ch)) continue;
      usadas.add(ch);
      if(knownLetters.has(ch)) rep=true;
      else total++;
    }
    return total - (rep?1:0);
  }

  const candidatasProbe = diccionario.map(w=>({w,pen:scoreExploratoria(w)}))
                                     .filter(o=>o.pen>0);

  const listaDescartar = candidatasProbe.map(o=>({w:o.w,h:entropiaExacta(o.w,cand)}))
                                        .sort((a,b)=>b.h-a.h)
                                        .slice(0,TOP_N_DESC);

  // --- repetición verde
  const verdes=new Set();
  for(const h of history){
    h.colors.forEach((c,i)=>{ if(c==='verde') verdes.add(h.word[i]); });
  }
  const listaVerde = diccionario.filter(w=>{
                            for(const ch of verdes){
                              if(w.includes(ch) && w.split(ch).length-1>=2) return true;
                              if(w.includes(ch) && !verdes.has(ch) ) return true;
                            }
                            return false;
                          })
                          .map(w=>({w,h:entropiaExacta(w,cand)}))
                          .sort((a,b)=>b.h-a.h)
                          .slice(0,TOP_N_DESC);

  // --- frecuencias
  const freq = {};
  for(const ch of "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"){
    freq[ch]={count:0, words:0, rep:0};
  }
  for(const w of cand){
    const used=new Set();
    for(const ch of w){
      freq[ch].count++;
      used.add(ch);
    }
    used.forEach(ch=>freq[ch].words++);
    for(const ch of w){
      if(w.split(ch).length-1>=2){freq[ch].rep++; }
    }
  }
  const tablaFreq = Object.entries(freq)
    .sort((a,b)=>b[1].words - a[1].words)
    .map(([letra,v])=>({letra,...v}));

  // --- render
  renderTabla('tablaResolver',listaResolver);
  renderTabla('tablaDescartar',listaDescartar);
  renderTabla('tablaVerde',listaVerde);
  renderTablaFreq('tablaLetras',tablaFreq);
}

function renderTabla(id,lista){
  const tbody=document.getElementById(id).querySelector('tbody');
  tbody.innerHTML='';
  for(const o of lista){
    const tr=document.createElement('tr');
    const tdw=document.createElement('td');tdw.textContent=o.w;
    const tds=document.createElement('td');tds.textContent=o.h.toFixed(2);
    tr.appendChild(tdw);tr.appendChild(tds);tbody.appendChild(tr);
  }
}
function renderTablaFreq(id,lista){
  const tbody=document.getElementById(id).querySelector('tbody');
  tbody.innerHTML='';
  for(const o of lista){
    const tr=document.createElement('tr');
    ['letra','count','words','rep'].forEach(k=>{
      const td=document.createElement('td');td.textContent=o[k];tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
}

// ----------- eventos UI -----------------------------
document.getElementById('btnGuardar').onclick=guardarIntento;
document.getElementById('btnReset').onclick=resetear;
document.getElementById('btnCalcular').onclick=generarListas;
