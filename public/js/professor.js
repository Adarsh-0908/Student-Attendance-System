/**
 * College Attendance Management System - Professor / Faculty Workflow
 */

const ProfessorApp = (function () {
    let faculty = null;
    let classOptions = null;
    let currentRoster = [];
    let isExistingSession = false;
    let pendingSubmissionPayload = null;

    async function loadDashboard() {
        const session = JSON.parse(localStorage.getItem('attendance_user') || 'null');
        if (!session || session.userType !== 'faculty') {
            window.App.showLogin();
            return;
        }

        faculty = session.faculty;
        document.getElementById('prof-header-name').textContent = faculty.name;
        document.getElementById('prof-header-dept').textContent = `${faculty.designation} • Dept. of ${faculty.department}`;
        document.getElementById('prof-header-id').textContent = `Faculty ID: ${faculty.faculty_id}`;

        // Default Date to today
        const todayIso = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('class-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = todayIso;
        }

        // Fetch Options & Populate Selectors
        await fetchClassOptions();
        setupEventListeners();

        // Initial Roster Load
        loadRoster();
    }

    async function fetchClassOptions() {
        try {
            const res = await fetch(`/api/classes/options?faculty_id=${faculty.faculty_id}`);
            const data = await res.json();
            classOptions = data;

            // Populate Subjects
            const subjectSelect = document.getElementById('class-subject');
            subjectSelect.innerHTML = data.subjects.map(s => `
                <option value="${s.id}" data-branch="${s.branch}" data-sem="${s.semester}">
                    ${s.code} - ${s.name}
                </option>
            `).join('');

            // Select default matching subject if available
            filterSubjectsByClass();
        } catch (err) {
            console.error('Error fetching class options:', err);
            toast.error('Failed to load class and subject options.');
        }
    }

    function filterSubjectsByClass() {
        if (!classOptions) return;
        const branch = document.getElementById('class-branch').value;
        const sem = Number(document.getElementById('class-sem').value);
        const subjectSelect = document.getElementById('class-subject');

        const matchingSubjects = classOptions.subjects.filter(s => s.branch === branch && s.semester === sem);

        if (matchingSubjects.length > 0) {
            subjectSelect.innerHTML = matchingSubjects.map(s => `
                <option value="${s.id}">${s.code} - ${s.name}</option>
            `).join('');
        } else {
            subjectSelect.innerHTML = classOptions.subjects.map(s => `
                <option value="${s.id}">${s.code} - ${s.name} (${s.branch}-S${s.semester})</option>
            `).join('');
        }
    }

    function setupEventListeners() {
        // Change listeners for class selectors
        document.getElementById('class-branch').addEventListener('change', () => {
            filterSubjectsByClass();
            loadRoster();
        });
        document.getElementById('class-sem').addEventListener('change', () => {
            filterSubjectsByClass();
            loadRoster();
        });
        document.getElementById('class-sec').addEventListener('change', loadRoster);
        document.getElementById('class-subject').addEventListener('change', loadRoster);
        document.getElementById('class-date').addEventListener('change', loadRoster);
        document.getElementById('class-slot').addEventListener('change', loadRoster);

        // Search input
        const searchInput = document.getElementById('roster-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                filterRosterDisplay(e.target.value);
            });
        }

        // Quick Actions
        document.getElementById('btn-mark-all-p').addEventListener('click', () => {
            markAll('P');
            toast.info('Marked all students as Present [P].');
        });

        document.getElementById('btn-mark-all-a').addEventListener('click', () => {
            markAll('A');
            toast.warning('Marked all students as Absent [A].');
        });

        // Submit & Sync
        document.getElementById('btn-submit-attendance').addEventListener('click', handleSubmitAttendance);

        // Overwrite Modal Confirm
        document.getElementById('btn-confirm-overwrite').addEventListener('click', async () => {
            closeDuplicateModal();
            if (pendingSubmissionPayload) {
                await executeSubmission(pendingSubmissionPayload, true);
            }
        });

        document.getElementById('btn-cancel-overwrite').addEventListener('click', closeDuplicateModal);

        // Excel Export
        document.getElementById('btn-export-excel').addEventListener('click', handleExportExcel);

        // Interactive Matrix Modal
        document.getElementById('btn-view-matrix').addEventListener('click', loadAttendanceMatrix);
        document.getElementById('btn-close-matrix').addEventListener('click', closeMatrixModal);
    }

    async function loadRoster() {
        const branch = document.getElementById('class-branch').value;
        const semester = document.getElementById('class-sem').value;
        const section = document.getElementById('class-sec').value;
        const subject_id = document.getElementById('class-subject').value;
        const date = document.getElementById('class-date').value;
        const slot = document.getElementById('class-slot').value;

        if (!subject_id) return;

        const rosterLoading = document.getElementById('roster-loading');
        const rosterContainer = document.getElementById('roster-container');

        if (rosterLoading) rosterLoading.classList.remove('hidden');

        try {
            const url = `/api/roster?branch=${branch}&semester=${semester}&section=${section}&subject_id=${subject_id}&date=${date}&slot=${encodeURIComponent(slot)}`;
            const res = await fetch(url);
            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error || 'Failed to load roster.');
                return;
            }

            currentRoster = data.students;
            isExistingSession = data.isExistingSession;

            const sessionBadge = document.getElementById('existing-session-indicator');
            if (isExistingSession) {
                sessionBadge.classList.remove('hidden');
                sessionBadge.innerHTML = `
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        Existing Session Loaded (Editing)
                    </span>
                `;
            } else {
                sessionBadge.classList.add('hidden');
            }

            renderRoster();
            updateLiveSummary();
        } catch (err) {
            console.error('Error loading roster:', err);
            toast.error('Network error loading roster.');
        } finally {
            if (rosterLoading) rosterLoading.classList.add('hidden');
        }
    }

    function renderRoster() {
        const tbody = document.getElementById('roster-tbody');
        if (!tbody) return;

        if (currentRoster.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-6 py-12 text-center text-slate-500">
                        <p class="font-medium">No students enrolled in this section.</p>
                        <p class="text-xs text-slate-400 mt-1">Check selected Branch, Semester, and Section.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = currentRoster.map((student, idx) => {
            const status = student.status || 'P';
            return `
                <tr class="roster-row hover:bg-slate-50/70 border-b border-slate-100 last:border-0 transition-colors" data-student-id="${student.id}" data-name="${student.name.toLowerCase()}" data-roll="${student.roll_no}">
                    <td class="px-4 py-3.5 whitespace-nowrap">
                        <div class="flex items-center gap-2.5">
                            <span class="w-7 h-7 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold flex items-center justify-center">
                                ${student.roll_no}
                            </span>
                            <span class="font-mono text-xs text-slate-500 hidden sm:inline">${student.enrollment_no}</span>
                        </div>
                    </td>
                    <td class="px-4 py-3.5">
                        <div class="font-semibold text-slate-900 text-sm">${student.name}</div>
                        <div class="text-xs text-slate-400 sm:hidden">Roll: ${student.roll_no} • ${student.enrollment_no}</div>
                    </td>
                    <td class="px-4 py-3.5 text-center">
                        <div class="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200/80 gap-1" role="group">
                            <button type="button" 
                                    class="status-btn status-btn-p px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${status === 'P' ? 'active' : 'text-slate-600 hover:text-slate-900'}"
                                    onclick="ProfessorApp.setStatus(${student.id}, 'P')">
                                Present
                            </button>
                            <button type="button" 
                                    class="status-btn status-btn-a px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${status === 'A' ? 'active' : 'text-slate-600 hover:text-slate-900'}"
                                    onclick="ProfessorApp.setStatus(${student.id}, 'A')">
                                Absent
                            </button>
                        </div>
                    </td>
                    <td class="px-4 py-3.5 hidden md:table-cell">
                        <input type="text" 
                               placeholder="Optional remarks..." 
                               value="${student.remarks || ''}"
                               class="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white"
                               onchange="ProfessorApp.setRemarks(${student.id}, this.value)" />
                    </td>
                </tr>
            `;
        }).join('');
    }

    function setStatus(studentId, newStatus) {
        const student = currentRoster.find(s => s.id === studentId);
        if (student) {
            student.status = newStatus;
            updateRowButtons(studentId, newStatus);
            updateLiveSummary();
        }
    }

    function setRemarks(studentId, remarks) {
        const student = currentRoster.find(s => s.id === studentId);
        if (student) {
            student.remarks = remarks;
        }
    }

    function updateRowButtons(studentId, status) {
        const row = document.querySelector(`tr[data-student-id="${studentId}"]`);
        if (!row) return;

        const btnP = row.querySelector('.status-btn-p');
        const btnA = row.querySelector('.status-btn-a');

        btnP.classList.toggle('active', status === 'P');
        btnA.classList.toggle('active', status === 'A');
    }

    function markAll(status) {
        currentRoster.forEach(student => {
            student.status = status;
            updateRowButtons(student.id, status);
        });
        updateLiveSummary();
    }

    function updateLiveSummary() {
        const total = currentRoster.length;
        let present = 0;
        let absent = 0;

        currentRoster.forEach(s => {
            if (s.status === 'P') present++;
            else absent++;
        });

        const turnout = total > 0 ? ((present / total) * 100).toFixed(0) : 0;

        const elTotal = document.getElementById('summary-total');
        const elPresent = document.getElementById('summary-present');
        const elAbsent = document.getElementById('summary-absent');
        const elTurnout = document.getElementById('summary-turnout');

        if (elTotal) elTotal.textContent = total;
        if (elPresent) elPresent.textContent = present;
        if (elAbsent) elAbsent.textContent = absent;
        if (elTurnout) elTurnout.textContent = `${turnout}%`;
    }

    function filterRosterDisplay(query) {
        const q = query.trim().toLowerCase();
        const rows = document.querySelectorAll('.roster-row');

        rows.forEach(row => {
            const name = row.getAttribute('data-name');
            const roll = row.getAttribute('data-roll');
            if (!q || name.includes(q) || roll.includes(q)) {
                row.classList.remove('hidden');
            } else {
                row.classList.add('hidden');
            }
        });
    }

    async function handleSubmitAttendance() {
        if (currentRoster.length === 0) {
            toast.warning('No students to mark attendance for.');
            return;
        }

        const branch = document.getElementById('class-branch').value;
        const semester = document.getElementById('class-sem').value;
        const section = document.getElementById('class-sec').value;
        const subject_id = document.getElementById('class-subject').value;
        const date = document.getElementById('class-date').value;
        const slot = document.getElementById('class-slot').value;

        if (!date || !slot) {
            toast.warning('Please select a valid date and lecture slot.');
            return;
        }

        const payload = {
            branch,
            semester: Number(semester),
            section,
            subject_id: Number(subject_id),
            faculty_id: faculty.faculty_id,
            date,
            slot,
            records: currentRoster.map(s => ({
                student_id: s.id,
                status: s.status || 'P',
                remarks: s.remarks || ''
            }))
        };

        // Check for duplicate session if not already in edit mode
        try {
            const checkRes = await fetch('/api/attendance/check-duplicate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ branch, semester, section, subject_id, date, slot })
            });
            const checkData = await checkRes.json();

            if (checkData.exists) {
                pendingSubmissionPayload = payload;
                openDuplicateModal(date, slot);
                return;
            }

            // Normal new submission
            await executeSubmission(payload, false);
        } catch (err) {
            console.error('Error during submission check:', err);
            toast.error('Failed to communicate with server.');
        }
    }

    async function executeSubmission(payload, overwrite) {
        payload.overwrite = overwrite;
        const submitBtn = document.getElementById('btn-submit-attendance');
        const originalText = submitBtn.innerHTML;

        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            Saving & Syncing...
        `;

        try {
            const res = await fetch('/api/attendance/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                toast.error(data.message || data.error || 'Failed to submit attendance.');
                return;
            }

            isExistingSession = true;
            document.getElementById('existing-session-indicator').classList.remove('hidden');
            toast.success(data.message || 'Attendance submitted & synced successfully!', 'Attendance Saved');
        } catch (err) {
            console.error('Submission error:', err);
            toast.error('Failed to submit attendance.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    function openDuplicateModal(date, slot) {
        const modal = document.getElementById('duplicate-modal');
        const desc = document.getElementById('duplicate-modal-desc');
        desc.textContent = `Attendance for this lecture slot (${slot}) on ${date} is already recorded in the system. Updating will overwrite the existing records.`;
        modal.classList.remove('hidden');
    }

    function closeDuplicateModal() {
        const modal = document.getElementById('duplicate-modal');
        modal.classList.add('hidden');
    }

    function handleExportExcel() {
        const branch = document.getElementById('class-branch').value;
        const semester = document.getElementById('class-sem').value;
        const section = document.getElementById('class-sec').value;
        const subject_id = document.getElementById('class-subject').value;

        if (!subject_id) {
            toast.warning('Please select a subject to export register.');
            return;
        }

        const exportUrl = `/api/attendance/export-excel?branch=${branch}&semester=${semester}&section=${section}&subject_id=${subject_id}`;
        
        // Trigger browser download
        const a = document.createElement('a');
        a.href = exportUrl;
        a.setAttribute('download', '');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        toast.success('Cumulative Attendance Register downloaded (.xlsx)', 'Excel Exported');
    }

    async function loadAttendanceMatrix() {
        const branch = document.getElementById('class-branch').value;
        const semester = document.getElementById('class-sem').value;
        const section = document.getElementById('class-sec').value;
        const subject_id = document.getElementById('class-subject').value;

        if (!subject_id) return;

        const modal = document.getElementById('matrix-modal');
        const container = document.getElementById('matrix-content');
        modal.classList.remove('hidden');
        container.innerHTML = '<div class="p-8 text-center text-slate-500 font-medium">Loading register matrix...</div>';

        try {
            const res = await fetch(`/api/attendance/matrix?branch=${branch}&semester=${semester}&section=${section}&subject_id=${subject_id}`);
            const data = await res.json();

            if (!res.ok) {
                container.innerHTML = `<div class="p-8 text-center text-rose-500 font-medium">${data.error || 'Failed to load matrix.'}</div>`;
                return;
            }

            renderMatrixTable(data);
        } catch (err) {
            console.error('Matrix error:', err);
            container.innerHTML = `<div class="p-8 text-center text-rose-500 font-medium">Network error loading attendance matrix.</div>`;
        }
    }

    function renderMatrixTable(data) {
        const container = document.getElementById('matrix-content');
        const sessions = data.sessions || [];
        const studentRows = data.studentRows || [];

        if (sessions.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center text-slate-500 font-medium">
                    No sessions recorded yet for ${data.subject ? data.subject.code : 'this subject'}.
                </div>
            `;
            return;
        }

        let html = `
            <div class="overflow-x-auto max-h-[70vh] border border-slate-200 rounded-xl">
                <table class="w-full text-left text-xs border-collapse">
                    <thead class="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                        <tr>
                            <th class="px-3 py-2.5 font-bold text-slate-700 uppercase tracking-wider sticky left-0 bg-slate-50">Roll No</th>
                            <th class="px-3 py-2.5 font-bold text-slate-700 uppercase tracking-wider sticky left-14 bg-slate-50">Student Name</th>
                            ${sessions.map(s => `
                                <th class="px-3 py-2 text-center font-bold text-slate-600 border-l border-slate-200 whitespace-nowrap">
                                    <div>${s.date}</div>
                                    <div class="text-[10px] text-slate-400 font-normal">${s.slot.split(' - ')[0]}</div>
                                </th>
                            `).join('')}
                            <th class="px-3 py-2.5 text-center font-bold text-slate-700 uppercase tracking-wider border-l border-slate-200 bg-slate-100">Total</th>
                            <th class="px-3 py-2.5 text-center font-bold text-slate-700 uppercase tracking-wider bg-slate-100">Attended</th>
                            <th class="px-3 py-2.5 text-center font-bold text-slate-700 uppercase tracking-wider bg-slate-100">%</th>
                            <th class="px-3 py-2.5 text-center font-bold text-slate-700 uppercase tracking-wider bg-slate-100">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 bg-white">
        `;

        studentRows.forEach(sr => {
            const isEligible = sr.isEligible;
            html += `
                <tr class="hover:bg-slate-50/80 transition-colors">
                    <td class="px-3 py-2.5 font-bold text-slate-800 sticky left-0 bg-white border-r border-slate-100">${sr.student.roll_no}</td>
                    <td class="px-3 py-2.5 font-medium text-slate-900 sticky left-14 bg-white border-r border-slate-100 whitespace-nowrap">${sr.student.name}</td>
                    ${sr.history.map(h => {
                        let badge = '-';
                        if (h.status === 'P') badge = '<span class="font-bold text-emerald-600">P</span>';
                        else if (h.status === 'A') badge = '<span class="font-bold text-rose-500">A</span>';
                        return `<td class="px-3 py-2 text-center border-l border-slate-100 font-mono">${badge}</td>`;
                    }).join('')}
                    <td class="px-3 py-2.5 text-center font-medium text-slate-600 border-l border-slate-200 bg-slate-50/50">${sr.totalClasses}</td>
                    <td class="px-3 py-2.5 text-center font-bold text-slate-800 bg-slate-50/50">${sr.attendedClasses}</td>
                    <td class="px-3 py-2.5 text-center font-extrabold ${isEligible ? 'text-emerald-600' : 'text-rose-600'} bg-slate-50/50">${sr.percentage}%</td>
                    <td class="px-3 py-2.5 text-center bg-slate-50/50">
                        <span class="inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${isEligible ? 'badge-present' : 'badge-absent'}">
                            ${isEligible ? 'Eligible' : 'Shortage'}
                        </span>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    }

    function closeMatrixModal() {
        document.getElementById('matrix-modal').classList.add('hidden');
    }

    return {
        loadDashboard,
        setStatus,
        setRemarks
    };
})();

window.ProfessorApp = ProfessorApp;
