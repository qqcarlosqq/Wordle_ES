// Wordle Solver – español (web)  — versión estable
// ===============================================

// --------- Configuración ---------
const COLORS = ["gris","amarillo","verde"];
const TOP_N_OUT = 200;   // filas de la tabla de resolver
const TOP_N_DESC = 15;   // filas para descartar / verde

// --------- Estado -----------
let historial = [];             // [{palabra, colores[5]}]

// --------- Utilidades generales ----------
function normalizar(txt){
  return txt.toUpperCase()
            .replace(/Á/g,'A').replace(/É/g,'E').replace(/Í/g,'I')
            .replace(/Ó/g,'O').replace(/Ú|Ü/g,'U');
}
function alerta(msg){ window.alert(msg); }

// --------- Select de colores ------------
function buildSelects(){
  for(let i=0;i<5;i++){
    const sel=document.getElementById('color'+i);
    sel.innerHTML='';
    COLORS.forEach(c=>{
      const opt=document.createElement('option');
      opt.value=c;  opt.textContent=c.charAt(0).toUpperCase()+c.slice(1);
      sel.appendChild(opt);
    });
    sel.value='gris';
  }
}
document.addEventListener('DOMContentLoaded', buildSelects);

// --------- Entrada de intentos ----------
function leerColores(){
  const arr=[];
  for(let i=0;i<5;i++) arr.push(document.getElementById('color'+i).value);
  return arr;
}
function guardarIntento(){
  let w = normalizar(document.getElementById('guess').value.trim());
  if(!/^[A-ZÑ]{5}$/.test(w)){ alerta("Introduce exactamente 5 letras."); return; }
  if(!diccionario.includes(w)){
     if(!confirm("La palabra '"+w+"' no está en el diccionario. ¿Continuar?")) return;
  }
  historial.push({palabra:w, colores:leerColores()});
  document.getElementById('guess').value='';
  buildSelects();              // reinicia selects en gris
  renderHistorial();
}
function renderHistorial(){
  const pre=document.getElementById('historial');
  pre.textContent = historial.map(h=>h.palabra+' → '+h.colores.join(', ')).join('\n');
}
function resetear(){
  historial=[]; renderHistorial();
  ['tablaResolver','tablaDescartar','tablaVerde','tablaLetras'].forEach(id=>{
      document.getElementById(id).querySelector('tbody').innerHTML='';
  });
}

// --------- Motor de filtrado ------------
function cumplePatron(pal,intento,colores){
  for(let i=0;i<5;i++){
    const ch=intento[i];
    const estado=colores[i];
    if(estado==='verde' && pal[i]!==ch) return false;
    if(estado==='amarillo'){
      if(pal[i]===ch) return false;
      if(!pal.includes(ch)) return false;
    }
    if(estado==='gris'){
      let presenteOtra=false;
      for(let j=0;j<5;j++){
        if(j!==i && intento[j]===ch && colores[j]!=='gris'){presenteOtra=true;break;}
      }
      if(!presenteOtra && pal.includes(ch)) return false;
    }
  }
  return true;
}
function filtrar(dic){
  let cand=dic;
  for(const h of historial) cand=cand.filter(p=>cumplePatron(p,h.palabra,h.colores));
  return cand;
}

// --------- Entropía exacta --------------
function patronKey(secret,guess){
  const res=Array(5).fill(0), usado=Array(5).fill(false);
  for(let i=0;i<5;i++){ if(secret[i]===guess[i]){res[i]=2;usado[i]=true;} }
  for(let i=0;i<5;i++){
    if(res[i]===0){
      for(let j=0;j<5;j++){
        if(!usado[j]&&guess[i]===secret[j]){res[i]=1;usado[j]=true;break;}
      }
    }
  }
  return res.join('');
}
function entropiaExacta(guess,cand){
  const mapa={}; const total=cand.length;
  for(const sol of cand){
    const k=patronKey(sol,guess);
    mapa[k]=(mapa[k]||0)+1;
  }
  let e=0;
  for(const k in mapa){
    const p=mapa[k]/total;
    e+=p*Math.log2(1/p);
  }
  return e;
}

// --------- Generar listas ---------------
function generarListas(){
  const cand=filtrar(diccionario);
  if(cand.length===0){alerta("Ninguna palabra cumple las pistas.");return;}

  // --- frecuencias f[ch]
  const f={};
  for(const w of cand){ for(const ch of w){f[ch]=(f[ch]||0)+1;} }

  // --- conjuntos de letras conocidas / grises
  const setKnown=new Set(), setGris=new Set();
  for(const h of historial){
    h.colores.forEach((c,i)=>{
      const ch=h.palabra[i];
      if(c==='verde'||c==='amarillo') setKnown.add(ch);
      else if(c==='gris'){
        // comprobar si la misma letra aparece en pos verde/amarilla
        let presente=false;
        for(let j=0;j<5;j++){
          if(j!==i && h.palabra[j]===ch && h.colores[j]!=='gris'){presente=true;break;}
        }
        if(!presente) setGris.add(ch);
      }
    });
  }

  // --- SugerirExploratorias (idéntico a VBA)
  const probeCands=[];
  for(const w of diccionario){
    const usadas=new Set(); let score=0, rep=false;
    for(const ch of w){
      if(usadas.has(ch)) continue;
      usadas.add(ch);
      if(!setKnown.has(ch) && !setGris.has(ch)){
        score+= (f[ch]||0);
      }else{ rep=true; }
    }
    if(rep) score-=5;
    if(score>0) probeCands.push({w,score});
  }

  // --- Lista resolver
  const listaResolver=cand.map(w=>({w,h:entropiaExacta(w,cand)}))
                          .sort((a,b)=>b.h-a.h)
                          .slice(0,TOP_N_OUT);

  // --- Lista descartar
  const listaDescartar=probeCands.map(o=>({w:o.w,h:entropiaExacta(o.w,cand)}))
                                 .sort((a,b)=>b.h-a.h)
                                 .slice(0,TOP_N_DESC);

  // --- Repetición verde
  const verdes=new Set();
  historial.forEach(h=>h.colores.forEach((c,i)=>{if(c==='verde') verdes.add(h.palabra[i]);}));
  const listaVerde=diccionario.filter(w=>{
                      for(const ch of verdes){
                        if(w.includes(ch) && w.split(ch).length-1>=2) return true;
                      } return false;
                    })
                    .map(w=>({w,h:entropiaExacta(w,cand)}))
                    .sort((a,b)=>b.h-a.h)
                    .slice(0,TOP_N_DESC);

  // --- Frecuencias de letras
  const freq={};
  "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split('').forEach(ch=>freq[ch]={count:0,words:0,rep:0});
  for(const w of cand){
    const seen=new Set(); const localCount={};
    for(const ch of w){
      freq[ch].count++; seen.add(ch);
      localCount[ch]=(localCount[ch]||0)+1;
    }
    seen.forEach(ch=>freq[ch].words++);
    for(const ch in localCount){ if(localCount[ch]>=2) freq[ch].rep++; }
  }
  const listaFreq=Object.entries(freq).sort((a,b)=>b[1].words-a[1].words)
                     .map(([letra,v])=>({letra,...v}));

  // --- Renderizado
  renderTabla('tablaResolver',listaResolver);
  renderTabla('tablaDescartar',listaDescartar);
  renderTabla('tablaVerde',listaVerde);
  renderTablaFreq('tablaLetras',listaFreq);
}

function renderTabla(id,lista){
  const tbody=document.getElementById(id).querySelector('tbody');
  tbody.innerHTML='';
  for(const o of lista){
    const tr=document.createElement('tr');
    ['w','h'].forEach((k,idx)=>{
      const td=document.createElement('td');
      td.textContent = k==='h'? o[k].toFixed(2):o[k];
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
}
function renderTablaFreq(id,lista){
  const tbody=document.getElementById(id).querySelector('tbody');
  tbody.innerHTML='';
  for(const o of lista){
    const tr=document.createElement('tr');
    ['letra','count','words','rep'].forEach(k=>{
      const td=document.createElement('td'); td.textContent=o[k]; tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
}

// --------- Eventos UI --------------
document.getElementById('btnGuardar').onclick=guardarIntento;
document.getElementById('btnReset').onclick=resetear;
document.getElementById('btnCalcular').onclick=generarListas;
