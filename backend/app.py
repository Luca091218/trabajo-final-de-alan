from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import os

# Inicialización de la aplicación Flask
app = Flask(__name__)

# Ruta absoluta del directorio actual
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Ruta a la base de datos SQLite
DB_PATH = os.path.join(BASE_DIR, "..", "database", "registros.db")

# Función que crea la base y la tabla si no existen
def inicializar_base():
    db_folder = os.path.join(BASE_DIR, "..", "database")
    if not os.path.exists(db_folder):
        os.makedirs(db_folder)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS tabla_registros (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            valor INTEGER NOT NULL
        );
    """)
    conn.commit()
    conn.close()

# Ruta principal para verificar que el servidor funciona
@app.route("/")
def inicio():
    return "Servidor Flask funcionando correctamente."

# Endpoint POST para insertar datos en la base
@app.route("/insertar", methods=["POST"])
def insertar():
    data = request.get_json()

    nombre = data.get("nombre")
    valor = data.get("valor")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO tabla_registros (nombre, valor) VALUES (?, ?)",
        (nombre, valor)
    )
    conn.commit()
    conn.close()

    return jsonify({"estado": "ok", "mensaje": "Registro insertado"})

# Endpoint GET para listar todos los registros
@app.route("/listar", methods=["GET"])
def listar():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, nombre, valor FROM tabla_registros")
    filas = cur.fetchall()
    conn.close()

    registros = []
    for fila in filas:
        registros.append({
            "id": fila[0],
            "nombre": fila[1],
            "valor": fila[2]
        })

    return jsonify(registros)

# Servir el frontend desde Flask
@app.route("/frontend")
def frontend():
    return send_from_directory("../frontend", "index.html")

@app.route("/script.js")
def script_js():
    return send_from_directory("../frontend", "script.js")

# Punto de entrada de la aplicación
if __name__ == "__main__":
    inicializar_base()
    app.run(debug=True)
