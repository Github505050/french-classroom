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


## Notebook-test photo submissions (requires Firebase Storage)

The website now includes a student notebook-photo upload area inside Tests, and a teacher-only **Tests & Submissions** tab. The GitHub code alone does not create a Storage bucket or publish Firebase security rules.

1. In [Firebase Console](https://console.firebase.google.com/project/french-classroom/storage), open **Storage** and create/confirm the bucket for `french-classroom`.
2. Firebase requires the **Blaze pay-as-you-go billing plan** to use Cloud Storage. Check pricing and set a Google Cloud billing budget/alerts before enabling it; usage may incur costs even though some usage can be no-charge.
3. In **Storage → Rules**, replace the Storage rules with the repository file [storage.rules](storage.rules) and **Publish**.
4. In **Firestore Database → Rules**, publish the repository's updated [firestore.rules](firestore.rules) (preserving the existing profiles/progress permissions and adding `testSubmissions`).
5. Sign in as a verified student; open a test and upload a small sample notebook photo. Verify the success message.
6. Sign in as the authorized teacher; open **Teacher Portal → Tests & Submissions**, refresh, and open the sample notebook photo.
7. Test that Student A cannot view Student B's photos. Do not place notebook images in the public GitHub repository.

**Important:** Test questions are public website content, but notebook images and submission metadata must stay in Firebase Storage and Firestore. Teacher-only status depends on the published Firebase security rules. The current feature does not automatically grade or score notebook photos. The Copy Questions for AI button copies test questions plus instructions to wait for all notebook photos before checking; upload photos to your chosen AI separately.

Uploads accept 1–8 JPEG/PNG/WebP photos up to 8 MB each. Students can make multiple submissions; uploaded photos are not overwritten. The teacher portal shows the account email, test and images. Image download URLs can be shared, so do not forward them to unauthorized people. Review your data-retention/deletion policy before collecting student work.
