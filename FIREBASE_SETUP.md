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
