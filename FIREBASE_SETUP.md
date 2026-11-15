# Classroom Firebase setup

GitHub Pages remains public. Authentication secures **private progress records** in Firestore; it does not hide the public lesson JSON or HTML.

1. Firebase Console → Authentication → Sign-in method → enable **Email/Password**.
2. Authentication → Settings → Authorized domains → confirm **github505050.github.io** is authorized; add it if missing.
3. Firestore Database → Create database → **Production mode**, select a region.
4. Firestore Database → Rules → paste the contents of `firestore.rules`, then **Publish**.
5. Authentication → Users → **Add user**. Create your own teacher email/password (never put passwords in GitHub).
6. Copy the new user's **UID** from Firebase Authentication → Users.
7. Firestore → Start collection `roles` → Document ID **your exact UID** → Field `role` (string) = `teacher`. This admin-only manual bootstrap prevents students from promoting themselves.
8. For each student, create an Email/Password user from the Firebase Authentication → Users page and share their login privately. Their default role is student.
9. Open the website, choose Account, sign in. Click **Upload this device's progress** *only if* it is that account's own progress. After upload, subsequent changes sync while online.
10. Test on a second device. Changes written on one device may require sign-in/reload on the other to pull updated data.

Security notes: Authenticated progress is protected by rules **only after you publish the rules**. Do not use Firestore test mode. Signing in does not retroactively make previously entered guest progress private. Never share service-account keys.


## Notebook tests: Supabase Free (not Firebase Storage)

Student authentication and lesson progress remain on Firebase. Notebook photos and submission metadata now use **Supabase**. No Firebase Storage billing upgrade is needed.

The Supabase backend must be deployed before the photo upload and teacher submission viewer are operational:

1. Create a Supabase Free project at https://supabase.com/dashboard (or connect Supabase through ChatGPT). Check the current Free storage and function limits before use.
2. Run [supabase/setup.sql](supabase/setup.sql) in the project's SQL Editor. This creates a private `notebook-tests` bucket, protected submission records, and an administrator-maintained `teacher_roles` table. Browser clients cannot directly access those tables.
3. Teacher permissions are read directly from the existing Firebase `roles/{uid}` record. No additional teacher account or Supabase teacher role entry is required.
4. Deploy [supabase/functions/notebook-tests/index.ts](supabase/functions/notebook-tests/index.ts) as Edge Function `notebook-tests` with JWT gateway verification **disabled** (see [supabase/config.toml](supabase/config.toml)). The function independently validates Firebase-signed ID tokens using Google's public keys, the expected Firebase project and verified email status.
5. Set the Edge Function secret `FIREBASE_PROJECT_ID=french-classroom`. Supabase provides its server URL and secret key to the deployed function; **never** commit or paste a service-role secret into GitHub HTML, JavaScript, or `supabase-config.json`.
6. Update [supabase-config.json](supabase-config.json) with the Supabase Project URL, e.g. `https://YOUR_PROJECT_REF.supabase.co`. The project URL is public; it is **not** a secret.
7. Verify both student and teacher email addresses are verified in Firebase Authentication.
8. Test uploading one sample notebook page as a student, then viewing it via Teacher Portal → Tests & Submissions as the teacher. Verify one student cannot read another student's submissions. Test on a phone and desktop before collecting real student work.

### Notes

- Questions stay in `tests.json`; notebook answers are stored privately in Supabase, not in GitHub.
- Student page allows 1–8 JPEG/PNG/WebP photos up to 8 MB each. Only the teacher and the owner student can read their submissions through short-lived signed image URLs.
- The teacher reviews manually; no answers or answer keys are revealed to students. The Copy Questions button gives AI correction instructions but **does not send photos to AI automatically**.
- Teacher authorization uses the `teacher_roles` table in Supabase. Only the administrator should maintain this table. It must match the authorized teacher's UID in Firebase.
- Free projects can pause for inactivity, and Free quotas apply. Review data retention, backups, and privacy policies before collecting student notebook photos.
- Old `storage.rules` and the `testSubmissions` section in `firestore.rules` relate to the superseded Firebase Storage design and are no longer used by notebook photo uploads.


## Teacher grading and published student results

The existing test syllabus stays in `tests.json`. The student test page has one **Upload notebook photos** action at the end of the assessment and a read-only result panel; answer keys and AI-copy controls are not exposed in the student interface.

Teacher Portal → **Tests & Submissions** provides a submission list with status filters, private notebook page viewer, **Copy questions + AI instructions**, section-level marks using the original syllabus maximums, private draft saves and **Publish result**. The teacher must grade every section before publishing. Changes to published marks require explicitly publishing the revised grade.

Supabase tables `notebook_test_definitions` and `notebook_test_results` have RLS enabled and no direct anon/authenticated table access. The `notebook-tests` Edge Function verifies the Firebase identity and existing Firebase `roles/{uid}` teacher role. Students can retrieve **only their own published** results; draft grades are never returned by the student result endpoint. The teacher key supplied for the current mega test must be kept privately outside the public GitHub Pages repository.

**Review protocol:** assess notebook photographs and oral performance separately, then enter verified section marks and any feedback. The copy button only prepares an AI checking prompt; it does **not** upload student images or responses to any AI service.

**Browser QA required before student use:** sign in as a verified student, upload a sample notebook page and verify that a teacher can view it; save a draft and confirm the student still sees Pending; publish all eight section marks and confirm the student sees exactly that total and feedback; confirm another student cannot read this result. Check mobile display and the one-button upload flow. Browser-only syntax or database checks do not substitute for these live authentication tests.
