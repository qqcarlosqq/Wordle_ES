var diccionarioList = (typeof diccionario!=='undefined') ? diccionario.map(w=>w.toUpperCase()) : [];

/* --- Utilidad normalizar disponible globalmente --- */
function normalizar(w){
  return w.toUpperCase()
          .replace(/Á/g,'A').replace(/É/g,'E').replace(/Í/g,'I')
          .replace(/Ó/g,'O').replace(/Ú/g,'U').replace(/Ü/g,'U');
}

/* --- Gestión de pestañas --- */
document.addEventListener('DOMContentLoaded',()=>{
  const ps=document.getElementById('panelSolver');
  const pb=document.getElementById('panelBuscar');
  const ts=document.getElementById('tabSolver');
  const tl=document.getElementById('tabLetras');
  if(ts && tl){
    ts.onclick=()=>{ps.style.display='block';pb.style.display='none';};
    tl.onclick=()=>{pb.style.display='block';ps.style.display='none';};
  }
});
// core solver not found in this environment

/* --- BuscarPalabrasUsuario --- */
document.addEventListener('DOMContentLoaded',()=>{
  const btn=document.getElementById('btnBuscarUsuario');
  if(btn){btn.onclick=buscarPalabrasUsuario;}
});
function buscarPalabrasUsuario(){
  const inp=document.getElementById('inputLetras');
  const letrasRaw=normalizar(inp.value.trim()).replace(/[^A-ZÑ]/g,'');
  const letras=[...new Set(letrasRaw.split(''))];
  if(letras.length===0||letras.length>5){alert('Introduce entre 1 y 5 letras');return;}
  const out=document.getElementById('resultadoBusqueda'); out.innerHTML='';
  const exact=diccionarioList.filter(w=>letras.every(ch=>w.includes(ch)));
  if(exact.length){out.appendChild(crearTabla('Palabras con '+letras.join(', '), exact));return;}
  for(let k=letras.length-1;k>=1;k--){
    for(const comb of combinaciones(letras,k)){
      const lista=diccionarioList.filter(w=>comb.every(ch=>w.includes(ch)));
      if(lista.length){out.appendChild(crearTabla('Contiene '+comb.join(', '),lista));return;}
    }
  }
  out.textContent='No se encontraron palabras.';
}
function combinaciones(arr,k){
  const res=[];(function rec(s,stk){if(stk.length===k){res.push(stk.slice());return;}
    for(let i=s;i<arr.length;i++){stk.push(arr[i]);rec(i+1,stk);stk.pop();}})(0,[]);
  return res;
}
function crearTabla(titulo,lista){
  const d=document.createElement('div');
  d.innerHTML='<h3>'+titulo+'</h3>';
  const tb=document.createElement('table');tb.innerHTML='<thead><tr><th>Palabra</th></tr></thead>';
  const bd=document.createElement('tbody');
  lista.slice(0,500).forEach(w=>{
    const tr=document.createElement('tr');const td=document.createElement('td');td.textContent=w;
    tr.appendChild(td);bd.appendChild(tr);
  });
  tb.appendChild(bd);d.appendChild(tb);return d;
}
