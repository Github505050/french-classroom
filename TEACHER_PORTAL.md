# Teacher Portal — operation and release guide

## Signing in
Use the teacher account registered in Firebase Authentication. Create a separate Firestore document under roles with the exact Authentication UID and field role = teacher. The public student sign-up form never grants teacher privileges. Never put login credentials, student files, or a Firebase service-account key in GitHub.

## Main sections
**Overview:** current student count, students signed in during the past seven days, saved lesson completions, recorded scores, and recently active students.

**Students:** search by name/email; filter by recent sign-in, completion and scores; sort by name, completion, average mark or recent sign-in. Select **View profile** to inspect an individual's learning progress.

**Results:** see submitted daily scores, weighted percentage (points earned divided by points possible across scored assignments), completed Foundation lessons and a shortcut to each profile.

**Student profile:** displays full name, email, supplied date of birth, last sign-in, time of last cloud progress update, Foundation day completion, answered/correct checks and weekly lesson details. Saved written answers are available inside expanded details. Audio recordings are not transferred to teachers.

**Export CSV:** Overview offers a read-only CSV export of roster and summary progress. The export does not include birth dates or full student answers. Treat exported files as confidential.

## Interpretation
- A completed lesson means the student selected the completion button. It is not automatically proof of proficiency.
- Written scores are self-reported by students following feedback from an external checker. They are not verified or editable from the teacher portal.
- Foundation correct-answer counts are calculated from synced answers against the existing exact-match answer keys; legitimate alternative French responses might not be recognized.
- An empty score means **no recorded mark**, not zero. Weighted averages exclude missing marks.
- The seven-day activity indicator reflects the most recent stored sign-in, not the exact time each lesson was completed.
- Students without a saved name may appear with their email until they next sign in or save their profile name.
- Offline answers and progress are shown after a successful cloud synchronization; reload the teacher page when needed.

## Production release checklist
1. Confirm the latest Firestore security rules in Firebase Console match firestore.rules and that test-mode open access is disabled.
2. Confirm the designated teacher UID has role = teacher, and a normal student does not.
3. Sign in as a **student** on a separate browser/device. Confirm Foundations, Weekly Practice, completion, score saving, lesson navigation and sign-out.
4. Log in as **teacher** and refresh. Confirm the student name, Foundation/Weekly lesson completions, score and saved answer details match the student account.
5. Update the student's score and mark a different day complete. Wait for online sync, refresh the teacher roster and verify both changes appear.
6. Confirm the normal student cannot access the teacher workspace or read another student's records. Verify Firebase permissions with separate test accounts; front-end menu hiding alone is not sufficient.
7. On a narrow mobile screen, test the menu, teacher directory, student profile, back navigation and scrollability.
8. Test French audio playback with the target device's voices, plus service-worker refresh after updating.
9. Run and review the GitHub Actions quality checks (JavaScript/lesson checks and desktop/mobile browser smoke tests), then merge the reviewed pull request into main.
10. After GitHub Pages deploys, smoke-test the live URL on desktop/mobile, including sign-in with your real teacher account.

Automated browser smoke tests use isolated mock teacher data; they cannot prove production Firestore authorization or real authentication. Do not claim those live checks have passed without performing them.

## Data protection
The teacher dashboard reads data from Firestore only with a teacher-authorized account; it keeps the roster only in memory and clears it on sign-out. It does not write student records. Use verified Firestore rules for access control. Avoid exporting CSVs to shared computers, and do not publish screenshots showing student personal details.
