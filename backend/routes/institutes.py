"""
Institutes routes — list and create institutes (colleges/schools)
"""
from flask import Blueprint, request, jsonify, g
from backend.models.database import get_connection, rows_to_list, row_to_dict

institutes_bp = Blueprint("institutes", __name__, url_prefix="/api/institutes")


@institutes_bp.route("/", methods=["GET"])
def list_institutes():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM institutes ORDER BY name").fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@institutes_bp.route("/", methods=["POST"])
def create_institute():
    if getattr(g, "user_role", "student") not in ("admin", "developer"):
        return jsonify({"error": "Sin permisos"}), 403
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "name es requerido"}), 400
    conn = get_connection()
    if conn.execute("SELECT id FROM institutes WHERE name = ?", (name,)).fetchone():
        conn.close()
        return jsonify({"error": "Ya existe un instituto con ese nombre"}), 409
    cur = conn.execute("INSERT INTO institutes (name) VALUES (?)", (name,))
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM institutes WHERE id = ?", (cur.lastrowid,)).fetchone())
    conn.close()
    return jsonify(row), 201
