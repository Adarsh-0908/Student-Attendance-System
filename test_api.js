const assert = require('assert');
const http = require('http');
const app = require('./server');

const server = app.listen(3344, async () => {
    console.log('Testing server running on port 3344...');
    try {
        await runAllTests();
        console.log('====================================');
        console.log('✅ ALL API TESTS PASSED SUCCESSFULLY!');
        console.log('====================================');
    } catch (e) {
        console.error('❌ Test failed:', e);
        process.exitCode = 1;
    } finally {
        server.close();
    }
});

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const req = http.request({
            hostname: 'localhost',
            port: 3344,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
            }
        }, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const isJson = (res.headers['content-type'] || '').includes('application/json');
                const data = isJson ? JSON.parse(buffer.toString('utf8')) : buffer;
                resolve({ status: res.statusCode, headers: res.headers, data });
            });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function runAllTests() {
    console.log('\n--- 1. Testing Faculty Login ---');
    const facRes = await request('POST', '/api/auth/faculty-login', {
        faculty_id_or_email: 'FAC101',
        department: 'CSE',
        password: 'password123'
    });
    assert.strictEqual(facRes.status, 200, 'Faculty login should return 200');
    assert.strictEqual(facRes.data.faculty.name, 'Dr. Rajesh Sharma');
    console.log('✓ Faculty Login OK:', facRes.data.faculty.name);

    console.log('\n--- 2. Testing Student Login (Safe: Aarav) ---');
    const stu1Res = await request('POST', '/api/auth/student-login', {
        roll_no: '101',
        branch: 'CSE',
        semester: 5,
        password: 'password123'
    });
    assert.strictEqual(stu1Res.status, 200, 'Student login should return 200');
    assert.strictEqual(stu1Res.data.student.name, 'Aarav Sharma');
    console.log('✓ Student Login OK:', stu1Res.data.student.name);

    console.log('\n--- 3. Testing Student Dashboard (Safe vs Shortage) ---');
    const dash1 = await request('GET', `/api/student/dashboard?student_id=${stu1Res.data.student.id}`);
    assert.strictEqual(dash1.status, 200);
    console.log(`✓ Aarav Overall Attendance: ${dash1.data.overall.percentage}% | Eligible: ${dash1.data.overall.is_eligible}`);
    assert.strictEqual(dash1.data.overall.is_eligible, true, 'Aarav should be eligible (>=75%)');

    const dashRohan = await request('GET', '/api/student/dashboard?enrollment_no=ENR20240103');
    assert.strictEqual(dashRohan.status, 200);
    console.log(`✓ Rohan Overall Attendance: ${dashRohan.data.overall.percentage}% | Eligible: ${dashRohan.data.overall.is_eligible} | Needed for 75%: ${dashRohan.data.overall.classes_needed_for_75}`);
    assert.strictEqual(dashRohan.data.overall.is_eligible, false, 'Rohan should be under 75% warning');
    assert.ok(dashRohan.data.overall.classes_needed_for_75 > 0, 'Classes needed for 75% should be calculated');

    console.log('\n--- 4. Testing Professor Roster Fetch ---');
    const optionsRes = await request('GET', '/api/classes/options?faculty_id=FAC101');
    const subjectId = optionsRes.data.subjects[0].id;
    const rosterRes = await request('GET', `/api/roster?branch=CSE&semester=5&section=A&subject_id=${subjectId}&date=2026-10-05&slot=09:00%20AM%20-%2010:00%20AM`);
    assert.strictEqual(rosterRes.status, 200);
    assert.strictEqual(rosterRes.data.students.length, 5, 'Should have 5 students');
    console.log('✓ Roster fetched 5 students successfully');

    console.log('\n--- 5. Testing Attendance Submit & Duplicate Detection ---');
    const newDate = '2026-10-05';
    const newSlot = '02:00 PM - 03:00 PM';
    
    // First submission
    const submitRes1 = await request('POST', '/api/attendance/submit', {
        branch: 'CSE',
        semester: 5,
        section: 'A',
        subject_id: subjectId,
        faculty_id: 'FAC101',
        date: newDate,
        slot: newSlot,
        records: rosterRes.data.students.map(s => ({
            student_id: s.id,
            status: s.roll_no === '103' ? 'A' : 'P'
        })),
        overwrite: false
    });
    assert.strictEqual(submitRes1.status, 200);
    console.log('✓ Attendance submitted successfully, turnout:', submitRes1.data.summary.turnout + '%');

    // Duplicate check without overwrite flag -> should return 409 DUPLICATE_SESSION
    const duplicateRes = await request('POST', '/api/attendance/submit', {
        branch: 'CSE',
        semester: 5,
        section: 'A',
        subject_id: subjectId,
        faculty_id: 'FAC101',
        date: newDate,
        slot: newSlot,
        records: rosterRes.data.students.map(s => ({ student_id: s.id, status: 'P' })),
        overwrite: false
    });
    assert.strictEqual(duplicateRes.status, 409, 'Duplicate submission should return 409');
    console.log('✓ Duplicate session protection works as expected (409 Conflict returned)');

    // Overwrite submission with overwrite = true
    const overwriteRes = await request('POST', '/api/attendance/submit', {
        branch: 'CSE',
        semester: 5,
        section: 'A',
        subject_id: subjectId,
        faculty_id: 'FAC101',
        date: newDate,
        slot: newSlot,
        records: rosterRes.data.students.map(s => ({ student_id: s.id, status: 'P' })),
        overwrite: true
    });
    assert.strictEqual(overwriteRes.status, 200);
    assert.strictEqual(overwriteRes.data.isUpdate, true);
    console.log('✓ Overwrite with confirmation flag works as expected (isUpdate: true)');

    console.log('\n--- 6. Testing Interactive Cumulative Attendance Matrix ---');
    const matrixRes = await request('GET', `/api/attendance/matrix?branch=CSE&semester=5&section=A&subject_id=${subjectId}`);
    assert.strictEqual(matrixRes.status, 200);
    assert.ok(matrixRes.data.sessions.length >= 7, 'Should reflect the newly added session');
    console.log(`✓ Cumulative Matrix reflects ${matrixRes.data.sessions.length} sessions across ${matrixRes.data.studentRows.length} students`);

    console.log('\n--- 7. Testing Excel (.xlsx) Export Stream ---');
    const excelRes = await request('GET', `/api/attendance/export-excel?branch=CSE&semester=5&section=A&subject_id=${subjectId}`);
    assert.strictEqual(excelRes.status, 200);
    assert.ok(excelRes.headers['content-type'].includes('spreadsheetml'), 'Content type should be Excel');
    assert.ok(excelRes.data.length > 5000, 'Excel buffer size should be valid');
    console.log(`✓ Excel Register generated: ${excelRes.data.length} bytes, Content-Disposition: ${excelRes.headers['content-disposition']}`);
}
