
function obtenerPatron(secreta, intento) {
    const resultado = Array(5).fill(0); // 0 = gris
    const usada = Array(5).fill(false);

    // Primero, marcar los verdes
    for (let i = 0; i < 5; i++) {
        if (intento[i] === secreta[i]) {
            resultado[i] = 2;
            usada[i] = true;
        }
    }

    // Luego, marcar amarillos
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
    const input = document.getElementById("guess").value.toUpperCase();
    if (!/^[A-ZÑ]{5}$/.test(input)) {
        document.getElementById("output").innerText = "Introduce exactamente 5 letras (puede incluir Ñ)";
        return;
    }

    const posibles = diccionario.slice(); // En el futuro, aplicar filtros por colores aquí
    const resultados = [];

    for (const palabra of diccionario) {
        const e = entropiaExacta(palabra, posibles);
        resultados.push({ palabra, entropia: e });
    }

    resultados.sort((a, b) => b.entropia - a.entropia);

    let salida = `Has introducido: ${input}\n\nTop 10 palabras por entropía exacta:\n`;
    salida += resultados.slice(0, 10).map(p => `${p.palabra} (H: ${p.entropia.toFixed(3)})`).join("\n");
    document.getElementById("output").innerText = salida;
}
