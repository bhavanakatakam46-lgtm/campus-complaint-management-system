import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const allowedEmailDomainValue = import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN ?? "";
const placeholderValues = new Set([
  "your-firebase-web-api-key",
  "your-project-id.firebaseapp.com",
  "your-project-id",
  "your-firebase-web-app-id",
  "yourcollege.edu",
]);

function hasRealValue(value) {
  return Boolean(value?.trim()) && !placeholderValues.has(value.trim().toLowerCase());
}

export const allowedEmailDomain = allowedEmailDomainValue.trim().toLowerCase().replace(/^@/, "");
export const missingFirebaseVariables = [
  ...Object.entries(firebaseConfig)
    .filter(([, value]) => !hasRealValue(value))
    .map(([key]) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`),
  ...(!hasRealValue(allowedEmailDomainValue) ? ["VITE_ALLOWED_EMAIL_DOMAIN"] : []),
];
export const firebaseConfigured = missingFirebaseVariables.length === 0;
export const authReady = firebaseConfigured;

const app = firebaseConfigured ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
