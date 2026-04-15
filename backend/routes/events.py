from flask import Blueprint, request, jsonify, g
from backend.models.database import get_connection, rows_to_list, row_to_dict

events_bp = Blueprint("events", __name__, url_prefix="/api/events")

VALID_TYPES  = {"task", "exam", "reminder", "class"}
VALID_STATUS = {"pending", "done", "missed"}

JOIN_S = "SELECT e.*, s.name as subject_name, s.color as subject_color FROM events e LEFT JOIN subjects s ON e.subject_id = s.id"


@events_bp.route("/", methods=["GET"])
def list_events():
    month = request.args.get("month")
    subject_id = request.args.get("subject_id")
    conn = get_connection()
    query = JOIN_S + " WHERE e.user_id = ?"
    params = [g.user_id]
    if month:
        query += " AND e.date LIKE ?"
        params.append(f"{month}%")
    if subject_id:
        query += " AND e.subject_id = ?"
        params.append(subject_id)
    query += " ORDER BY e.date, e.time"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@events_bp.route("/", methods=["POST"])
def create_event():
    data = request.get_json()
    title = data.get("title", "").strip()
    date  = data.get("date", "").strip()
    if not title or not date:
        return jsonify({"error": "title and date are required"}), 400
    event_type = data.get("type", "task")
    if event_type not in VALID_TYPES:
        event_type = "task"
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO events (user_id, subject_id, title, description, date, time, type) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (g.user_id, data.get("subject_id"), title, data.get("description"), date, data.get("time"), event_type),
    )
    conn.commit()
    row = conn.execute(JOIN_S + " WHERE e.id = ?", (cur.lastrowid,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(row)), 201


@events_bp.route("/<int:event_id>", methods=["PUT"])
def update_event(event_id):
    data = request.get_json()
    allowed = ("title", "description", "date", "time", "type", "status", "subject_id")
    fields, values = [], []
    for field in allowed:
        if field in data:
            fields.append(f"{field} = ?")
            values.append(data[field])
    if not fields:
        return jsonify({"error": "nothing to update"}), 400
    values.append(event_id)
    conn = get_connection()
    conn.execute(f"UPDATE events SET {", ".join(fields)} WHERE id = ?", values)
    conn.commit()
    row = conn.execute(JOIN_S + " WHERE e.id = ?", (event_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify(row_to_dict(row))


@events_bp.route("/<int:event_id>", methods=["DELETE"])
def delete_event(event_id):
    conn = get_connection()
    conn.execute("DELETE FROM events WHERE id = ? AND user_id = ?", (event_id, g.user_id))
    conn.commit()
    conn.close()
    return jsonify({"deleted": event_id})


@events_bp.route("/<int:event_id>/toggle", methods=["POST"])
def toggle_event(event_id):
    conn = get_connection()
    row = conn.execute("SELECT status FROM events WHERE id = ?", (event_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "not found"}), 404
    new_status = "done" if row["status"] != "done" else "pending"
    conn.execute("UPDATE events SET status = ? WHERE id = ?", (new_status, event_id))
    conn.commit()
    conn.close()
    return jsonify({"id": event_id, "status": new_status})
