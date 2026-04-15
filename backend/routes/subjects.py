from flask import Blueprint, request, jsonify, g
from backend.models.database import get_connection, rows_to_list, row_to_dict

subjects_bp = Blueprint("subjects", __name__, url_prefix="/api/subjects")


@subjects_bp.route("/", methods=["GET"])
def list_subjects():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM subjects WHERE user_id = ? ORDER BY name", (g.user_id,)).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@subjects_bp.route("/", methods=["POST"])
def create_subject():
    if getattr(g, "user_role", "student") not in ("admin", "developer"):
        return jsonify({"error": "Solo los admins pueden crear materias"}), 403
    data = request.get_json()
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO subjects (user_id, name, color, icon) VALUES (?, ?, ?, ?)",
        (g.user_id, name, data.get("color", "#6366f1"), data.get("icon", "📚")),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM subjects WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(row)), 201


@subjects_bp.route("/<int:subject_id>", methods=["PUT"])
def update_subject(subject_id):
    data = request.get_json()
    fields, values = [], []
    for field in ("name", "color", "icon"):
        if field in data:
            fields.append(f"{field} = ?")
            values.append(data[field])
    if not fields:
        return jsonify({"error": "nothing to update"}), 400
    values.append(subject_id)
    conn = get_connection()
    conn.execute(f"UPDATE subjects SET {", ".join(fields)} WHERE id = ?", values)
    conn.commit()
    row = conn.execute("SELECT * FROM subjects WHERE id = ?", (subject_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify(row_to_dict(row))


@subjects_bp.route("/<int:subject_id>", methods=["DELETE"])
def delete_subject(subject_id):
    if getattr(g, "user_role", "student") not in ("admin", "developer"):
        return jsonify({"error": "Solo los admins pueden eliminar materias"}), 403
    conn = get_connection()
    conn.execute("DELETE FROM subjects WHERE id = ? AND user_id = ?", (subject_id, g.user_id))
    conn.commit()
    conn.close()
    return jsonify({"deleted": subject_id})
