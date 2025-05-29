
function calcular() {
    const input = document.getElementById("guess").value.toUpperCase();
    if (!/^[A-ZÑ]{5}$/.test(input)) {
        document.getElementById("output").innerText = "Introduce exactamente 5 letras (puede incluir Ñ)";
        return;
    }

    // Aquí irá la lógica real de cálculo
    document.getElementById("output").innerText = `Has introducido: ${input}\n(la lógica aún está por implementarse)`;
}
