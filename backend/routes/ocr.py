import os
import uuid
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from backend.services.ocr_service import process_image
from backend.config.settings import UPLOAD_FOLDER

ocr_bp = Blueprint("ocr", __name__, url_prefix="/api/ocr")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp", "tiff", "webp"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@ocr_bp.route("/", methods=["POST"])
def extract_text():
    if "image" not in request.files:
        return jsonify({"error": "No se recibió ninguna imagen"}), 400

    file = request.files["image"]
    if not file.filename or not allowed_file(file.filename):
        return jsonify({"error": "Tipo de archivo no válido. Usa PNG, JPG o WEBP"}), 400

    # Nombre único para evitar colisiones y problemas con espacios/tildes
    ext = file.filename.rsplit(".", 1)[-1].lower()
    safe_name = f"ocr_{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_FOLDER, safe_name)
    file.save(filepath)

    try:
        result = process_image(filepath)
        return jsonify({
            "text":       result.get("text", ""),
            "confidence": result.get("confidence"),
            "word_count": result.get("word_count", len((result.get("text") or "").split())),
            "engine":     result.get("engine", "unknown"),
            "warning":    result.get("warning"),
            "error":      result.get("error"),
        })
    except Exception as e:
        return jsonify({"error": str(e), "text": ""}), 500
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)
