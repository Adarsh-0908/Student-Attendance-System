# 🎓 Apex College - Attendance Management Web Application

A responsive, high-contrast, minimalist **College Attendance Management System** engineered with a clean UI/UX design philosophy, mobile-first responsive workflows for professors taking attendance in lecture halls, and enterprise-grade cumulative attendance registers exported to styled Excel (`.xlsx`) files.

---

## 🌟 Key Architectural & UI/UX Highlights

1. **Minimalist & Modern Aesthetic**:
   - High-contrast readability, generous whitespace, crisp `1px border-slate-200` containers, soft accent colors (slate, indigo, emerald, rose, amber).
   - Micro-interaction toast notification system for instant feedback on actions (*"Saved"*, *"Attendance Submitted"*, *"Excel Exported"*).
2. **Mobile-First Lecture Hall Workflow**:
   - Engineered for professors walking around lecture halls with a smartphone or tablet.
   - Large, thumb-friendly 2-state segmented status toggles (`[P]`, `[A]`).
   - Sticky live turnout counter bar: `Total | Present | Absent | Turnout %`.
   - Single-click convenience buttons: **"Mark All Present"** & **"Mark All Absent"**.
3. **Accidental Duplicate Submission Guard**:
   - Automatically detects if attendance has already been recorded for a given Branch, Semester, Section, Subject, Date, and Slot.
   - Prompts the professor with a confirmation modal before updating/overwriting existing records.
4. **Enterprise Cumulative Matrix Register & Dynamic Auto-Update**:
   - Auto-appends every newly submitted lecture date column to the class matrix and dynamically recalculates total held, attended, and percentage.
   - 1-click styled `.xlsx` file download generated via SheetJS (`xlsx`) matching university register formats:
     - **Header Block**: College name, Branch, Semester, Section, Subject, Faculty Name.
     - **Row Headers**: Sl. No, Roll No, Enrollment No, Student Name.
     - **Dynamic Columns**: Chronologically ordered lecture date & slot headers.
     - **Summary Columns**: Total Lectures, Classes Attended, Attendance %, Eligibility Status.
     - **Footer Row**: Daily attendance turnout counts & turnout percentage.
5. **Student Regulatory Compliance Dashboard (75% Rule)**:
   - High-contrast visual circular progress gauge.
   - Adaptive status badge: **Green Safe (≥ 75%)** vs. **Red Shortage (< 75%)**.
   - Built-in mathematical advisory:
     - For students below 75%: Computes the exact number of consecutive classes they must attend to restore examination eligibility.
     - For students above 75%: Computes their safety buffer of classes they can afford to miss without falling below 75%.
   - Subject-wise breakdown table with percentage bars and chronological activity log.

---

## 📁 Complete Folder Structure

```
d:/Student Attendance System/
├── package.json                 # Node dependencies, scripts (start, seed, test)
├── server.js                    # Express 5 server, REST API endpoints, SPA static hosting
├── test_api.js                  # Automated end-to-end API test verification suite
├── database/
│   ├── schema.sql               # SQLite DDL schema (faculty, students, subjects, sessions, records)
│   ├── db.js                    # Native node:sqlite DatabaseSync connection & WAL mode configuration
│   ├── seed.js                  # Database seeder (1 Professor, 5 Students, 4 Subjects, 12 Sessions)
│   └── attendance.db            # Persistent SQLite database file
├── services/
│   └── excelService.js          # Enterprise Cumulative Register Excel (.xlsx) generator using SheetJS
└── public/
    ├── index.html               # Responsive HTML5 SPA layout (Student Portal, Professor Dashboard, Modals)
    ├── css/
    │   └── style.css            # Custom design tokens, micro-animations, toast transitions, progress gauge
    └── js/
        ├── app.js               # Main app state controller, tab switcher, demo quick-fillers, clock
        ├── toast.js             # Micro-interaction toast notifications
        ├── student.js           # Student metrics, 75% visual indicator, subject breakdown, logs
        └── professor.js         # Professor roster, 3-state toggle, duplicate guard, Excel export, matrix modal
```

---

## 🗄️ Database Schema (`database/schema.sql`)

The application uses **SQLite** through Node.js's native `node:sqlite` (`DatabaseSync`), configured with Write-Ahead Logging (`WAL`) mode for high concurrency, zero build toolchains, and file-backed persistence.

```sql
-- 1. Faculty / Professor Table
CREATE TABLE faculty (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    faculty_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    designation TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Students Table
CREATE TABLE students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_no TEXT UNIQUE NOT NULL,
    enrollment_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    branch TEXT NOT NULL,
    semester INTEGER NOT NULL,
    section TEXT NOT NULL DEFAULT 'A',
    dob TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Subjects Table
CREATE TABLE subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    branch TEXT NOT NULL,
    semester INTEGER NOT NULL,
    faculty_id TEXT NOT NULL,
    FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- 4. Attendance Sessions Table
CREATE TABLE attendance_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_uuid TEXT UNIQUE NOT NULL,
    branch TEXT NOT NULL,
    semester INTEGER NOT NULL,
    section TEXT NOT NULL,
    subject_id INTEGER NOT NULL,
    faculty_id TEXT NOT NULL,
    date TEXT NOT NULL,
    slot TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT uq_session UNIQUE (branch, semester, section, subject_id, date, slot)
);

-- 5. Attendance Records Table
CREATE TABLE attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('P', 'A')), -- P: Present, A: Absent
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT uq_record UNIQUE (session_id, student_id)
);
```

---

## 🔌 API Routes Reference

### Authentication Endpoints
- **`POST /api/auth/student-login`**
  - **Body**: `{ "roll_no": "101", "branch": "CSE", "semester": 5, "password": "password123" }`
  - **Returns**: Student profile & auth session payload.
- **`POST /api/auth/faculty-login`**
  - **Body**: `{ "faculty_id_or_email": "FAC101", "department": "CSE", "password": "password123" }`
  - **Returns**: Faculty profile & auth session payload.

### Professor & Attendance Endpoints
- **`GET /api/classes/options?faculty_id=FAC101`**
  - Returns available branches, semesters, sections, time slots, and subjects taught.
- **`GET /api/roster?branch=CSE&semester=5&section=A&subject_id=1&date=YYYY-MM-DD&slot=...`**
  - Returns student roster with pre-populated statuses if the session was previously recorded.
- **`POST /api/attendance/check-duplicate`**
  - **Body**: `{ "branch": "CSE", "semester": 5, "section": "A", "subject_id": 1, "date": "...", "slot": "..." }`
  - Checks if a lecture was already submitted for this slot.
- **`POST /api/attendance/submit`**
  - **Body**: `{ "branch": "CSE", "semester": 5, "section": "A", "subject_id": 1, "faculty_id": "FAC101", "date": "...", "slot": "...", "records": [...], "overwrite": boolean }`
  - Saves attendance. Returns `409 Conflict` if existing without `overwrite: true`.
- **`GET /api/attendance/matrix?branch=CSE&semester=5&section=A&subject_id=1`**
  - Returns JSON data of all recorded dates and student presence history for in-app preview.
- **`GET /api/attendance/export-excel?branch=CSE&semester=5&section=A&subject_id=1`**
  - Generates and streams formatted `.xlsx` workbook binary with enterprise register styling.

### Student Dashboard Endpoint
- **`GET /api/student/dashboard?student_id=1`** (or `?enrollment_no=ENR20240101`)
  - Returns overall percentage, >=75% eligibility status, class buffer or classes needed calculation, subject breakdown, and recent lecture log.

---

## 👥 Seed Credentials & Test Accounts

| Role | Name | Identifier | Branch / Sem | Password / DOB | Attendance Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Faculty (HOD)** | Dr. Rajesh Sharma | `FAC101` or `dr.sharma@apex.edu` | CSE | `password123` | N/A |
| **Student (Safe)** | Aarav Sharma | `101` or `ENR20240101` | CSE / Sem 5 | `password123` or `2004-03-15` | **~88% (Safe / Green)** |
| **Student (Safe)** | Ananya Patel | `102` or `ENR20240102` | CSE / Sem 5 | `password123` or `2004-07-22` | **~90% (Safe / Green)** |
| **Student (Warning)**| Rohan Gupta | `103` or `ENR20240103` | CSE / Sem 5 | `password123` or `2004-11-05` | **~60% (Shortage / Red Alert)** |
| **Student (Safe)** | Isha Verma | `104` or `ENR20240104` | CSE / Sem 5 | `password123` or `2004-01-30` | **~80% (Safe / Green)** |
| **Student (Warning)**| Kabir Mehta | `105` or `ENR20240105` | CSE / Sem 5 | `password123` or `2004-09-18` | **~68% (Shortage / Red Alert)** |

> 💡 **One-Click Demo Evaluator**: On the login screen, click any of the 3 quick-fill buttons at the top (*Faculty*, *Student Safe*, or *Student Warning*) to populate the fields instantly!

---

## 🚀 Quickstart & Setup Guide

### 1. Requirements
- Node.js version 18+ (tested and verified on Node.js v24 LTS with native `node:sqlite`).

### 2. Installation & Database Seeding
```bash
# Clone or navigate to the directory
cd "d:/Student Attendance System"

# Install dependencies (express, cors, xlsx)
npm install

# Seed the database with 1 professor, 5 students, 4 subjects, and 12 sessions
npm run seed
```

### 3. Running Automated Tests
```bash
npm test
```

### 4. Starting the Server
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser or on mobile via your local network.
