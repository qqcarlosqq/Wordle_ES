
let historial = [];

function leerColores() {
    const colores = [];
    for (let i = 0; i < 5; i++) {
        colores.push(document.getElementById("color" + i).value);
    }
    return colores;
}

function guardarIntento() {
    const input = document.getElementById("guess").value.toUpperCase();
    if (!/^[A-ZÑ]{5}$/.test(input)) {
        alert("Introduce exactamente 5 letras válidas.");
        return;
    }
    const colores = leerColores();
    historial.push({ palabra: input, colores });
    document.getElementById("guess").value = "";
    for (let i = 0; i < 5; i++) {
        document.getElementById("color" + i).value = "gris";
    }
    mostrarHistorial();
}

function mostrarHistorial() {
    const div = document.getElementById("historial");
    if (historial.length === 0) {
        div.innerHTML = "";
        return;
    }
    div.innerHTML = "<b>Intentos guardados:</b><br>" + historial.map(h =>
        `${h.palabra} → ${h.colores.join(", ")}`).join("<br>");
}

function resetear() {
    historial = [];
    document.getElementById("tablaCandidatas").querySelector("tbody").innerHTML = "";
    document.getElementById("tablaDescartadoras").querySelector("tbody").innerHTML = "";
    document.getElementById("historial").innerText = "";
    document.getElementById("nCandidatas").innerText = "";
}

function filtrarConHistorial(dic) {
    let posibles = dic;
    for (const intento of historial) {
        posibles = filtrarDiccionario(intento.palabra, intento.colores, posibles);
    }
    return posibles;
}

function filtrarDiccionario(palabra, colores, base) {
    return base.filter(pal => {
        for (let i = 0; i < 5; i++) {
            const letra = palabra[i];
            const color = colores[i];

            if (color === "verde" && pal[i] !== letra) return false;
            if (color === "amarillo" && (!pal.includes(letra) || pal[i] === letra)) return false;
            if (color === "gris" && pal.includes(letra)) {
                let apareceEnOtra = false;
                for (let j = 0; j < 5; j++) {
                    if (j !== i && palabra[j] === letra && (colores[j] === "verde" || colores[j] === "amarillo")) {
                        apareceEnOtra = true;
                        break;
                    }
                }
                if (!apareceEnOtra) return false;
            }
        }
        return true;
    });
}

function obtenerPatron(secreta, intento) {
    const resultado = Array(5).fill(0);
    const usada = Array(5).fill(false);
    for (let i = 0; i < 5; i++) {
        if (intento[i] === secreta[i]) {
            resultado[i] = 2;
            usada[i] = true;
        }
    }
    for (let i = 0; i < 5; i++) {
        if (resultado[i] === 0) {
            for (let j = 0; j < 5; j++) {
                if (!usada[j] && intento[i] === secreta[j]) {
                    resultado[i] = 1;
                    usada[j] = true;
                    break;
                }
            }
        }
    }
    return resultado.join('');
}

function entropiaExacta(palabraCandidata, posibles) {
    const patrones = {};
    for (const secreta of posibles) {
        const patron = obtenerPatron(secreta, palabraCandidata);
        patrones[patron] = (patrones[patron] || 0) + 1;
    }

    let entropia = 0;
    const total = posibles.length;
    for (const patron in patrones) {
        const p = patrones[patron] / total;
        entropia += p * Math.log2(1 / p);
    }

    return entropia;
}

function calcular() {
    const posibles = filtrarConHistorial(diccionario);
    const listaCandidatas = posibles.map(p => ({
        palabra: p,
        entropia: entropiaExacta(p, posibles)
    })).sort((a, b) => b.entropia - a.entropia).slice(0, 200);

    const listaDescartadoras = diccionario.map(p => ({
        palabra: p,
        entropia: entropiaExacta(p, posibles)
    })).sort((a, b) => b.entropia - a.entropia).slice(0, 10);

    document.getElementById("nCandidatas").innerText = `(${posibles.length} palabras)`;
    renderTabla("tablaCandidatas", listaCandidatas);
    renderTabla("tablaDescartadoras", listaDescartadoras);
}

function renderTabla(idTabla, lista) {
    const tbody = document.getElementById(idTabla).querySelector("tbody");
    tbody.innerHTML = "";
    for (const elem of lista) {
        const fila = document.createElement("tr");
        const celdaPalabra = document.createElement("td");
        celdaPalabra.textContent = elem.palabra;
        const celdaScore = document.createElement("td");
        celdaScore.textContent = elem.entropia.toFixed(3);
        fila.appendChild(celdaPalabra);
        fila.appendChild(celdaScore);
        tbody.appendChild(fila);
    }
}
