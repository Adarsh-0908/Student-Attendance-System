const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

// Path to SQLite database file
// On Vercel / Serverless, the source directory is read-only.
// We use /tmp/attendance.db on Vercel so SQLite can write.
const isVercel = Boolean(process.env.VERCEL);
const DB_PATH = isVercel
    ? path.join('/tmp', 'attendance.db')
    : path.join(__dirname, 'attendance.db');

const SOURCE_DB_PATH = path.join(__dirname, 'attendance.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let dbInstance = null;

const FALLBACK_SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS faculty (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    faculty_id TEXT UNIQUE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    sub_branch TEXT NOT NULL DEFAULT 'A',
    designation TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_no TEXT UNIQUE NOT NULL,
    enrollment_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    branch TEXT NOT NULL,
    semester INTEGER NOT NULL,
    section TEXT NOT NULL DEFAULT 'A',
    dob TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    branch TEXT NOT NULL,
    semester INTEGER NOT NULL,
    faculty_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_uuid TEXT UNIQUE NOT NULL,
    branch TEXT NOT NULL,
    semester INTEGER NOT NULL,
    section TEXT NOT NULL,
    subject_id INTEGER NOT NULL,
    faculty_id TEXT NOT NULL,
    date TEXT NOT NULL,
    slot TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_session UNIQUE (branch, semester, section, subject_id, date, slot)
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('P', 'A')),
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT uq_record UNIQUE (session_id, student_id)
);
`;

function getDb() {
    if (!dbInstance) {
        if (isVercel && !fs.existsSync(DB_PATH)) {
            if (fs.existsSync(SOURCE_DB_PATH)) {
                try {
                    fs.copyFileSync(SOURCE_DB_PATH, DB_PATH);
                } catch (e) {
                    console.error('Failed to copy seed database to /tmp:', e);
                }
            }
        }

        dbInstance = new DatabaseSync(DB_PATH);

        if (isVercel) {
            dbInstance.exec('PRAGMA journal_mode = MEMORY;');
        } else {
            dbInstance.exec('PRAGMA journal_mode = WAL;');
        }
        dbInstance.exec('PRAGMA foreign_keys = ON;');
    }
    return dbInstance;
}

function initDb() {
    const db = getDb();
    let schemaSql = FALLBACK_SCHEMA;
    try {
        if (fs.existsSync(SCHEMA_PATH)) {
            schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
        }
    } catch (e) {
        console.warn('Using fallback schema due to read error:', e);
    }
    db.exec(schemaSql);

    if (isVercel) {
        try {
            const fCount = db.prepare("SELECT count(*) as count FROM faculty").get();
            if (!fCount || fCount.count === 0) {
                const { seedDatabase } = require('./seed');
                seedDatabase();
            }
        } catch (e) {
            console.error('Auto-seed check error on Vercel:', e);
        }
    }
    return db;
}

module.exports = {
    getDb,
    initDb,
    DB_PATH
};
