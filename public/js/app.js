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

        if (!tabSignin || !tabSignup) return;

        tabSignin.addEventListener('click', () => {
            currentAuthMode = 'signin';
            tabSignin.classList.add('bg-white', 'text-slate-900', 'shadow-sm');
            tabSignin.classList.remove('text-slate-500');
            tabSignup.classList.remove('bg-white', 'text-slate-900', 'shadow-sm');
            tabSignup.classList.add('text-slate-500');

            formSignin.classList.remove('hidden');
            formSignup.classList.add('hidden');
        });

        tabSignup.addEventListener('click', () => {
            currentAuthMode = 'signup';
            tabSignup.classList.add('bg-white', 'text-slate-900', 'shadow-sm');
            tabSignup.classList.remove('text-slate-500');
            tabSignin.classList.remove('bg-white', 'text-slate-900', 'shadow-sm');
            tabSignin.classList.add('text-slate-500');

            formSignup.classList.remove('hidden');
            formSignin.classList.add('hidden');
        });
    }

    function setupForms() {
        // Faculty Sign In Form
        const formSignin = document.getElementById('form-faculty-login');
        formSignin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const faculty_id_or_email = document.getElementById('faculty-id').value;
            const department = document.getElementById('faculty-dept').value;
            const password = document.getElementById('faculty-password').value;

            const submitBtn = formSignin.querySelector('button[type="submit"]');
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
                toast.success(`Welcome back, ${data.faculty.name}`, 'Faculty Authenticated');
                showProfessorView();
            } catch (err) {
                console.error('Faculty login error:', err);
                toast.error('Network error during login.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In to Faculty Portal';
            }
        });

        // Faculty Sign Up Form
        const formSignup = document.getElementById('form-faculty-signup');
        formSignup.addEventListener('submit', async (e) => {
            e.preventDefault();
            const faculty_id = document.getElementById('signup-faculty-id').value;
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const department = document.getElementById('signup-dept').value;
            const designation = document.getElementById('signup-designation').value;
            const password = document.getElementById('signup-password').value;

            const submitBtn = formSignup.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Account...';

            try {
                const res = await fetch('/api/auth/faculty-signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ faculty_id, name, email, department, designation, password })
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
                submitBtn.disabled = false;
                submitBtn.textContent = 'Register Faculty Account';
            }
        });

        // Logout Buttons
        document.querySelectorAll('.btn-logout').forEach(btn => {
            btn.addEventListener('click', handleLogout);
        });
    }

    function checkSession() {
        const session = JSON.parse(localStorage.getItem('attendance_user') || 'null');
        if (session && session.userType === 'faculty') {
            showProfessorView();
        } else {
            showLogin();
        }
    }

    function showLogin() {
        document.getElementById('auth-view').classList.remove('hidden');
        document.getElementById('professor-view').classList.add('hidden');
        document.getElementById('nav-user-profile').classList.add('hidden');
    }

    function showProfessorView() {
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('professor-view').classList.remove('hidden');
        document.getElementById('nav-user-profile').classList.remove('hidden');

        const session = JSON.parse(localStorage.getItem('attendance_user') || 'null');
        if (session && session.faculty) {
            document.getElementById('nav-user-name').textContent = session.faculty.name;
            document.getElementById('nav-user-role').textContent = `Faculty (${session.faculty.faculty_id})`;
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
