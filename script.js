
document.addEventListener('DOMContentLoaded',()=>{
  const ps=document.getElementById('panelSolver');
  const pb=document.getElementById('panelBuscar');
  const ts=document.getElementById('tabSolver');
  const tl=document.getElementById('tabLetras');
  if(ts&&tl){
    ts.onclick=()=>{ps.style.display='block';pb.style.display='none';};
    tl.onclick=()=>{pb.style.display='block';ps.style.display='none';};
  }
});
// base solver code missing in this environment.
// aseguramos ordenación final
function ordenarFinal(listaDesc,listaVer){
  listaDesc.sort((a,b)=>b.h-a.h);
  listaVer.sort((a,b)=>b.h-a.h);
}

document.addEventListener('DOMContentLoaded',()=>{
  const b=document.getElementById('btnBuscarUsuario');
  if(b) b.onclick=buscarPalabrasUsuario;
});
function buscarPalabrasUsuario(){
  const inp=document.getElementById('inputLetras');
  const letrasRaw=normalizar(inp.value.trim()).replace(/[^A-ZÑ]/g,'');
  const letras=[...new Set(letrasRaw.split(''))];
  if(letras.length===0||letras.length>5){alert('Introduce 1‑5 letras');return;}
  const out=document.getElementById('resultadoBusqueda'); out.innerHTML='';
  const exact=diccionarioList.filter(w=>letras.every(ch=>w.includes(ch)));
  if(exact.length){out.appendChild(tabla('Palabras con '+letras.join(', '),exact));return;}
  for(let k=letras.length-1;k>=1;k--){
    for(const c of comb(letras,k)){
      const l=diccionarioList.filter(w=>c.every(ch=>w.includes(ch)));
      if(l.length){out.appendChild(tabla('Contiene '+c.join(', '),l));return;}
    }
  }
  out.textContent='No se encontraron palabras.';
}
function comb(arr,k){const r=[];(function f(s,stk){if(stk.length===k){r.push(stk.slice());return;}
for(let i=s;i<arr.length;i++){stk.push(arr[i]);f(i+1,stk);stk.pop();}})(0,[]);return r;}
function tabla(t,l){
  const d=document.createElement('div'); d.innerHTML='<h3>'+t+'</h3>';
  const tb=document.createElement('table');tb.innerHTML='<thead><tr><th>Palabra</th></tr></thead>';
  const bd=document.createElement('tbody');
  l.slice(0,500).forEach(w=>{const tr=document.createElement('tr');const td=document.createElement('td');td.textContent=w;tr.appendChild(td);bd.appendChild(tr);});
  tb.appendChild(bd); d.appendChild(tb); return d;
}
