"""
Groups routes — grupos de estudio con feed, miembros, admin y quizzes grupales
"""
import json
import random
import string
from flask import Blueprint, request, jsonify, g
from backend.models.database import get_connection, rows_to_list, row_to_dict

groups_bp = Blueprint("groups", __name__, url_prefix="/api/groups")


# ── Helpers ───────────────────────────────────────────────────────────────────

def gen_invite_code(length=8) -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


def _member_row(conn, group_id, user_id):
    return conn.execute(
        "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?",
        (group_id, user_id),
    ).fetchone()


def _require_member(conn, group_id, user_id):
    row = _member_row(conn, group_id, user_id)
    if not row:
        conn.close()
        return None, jsonify({"error": "No eres miembro de este grupo"}), 403
    return row, None, None


def _require_admin(conn, group_id, user_id):
    row = _member_row(conn, group_id, user_id)
    if not row or row["role"] != "admin":
        conn.close()
        return False, jsonify({"error": "Solo los admins pueden hacer esto"}), 403
    return True, None, None


# ── List & create ─────────────────────────────────────────────────────────────

@groups_bp.route("/", methods=["GET"])
def list_groups():
    conn = get_connection()
    rows = conn.execute(
        """SELECT g.*, COUNT(DISTINCT gm2.id) as member_count, me.role as my_role
           FROM groups g
           JOIN group_members me ON g.id = me.group_id AND me.user_id = ?
           LEFT JOIN group_members gm2 ON g.id = gm2.group_id
           GROUP BY g.id ORDER BY g.created_at DESC""",
        (g.user_id,),
    ).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@groups_bp.route("/", methods=["POST"])
def create_group():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "El nombre es requerido"}), 400

    conn = get_connection()
    invite_code = gen_invite_code()
    while conn.execute("SELECT id FROM groups WHERE invite_code = ?", (invite_code,)).fetchone():
        invite_code = gen_invite_code()

    cur = conn.execute(
        """INSERT INTO groups (name, description, type, invite_code, created_by, image, max_members, only_admin_speaks)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)""",
        (
            name,
            data.get("description", ""),
            data.get("type", "private"),
            invite_code,
            g.user_id,
            data.get("image", "👥"),
            int(data.get("max_members", 50)),
        ),
    )
    group_id = cur.lastrowid
    conn.execute(
        "INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'admin')",
        (group_id, g.user_id),
    )
    conn.commit()
    row = row_to_dict(conn.execute(
        "SELECT g.*, 1 as member_count, 'admin' as my_role FROM groups g WHERE g.id = ?",
        (group_id,),
    ).fetchone())
    conn.close()
    return jsonify(row), 201


@groups_bp.route("/join", methods=["POST"])
def join_group():
    code = (request.get_json() or {}).get("invite_code", "").strip().upper()
    conn = get_connection()
    group = conn.execute("SELECT * FROM groups WHERE invite_code = ?", (code,)).fetchone()
    if not group:
        conn.close()
        return jsonify({"error": "Código de invitación inválido"}), 404

    # Max members check
    count = conn.execute(
        "SELECT COUNT(*) FROM group_members WHERE group_id = ?", (group["id"],)
    ).fetchone()[0]
    if group["max_members"] and count >= group["max_members"]:
        conn.close()
        return jsonify({"error": "El grupo está lleno"}), 409

    # Already member?
    if conn.execute(
        "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?", (group["id"], g.user_id)
    ).fetchone():
        conn.close()
        return jsonify({"error": "Ya eres miembro de este grupo"}), 409

    conn.execute(
        "INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')",
        (group["id"], g.user_id),
    )
    conn.commit()
    result = row_to_dict(group)
    result["my_role"] = "member"
    member_count = conn.execute(
        "SELECT COUNT(*) FROM group_members WHERE group_id = ?", (group["id"],)
    ).fetchone()[0]
    result["member_count"] = member_count
    conn.close()
    return jsonify(result)


# ── Group detail / update / delete ────────────────────────────────────────────

@groups_bp.route("/<int:group_id>", methods=["GET"])
def get_group(group_id):
    conn = get_connection()
    me = _member_row(conn, group_id, g.user_id)
    if not me:
        conn.close()
        return jsonify({"error": "No eres miembro"}), 403
    row = conn.execute(
        """SELECT g.*, COUNT(gm.id) as member_count, ? as my_role
           FROM groups g
           LEFT JOIN group_members gm ON g.id = gm.group_id
           WHERE g.id = ?""",
        (me["role"], group_id),
    ).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Grupo no encontrado"}), 404
    return jsonify(row_to_dict(row))


@groups_bp.route("/<int:group_id>", methods=["PUT"])
def update_group(group_id):
    conn = get_connection()
    ok, err, code = _require_admin(conn, group_id, g.user_id)
    if not ok:
        return err, code
    data = request.get_json() or {}
    fields, values = [], []
    for f in ("name", "description", "image", "type"):
        if f in data:
            fields.append(f"{f} = ?")
            values.append(data[f])
    if "max_members" in data:
        fields.append("max_members = ?")
        values.append(int(data["max_members"]))
    # only_admin_speaks is always 1 — not configurable
    if not fields:
        conn.close()
        return jsonify({"error": "Nada que actualizar"}), 400
    values.append(group_id)
    conn.execute(f"UPDATE groups SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone())
    conn.close()
    return jsonify(row)


@groups_bp.route("/<int:group_id>", methods=["DELETE"])
def delete_group(group_id):
    conn = get_connection()
    ok, err, code = _require_admin(conn, group_id, g.user_id)
    if not ok:
        return err, code
    conn.execute("DELETE FROM groups WHERE id = ?", (group_id,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": group_id})


@groups_bp.route("/<int:group_id>/leave", methods=["POST"])
def leave_group(group_id):
    conn = get_connection()
    conn.execute(
        "DELETE FROM group_members WHERE group_id = ? AND user_id = ?", (group_id, g.user_id)
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ── Members ───────────────────────────────────────────────────────────────────

@groups_bp.route("/<int:group_id>/members", methods=["GET"])
def list_members(group_id):
    conn = get_connection()
    if not _member_row(conn, group_id, g.user_id):
        conn.close()
        return jsonify({"error": "No eres miembro"}), 403
    rows = conn.execute(
        """SELECT u.id, u.name, u.email, gm.role, gm.joined_at
           FROM group_members gm
           JOIN users u ON u.id = gm.user_id
           WHERE gm.group_id = ?
           ORDER BY CASE gm.role WHEN 'admin' THEN 0 ELSE 1 END, gm.joined_at""",
        (group_id,),
    ).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@groups_bp.route("/<int:group_id>/members/<int:target_id>", methods=["DELETE"])
def kick_member(group_id, target_id):
    conn = get_connection()
    ok, err, code = _require_admin(conn, group_id, g.user_id)
    if not ok:
        return err, code
    if target_id == g.user_id:
        conn.close()
        return jsonify({"error": "No puedes expulsarte a ti mismo. Usa 'Salir del grupo'."}), 400
    conn.execute(
        "DELETE FROM group_members WHERE group_id = ? AND user_id = ?", (group_id, target_id)
    )
    conn.commit()
    conn.close()
    return jsonify({"kicked": target_id})


@groups_bp.route("/<int:group_id>/members/<int:target_id>/role", methods=["PUT"])
def change_role(group_id, target_id):
    conn = get_connection()
    ok, err, code = _require_admin(conn, group_id, g.user_id)
    if not ok:
        return err, code
    new_role = (request.get_json() or {}).get("role", "")
    if new_role not in ("admin", "member"):
        conn.close()
        return jsonify({"error": "Rol inválido. Usa 'admin' o 'member'"}), 400
    conn.execute(
        "UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?",
        (new_role, group_id, target_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"user_id": target_id, "role": new_role})


# ── Feed ──────────────────────────────────────────────────────────────────────

@groups_bp.route("/<int:group_id>/feed", methods=["GET"])
def get_feed(group_id):
    conn = get_connection()
    if not _member_row(conn, group_id, g.user_id):
        conn.close()
        return jsonify({"error": "No eres miembro"}), 403
    rows = conn.execute(
        """SELECT gm.*, u.name as author_name
           FROM group_messages gm
           JOIN users u ON u.id = gm.user_id
           WHERE gm.group_id = ?
           ORDER BY gm.created_at ASC""",
        (group_id,),
    ).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@groups_bp.route("/<int:group_id>/feed", methods=["POST"])
def post_feed(group_id):
    conn = get_connection()
    me = _member_row(conn, group_id, g.user_id)
    if not me:
        conn.close()
        return jsonify({"error": "No eres miembro"}), 403

    if me["role"] != "admin":
        conn.close()
        return jsonify({"error": "Solo los admins pueden publicar en este grupo"}), 403

    data = request.get_json() or {}
    msg_type = data.get("type", "text")
    content  = data.get("content", "")
    ref_id   = data.get("ref_id")

    if isinstance(content, (dict, list)):
        content = json.dumps(content, ensure_ascii=False)

    cur = conn.execute(
        "INSERT INTO group_messages (group_id, user_id, type, content, ref_id) VALUES (?, ?, ?, ?, ?)",
        (group_id, g.user_id, msg_type, content, ref_id),
    )
    msg_id = cur.lastrowid
    conn.commit()
    row = conn.execute(
        """SELECT gm.*, u.name as author_name
           FROM group_messages gm JOIN users u ON u.id = gm.user_id
           WHERE gm.id = ?""",
        (msg_id,),
    ).fetchone()
    conn.close()
    return jsonify(row_to_dict(row)), 201


@groups_bp.route("/<int:group_id>/feed/<int:msg_id>", methods=["DELETE"])
def delete_message(group_id, msg_id):
    conn = get_connection()
    me = _member_row(conn, group_id, g.user_id)
    if not me:
        conn.close()
        return jsonify({"error": "No eres miembro"}), 403
    msg = conn.execute(
        "SELECT * FROM group_messages WHERE id = ? AND group_id = ?", (msg_id, group_id)
    ).fetchone()
    if not msg:
        conn.close()
        return jsonify({"error": "Mensaje no encontrado"}), 404
    if msg["user_id"] != g.user_id and me["role"] != "admin":
        conn.close()
        return jsonify({"error": "Sin permiso para eliminar este mensaje"}), 403
    conn.execute("DELETE FROM group_messages WHERE id = ?", (msg_id,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": msg_id})


# ── AI Professor in group ─────────────────────────────────────────────────────

@groups_bp.route("/<int:group_id>/ai", methods=["POST"])
def group_ai(group_id):
    from backend.services.ai_service import get_ai_response

    conn = get_connection()
    me = _member_row(conn, group_id, g.user_id)
    if not me:
        conn.close()
        return jsonify({"error": "No eres miembro"}), 403

    data         = request.get_json() or {}
    question     = data.get("question", "").strip()
    subject_name = data.get("subject_name", "General")
    context      = data.get("context", "")

    if not question:
        conn.close()
        return jsonify({"error": "La pregunta no puede estar vacía"}), 400

    profile_row = conn.execute(
        "SELECT profile FROM users WHERE id = ?", (g.user_id,)
    ).fetchone()
    profile_str = (profile_row["profile"] if profile_row else None) or "{}"
    conn.close()

    try:
        answer = get_ai_response(
            question=question,
            subject_name=subject_name,
            context=context,
            user_profile=profile_str,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    # Save as AI message in feed
    conn = get_connection()
    payload = json.dumps({
        "question": question,
        "answer": answer,
        "subject_name": subject_name,
    }, ensure_ascii=False)

    cur = conn.execute(
        "INSERT INTO group_messages (group_id, user_id, type, content) VALUES (?, ?, 'ai', ?)",
        (group_id, g.user_id, payload),
    )
    msg_id = cur.lastrowid
    conn.commit()
    row = conn.execute(
        "SELECT gm.*, u.name as author_name FROM group_messages gm JOIN users u ON u.id = gm.user_id WHERE gm.id = ?",
        (msg_id,),
    ).fetchone()
    conn.close()
    return jsonify(row_to_dict(row)), 201
