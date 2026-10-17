# Mon Espace Français — French Classroom

A mobile-friendly French classroom with student learning and a **teacher reporting workspace**. Hosted on GitHub Pages; account records are stored in Firebase Authentication and Firestore.

**Website:** https://github505050.github.io/french-classroom/

## Student experience
- Email/password account with email verification, profile, and password reset.
- **French Foundations:** 14 pronunciation-first lessons split into two selectable weeks. Completion and practice answers are saved.
- **Weekly Practice:** A1 lessons, flashcards, written exercises, speaking tasks, self-entered written scores, lesson completion, and back navigation.
- Listening library and resource links, plus browser speech synthesis where supported.
- Progress is stored locally first and synced to Firestore when online. Offline changes require reconnecting; cross-device updates can require a fresh sign-in/reload.
- Speaking audio clips are temporary browser recordings unless explicitly downloaded; **they are not uploaded to the teacher portal**.

## Teacher workspace
An authorized teacher account can access:
- Overview of students, recent sign-ins, completed lessons, and recorded scores.
- Searchable, filterable student directory (name, email, activity, completions and marks).
- Student profiles: name, email, date of birth if provided, last sign-in and last progress sync.
- Foundation Days 1–14 completion and auto-checked saved answers.
- Weekly progress by lesson/day, saved written answers, speaking participation checkboxes and student-entered marks.
- Weighted average across recorded scores only (not an official teacher-certified grade).
- CSV export with spreadsheet formula-injection mitigation. Downloaded CSVs contain personal information and must be stored securely.

Teacher reports are read-only. Teachers cannot edit grades or student records through the dashboard. Sign-out clears teacher roster data from memory.

**Teacher setup and security:** see [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) and [TEACHER_PORTAL.md](./TEACHER_PORTAL.md). Website files and lessons on GitHub Pages remain public. Firestore rules, not website JavaScript alone, protect private progress.

## Publishing lesson material
- config.json contains the ordered week file paths.
- Each weekly syllabus JSON has seven ordered days and a stable ID preserving existing progress keys.
- New weeks go in weeks/weekN.json, and must be referenced from config.json.
- Avoid changing old score/completion keys or lesson IDs without a migration.

## Testing and release
The GitHub Actions workflow at .github/workflows/quality.yml runs:
1. JavaScript syntax, JSON validation and reporting tests.
2. Chromium desktop and mobile smoke tests for teacher UI, student navigation, Foundations, and back buttons.

Browser smoke tests use **simulated teacher access and sample records**. They are not substitutes for verifying production Firebase permissions or real-account sync. Follow [TEACHER_PORTAL.md](./TEACHER_PORTAL.md) before merging to main.

For local preview, serve the repository root with python -m http.server 8000 and visit http://localhost:8000. Firebase sign-in also requires the local hostname to be authorized.

## Limitations
The site cannot independently grade handwritten work, upload notebook photos to teachers or guarantee speech audio on every device. Daily written scores are student-entered after external feedback.
