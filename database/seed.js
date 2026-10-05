const { initDb } = require('./db');

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

    // Seed 1 Default Faculty (No fake students or subjects)
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

    console.log('Database seeded with default Admin Faculty only. No fake students or subjects added.');
}

if (require.main === module) {
    seedDatabase();
}

module.exports = { seedDatabase };
