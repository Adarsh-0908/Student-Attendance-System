const express = require('express');
const cors = require('cors');
const path = require('path');
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
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

// Student Login
app.post('/api/auth/student-login', (req, res) => {
    try {
        const { roll_no, branch, semester, password } = req.body;

        if (!roll_no || !branch || !semester || !password) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        const db = getDb();
        const student = db.prepare(`
            SELECT id, roll_no, enrollment_no, name, branch, semester, section, dob, password
            FROM students
            WHERE (roll_no = ? OR enrollment_no = ?) AND branch = ? AND semester = ?
        `).get(roll_no.trim(), roll_no.trim(), branch.trim(), Number(semester));

        if (!student) {
            return res.status(401).json({ error: 'Student record not found for the given Roll/Enrollment No and Department.' });
        }

        // Validate Password (allows either custom password or Date of Birth YYYY-MM-DD)
        const trimmedInputPass = password.trim();
        if (student.password !== trimmedInputPass && student.dob !== trimmedInputPass) {
            return res.status(401).json({ error: 'Invalid password or Date of Birth.' });
        }

        const { password: _, ...safeStudent } = student;
        return res.json({
            success: true,
            userType: 'student',
            student: safeStudent,
            message: `Welcome back, ${student.name}!`
        });
    } catch (err) {
        console.error('Student login error:', err);
        return res.status(500).json({ error: 'Internal server error during student login.' });
    }
});

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

        if (!name || !email || !department || !sub_branch || !designation || !password) {
            return res.status(400).json({ error: 'All fields are required for faculty registration.' });
        }

        const cleanSubBranch = sub_branch.trim().toUpperCase();
        if (cleanSubBranch.length !== 1 || !/^[A-Z]$/.test(cleanSubBranch)) {
            return res.status(400).json({ error: 'Sub-branch / Section must be exactly 1 alphabet letter (e.g., A, B, C).' });
        }

        const db = getDb();

        // Check if email already exists
        const existing = db.prepare(`
            SELECT id FROM faculty WHERE email = ?
        `).get(email.trim());

        if (existing) {
            return res.status(409).json({ error: 'Email already registered.' });
        }

        const facultyId = 'FAC' + Math.floor(100 + Math.random() * 900);

        const insertStmt = db.prepare(`
            INSERT INTO faculty (faculty_id, name, email, department, sub_branch, designation, password)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        insertStmt.run(
            facultyId,
            name.trim(),
            email.trim(),
            department.trim(),
            cleanSubBranch,
            designation.trim(),
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
// 2. PROFESSOR DASHBOARD & ROSTER ROUTES
// ==========================================

// Get Available Class Options & Subjects for Faculty
app.get('/api/classes/options', (req, res) => {
    try {
        const db = getDb();
        const faculty_id = req.query.faculty_id || 'FAC101';

        const subjects = db.prepare(`
            SELECT id, code, name, branch, semester, faculty_id
            FROM subjects
            WHERE faculty_id = ? OR ? = 'ALL'
            ORDER BY code ASC
        `).all(faculty_id, faculty_id);

        const branches = ['CSE', 'ECE', 'ME', 'CE', 'IT', 'EE'];
        const semesters = [1, 2, 3, 4, 5, 6, 7, 8];
        const sections = ['A', 'B', 'C'];
        const slots = [
            '09:00 AM - 10:00 AM',
            '10:00 AM - 11:00 AM',
            '11:15 AM - 12:15 PM',
            '01:00 PM - 02:00 PM',
            '02:00 PM - 03:00 PM',
            '03:15 PM - 04:15 PM'
        ];

        return res.json({
            branches,
            semesters,
            sections,
            slots,
            subjects
        });
    } catch (err) {
        console.error('Options error:', err);
        return res.status(500).json({ error: 'Failed to fetch class options.' });
    }
});

// Fetch Student Roster for the Selected Class & Existing Session status if any
app.get('/api/roster', (req, res) => {
    try {
        const { branch, semester, section, subject_id, date, slot } = req.query;

        if (!branch || !semester || !section || !subject_id) {
            return res.status(400).json({ error: 'Missing required class parameters.' });
        }

        const db = getDb();

        // 1. Fetch Students in this class
        const students = db.prepare(`
            SELECT id, roll_no, enrollment_no, name, branch, semester, section
            FROM students
            WHERE branch = ? AND semester = ? AND section = ?
            ORDER BY CAST(roll_no AS INTEGER) ASC, roll_no ASC
        `).all(branch, Number(semester), section);

        // 2. Check if a session already exists for this exact slot & date
        let existingSession = null;
        let existingRecords = {};

        if (date && slot) {
            existingSession = db.prepare(`
                SELECT id, session_uuid, date, slot, created_at, updated_at
                FROM attendance_sessions
                WHERE branch = ? AND semester = ? AND section = ? AND subject_id = ? AND date = ? AND slot = ?
            `).get(branch, Number(semester), section, Number(subject_id), date, slot);

            if (existingSession) {
                const records = db.prepare(`
                    SELECT student_id, status, remarks
                    FROM attendance_records
                    WHERE session_id = ?
                `).all(existingSession.id);

                for (const r of records) {
                    existingRecords[r.student_id] = {
                        status: r.status,
                        remarks: r.remarks || ''
                    };
                }
            }
        }

        // Attach existing status or default 'P'
        const rosterWithStatus = students.map(s => ({
            ...s,
            status: existingRecords[s.id] ? existingRecords[s.id].status : 'P',
            remarks: existingRecords[s.id] ? existingRecords[s.id].remarks : ''
        }));

        return res.json({
            students: rosterWithStatus,
            isExistingSession: !!existingSession,
            existingSession: existingSession || null
        });
    } catch (err) {
        console.error('Roster error:', err);
        return res.status(500).json({ error: 'Failed to fetch student roster.' });
    }
});

// Check if attendance already exists for duplicate warning
app.post('/api/attendance/check-duplicate', (req, res) => {
    try {
        const { branch, semester, section, subject_id, date, slot } = req.body;
        const db = getDb();

        const existing = db.prepare(`
            SELECT id, session_uuid, date, slot, updated_at
            FROM attendance_sessions
            WHERE branch = ? AND semester = ? AND section = ? AND subject_id = ? AND date = ? AND slot = ?
        `).get(branch, Number(semester), section, Number(subject_id), date, slot);

        return res.json({
            exists: !!existing,
            session: existing || null
        });
    } catch (err) {
        console.error('Check duplicate error:', err);
        return res.status(500).json({ error: 'Failed to check duplicate.' });
    }
});

// Submit & Sync Attendance
app.post('/api/attendance/submit', (req, res) => {
    try {
        const { branch, semester, section, subject_id, faculty_id, date, slot, records, overwrite } = req.body;

        if (!branch || !semester || !section || !subject_id || !faculty_id || !date || !slot || !records || !Array.isArray(records)) {
            return res.status(400).json({ error: 'Incomplete attendance submission payload.' });
        }

        const db = getDb();

        // Check if session exists
        const existingSession = db.prepare(`
            SELECT id FROM attendance_sessions
            WHERE branch = ? AND semester = ? AND section = ? AND subject_id = ? AND date = ? AND slot = ?
        `).get(branch, Number(semester), section, Number(subject_id), date, slot);

        if (existingSession && !overwrite) {
            return res.status(409).json({
                error: 'DUPLICATE_SESSION',
                message: `Attendance for this lecture slot on ${date} (${slot}) already exists. Please confirm if you wish to overwrite.`
            });
        }

        let sessionId;

        if (existingSession) {
            sessionId = existingSession.id;
            // Update session timestamp
            db.prepare(`
                UPDATE attendance_sessions
                SET updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(sessionId);

            // Upsert / Replace records
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
            // Insert New Session
            const uuid = crypto.randomUUID();
            db.prepare(`
                INSERT INTO attendance_sessions (session_uuid, branch, semester, section, subject_id, faculty_id, date, slot)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(uuid, branch, Number(semester), section, Number(subject_id), faculty_id, date, slot);

            const insertedSession = db.prepare('SELECT id FROM attendance_sessions WHERE session_uuid = ?').get(uuid);
            sessionId = insertedSession.id;

            const insertRecordStmt = db.prepare(`
                INSERT INTO attendance_records (session_id, student_id, status, remarks)
                VALUES (?, ?, ?, ?)
            `);

            for (const r of records) {
                insertRecordStmt.run(sessionId, r.student_id, r.status, r.remarks || '');
            }
        }

        // Calculate live counter summary for response
        let presentCount = 0;
        let absentCount = 0;

        for (const r of records) {
            if (r.status === 'P') presentCount++;
            else absentCount++;
        }

        const total = records.length;
        const turnoutPct = total > 0 ? ((presentCount / total) * 100).toFixed(1) : 0;

        return res.json({
            success: true,
            sessionId,
            isUpdate: !!existingSession,
            message: existingSession ? 'Attendance updated & synced successfully!' : 'Attendance submitted & synced successfully!',
            summary: {
                total,
                present: presentCount,
                absent: absentCount,
                turnout: turnoutPct
            }
        });
    } catch (err) {
        console.error('Submit attendance error:', err);
        return res.status(500).json({ error: 'Failed to save attendance.' });
    }
});

// Cumulative Attendance Matrix API (for interactive preview in dashboard)
app.get('/api/attendance/matrix', (req, res) => {
    try {
        const { branch, semester, section, subject_id } = req.query;

        if (!branch || !semester || !section || !subject_id) {
            return res.status(400).json({ error: 'Missing parameters for attendance matrix.' });
        }

        const db = getDb();

        const subject = db.prepare('SELECT id, code, name FROM subjects WHERE id = ?').get(subject_id);
        const students = db.prepare(`
            SELECT id, roll_no, enrollment_no, name
            FROM students
            WHERE branch = ? AND semester = ? AND section = ?
            ORDER BY CAST(roll_no AS INTEGER) ASC, roll_no ASC
        `).all(branch, Number(semester), section);

        const sessions = db.prepare(`
            SELECT id, date, slot
            FROM attendance_sessions
            WHERE branch = ? AND semester = ? AND section = ? AND subject_id = ?
            ORDER BY date ASC, slot ASC
        `).all(branch, Number(semester), section, subject_id);

        const sessionIds = sessions.map(s => s.id);
        let matrix = {};

        if (sessionIds.length > 0) {
            const placeholders = sessionIds.map(() => '?').join(',');
            const records = db.prepare(`
                SELECT session_id, student_id, status
                FROM attendance_records
                WHERE session_id IN (${placeholders})
            `).all(...sessionIds);

            for (const r of records) {
                if (!matrix[r.session_id]) matrix[r.session_id] = {};
                matrix[r.session_id][r.student_id] = r.status;
            }
        }

        const studentRows = students.map(s => {
            let attended = 0;
            const history = sessions.map(sess => {
                const status = (matrix[sess.id] && matrix[sess.id][s.id]) || '-';
                if (status === 'P') attended++;
                return { sessionId: sess.id, date: sess.date, slot: sess.slot, status };
            });

            const total = sessions.length;
            const pct = total > 0 ? (attended / total) * 100 : 100;

            return {
                student: s,
                history,
                totalClasses: total,
                attendedClasses: attended,
                percentage: Number(pct.toFixed(1)),
                isEligible: pct >= 75
            };
        });

        return res.json({
            subject,
            sessions,
            studentRows
        });
    } catch (err) {
        console.error('Matrix error:', err);
        return res.status(500).json({ error: 'Failed to fetch attendance matrix.' });
    }
});

// Download Cumulative Register Excel (.xlsx)
app.get('/api/attendance/export-excel', (req, res) => {
    try {
        const { branch, semester, section, subject_id } = req.query;

        if (!branch || !semester || !section || !subject_id) {
            return res.status(400).send('Missing required parameters: branch, semester, section, subject_id');
        }

        const { buffer, filename } = generateCumulativeAttendanceExcel({
            branch,
            semester: Number(semester),
            section,
            subject_id: Number(subject_id)
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        return res.send(buffer);
    } catch (err) {
        console.error('Excel export error:', err);
        return res.status(500).send('Error generating Excel file: ' + err.message);
    }
});

// ==========================================
// 3. STUDENT DASHBOARD ROUTES
// ==========================================

app.get('/api/student/dashboard', (req, res) => {
    try {
        const { student_id, enrollment_no } = req.query;

        if (!student_id && !enrollment_no) {
            return res.status(400).json({ error: 'student_id or enrollment_no is required.' });
        }

        const db = getDb();

        const student = student_id
            ? db.prepare('SELECT id, roll_no, enrollment_no, name, branch, semester, section, dob FROM students WHERE id = ?').get(student_id)
            : db.prepare('SELECT id, roll_no, enrollment_no, name, branch, semester, section, dob FROM students WHERE enrollment_no = ?').get(enrollment_no);

        if (!student) {
            return res.status(404).json({ error: 'Student not found.' });
        }

        // Fetch all subjects for this student's branch & semester
        const subjects = db.prepare(`
            SELECT id, code, name
            FROM subjects
            WHERE branch = ? AND semester = ?
            ORDER BY code ASC
        `).all(student.branch, student.semester);

        // Fetch subject breakdown
        let grandTotalHeld = 0;
        let grandTotalAttended = 0;

        const subjectBreakdown = subjects.map(sub => {
            // Count total sessions held for this class & subject
            const totalRow = db.prepare(`
                SELECT COUNT(*) as count
                FROM attendance_sessions
                WHERE branch = ? AND semester = ? AND section = ? AND subject_id = ?
            `).get(student.branch, student.semester, student.section, sub.id);

            const totalHeld = totalRow ? totalRow.count : 0;

            // Count attended sessions (P or L)
            const attendedRow = db.prepare(`
                SELECT COUNT(*) as count
                FROM attendance_records ar
                JOIN attendance_sessions s ON ar.session_id = s.id
                WHERE s.branch = ? AND s.semester = ? AND s.section = ? AND s.subject_id = ?
                  AND ar.student_id = ? AND ar.status = 'P'
            `).get(student.branch, student.semester, student.section, sub.id, student.id);

            const attendedCount = attendedRow ? attendedRow.count : 0;
            const pct = totalHeld > 0 ? (attendedCount / totalHeld) * 100 : 100;

            grandTotalHeld += totalHeld;
            grandTotalAttended += attendedCount;

            return {
                subject_id: sub.id,
                code: sub.code,
                name: sub.name,
                total_lectures: totalHeld,
                attended_lectures: attendedCount,
                absent_lectures: totalHeld - attendedCount,
                percentage: Number(pct.toFixed(1)),
                is_eligible: pct >= 75
            };
        });

        // Overall stats
        const overallPct = grandTotalHeld > 0 ? (grandTotalAttended / grandTotalHeld) * 100 : 100;
        const isOverallEligible = overallPct >= 75;

        // Calculate lectures needed to reach 75% if below 75%
        let classesNeededFor75 = 0;
        let marginSafeClasses = 0;

        if (!isOverallEligible && grandTotalHeld > 0) {
            // Equation: (grandTotalAttended + x) / (grandTotalHeld + x) >= 0.75
            // x = ceil((0.75 * held - attended) / 0.25)
            const diff = 0.75 * grandTotalHeld - grandTotalAttended;
            classesNeededFor75 = Math.max(1, Math.ceil(diff / 0.25));
        } else if (isOverallEligible && grandTotalHeld > 0) {
            // Can miss M classes: (grandTotalAttended) / (grandTotalHeld + M) >= 0.75
            // grandTotalAttended >= 0.75 * (grandTotalHeld + M)
            // M <= (grandTotalAttended / 0.75) - grandTotalHeld
            marginSafeClasses = Math.max(0, Math.floor((grandTotalAttended / 0.75) - grandTotalHeld));
        }

        // Fetch recent session logs (last 20)
        const recentLogs = db.prepare(`
            SELECT s.date, s.slot, sub.code as subject_code, sub.name as subject_name, ar.status, ar.remarks
            FROM attendance_records ar
            JOIN attendance_sessions s ON ar.session_id = s.id
            JOIN subjects sub ON s.subject_id = sub.id
            WHERE ar.student_id = ?
            ORDER BY s.date DESC, s.slot DESC
            LIMIT 20
        `).all(student.id);

        return res.json({
            profile: student,
            overall: {
                total_lectures: grandTotalHeld,
                attended_lectures: grandTotalAttended,
                absent_lectures: grandTotalHeld - grandTotalAttended,
                percentage: Number(overallPct.toFixed(1)),
                is_eligible: isOverallEligible,
                classes_needed_for_75: classesNeededFor75,
                margin_safe_classes: marginSafeClasses
            },
            subject_breakdown: subjectBreakdown,
            recent_logs: recentLogs
        });
    } catch (err) {
        console.error('Student dashboard error:', err);
        return res.status(500).json({ error: 'Failed to fetch student dashboard data.' });
    }
});

// Fallback route for SPA (Express 5 compatible)
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
