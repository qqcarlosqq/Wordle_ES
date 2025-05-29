
function scoreRapido() {
    const frecuencia = {};
    const resultados = [];

    // Contar frecuencia de cada letra en todo el diccionario
    for (const palabra of diccionario) {
        const letrasUnicas = new Set(palabra);
        for (const letra of letrasUnicas) {
            frecuencia[letra] = (frecuencia[letra] || 0) + 1;
        }
    }

    // Calcular score para cada palabra según la frecuencia de sus letras únicas
    for (const palabra of diccionario) {
        const letrasUnicas = new Set(palabra);
        let score = 0;
        for (const letra of letrasUnicas) {
            score += frecuencia[letra];
        }
        resultados.push({ palabra, score });
    }

    // Ordenar de mayor a menor score
    resultados.sort((a, b) => b.score - a.score);

    return resultados;
}

// Ejemplo de uso:
function calcular() {
    const input = document.getElementById("guess").value.toUpperCase();
    if (!/^[A-ZÑ]{5}$/.test(input)) {
        document.getElementById("output").innerText = "Introduce exactamente 5 letras (puede incluir Ñ)";
        return;
    }

    let salida = `Has introducido: ${input}\n\nMejores 10 palabras por Score Rápido:\n`;
    const top10 = scoreRapido().slice(0, 10);
    salida += top10.map(p => `${p.palabra} (score: ${p.score})`).join("\n");

    document.getElementById("output").innerText = salida;
}
