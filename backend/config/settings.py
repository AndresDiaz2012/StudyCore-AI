import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

DATABASE_PATH = os.getenv("DATABASE_PATH") or str(BASE_DIR / "database" / "studycore.db")
SCHEMA_PATH   = str(BASE_DIR / "database" / "schema.sql")

# Set this to a PostgreSQL connection string (from Supabase) to use PostgreSQL.
# Leave unset for local SQLite development.
DATABASE_URL = os.getenv("DATABASE_URL") or ""

# ── AI ────────────────────────────────────────────────────────────────────────
GEMINI_API_KEY    = os.getenv("GEMINI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# ── Security ──────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "studycore-dev-secret-2025")

# ── Files ─────────────────────────────────────────────────────────────────────
UPLOAD_FOLDER      = str(BASE_DIR / "uploads")
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB

# ── OCR ───────────────────────────────────────────────────────────────────────
OCR_LANG      = os.getenv("OCR_LANG", "spa+eng")
TESSERACT_CMD = os.getenv("TESSERACT_CMD", r"C:\Program Files\Tesseract-OCR\tesseract.exe")

# ── Deployment ────────────────────────────────────────────────────────────────
# URL of the deployed frontend (e.g. https://studycore.vercel.app)
FRONTEND_URL = os.getenv("FRONTEND_URL", "")

CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "app://.",
    "file://",
    *(["https://" + FRONTEND_URL.replace("https://", "")] if FRONTEND_URL else []),
]
