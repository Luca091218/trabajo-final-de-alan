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
const bookingDays = document.getElementById("booking-days");
const cancelModal = document.getElementById("cancel-modal");
const cancelClose = document.getElementById("cancel-close");
const cancelConfirm = document.getElementById("cancel-confirm");
const forgotModal = document.getElementById("forgot-modal");
const forgotLink = document.getElementById("forgot-password-link");
const forgotClose = document.getElementById("forgot-close");
const forgotForm = document.getElementById("forgot-form");
const forgotStatus = document.getElementById("forgot-status");

let selectedCancha = null;
let selectedHorario = null;
let selectedDate = null;
let selectedDateLabel = "";
let pendingCancelId = null;

const formatDateTime = (date) => {
    const pad = (value) => String(value).padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const getDateKey = (date) => formatDateTime(date).split(" ")[0];

const buildHorario = (timeStr) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const target = selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date();
    target.setHours(hours, minutes, 0, 0);

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

const markAvailability = (ocupados = [], propios = []) => {
    if (!bookingGrid) {
        return;
    }

    const ocupadosSet = new Set(ocupados);
    const propiosSet = new Set(propios);
    const todayKey = getDateKey(new Date());
    const now = new Date();

    bookingGrid.querySelectorAll(".slot-btn").forEach((button) => {
        const horarioBase = button.dataset.horario;
        const horarioFull = horarioBase ? buildHorario(horarioBase) : null;
        const isOcupado = horarioFull ? ocupadosSet.has(horarioFull) : false;
        const isPropio = horarioFull ? propiosSet.has(horarioFull) : false;
        let isPast = false;

        if (selectedDate && selectedDate === todayKey && horarioBase) {
            const [hours, minutes] = horarioBase.split(":").map(Number);
            const slotTime = new Date();
            slotTime.setHours(hours, minutes, 0, 0);
            isPast = slotTime <= now;
        }

        button.disabled = isOcupado || isPast;
        button.classList.toggle("is-owned", isPropio);
        button.classList.toggle("is-occupied", isOcupado && !isPropio);
        button.classList.toggle("is-past", isPast);

        if (isOcupado || isPast) {
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

    if (!selectedDate) {
        return;
    }

    const response = await fetch(
        `/turnos/disponibles?cancha_tipo=${selectedCancha}&fecha=${selectedDate}`
    );
    const data = await response.json();

    if (!response.ok) {
        setBookingStatus(data.mensaje || "No se pudieron cargar los horarios.", "error");
        return;
    }

    markAvailability(data.ocupados || [], data.mios || []);
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

const buildDayLabel = (date, index) => {
    if (index === 0) {
        return "Hoy";
    }
    if (index === 1) {
        return "Mañana";
    }
    const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
    const dayName = dayNames[date.getDay()];
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${dayName} ${day}/${month}`;
};

const renderDays = () => {
    if (!bookingDays) {
        return;
    }

    bookingDays.innerHTML = "";
    const today = new Date();

    for (let i = 0; i < 7; i += 1) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateKey = getDateKey(date);
        const label = buildDayLabel(date, i);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chip day-chip";
        button.dataset.date = dateKey;
        button.dataset.label = label;
        button.textContent = label;
        if (i === 0) {
            button.classList.add("is-active");
            selectedDate = dateKey;
            selectedDateLabel = label;
        }
        button.addEventListener("click", () => {
            bookingDays.querySelectorAll(".day-chip").forEach((item) => {
                item.classList.remove("is-active");
            });
            button.classList.add("is-active");
            selectedDate = button.dataset.date;
            selectedDateLabel = button.dataset.label || "";
            clearSelection();
            loadDisponibles();
        });
        bookingDays.appendChild(button);
    }
};

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
        const label = selectedDateLabel ? ` · ${selectedDateLabel}` : "";
        setSelectedText(`Seleccionado: F${selectedCancha} · ${horarioBase}${label}`);
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
        pendingCancelId = turnoId;
        if (cancelModal) {
            cancelModal.classList.add("is-open");
            cancelModal.setAttribute("aria-hidden", "false");
        }
    });
}

const closeCancelModal = () => {
    if (!cancelModal) {
        return;
    }
    cancelModal.classList.remove("is-open");
    cancelModal.setAttribute("aria-hidden", "true");
    pendingCancelId = null;
};

if (cancelClose) {
    cancelClose.addEventListener("click", closeCancelModal);
}

if (cancelModal) {
    cancelModal.addEventListener("click", (event) => {
        if (event.target.dataset.close === "true") {
            closeCancelModal();
        }
    });
}

if (cancelConfirm) {
    cancelConfirm.addEventListener("click", async () => {
        if (!pendingCancelId) {
            closeCancelModal();
            return;
        }
        setBookingStatus("Cancelando turno...");
        const response = await fetch(`/turnos/${pendingCancelId}`, { method: "DELETE" });
        const data = await response.json();

        if (!response.ok) {
            setBookingStatus(data.mensaje || "No se pudo cancelar el turno.", "error");
            return;
        }

        setBookingStatus("Turno cancelado.", "success");
        closeCancelModal();
        await loadMisTurnos();
        await loadDisponibles();
    });
}

const openForgotModal = () => {
    if (!forgotModal) {
        return;
    }
    forgotModal.classList.add("is-open");
    forgotModal.setAttribute("aria-hidden", "false");
    if (forgotStatus) {
        forgotStatus.textContent = "";
        forgotStatus.className = "form-status";
    }
};

const closeForgotModal = () => {
    if (!forgotModal) {
        return;
    }
    forgotModal.classList.remove("is-open");
    forgotModal.setAttribute("aria-hidden", "true");
};

if (forgotLink) {
    forgotLink.addEventListener("click", (event) => {
        event.preventDefault();
        openForgotModal();
    });
}

if (forgotClose) {
    forgotClose.addEventListener("click", closeForgotModal);
}

if (forgotModal) {
    forgotModal.addEventListener("click", (event) => {
        if (event.target.dataset.close === "true") {
            closeForgotModal();
        }
    });
}

if (forgotForm) {
    forgotForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const email = document.getElementById("forgot-email").value.trim();
        const password = document.getElementById("forgot-password").value;
        const confirm = document.getElementById("forgot-password-confirm").value;

        if (password !== confirm) {
            if (forgotStatus) {
                forgotStatus.textContent = "Las contraseñas no coinciden.";
                forgotStatus.className = "form-status error";
            }
            return;
        }

        if (forgotStatus) {
            forgotStatus.textContent = "Actualizando contraseña...";
            forgotStatus.className = "form-status";
        }

        const response = await fetch("/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            if (forgotStatus) {
                forgotStatus.textContent = data.mensaje || "No se pudo actualizar.";
                forgotStatus.className = "form-status error";
            }
            return;
        }

        if (forgotStatus) {
            forgotStatus.textContent = "Contraseña actualizada. Ya podés iniciar sesión.";
            forgotStatus.className = "form-status success";
        }
        forgotForm.reset();
    });
}

if (bookingGrid) {
    renderDays();
    clearSelection();
    loadDisponibles();
    loadMisTurnos();
}
