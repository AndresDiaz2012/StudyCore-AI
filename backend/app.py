"""
StudyCore AI — Flask Backend Entry Point
"""
import os
from flask import Flask, jsonify, g, request
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

from backend.models.database import init_db, get_connection
from backend.config.settings import SECRET_KEY, CORS_ORIGINS, MAX_CONTENT_LENGTH
from backend.routes.auth import auth_bp
from backend.routes.subjects import subjects_bp
from backend.routes.events import events_bp
from backend.routes.evaluations import evaluations_bp
from backend.routes.notes import notes_bp
from backend.routes.groups import groups_bp
from backend.routes.ocr import ocr_bp
from backend.routes.ai import ai_bp
from backend.routes.notebook import notebook_bp
from backend.routes.quiz import quiz_bp
from backend.routes.institutes import institutes_bp
from backend.routes.admin_mgmt import admin_bp
from backend.routes.salon import salon_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.secret_key = SECRET_KEY
    app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

    CORS(app, origins=CORS_ORIGINS, supports_credentials=True)

    # ── Identify the current user from the auth token on every request ─────────
    @app.before_request
    def load_user():
        token = request.headers.get("X-Auth-Token", "")
        if token:
            conn = get_connection()
            row  = conn.execute(
                "SELECT id, profile, settings, role, institute_id FROM users WHERE session_token = ?",
                (token,)
            ).fetchone()
            conn.close()
            if row:
                g.user_id       = row["id"]
                g.user_profile  = row["profile"]  or "{}"
                g.user_settings = row["settings"] or "{}"
                g.user_role     = row["role"]     or "student"
                g.user_institute_id = row["institute_id"]
                return
        # Default — single-user desktop mode (no token)
        g.user_id           = 1
        g.user_profile      = "{}"
        g.user_settings     = "{}"
        g.user_role         = "admin"   # desktop mode = full access
        g.user_institute_id = None

    # ── Blueprints ─────────────────────────────────────────────────────────────
    app.register_blueprint(auth_bp)
    app.register_blueprint(subjects_bp)
    app.register_blueprint(events_bp)
    app.register_blueprint(evaluations_bp)
    app.register_blueprint(notes_bp)
    app.register_blueprint(groups_bp)
    app.register_blueprint(ocr_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(notebook_bp)
    app.register_blueprint(quiz_bp)
    app.register_blueprint(institutes_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(salon_bp)

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "version": "1.0.0", "app": "StudyCore AI"})

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "endpoint not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "internal server error"}), 500

    init_db()
    return app


if __name__ == "__main__":
    app = create_app()
    port  = int(os.getenv("FLASK_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="127.0.0.1", port=port, debug=debug)
