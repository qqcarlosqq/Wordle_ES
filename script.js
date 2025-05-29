function calcular() {
    const input = document.getElementById("guess").value.toUpperCase();
    if (!/^[A-ZÑ]{5}$/.test(input)) {
        document.getElementById("output").innerText = "Introduce exactamente 5 letras (puede incluir Ñ)";
        return;
    }

    let salida = `Has introducido: ${input}\n\nPrimeras 5 palabras del diccionario:\n`;
    salida += diccionario.slice(0, 5).join("\n");

    document.getElementById("output").innerText = salida;
}