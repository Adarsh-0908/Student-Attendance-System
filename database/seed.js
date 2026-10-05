const { initDb } = require('./db');
const crypto = require('crypto');

function seedDatabase() {
    const db = initDb();
    console.log('Seeding College Attendance Management System database...');

    // Clear existing data in correct FK order and reset autoincrement sequences
    db.exec(`
        DELETE FROM attendance_records;
        DELETE FROM attendance_sessions;
        DELETE FROM subjects;
        DELETE FROM students;
        DELETE FROM faculty;
        DELETE FROM sqlite_sequence WHERE name IN ('students', 'faculty', 'subjects', 'attendance_sessions', 'attendance_records');
    `);

    // 1. Seed Faculty (1 Professor)
    const insertFaculty = db.prepare(`
        INSERT INTO faculty (faculty_id, name, email, department, sub_branch, designation, password)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertFaculty.run(
        'FAC101',
        'Dr. Rajesh Sharma',
        'dr.sharma@apex.edu',
        'Computer Engineering',
        'A',
        'Associate Professor & HOD',
        'password123'
    );

    // 2. Seed Subjects
    const insertSubject = db.prepare(`
        INSERT INTO subjects (code, name, branch, semester, faculty_id)
        VALUES (?, ?, ?, ?, ?)
    `);

    const subjects = [
        { code: 'CS501', name: 'Database Management Systems', branch: 'Computer Engineering', semester: 5, faculty_id: 'FAC101' },
        { code: 'CS502', name: 'Operating Systems', branch: 'Computer Engineering', semester: 5, faculty_id: 'FAC101' },
        { code: 'CS503', name: 'Computer Networks', branch: 'Computer Engineering', semester: 5, faculty_id: 'FAC101' },
        { code: 'CS504', name: 'Design & Analysis of Algorithms', branch: 'Computer Engineering', semester: 5, faculty_id: 'FAC101' },
        { code: 'EE501', name: 'Power Systems Analysis', branch: 'Electrical', semester: 5, faculty_id: 'FAC101' },
        { code: 'IT501', name: 'Web Technologies & Cloud Computing', branch: 'IT', semester: 5, faculty_id: 'FAC101' },
        { code: 'ICT501', name: 'Communication Networks & Protocols', branch: 'ICT', semester: 5, faculty_id: 'FAC101' },
        { code: 'EC501', name: 'Digital Signal Processing', branch: 'ECE', semester: 5, faculty_id: 'FAC101' },
        { code: 'ME501', name: 'Thermodynamics & Fluid Mechanics', branch: 'Mechanical', semester: 5, faculty_id: 'FAC101' },
        { code: 'CE501', name: 'Structural Engineering & Analysis', branch: 'Civil', semester: 5, faculty_id: 'FAC101' },
        { code: 'DS501', name: 'Machine Learning & Big Data', branch: 'Data Science', semester: 5, faculty_id: 'FAC101' },
        { code: 'CH501', name: 'Chemical Reaction Engineering', branch: 'Chemical', semester: 5, faculty_id: 'FAC101' },
        { code: 'PE501', name: 'Power Semiconductor Drives', branch: 'Power Electronics', semester: 5, faculty_id: 'FAC101' },
        { code: 'EI501', name: 'Transducers & Instrumentation', branch: 'E&I', semester: 5, faculty_id: 'FAC101' }
    ];

    for (const sub of subjects) {
        insertSubject.run(sub.code, sub.name, sub.branch, sub.semester, sub.faculty_id);
    }

    // 3. Seed Students (5 Students in Computer Engineering, Sem 5, Sec A)
    const insertStudent = db.prepare(`
        INSERT INTO students (roll_no, enrollment_no, name, branch, semester, section, dob, password)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const students = [
        { roll_no: '101', enrollment_no: 'ENR20240101', name: 'Aarav Sharma', branch: 'Computer Engineering', semester: 5, section: 'A', dob: '2004-03-15', password: 'password123' },
        { roll_no: '102', enrollment_no: 'ENR20240102', name: 'Ananya Patel', branch: 'Computer Engineering', semester: 5, section: 'A', dob: '2004-07-22', password: 'password123' },
        { roll_no: '103', enrollment_no: 'ENR20240103', name: 'Rohan Gupta', branch: 'Computer Engineering', semester: 5, section: 'A', dob: '2004-11-05', password: 'password123' },
        { roll_no: '104', enrollment_no: 'ENR20240104', name: 'Isha Verma', branch: 'Computer Engineering', semester: 5, section: 'A', dob: '2004-01-30', password: 'password123' },
        { roll_no: '105', enrollment_no: 'ENR20240105', name: 'Kabir Mehta', branch: 'Computer Engineering', semester: 5, section: 'A', dob: '2004-09-18', password: 'password123' }
    ];

    for (const st of students) {
        insertStudent.run(st.roll_no, st.enrollment_no, st.name, st.branch, st.semester, st.section, st.dob, st.password);
    }

    // Retrieve inserted students and subjects for foreign key mapping
    const studentRows = db.prepare('SELECT id, roll_no, name FROM students ORDER BY roll_no ASC').all();
    const subjectRows = db.prepare('SELECT id, code, name FROM subjects').all();
    const dbmsSub = subjectRows.find(s => s.code === 'CS501');
    const osSub = subjectRows.find(s => s.code === 'CS502');
    const cnSub = subjectRows.find(s => s.code === 'CS503');

    // 4. Seed Historical Attendance Sessions & Records
    const insertSession = db.prepare(`
        INSERT INTO attendance_sessions (session_uuid, branch, semester, section, subject_id, faculty_id, date, slot)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertRecord = db.prepare(`
        INSERT INTO attendance_records (session_id, student_id, status, remarks)
        VALUES (?, ?, ?, ?)
    `);

    const historicalSessions = [
        {
            subject: dbmsSub.id,
            date: '2026-09-15',
            slot: '09:00 AM - 10:00 AM',
            statuses: { '101': 'P', '102': 'P', '103': 'P', '104': 'P', '105': 'P' }
        },
        {
            subject: dbmsSub.id,
            date: '2026-09-18',
            slot: '09:00 AM - 10:00 AM',
            statuses: { '101': 'P', '102': 'P', '103': 'A', '104': 'P', '105': 'A' }
        },
        {
            subject: dbmsSub.id,
            date: '2026-09-22',
            slot: '09:00 AM - 10:00 AM',
            statuses: { '101': 'P', '102': 'P', '103': 'A', '104': 'P', '105': 'P' }
        },
        {
            subject: dbmsSub.id,
            date: '2026-09-25',
            slot: '09:00 AM - 10:00 AM',
            statuses: { '101': 'P', '102': 'P', '103': 'A', '104': 'P', '105': 'A' }
        },
        {
            subject: dbmsSub.id,
            date: '2026-09-29',
            slot: '09:00 AM - 10:00 AM',
            statuses: { '101': 'P', '102': 'P', '103': 'P', '104': 'A', '105': 'A' }
        },
        {
            subject: dbmsSub.id,
            date: '2026-10-02',
            slot: '09:00 AM - 10:00 AM',
            statuses: { '101': 'P', '102': 'P', '103': 'A', '104': 'P', '105': 'P' }
        },
        {
            subject: osSub.id,
            date: '2026-09-16',
            slot: '10:00 AM - 11:00 AM',
            statuses: { '101': 'P', '102': 'P', '103': 'P', '104': 'P', '105': 'P' }
        },
        {
            subject: osSub.id,
            date: '2026-09-23',
            slot: '10:00 AM - 11:00 AM',
            statuses: { '101': 'P', '102': 'P', '103': 'A', '104': 'P', '105': 'A' }
        },
        {
            subject: osSub.id,
            date: '2026-09-30',
            slot: '10:00 AM - 11:00 AM',
            statuses: { '101': 'P', '102': 'P', '103': 'A', '104': 'P', '105': 'A' }
        },
        {
            subject: cnSub.id,
            date: '2026-09-17',
            slot: '11:15 AM - 12:15 PM',
            statuses: { '101': 'P', '102': 'P', '103': 'P', '104': 'P', '105': 'P' }
        },
        {
            subject: cnSub.id,
            date: '2026-09-24',
            slot: '11:15 AM - 12:15 PM',
            statuses: { '101': 'P', '102': 'P', '103': 'A', '104': 'A', '105': 'A' }
        },
        {
            subject: cnSub.id,
            date: '2026-10-01',
            slot: '11:15 AM - 12:15 PM',
            statuses: { '101': 'P', '102': 'P', '103': 'P', '104': 'P', '105': 'P' }
        }
    ];

    for (const sess of historicalSessions) {
        const uuid = crypto.randomUUID();
        insertSession.run(
            uuid,
            'Computer Engineering',
            5,
            'A',
            sess.subject,
            'FAC101',
            sess.date,
            sess.slot
        );

        const sessionRow = db.prepare('SELECT id FROM attendance_sessions WHERE session_uuid = ?').get(uuid);

        for (const st of studentRows) {
            const status = sess.statuses[st.roll_no] || 'P';
            insertRecord.run(sessionRow.id, st.id, status, '');
        }
    }

    console.log(`Database seeded successfully!`);
}

if (require.main === module) {
    seedDatabase();
}

module.exports = { seedDatabase };
