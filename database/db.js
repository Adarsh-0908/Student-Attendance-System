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

function getDb() {
    if (!dbInstance) {
        // If on Vercel and /tmp/attendance.db doesn't exist, copy from source if present
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
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schemaSql);

    // Auto-seed if on Vercel and database tables are empty
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
