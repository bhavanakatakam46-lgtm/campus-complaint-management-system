# Smart Campus Complaint Management System

The application provides a responsive student sign-in page and Firebase-protected student and admin dashboards. The student dashboard listens to Firestore for complaints belonging to the signed-in student; its totals, recent activity, category chart, priorities, filters, and complaint submission use live Firestore data. The admin dashboard has statistics, charts, searchable complaint management, and status/priority/resolution-note updates.

The student dashboard includes a complaint form and a manual campus-location entry for QR-linked reports. Dedicated tracking/detail pages, camera-based QR scanning, user/category management, and Gemini classification are not implemented yet. Without Firebase configuration, the sign-in screen explains what is missing; it does not create a fake session or sample complaint data.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ and npm.

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Open `http://localhost:5173/login` in Chrome. Vite also prints the local URL in the terminal. To open the browser automatically, run `npm.cmd run dev -- --open`.

After changing `.env.local`, restart Vite. The example values are placeholders, so authentication remains unavailable until you replace them with Firebase project values.

## Firebase setup

1. Create a project in [Firebase Console](https://console.firebase.google.com/) and register a Web app.
2. Copy the Web app's `apiKey`, `authDomain`, `projectId`, and `appId` into `.env.local`. These are Firebase client configuration values, not service-account credentials. Never put a service-account key or Gemini API key in a `VITE_` variable.
3. Set `VITE_ALLOWED_EMAIL_DOMAIN` to the part after `@` in student email addresses, such as `university.edu`.
4. In **Authentication > Sign-in method**, enable Google. Enable **Email/Password** too if needed. Add your app's domain under **Authentication > Settings > Authorized domains**.
5. Create a Cloud Firestore database. In **Firestore Database > Rules**, paste the contents of `firestore.rules` and publish them.

The student dashboard query is scoped to the current student's Firebase UID. Firestore rules allow students to read only their own complaints and prevent them from changing complaint status. An administrator is recognized only by an `admins/{uid}` document; those documents are not writable by clients, so provision them only through the Firebase Console or a trusted Admin SDK process. To authorize an administrator, create an `admins` collection document whose document ID is that Firebase Authentication user's UID. The admin client can read only its own membership document, and Firestore rules independently authorize access to the all-complaints query and updates.

The complaint creation rule is prepared for the next stage's form fields. Image upload is not enabled yet; Cloud Storage upload rules must be configured before supporting attachments.

## Current routes

- `/login` - Google and email/password sign-in
- `/dashboard` - protected student overview with live Firestore data
- `/admin` - protected admin overview; requires an `admins/{uid}` membership document
- `/admin/complaints` - searchable complaint management for authorized administrators

## Build checks

```powershell
npm.cmd run build
npm.cmd run lint
```
