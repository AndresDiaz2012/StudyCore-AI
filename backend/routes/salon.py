"""
Salon routes — delegado pushes class notes to all classmates
"""
from flask import Blueprint, request, jsonify, g
from backend.models.database import get_connection, rows_to_list, row_to_dict

salon_bp = Blueprint("salon", __name__, url_prefix="/api/salon")


def _require_delegado():
    role = getattr(g, "user_role", "student")
    if role not in ("delegado", "admin", "developer"):
        return jsonify({"error": "Solo los delegados pueden usar esta función"}), 403
    return None


@salon_bp.route("/", methods=["GET"])
def get_salon_info():
    """Return the delegado's salon info: assigned subjects and salon members."""
    err = _require_delegado()
    if err: return err

    conn = get_connection()
    institute_id = getattr(g, "user_institute_id", None)

    # Get assigned subjects
    subjects = rows_to_list(conn.execute(
        "SELECT * FROM delegado_subjects WHERE user_id = ? AND institute_id = ?",
        (g.user_id, institute_id),
    ).fetchall())

    # Get the salon this delegado belongs to (or manages)
    salon_row = conn.execute(
        "SELECT s.* FROM salons s "
        "JOIN salon_members sm ON sm.salon_id = s.id "
        "WHERE sm.user_id = ? AND s.institute_id = ?",
        (g.user_id, institute_id),
    ).fetchone()

    members = []
    salon = None
    if salon_row:
        salon = row_to_dict(salon_row)
        members = rows_to_list(conn.execute(
            "SELECT u.id, u.name, u.email, u.role FROM salon_members sm "
            "JOIN users u ON u.id = sm.user_id WHERE sm.salon_id = ? ORDER BY u.name",
            (salon_row["id"],),
        ).fetchall())

    conn.close()
    return jsonify({"subjects": subjects, "salon": salon, "members": members})


@salon_bp.route("/push", methods=["POST"])
def push_notes():
    """Push class notes to all salon members' notebooks."""
    err = _require_delegado()
    if err: return err

    data         = request.get_json() or {}
    subject_name = data.get("subject_name", "").strip()
    period_name  = data.get("period_name", "Lapso 1").strip()
    topic_name   = data.get("topic_name", "").strip()
    title        = data.get("title", "").strip()
    content      = data.get("content", "").strip()
    entry_date   = data.get("entry_date") or __import__("datetime").date.today().isoformat()

    if not subject_name or not topic_name or not content:
        return jsonify({"error": "subject_name, topic_name y content son requeridos"}), 400

    institute_id = getattr(g, "user_institute_id", None)
    if not institute_id:
        return jsonify({"error": "Sin instituto asignado"}), 400

    conn = get_connection()

    # Get the salon this delegado is in
    salon_row = conn.execute(
        "SELECT s.id FROM salons s "
        "JOIN salon_members sm ON sm.salon_id = s.id "
        "WHERE sm.user_id = ? AND s.institute_id = ?",
        (g.user_id, institute_id),
    ).fetchone()

    if not salon_row:
        conn.close()
        return jsonify({"error": "No estás asignado a ningún salón"}), 400

    # Get all salon members (excluding the delegado themselves)
    members = conn.execute(
        "SELECT u.id FROM salon_members sm JOIN users u ON u.id = sm.user_id "
        "WHERE sm.salon_id = ?",
        (salon_row["id"],),
    ).fetchall()

    pushed_count = 0
    for member in members:
        uid = member["id"]
        _ensure_notebook_entry(conn, uid, subject_name, period_name, topic_name,
                               title or f"Clase de {subject_name}", content, entry_date)
        pushed_count += 1

    conn.commit()
    conn.close()
    return jsonify({"ok": True, "pushed_to": pushed_count})


def _ensure_notebook_entry(conn, user_id, subject_name, period_name, topic_name,
                            title, content, entry_date):
    """Find or create the subject→period→topic hierarchy, then insert the entry."""
    # Subject
    subj = conn.execute(
        "SELECT id FROM subjects WHERE user_id = ? AND name = ?", (user_id, subject_name)
    ).fetchone()
    if subj:
        subject_id = subj["id"]
    else:
        cur = conn.execute(
            "INSERT INTO subjects (user_id, name, color, icon) VALUES (?, ?, '#6366f1', '📚')",
            (user_id, subject_name),
        )
        subject_id = cur.lastrowid

    # Period
    period = conn.execute(
        "SELECT id FROM periods WHERE subject_id = ? AND name = ?", (subject_id, period_name)
    ).fetchone()
    if period:
        period_id = period["id"]
    else:
        cur = conn.execute(
            "INSERT INTO periods (subject_id, name, order_num) VALUES (?, ?, 0)",
            (subject_id, period_name),
        )
        period_id = cur.lastrowid

    # Topic
    topic = conn.execute(
        "SELECT id FROM topics WHERE period_id = ? AND name = ?", (period_id, topic_name)
    ).fetchone()
    if topic:
        topic_id = topic["id"]
    else:
        cur = conn.execute(
            "INSERT INTO topics (period_id, name, order_num) VALUES (?, ?, 0)",
            (period_id, topic_name),
        )
        topic_id = cur.lastrowid

    # Entry
    conn.execute(
        "INSERT INTO entries (topic_id, title, content, entry_date, source) VALUES (?, ?, ?, ?, 'delegado')",
        (topic_id, title, content, entry_date),
    )
