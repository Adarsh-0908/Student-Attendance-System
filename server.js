const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getDb, initDb } = require('./database/db');
const { generateCumulativeAttendanceExcel } = require('./services/excelService');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database & Tables
initDb();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Determine static assets directory
const publicPath = fs.existsSync(path.join(__dirname, 'public'))
    ? path.join(__dirname, 'public')
    : path.join(process.cwd(), 'public');

app.use(express.static(publicPath));

// Explicit static routes for JS and CSS files
app.get('/js/:file', (req, res) => {
    const filePath = path.join(publicPath, 'js', req.params.file);
    if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
    }
    res.status(404).send('JavaScript file not found');
});

app.get('/css/:file', (req, res) => {
    const filePath = path.join(publicPath, 'css', req.params.file);
    if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
    }
    res.status(404).send('CSS file not found');
});

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

// Faculty / Professor Login
app.post('/api/auth/faculty-login', (req, res) => {
    try {
        const { email, department, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const db = getDb();
        const faculty = db.prepare(`
            SELECT id, faculty_id, name, email, department, sub_branch, designation, password
            FROM faculty
            WHERE email = ? OR faculty_id = ?
        `).get(email.trim(), email.trim());

        if (!faculty) {
            return res.status(401).json({ error: 'Faculty record not found for the given Email.' });
        }

        if (faculty.password !== password.trim()) {
            return res.status(401).json({ error: 'Invalid password.' });
        }

        if (department && department.trim() && faculty.department !== department.trim()) {
            try {
                db.prepare('UPDATE faculty SET department = ? WHERE id = ?').run(department.trim(), faculty.id);
                faculty.department = department.trim();
            } catch (e) {
                console.warn('Department update warning:', e);
            }
        }

        const { password: _, ...safeFaculty } = faculty;
        return res.json({
            success: true,
            userType: 'faculty',
            faculty: safeFaculty,
            message: `Welcome back, ${faculty.name}!`
        });
    } catch (err) {
        console.error('Faculty login error:', err);
        return res.status(500).json({ error: 'Internal server error during faculty login.' });
    }
});

// Faculty / Professor Sign Up
app.post('/api/auth/faculty-signup', (req, res) => {
    try {
        const { name, email, department, sub_branch, designation, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required for faculty registration.' });
        }

        const cleanDept = (department || 'Computer Engineering').trim();
        const cleanSubBranch = (sub_branch || 'A').trim().toUpperCase();
        const cleanDesignation = (designation || 'Professor').trim();

        const db = getDb();

        // Check if email already exists
        const existing = db.prepare(`
            SELECT id FROM faculty WHERE email = ?
        `).get(email.trim());

        if (existing) {
            return res.status(409).json({ error: 'Email already registered. Please sign in instead.' });
        }

        const facultyId = 'FAC' + Math.floor(1000 + Math.random() * 9000);

        const insertStmt = db.prepare(`
            INSERT INTO faculty (faculty_id, name, email, department, sub_branch, designation, password)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        insertStmt.run(
            facultyId,
            name.trim(),
            email.trim(),
            cleanDept,
            cleanSubBranch,
            cleanDesignation,
            password.trim()
        );

        const newFaculty = db.prepare(`
            SELECT id, faculty_id, name, email, department, sub_branch, designation
            FROM faculty
            WHERE email = ?
        `).get(email.trim());

        return res.json({
            success: true,
            userType: 'faculty',
            faculty: newFaculty,
            message: `Account created successfully! Welcome, ${newFaculty.name}.`
        });
    } catch (err) {
        console.error('Faculty signup error:', err);
        return res.status(500).json({ error: 'Internal server error during faculty sign up.' });
    }
});

// ==========================================
// 2. DATA MANAGEMENT (ADD SUBJECTS & STUDENTS)
// ==========================================

// Add Subject Endpoint
app.post('/api/subjects/add', (req, res) => {
    try {
        const { code, name, branch, semester, faculty_id } = req.body;

        if (!code || !name || !branch || !semester || !faculty_id) {
            return res.status(400).json({ error: 'All fields are required to add a subject.' });
        }

        const db = getDb();
        db.prepare(`
            INSERT INTO subjects (code, name, branch, semester, faculty_id)
            VALUES (?, ?, ?, ?, ?)
        `).run(code.trim().toUpperCase(), name.trim(), branch.trim(), Number(semester), faculty_id.trim());

        return res.json({
            success: true,
            message: `Subject '${code.trim().toUpperCase()} - ${name.trim()}' added successfully!`
        });
    } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Subject code already exists.' });
        }
        console.error('Add subject error:', err);
        return res.status(500).json({ error: 'Failed to add subject.' });
    }
});

// Add Student Endpoint
app.post('/api/students/add', (req, res) => {
    try {
        const { roll_no, enrollment_no, name, branch, semester, section } = req.body;

        if (!roll_no || !enrollment_no || !name || !branch || !semester || !section) {
            return res.status(400).json({ error: 'All fields are required to add a student.' });
        }

        const db = getDb();
        db.prepare(`
            INSERT INTO students (roll_no, enrollment_no, name, branch, semester, section, dob, password)
            VALUES (?, ?, ?, ?, ?, ?, 'N/A', 'N/A')
        `).run(
            roll_no.trim(),
            enrollment_no.trim().toUpperCase(),
            name.trim(),
            branch.trim(),
            Number(semester),
            section.trim().toUpperCase()
        );

        return res.json({
            success: true,
            message: `Student '${name.trim()}' (Roll No: ${roll_no.trim()}) added successfully!`
        });
    } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Roll No or Enrollment No already exists.' });
        }
        console.error('Add student error:', err);
        return res.status(500).json({ error: 'Failed to add student.' });
    }
});

// ==========================================
// 3. PROFESSOR DASHBOARD & ROSTER ROUTES
// ==========================================

// Get Available Class Options & Subjects for Faculty
app.get('/api/classes/options', (req, res) => {
    try {
        const db = getDb();
        const faculty_id = req.query.faculty_id || 'FAC101';

        const subjects = db.prepare(`
            SELECT id, code, name, branch, semester
            FROM subjects
            WHERE faculty_id = ?
            ORDER BY semester ASC, name ASC
        `).all(faculty_id);

        return res.json({
            subjects: subjects
        });
    } catch (err) {
        console.error('Class options error:', err);
        return res.status(500).json({ error: 'Failed to fetch class options.' });
    }
});

// Fetch Student Roster for the Selected Class & Existing Session status if any
app.get('/api/roster', (req, res) => {
    try {
        const { branch, semester, section, subject_id, date, slot } = req.query;

        if (!branch || !semester || !section || !subject_id || !date || !slot) {
            return res.status(400).json({ error: 'Missing required parameters.' });
        }

        const db = getDb();

        // 1. Fetch Students in this class
        const students = db.prepare(`
            SELECT id, roll_no, enrollment_no, name
            FROM students
            WHERE branch = ? AND semester = ? AND section = ?
            ORDER BY roll_no ASC
        `).all(branch, Number(semester), section);

        // 2. Check if a session already exists for this slot
        const existingSession = db.prepare(`
            SELECT id FROM attendance_sessions
            WHERE branch = ? AND semester = ? AND section = ? AND subject_id = ? AND date = ? AND slot = ?
        `).get(branch, Number(semester), section, Number(subject_id), date, slot);

        let existingRecords = {};
        if (existingSession) {
            const records = db.prepare(`
                SELECT student_id, status, remarks
                FROM attendance_records
                WHERE session_id = ?
            `).all(existingSession.id);

            records.forEach(r => {
                existingRecords[r.student_id] = {
                    status: r.status,
                    remarks: r.remarks
                };
            });
        }

        const rosterWithStatus = students.map(s => ({
            ...s,
            status: existingRecords[s.id] ? existingRecords[s.id].status : 'P', // Default Present
            remarks: existingRecords[s.id] ? existingRecords[s.id].remarks : ''
        }));

        return res.json({
            isExistingSession: !!existingSession,
            students: rosterWithStatus
        });
    } catch (err) {
        console.error('Roster fetch error:', err);
        return res.status(500).json({ error: 'Failed to fetch student roster.' });
    }
});

// Submit Attendance
app.post('/api/attendance/submit', (req, res) => {
    const db = getDb();

    try {
        const { branch, semester, section, subject_id, faculty_id, date, slot, records, overwrite } = req.body;

        if (!records || !Array.isArray(records)) {
            return res.status(400).json({ error: 'Invalid attendance records.' });
        }

        let isUpdate = false;
        let sessionId;

        db.exec('BEGIN TRANSACTION;');
        try {
            const existingSession = db.prepare(`
                SELECT id FROM attendance_sessions
                WHERE branch = ? AND semester = ? AND section = ? AND subject_id = ? AND date = ? AND slot = ?
            `).get(branch, Number(semester), section, Number(subject_id), date, slot);

            if (existingSession) {
                if (!overwrite) {
                    db.exec('ROLLBACK;');
                    return res.status(409).json({
                        error: 'DUPLICATE_SESSION',
                        message: 'Attendance for this slot has already been recorded.'
                    });
                }
                sessionId = existingSession.id;
                isUpdate = true;

                db.prepare('UPDATE attendance_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(sessionId);

                const updateRecordStmt = db.prepare(`
                    INSERT INTO attendance_records (session_id, student_id, status, remarks, updated_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(session_id, student_id) DO UPDATE SET
                        status = excluded.status,
                        remarks = excluded.remarks,
                        updated_at = CURRENT_TIMESTAMP
                `);

                for (const r of records) {
                    updateRecordStmt.run(sessionId, r.student_id, r.status, r.remarks || '');
                }
            } else {
                const sessionUuid = crypto.randomUUID();
                const insertSession = db.prepare(`
                    INSERT INTO attendance_sessions (session_uuid, branch, semester, section, subject_id, faculty_id, date, slot)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);

                const result = insertSession.run(sessionUuid, branch, Number(semester), section, Number(subject_id), faculty_id, date, slot);
                sessionId = result.lastInsertRowid;

                const insertRecordStmt = db.prepare(`
                    INSERT INTO attendance_records (session_id, student_id, status, remarks)
                    VALUES (?, ?, ?, ?)
                `);

                for (const r of records) {
                    insertRecordStmt.run(sessionId, r.student_id, r.status, r.remarks || '');
                }
            }

            db.exec('COMMIT;');
        } catch (txErr) {
            db.exec('ROLLBACK;');
            throw txErr;
        }

        const total = records.length;
        const present = records.filter(r => r.status === 'P').length;
        const absent = records.filter(r => r.status === 'A').length;

        return res.json({
            success: true,
            isUpdate,
            message: 'Attendance submitted successfully.',
            summary: {
                total,
                present,
                absent,
                turnout: total > 0 ? ((present / total) * 100).toFixed(1) : 0
            }
        });

    } catch (err) {
        console.error('Attendance submit error:', err);
        return res.status(500).json({ error: 'Failed to submit attendance.' });
    }
});

// Interactive Cumulative Matrix Preview
app.get('/api/attendance/matrix', (req, res) => {
    try {
        const { branch, semester, section, subject_id } = req.query;

        if (!branch || !semester || !section || !subject_id) {
            return res.status(400).json({ error: 'Missing required parameters.' });
        }

        const db = getDb();

        const students = db.prepare(`
            SELECT id, roll_no, name
            FROM students
            WHERE branch = ? AND semester = ? AND section = ?
            ORDER BY roll_no ASC
        `).all(branch, Number(semester), section);

        const sessions = db.prepare(`
            SELECT id, date, slot
            FROM attendance_sessions
            WHERE branch = ? AND semester = ? AND section = ? AND subject_id = ?
            ORDER BY date ASC, slot ASC
        `).all(branch, Number(semester), section, Number(subject_id));

        if (sessions.length === 0) {
            return res.json({ sessions: [], studentRows: [] });
        }

        const sessionIds = sessions.map(s => s.id);
        const placeholders = sessionIds.map(() => '?').join(',');

        const records = db.prepare(`
            SELECT session_id, student_id, status
            FROM attendance_records
            WHERE session_id IN (${placeholders})
        `).all(...sessionIds);

        const matrix = {};
        sessionIds.forEach(id => matrix[id] = {});
        records.forEach(r => {
            matrix[r.session_id][r.student_id] = r.status;
        });

        const studentRows = students.map(s => {
            let attendedClasses = 0;
            const history = sessions.map(sess => {
                const stat = matrix[sess.id][s.id];
                if (stat === 'P') attendedClasses++;
                return { session_id: sess.id, status: stat || 'N/A' };
            });

            return {
                student: s,
                history: history,
                totalHeld: sessions.length,
                attendedClasses: attendedClasses,
                percentage: sessions.length > 0 ? ((attendedClasses / sessions.length) * 100).toFixed(1) : 0
            };
        });

        return res.json({
            sessions,
            studentRows
        });

    } catch (err) {
        console.error('Matrix error:', err);
        return res.status(500).json({ error: 'Failed to generate matrix.' });
    }
});

// Download Cumulative Register Excel
app.get('/api/attendance/export-excel', (req, res) => {
    try {
        const { branch, semester, section, subject_id } = req.query;
        if (!branch || !semester || !section || !subject_id) {
            return res.status(400).send('Missing required parameters.');
        }

        const buffer = generateCumulativeAttendanceExcel(branch, Number(semester), section, Number(subject_id));

        if (!buffer) {
            return res.status(404).send('No attendance data found for the selected criteria.');
        }

        const db = getDb();
        const sub = db.prepare('SELECT code FROM subjects WHERE id = ?').get(Number(subject_id));
        const subCode = sub ? sub.code : 'SUB';

        const fileName = `${branch}_Sem${semester}_${section}_${subCode}_Attendance_Register.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', buffer.length);

        return res.send(buffer);
    } catch (err) {
        console.error('Excel export error:', err);
        return res.status(500).send('Failed to generate Excel file.');
    }
});

// Fallback route for SPA
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(publicPath, 'index.html'));
    }
    next();
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`🚀 College Attendance Management System`);
        console.log(`🌐 Server running at: http://localhost:${PORT}`);
        console.log(`====================================================`);
    });
}

module.exports = app;
