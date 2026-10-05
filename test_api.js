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
    try {
        require('./database/seed').seedDatabase();
    } catch (e) {
        console.warn('Seed reset warning:', e);
    }

    console.log('\n--- 1. Testing Faculty Login ---');
    const facRes = await request('POST', '/api/auth/faculty-login', {
        email: 'dr.sharma@apex.edu',
        department: 'Computer Engineering',
        password: 'password123'
    });
    assert.strictEqual(facRes.status, 200, 'Faculty login should return 200');
    assert.strictEqual(facRes.data.faculty.name, 'Dr. Rajesh Sharma');
    console.log('✓ Faculty Login OK:', facRes.data.faculty.name);

    console.log('\n--- 2. Testing Faculty Sign Up ---');
    const signupRes = await request('POST', '/api/auth/faculty-signup', {
        name: 'Dr. Test Professor',
        email: `test.prof.${Date.now()}@apex.edu`,
        department: 'ICT',
        sub_branch: 'B',
        designation: 'Assistant Professor',
        password: 'password123'
    });
    assert.strictEqual(signupRes.status, 200, 'Faculty signup should return 200');
    assert.strictEqual(signupRes.data.faculty.name, 'Dr. Test Professor');
    console.log('✓ Faculty Sign Up OK:', signupRes.data.faculty.name);

    console.log('\n--- 3. Testing Add Subject API ---');
    const addSubRes = await request('POST', '/api/subjects/add', {
        code: 'CS501',
        name: 'Database Management Systems',
        branch: 'Computer Engineering',
        semester: 5,
        faculty_id: 'FAC101'
    });
    assert.strictEqual(addSubRes.status, 200, 'Add subject should return 200');
    console.log('✓ Subject added OK:', addSubRes.data.message);

    console.log('\n--- 4. Testing Add Student API ---');
    const addStuRes = await request('POST', '/api/students/add', {
        roll_no: '101',
        enrollment_no: 'ENR20240101',
        name: 'Aarav Sharma',
        branch: 'Computer Engineering',
        semester: 5,
        section: 'A'
    });
    assert.strictEqual(addStuRes.status, 200, 'Add student should return 200');
    console.log('✓ Student added OK:', addStuRes.data.message);

    console.log('\n--- 5. Testing Professor Roster Fetch ---');
    const optionsRes = await request('GET', '/api/classes/options?faculty_id=FAC101');
    const subjectId = optionsRes.data.subjects[0].id;
    const rosterRes = await request('GET', `/api/roster?branch=Computer%20Engineering&semester=5&section=A&subject_id=${subjectId}&date=2026-10-05&slot=09:00%20AM%20-%2010:00%20AM`);
    assert.strictEqual(rosterRes.status, 200);
    assert.strictEqual(rosterRes.data.students.length, 1, 'Should have 1 added student');
    console.log('✓ Roster fetched added student successfully');

    console.log('\n--- 6. Testing Attendance Submit & Duplicate Detection ---');
    const newDate = '2026-10-05';
    const newSlot = '02:00 PM - 03:00 PM';
    
    // First submission
    const submitRes1 = await request('POST', '/api/attendance/submit', {
        branch: 'Computer Engineering',
        semester: 5,
        section: 'A',
        subject_id: subjectId,
        faculty_id: 'FAC101',
        date: newDate,
        slot: newSlot,
        records: rosterRes.data.students.map(s => ({
            student_id: s.id,
            status: 'P'
        })),
        overwrite: false
    });
    assert.strictEqual(submitRes1.status, 200);
    console.log('✓ Attendance submitted successfully, turnout:', submitRes1.data.summary.turnout + '%');

    // Duplicate check without overwrite flag -> should return 409 DUPLICATE_SESSION
    const duplicateRes = await request('POST', '/api/attendance/submit', {
        branch: 'Computer Engineering',
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
        branch: 'Computer Engineering',
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

    console.log('\n--- 7. Testing Interactive Cumulative Attendance Matrix ---');
    const matrixRes = await request('GET', `/api/attendance/matrix?branch=Computer%20Engineering&semester=5&section=A&subject_id=${subjectId}`);
    assert.strictEqual(matrixRes.status, 200);
    assert.ok(matrixRes.data.sessions.length >= 1, 'Should reflect the newly added session');
    console.log(`✓ Cumulative Matrix reflects ${matrixRes.data.sessions.length} sessions across ${matrixRes.data.studentRows.length} students`);

    console.log('\n--- 8. Testing Excel (.xlsx) Export Stream ---');
    const excelRes = await request('GET', `/api/attendance/export-excel?branch=Computer%20Engineering&semester=5&section=A&subject_id=${subjectId}`);
    assert.strictEqual(excelRes.status, 200);
    assert.ok(excelRes.headers['content-type'].includes('spreadsheetml'), 'Content type should be Excel');
    assert.ok(excelRes.data.length > 3000, 'Excel buffer size should be valid');
    console.log(`✓ Excel Register generated: ${excelRes.data.length} bytes, Content-Disposition: ${excelRes.headers['content-disposition']}`);
}
