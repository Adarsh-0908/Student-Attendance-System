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

    // Verify newly registered faculty receives subject options!
    const newFacOptions = await request('GET', `/api/classes/options?faculty_id=${signupRes.data.faculty.faculty_id}`);
    assert.strictEqual(newFacOptions.status, 200);
    assert.ok(newFacOptions.data.subjects.length > 0, 'New faculty should have available subjects');
    console.log(`✓ New Faculty subjects populated: ${newFacOptions.data.subjects.length} subjects found`);

    console.log('\n--- 2b. Testing Student Sign Up & Login ---');
    const studentRoll = '999' + Math.floor(Math.random() * 1000);
    const stuSignupRes = await request('POST', '/api/auth/student-signup', {
        name: 'Test Student New',
        roll_no: studentRoll,
        enrollment_no: 'ENR' + studentRoll,
        branch: 'Computer Engineering',
        semester: 5,
        section: 'A',
        dob: '2004-06-12',
        password: 'password123'
    });
    assert.strictEqual(stuSignupRes.status, 200, 'Student signup should return 200');
    assert.strictEqual(stuSignupRes.data.student.name, 'Test Student New');
    console.log('✓ Student Sign Up OK:', stuSignupRes.data.student.name);

    const stuLoginRes = await request('POST', '/api/auth/student-login', {
        roll_no: studentRoll,
        branch: 'Computer Engineering',
        semester: 5,
        password: 'password123'
    });
    assert.strictEqual(stuLoginRes.status, 200, 'Student login should return 200');
    assert.strictEqual(stuLoginRes.data.student.roll_no, studentRoll);
    console.log('✓ Student Login OK for newly registered student:', stuLoginRes.data.student.roll_no);

    console.log('\n--- 2c. Testing /signup SPA Route ---');
    const spaRes = await request('GET', '/signup');
    assert.strictEqual(spaRes.status, 200);
    assert.ok(spaRes.data.toString().includes('<!DOCTYPE html>'), 'SPA route should return index.html');
    console.log('✓ Direct /signup route returns 200 index.html');

    console.log('\n--- 3. Testing Professor Roster Fetch ---');
    const optionsRes = await request('GET', '/api/classes/options?faculty_id=FAC101');
    const dbmsSubject = optionsRes.data.subjects.find(s => s.code === 'CS501') || optionsRes.data.subjects[0];
    const subjectId = dbmsSubject.id;
    const rosterRes = await request('GET', `/api/roster?branch=Computer%20Engineering&semester=5&section=A&subject_id=${subjectId}&date=2026-10-05&slot=09:00%20AM%20-%2010:00%20AM`);
    assert.strictEqual(rosterRes.status, 200);
    assert.ok(rosterRes.data.students.length >= 5, 'Should have at least 5 students');
    console.log(`✓ Roster fetched ${rosterRes.data.students.length} students successfully for ${dbmsSubject.code}`);

    console.log('\n--- 4. Testing Attendance Submit & Duplicate Detection ---');
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
            status: s.roll_no === '103' ? 'A' : 'P'
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

    console.log('\n--- 5. Testing Interactive Cumulative Attendance Matrix ---');
    const matrixRes = await request('GET', `/api/attendance/matrix?branch=Computer%20Engineering&semester=5&section=A&subject_id=${subjectId}`);
    assert.strictEqual(matrixRes.status, 200);
    assert.ok(matrixRes.data.sessions.length >= 7, 'Should reflect the newly added session');
    console.log(`✓ Cumulative Matrix reflects ${matrixRes.data.sessions.length} sessions across ${matrixRes.data.studentRows.length} students`);

    console.log('\n--- 6. Testing Excel (.xlsx) Export Stream ---');
    const excelRes = await request('GET', `/api/attendance/export-excel?branch=Computer%20Engineering&semester=5&section=A&subject_id=${subjectId}`);
    assert.strictEqual(excelRes.status, 200);
    assert.ok(excelRes.headers['content-type'].includes('spreadsheetml'), 'Content type should be Excel');
    assert.ok(excelRes.data.length > 5000, 'Excel buffer size should be valid');
    console.log(`✓ Excel Register generated: ${excelRes.data.length} bytes, Content-Disposition: ${excelRes.headers['content-disposition']}`);
}
