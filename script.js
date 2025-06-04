// script.js FINAL (única definición diccionarioList) 2025-06-05
function normalizar(w){return w.toUpperCase()
  .replace(/Á/g,'A').replace(/É/g,'E').replace(/Í/g,'I')
  .replace(/Ó/g,'O').replace(/Ú/g,'U').replace(/Ü/g,'U');}

var diccionarioList = (typeof diccionario!=='undefined')
      ? diccionario.map(w=>w.toUpperCase())
      : [];

console.log('diccionarioList cargado:', diccionarioList.length,'palabras');

// --- resto de tu solver y buscador se mantiene igual ---
// (Pego el encabezado nada más para ilustrar; copia el resto de tu código aquí)
