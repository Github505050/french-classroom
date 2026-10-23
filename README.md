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


## Classroom experience upgrade

The website has a lightweight, responsive UI stylesheet in `classroom-polish.css`. It adds:
- A guided activity path at the top of notebook practice, linking to the actual available activities (never fabricating lesson content).
- Four convenient mobile quick-navigation actions and a theme toggle with local-only appearance preference.
- A personal French word notebook and weekly active-recall review inside **My Progress**.
- An optional announcement feed. No empty announcement boxes appear to students.
- A story reader that preserves text verbatim and supports word lookup, narration, notes, and sentence navigation.

**Storage:** The personal vocabulary notebook, review ratings, and new story notes use keys beginning with `frenchportal_v2_`, consistent with Firebase's existing progress-sync allowlist. The old story-note key is read as a compatibility fallback, without deleting old records. Browser-local draft feedback means only "saved on this device"; Firebase sync depends on sign-in and network access.

### Publish a teacher announcement (no database changes)

Open [announcements.json](announcements.json) in GitHub and add a short teacher-authored entry to the array. Format:

```json
{
  "announcements": [
    {
      "title": "Example class reminder",
      "body": "Teacher-supplied message goes here.",
      "date": "2026-10-23",
      "active": true
    }
  ]
}
```

Commit the file to publish it on GitHub Pages. Students see only active entries on Home. Do not put personal student details in this public file. Editing announcements directly in the teacher portal would require a securely authorized write endpoint; this static-site implementation intentionally does **not** provide one.

### Free French recordings

`audio/manifest.json` maps normalized French phrases to optional, pre-generated clips in `audio/clips/`. If a clip isn't present, students still hear the device French voice. The story player supports sentence-by-sentence recorded audio where available.

`.github/workflows/french-audio.yml` is a manual/opt-in Piper voice-generation workflow (it also runs when the workflow definition changes), which can produce compressed MP3 clips and commit them. Avoid running it repeatedly for unchanged content: hundreds of clips may take time and increase repository size. Confirm the selected model's license conditions before any new redistribution. Future lesson content is never edited by this workflow.

### Quality assurance

`Classroom quality checks` runs on pushes to main:
- JavaScript parsing and source/data validation via `node --test tests/validate.cjs`.
- Desktop and mobile Playwright browser smoke tests with Firebase auth mocked **only for UI testing**.
- Teacher student-profile presentation, Week 1 and Week 2 navigation, story writing persistence, refresh continuity, personal vocabulary and mobile overflow checks.

Browser smoke tests are not a substitute for signed-in Firebase/Firestore end-to-end tests. Check GitHub Actions results before treating a release as verified.
