"""
Admin management routes — codes, students, salons, delegados
"""
import uuid
import string
import random
from flask import Blueprint, request, jsonify, g
from backend.models.database import get_connection, rows_to_list, row_to_dict

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def _require_role(*roles):
    role = getattr(g, "user_role", "student")
    if role not in roles:
        return jsonify({"error": "Sin permisos"}), 403
    return None


def _gen_code():
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=8))


# ── Admin codes (developer only) ──────────────────────────────────────────────

@admin_bp.route("/codes", methods=["GET"])
def list_codes():
    err = _require_role("developer")
    if err: return err
    conn = get_connection()
    rows = conn.execute(
        """SELECT c.*, u.name as used_by_name FROM admin_codes c
           LEFT JOIN users u ON u.id = c.used_by
           ORDER BY c.created_at DESC"""
    ).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@admin_bp.route("/codes", methods=["POST"])
def generate_code():
    err = _require_role("developer")
    if err: return err
    conn = get_connection()
    code = _gen_code()
    while conn.execute("SELECT id FROM admin_codes WHERE code = ?", (code,)).fetchone():
        code = _gen_code()
    cur = conn.execute("INSERT INTO admin_codes (code) VALUES (?)", (code,))
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM admin_codes WHERE id = ?", (cur.lastrowid,)).fetchone())
    conn.close()
    return jsonify(row), 201


# ── Students in my institute (admin only) ─────────────────────────────────────

@admin_bp.route("/students", methods=["GET"])
def list_students():
    err = _require_role("admin", "developer")
    if err: return err
    institute_id = getattr(g, "user_institute_id", None)
    if not institute_id and g.user_role != "developer":
        return jsonify({"error": "No tienes instituto asignado"}), 400

    conn = get_connection()
    if g.user_role == "developer":
        rows = conn.execute(
            "SELECT u.id, u.name, u.email, u.role, u.institute_id, i.name as institute_name "
            "FROM users u LEFT JOIN institutes i ON i.id = u.institute_id "
            "WHERE u.role NOT IN ('developer') ORDER BY u.name"
        ).fetchall()
    else:
        rows = conn.execute(
            """SELECT u.id, u.name, u.email, u.role, u.institute_id,
                      sm.salon_id,
                      (SELECT s.name FROM salons s WHERE s.id = sm.salon_id) as salon_name
               FROM users u
               LEFT JOIN salon_members sm ON sm.user_id = u.id
               WHERE u.institute_id = ? AND u.role NOT IN ('developer', 'admin')
               ORDER BY u.name""",
            (institute_id,),
        ).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@admin_bp.route("/students/<int:uid>/role", methods=["PUT"])
def change_student_role(uid):
    err = _require_role("admin")
    if err: return err
    data    = request.get_json() or {}
    new_role = data.get("role", "student")
    if new_role not in ("student", "delegado", "admin"):
        return jsonify({"error": "Rol inválido"}), 400

    conn = get_connection()
    student = conn.execute(
        "SELECT id, institute_id FROM users WHERE id = ? AND role NOT IN ('developer')", (uid,)
    ).fetchone()
    if not student or student["institute_id"] != getattr(g, "user_institute_id", None):
        conn.close()
        return jsonify({"error": "Estudiante no encontrado en tu instituto"}), 404

    conn.execute("UPDATE users SET role = ? WHERE id = ?", (new_role, uid))
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "role": new_role})


@admin_bp.route("/students/<int:uid>", methods=["DELETE"])
def expel_student(uid):
    err = _require_role("admin")
    if err: return err
    conn = get_connection()
    student = conn.execute(
        "SELECT id, institute_id FROM users WHERE id = ? AND role NOT IN ('developer', 'admin')", (uid,)
    ).fetchone()
    if not student or student["institute_id"] != getattr(g, "user_institute_id", None):
        conn.close()
        return jsonify({"error": "Estudiante no encontrado en tu instituto"}), 404

    # Remove from salon, reset institute, reset role
    conn.execute("DELETE FROM salon_members WHERE user_id = ?", (uid,))
    conn.execute("UPDATE users SET institute_id = NULL, role = 'student' WHERE id = ?", (uid,))
    conn.commit()
    conn.close()
    return jsonify({"expelled": uid})


# ── Salons ────────────────────────────────────────────────────────────────────

@admin_bp.route("/salons", methods=["GET"])
def list_salons():
    err = _require_role("admin")
    if err: return err
    institute_id = getattr(g, "user_institute_id", None)
    if not institute_id:
        return jsonify([])
    conn = get_connection()
    rows = conn.execute(
        "SELECT s.*, COUNT(sm.user_id) as member_count FROM salons s "
        "LEFT JOIN salon_members sm ON sm.salon_id = s.id "
        "WHERE s.institute_id = ? GROUP BY s.id ORDER BY s.order_num, s.name",
        (institute_id,),
    ).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@admin_bp.route("/salons", methods=["POST"])
def create_salon():
    err = _require_role("admin")
    if err: return err
    institute_id = getattr(g, "user_institute_id", None)
    if not institute_id:
        return jsonify({"error": "Sin instituto"}), 400
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "name es requerido"}), 400
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO salons (institute_id, name, order_num) VALUES (?, ?, ?)",
        (institute_id, name, data.get("order_num", 0)),
    )
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM salons WHERE id = ?", (cur.lastrowid,)).fetchone())
    conn.close()
    return jsonify(row), 201


@admin_bp.route("/salons/<int:salon_id>", methods=["PUT"])
def update_salon(salon_id):
    err = _require_role("admin")
    if err: return err
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "name es requerido"}), 400
    conn = get_connection()
    conn.execute(
        "UPDATE salons SET name = ? WHERE id = ? AND institute_id = ?",
        (name, salon_id, getattr(g, "user_institute_id", None)),
    )
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM salons WHERE id = ?", (salon_id,)).fetchone())
    conn.close()
    return jsonify(row)


@admin_bp.route("/salons/<int:salon_id>", methods=["DELETE"])
def delete_salon(salon_id):
    err = _require_role("admin")
    if err: return err
    conn = get_connection()
    conn.execute(
        "DELETE FROM salons WHERE id = ? AND institute_id = ?",
        (salon_id, getattr(g, "user_institute_id", None)),
    )
    conn.commit()
    conn.close()
    return jsonify({"deleted": salon_id})


@admin_bp.route("/salons/<int:salon_id>/members", methods=["GET"])
def salon_members(salon_id):
    err = _require_role("admin")
    if err: return err
    conn = get_connection()
    rows = conn.execute(
        "SELECT u.id, u.name, u.email, u.role FROM salon_members sm "
        "JOIN users u ON u.id = sm.user_id WHERE sm.salon_id = ? ORDER BY u.name",
        (salon_id,),
    ).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@admin_bp.route("/salons/<int:salon_id>/members", methods=["POST"])
def add_to_salon(salon_id):
    err = _require_role("admin")
    if err: return err
    data   = request.get_json() or {}
    uid    = data.get("user_id")
    if not uid:
        return jsonify({"error": "user_id requerido"}), 400
    conn = get_connection()
    # Remove from any other salon in this institute first
    conn.execute(
        "DELETE FROM salon_members WHERE user_id = ? AND salon_id IN "
        "(SELECT id FROM salons WHERE institute_id = ?)",
        (uid, getattr(g, "user_institute_id", None)),
    )
    conn.execute("INSERT OR IGNORE INTO salon_members (salon_id, user_id) VALUES (?, ?)", (salon_id, uid))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@admin_bp.route("/salons/<int:salon_id>/members/<int:uid>", methods=["DELETE"])
def remove_from_salon(salon_id, uid):
    err = _require_role("admin")
    if err: return err
    conn = get_connection()
    conn.execute("DELETE FROM salon_members WHERE salon_id = ? AND user_id = ?", (salon_id, uid))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ── Delegado subject assignments ──────────────────────────────────────────────

@admin_bp.route("/delegados", methods=["GET"])
def list_delegados():
    err = _require_role("admin")
    if err: return err
    institute_id = getattr(g, "user_institute_id", None)
    conn = get_connection()
    rows = conn.execute(
        """SELECT ds.id, ds.user_id, ds.subject_name, u.name as user_name
           FROM delegado_subjects ds
           JOIN users u ON u.id = ds.user_id
           WHERE ds.institute_id = ? ORDER BY u.name""",
        (institute_id,),
    ).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@admin_bp.route("/delegados", methods=["POST"])
def assign_delegado():
    err = _require_role("admin")
    if err: return err
    data         = request.get_json() or {}
    uid          = data.get("user_id")
    subject_name = data.get("subject_name", "").strip()
    institute_id = getattr(g, "user_institute_id", None)
    if not uid or not subject_name:
        return jsonify({"error": "user_id y subject_name requeridos"}), 400
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO delegado_subjects (user_id, subject_name, institute_id) VALUES (?, ?, ?)",
        (uid, subject_name, institute_id),
    )
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM delegado_subjects WHERE id = ?", (cur.lastrowid,)).fetchone())
    conn.close()
    return jsonify(row), 201


@admin_bp.route("/delegados/<int:did>", methods=["DELETE"])
def remove_delegado(did):
    err = _require_role("admin")
    if err: return err
    conn = get_connection()
    conn.execute(
        "DELETE FROM delegado_subjects WHERE id = ? AND institute_id = ?",
        (did, getattr(g, "user_institute_id", None)),
    )
    conn.commit()
    conn.close()
    return jsonify({"deleted": did})
