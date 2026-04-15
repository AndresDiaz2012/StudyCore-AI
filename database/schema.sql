-- StudyCore AI — SQLite Schema
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    email           TEXT    UNIQUE,
    password_hash   TEXT,
    session_token   TEXT,
    onboarding_done INTEGER DEFAULT 0,
    profile         TEXT    DEFAULT '{}',
    settings        TEXT    DEFAULT '{}',
    role            TEXT    DEFAULT 'student',   -- student | delegado | admin | developer
    institute_id    INTEGER,                     -- FK to institutes (added after)
    created_at      TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT '📚',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    subject_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,          -- ISO 8601 date string
    time TEXT,                   -- HH:MM
    type TEXT DEFAULT 'task',    -- task | exam | reminder | class
    status TEXT DEFAULT 'pending',  -- pending | done | missed
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    subject_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    percentage REAL NOT NULL,    -- weight in the final grade (0-100)
    grade REAL,                  -- achieved grade (0-20 or 0-100 depending on scale)
    max_grade REAL DEFAULT 20,   -- grading scale max
    date TEXT,
    period TEXT,                 -- lapso 1, lapso 2, lapso 3, etc.
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    subject_id INTEGER,
    title TEXT,
    content TEXT,
    source TEXT DEFAULT 'manual', -- manual | ocr | ai
    period TEXT,                  -- lapso 1, 2, 3...
    tags TEXT DEFAULT '[]',       -- JSON array
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'private',  -- public | private
    invite_code TEXT UNIQUE,
    created_by INTEGER NOT NULL DEFAULT 1,
    image TEXT DEFAULT '👥',
    max_members INTEGER DEFAULT 50,
    only_admin_speaks INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS group_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id   INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    type       TEXT    DEFAULT 'text',  -- text | class | ai | quiz_session
    content    TEXT,
    ref_id     INTEGER,
    created_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (group_id) REFERENCES groups(id)  ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES users(id)   ON DELETE CASCADE
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
    created_at       TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
    FOREIGN KEY (topic_id)   REFERENCES topics(id)   ON DELETE SET NULL
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
    finished_at TEXT,
    FOREIGN KEY (quiz_id)    REFERENCES quizzes(id)             ON DELETE CASCADE,
    FOREIGN KEY (user_id)    REFERENCES users(id)               ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES group_quiz_sessions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS group_quiz_sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id    INTEGER NOT NULL,
    quiz_id     INTEGER NOT NULL,
    created_by  INTEGER NOT NULL,
    status      TEXT    DEFAULT 'waiting',  -- waiting | active | finished
    started_at  TEXT,
    finished_at TEXT,
    created_at  TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (group_id)   REFERENCES groups(id)  ON DELETE CASCADE,
    FOREIGN KEY (quiz_id)    REFERENCES quizzes(id)  ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member',  -- admin | member
    joined_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL DEFAULT 1,
    title TEXT,
    content TEXT,
    content_type TEXT DEFAULT 'note',  -- note | file | link
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    subject_id INTEGER,
    title TEXT,
    messages TEXT DEFAULT '[]',  -- JSON array of {role, content, timestamp}
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);

-- ── Cuaderno Digital (jerarquía: Materia → Período → Tema → Entrada) ──────────

CREATE TABLE IF NOT EXISTS periods (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    name       TEXT    NOT NULL,   -- "Lapso 1", "2do Semestre", etc.
    order_num  INTEGER DEFAULT 0,
    created_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS topics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id   INTEGER NOT NULL,
    name        TEXT    NOT NULL,   -- "Los Biomas", "Derivadas", etc.
    description TEXT,
    order_num   INTEGER DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS entries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id   INTEGER NOT NULL,
    title      TEXT,               -- opcional, ej: "Clase del lunes"
    content    TEXT,
    entry_date TEXT    NOT NULL DEFAULT (date('now')),   -- fecha de la clase
    source     TEXT    DEFAULT 'manual',  -- manual | ocr
    created_at TEXT    DEFAULT (datetime('now')),
    updated_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

-- ── Fuentes del Profesor IA ────────────────────────────────────────────────────
-- Vincula una conversación con temas del cuaderno, URLs o videos

CREATE TABLE IF NOT EXISTS ai_sources (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    conv_id     INTEGER NOT NULL,
    type        TEXT    NOT NULL,  -- 'topic' | 'url' | 'video'
    topic_id    INTEGER,           -- si type='topic'
    url         TEXT,              -- si type='url' o 'video'
    label       TEXT,              -- nombre visible
    created_at  TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (conv_id)   REFERENCES ai_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id)  REFERENCES topics(id) ON DELETE SET NULL
);

-- ── Institutos y jerarquía académica ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institutes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    created_at TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_codes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    code       TEXT    NOT NULL UNIQUE,
    used       INTEGER DEFAULT 0,
    used_by    INTEGER REFERENCES users(id),
    created_at TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS salons (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    institute_id INTEGER NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    order_num    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS salon_members (
    salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    user_id  INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    PRIMARY KEY (salon_id, user_id)
);

CREATE TABLE IF NOT EXISTS delegado_subjects (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    subject_name TEXT    NOT NULL,
    institute_id INTEGER NOT NULL REFERENCES institutes(id) ON DELETE CASCADE
);

-- Default user
INSERT OR IGNORE INTO users (id, name, email) VALUES (1, 'Estudiante', 'estudiante@studycore.app');

-- Default subjects (common Venezuelan curriculum)
INSERT OR IGNORE INTO subjects (id, user_id, name, color, icon) VALUES
    (1, 1, 'Matemáticas', '#ef4444', '🔢'),
    (2, 1, 'Física', '#f97316', '⚡'),
    (3, 1, 'Química', '#eab308', '🧪'),
    (4, 1, 'Biología', '#22c55e', '🧬'),
    (5, 1, 'Historia', '#3b82f6', '🏛️'),
    (6, 1, 'Literatura', '#8b5cf6', '📖'),
    (7, 1, 'Inglés', '#ec4899', '🌍');
