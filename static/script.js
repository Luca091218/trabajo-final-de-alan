const form = document.getElementById("form");
const tabla = document.getElementById("tabla");

// Función asíncrona para obtener registros del servidor
async function cargarRegistros() {
    const response = await fetch("http://127.0.0.1:5000/listar");
    const datos = await response.json();

    tabla.innerHTML = "";

    datos.forEach(registro => {
        const fila = document.createElement("tr");
        fila.innerHTML = `
            <td>${registro.id}</td>
            <td>${registro.nombre}</td>
            <td>${registro.valor}</td>
        `;
        tabla.appendChild(fila);
    });
}

// Evento submit del formulario
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre = document.getElementById("nombre").value;
    const valor = document.getElementById("valor").value;

    // Envío asíncrono al backend (no bloquea la interfaz)
    await fetch("http://127.0.0.1:5000/insertar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, valor })
    });

    form.reset();
    cargarRegistros();
});

// Carga inicial
cargarRegistros();
