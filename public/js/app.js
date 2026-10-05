/**
 * College Attendance Management System - Faculty Portal App Controller
 * Manages Faculty Auth (Sign In / Sign Up), views, live clock
 */

const App = (function () {
    let currentAuthMode = 'signin'; // 'signin' or 'signup'

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
        const tabSignin = document.getElementById('tab-btn-signin');
        const tabSignup = document.getElementById('tab-btn-signup');
        const formSignin = document.getElementById('form-faculty-login');
        const formSignup = document.getElementById('form-faculty-signup');

        if (!tabSignin || !tabSignup || !formSignin || !formSignup) return;

        tabSignin.addEventListener('click', (e) => {
            if (e) e.preventDefault();
            currentAuthMode = 'signin';
            tabSignin.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-white text-slate-900 shadow-sm cursor-pointer';
            tabSignup.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition-all text-slate-500 hover:text-slate-900 cursor-pointer';

            formSignin.classList.remove('hidden');
            formSignin.style.display = 'block';
            formSignup.classList.add('hidden');
            formSignup.style.display = 'none';
        });

        tabSignup.addEventListener('click', (e) => {
            if (e) e.preventDefault();
            currentAuthMode = 'signup';
            tabSignup.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-white text-slate-900 shadow-sm cursor-pointer';
            tabSignin.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition-all text-slate-500 hover:text-slate-900 cursor-pointer';

            formSignup.classList.remove('hidden');
            formSignup.style.display = 'block';
            formSignin.classList.add('hidden');
            formSignin.style.display = 'none';
        });
    }

    function setupForms() {
        // Faculty Sign In Form
        const formSignin = document.getElementById('form-faculty-login');
        if (formSignin) {
            formSignin.addEventListener('submit', async (e) => {
                e.preventDefault();
                const emailEl = document.getElementById('faculty-email');
                const deptEl = document.getElementById('faculty-dept');
                const passEl = document.getElementById('faculty-password');

                const email = emailEl ? emailEl.value : '';
                const department = deptEl ? deptEl.value : '';
                const password = passEl ? passEl.value : '';

                const submitBtn = formSignin.querySelector('button[type="submit"]');
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
                    toast.error('Network error during login.');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Sign In to Faculty Portal';
                    }
                }
            });
        }

        // Faculty Sign Up Form
        const formSignup = document.getElementById('form-faculty-signup');
        if (formSignup) {
            formSignup.addEventListener('submit', async (e) => {
                e.preventDefault();
                const nameEl = document.getElementById('signup-name');
                const emailEl = document.getElementById('signup-email');
                const deptEl = document.getElementById('signup-dept');
                const subBranchEl = document.getElementById('signup-subbranch');
                const desigEl = document.getElementById('signup-designation');
                const passEl = document.getElementById('signup-password');

                const name = nameEl ? nameEl.value : '';
                const email = emailEl ? emailEl.value : '';
                const department = deptEl ? deptEl.value : '';
                const sub_branch = (subBranchEl ? subBranchEl.value : '') || 'A';
                const designation = (desigEl ? desigEl.value : '') || 'Professor';
                const password = passEl ? passEl.value : '';

                if (!name || !email || !password) {
                    toast.error('Please fill in your name, email, and password.');
                    return;
                }

                const submitBtn = formSignup.querySelector('button[type="submit"]');
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
                    toast.error('Network error during registration.');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Register Faculty Account';
                    }
                }
            });
        }

        // Logout Buttons
        document.querySelectorAll('.btn-logout').forEach(btn => {
            btn.addEventListener('click', handleLogout);
        });
    }

    function checkSession() {
        const session = JSON.parse(localStorage.getItem('attendance_user') || 'null');
        if (session && session.userType === 'faculty' && session.faculty) {
            showProfessorView();
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
        const navProfile = document.getElementById('nav-user-profile');
        if (navProfile) {
            navProfile.classList.add('hidden');
            navProfile.style.display = 'none';
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

    function handleLogout() {
        localStorage.removeItem('attendance_user');
        toast.info('You have been signed out.');
        showLogin();
    }

    return {
        init,
        showLogin,
        showProfessorView
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

window.App = App;
