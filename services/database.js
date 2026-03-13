export async function initDatabase(db) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS subjects (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      type       TEXT NOT NULL CHECK(type IN ('theory','lab')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id   INTEGER NOT NULL,
      date         TEXT NOT NULL,
      session_type TEXT NOT NULL CHECK(session_type IN ('lecture','lab')),
      created_at   TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL UNIQUE,
      status     TEXT CHECK(status IN ('present','absent')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );
  `);
}

// Subjects
export async function getSubjectsWithStats(db) {
  return db.getAllAsync(`
    SELECT
      s.id,
      s.name,
      s.type,
      s.created_at,
      COUNT(sess.id)                                       AS total,
      SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) AS present
    FROM subjects s
    LEFT JOIN sessions sess ON sess.subject_id = s.id
    LEFT JOIN attendance_records ar ON ar.session_id = sess.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `);
}

export async function getSubjectNames(db) {
  const rows = await db.getAllAsync('SELECT name FROM subjects');
  return rows.map((r) => r.name.toLowerCase());
}

export async function createSubject(db, name, type) {
  const result = await db.runAsync(
    'INSERT INTO subjects (name, type) VALUES (?, ?)',
    [name, type]
  );
  return result.lastInsertRowId;
}

export async function deleteSubject(db, id) {
  await db.runAsync('DELETE FROM subjects WHERE id = ?', [id]);
}

// Sessions
export async function getSessionsWithAttendance(db, subjectId) {
  return db.getAllAsync(`
    SELECT
      sess.id,
      sess.subject_id,
      sess.date,
      sess.session_type,
      sess.created_at,
      ar.status
    FROM sessions sess
    LEFT JOIN attendance_records ar ON ar.session_id = sess.id
    WHERE sess.subject_id = ?
    ORDER BY sess.date ASC, sess.id ASC
  `, [subjectId]);
}

export async function createSession(db, subjectId, date, sessionType) {
  const result = await db.runAsync(
    'INSERT INTO sessions (subject_id, date, session_type) VALUES (?, ?, ?)',
    [subjectId, date, sessionType]
  );
  return result.lastInsertRowId;
}

export async function deleteSession(db, id) {
  await db.runAsync('DELETE FROM sessions WHERE id = ?', [id]);
}

// Attendance
export async function getAttendance(db, sessionId) {
  return db.getFirstAsync(
    'SELECT * FROM attendance_records WHERE session_id = ?',
    [sessionId]
  );
}

export async function markAttendance(db, sessionId, status) {
  await db.runAsync(
    'INSERT OR REPLACE INTO attendance_records (session_id, status) VALUES (?, ?)',
    [sessionId, status]
  );
}

export async function getSubjectStats(db, subjectId) {
  return db.getFirstAsync(`
    SELECT
      COUNT(sess.id)                                       AS total,
      SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) AS present
    FROM sessions sess
    LEFT JOIN attendance_records ar ON ar.session_id = sess.id
    WHERE sess.subject_id = ?
  `, [subjectId]);
}
