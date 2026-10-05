/**
 * College Attendance Management System - Main App Controller
 * Manages Auth flow, views, live clock, and quick demo credentials
 */

const App = (function () {
    let currentAuthTab = 'student'; // 'student' or 'faculty'

    function init() {
        setupAuthTabs();
        setupForms();
        setupClock();
        checkSession();
    }

    function setupClock() {
        const updateClock = () => {
            const clockEl = document.getElementById('live-clock');
            if (!clockEl) return;
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-US', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
            const timeStr = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
            clockEl.textContent = `${dateStr} • ${timeStr}`;
        };
        updateClock();
        setInterval(updateClock, 1000);
    }

    function setupAuthTabs() {
        const tabStudent = document.getElementById('tab-btn-student');
        const tabFaculty = document.getElementById('tab-btn-faculty');
        const formStudent = document.getElementById('form-student-login');
        const formFaculty = document.getElementById('form-faculty-login');

        if (!tabStudent || !tabFaculty) return;

        tabStudent.addEventListener('click', () => {
            currentAuthTab = 'student';
            tabStudent.classList.add('bg-white', 'text-slate-900', 'shadow-sm');
            tabStudent.classList.remove('text-slate-500');
            tabFaculty.classList.remove('bg-white', 'text-slate-900', 'shadow-sm');
            tabFaculty.classList.add('text-slate-500');

            formStudent.classList.remove('hidden');
            formFaculty.classList.add('hidden');
        });

        tabFaculty.addEventListener('click', () => {
            currentAuthTab = 'faculty';
            tabFaculty.classList.add('bg-white', 'text-slate-900', 'shadow-sm');
            tabFaculty.classList.remove('text-slate-500');
            tabStudent.classList.remove('bg-white', 'text-slate-900', 'shadow-sm');
            tabStudent.classList.add('text-slate-500');

            formFaculty.classList.remove('hidden');
            formStudent.classList.add('hidden');
        });
    }

    function setupForms() {
        // Student Form
        const formStudent = document.getElementById('form-student-login');
        formStudent.addEventListener('submit', async (e) => {
            e.preventDefault();
            const roll_no = document.getElementById('student-roll').value;
            const branch = document.getElementById('student-branch').value;
            const semester = document.getElementById('student-semester').value;
            const password = document.getElementById('student-password').value;

            const submitBtn = formStudent.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Authenticating...';

            try {
                const res = await fetch('/api/auth/student-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roll_no, branch, semester, password })
                });
                const data = await res.json();

                if (!res.ok) {
                    toast.error(data.error || 'Student authentication failed.');
                    return;
                }

                localStorage.setItem('attendance_user', JSON.stringify(data));
                toast.success(`Welcome ${data.student.name}`, 'Login Successful');
                showStudentView();
            } catch (err) {
                console.error('Student login error:', err);
                toast.error('Network error during login.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In to Portal';
            }
        });

        // Faculty Form
        const formFaculty = document.getElementById('form-faculty-login');
        formFaculty.addEventListener('submit', async (e) => {
            e.preventDefault();
            const faculty_id_or_email = document.getElementById('faculty-id').value;
            const department = document.getElementById('faculty-dept').value;
            const password = document.getElementById('faculty-password').value;

            const submitBtn = formFaculty.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Authenticating...';

            try {
                const res = await fetch('/api/auth/faculty-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ faculty_id_or_email, department, password })
                });
                const data = await res.json();

                if (!res.ok) {
                    toast.error(data.error || 'Faculty authentication failed.');
                    return;
                }

                localStorage.setItem('attendance_user', JSON.stringify(data));
                toast.success(`Welcome ${data.faculty.name}`, 'Faculty Authenticated');
                showProfessorView();
            } catch (err) {
                console.error('Faculty login error:', err);
                toast.error('Network error during login.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In to Portal';
            }
        });

        // Logout Buttons
        document.querySelectorAll('.btn-logout').forEach(btn => {
            btn.addEventListener('click', handleLogout);
        });
    }

    function checkSession() {
        const session = JSON.parse(localStorage.getItem('attendance_user') || 'null');
        if (session && session.userType === 'student') {
            showStudentView();
        } else if (session && session.userType === 'faculty') {
            showProfessorView();
        } else {
            showLogin();
        }
    }

    function showLogin() {
        document.getElementById('auth-view').classList.remove('hidden');
        document.getElementById('student-view').classList.add('hidden');
        document.getElementById('professor-view').classList.add('hidden');
        document.getElementById('nav-user-profile').classList.add('hidden');
    }

    function showStudentView() {
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('student-view').classList.remove('hidden');
        document.getElementById('professor-view').classList.add('hidden');
        document.getElementById('nav-user-profile').classList.remove('hidden');

        const session = JSON.parse(localStorage.getItem('attendance_user') || 'null');
        if (session && session.student) {
            document.getElementById('nav-user-name').textContent = session.student.name;
            document.getElementById('nav-user-role').textContent = `Student (${session.student.roll_no})`;
        }
        window.StudentApp.loadDashboard();
    }

    function showProfessorView() {
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('student-view').classList.add('hidden');
        document.getElementById('professor-view').classList.remove('hidden');
        document.getElementById('nav-user-profile').classList.remove('hidden');

        const session = JSON.parse(localStorage.getItem('attendance_user') || 'null');
        if (session && session.faculty) {
            document.getElementById('nav-user-name').textContent = session.faculty.name;
            document.getElementById('nav-user-role').textContent = `Faculty (${session.faculty.faculty_id})`;
        }
        window.ProfessorApp.loadDashboard();
    }

    function handleLogout() {
        localStorage.removeItem('attendance_user');
        toast.info('You have been signed out.');
        showLogin();
    }

    // Quick Credential Fillers for Instant Demo Testing
    function fillDemo(type, id) {
        if (type === 'faculty') {
            document.getElementById('tab-btn-faculty').click();
            document.getElementById('faculty-id').value = 'FAC101';
            document.getElementById('faculty-dept').value = 'CSE';
            document.getElementById('faculty-password').value = 'password123';
            toast.info('Filled credentials for Dr. Rajesh Sharma (Faculty)');
        } else if (type === 'student-safe') {
            document.getElementById('tab-btn-student').click();
            document.getElementById('student-roll').value = '101'; // Aarav Sharma (~88%)
            document.getElementById('student-branch').value = 'CSE';
            document.getElementById('student-semester').value = '5';
            document.getElementById('student-password').value = 'password123';
            toast.info('Filled credentials for Aarav Sharma (Safe attendance ≥ 75%)');
        } else if (type === 'student-warning') {
            document.getElementById('tab-btn-student').click();
            document.getElementById('student-roll').value = '103'; // Rohan Gupta (~60%)
            document.getElementById('student-branch').value = 'CSE';
            document.getElementById('student-semester').value = '5';
            document.getElementById('student-password').value = 'password123';
            toast.warning('Filled credentials for Rohan Gupta (Warning attendance < 75%)');
        }
    }

    return {
        init,
        showLogin,
        showStudentView,
        showProfessorView,
        fillDemo
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

window.App = App;
