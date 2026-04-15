"""
Auth routes — registro, login, logout, perfil y configuración visual
"""
import json
import uuid
from flask import Blueprint, request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash
from backend.models.database import get_connection, row_to_dict

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _safe_user(row: dict) -> dict:
    """Devuelve el dict del usuario sin el hash de contraseña."""
    row.pop("password_hash", None)
    return row


# ── Registro ──────────────────────────────────────────────────────────────────

@auth_bp.route("/register", methods=["POST"])
def register():
    data           = request.get_json() or {}
    name           = data.get("name", "").strip()
    email          = data.get("email", "").strip().lower()
    password       = data.get("password", "")
    institute_name = data.get("institute_name", "").strip()
    admin_code     = data.get("admin_code", "").strip()

    if not name or not email or not password:
        return jsonify({"error": "Nombre, email y contraseña son requeridos"}), 400
    if not institute_name:
        return jsonify({"error": "Debes seleccionar tu instituto"}), 400
    if len(password) < 6:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400
    if "@" not in email:
        return jsonify({"error": "El email no es válido"}), 400
    if email == "developer@gmail.com":
        return jsonify({"error": "Este email está reservado"}), 400

    conn = get_connection()
    if conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone():
        conn.close()
        return jsonify({"error": "Este email ya está registrado. Intenta iniciar sesión."}), 409

    # Resolve or create institute
    inst = conn.execute("SELECT id FROM institutes WHERE name = ?", (institute_name,)).fetchone()
    if inst:
        institute_id = inst["id"]
    else:
        cur_inst = conn.execute("INSERT INTO institutes (name) VALUES (?)", (institute_name,))
        institute_id = cur_inst.lastrowid

    # Validate admin code
    role = "student"
    code_row_id = None
    if admin_code:
        code_row = conn.execute(
            "SELECT id FROM admin_codes WHERE code = ? AND used = 0", (admin_code,)
        ).fetchone()
        if not code_row:
            conn.close()
            return jsonify({"error": "Código de admin inválido o ya utilizado"}), 400
        role = "admin"
        code_row_id = code_row["id"]

    token    = str(uuid.uuid4())
    pwd_hash = generate_password_hash(password)

    cur = conn.execute(
        "INSERT INTO users (name, email, password_hash, session_token, onboarding_done, "
        "profile, settings, role, institute_id) VALUES (?, ?, ?, ?, 0, '{}', '{}', ?, ?)",
        (name, email, pwd_hash, token, role, institute_id),
    )
    user_id = cur.lastrowid

    # Mark code as used
    if code_row_id:
        conn.execute("UPDATE admin_codes SET used = 1, used_by = ? WHERE id = ?", (user_id, code_row_id))

    # ── Seed default subjects + notebook content ──────────────────────────────
    DEFAULTS = [
        ('Matemáticas', '#ef4444', '🔢', 'Números y Operaciones',
         'Números naturales: 1, 2, 3, 4...\nNúmeros enteros: ...-2, -1, 0, 1, 2...\n'
         'Operaciones básicas: suma (+), resta (-), multiplicación (×), división (÷)\n'
         'Propiedades: conmutativa (a+b=b+a), asociativa, distributiva a(b+c)=ab+ac\n'
         'Potencias: a^n = a multiplicado n veces. Ejemplo: 2^3 = 8\n'
         'Fracciones: numerador/denominador. Para sumar fracciones se igualan los denominadores.'),
        ('Física',      '#f97316', '⚡', 'Magnitudes y Leyes',
         'Magnitudes fundamentales del SI: masa (kg), longitud (m), tiempo (s), temperatura (K)\n'
         'Velocidad = distancia / tiempo (m/s)\n'
         'Leyes de Newton:\n1. Inercia: un cuerpo en reposo permanece en reposo sin fuerza neta.\n'
         '2. F = m × a (Fuerza = masa × aceleración)\n3. Acción y reacción son iguales y opuestas.\n'
         'Energía cinética: Ec = ½mv²  |  Energía potencial: Ep = mgh'),
        ('Química',     '#eab308', '🧪', 'Materia y Elementos',
         'Estados de la materia: sólido, líquido, gaseoso, plasma.\n'
         'Cambios de estado: fusión (sólido→líquido), ebullición (líquido→gas), sublimación (sólido→gas)\n'
         'Mezcla homogénea (solución): sal + agua. Mezcla heterogénea: arena + agua.\n'
         'Tabla periódica: elementos ordenados por número atómico (protones).\n'
         'Grupos importantes: metales alcalinos (col.1), halógenos (col.17), gases nobles (col.18)\n'
         'Enlace iónico: transferencia de electrones. Enlace covalente: compartir electrones.'),
        ('Biología',    '#22c55e', '🧬', 'Célula y Vida',
         'La célula es la unidad básica de la vida.\n'
         'Célula procariota: sin núcleo definido (bacterias).\n'
         'Célula eucariota: con núcleo definido (plantas, animales, hongos).\n'
         'Organelos: núcleo (ADN), mitocondria (energía), ribosomas (proteínas), vacuola (almacenamiento)\n'
         'Fotosíntesis: 6CO₂ + 6H₂O + luz → C₆H₁₂O₆ + 6O₂ (solo plantas con clorofila)\n'
         'Respiración celular: glucosa + O₂ → CO₂ + H₂O + ATP (energía)'),
        ('Historia',    '#3b82f6', '🏛️', 'Línea del Tiempo',
         'Edades históricas:\n'
         '• Prehistoria: antes de la escritura (~3500 a.C.)\n'
         '• Edad Antigua: 3500 a.C. – 476 d.C. (caída Roma Occidental)\n'
         '• Edad Media: 476 – 1492 (descubrimiento de América)\n'
         '• Edad Moderna: 1492 – 1789 (Revolución Francesa)\n'
         '• Edad Contemporánea: 1789 – presente\n'
         'Civilizaciones clave: Mesopotamia, Egipto, Grecia, Roma, China, Maya, Inca.'),
        ('Literatura',  '#8b5cf6', '📖', 'Géneros y Recursos',
         'Géneros literarios:\n'
         '• Narrativo: novela, cuento, crónica (narrador cuenta una historia)\n'
         '• Lírico: poesía (expresa sentimientos, usa verso y rima)\n'
         '• Dramático: teatro, obras de comedia/tragedia\n'
         'Figuras retóricas:\n'
         '• Metáfora: comparación sin "como" ("sus ojos son estrellas")\n'
         '• Símil: comparación con "como" ("rápido como el viento")\n'
         '• Hipérbole: exageración extrema ("te lo he dicho mil veces")'),
        ('Inglés',      '#ec4899', '🌍', 'Gramática Básica',
         'Verb tenses:\n'
         '• Present simple: I study / She studies (hábitos, hechos)\n'
         '• Past simple: I studied / She studied (acción terminada)\n'
         '• Future: I will study / I am going to study\n'
         'Modal verbs: can (poder), must (deber), should (debería), would (condicional)\n'
         'Articles: a/an (indefinite), the (definite)\n'
         'Question words: What, Where, When, Who, Why, How'),
    ]

    today = __import__('datetime').date.today().isoformat()
    for subj_name, color, icon, topic_name, content in DEFAULTS:
        s_cur = conn.execute(
            "INSERT INTO subjects (user_id, name, color, icon) VALUES (?, ?, ?, ?)",
            (user_id, subj_name, color, icon),
        )
        subj_id = s_cur.lastrowid
        p_cur = conn.execute(
            "INSERT INTO periods (subject_id, name, order_num) VALUES (?, 'Lapso 1', 0)",
            (subj_id,),
        )
        period_id = p_cur.lastrowid
        t_cur = conn.execute(
            "INSERT INTO topics (period_id, name, order_num) VALUES (?, ?, 0)",
            (period_id, topic_name),
        )
        topic_id = t_cur.lastrowid
        conn.execute(
            "INSERT INTO entries (topic_id, title, content, entry_date, source) VALUES (?, ?, ?, ?, 'manual')",
            (topic_id, f'Introducción a {subj_name}', content, today),
        )

    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone())
    conn.close()

    return jsonify({**_safe_user(row), "token": token}), 201


# ── Login ─────────────────────────────────────────────────────────────────────

@auth_bp.route("/login", methods=["POST"])
def login():
    data     = request.get_json() or {}
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    conn = get_connection()
    user_row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    if not user_row or not check_password_hash(user_row["password_hash"] or "", password):
        conn.close()
        return jsonify({"error": "Email o contraseña incorrectos"}), 401

    token = str(uuid.uuid4())
    conn.execute("UPDATE users SET session_token = ? WHERE id = ?", (token, user_row["id"]))
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM users WHERE id = ?", (user_row["id"],)).fetchone())
    conn.close()

    return jsonify({**_safe_user(row), "token": token})


# ── Logout ────────────────────────────────────────────────────────────────────

@auth_bp.route("/logout", methods=["POST"])
def logout():
    token = request.headers.get("X-Auth-Token", "")
    if token:
        conn = get_connection()
        conn.execute("UPDATE users SET session_token = NULL WHERE session_token = ?", (token,))
        conn.commit()
        conn.close()
    return jsonify({"ok": True})


# ── Sesión activa ─────────────────────────────────────────────────────────────

@auth_bp.route("/me", methods=["GET"])
def me():
    token = request.headers.get("X-Auth-Token", "")
    if not token:
        return jsonify({"error": "No autenticado"}), 401
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE session_token = ?", (token,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Sesión inválida"}), 401
    return jsonify(_safe_user(row_to_dict(row)))


# ── Perfil (intereses, promedio, etc.) ────────────────────────────────────────

@auth_bp.route("/profile", methods=["PUT"])
def update_profile():
    token = request.headers.get("X-Auth-Token", "")
    conn  = get_connection()
    user  = conn.execute("SELECT * FROM users WHERE session_token = ?", (token,)).fetchone()
    if not user:
        conn.close()
        return jsonify({"error": "No autenticado"}), 401

    data = request.get_json() or {}
    profile         = json.dumps(data.get("profile", {}))
    onboarding_done = int(data.get("onboarding_done", user["onboarding_done"]))
    name            = data.get("name", user["name"])

    conn.execute(
        "UPDATE users SET profile = ?, onboarding_done = ?, name = ? WHERE id = ?",
        (profile, onboarding_done, name, user["id"]),
    )
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone())
    conn.close()
    return jsonify(_safe_user(row))


# ── Configuración visual ──────────────────────────────────────────────────────

@auth_bp.route("/settings", methods=["PUT"])
def update_settings():
    token = request.headers.get("X-Auth-Token", "")
    conn  = get_connection()
    user  = conn.execute("SELECT * FROM users WHERE session_token = ?", (token,)).fetchone()
    if not user:
        conn.close()
        return jsonify({"error": "No autenticado"}), 401

    data     = request.get_json() or {}
    settings = json.dumps(data.get("settings", {}))

    conn.execute("UPDATE users SET settings = ? WHERE id = ?", (settings, user["id"]))
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone())
    conn.close()
    return jsonify(_safe_user(row))


# ── Cambiar contraseña ────────────────────────────────────────────────────────

@auth_bp.route("/change-password", methods=["PUT"])
def change_password():
    token = request.headers.get("X-Auth-Token", "")
    conn  = get_connection()
    user  = conn.execute("SELECT * FROM users WHERE session_token = ?", (token,)).fetchone()
    if not user:
        conn.close()
        return jsonify({"error": "No autenticado"}), 401

    data         = request.get_json() or {}
    current_pwd  = data.get("current_password", "")
    new_pwd      = data.get("new_password", "")

    if not check_password_hash(user["password_hash"] or "", current_pwd):
        conn.close()
        return jsonify({"error": "La contraseña actual es incorrecta"}), 400
    if len(new_pwd) < 6:
        conn.close()
        return jsonify({"error": "La nueva contraseña debe tener al menos 6 caracteres"}), 400

    conn.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (generate_password_hash(new_pwd), user["id"]),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})
