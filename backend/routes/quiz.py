"""
Quiz routes — generación con IA, intentos individuales y sesiones grupales
"""
import json
from flask import Blueprint, request, jsonify, g
from backend.models.database import get_connection, rows_to_list, row_to_dict

quiz_bp = Blueprint("quiz", __name__, url_prefix="/api/quiz")


# ── AI question generator ─────────────────────────────────────────────────────

def _generate_questions(content: str, num_questions: int, question_types: list, subject_name: str) -> list:
    from backend.services.ai_service import _get_client, GEMINI_MODEL
    from google.genai import types as gtypes

    types_desc = {
        "multiple_choice": "opción múltiple con 4 opciones (A, B, C, D)",
        "true_false":       "verdadero o falso",
        "fill_blank":       "completación (una palabra o frase corta)",
    }
    types_list = [types_desc.get(t, t) for t in question_types]

    prompt = f"""Genera exactamente {num_questions} preguntas de evaluación sobre el siguiente contenido de la materia: {subject_name}.

Tipos de preguntas a incluir: {', '.join(types_list)}.
Distribuye las preguntas equitativamente entre los tipos disponibles.

CONTENIDO:
{content[:5000]}

IMPORTANTE: Responde ÚNICAMENTE con un array JSON válido. Sin texto adicional, sin markdown, sin ```json.
Usa exactamente este formato:
[
  {{
    "type": "multiple_choice",
    "question": "¿Pregunta aquí?",
    "options": ["A) texto opción 1", "B) texto opción 2", "C) texto opción 3", "D) texto opción 4"],
    "correct_answer": "A",
    "explanation": "Breve explicación de por qué es correcta"
  }},
  {{
    "type": "true_false",
    "question": "Afirmación que puede ser verdadera o falsa",
    "correct_answer": "Verdadero",
    "explanation": "Explicación"
  }},
  {{
    "type": "fill_blank",
    "question": "La ___ es el proceso mediante el cual...",
    "correct_answer": "fotosíntesis",
    "explanation": "Explicación"
  }}
]"""

    client = _get_client()
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=gtypes.GenerateContentConfig(
            max_output_tokens=4096,
            temperature=0.4,
        ),
    )
    text = response.text.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
    if text.endswith("```"):
        text = text[: text.rfind("```")]
    text = text.strip()

    questions = json.loads(text)
    return questions[:num_questions]


def _score_attempt(questions: list, answers: dict) -> tuple[float, list]:
    """Score answers. Returns (score_out_of_20, results_list)."""
    correct_count = 0
    results = []
    for i, q in enumerate(questions):
        user_ans = str(answers.get(str(i), answers.get(i, ""))).strip()
        correct  = str(q.get("correct_answer", "")).strip()

        is_correct = False
        if q["type"] == "multiple_choice":
            is_correct = user_ans[:1].upper() == correct[:1].upper() if user_ans else False
        elif q["type"] == "true_false":
            is_correct = user_ans.lower() in (correct.lower(), correct[:1].lower())
        elif q["type"] == "fill_blank":
            is_correct = user_ans.lower() == correct.lower()

        if is_correct:
            correct_count += 1
        results.append({
            "question_index": i,
            "question":       q["question"],
            "type":           q["type"],
            "options":        q.get("options"),
            "user_answer":    user_ans,
            "correct_answer": correct,
            "is_correct":     is_correct,
            "explanation":    q.get("explanation", ""),
        })

    score = round((correct_count / len(questions)) * 20, 2) if questions else 0
    return score, results


# ── CRUD ──────────────────────────────────────────────────────────────────────

@quiz_bp.route("/", methods=["GET"])
def list_quizzes():
    conn = get_connection()
    rows = conn.execute(
        """SELECT q.id, q.title, q.subject_id, q.num_questions, q.duration_minutes,
                  q.question_types, q.created_at, s.name as subject_name
           FROM quizzes q
           LEFT JOIN subjects s ON s.id = q.subject_id
           WHERE q.user_id = ?
           ORDER BY q.created_at DESC""",
        (g.user_id,),
    ).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@quiz_bp.route("/generate", methods=["POST"])
def generate_quiz():
    data          = request.get_json() or {}
    content       = data.get("content", "").strip()
    if not content:
        return jsonify({"error": "Se requiere contenido para generar el quiz"}), 400

    num_questions  = min(20, max(5, int(data.get("num_questions", 10))))
    question_types = data.get("question_types", ["multiple_choice", "true_false"])
    subject_name   = data.get("subject_name", "General")
    title          = data.get("title", f"Quiz — {subject_name}").strip()
    duration_min   = data.get("duration_minutes")  # None = sin límite
    subject_id     = data.get("subject_id")
    topic_id       = data.get("topic_id")

    try:
        questions = _generate_questions(content, num_questions, question_types, subject_name)
    except Exception as e:
        return jsonify({"error": f"Error al generar preguntas: {e}"}), 500

    conn = get_connection()
    cur = conn.execute(
        """INSERT INTO quizzes
               (user_id, title, subject_id, topic_id, source_content,
                num_questions, duration_minutes, question_types, questions)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            g.user_id, title, subject_id, topic_id,
            content[:2000],
            len(questions),
            duration_min,
            json.dumps(question_types),
            json.dumps(questions, ensure_ascii=False),
        ),
    )
    quiz_id = cur.lastrowid
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,)).fetchone())
    conn.close()
    return jsonify(row), 201


@quiz_bp.route("/<int:quiz_id>", methods=["GET"])
def get_quiz(quiz_id):
    conn = get_connection()
    # Allow access to quiz creator OR any group member who has a session with this quiz
    row = conn.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Quiz no encontrado"}), 404
    return jsonify(row_to_dict(row))


@quiz_bp.route("/<int:quiz_id>", methods=["DELETE"])
def delete_quiz(quiz_id):
    conn = get_connection()
    conn.execute("DELETE FROM quizzes WHERE id = ? AND user_id = ?", (quiz_id, g.user_id))
    conn.commit()
    conn.close()
    return jsonify({"deleted": quiz_id})


# ── Individual attempt ────────────────────────────────────────────────────────

@quiz_bp.route("/<int:quiz_id>/attempt", methods=["POST"])
def submit_attempt(quiz_id):
    data       = request.get_json() or {}
    answers    = data.get("answers", {})
    session_id = data.get("session_id")

    conn = get_connection()
    quiz_row = conn.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
    if not quiz_row:
        conn.close()
        return jsonify({"error": "Quiz no encontrado"}), 404

    quiz      = row_to_dict(quiz_row)
    questions = quiz.get("questions", [])
    score, results = _score_attempt(questions, answers)

    cur = conn.execute(
        """INSERT INTO quiz_attempts
               (quiz_id, user_id, session_id, answers, score, completed, finished_at)
           VALUES (?, ?, ?, ?, ?, 1, datetime('now'))""",
        (quiz_id, g.user_id, session_id, json.dumps(answers), score),
    )
    attempt_id = cur.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        "attempt_id":     attempt_id,
        "score":          score,
        "correct_count":  sum(1 for r in results if r["is_correct"]),
        "total_questions": len(questions),
        "results":        results,
    })


# ── Group quiz sessions ───────────────────────────────────────────────────────

@quiz_bp.route("/sessions", methods=["POST"])
def create_session():
    data     = request.get_json() or {}
    group_id = data.get("group_id")
    quiz_id  = data.get("quiz_id")
    if not group_id or not quiz_id:
        return jsonify({"error": "group_id y quiz_id son requeridos"}), 400

    conn = get_connection()
    me = conn.execute(
        "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?", (group_id, g.user_id)
    ).fetchone()
    if not me:
        conn.close()
        return jsonify({"error": "No eres miembro del grupo"}), 403

    quiz = conn.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
    if not quiz:
        conn.close()
        return jsonify({"error": "Quiz no encontrado"}), 404

    cur = conn.execute(
        "INSERT INTO group_quiz_sessions (group_id, quiz_id, created_by, status) VALUES (?, ?, ?, 'waiting')",
        (group_id, quiz_id, g.user_id),
    )
    session_id = cur.lastrowid
    conn.commit()

    # Post a card in the group feed
    payload = json.dumps({
        "session_id": session_id,
        "quiz_id":    quiz_id,
        "quiz_title": quiz["title"],
        "status":     "waiting",
    }, ensure_ascii=False)
    conn.execute(
        "INSERT INTO group_messages (group_id, user_id, type, content, ref_id) VALUES (?, ?, 'quiz_session', ?, ?)",
        (group_id, g.user_id, payload, session_id),
    )
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM group_quiz_sessions WHERE id = ?", (session_id,)).fetchone())
    conn.close()
    return jsonify(row), 201


@quiz_bp.route("/sessions/<int:session_id>", methods=["GET"])
def get_session(session_id):
    conn = get_connection()
    row = conn.execute("SELECT * FROM group_quiz_sessions WHERE id = ?", (session_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Sesión no encontrada"}), 404
    return jsonify(row_to_dict(row))


@quiz_bp.route("/sessions/<int:session_id>/start", methods=["POST"])
def start_session(session_id):
    conn = get_connection()
    session = conn.execute("SELECT * FROM group_quiz_sessions WHERE id = ?", (session_id,)).fetchone()
    if not session:
        conn.close()
        return jsonify({"error": "Sesión no encontrada"}), 404
    me = conn.execute(
        "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?",
        (session["group_id"], g.user_id),
    ).fetchone()
    if not me or me["role"] != "admin":
        conn.close()
        return jsonify({"error": "Solo los admins pueden iniciar la sesión"}), 403
    conn.execute(
        "UPDATE group_quiz_sessions SET status = 'active', started_at = datetime('now') WHERE id = ?",
        (session_id,),
    )
    # Update the feed card
    conn.execute(
        """UPDATE group_messages
           SET content = json_set(content, '$.status', 'active')
           WHERE ref_id = ? AND type = 'quiz_session'""",
        (session_id,),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "status": "active"})


@quiz_bp.route("/sessions/<int:session_id>/finish", methods=["POST"])
def finish_session(session_id):
    conn = get_connection()
    session = conn.execute("SELECT * FROM group_quiz_sessions WHERE id = ?", (session_id,)).fetchone()
    if not session:
        conn.close()
        return jsonify({"error": "Sesión no encontrada"}), 404
    me = conn.execute(
        "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?",
        (session["group_id"], g.user_id),
    ).fetchone()
    if not me or me["role"] != "admin":
        conn.close()
        return jsonify({"error": "Solo los admins pueden finalizar la sesión"}), 403
    conn.execute(
        "UPDATE group_quiz_sessions SET status = 'finished', finished_at = datetime('now') WHERE id = ?",
        (session_id,),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "status": "finished"})


@quiz_bp.route("/sessions/<int:session_id>/leaderboard", methods=["GET"])
def leaderboard(session_id):
    conn = get_connection()
    session = conn.execute("SELECT * FROM group_quiz_sessions WHERE id = ?", (session_id,)).fetchone()
    if not session:
        conn.close()
        return jsonify({"error": "Sesión no encontrada"}), 404

    rows = conn.execute(
        """SELECT qa.id as attempt_id, qa.user_id, qa.score, qa.completed,
                  qa.answers, qa.finished_at, u.name as user_name
           FROM quiz_attempts qa
           JOIN users u ON u.id = qa.user_id
           WHERE qa.session_id = ?
           ORDER BY qa.score DESC, qa.finished_at ASC""",
        (session_id,),
    ).fetchall()

    quiz = conn.execute(
        "SELECT num_questions FROM quizzes WHERE id = ?", (session["quiz_id"],)
    ).fetchone()
    total = quiz["num_questions"] if quiz else 0

    member_count = conn.execute(
        "SELECT COUNT(*) FROM group_members WHERE group_id = ?", (session["group_id"],)
    ).fetchone()[0]
    conn.close()

    entries = []
    for r in rows:
        d        = row_to_dict(r)
        answers  = d.get("answers", {})
        answered = len(answers) if isinstance(answers, dict) else 0
        entries.append({
            "attempt_id":  d["attempt_id"],
            "user_id":     d["user_id"],
            "user_name":   d["user_name"],
            "score":       d["score"],
            "completed":   bool(d["completed"]),
            "answered":    answered,
            "total":       total,
            "finished_at": d["finished_at"],
        })

    return jsonify({
        "session_id":     session_id,
        "quiz_id":        session["quiz_id"],
        "status":         session["status"],
        "total_questions": total,
        "member_count":   member_count,
        "entries":        entries,
    })


@quiz_bp.route("/sessions/<int:session_id>/attempt", methods=["POST"])
def session_submit(session_id):
    """Submit answers for a group quiz session."""
    conn = get_connection()
    session = conn.execute("SELECT * FROM group_quiz_sessions WHERE id = ?", (session_id,)).fetchone()
    if not session or session["status"] not in ("active", "waiting"):
        conn.close()
        return jsonify({"error": "La sesión no está disponible"}), 400

    # Check membership
    if not conn.execute(
        "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
        (session["group_id"], g.user_id),
    ).fetchone():
        conn.close()
        return jsonify({"error": "No eres miembro del grupo"}), 403
    conn.close()

    # Delegate to submit_attempt with session_id injected
    data = request.get_json() or {}
    data["session_id"] = session_id

    # Manually call the scoring logic
    answers    = data.get("answers", {})
    quiz_id    = session["quiz_id"]

    conn = get_connection()
    quiz_row = conn.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
    if not quiz_row:
        conn.close()
        return jsonify({"error": "Quiz no encontrado"}), 404
    quiz      = row_to_dict(quiz_row)
    questions = quiz.get("questions", [])
    score, results = _score_attempt(questions, answers)

    cur = conn.execute(
        """INSERT INTO quiz_attempts
               (quiz_id, user_id, session_id, answers, score, completed, finished_at)
           VALUES (?, ?, ?, ?, ?, 1, datetime('now'))""",
        (quiz_id, g.user_id, session_id, json.dumps(answers), score),
    )
    attempt_id = cur.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        "attempt_id":      attempt_id,
        "score":           score,
        "correct_count":   sum(1 for r in results if r["is_correct"]),
        "total_questions": len(questions),
        "results":         results,
    })


@quiz_bp.route("/attempts/<int:attempt_id>", methods=["GET"])
def get_attempt(attempt_id):
    conn = get_connection()
    attempt = conn.execute(
        "SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ?", (attempt_id, g.user_id)
    ).fetchone()
    if not attempt:
        conn.close()
        return jsonify({"error": "Intento no encontrado"}), 404
    d = row_to_dict(attempt)
    quiz = row_to_dict(conn.execute("SELECT * FROM quizzes WHERE id = ?", (d["quiz_id"],)).fetchone())
    conn.close()

    questions = quiz.get("questions", [])
    answers   = d.get("answers", {})
    _, results = _score_attempt(questions, answers)
    d["results"] = results
    return jsonify(d)
