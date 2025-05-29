
function obtenerPatron(secreta, intento) {
    const resultado = Array(5).fill(0); // 0 = gris
    const usada = Array(5).fill(false);

    // Marcar verdes
    for (let i = 0; i < 5; i++) {
        if (intento[i] === secreta[i]) {
            resultado[i] = 2;
            usada[i] = true;
        }
    }

    // Marcar amarillos
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

function leerColores() {
    const colores = [];
    for (let i = 0; i < 5; i++) {
        colores.push(document.getElementById("color" + i).value);
    }
    return colores;
}

function filtrarDiccionario(palabra, colores) {
    return diccionario.filter(pal => {
        for (let i = 0; i < 5; i++) {
            const letra = palabra[i];
            const color = colores[i];

            if (color === "verde" && pal[i] !== letra) return false;
            if (color === "amarillo" && (!pal.includes(letra) || pal[i] === letra)) return false;
            if (color === "gris" && pal.includes(letra)) {
                // Si la letra aparece como verde o amarillo en otra posición, la permitimos
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

function calcular() {
    const input = document.getElementById("guess").value.toUpperCase();
    if (!/^[A-ZÑ]{5}$/.test(input)) {
        document.getElementById("output").innerText = "Introduce exactamente 5 letras (puede incluir Ñ)";
        return;
    }

    const colores = leerColores();
    const posibles = filtrarDiccionario(input, colores);
    const resultados = [];

    for (const palabra of diccionario) {
        const e = entropiaExacta(palabra, posibles);
        resultados.push({ palabra, entropia: e });
    }

    resultados.sort((a, b) => b.entropia - a.entropia);

    let salida = `Has introducido: ${input}\nColores: ${colores.join(", ")}\n\nPalabras candidatas: ${posibles.length}\n\nTop 10 palabras por entropía exacta:\n`;
    salida += resultados.slice(0, 10).map(p => `${p.palabra} (H: ${p.entropia.toFixed(3)})`).join("\n");
    document.getElementById("output").innerText = salida;
}
