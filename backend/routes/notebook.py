"""
Notebook routes — jerarquía: Subject → Period → Topic → Entry
"""
import os
import uuid
from flask import Blueprint, request, jsonify, g
from werkzeug.utils import secure_filename
from backend.models.database import get_connection, rows_to_list, row_to_dict
from backend.services.ocr_service import process_image
from backend.config.settings import UPLOAD_FOLDER


def _can_write():
    """Only delegados, admins, and developers can create new notebook content."""
    return getattr(g, "user_role", "student") in ("delegado", "admin", "developer")

notebook_bp = Blueprint("notebook", __name__, url_prefix="/api/notebook")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# ── Periods ──────────────────────────────────────────────────────────────────

@notebook_bp.route("/periods/", methods=["GET"])
def list_periods():
    subject_id = request.args.get("subject_id")
    conn = get_connection()
    q = "SELECT * FROM periods WHERE 1=1"
    params = []
    if subject_id:
        q += " AND subject_id = ?"
        params.append(subject_id)
    q += " ORDER BY order_num, created_at"
    rows = conn.execute(q, params).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@notebook_bp.route("/periods/", methods=["POST"])
def create_period():
    if not _can_write():
        return jsonify({"error": "Los estudiantes no pueden agregar contenido al cuaderno"}), 403
    data = request.get_json()
    if not data.get("subject_id") or not data.get("name", "").strip():
        return jsonify({"error": "subject_id y name son requeridos"}), 400
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO periods (subject_id, name, order_num) VALUES (?, ?, ?)",
        (data["subject_id"], data["name"].strip(), data.get("order_num", 0)),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM periods WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(row)), 201


@notebook_bp.route("/periods/<int:pid>", methods=["PUT"])
def update_period(pid):
    data = request.get_json()
    conn = get_connection()
    conn.execute(
        "UPDATE periods SET name = COALESCE(?, name), order_num = COALESCE(?, order_num) WHERE id = ?",
        (data.get("name"), data.get("order_num"), pid),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM periods WHERE id = ?", (pid,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify(row_to_dict(row))


@notebook_bp.route("/periods/<int:pid>", methods=["DELETE"])
def delete_period(pid):
    conn = get_connection()
    conn.execute("DELETE FROM periods WHERE id = ?", (pid,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": pid})


# ── Topics ────────────────────────────────────────────────────────────────────

@notebook_bp.route("/topics/", methods=["GET"])
def list_topics():
    period_id = request.args.get("period_id")
    conn = get_connection()
    q = "SELECT * FROM topics WHERE 1=1"
    params = []
    if period_id:
        q += " AND period_id = ?"
        params.append(period_id)
    q += " ORDER BY order_num, created_at"
    rows = conn.execute(q, params).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@notebook_bp.route("/topics/", methods=["POST"])
def create_topic():
    if not _can_write():
        return jsonify({"error": "Los estudiantes no pueden agregar contenido al cuaderno"}), 403
    data = request.get_json()
    if not data.get("period_id") or not data.get("name", "").strip():
        return jsonify({"error": "period_id y name son requeridos"}), 400
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO topics (period_id, name, description, order_num) VALUES (?, ?, ?, ?)",
        (data["period_id"], data["name"].strip(), data.get("description", ""), data.get("order_num", 0)),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM topics WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(row)), 201


@notebook_bp.route("/topics/<int:tid>", methods=["PUT"])
def update_topic(tid):
    data = request.get_json()
    conn = get_connection()
    conn.execute(
        "UPDATE topics SET name = COALESCE(?, name), description = COALESCE(?, description), "
        "order_num = COALESCE(?, order_num) WHERE id = ?",
        (data.get("name"), data.get("description"), data.get("order_num"), tid),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM topics WHERE id = ?", (tid,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify(row_to_dict(row))


@notebook_bp.route("/topics/<int:tid>", methods=["DELETE"])
def delete_topic(tid):
    conn = get_connection()
    conn.execute("DELETE FROM topics WHERE id = ?", (tid,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": tid})


# ── Entries ───────────────────────────────────────────────────────────────────

@notebook_bp.route("/entries/", methods=["GET"])
def list_entries():
    topic_id = request.args.get("topic_id")
    conn = get_connection()
    q = "SELECT * FROM entries WHERE 1=1"
    params = []
    if topic_id:
        q += " AND topic_id = ?"
        params.append(topic_id)
    q += " ORDER BY entry_date DESC, created_at DESC"
    rows = conn.execute(q, params).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@notebook_bp.route("/entries/", methods=["POST"])
def create_entry():
    if not _can_write():
        return jsonify({"error": "Los estudiantes no pueden agregar contenido al cuaderno"}), 403
    data = request.get_json()
    if not data.get("topic_id"):
        return jsonify({"error": "topic_id es requerido"}), 400
    conn = get_connection()
    from datetime import date
    cur = conn.execute(
        "INSERT INTO entries (topic_id, title, content, entry_date, source) VALUES (?, ?, ?, ?, ?)",
        (
            data["topic_id"],
            data.get("title", "").strip() or None,
            data.get("content", ""),
            data.get("entry_date") or str(date.today()),
            data.get("source", "manual"),
        ),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM entries WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(row)), 201


@notebook_bp.route("/entries/<int:eid>", methods=["PUT"])
def update_entry(eid):
    data = request.get_json()
    conn = get_connection()
    conn.execute(
        "UPDATE entries SET title = COALESCE(?, title), content = COALESCE(?, content), "
        "entry_date = COALESCE(?, entry_date), updated_at = datetime('now') WHERE id = ?",
        (data.get("title"), data.get("content"), data.get("entry_date"), eid),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM entries WHERE id = ?", (eid,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify(row_to_dict(row))


@notebook_bp.route("/entries/<int:eid>", methods=["DELETE"])
def delete_entry(eid):
    conn = get_connection()
    conn.execute("DELETE FROM entries WHERE id = ?", (eid,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": eid})


# ── OCR para entradas ─────────────────────────────────────────────────────────

ALLOWED = {"png", "jpg", "jpeg", "bmp", "tiff", "webp"}


@notebook_bp.route("/entries/ocr", methods=["POST"])
def entry_ocr():
    if "image" not in request.files:
        return jsonify({"error": "No se recibió imagen"}), 400
    file = request.files["image"]
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED:
        return jsonify({"error": "Tipo de archivo no válido"}), 400

    safe_name = f"nb_{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_FOLDER, safe_name)
    file.save(filepath)

    try:
        result = process_image(filepath)
        return jsonify({
            "text":       result.get("text", ""),
            "confidence": result.get("confidence"),
            "word_count": result.get("word_count", 0),
            "engine":     result.get("engine", "unknown"),
            "warning":    result.get("warning"),
            "error":      result.get("error"),
        })
    except Exception as e:
        return jsonify({"error": str(e), "text": ""}), 500
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


# ── Tree: toda la jerarquía de una materia (para el profesor IA) ──────────────

@notebook_bp.route("/tree/<int:subject_id>", methods=["GET"])
def subject_tree(subject_id):
    """Devuelve {subject, periods: [{...period, topics: [{...topic}]}]}"""
    conn = get_connection()
    subj = conn.execute("SELECT * FROM subjects WHERE id = ?", (subject_id,)).fetchone()
    if not subj:
        conn.close()
        return jsonify({"error": "not found"}), 404

    periods = conn.execute(
        "SELECT * FROM periods WHERE subject_id = ? ORDER BY order_num, created_at",
        (subject_id,),
    ).fetchall()

    result = []
    for p in periods:
        topics = conn.execute(
            "SELECT * FROM topics WHERE period_id = ? ORDER BY order_num, created_at",
            (p["id"],),
        ).fetchall()
        result.append({**row_to_dict(p), "topics": rows_to_list(topics)})

    conn.close()
    return jsonify({"subject": row_to_dict(subj), "periods": result})
