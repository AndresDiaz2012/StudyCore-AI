from flask import Blueprint, request, jsonify, g
from backend.models.database import get_connection, rows_to_list, row_to_dict

evaluations_bp = Blueprint("evaluations", __name__, url_prefix="/api/evaluations")


def compute_averages(subject_id: int, conn) -> dict:
    """Compute weighted average for a subject."""
    rows = conn.execute(
        "SELECT percentage, grade, max_grade FROM evaluations WHERE subject_id = ? AND grade IS NOT NULL",
        (subject_id,),
    ).fetchall()
    if not rows:
        return {"weighted_avg": None, "total_percentage": 0}
    total_weight = sum(r["percentage"] for r in rows)
    weighted_sum = sum((r["grade"] / r["max_grade"]) * r["percentage"] for r in rows)
    weighted_avg = (weighted_sum / total_weight) * 20 if total_weight > 0 else None
    return {"weighted_avg": round(weighted_avg, 2) if weighted_avg else None,
            "total_percentage": round(total_weight, 2)}


@evaluations_bp.route("/", methods=["GET"])
def list_evaluations():
    subject_id = request.args.get("subject_id")
    period = request.args.get("period")
    conn = get_connection()
    query = """SELECT ev.*, s.name as subject_name, s.color as subject_color
               FROM evaluations ev LEFT JOIN subjects s ON ev.subject_id = s.id
               WHERE ev.user_id = ?"""
    params = [g.user_id]
    if subject_id:
        query += " AND ev.subject_id = ?"
        params.append(subject_id)
    if period:
        query += " AND ev.period = ?"
        params.append(period)
    query += " ORDER BY ev.date DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@evaluations_bp.route("/summary", methods=["GET"])
def summary():
    """Return per-subject weighted averages."""
    conn = get_connection()
    subjects = conn.execute("SELECT id, name, color FROM subjects WHERE user_id = ?", (g.user_id,)).fetchall()
    result = []
    for s in subjects:
        avg_data = compute_averages(s["id"], conn)
        result.append({
            "subject_id": s["id"],
            "subject_name": s["name"],
            "subject_color": s["color"],
            **avg_data,
        })
    conn.close()
    return jsonify(result)


@evaluations_bp.route("/", methods=["POST"])
def create_evaluation():
    data = request.get_json()
    required = ("subject_id", "title", "percentage")
    for field in required:
        if field not in data:
            return jsonify({"error": f"{field} is required"}), 400
    conn = get_connection()
    cur = conn.execute(
        """INSERT INTO evaluations (user_id, subject_id, title, percentage, grade, max_grade, date, period)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (g.user_id, data["subject_id"], data["title"], data["percentage"],
         data.get("grade"), data.get("max_grade", 20),
         data.get("date"), data.get("period")),
    )
    conn.commit()
    row = conn.execute(
        "SELECT ev.*, s.name as subject_name FROM evaluations ev LEFT JOIN subjects s ON ev.subject_id = s.id WHERE ev.id = ?",
        (cur.lastrowid,),
    ).fetchone()
    conn.close()
    return jsonify(row_to_dict(row)), 201


@evaluations_bp.route("/<int:eval_id>", methods=["PUT"])
def update_evaluation(eval_id):
    data = request.get_json()
    allowed = ("title", "percentage", "grade", "max_grade", "date", "period")
    fields, values = [], []
    for field in allowed:
        if field in data:
            fields.append(f"{field} = ?")
            values.append(data[field])
    if not fields:
        return jsonify({"error": "nothing to update"}), 400
    values.append(eval_id)
    conn = get_connection()
    conn.execute(f"UPDATE evaluations SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    row = conn.execute(
        "SELECT ev.*, s.name as subject_name FROM evaluations ev LEFT JOIN subjects s ON ev.subject_id = s.id WHERE ev.id = ?",
        (eval_id,),
    ).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify(row_to_dict(row))


@evaluations_bp.route("/<int:eval_id>", methods=["DELETE"])
def delete_evaluation(eval_id):
    conn = get_connection()
    conn.execute("DELETE FROM evaluations WHERE id = ?", (eval_id,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": eval_id})


@evaluations_bp.route("/subject/<int:subject_id>/average", methods=["GET"])
def subject_average(subject_id):
    conn = get_connection()
    avg_data = compute_averages(subject_id, conn)
    conn.close()
    return jsonify(avg_data)
