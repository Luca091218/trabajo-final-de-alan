from flask import Flask, request, jsonify, send_from_directory, render_template, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import sqlite3
import os

# Inicialización de la aplicación Flask
app = Flask(__name__, template_folder="../templates", static_folder="../static", static_url_path="")
app.secret_key = "khHFHJKAJKSHDjksnmsnajshjksskksd"

# Ruta absoluta del directorio actual
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Ruta a la base de datos SQLite
DB_PATH = os.path.join(BASE_DIR, "..", "database", "registros.db")

# Helper para conexión a SQLite
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

# Función que crea la base y las tablas si no existen
def inicializar_base():
    db_folder = os.path.join(BASE_DIR, "..", "database")
    if not os.path.exists(db_folder):
        os.makedirs(db_folder)

    conn = get_db_connection()
    cur = conn.cursor()


    cur.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    """)


    cur.execute("""
        CREATE TABLE IF NOT EXISTS turnos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            nombre_reserva TEXT NOT NULL,
            horario DATETIME NOT NULL,
            cancha_tipo TEXT NOT NULL DEFAULT '5',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
        );
    """)
    cur.execute("PRAGMA table_info(turnos)")
    columnas = [row[1] for row in cur.fetchall()]
    if "cancha_tipo" not in columnas:
        cur.execute("ALTER TABLE turnos ADD COLUMN cancha_tipo TEXT NOT NULL DEFAULT '5'")
    conn.commit()
    conn.close()

# Ruta principal para verificar que el servidor funciona
@app.route("/") 
def inicio():
    return render_template("index.html")

# Página básica /me (solo front)
@app.route("/me")
def me():
    user_id = session.get("user_id")
    if not user_id:
        return redirect(url_for("inicio"))

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, nombre, email, created_at FROM usuarios WHERE id = ?", (user_id,))
    row = cur.fetchone()

    cur.execute(
        """
        SELECT id, nombre_reserva, horario, cancha_tipo
        FROM turnos
        WHERE usuario_id = ? AND datetime(horario) > datetime('now')
        ORDER BY datetime(horario)
        """,
        (user_id,)
    )
    turnos_rows = cur.fetchall()
    conn.close()

    if not row:
        session.pop("user_id", None)
        return redirect(url_for("inicio"))

    usuario = {
        "id": row[0],
        "nombre": row[1],
        "email": row[2],
        "created_at": row[3]
    }

    turnos = []
    for turno in turnos_rows:
        turnos.append({
            "id": turno[0],
            "nombre_reserva": turno[1],
            "horario": turno[2],
            "cancha_tipo": turno[3]
        })

    return render_template("me.html", usuario=usuario, turnos=turnos)

# Página de registro (solo front)
@app.route("/register")
def register_page():
    return render_template("register.html")


# Endpoint POST para registrar usuario
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    nombre = (data.get("nombre") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not nombre or not email or not password:
        return jsonify({"estado": "error", "mensaje": "Faltan datos"}), 400

    password_hash = generate_password_hash(password)

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO usuarios (nombre, email, password_hash) VALUES (?, ?, ?)",
            (nombre, email, password_hash)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"estado": "error", "mensaje": "El email ya está registrado"}), 409
    conn.close()

    return jsonify({"estado": "ok", "mensaje": "Usuario registrado"})

# Endpoint POST para login
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"estado": "error", "mensaje": "Faltan datos"}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, nombre, email, password_hash FROM usuarios WHERE email = ?", (email,))
    row = cur.fetchone()
    conn.close()

    if not row:
        return jsonify({"estado": "error", "mensaje": "Credenciales inválidas"}), 401

    if not check_password_hash(row[3], password):
        return jsonify({"estado": "error", "mensaje": "Credenciales inválidas"}), 401

    session["user_id"] = row[0]
    return jsonify({
        "estado": "ok",
        "mensaje": "Login exitoso",
        "usuario": {"id": row[0], "nombre": row[1], "email": row[2]}
    })

# Endpoint POST para logout
@app.route("/logout", methods=["POST"])
def logout():
    session.pop("user_id", None)
    return jsonify({"estado": "ok", "mensaje": "Logout exitoso"})

# Endpoint POST para crear turno
@app.route("/turnos", methods=["POST"])
def crear_turno():
    data = request.get_json() or {}
    usuario_id = session.get("user_id")
    horario = data.get("horario")
    cancha_tipo = (data.get("cancha_tipo") or "").strip()

    if not usuario_id:
        return jsonify({"estado": "error", "mensaje": "Debés iniciar sesión"}), 401

    if not horario or not cancha_tipo:
        return jsonify({"estado": "error", "mensaje": "Faltan datos"}), 400

    if cancha_tipo not in {"5", "7", "8"}:
        return jsonify({"estado": "error", "mensaje": "Tipo de cancha inválido"}), 400

    try:
        horario_dt = datetime.strptime(horario, "%Y-%m-%d %H:%M")
    except ValueError:
        return jsonify({"estado": "error", "mensaje": "Horario inválido"}), 400

    now = datetime.now()
    max_date = now + timedelta(days=7)
    if horario_dt <= now or horario_dt > max_date:
        return jsonify({"estado": "error", "mensaje": "El turno debe ser dentro de la próxima semana"}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id FROM turnos
        WHERE cancha_tipo = ? AND horario = ? AND datetime(horario) > datetime('now')
        """,
        (cancha_tipo, horario)
    )
    if cur.fetchone():
        conn.close()
        return jsonify({"estado": "error", "mensaje": "Horario ocupado"}), 409

    cur.execute("SELECT nombre FROM usuarios WHERE id = ?", (usuario_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"estado": "error", "mensaje": "Usuario no existe"}), 404

    nombre_reserva = row[0]
    cur.execute(
        "INSERT INTO turnos (usuario_id, nombre_reserva, horario, cancha_tipo) VALUES (?, ?, ?, ?)",
        (usuario_id, nombre_reserva, horario, cancha_tipo)
    )
    conn.commit()
    conn.close()

    return jsonify({"estado": "ok", "mensaje": "Turno creado"})

# Endpoint GET para listar turnos del usuario logueado
@app.route("/turnos/mios", methods=["GET"])
def listar_turnos_mios():
    usuario_id = session.get("user_id")
    if not usuario_id:
        return jsonify({"estado": "error", "mensaje": "Debés iniciar sesión"}), 401

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, nombre_reserva, horario, cancha_tipo
        FROM turnos
        WHERE usuario_id = ? AND datetime(horario) > datetime('now')
        ORDER BY datetime(horario)
        """,
        (usuario_id,)
    )
    filas = cur.fetchall()
    conn.close()

    turnos = []
    for fila in filas:
        turnos.append({
            "id": fila[0],
            "nombre_reserva": fila[1],
            "horario": fila[2],
            "cancha_tipo": fila[3]
        })

    return jsonify(turnos)

# Endpoint GET para listar horarios ocupados por cancha
@app.route("/turnos/disponibles", methods=["GET"])
def listar_disponibles():
    usuario_id = session.get("user_id")
    if not usuario_id:
        return jsonify({"estado": "error", "mensaje": "Debés iniciar sesión"}), 401

    cancha_tipo = (request.args.get("cancha_tipo") or "").strip()
    fecha = (request.args.get("fecha") or "").strip()
    if cancha_tipo not in {"5", "7", "8"}:
        return jsonify({"estado": "error", "mensaje": "Tipo de cancha inválido"}), 400

    if not fecha:
        return jsonify({"estado": "error", "mensaje": "Falta la fecha"}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT horario, usuario_id FROM turnos
        WHERE cancha_tipo = ? AND date(horario) = ? AND datetime(horario) > datetime('now')
        """,
        (cancha_tipo, fecha)
    )
    filas = cur.fetchall()
    conn.close()

    horarios = [fila[0] for fila in filas]
    propios = [fila[0] for fila in filas if fila[1] == usuario_id]
    return jsonify({"cancha_tipo": cancha_tipo, "ocupados": horarios, "mios": propios})

# Endpoint DELETE para cancelar turno
@app.route("/turnos/<int:turno_id>", methods=["DELETE"])
def cancelar_turno(turno_id):
    usuario_id = session.get("user_id")
    if not usuario_id:
        return jsonify({"estado": "error", "mensaje": "Debés iniciar sesión"}), 401

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM turnos WHERE id = ? AND usuario_id = ?",
        (turno_id, usuario_id)
    )
    if not cur.fetchone():
        conn.close()
        return jsonify({"estado": "error", "mensaje": "Turno no encontrado"}), 404

    cur.execute("DELETE FROM turnos WHERE id = ?", (turno_id,))
    conn.commit()
    conn.close()

    return jsonify({"estado": "ok", "mensaje": "Turno cancelado"})

# Endpoint POST para recuperar contraseña (sin token)
@app.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"estado": "error", "mensaje": "Faltan datos"}), 400

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id FROM usuarios WHERE email = ?", (email,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"estado": "error", "mensaje": "Email no registrado"}), 404

    password_hash = generate_password_hash(password)
    cur.execute("UPDATE usuarios SET password_hash = ? WHERE email = ?", (password_hash, email))
    conn.commit()
    conn.close()

    return jsonify({"estado": "ok", "mensaje": "Contraseña actualizada"})

# Endpoint GET para listar turnos por usuario
@app.route("/turnos/<int:usuario_id>", methods=["GET"])
def listar_turnos(usuario_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, usuario_id, nombre_reserva, horario, cancha_tipo FROM turnos WHERE usuario_id = ? ORDER BY horario",
        (usuario_id,)
    )
    filas = cur.fetchall()
    conn.close()

    turnos = []
    for fila in filas:
        turnos.append({
            "id": fila[0],
            "usuario_id": fila[1],
            "nombre_reserva": fila[2],
            "horario": fila[3],
            "cancha_tipo": fila[4]
        })

    return jsonify(turnos)

# Servir archivos estáticos desde /static
@app.route("/script.js")
def script_js():
    return send_from_directory("../static", "script.js")

# Punto de entrada de la aplicación
if __name__ == "__main__":
    inicializar_base()
    app.run(debug=True)
