/**
 * College Attendance Management System - Student Dashboard Logic
 */

const StudentApp = (function () {
    let studentData = null;
    let selectedSubjectFilter = 'ALL';

    async function loadDashboard() {
        const studentSession = JSON.parse(localStorage.getItem('attendance_user') || 'null');
        if (!studentSession || studentSession.userType !== 'student') {
            window.App.showLogin();
            return;
        }

        const student = studentSession.student;
        document.getElementById('student-header-name').textContent = student.name;
        document.getElementById('student-header-roll').textContent = `Roll: ${student.roll_no} | ${student.enrollment_no}`;
        document.getElementById('student-header-branch').textContent = `${student.branch} • Semester ${student.semester} (Sec ${student.section})`;

        try {
            const res = await fetch(`/api/student/dashboard?student_id=${student.id}`);
            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error || 'Failed to load dashboard.');
                return;
            }

            studentData = data;
            renderOverview(data);
            renderSubjectBreakdown(data.subject_breakdown);
            renderRecentLogs(data.recent_logs);
            populateSubjectFilter(data.subject_breakdown);
        } catch (err) {
            console.error('Student dashboard error:', err);
            toast.error('Network error loading student metrics.');
        }
    }

    function renderOverview(data) {
        const overall = data.overall;
        const pct = overall.percentage;
        const isEligible = overall.is_eligible;

        // Visual Percentage Display
        const pctElement = document.getElementById('student-overall-pct');
        pctElement.textContent = `${pct}%`;

        // Update SVG Circular Gauge
        const circle = document.getElementById('student-progress-circle');
        if (circle) {
            const radius = circle.r.baseVal.value;
            const circumference = 2 * Math.PI * radius;
            circle.style.strokeDasharray = `${circumference} ${circumference}`;
            const offset = circumference - (pct / 100) * circumference;
            circle.style.strokeDashoffset = offset;

            if (isEligible) {
                circle.setAttribute('stroke', '#10b981'); // Emerald
                pctElement.className = 'text-4xl font-extrabold text-emerald-600 tracking-tight';
            } else {
                circle.setAttribute('stroke', '#ef4444'); // Red
                pctElement.className = 'text-4xl font-extrabold text-rose-600 tracking-tight';
            }
        }

        // Metrics Counters
        document.getElementById('metric-total-lectures').textContent = overall.total_lectures;
        document.getElementById('metric-attended-lectures').textContent = overall.attended_lectures;
        document.getElementById('metric-absent-lectures').textContent = overall.absent_lectures;

        // Status Banner & Recommendation
        const bannerContainer = document.getElementById('student-status-banner');
        if (isEligible) {
            bannerContainer.className = 'p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 flex items-start gap-3.5 transition-all';
            bannerContainer.innerHTML = `
                <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <div>
                    <h4 class="text-sm font-bold text-emerald-900">Good Standing & Examination Eligible (≥ 75%)</h4>
                    <p class="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                        Your attendance meets university examination regulations.
                        ${overall.margin_safe_classes > 0
                            ? `You have a safety buffer of <strong>${overall.margin_safe_classes} lecture${overall.margin_safe_classes > 1 ? 's' : ''}</strong> that you can afford to miss while remaining above 75%.`
                            : `You are right around the 75% threshold. Ensure you do not miss upcoming lectures.`}
                    </p>
                </div>
            `;
        } else {
            bannerContainer.className = 'p-4 rounded-xl border border-rose-200 bg-rose-50/80 flex items-start gap-3.5 transition-all';
            bannerContainer.innerHTML = `
                <div class="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
                <div>
                    <h4 class="text-sm font-bold text-rose-900">Critical: Attendance Shortage (< 75%)</h4>
                    <p class="text-xs text-rose-800 mt-0.5 leading-relaxed">
                        Your attendance is below the mandatory 75% threshold. You are at risk of being detained from semester exams.
                        <strong>Action Needed:</strong> You must attend the next <strong>${overall.classes_needed_for_75} consecutive class${overall.classes_needed_for_75 > 1 ? 'es' : ''}</strong> to restore eligibility.
                    </p>
                </div>
            `;
        }
    }

    function renderSubjectBreakdown(subjects) {
        const tbody = document.getElementById('student-subject-tbody');
        if (!tbody) return;

        if (!subjects || subjects.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-4 py-8 text-center text-sm text-slate-500">
                        No subject records found for this semester.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = subjects.map(sub => {
            const isSafe = sub.percentage >= 75;
            const barColor = isSafe ? 'bg-emerald-500' : 'bg-rose-500';
            const badgeClass = isSafe ? 'badge-present' : 'badge-absent';
            const statusLabel = isSafe ? 'Eligible' : 'Shortage';

            return `
                <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0">
                    <td class="px-4 py-3.5">
                        <span class="font-mono text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">${sub.code}</span>
                    </td>
                    <td class="px-4 py-3.5">
                        <div class="font-semibold text-slate-800 text-sm">${sub.name}</div>
                    </td>
                    <td class="px-4 py-3.5 text-center text-sm font-medium text-slate-700">
                        ${sub.total_lectures}
                    </td>
                    <td class="px-4 py-3.5 text-center text-sm font-semibold text-slate-900">
                        ${sub.attended_lectures}
                    </td>
                    <td class="px-4 py-3.5">
                        <div class="flex items-center gap-2.5">
                            <div class="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div class="${barColor} h-full rounded-full transition-all duration-500" style="width: ${Math.min(sub.percentage, 100)}%"></div>
                            </div>
                            <span class="text-xs font-bold ${isSafe ? 'text-emerald-700' : 'text-rose-600'} w-12 text-right">
                                ${sub.percentage}%
                            </span>
                        </div>
                    </td>
                    <td class="px-4 py-3.5 text-center">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClass}">
                            ${statusLabel}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function populateSubjectFilter(subjects) {
        const filterSelect = document.getElementById('student-log-subject-filter');
        if (!filterSelect) return;

        filterSelect.innerHTML = '<option value="ALL">All Subjects</option>' +
            subjects.map(s => `<option value="${s.code}">${s.code} - ${s.name}</option>`).join('');

        filterSelect.onchange = (e) => {
            selectedSubjectFilter = e.target.value;
            if (studentData) {
                renderRecentLogs(studentData.recent_logs);
            }
        };
    }

    function renderRecentLogs(logs) {
        const tbody = document.getElementById('student-logs-tbody');
        if (!tbody) return;

        let filteredLogs = logs || [];
        if (selectedSubjectFilter !== 'ALL') {
            filteredLogs = filteredLogs.filter(l => l.subject_code === selectedSubjectFilter);
        }

        if (filteredLogs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-4 py-8 text-center text-sm text-slate-500">
                        No recent attendance activity matching the filter.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filteredLogs.map(log => {
            let statusBadge = '';
            if (log.status === 'P') {
                statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold badge-present">Present</span>';
            } else {
                statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold badge-absent">Absent</span>';
            }

            return `
                <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0 text-sm">
                    <td class="px-4 py-3 whitespace-nowrap">
                        <div class="font-medium text-slate-800">${log.date}</div>
                        <div class="text-xs text-slate-400">${log.slot}</div>
                    </td>
                    <td class="px-4 py-3">
                        <div class="font-medium text-slate-800">${log.subject_name}</div>
                        <div class="font-mono text-xs text-slate-400">${log.subject_code}</div>
                    </td>
                    <td class="px-4 py-3 text-center">
                        ${statusBadge}
                    </td>
                    <td class="px-4 py-3 text-xs text-slate-500">
                        ${log.remarks || 'Regular Lecture'}
                    </td>
                </tr>
            `;
        }).join('');
    }

    return {
        loadDashboard
    };
})();

window.StudentApp = StudentApp;
