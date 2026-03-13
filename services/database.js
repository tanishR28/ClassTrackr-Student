// ── Private helpers ──────────────────────────────────────────────────────────

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDayShort(dateStr) {
  // Use T12:00:00 to avoid UTC-vs-local midnight ambiguity
  return DAY_SHORT[new Date(dateStr + 'T12:00:00').getDay()];
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Schema ────────────────────────────────────────────────────────────────────

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

    CREATE TABLE IF NOT EXISTS attendance (
      subject_id INTEGER PRIMARY KEY,
      total      INTEGER NOT NULL DEFAULT 0,
      present    INTEGER NOT NULL DEFAULT 0,
      threshold  INTEGER NOT NULL DEFAULT 75,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS timetable (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      day        TEXT NOT NULL CHECK(day IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
      subject_id INTEGER NOT NULL,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      UNIQUE(day, subject_id)
    );

    CREATE TABLE IF NOT EXISTS daily_marks (
      date       TEXT NOT NULL,
      subject_id INTEGER NOT NULL,
      status     TEXT NOT NULL DEFAULT 'present' CHECK(status IN ('present','absent','skip')),
      processed  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(date, subject_id),
      FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS extra_lectures (
      date       TEXT NOT NULL,
      subject_id INTEGER NOT NULL,
      status     TEXT NOT NULL DEFAULT 'present' CHECK(status IN ('present','absent','skip')),
      processed  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(date, subject_id),
      FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS timetable_pause (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL,
      end_date   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT NOT NULL PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migration: add threshold column for existing installs that lack it
  try {
    await db.execAsync(
      `ALTER TABLE attendance ADD COLUMN threshold INTEGER NOT NULL DEFAULT 75`
    );
  } catch {
    // Column already exists — safe to ignore
  }

  // Seed last_processed_date on first run (existing installs start from yesterday
  // so already-processed history isn't re-applied)
  const yesterday = shiftDate(new Date().toISOString().slice(0, 10), -1);
  await db.runAsync(
    `INSERT OR IGNORE INTO app_settings (key, value) VALUES ('last_processed_date', ?)`,
    [yesterday]
  );
}

// ── Subjects ────────────────────────────────────────────────────────────────

export async function getSubjectsWithStats(db) {
  return db.getAllAsync(`
    SELECT
      s.id,
      s.name,
      s.type,
      s.created_at,
      COALESCE(a.total,   0) AS total,
      COALESCE(a.present, 0) AS present
    FROM subjects s
    LEFT JOIN attendance a ON a.subject_id = s.id
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

// ── Attendance counters ─────────────────────────────────────────────────────

export async function getAttendanceCounter(db, subjectId) {
  const row = await db.getFirstAsync(
    'SELECT total, present, threshold FROM attendance WHERE subject_id = ?',
    [subjectId]
  );
  return row ?? { total: 0, present: 0, threshold: 75 };
}

export async function upsertAttendanceCounter(db, subjectId, total, present, threshold) {
  await db.runAsync(
    `INSERT INTO attendance (subject_id, total, present, threshold) VALUES (?, ?, ?, ?)
     ON CONFLICT(subject_id) DO UPDATE SET
       total     = excluded.total,
       present   = excluded.present,
       threshold = excluded.threshold`,
    [subjectId, total, present, threshold]
  );
}

// ── Timetable ───────────────────────────────────────────────────────────────

export async function getTimetableSubjectIds(db, day) {
  const rows = await db.getAllAsync(
    'SELECT subject_id FROM timetable WHERE day = ?',
    [day]
  );
  return rows.map((r) => r.subject_id);
}

export async function getSubjectsWithStatsForDay(db, day) {
  return db.getAllAsync(`
    SELECT
      s.id,
      s.name,
      s.type,
      s.created_at,
      COALESCE(a.total,   0) AS total,
      COALESCE(a.present, 0) AS present
    FROM timetable t
    JOIN subjects s ON s.id = t.subject_id
    LEFT JOIN attendance a ON a.subject_id = s.id
    WHERE t.day = ?
    ORDER BY s.created_at DESC
  `, [day]);
}

export async function toggleTimetableSubject(db, day, subjectId, add) {
  if (add) {
    await db.runAsync(
      'INSERT OR IGNORE INTO timetable (day, subject_id) VALUES (?, ?)',
      [day, subjectId]
    );
  } else {
    await db.runAsync(
      'DELETE FROM timetable WHERE day = ? AND subject_id = ?',
      [day, subjectId]
    );
  }
}

export async function getSubjectsNotInDay(db, day) {
  return db.getAllAsync(`
    SELECT id, name, type FROM subjects
    WHERE id NOT IN (SELECT subject_id FROM timetable WHERE day = ?)
    ORDER BY name ASC
  `, [day]);
}

// ── Daily marks ──────────────────────────────────────────────────────────────

/** Seed today's timetable subjects with default 'present' (no-op if already seeded). */
export async function initTodayMarks(db, day, dateStr) {
  await db.runAsync(
    `INSERT OR IGNORE INTO daily_marks (date, subject_id, status)
     SELECT ?, t.subject_id, 'present'
     FROM timetable t
     WHERE t.day = ?`,
    [dateStr, day]
  );
}

/**
 * Core attendance processor.
 *
 * Iterates every calendar date from (last_processed_date + 1) up to (todayDate - 1).
 * For each date it looks up the weekly timetable for that day-of-week and applies:
 *   - explicit daily_marks status if the user marked the subject
 *   - defaults to 'present' if the app was never opened that day
 *
 * This guarantees that not opening the app == counted as present.
 */
export async function processPendingMarks(db, todayDate) {
  // Read (or initialise) the pointer tracking how far we've processed
  const setting = await db.getFirstAsync(
    `SELECT value FROM app_settings WHERE key = 'last_processed_date'`
  );
  if (!setting) return; // initDatabase hasn't run yet — shouldn't happen

  const lastProcessed = setting.value;

  // Build the list of dates that still need processing
  const dates = [];
  let cur = shiftDate(lastProcessed, 1);
  while (cur < todayDate) {
    dates.push(cur);
    cur = shiftDate(cur, 1);
  }
  if (dates.length === 0) return;

  // Active pause range (one row max)
  const pause = await db.getFirstAsync(
    `SELECT start_date, end_date FROM timetable_pause LIMIT 1`
  );

  for (const dateStr of dates) {
    // Paused day → skip entirely, no attendance recorded
    if (pause && dateStr >= pause.start_date && dateStr <= pause.end_date) {
      await db.runAsync(
        `UPDATE daily_marks  SET processed = 1 WHERE date = ? AND processed = 0`, [dateStr]
      );
      await db.runAsync(
        `UPDATE extra_lectures SET processed = 1 WHERE date = ? AND processed = 0`, [dateStr]
      );
      continue;
    }

    const dayShort = getDayShort(dateStr);

    // ── Timetable subjects for this day ──────────────────────────────────────
    const scheduled = await db.getAllAsync(
      `SELECT subject_id FROM timetable WHERE day = ?`,
      [dayShort]
    );

    for (const { subject_id } of scheduled) {
      // Explicit user mark, or 'present' if they never opened the app
      const markRow = await db.getFirstAsync(
        `SELECT status FROM daily_marks WHERE date = ? AND subject_id = ?`,
        [dateStr, subject_id]
      );
      const status = markRow?.status ?? 'present';
      if (status === 'skip') continue;

      // Read attendance fresh each time to avoid staleness when processing
      // multiple days in one run for the same subject
      const att = await db.getFirstAsync(
        `SELECT total, present, threshold FROM attendance WHERE subject_id = ?`,
        [subject_id]
      ) ?? { total: 0, present: 0, threshold: 75 };

      if (status === 'present') {
        await db.runAsync(
          `INSERT INTO attendance (subject_id, total, present, threshold) VALUES (?, ?, ?, ?)
           ON CONFLICT(subject_id) DO UPDATE SET
             total   = excluded.total,
             present = excluded.present`,
          [subject_id, att.total + 1, att.present + 1, att.threshold]
        );
      } else {
        // absent
        await db.runAsync(
          `INSERT INTO attendance (subject_id, total, present, threshold) VALUES (?, ?, ?, ?)
           ON CONFLICT(subject_id) DO UPDATE SET
             total = excluded.total`,
          [subject_id, att.total + 1, att.present, att.threshold]
        );
      }
    }

    // ── Extra lectures for this date ─────────────────────────────────────────
    const extras = await db.getAllAsync(
      `SELECT subject_id, status FROM extra_lectures WHERE date = ? AND processed = 0`,
      [dateStr]
    );

    for (const { subject_id, status } of extras) {
      if (status === 'skip') continue;

      const att = await db.getFirstAsync(
        `SELECT total, present, threshold FROM attendance WHERE subject_id = ?`,
        [subject_id]
      ) ?? { total: 0, present: 0, threshold: 75 };

      if (status === 'present') {
        await db.runAsync(
          `INSERT INTO attendance (subject_id, total, present, threshold) VALUES (?, ?, ?, ?)
           ON CONFLICT(subject_id) DO UPDATE SET
             total   = excluded.total,
             present = excluded.present`,
          [subject_id, att.total + 1, att.present + 1, att.threshold]
        );
      } else {
        await db.runAsync(
          `INSERT INTO attendance (subject_id, total, present, threshold) VALUES (?, ?, ?, ?)
           ON CONFLICT(subject_id) DO UPDATE SET
             total = excluded.total`,
          [subject_id, att.total + 1, att.present, att.threshold]
        );
      }
    }

    // Mark daily_marks + extra_lectures as processed for this date
    await db.runAsync(
      `UPDATE daily_marks    SET processed = 1 WHERE date = ? AND processed = 0`, [dateStr]
    );
    await db.runAsync(
      `UPDATE extra_lectures SET processed = 1 WHERE date = ? AND processed = 0`, [dateStr]
    );
  }

  // Advance the pointer to the last date we just processed
  await db.runAsync(
    `UPDATE app_settings SET value = ? WHERE key = 'last_processed_date'`,
    [dates[dates.length - 1]]
  );
}

/** Set (or update) today's mark for one subject. */
export async function setDailyMark(db, dateStr, subjectId, status) {
  await db.runAsync(
    `INSERT INTO daily_marks (date, subject_id, status) VALUES (?, ?, ?)
     ON CONFLICT(date, subject_id) DO UPDATE SET status = excluded.status`,
    [dateStr, subjectId, status]
  );
}

/** Returns a map of { [subjectId]: status } for the given date. */
export async function getTodayMarksMap(db, dateStr) {
  const rows = await db.getAllAsync(
    'SELECT subject_id, status FROM daily_marks WHERE date = ?',
    [dateStr]
  );
  const map = {};
  for (const r of rows) map[r.subject_id] = r.status;
  return map;
}

// ── Extra lectures ────────────────────────────────────────────────────────────

/** All subjects (id, name, type) sorted alphabetically — for the extra lecture picker. */
export async function getAllSubjects(db) {
  return db.getAllAsync('SELECT id, name, type FROM subjects ORDER BY name ASC');
}

/** Add a subject as an extra lecture for a given date (INSERT OR IGNORE). */
export async function addExtraLecture(db, dateStr, subjectId) {
  await db.runAsync(
    `INSERT OR IGNORE INTO extra_lectures (date, subject_id, status) VALUES (?, ?, 'present')`,
    [dateStr, subjectId]
  );
}

/** Remove an extra lecture for a given date. */
export async function removeExtraLecture(db, dateStr, subjectId) {
  await db.runAsync(
    'DELETE FROM extra_lectures WHERE date = ? AND subject_id = ?',
    [dateStr, subjectId]
  );
}

/**
 * Returns unprocessed extra lectures for the given date, with subject info and attendance stats.
 * Shape: [{ subject_id, status, name, type, total, present }]
 */
export async function getExtraLecturesForDate(db, dateStr) {
  return db.getAllAsync(`
    SELECT el.subject_id, el.status, s.name, s.type,
           COALESCE(a.total,   0) AS total,
           COALESCE(a.present, 0) AS present
    FROM extra_lectures el
    JOIN subjects s ON s.id = el.subject_id
    LEFT JOIN attendance a ON a.subject_id = el.subject_id
    WHERE el.date = ? AND el.processed = 0
    ORDER BY s.name ASC
  `, [dateStr]);
}

/** Set (or update) the mark status for an extra lecture. */
export async function setExtraLectureMark(db, dateStr, subjectId, status) {
  await db.runAsync(
    `UPDATE extra_lectures SET status = ? WHERE date = ? AND subject_id = ?`,
    [status, dateStr, subjectId]
  );
}

// ── Timetable pause ───────────────────────────────────────────────────────────

/** Returns the currently active pause, or null. */
export async function getActivePause(db) {
  return db.getFirstAsync('SELECT id, start_date, end_date FROM timetable_pause LIMIT 1');
}

/** Set a pause (replaces any existing). start/end are YYYY-MM-DD strings. */
export async function setPause(db, startDate, endDate) {
  await db.runAsync('DELETE FROM timetable_pause');
  await db.runAsync(
    'INSERT INTO timetable_pause (start_date, end_date) VALUES (?, ?)',
    [startDate, endDate]
  );
}

/** Remove the active pause. */
export async function clearPause(db) {
  await db.runAsync('DELETE FROM timetable_pause');
}
