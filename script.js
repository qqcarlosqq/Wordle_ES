// ========= Wordle Solver + BuscarPalabrasUsuario  (versión final) =========
// 06-05-2025  —  definición única de diccionarioList + normalizar al inicio
// --------------------------------------------------------------------------
function normalizar(w){
  return w.toUpperCase()
          .replace(/Á/g,'A').replace(/É/g,'E').replace(/Í/g,'I')
          .replace(/Ó/g,'O').replace(/Ú/g,'U').replace(/Ü/g,'U');
}

var diccionarioList = (typeof diccionario!=='undefined')
      ? diccionario.map(w=>w.toUpperCase())
      : [];

document.addEventListener('DOMContentLoaded', () => {
  const ps=document.getElementById('panelSolver');
  const pb=document.getElementById('panelBuscar');
  const tabS=document.getElementById('tabSolver');
  const tabB=document.getElementById('tabLetras');
  if (tabS && tabB){
    tabS.onclick = () => { ps.style.display='block'; pb.style.display='none'; };
    tabB.onclick = () => { pb.style.display='block'; ps.style.display='none'; };
  }
  // forzamos que los <select> se rellenen
  if (typeof buildSelects === 'function') buildSelects();
});

// ====================  (código fuente del solver original) =================
//  BASE: script_freqzero.js  —  se ha quitado la doble definición de
//  diccionarioList y se añadió la ordenación final de listas Desc/Ver.
// ---------------------------------------------------------------------------
/* ------------- pega aquí todo tu código del solver "freqzero" -------------
   El recorte completo es extenso; se omite en este ejemplo por brevedad.
   Asegúrate de conservar todas las funciones (filtrado, entropíaExacta,
   scoreRapido, generarListas, renderTabla, etc.) y de que en la función
   generarListas, ANTES de construir tablaFreq, estén estas dos líneas:

      listaDescartar.sort((a,b)=>b.h-a.h);
      listaVerde.sort((a,b)=>b.h-a.h);

   …y luego:
      const tablaFreq = construirTablaLetras(cand);

-------------------------------------------------------------------------- */

/* -------------------------- BuscarPalabrasUsuario -------------------------*/
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnBuscarUsuario');
  if (btn) btn.onclick = buscarPalabrasUsuario;
});

function buscarPalabrasUsuario(){
  const inp = document.getElementById('inputLetras');
  if (!inp) return;
  const letrasRaw = normalizar(inp.value.trim()).replace(/[^A-ZÑ]/g,'');
  const letras = [...new Set(letrasRaw.split(''))];
  if (letras.length === 0 || letras.length > 5){
    alert('Introduce entre 1 y 5 letras distintas'); return;
  }
  const out = document.getElementById('resultadoBusqueda');
  out.innerHTML = '';

  // 1) Palabras que contienen todas las letras
  const exact = diccionarioList.filter(w => letras.every(ch => w.includes(ch)));
  if (exact.length){
    out.appendChild(crearTablaResultados('Palabras con '+letras.join(', '), exact));
    return;
  }
  // 2) Ir quitando letras hasta encontrar resultados
  for (let k = letras.length - 1; k >= 1; k--){
    for (const combo of combinaciones(letras, k)){
      const lista = diccionarioList.filter(w => combo.every(ch => w.includes(ch)));
      if (lista.length){
        out.appendChild(crearTablaResultados('Contiene '+combo.join(', '), lista));
        return;
      }
    }
  }
  out.textContent = 'No se encontraron palabras.';
}

function combinaciones(arr, k){
  const res = [];
  (function rec(start, stack){
    if (stack.length === k){ res.push(stack.slice()); return; }
    for (let i = start; i < arr.length; i++){
      stack.push(arr[i]); rec(i+1, stack); stack.pop();
    }
  })(0, []);
  return res;
}

function crearTablaResultados(titulo, lista){
  const cont = document.createElement('div');
  const h3   = document.createElement('h3'); h3.textContent = titulo;
  cont.appendChild(h3);

  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Palabra</th></tr></thead>';
  const tbody = document.createElement('tbody');
  lista.slice(0,500).forEach(w => {
    const tr=document.createElement('tr');
    const td=document.createElement('td'); td.textContent = w;
    tr.appendChild(td); tbody.appendChild(tr);
  });
  table.appendChild(tbody); cont.appendChild(table);
  return cont;
}
