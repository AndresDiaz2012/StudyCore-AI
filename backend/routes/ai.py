import json
from flask import Blueprint, request, jsonify, g, Response, stream_with_context
from backend.services.ai_service import get_ai_response, stream_ai_response
from backend.models.database import get_connection, rows_to_list, row_to_dict

ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")


def _build_sources_text(sources: list) -> str:
    """Construye el contexto del profesor a partir de fuentes seleccionadas."""
    if not sources:
        return ""
    conn = get_connection()
    parts = []
    for src in sources:
        src_type = src.get("type")
        if src_type == "topic":
            topic_id = src.get("topic_id")
            if not topic_id:
                continue
            # Obtener info del tema y sus entradas
            topic = conn.execute("SELECT * FROM topics WHERE id = ?", (topic_id,)).fetchone()
            if not topic:
                continue
            period = conn.execute("SELECT * FROM periods WHERE id = ?", (topic["period_id"],)).fetchone()
            subject = conn.execute("SELECT * FROM subjects WHERE id = ?", (period["subject_id"],)).fetchone() if period else None

            breadcrumb = " > ".join(filter(None, [
                subject["name"] if subject else None,
                period["name"] if period else None,
                topic["name"],
            ]))
            entries = conn.execute(
                "SELECT * FROM entries WHERE topic_id = ? ORDER BY entry_date ASC",
                (topic_id,),
            ).fetchall()
            entries_text = ""
            for e in entries:
                title = e["title"] or f"Clase del {e['entry_date']}"
                entries_text += f"\n  [{e['entry_date']}] {title}\n  {(e['content'] or '')[:600]}\n"

            parts.append(
                f"### Tema: {breadcrumb}\n"
                f"DescripciÃ³n: {topic['description'] or 'Sin descripciÃ³n'}\n"
                f"Apuntes de clase:{entries_text or ' (sin apuntes aÃºn)'}"
            )
        elif src_type in ("url", "video"):
            label = src.get("label") or src.get("url", "")
            url   = src.get("url", "")
            kind  = "Video" if src_type == "video" else "PÃ¡gina web"
            parts.append(f"### {kind}: {label}\nURL: {url}\n(El estudiante quiere que uses este recurso como referencia)")

    conn.close()
    return "\n\n".join(parts)


def _get_subject_context(subject_id: int) -> str:
    """Fallback: Ãºltimas notas de la materia si no hay fuentes seleccionadas."""
    if not subject_id:
        return ""
    conn = get_connection()
    rows = conn.execute(
        "SELECT title, content FROM notes WHERE subject_id = ? AND user_id = ? ORDER BY updated_at DESC LIMIT 5",
        (subject_id,),
    ).fetchall()
    conn.close()
    if not rows:
        return ""
    parts = []
    for r in rows:
        title   = r["title"] or "Apunte"
        content = (r["content"] or "")[:800]
        parts.append(f"### {title}\n{content}")
    return "\n\n".join(parts)


@ai_bp.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    question = data.get("question", "").strip()
    if not question:
        return jsonify({"error": "question is required"}), 400

    subject_id   = data.get("subject_id")
    subject_name = data.get("subject_name", "General")
    sources      = data.get("sources", [])          # [{type, topic_id?, url?, label?}]
    messages_history = data.get("messages", [])

    sources_text = _build_sources_text(sources) if sources else _get_subject_context(subject_id)

    try:
        answer = get_ai_response(
            question=question,
            subject_name=subject_name,
            sources_text=sources_text,
            messages_history=messages_history,
            user_profile=g.user_profile,
        )
        return jsonify({"answer": answer})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@ai_bp.route("/chat/stream", methods=["POST"])
def chat_stream():
    data = request.get_json()
    question = data.get("question", "").strip()
    if not question:
        return jsonify({"error": "question is required"}), 400

    subject_id   = data.get("subject_id")
    subject_name = data.get("subject_name", "General")
    sources      = data.get("sources", [])
    messages_history = data.get("messages", [])

    sources_text = _build_sources_text(sources) if sources else _get_subject_context(subject_id)

    def generate():
        for chunk in stream_ai_response(
            question=question,
            subject_name=subject_name,
            sources_text=sources_text,
            messages_history=messages_history,
        ):
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# â”€â”€ Conversations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@ai_bp.route("/conversations", methods=["GET"])
def list_conversations():
    conn = get_connection()
    rows = conn.execute(
        """SELECT ac.*, s.name as subject_name, s.color as subject_color
           FROM ai_conversations ac LEFT JOIN subjects s ON ac.subject_id = s.id
           WHERE ac.user_id = ? ORDER BY ac.updated_at DESC""",
        (g.user_id,),
    ).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@ai_bp.route("/conversations", methods=["POST"])
def create_conversation():
    data = request.get_json()
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO ai_conversations (user_id, subject_id, title, messages) VALUES (?, ?, ?, ?)",
        (g.user_id, data.get("subject_id"), data.get("title", "Nueva conversación"),
         json.dumps(data.get("messages", []))),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM ai_conversations WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(row)), 201


@ai_bp.route("/conversations/<int:conv_id>", methods=["PUT"])
def update_conversation(conv_id):
    data = request.get_json()
    conn = get_connection()
    conn.execute(
        "UPDATE ai_conversations SET messages = ?, updated_at = datetime('now'), "
        "title = COALESCE(?, title) WHERE id = ?",
        (json.dumps(data.get("messages", [])), data.get("title"), conv_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM ai_conversations WHERE id = ?", (conv_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify(row_to_dict(row))


@ai_bp.route("/conversations/<int:conv_id>", methods=["DELETE"])
def delete_conversation(conv_id):
    conn = get_connection()
    conn.execute("DELETE FROM ai_conversations WHERE id = ?", (conv_id,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": conv_id})


# â”€â”€ Sources para una conversaciÃ³n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@ai_bp.route("/conversations/<int:conv_id>/sources", methods=["GET"])
def get_sources(conv_id):
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM ai_sources WHERE conv_id = ? ORDER BY created_at",
        (conv_id,),
    ).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@ai_bp.route("/conversations/<int:conv_id>/sources", methods=["POST"])
def add_source(conv_id):
    data = request.get_json()
    src_type = data.get("type")
    if src_type not in ("topic", "url", "video"):
        return jsonify({"error": "type debe ser topic, url o video"}), 400
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO ai_sources (conv_id, type, topic_id, url, label) VALUES (?, ?, ?, ?, ?)",
        (conv_id, src_type, data.get("topic_id"), data.get("url"), data.get("label")),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM ai_sources WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(row)), 201


@ai_bp.route("/sources/<int:src_id>", methods=["DELETE"])
def delete_source(src_id):
    conn = get_connection()
    conn.execute("DELETE FROM ai_sources WHERE id = ?", (src_id,))
    conn.commit()
    conn.close()
    return jsonify({"deleted": src_id})
