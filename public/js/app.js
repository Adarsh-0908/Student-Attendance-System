/**
 * College Attendance Management System - Main App Controller
 * Manages Auth (Sign In / Sign Up for Faculty & Students), views, live clock
 */

const App = (function () {

    function init() {
        setupClock();
        setupForms();
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

    function switchTab(mode) {
        if (window.switchAuthTab) window.switchAuthTab(mode);
    }

    function switchRole(role) {
        if (window.switchAuthRole) window.switchAuthRole(role);
    }

    function setupForms() {
        // 1. Faculty Sign In Form
        const formFacLogin = document.getElementById('form-faculty-login');
        if (formFacLogin) {
            formFacLogin.onsubmit = async (e) => {
                e.preventDefault();
                const emailEl = document.getElementById('faculty-email');
                const deptEl = document.getElementById('faculty-dept');
                const passEl = document.getElementById('faculty-password');

                const email = emailEl ? emailEl.value : '';
                const department = deptEl ? deptEl.value : '';
                const password = passEl ? passEl.value : '';

                const submitBtn = formFacLogin.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Authenticating...';
                }

                try {
                    const res = await fetch('/api/auth/faculty-login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, department, password })
                    });
                    const data = await res.json();

                    if (!res.ok) {
                        toast.error(data.error || 'Faculty authentication failed.');
                        return;
                    }

                    localStorage.setItem('attendance_user', JSON.stringify(data));
                    toast.success(`Welcome back, ${data.faculty.name}`, 'Faculty Authenticated');
                    showProfessorView();
                } catch (err) {
                    console.error('Faculty login error:', err);
                    toast.error('Network error during faculty login.');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Sign In to Faculty Portal';
                    }
                }
            };
        }

        // 2. Faculty Sign Up Form
        const formFacSignup = document.getElementById('form-faculty-signup');
        if (formFacSignup) {
            formFacSignup.onsubmit = async (e) => {
                e.preventDefault();
                const nameEl = document.getElementById('signup-name');
                const emailEl = document.getElementById('signup-email');
                const deptEl = document.getElementById('signup-dept');
                const subBranchEl = document.getElementById('signup-subbranch');
                const desigEl = document.getElementById('signup-designation');
                const passEl = document.getElementById('signup-password');

                const name = nameEl ? nameEl.value : '';
                const email = emailEl ? emailEl.value : '';
                const department = deptEl ? deptEl.value : 'Computer Engineering';
                const sub_branch = (subBranchEl ? subBranchEl.value : '') || 'A';
                const designation = (desigEl ? desigEl.value : '') || 'Professor';
                const password = passEl ? passEl.value : '';

                if (!name || !email || !password) {
                    toast.error('Please fill in your name, email, and password.');
                    return;
                }

                const submitBtn = formFacSignup.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Creating Account...';
                }

                try {
                    const res = await fetch('/api/auth/faculty-signup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, email, department, sub_branch, designation, password })
                    });
                    const data = await res.json();

                    if (!res.ok) {
                        toast.error(data.error || 'Faculty registration failed.');
                        return;
                    }

                    localStorage.setItem('attendance_user', JSON.stringify(data));
                    toast.success(`Account created! Welcome, ${data.faculty.name}`, 'Registration Successful');
                    showProfessorView();
                } catch (err) {
                    console.error('Faculty signup error:', err);
                    toast.error('Network error during faculty registration.');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Register Faculty Account';
                    }
                }
            };
        }

        // 3. Student Sign In Form
        const formStuLogin = document.getElementById('form-student-login');
        if (formStuLogin) {
            formStuLogin.onsubmit = async (e) => {
                e.preventDefault();
                const rollEl = document.getElementById('student-roll');
                const branchEl = document.getElementById('student-branch');
                const semEl = document.getElementById('student-sem');
                const passEl = document.getElementById('student-password');

                const roll_no = rollEl ? rollEl.value : '';
                const branch = branchEl ? branchEl.value : '';
                const semester = semEl ? semEl.value : '5';
                const password = passEl ? passEl.value : '';

                if (!roll_no || !branch || !semester || !password) {
                    toast.error('All student login fields are required.');
                    return;
                }

                const submitBtn = formStuLogin.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Authenticating...';
                }

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
                    toast.success(`Welcome back, ${data.student.name}`, 'Student Authenticated');
                    showStudentView();
                } catch (err) {
                    console.error('Student login error:', err);
                    toast.error('Network error during student login.');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Sign In to Student Portal';
                    }
                }
            };
        }

        // 4. Student Sign Up Form
        const formStuSignup = document.getElementById('form-student-signup');
        if (formStuSignup) {
            formStuSignup.onsubmit = async (e) => {
                e.preventDefault();
                const nameEl = document.getElementById('student-signup-name');
                const rollEl = document.getElementById('student-signup-roll');
                const enrollEl = document.getElementById('student-signup-enroll');
                const branchEl = document.getElementById('student-signup-branch');
                const semEl = document.getElementById('student-signup-sem');
                const secEl = document.getElementById('student-signup-section');
                const dobEl = document.getElementById('student-signup-dob');
                const passEl = document.getElementById('student-signup-password');

                const name = nameEl ? nameEl.value : '';
                const roll_no = rollEl ? rollEl.value : '';
                const enrollment_no = (enrollEl ? enrollEl.value : '') || ('ENR' + roll_no);
                const branch = branchEl ? branchEl.value : 'Computer Engineering';
                const semester = semEl ? semEl.value : '5';
                const section = (secEl ? secEl.value : '') || 'A';
                const dob = (dobEl ? dobEl.value : '') || '2004-01-01';
                const password = passEl ? passEl.value : '';

                if (!name || !roll_no || !branch || !semester || !password) {
                    toast.error('Please fill in your name, roll no, branch, semester, and password.');
                    return;
                }

                const submitBtn = formStuSignup.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Registering Student...';
                }

                try {
                    const res = await fetch('/api/auth/student-signup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, roll_no, enrollment_no, branch, semester, section, dob, password })
                    });
                    const data = await res.json();

                    if (!res.ok) {
                        toast.error(data.error || 'Student registration failed.');
                        return;
                    }

                    localStorage.setItem('attendance_user', JSON.stringify(data));
                    toast.success(`Account created! Welcome, ${data.student.name}`, 'Registration Successful');
                    showStudentView();
                } catch (err) {
                    console.error('Student signup error:', err);
                    toast.error('Network error during student registration.');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Register Student Account';
                    }
                }
            };
        }

        // Logout Buttons
        document.querySelectorAll('.btn-logout').forEach(btn => {
            btn.onclick = handleLogout;
        });
    }

    function checkSession() {
        const path = (window.location.pathname || '').toLowerCase();
        const hash = (window.location.hash || '').toLowerCase();
        const search = (window.location.search || '').toLowerCase();

        // If explicitly requested signup or register via URL, always show auth signup view
        if (path.includes('signup') || path.includes('register') || hash.includes('signup') || hash.includes('register') || search.includes('signup')) {
            showLogin();
            if (window.switchAuthTab) window.switchAuthTab('signup');
            return;
        }

        const session = JSON.parse(localStorage.getItem('attendance_user') || 'null');
        if (session && session.userType === 'faculty' && session.faculty) {
            showProfessorView();
        } else if (session && session.userType === 'student' && session.student) {
            showStudentView();
        } else {
            showLogin();
        }
    }

    function showLogin() {
        const authView = document.getElementById('auth-view');
        if (authView) {
            authView.classList.remove('hidden');
            authView.style.display = 'block';
        }
        const profView = document.getElementById('professor-view');
        if (profView) {
            profView.classList.add('hidden');
            profView.style.display = 'none';
        }
        const studentView = document.getElementById('student-view');
        if (studentView) {
            studentView.classList.add('hidden');
            studentView.style.display = 'none';
        }
        const navProfile = document.getElementById('nav-user-profile');
        if (navProfile) {
            navProfile.classList.add('hidden');
            navProfile.style.display = 'none';
        }

        if (window.updateAuthDisplay) {
            window.updateAuthDisplay();
        }
    }

    function showProfessorView() {
        const session = JSON.parse(localStorage.getItem('attendance_user') || 'null');
        if (!session || !session.faculty) {
            showLogin();
            return;
        }

        const authView = document.getElementById('auth-view');
        if (authView) {
            authView.classList.add('hidden');
            authView.style.display = 'none';
        }
        const studentView = document.getElementById('student-view');
        if (studentView) {
            studentView.classList.add('hidden');
            studentView.style.display = 'none';
        }
        const profView = document.getElementById('professor-view');
        if (profView) {
            profView.classList.remove('hidden');
            profView.style.display = 'block';
        }
        const navProfile = document.getElementById('nav-user-profile');
        if (navProfile) {
            navProfile.classList.remove('hidden');
            navProfile.style.display = 'flex';
        }

        const faculty = session.faculty;
        const navName = document.getElementById('nav-user-name');
        if (navName) navName.textContent = faculty.name;
        const navRole = document.getElementById('nav-user-role');
        if (navRole) navRole.textContent = faculty.designation || 'Faculty';

        const nameEl = document.getElementById('prof-header-name');
        if (nameEl) nameEl.textContent = faculty.name;

        const deptEl = document.getElementById('prof-header-dept');
        if (deptEl) deptEl.textContent = `${faculty.designation || 'Professor'} • Dept. of ${faculty.department}`;

        const subBranchEl = document.getElementById('prof-header-subbranch');
        if (subBranchEl) {
            subBranchEl.textContent = `Sub-branch: ${faculty.sub_branch || 'A'}`;
        }

        const branchSel = document.getElementById('class-branch');
        if (branchSel && faculty.department) {
            branchSel.value = faculty.department;
        }
        const secInput = document.getElementById('class-sec');
        if (secInput && faculty.sub_branch) {
            secInput.value = faculty.sub_branch;
        }

        if (window.ProfessorApp && window.ProfessorApp.loadDashboard) {
            window.ProfessorApp.loadDashboard();
        }
    }

    function showStudentView() {
        const session = JSON.parse(localStorage.getItem('attendance_user') || 'null');
        if (!session || !session.student) {
            showLogin();
            return;
        }

        const authView = document.getElementById('auth-view');
        if (authView) {
            authView.classList.add('hidden');
            authView.style.display = 'none';
        }
        const profView = document.getElementById('professor-view');
        if (profView) {
            profView.classList.add('hidden');
            profView.style.display = 'none';
        }
        const studentView = document.getElementById('student-view');
        if (studentView) {
            studentView.classList.remove('hidden');
            studentView.style.display = 'block';
        }
        const navProfile = document.getElementById('nav-user-profile');
        if (navProfile) {
            navProfile.classList.remove('hidden');
            navProfile.style.display = 'flex';
        }

        const student = session.student;
        const navName = document.getElementById('nav-user-name');
        if (navName) navName.textContent = student.name;
        const navRole = document.getElementById('nav-user-role');
        if (navRole) navRole.textContent = `Student • Roll ${student.roll_no}`;

        if (window.StudentApp && window.StudentApp.loadDashboard) {
            window.StudentApp.loadDashboard();
        }
    }

    function handleLogout() {
        localStorage.removeItem('attendance_user');
        toast.info('You have been signed out.');
        showLogin();
    }

    return {
        init,
        switchTab,
        switchRole,
        showLogin,
        showProfessorView,
        showStudentView
    };
})();

// Immediate initialization if DOM is ready, or on DOMContentLoaded
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    App.init();
} else {
    document.addEventListener('DOMContentLoaded', () => {
        App.init();
    });
}

window.App = App;
