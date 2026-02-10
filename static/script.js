const registerForm = document.getElementById("register-form");
const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("logout-btn");

if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nombre = document.getElementById("register-nombre").value.trim();
        const email = document.getElementById("register-email").value.trim();
        const password = document.getElementById("register-password").value;
        const confirm = document.getElementById("register-password-confirm").value;
        const status = document.getElementById("register-status");

        if (password !== confirm) {
            status.textContent = "Las contraseñas no coinciden.";
            status.className = "form-status error";
            return;
        }

        status.textContent = "Creando cuenta...";
        status.className = "form-status";

        const response = await fetch("/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            status.textContent = data.mensaje || "Error al registrar.";
            status.className = "form-status error";
            return;
        }

        status.textContent = "Registro exitoso. Ahora podés iniciar sesión.";
        status.className = "form-status success";
        registerForm.reset();
    });
}

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;
        const status = document.getElementById("login-status");

        status.textContent = "Ingresando...";
        status.className = "form-status";

        const response = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            status.textContent = data.mensaje || "Credenciales inválidas.";
            status.className = "form-status error";
            return;
        }

        status.textContent = "Login exitoso. Redirigiendo...";
        status.className = "form-status success";
        window.location.href = "/me";
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await fetch("/logout", { method: "POST" });
        window.location.href = "/";
    });
}

const bookingGrid = document.getElementById("booking-grid");
const bookingStatus = document.getElementById("booking-status");
const bookingTypeButtons = document.querySelectorAll(".chip[data-cancha]");
const confirmBookingBtn = document.getElementById("confirm-booking");
const bookingSelected = document.getElementById("booking-selected");
const myTurnos = document.getElementById("me-turnos");

let selectedCancha = null;
let selectedHorario = null;

const formatDateTime = (date) => {
    const pad = (value) => String(value).padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const buildHorario = (timeStr) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const now = new Date();
    const target = new Date();
    target.setSeconds(0, 0);
    target.setHours(hours, minutes, 0, 0);

    if (target <= now) {
        target.setDate(target.getDate() + 1);
    }

    return formatDateTime(target);
};

const setBookingStatus = (message, state = "") => {
    if (!bookingStatus) {
        return;
    }
    bookingStatus.textContent = message;
    bookingStatus.className = state ? `form-status ${state}` : "form-status";
};

const setSelectedText = (text) => {
    if (bookingSelected) {
        bookingSelected.textContent = text;
    }
};

const clearSelection = () => {
    selectedHorario = null;
    if (confirmBookingBtn) {
        confirmBookingBtn.disabled = true;
    }
    if (bookingGrid) {
        bookingGrid.querySelectorAll(".slot-btn").forEach((button) => {
            button.classList.remove("is-selected");
        });
    }
    setSelectedText("Elegí un horario disponible.");
};

const markAvailability = (ocupados = []) => {
    if (!bookingGrid) {
        return;
    }

    bookingGrid.querySelectorAll(".slot-btn").forEach((button) => {
        const horarioBase = button.dataset.horario;
        const horarioFull = horarioBase ? buildHorario(horarioBase) : null;
        const isOcupado = horarioFull ? ocupados.includes(horarioFull) : false;

        button.disabled = isOcupado;
        button.classList.toggle("is-occupied", isOcupado);

        if (isOcupado) {
            button.classList.remove("is-selected");
            if (selectedHorario === horarioBase) {
                clearSelection();
            }
        }
    });
};

const loadDisponibles = async () => {
    if (!selectedCancha) {
        return;
    }

    const response = await fetch(`/turnos/disponibles?cancha_tipo=${selectedCancha}`);
    const data = await response.json();

    if (!response.ok) {
        setBookingStatus(data.mensaje || "No se pudieron cargar los horarios.", "error");
        return;
    }

    markAvailability(data.ocupados || []);
};

const renderTurnos = (turnos = []) => {
    if (!myTurnos) {
        return;
    }

    myTurnos.innerHTML = "";

    if (!turnos.length) {
        const empty = document.createElement("p");
        empty.className = "muted";
        empty.textContent = "No tenés turnos por el momento.";
        myTurnos.appendChild(empty);
        return;
    }

    turnos.forEach((turno) => {
        const item = document.createElement("div");
        item.className = "turno-item";

        const info = document.createElement("div");
        const name = document.createElement("span");
        name.className = "value";
        name.textContent = turno.nombre_reserva;
        const label = document.createElement("span");
        label.className = "label";
        label.textContent = "Reservado a tu nombre";
        info.appendChild(name);
        info.appendChild(label);

        const actions = document.createElement("div");
        actions.className = "turno-actions";
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = `F${turno.cancha_tipo} · ${turno.horario}`;
        const cancel = document.createElement("button");
        cancel.className = "btn btn-outline btn-small cancel-btn";
        cancel.type = "button";
        cancel.dataset.turnoId = turno.id;
        cancel.textContent = "Cancelar";
        actions.appendChild(badge);
        actions.appendChild(cancel);

        item.appendChild(info);
        item.appendChild(actions);
        myTurnos.appendChild(item);
    });
};

const loadMisTurnos = async () => {
    if (!myTurnos) {
        return;
    }

    const response = await fetch("/turnos/mios");
    const data = await response.json();

    if (!response.ok) {
        setBookingStatus(data.mensaje || "No se pudieron cargar tus turnos.", "error");
        return;
    }

    renderTurnos(data);
};

if (bookingTypeButtons.length) {
    selectedCancha = bookingTypeButtons[0].dataset.cancha || null;
    bookingTypeButtons.forEach((button) => {
        button.addEventListener("click", () => {
            bookingTypeButtons.forEach((item) => item.classList.remove("is-active"));
            button.classList.add("is-active");
            selectedCancha = button.dataset.cancha || null;
            clearSelection();
            loadDisponibles();
        });
    });
}

if (bookingGrid) {
    bookingGrid.addEventListener("click", async (event) => {
        const button = event.target.closest(".slot-btn");
        if (!button || button.disabled || button.classList.contains("is-occupied")) {
            return;
        }

        if (!selectedCancha) {
            setBookingStatus("Seleccioná el tipo de cancha.", "error");
            return;
        }

        const horarioBase = button.dataset.horario;
        if (!horarioBase) {
            setBookingStatus("Horario inválido.", "error");
            return;
        }

        bookingGrid.querySelectorAll(".slot-btn").forEach((slot) => {
            slot.classList.remove("is-selected");
        });
        button.classList.add("is-selected");
        selectedHorario = horarioBase;
        if (confirmBookingBtn) {
            confirmBookingBtn.disabled = false;
        }
        setSelectedText(`Seleccionado: F${selectedCancha} · ${horarioBase}`);
    });
}

if (confirmBookingBtn) {
    confirmBookingBtn.addEventListener("click", async () => {
        if (!selectedCancha || !selectedHorario) {
            setBookingStatus("Elegí una cancha y un horario.", "error");
            return;
        }

        confirmBookingBtn.disabled = true;
        setBookingStatus("Guardando turno...");

        const response = await fetch("/turnos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                horario: buildHorario(selectedHorario),
                cancha_tipo: selectedCancha
            })
        });

        const data = await response.json();

        if (!response.ok) {
            setBookingStatus(data.mensaje || "No se pudo crear el turno.", "error");
            confirmBookingBtn.disabled = false;
            return;
        }

        setBookingStatus("Turno reservado con éxito.", "success");
        clearSelection();
        await loadMisTurnos();
        await loadDisponibles();
    });
}

if (myTurnos) {
    myTurnos.addEventListener("click", async (event) => {
        const button = event.target.closest(".cancel-btn");
        if (!button) {
            return;
        }

        const turnoId = button.dataset.turnoId;
        if (!turnoId) {
            return;
        }

        button.disabled = true;
        setBookingStatus("Cancelando turno...");

        const response = await fetch(`/turnos/${turnoId}`, { method: "DELETE" });
        const data = await response.json();

        if (!response.ok) {
            setBookingStatus(data.mensaje || "No se pudo cancelar el turno.", "error");
            button.disabled = false;
            return;
        }

        setBookingStatus("Turno cancelado.", "success");
        await loadMisTurnos();
        await loadDisponibles();
    });
}

if (bookingGrid) {
    clearSelection();
    loadDisponibles();
    loadMisTurnos();
}
