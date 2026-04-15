import json
from flask import Blueprint, request, jsonify, g
from backend.models.database import get_connection, rows_to_list, row_to_dict

notes_bp = Blueprint("notes", __name__, url_prefix="/api/notes")


@notes_bp.route("/", methods=["GET"])
def list_notes():
    subject_id = request.args.get("subject_id")
    period = request.args.get("period")
    search = request.args.get("q")
    conn = get_connection()
    query = """SELECT n.*, s.name as subject_name, s.color as subject_color
               FROM notes n LEFT JOIN subjects s ON n.subject_id = s.id
               WHERE n.user_id = ?"""
    params = [g.user_id]
    if subject_id:
        query += " AND n.subject_id = ?"
        params.append(subject_id)
    if period:
        query += " AND n.period = ?"
        params.append(period)
    if search:
        query += " AND (n.title LIKE ? OR n.content LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])
    query += " ORDER BY n.updated_at DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@notes_bp.route("/<int:note_id>", methods=["GET"])
def get_note(note_id):
    conn = get_connection()
    row = conn.execute(
        "SELECT n.*, s.name as subject_name, s.color as subject_color FROM notes n LEFT JOIN subjects s ON n.subject_id = s.id WHERE n.id = ?",
        (note_id,),
    ).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify(row_to_dict(row))


@notes_bp.route("/", methods=["POST"])
def create_note():
    data = request.get_json()
    tags = json.dumps(data.get("tags", []))
    conn = get_connection()
    cur = conn.execute(
        """INSERT INTO notes (user_id, subject_id, title, content, source, period, tags)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (data.get("subject_id"), data.get("title", "Sin tÃƒÂ­tulo"),
         data.get("content", ""), data.get("source", "manual"),
         data.get("period"), tags),
    )
    conn.commit()
    row = conn.execute(
        "SELECT n.*, s.name as subject_name, s.color as subject_color FROM notes n LEFT JOIN subjects s ON n.subject_id = s.id WHERE n.id = ?",
        (cur.lastrowid,),
    ).fetchone()
    conn.close()
    return jsonify(row_to_dict(row)), 201


@notes_bp.route("/<int:note_id>", methods=["PUT"])
def update_note(note_id):
    data = request.get_json()
    allowed = ("title", "content", "subject_id", "period")
    fields, values = [], []
    for field in allowed:
        if field in data:
            fields.append(f"{field} = ?")
            values.append(data[field])
    if "tags" in data:
        fields.append("tags = ?")
        values.append(json.dumps(data["tags"]))
    fields.append("updated_at = datetime('now')")
    if len(fields) == 1:
        return jsonify({"error": "nothing to update"}), 400
    values.append(note_id)
    conn = get_connection()
    conn.execute(f"UPDATE notes SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    row = conn.execute(
        "SELECT n.*, s.name as subject_name, s.color as subject_color FROM notes n LEFT JOIN subjects s ON n.subject_id = s.id WHERE n.id = ?",
        (note_id,),
    ).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify(row_to_dict(row))


@notes_bp.route("/<int:note_id>", methods=["DELETE"])
def delete_note(note_id):
    conn = get_connection()
    conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": note_id})
