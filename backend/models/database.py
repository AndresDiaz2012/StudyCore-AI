"""
Database layer — supports both SQLite (local dev) and PostgreSQL/Supabase (production).

Set DATABASE_URL env var to a PostgreSQL connection string to use Supabase.
Leave it unset to use the local SQLite file.
"""
import sqlite3
import json
import os
from pathlib import Path
from backend.config.settings import DATABASE_PATH, SCHEMA_PATH, DATABASE_URL


# ── Connection factory ─────────────────────────────────────────────────────────

def get_connection():
    """
    Return a database connection.
    - If DATABASE_URL is set  → PostgreSQL via psycopg2 (Supabase / Render)
    - Otherwise               → SQLite (local development)
    Both return the same interface thanks to PGConnection / sqlite3.Connection.
    """
    if DATABASE_URL:
        import psycopg2
        from backend.models.db_adapter import PGConnection
        raw = psycopg2.connect(DATABASE_URL, sslmode='require')
        raw.autocommit = False
        return PGConnection(raw)
    else:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        return conn


# ── SQLite migration (local only) ──────────────────────────────────────────────

_MIGRATION_SQL = """
CREATE TABLE IF NOT EXISTS group_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id   INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    type       TEXT    DEFAULT 'text',
    content    TEXT,
    ref_id     INTEGER,
    created_at TEXT    DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS quizzes (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL,
    title            TEXT    NOT NULL,
    subject_id       INTEGER,
    topic_id         INTEGER,
    source_content   TEXT,
    num_questions    INTEGER DEFAULT 10,
    duration_minutes INTEGER,
    question_types   TEXT    DEFAULT '["multiple_choice"]',
    questions        TEXT    DEFAULT '[]',
    created_at       TEXT    DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS group_quiz_sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id    INTEGER NOT NULL,
    quiz_id     INTEGER NOT NULL,
    created_by  INTEGER NOT NULL,
    status      TEXT    DEFAULT 'waiting',
    started_at  TEXT,
    finished_at TEXT,
    created_at  TEXT    DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id     INTEGER NOT NULL,
    user_id     INTEGER NOT NULL,
    session_id  INTEGER,
    answers     TEXT    DEFAULT '{}',
    score       REAL,
    completed   INTEGER DEFAULT 0,
    started_at  TEXT    DEFAULT (datetime('now')),
    finished_at TEXT
);
CREATE TABLE IF NOT EXISTS periods (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    name       TEXT    NOT NULL,
    order_num  INTEGER DEFAULT 0,
    created_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS topics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id   INTEGER NOT NULL,
    name        TEXT    NOT NULL,
    description TEXT,
    order_num   INTEGER DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS entries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id   INTEGER NOT NULL,
    title      TEXT,
    content    TEXT,
    entry_date TEXT    NOT NULL DEFAULT (date('now')),
    source     TEXT    DEFAULT 'manual',
    created_at TEXT    DEFAULT (datetime('now')),
    updated_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS ai_sources (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    conv_id    INTEGER NOT NULL,
    type       TEXT    NOT NULL,
    topic_id   INTEGER,
    url        TEXT,
    label      TEXT,
    created_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (conv_id)  REFERENCES ai_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE SET NULL
);
"""


def _sqlite_tables_exist(conn) -> bool:
    row = conn.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='subjects'"
    ).fetchone()
    return (row[0] if row else 0) > 0


def _run_sqlite_migration(conn):
    conn.executescript(_MIGRATION_SQL)

    existing = {row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
    for col, sql in {
        "password_hash":   "ALTER TABLE users ADD COLUMN password_hash TEXT",
        "session_token":   "ALTER TABLE users ADD COLUMN session_token TEXT",
        "onboarding_done": "ALTER TABLE users ADD COLUMN onboarding_done INTEGER DEFAULT 0",
        "profile":         "ALTER TABLE users ADD COLUMN profile TEXT DEFAULT '{}'",
        "settings":        "ALTER TABLE users ADD COLUMN settings TEXT DEFAULT '{}'",
        "role":            "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'student'",
        "institute_id":    "ALTER TABLE users ADD COLUMN institute_id INTEGER",
    }.items():
        if col not in existing:
            conn.execute(sql)

    g_cols = {row[1] for row in conn.execute("PRAGMA table_info(groups)").fetchall()}
    for col, sql in {
        "image":             "ALTER TABLE groups ADD COLUMN image TEXT DEFAULT '👥'",
        "max_members":       "ALTER TABLE groups ADD COLUMN max_members INTEGER DEFAULT 50",
        "only_admin_speaks": "ALTER TABLE groups ADD COLUMN only_admin_speaks INTEGER DEFAULT 1",
    }.items():
        if col not in g_cols:
            conn.execute(sql)

    conn.executescript("""
    CREATE TABLE IF NOT EXISTS institutes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS admin_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE,
        used INTEGER DEFAULT 0, used_by INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS salons (
        id INTEGER PRIMARY KEY AUTOINCREMENT, institute_id INTEGER NOT NULL,
        name TEXT NOT NULL, order_num INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS salon_members (
        salon_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
        PRIMARY KEY (salon_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS delegado_subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
        subject_name TEXT NOT NULL, institute_id INTEGER NOT NULL
    );
    """)
    conn.commit()
    _seed_developer(conn)


# ── PostgreSQL init (Supabase) ─────────────────────────────────────────────────

def _pg_tables_exist(conn) -> bool:
    row = conn.execute(
        "SELECT COUNT(*) FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = 'users'"
    ).fetchone()
    return (list(row.values())[0] if row else 0) > 0


def _init_pg(conn):
    """Create tables in Supabase if they don't exist yet."""
    schema_pg = Path(__file__).resolve().parent.parent.parent / "database" / "schema_postgres.sql"
    if schema_pg.exists():
        sql = schema_pg.read_text(encoding="utf-8")
        # psycopg2 can't use executescript — run each statement individually
        import psycopg2
        raw_conn = conn._conn
        raw_conn.autocommit = True
        cur = raw_conn.cursor()
        for stmt in _split_sql(sql):
            try:
                cur.execute(stmt)
            except Exception as e:
                print(f"[db_init] skip: {e}")
        raw_conn.autocommit = False
    _seed_developer(conn)


def _split_sql(sql: str) -> list[str]:
    """Split a SQL file into individual statements, skipping comments."""
    statements = []
    current = []
    for line in sql.splitlines():
        stripped = line.strip()
        if stripped.startswith('--') or not stripped:
            continue
        current.append(line)
        if stripped.endswith(';'):
            stmt = '\n'.join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
    return statements


# ── Developer seed ─────────────────────────────────────────────────────────────

def _seed_developer(conn):
    """Ensure the developer super-account exists."""
    from werkzeug.security import generate_password_hash
    dev_email = "developer@gmail.com"
    existing = conn.execute(
        "SELECT id FROM users WHERE email = ?", (dev_email,)
    ).fetchone()
    if not existing:
        conn.execute(
            "INSERT INTO users (name, email, password_hash, role, onboarding_done) "
            "VALUES (?, ?, ?, 'developer', 1)",
            ("Developer", dev_email, generate_password_hash("developerGod123")),
        )
        conn.commit()
    else:
        conn.execute(
            "UPDATE users SET role = 'developer', onboarding_done = 1 WHERE email = ?",
            (dev_email,)
        )
        conn.commit()


# ── Public init ────────────────────────────────────────────────────────────────

def init_db():
    """Initialize the database on startup."""
    if DATABASE_URL:
        # PostgreSQL / Supabase
        conn = get_connection()
        if not _pg_tables_exist(conn):
            print("[db] First run — applying PostgreSQL schema to Supabase...")
            _init_pg(conn)
        else:
            _seed_developer(conn)
        conn.close()
        print("[db] PostgreSQL (Supabase) — ready")
    else:
        # SQLite — local development
        os.makedirs(Path(DATABASE_PATH).parent, exist_ok=True)
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row

        if _sqlite_tables_exist(conn):
            _run_sqlite_migration(conn)
            conn.close()
        else:
            try:
                with open(SCHEMA_PATH, encoding="utf-8") as f:
                    conn.executescript(f.read())
                conn.commit()
                _seed_developer(conn)
            finally:
                conn.close()
        print("[db] SQLite (local) — ready")


# ── Row helpers ────────────────────────────────────────────────────────────────

def row_to_dict(row) -> dict:
    """Convert a sqlite3.Row or dict to a plain dict, parsing JSON string fields."""
    d = dict(row)
    for key, val in d.items():
        if isinstance(val, str) and val and val[0] in ('{', '['):
            try:
                d[key] = json.loads(val)
            except (json.JSONDecodeError, ValueError):
                pass
    return d


def rows_to_list(rows) -> list:
    return [row_to_dict(r) for r in rows]
