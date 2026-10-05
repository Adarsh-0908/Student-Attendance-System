const XLSX = require('xlsx');
const { getDb } = require('../database/db');

/**
 * Generates an Enterprise Cumulative Attendance Register Excel Workbook
 * @param {Object} params - { branch, semester, section, subject_id }
 * @returns {Buffer} - Excel file buffer
 */
function generateCumulativeAttendanceExcel({ branch, semester, section, subject_id }) {
    const db = getDb();

    // 1. Fetch Subject & Faculty Metadata
    const subjectQuery = db.prepare(`
        SELECT s.id, s.code, s.name, s.branch, s.semester, s.faculty_id, f.name as faculty_name, f.designation
        FROM subjects s
        LEFT JOIN faculty f ON s.faculty_id = f.faculty_id
        WHERE s.id = ?
    `);
    const subject = subjectQuery.get(subject_id);
    if (!subject) {
        throw new Error('Subject not found');
    }

    // 2. Fetch all students in this class
    const students = db.prepare(`
        SELECT id, roll_no, enrollment_no, name, branch, semester, section
        FROM students
        WHERE branch = ? AND semester = ? AND section = ?
        ORDER BY CAST(roll_no AS INTEGER) ASC, roll_no ASC
    `).all(branch, Number(semester), section);

    // 3. Fetch all attendance sessions for this subject & class, ordered chronologically
    const sessions = db.prepare(`
        SELECT id, session_uuid, date, slot, created_at
        FROM attendance_sessions
        WHERE branch = ? AND semester = ? AND section = ? AND subject_id = ?
        ORDER BY date ASC, slot ASC
    `).all(branch, Number(semester), section, subject_id);

    // 4. Fetch all attendance records for these sessions
    const sessionIds = sessions.map(s => s.id);
    let recordsBySessionAndStudent = {};

    if (sessionIds.length > 0) {
        const placeholders = sessionIds.map(() => '?').join(',');
        const records = db.prepare(`
            SELECT session_id, student_id, status
            FROM attendance_records
            WHERE session_id IN (${placeholders})
        `).all(...sessionIds);

        for (const r of records) {
            if (!recordsBySessionAndStudent[r.session_id]) {
                recordsBySessionAndStudent[r.session_id] = {};
            }
            recordsBySessionAndStudent[r.session_id][r.student_id] = r.status;
        }
    }

    // 5. Build Excel Rows
    const dataRows = [];

    // Header Block
    dataRows.push(['STUDENT ATTENDANCE SYSTEM']);
    dataRows.push(['OFFICIAL CUMULATIVE ATTENDANCE REGISTER - ACADEMIC YEAR 2026-2027']);
    dataRows.push([`Department: ${branch}  |  Semester: ${semester}  |  Section: ${section}`]);
    dataRows.push([`Course / Subject: ${subject.code} - ${subject.name}  |  Faculty In-Charge: ${subject.faculty_name || subject.faculty_id}`]);
    dataRows.push([`Register Generated: ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC  |  Criteria: Mandatory 75.0% Minimum Attendance`]);
    dataRows.push([]); // Spacer row

    // Table Column Headers
    const tableHeaders = ['S.No', 'Roll No', 'Enrollment No', 'Student Name'];
    const sessionDateLabels = sessions.map(s => `${s.date}\n(${s.slot})`);
    tableHeaders.push(...sessionDateLabels);
    tableHeaders.push('Total Classes', 'Classes Attended', 'Attendance %', 'Eligibility Status');

    dataRows.push(tableHeaders);

    // Student Data Rows
    const sessionPresentCounts = new Array(sessions.length).fill(0);

    students.forEach((student, index) => {
        let attendedCount = 0;
        const totalSessions = sessions.length;
        const row = [
            index + 1,
            student.roll_no,
            student.enrollment_no,
            student.name
        ];

        sessions.forEach((session, sIdx) => {
            const status = (recordsBySessionAndStudent[session.id] && recordsBySessionAndStudent[session.id][student.id]) || '-';
            row.push(status);
            if (status === 'P') {
                attendedCount++;
                sessionPresentCounts[sIdx]++;
            }
        });

        const pct = totalSessions > 0 ? (attendedCount / totalSessions) * 100 : 100;
        const isEligible = pct >= 75;

        row.push(
            totalSessions,
            attendedCount,
            `${pct.toFixed(1)}%`,
            isEligible ? 'ELIGIBLE' : 'SHORTAGE (<75%)'
        );

        dataRows.push(row);
    });

    // Summary Statistics Rows at the bottom of the table
    if (sessions.length > 0) {
        dataRows.push([]); // Spacer row

        // Row: Total Present per session
        const totalPresentRow = ['', '', '', 'Total Present:'];
        sessions.forEach((_, sIdx) => {
            totalPresentRow.push(sessionPresentCounts[sIdx]);
        });
        totalPresentRow.push('', '', '', '');
        dataRows.push(totalPresentRow);

        // Row: Turnout Percentage per session
        const turnoutRow = ['', '', '', 'Session Turnout %:'];
        sessions.forEach((_, sIdx) => {
            const turnout = students.length > 0 ? ((sessionPresentCounts[sIdx] / students.length) * 100).toFixed(0) + '%' : '0%';
            turnoutRow.push(turnout);
        });
        turnoutRow.push('', '', '', '');
        dataRows.push(turnoutRow);
    }

    // 6. Create Sheet & Workbook
    const worksheet = XLSX.utils.aoa_to_sheet(dataRows);

    // Column Widths
    const colWidths = [
        { wch: 6 },  // S.No
        { wch: 12 }, // Roll No
        { wch: 16 }, // Enrollment No
        { wch: 24 }  // Student Name
    ];
    sessions.forEach(() => {
        colWidths.push({ wch: 16 }); // Each Date column
    });
    colWidths.push(
        { wch: 14 }, // Total Classes
        { wch: 16 }, // Classes Attended
        { wch: 14 }, // Attendance %
        { wch: 20 }  // Eligibility Status
    );
    worksheet['!cols'] = colWidths;

    // Merge Header Title Rows across table width
    const totalCols = tableHeaders.length;
    worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(totalCols - 1, 3) } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(totalCols - 1, 3) } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: Math.max(totalCols - 1, 3) } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: Math.max(totalCols - 1, 3) } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: Math.max(totalCols - 1, 3) } }
    ];

    const workbook = XLSX.utils.book_new();
    const sheetName = `${subject.code}_Attendance`.substring(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Return binary buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return {
        buffer: excelBuffer,
        filename: `${branch}_Sem${semester}_${section}_${subject.code}_Attendance_Register.xlsx`
    };
}

module.exports = {
    generateCumulativeAttendanceExcel
};
