"""
DB Adapter — unified interface for SQLite (local) and PostgreSQL/Supabase (production).

All existing routes use sqlite3-style patterns:
  conn.execute("SELECT ... WHERE id = ?", (id,)).fetchone()
  conn.execute("INSERT INTO ...", (...)).lastrowid
  conn.commit()

This adapter makes psycopg2 behave the same way, so no route files need changes.
"""
import re
import json


# ── SQL syntax conversion ──────────────────────────────────────────────────────

def _to_pg(sql: str) -> tuple[str, bool]:
    """
    Convert SQLite SQL to PostgreSQL SQL.
    Returns (converted_sql, had_insert_or_ignore).
    """
    had_ignore = bool(re.search(r'INSERT\s+OR\s+IGNORE', sql, re.IGNORECASE))
    sql = re.sub(r'INSERT\s+OR\s+IGNORE\s+INTO', 'INSERT INTO', sql, flags=re.IGNORECASE)
    sql = sql.replace('?', '%s')
    return sql, had_ignore


# ── PostgreSQL Row (dict-like, matches sqlite3.Row interface) ──────────────────

class PGRow(dict):
    """A plain dict that also supports index access for compatibility."""
    pass


# ── PostgreSQL Cursor wrapper ──────────────────────────────────────────────────

class PGCursor:
    """Wraps a psycopg2 RealDictCursor to look like a sqlite3 cursor."""

    def __init__(self, raw_cursor):
        self._cur = raw_cursor
        self.lastrowid = None

    def execute(self, sql: str, params=()):
        sql, had_ignore = _to_pg(sql)
        is_insert = sql.strip().upper().startswith('INSERT')

        if is_insert:
            sql = sql.rstrip().rstrip(';')
            # Append ON CONFLICT DO NOTHING for INSERT OR IGNORE
            if had_ignore and 'ON CONFLICT' not in sql.upper():
                sql += ' ON CONFLICT DO NOTHING'
            # Append RETURNING id to get the lastrowid equivalent
            if 'RETURNING' not in sql.upper():
                sql += ' RETURNING id'

        self._cur.execute(sql, params if params else None)

        if is_insert:
            row = self._cur.fetchone()
            self.lastrowid = row['id'] if row else None

        return self

    def fetchone(self):
        row = self._cur.fetchone()
        return dict(row) if row else None

    def fetchall(self):
        return [dict(r) for r in self._cur.fetchall()]

    def __iter__(self):
        for row in self._cur:
            yield dict(row)

    @property
    def rowcount(self) -> int:
        return self._cur.rowcount


# ── PostgreSQL Connection wrapper ──────────────────────────────────────────────

class PGConnection:
    """Wraps a psycopg2 connection to look like a sqlite3 connection."""

    def __init__(self, raw_conn):
        self._conn = raw_conn
        self._last_cur = None

    def execute(self, sql: str, params=()):
        import psycopg2.extras
        raw_cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur = PGCursor(raw_cur)
        cur.execute(sql, params)
        self._last_cur = cur
        return cur

    def executemany(self, sql: str, params_seq):
        import psycopg2.extras
        raw_cur = self._conn.cursor()
        sql, _ = _to_pg(sql)
        psycopg2.extras.execute_batch(raw_cur, sql, params_seq)

    def executescript(self, sql: str):
        """
        Only used during migration. For production PostgreSQL the schema is
        applied via Supabase dashboard — skip silently here.
        """
        pass

    @property
    def lastrowid(self):
        return self._last_cur.lastrowid if self._last_cur else None

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, *args):
        if exc_type:
            self._conn.rollback()
        else:
            self._conn.commit()
        self._conn.close()
