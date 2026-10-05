/**
 * College Attendance Management System - Professor / Faculty Workflow
 */

const ProfessorApp = (function () {
    let faculty = null;
    let classOptions = null;
    let currentRoster = [];
    let isExistingSession = false;
    let pendingSubmissionPayload = null;

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function getValue(id) {
        const el = document.getElementById(id);
        return el ? el.value : '';
    }

    function addListener(id, event, handler) {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    }

    async function loadDashboard() {
        const session = JSON.parse(localStorage.getItem('attendance_user') || 'null');
        if (!session || session.userType !== 'faculty') {
            if (window.App && window.App.showLogin) window.App.showLogin();
            return;
        }

        faculty = session.faculty;
        setText('prof-header-name', faculty.name);
        setText('prof-header-dept', `${faculty.designation || 'Professor'} • Dept. of ${faculty.department}`);
        setText('prof-header-subbranch', `Sub-branch: ${faculty.sub_branch || 'A'}`);
        setText('prof-header-id', `Faculty ID: ${faculty.faculty_id || ''}`);

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
            const branch = getValue('class-branch') || (faculty ? faculty.department : 'Computer Engineering');
            const sem = getValue('class-sem') || '5';
            const res = await fetch(`/api/classes/options?branch=${encodeURIComponent(branch)}&semester=${sem}`);
            const data = await res.json();
            classOptions = data;

            filterSubjectsByClass();
        } catch (err) {
            console.error('Error fetching class options:', err);
            toast.error('Failed to load class and subject options.');
        }
    }

    function filterSubjectsByClass() {
        if (!classOptions) return;
        const branch = getValue('class-branch');
        const sem = Number(getValue('class-sem'));
        const subjectSelect = document.getElementById('class-subject');

        const matchingSubjects = (classOptions.subjects || []).filter(s => s.branch === branch && s.semester === sem);

        if (subjectSelect) {
            if (matchingSubjects.length > 0) {
                subjectSelect.innerHTML = matchingSubjects.map(s => `
                    <option value="${s.id}">${s.code} - ${s.name}</option>
                `).join('');
            } else if (classOptions.subjects && classOptions.subjects.length > 0) {
                subjectSelect.innerHTML = classOptions.subjects.map(s => `
                    <option value="${s.id}">${s.code} - ${s.name} (${s.branch}-S${s.semester})</option>
                `).join('');
            } else {
                subjectSelect.innerHTML = `<option value="">No subjects found. Click "+ Add Subject" above.</option>`;
            }
        }

        renderManagedSubjects(matchingSubjects.length > 0 ? matchingSubjects : (classOptions.subjects || []));
    }

    function renderManagedSubjects(subjects) {
        const listEl = document.getElementById('managed-subjects-list');
        if (!listEl) return;

        if (!subjects || subjects.length === 0) {
            listEl.innerHTML = '<p class="text-xs text-slate-400 py-2">No subjects configured for this Branch & Semester. Click "+ Add Subject" above to add one.</p>';
            return;
        }

        listEl.innerHTML = subjects.map(s => `
            <div class="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
                <div>
                    <span class="font-bold text-slate-900">${s.code}</span>
                    <span class="text-slate-600 font-medium ml-1.5">${s.name}</span>
                </div>
                <button onclick="ProfessorApp.deleteSubject(${s.id})" type="button" class="px-2 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-all cursor-pointer">
                    🗑️ Delete
                </button>
            </div>
        `).join('');
    }

    async function deleteSubject(subjectId) {
        if (!confirm('Are you sure you want to delete this subject?')) return;
        try {
            const res = await fetch('/api/subjects/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: subjectId })
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || 'Failed to delete subject.');
                return;
            }
            toast.success(data.message || 'Subject deleted.');
            await fetchClassOptions();
        } catch (err) {
            console.error('Delete subject error:', err);
            toast.error('Network error deleting subject.');
        }
    }

    async function deleteStudent(studentId) {
        if (!confirm('Are you sure you want to remove this student from the class roster?')) return;
        try {
            const res = await fetch('/api/students/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: studentId })
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || 'Failed to remove student.');
                return;
            }
            toast.success(data.message || 'Student removed.');
            await loadRoster();
        } catch (err) {
            console.error('Delete student error:', err);
            toast.error('Network error removing student.');
        }
    }

    function setupEventListeners() {
        addListener('class-branch', 'change', async () => { await fetchClassOptions(); loadRoster(); });
        addListener('class-sem', 'change', async () => { await fetchClassOptions(); loadRoster(); });
        addListener('class-sec', 'input', loadRoster);
        addListener('class-sec', 'change', loadRoster);
        addListener('class-subject', 'change', loadRoster);
        addListener('class-date', 'change', loadRoster);
        addListener('class-slot', 'change', loadRoster);

        const searchInput = document.getElementById('roster-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                filterRosterDisplay(e.target.value);
            });
        }

        addListener('btn-mark-all-p', 'click', () => {
            markAll('P');
            toast.info('Marked all students as Present [P].');
        });

        addListener('btn-mark-all-a', 'click', () => {
            markAll('A');
            toast.warning('Marked all students as Absent [A].');
        });

        addListener('btn-submit-attendance', 'click', handleSubmitAttendance);

        addListener('btn-confirm-overwrite', 'click', async () => {
            closeDuplicateModal();
            if (pendingSubmissionPayload) {
                await executeSubmission(pendingSubmissionPayload, true);
            }
        });

        addListener('btn-cancel-overwrite', 'click', closeDuplicateModal);
        addListener('btn-export-excel', 'click', handleExportExcel);
        addListener('btn-view-matrix', 'click', loadAttendanceMatrix);
        addListener('btn-close-matrix', 'click', closeMatrixModal);

        // Add Subject Form Submit Handler
        const formAddSub = document.getElementById('form-add-subject');
        if (formAddSub) {
            formAddSub.onsubmit = async (e) => {
                e.preventDefault();
                const payload = {
                    code: getValue('add-sub-code'),
                    name: getValue('add-sub-name'),
                    branch: getValue('add-sub-branch'),
                    semester: getValue('add-sub-sem'),
                    faculty_id: faculty ? faculty.faculty_id : 'FAC101'
                };
                try {
                    const res = await fetch('/api/subjects/add', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    if (!res.ok) {
                        toast.error(data.error || 'Failed to add subject.');
                        return;
                    }
                    toast.success(data.message || 'Subject added!');
                    const modal = document.getElementById('modal-add-subject');
                    if (modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
                    formAddSub.reset();
                    await fetchClassOptions();
                } catch (err) {
                    console.error('Add subject error:', err);
                    toast.error('Network error adding subject.');
                }
            };
        }

        // Add Student Form Submit Handler
        const formAddStu = document.getElementById('form-add-student');
        if (formAddStu) {
            formAddStu.onsubmit = async (e) => {
                e.preventDefault();
                const payload = {
                    roll_no: getValue('add-stu-roll'),
                    enrollment_no: getValue('add-stu-enr'),
                    name: getValue('add-stu-name'),
                    branch: getValue('add-stu-branch'),
                    semester: getValue('add-stu-sem'),
                    section: getValue('add-stu-sec') || 'A'
                };
                try {
                    const res = await fetch('/api/students/add', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    if (!res.ok) {
                        toast.error(data.error || 'Failed to add student.');
                        return;
                    }
                    toast.success(data.message || 'Student added!');
                    const modal = document.getElementById('modal-add-student');
                    if (modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
                    formAddStu.reset();
                    await loadRoster();
                } catch (err) {
                    console.error('Add student error:', err);
                    toast.error('Network error adding student.');
                }
            };
        }
    }

    async function loadRoster() {
        const branch = getValue('class-branch');
        const semester = getValue('class-sem');
        const section = getValue('class-sec') || 'A';
        const subject_id = getValue('class-subject');
        const date = getValue('class-date');
        const slot = getValue('class-slot');

        if (!branch || !semester || !section) return;

        const rosterLoading = document.getElementById('roster-loading');
        if (rosterLoading) rosterLoading.classList.remove('hidden');

        try {
            const url = `/api/roster?branch=${encodeURIComponent(branch)}&semester=${semester}&section=${encodeURIComponent(section)}&subject_id=${subject_id || ''}&date=${date || ''}&slot=${encodeURIComponent(slot || '')}`;
            const res = await fetch(url);
            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error || 'Failed to fetch student roster.');
                return;
            }

            currentRoster = data.students || [];
            isExistingSession = data.isExistingSession;

            const sessionBadge = document.getElementById('existing-session-indicator');
            if (sessionBadge) {
                if (isExistingSession) {
                    sessionBadge.classList.remove('hidden');
                } else {
                    sessionBadge.classList.add('hidden');
                }
            }

            renderRoster(currentRoster);
            updateSummaryCounters();
        } catch (err) {
            console.error('Roster error:', err);
            toast.error('Network error fetching class roster.');
        } finally {
            if (rosterLoading) rosterLoading.classList.add('hidden');
        }
    }

    function renderRoster(students) {
        const tbody = document.getElementById('roster-tbody');
        if (!tbody) return;

        if (students.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-12 text-center text-slate-500">
                        <p class="font-bold text-sm text-slate-700">No students found for this Branch & Section.</p>
                        <p class="text-xs text-slate-400 mt-1">Click the "+ Add Student" button above to add students to this class roster.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = students.map(student => {
            const status = student.status || 'P';
            return `
                <tr class="roster-row hover:bg-slate-50/70 border-b border-slate-100 last:border-0 transition-colors" data-student-id="${student.id}">
                    <td class="px-4 py-3.5 font-mono text-xs font-semibold text-slate-700">
                        <div class="flex items-center gap-2">
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
                                    class="status-btn status-btn-p px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${status === 'P' ? 'active' : ''}"
                                    onclick="ProfessorApp.setStatus(${student.id}, 'P')">
                                Present [P]
                            </button>
                            <button type="button"
                                    class="status-btn status-btn-a px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${status === 'A' ? 'active' : ''}"
                                    onclick="ProfessorApp.setStatus(${student.id}, 'A')">
                                Absent [A]
                            </button>
                        </div>
                    </td>
                    <td class="px-4 py-3.5 hidden md:table-cell">
                        <input type="text"
                               placeholder="Optional remarks..."
                               value="${student.remarks || ''}"
                               onchange="ProfessorApp.setRemarks(${student.id}, this.value)"
                               class="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                    </td>
                    <td class="px-4 py-3.5 text-center">
                        <button type="button" onclick="ProfessorApp.deleteStudent(${student.id})" class="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-all cursor-pointer" title="Remove Student">
                            🗑️ Remove
                        </button>
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
            updateSummaryCounters();
        }
    }

    function setRemarks(studentId, remarksText) {
        const student = currentRoster.find(s => s.id === studentId);
        if (student) {
            student.remarks = remarksText;
        }
    }

    function updateRowButtons(studentId, status) {
        const row = document.querySelector(`tr[data-student-id="${studentId}"]`);
        if (!row) return;

        const btnP = row.querySelector('.status-btn-p');
        const btnA = row.querySelector('.status-btn-a');

        if (btnP) btnP.classList.toggle('active', status === 'P');
        if (btnA) btnA.classList.toggle('active', status === 'A');
    }

    function markAll(status) {
        currentRoster.forEach(student => {
            student.status = status;
            updateRowButtons(student.id, status);
        });
        updateSummaryCounters();
    }

    function updateSummaryCounters() {
        const total = currentRoster.length;
        let present = 0;
        let absent = 0;

        currentRoster.forEach(s => {
            if (s.status === 'P') present++;
            else if (s.status === 'A') absent++;
        });

        const turnoutPct = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';

        setText('summary-total', total);
        setText('summary-present', present);
        setText('summary-absent', absent);
        setText('summary-turnout', `${turnoutPct}%`);
    }

    async function handleSubmitAttendance() {
        if (!currentRoster || currentRoster.length === 0) {
            toast.error('No student roster loaded to submit.');
            return;
        }

        const branch = getValue('class-branch');
        const semester = getValue('class-sem');
        const section = getValue('class-sec') || 'A';
        const subject_id = getValue('class-subject');
        const date = getValue('class-date');
        const slot = getValue('class-slot');

        const payload = {
            branch,
            semester,
            section,
            subject_id,
            faculty_id: faculty ? faculty.faculty_id : 'FAC101',
            date,
            slot,
            records: currentRoster.map(s => ({
                student_id: s.id,
                status: s.status || 'P',
                remarks: s.remarks || ''
            })),
            overwrite: false
        };

        await executeSubmission(payload, false);
    }

    async function executeSubmission(payload, overwriteFlag) {
        payload.overwrite = overwriteFlag;
        const submitBtn = document.getElementById('btn-submit-attendance');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
        }

        try {
            const res = await fetch('/api/attendance/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.status === 409 && data.error === 'DUPLICATE_SESSION') {
                pendingSubmissionPayload = payload;
                showDuplicateModal(data.message || 'Session already exists for this slot.');
                return;
            }

            if (!res.ok) {
                toast.error(data.error || 'Failed to submit attendance.');
                return;
            }

            const sessionBadge = document.getElementById('existing-session-indicator');
            if (sessionBadge) sessionBadge.classList.remove('hidden');

            isExistingSession = true;
            toast.success(
                `Recorded ${data.summary.present}/${data.summary.total} Present (${data.summary.turnout}% Turnout)`,
                overwriteFlag ? 'Session Updated' : 'Attendance Saved'
            );
        } catch (err) {
            console.error('Submit error:', err);
            toast.error('Network error during attendance submission.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Attendance';
            }
        }
    }

    function showDuplicateModal(message) {
        const modal = document.getElementById('duplicate-modal');
        const desc = document.getElementById('duplicate-modal-desc');
        if (desc) desc.textContent = message;
        if (modal) modal.classList.remove('hidden');
    }

    function closeDuplicateModal() {
        const modal = document.getElementById('duplicate-modal');
        if (modal) modal.classList.add('hidden');
    }

    function handleExportExcel() {
        const branch = getValue('class-branch');
        const semester = getValue('class-sem');
        const section = getValue('class-sec') || 'A';
        const subject_id = getValue('class-subject');

        if (!branch || !semester || !section || !subject_id) {
            toast.error('Please select Branch, Semester, Section, and Subject to export.');
            return;
        }

        const exportUrl = `/api/attendance/export-excel?branch=${encodeURIComponent(branch)}&semester=${semester}&section=${encodeURIComponent(section)}&subject_id=${subject_id}`;
        toast.info('Downloading styled Excel attendance register...');
        window.location.href = exportUrl;
    }

    async function loadAttendanceMatrix() {
        const branch = getValue('class-branch');
        const semester = getValue('class-sem');
        const section = getValue('class-sec') || 'A';
        const subject_id = getValue('class-subject');

        const modal = document.getElementById('matrix-modal');
        const container = document.getElementById('matrix-content');

        if (modal) modal.classList.remove('hidden');
        if (container) container.innerHTML = '<div class="p-8 text-center text-slate-500 font-medium text-xs">Loading register matrix...</div>';

        try {
            const res = await fetch(`/api/attendance/matrix?branch=${encodeURIComponent(branch)}&semester=${semester}&section=${encodeURIComponent(section)}&subject_id=${subject_id}`);
            const data = await res.json();

            if (!res.ok) {
                if (container) container.innerHTML = `<div class="p-8 text-center text-rose-500 font-medium text-xs">${data.error || 'Failed to load matrix.'}</div>`;
                return;
            }

            renderMatrixTable(data);
        } catch (err) {
            console.error('Matrix error:', err);
            if (container) container.innerHTML = '<div class="p-8 text-center text-rose-500 font-medium text-xs">Network error loading attendance matrix.</div>';
        }
    }

    function renderMatrixTable(data) {
        const container = document.getElementById('matrix-content');
        if (!container) return;

        const sessions = data.sessions || [];
        const studentRows = data.studentRows || [];

        if (sessions.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center text-slate-500 font-medium">
                    <p class="text-slate-700 font-bold text-sm">No recorded lecture sessions found.</p>
                    <p class="text-slate-400 text-xs mt-1">Submit attendance for a lecture slot to populate the register matrix.</p>
                </div>
            `;
            return;
        }

        let tableHtml = `
            <div class="overflow-x-auto max-h-[70vh] border border-slate-200 rounded-xl">
                <table class="w-full text-left text-xs border-collapse">
                    <thead class="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                        <tr>
                            <th class="px-3 py-2.5 font-bold text-slate-700 uppercase tracking-wider sticky left-0 bg-slate-50">Roll</th>
                            <th class="px-3 py-2.5 font-bold text-slate-700 uppercase tracking-wider sticky left-14 bg-slate-50">Student Name</th>
                            ${sessions.map(s => `
                                <th class="px-3 py-2 text-center font-bold text-slate-600 border-l border-slate-200 whitespace-nowrap">
                                    <div class="text-slate-900">${s.date}</div>
                                    <div class="text-[10px] text-slate-400 font-normal">${s.slot.split(' - ')[0]}</div>
                                </th>
                            `).join('')}
                            <th class="px-3 py-2.5 text-center font-bold text-slate-700 uppercase tracking-wider border-l border-slate-200 bg-slate-100">Held</th>
                            <th class="px-3 py-2.5 text-center font-bold text-slate-700 uppercase tracking-wider bg-slate-100">Attended</th>
                            <th class="px-3 py-2.5 text-center font-bold text-slate-700 uppercase tracking-wider bg-slate-100">%</th>
                            <th class="px-3 py-2.5 text-center font-bold text-slate-700 uppercase tracking-wider bg-slate-100">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 bg-white">
        `;

        studentRows.forEach(sr => {
            const isEligible = sr.percentage >= 75;
            tableHtml += `
                <tr class="hover:bg-slate-50/80 transition-colors">
                    <td class="px-3 py-2.5 font-bold text-slate-800 sticky left-0 bg-white border-r border-slate-100">${sr.student.roll_no}</td>
                    <td class="px-3 py-2.5 font-medium text-slate-900 sticky left-14 bg-white border-r border-slate-100 whitespace-nowrap">${sr.student.name}</td>
                    ${sessions.map(s => {
                        const h = sr.history.find(item => item.session_id === s.id);
                        let badge = '<span class="text-slate-300">-</span>';
                        if (h) {
                            if (h.status === 'P') badge = '<span class="font-bold text-emerald-600">P</span>';
                            else if (h.status === 'A') badge = '<span class="font-bold text-rose-500">A</span>';
                        }
                        return `<td class="px-3 py-2 text-center border-l border-slate-100 font-mono">${badge}</td>`;
                    }).join('')}
                    <td class="px-3 py-2.5 text-center font-medium text-slate-600 border-l border-slate-200 bg-slate-50/50">${sr.totalHeld}</td>
                    <td class="px-3 py-2.5 text-center font-bold text-slate-800 bg-slate-50/50">${sr.attendedClasses}</td>
                    <td class="px-3 py-2.5 text-center font-extrabold ${isEligible ? 'text-emerald-600' : 'text-rose-600'} bg-slate-50/50">${sr.percentage}%</td>
                    <td class="px-3 py-2.5 text-center bg-slate-50/50">
                        <span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${isEligible ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                            ${isEligible ? 'Eligible' : 'Shortage'}
                        </span>
                    </td>
                </tr>
            `;
        });

        tableHtml += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = tableHtml;
    }

    function closeMatrixModal() {
        const modal = document.getElementById('matrix-modal');
        if (modal) modal.classList.add('hidden');
    }

    return {
        loadDashboard,
        setStatus,
        setRemarks,
        deleteSubject,
        deleteStudent,
        handleExportExcel
    };
})();

window.ProfessorApp = ProfessorApp;
