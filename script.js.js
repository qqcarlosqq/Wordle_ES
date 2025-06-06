const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.9.179/pdf.worker.min.js";

const log = msg => { document.getElementById("log").textContent += msg+"\n"; };

document.getElementById("runBtn").onclick = async ()=>{
  const pdfFiles=[...document.getElementById("pdfInput").files];
  const dicFile  =document.getElementById("dicInput").files[0];
  if(pdfFiles.length!==3 || !dicFile){
    alert("Selecciona los 3 PDF y diccionario.js");return;}
  document.getElementById("downloads").innerHTML='';
  log("Leyendo PDF… (puede tardar)");
  const raeSet=new Set();
  for(const f of pdfFiles){
    await extraerPDF(f,raeSet);
    log(`· ${f.name} procesado (${raeSet.size} palabras recogidas)`);
  }
/* ...código anterior sin cambios... */
log("Leyendo diccionario.js…");
const dicText = await dicFile.text();
const m = dicText.match(/\[[^\]]+\]/s);
if(!m){ alert("No se encontró un array en diccionario.js"); return; }
const wordArray = JSON.parse(m[0]).map(w=>w.toUpperCase());
log(`Palabras Wordle: ${wordArray.length}`);

/* el resto igual — usa wordArray en vez de arr */
const listaA=[], listaB=[];
wordArray.forEach(w=>(raeSet.has(w)?listaA:listaB).push(w));

crearDescarga("muy_probables.txt",listaA);
crearDescarga("poco_probables.txt",listaB);
log("Hecho ✔︎");

};

async function extraerPDF(file,set){
  const buf=await file.arrayBuffer();
  const pdf=await pdfjsLib.getDocument({data:buf}).promise;
  const re=/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{5}/g;
  for(let p=1;p<=pdf.numPages;p++){
    const txt=await (await pdf.getPage(p)).getTextContent();
    const str=txt.items.map(i=>i.str).join(' ');
    const m=str.match(re); if(!m) continue;
    m.forEach(w=>{
      set.add(w.toUpperCase()
         .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
         .replace('Ü','U'));
    });
  }
}

function crearDescarga(nombre,lista){
  const blob=new Blob([lista.join("\n")],{type:"text/plain"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.textContent=`► ${nombre}  (${lista.length})`;
  a.href=url; a.download=nombre; a.className="dl";
  document.getElementById("downloads").appendChild(a);
}
