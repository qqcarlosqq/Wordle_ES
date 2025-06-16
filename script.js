// Wordle Solver — Español  v5.4  (ajuste descartar + repetición verde sin amarillas)

/* ---------- Config ---------- */
const COLORES = ["gris", "amarillo", "verde"];
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
  const t = $(id); if(!t) return null;
  let b = t.querySelector("tbody");
  if(!b){ b=document.createElement("tbody"); t.appendChild(b); }
  return b;
};
const upper = s => s
  .toUpperCase()                   // mayúsculas
  .normalize('NFD')                // descompone (Ñ → N + ̃)
  .replace(/N\u0303/g,'Ñ')         // re-compone la Ñ
  .replace(/[\u0300-\u036f]/g,'')  // quita los demás diacríticos
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
  ["tabSolver","tabLetras","tabCompare"].forEach(id=>{
    $(id).classList.toggle("active", id==="tab"+(t==="buscar"?"Letras":t.charAt(0).toUpperCase()+t.slice(1)));
  });
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
  const setGreen=new Set(), setYellow=new Set(), setGray=new Set();
  const posNo=[];
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
  for(const s of candidatas){
    const k=patronClave(s,word); map.set(k,(map.get(k)||0)+1);
  }
  const sum=[...map.values()].reduce((a,x)=>a+x*x,0);
  const h=n - sum/n;
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

  /* ---------- conjuntos auxiliares ---------- */
  const yellowLetters = filtro.setYellow;  // letras amarillas totales
  const contieneAmarilla = w=>{
    for(const ch of yellowLetters) if(w.includes(ch)) return true;
    return false;
  };

  /* ---------- Resolver ---------- */
  const listaRes=candidatas.map(w=>({
    w,
    h: exact? entropiaExacta(w) : rapidoCache.get(w)
  })).sort((a,b)=>b.h-a.h).slice(0,200);
  renderTabla("tablaResolver",listaRes);

  /* ---------- Mejor descarte (sin amarillas) ---------- */
  const letrasConocidas=new Set();
  history.forEach(h=>h.word.split('').forEach(ch=>letrasConocidas.add(ch)));
  function scoreDescartar(w){
    let h = exact? entropiaExacta(w) : rapidoCache.get(w) || 0;
    letrasConocidas.forEach(ch=>{ if(w.includes(ch)) h-=5; });
    return h;
  }
  const listaDesc = dicList
    .filter(w=>!contieneAmarilla(w))          // **excluye cualquier palabra con amarillas**
    .map(w=>({w,h:scoreDescartar(w)}))
    .sort((a,b)=>b.h-a.h).slice(0,15);
  renderTabla("tablaDescartar",listaDesc);

  /* ---------- Repetición verde (sin amarillas) ---------- */
  const greensPos = Array(5).fill(null);
  history.forEach(h=>h.colors.forEach((c,i)=>{ if(c==="verde") greensPos[i]=h.word[i]; }));
  const listaVerde = dicList
    .filter(w=>{
      if(contieneAmarilla(w)) return false;   // **excluye amarillas**
      if(!greensPos.some(ch=>ch)) return true;          // sin verdes -> lista genérica
      return greensPos.every((ch,i)=>!ch || (w.includes(ch) && w[i]!==ch));
    })
    .map(w=>({w,h: exact? entropiaExacta(w) : 0}))
    .sort((a,b)=>b.h-a.h).slice(0,15);
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

/* ---------- Render tabla genérica ---------- */
function renderTabla(id,list){
  const tb=ensureBody(id); if(!tb) return; tb.innerHTML='';
  list.forEach(o=>{
    const tr=document.createElement("tr");
    const td1=document.createElement("td"); td1.textContent=o.w; tr.appendChild(td1);
    const td2=document.createElement("td"); td2.textContent=o.h.toFixed(2); tr.appendChild(td2);
    tb.appendChild(tr);
  });
}
function renderTablaFreq(id,list){
  const tb=ensureBody(id); if(!tb) return; tb.innerHTML='';
  list.forEach(r=>{
    const tr=document.createElement("tr");
    [r.ch,r.ap,r.pal,r.rep].forEach(t=>{
      const td=document.createElement("td"); td.textContent=t; tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
}

/* ---------- Buscar letras ---------- */
function buscarPalabrasUsuario(){
  const raw=upper($("inputLetras").value).replace(/[^A-ZÑ]/g,'');
  if(!raw){alert("Introduce letras");return;}
  const letras=[...new Set(raw.split(''))]; if(letras.length>5){alert("Máx 5");return;}
  let res={};
  for(let om=0;om<=letras.length;om++){
    combinar(letras,letras.length-om).forEach(c=>{
      const hits=dicList.filter(w=>c.every(l=>w.includes(l)));
      if(hits.length) res[c.join('')]=hits;
    });
    if(Object.keys(res).length) break;
  }
  const div=$("resultadoBusqueda");
  if(!Object.keys(res).length){div.textContent="Sin resultados";return;}
  div.innerHTML = Object.entries(res).map(([c,w])=>
    `<h4>Usando ${c} (${w.length})</h4><pre style="white-space:pre-wrap">${w.join(', ')}</pre>`).join('');
}
function combinar(arr,k){
  const out=[],rec=(s,a)=>{ if(a.length===k){out.push(a.slice());return;}
    for(let i=s;i<arr.length;i++){a.push(arr[i]);rec(i+1,a);a.pop();}};
  rec(0,[]); return out;
}

/* ---------- Compare (≤25) ---------- */
function toggleCompareBtn(){ $("tabCompare").disabled=candidatas.length>25; }

/* paleta alto contraste 25 colores */
const palette=[
'#ffcc00','#4da6ff','#66cc66','#ff6666','#c58aff','#ffa64d','#4dd2ff','#99ff99',
'#ff80b3','#b3b3ff','#ffd24d','#3399ff','#77dd77','#ff4d4d','#c299ff','#ffb84d',
'#00bfff','#99e699','#ff99c2','#9999ff','#ffe066','#0080ff',
'#66ffb3','#ff4da6','#8080ff'];

function runCompare(){
  if(candidatas.length>25){alert("≤25 candidatas");return;}
  const extra=upper($("extraInput").value).split(/[^A-ZÑ]/).filter(x=>x.length===5).slice(0,2);
  const words=[...candidatas.slice(0,25-extra.length),...extra];
  const n=words.length;if(!n){$("compareArea").textContent="No words";return;}

  const pat=words.map(g=>words.map(s=>patronClave(s,g)));

  let html='<table style="border-collapse:collapse;font-size:11px"><thead><tr><th></th>';
  words.forEach(w=>html+=`<th>${w}</th>`); html+='<th>opciones</th></tr></thead><tbody>';

  for(let i=0;i<n;i++){
    const row=pat[i], groups={};
    row.forEach((p,idx)=>{ (groups[p]=groups[p]||[]).push(idx); });
    let idx=0; Object.values(groups).forEach(g=>{ if(g.length>1) g.color=palette[idx++]; });
    let zeros=0;
    html+=`<tr><th>${words[i]}</th>`;
    for(let j=0;j<n;j++){
      const p=row[j], g=groups[p]; const jump=g.find(x=>x>j)?g.find(x=>x>j)-j:0;
      if(jump===0) zeros++;
      const bg=g.color||'#f2f2f2';
      html+=`<td style="text-align:center;background:${bg}">${p}-${jump}</td>`;
    }
    html+=`<td style="text-align:center;font-weight:bold">${zeros}</td></tr>`;
  }
  html+='</tbody></table>';
  $("compareArea").innerHTML=html;
}
