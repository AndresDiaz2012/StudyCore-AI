-- StudyCore AI — PostgreSQL Schema (Supabase)
-- Run this once in the Supabase SQL Editor to bootstrap your database.

-- ── Core tables ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institutes (
    id         SERIAL PRIMARY KEY,
    name       TEXT    NOT NULL UNIQUE,
    created_at TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    name            TEXT    NOT NULL,
    email           TEXT    UNIQUE,
    password_hash   TEXT,
    session_token   TEXT,
    onboarding_done INTEGER DEFAULT 0,
    profile         TEXT    DEFAULT '{}',
    settings        TEXT    DEFAULT '{}',
    role            TEXT    DEFAULT 'student',
    institute_id    INTEGER REFERENCES institutes(id),
    created_at      TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS subjects (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    color      TEXT    DEFAULT '#6366f1',
    icon       TEXT    DEFAULT '📚',
    created_at TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS events (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
    subject_id  INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    title       TEXT    NOT NULL,
    description TEXT,
    date        TEXT    NOT NULL,
    time        TEXT,
    type        TEXT    DEFAULT 'task',
    status      TEXT    DEFAULT 'pending',
    created_at  TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS evaluations (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
    subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    title       TEXT    NOT NULL,
    percentage  REAL    NOT NULL,
    grade       REAL,
    max_grade   REAL    DEFAULT 20,
    date        TEXT,
    period      TEXT,
    created_at  TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS notes (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    title      TEXT,
    content    TEXT,
    source     TEXT    DEFAULT 'manual',
    period     TEXT,
    tags       TEXT    DEFAULT '[]',
    created_at TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
    updated_at TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS groups (
    id               SERIAL PRIMARY KEY,
    name             TEXT    NOT NULL,
    description      TEXT,
    type             TEXT    DEFAULT 'private',
    invite_code      TEXT    UNIQUE,
    created_by       INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
    image            TEXT    DEFAULT '👥',
    max_members      INTEGER DEFAULT 50,
    only_admin_speaks INTEGER DEFAULT 1,
    created_at       TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS group_members (
    id         SERIAL PRIMARY KEY,
    group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    role       TEXT    DEFAULT 'member',
    joined_at  TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
    UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_messages (
    id         SERIAL PRIMARY KEY,
    group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    type       TEXT    DEFAULT 'text',
    content    TEXT,
    ref_id     INTEGER,
    created_at TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS group_content (
    id           SERIAL PRIMARY KEY,
    group_id     INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
    title        TEXT,
    content      TEXT,
    content_type TEXT    DEFAULT 'note',
    created_at   TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS ai_conversations (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    title      TEXT,
    messages   TEXT    DEFAULT '[]',
    created_at TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
    updated_at TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS quizzes (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title            TEXT    NOT NULL,
    subject_id       INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    topic_id         INTEGER,
    source_content   TEXT,
    num_questions    INTEGER DEFAULT 10,
    duration_minutes INTEGER,
    question_types   TEXT    DEFAULT '["multiple_choice"]',
    questions        TEXT    DEFAULT '[]',
    created_at       TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id          SERIAL PRIMARY KEY,
    quiz_id     INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    session_id  INTEGER,
    answers     TEXT    DEFAULT '{}',
    score       REAL,
    completed   INTEGER DEFAULT 0,
    started_at  TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
    finished_at TEXT
);

CREATE TABLE IF NOT EXISTS group_quiz_sessions (
    id          SERIAL PRIMARY KEY,
    group_id    INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    quiz_id     INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    created_by  INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    status      TEXT    DEFAULT 'waiting',
    started_at  TEXT,
    finished_at TEXT,
    created_at  TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

-- ── Cuaderno Digital ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS periods (
    id         SERIAL PRIMARY KEY,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    order_num  INTEGER DEFAULT 0,
    created_at TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS topics (
    id          SERIAL PRIMARY KEY,
    period_id   INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    description TEXT,
    order_num   INTEGER DEFAULT 0,
    created_at  TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS entries (
    id         SERIAL PRIMARY KEY,
    topic_id   INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    title      TEXT,
    content    TEXT,
    entry_date TEXT    NOT NULL DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD')),
    source     TEXT    DEFAULT 'manual',
    created_at TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
    updated_at TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS ai_sources (
    id         SERIAL PRIMARY KEY,
    conv_id    INTEGER NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    type       TEXT    NOT NULL,
    topic_id   INTEGER REFERENCES topics(id) ON DELETE SET NULL,
    url        TEXT,
    label      TEXT,
    created_at TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

-- ── Institute / salon hierarchy ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_codes (
    id         SERIAL PRIMARY KEY,
    code       TEXT    NOT NULL UNIQUE,
    used       INTEGER DEFAULT 0,
    used_by    INTEGER REFERENCES users(id),
    created_at TEXT    DEFAULT (TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS salons (
    id           SERIAL PRIMARY KEY,
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
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    subject_name TEXT    NOT NULL,
    institute_id INTEGER NOT NULL REFERENCES institutes(id) ON DELETE CASCADE
);

-- ── Seed data ─────────────────────────────────────────────────────────────────

INSERT INTO users (id, name, email)
VALUES (1, 'Estudiante', 'estudiante@studycore.app')
ON CONFLICT (email) DO NOTHING;

INSERT INTO subjects (id, user_id, name, color, icon) VALUES
    (1, 1, 'Matemáticas', '#ef4444', '🔢'),
    (2, 1, 'Física',      '#f97316', '⚡'),
    (3, 1, 'Química',     '#eab308', '🧪'),
    (4, 1, 'Biología',    '#22c55e', '🧬'),
    (5, 1, 'Historia',    '#3b82f6', '🏛️'),
    (6, 1, 'Literatura',  '#8b5cf6', '📖'),
    (7, 1, 'Inglés',      '#ec4899', '🌍')
ON CONFLICT DO NOTHING;

-- Reset sequences after explicit id inserts
SELECT setval(pg_get_serial_sequence('users',    'id'), GREATEST((SELECT MAX(id) FROM users),    1));
SELECT setval(pg_get_serial_sequence('subjects', 'id'), GREATEST((SELECT MAX(id) FROM subjects), 1));
