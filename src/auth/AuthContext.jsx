import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { allowedEmailDomain, auth, authReady, googleProvider } from "../firebase.js";
import { AuthContext } from "./auth-context.js";
import {
  clearDemoSession,
  getDemoSession,
  saveDemoSession,
} from "../data/prototypeData.js";

function hasAllowedDomain(email) {
  return Boolean(email && allowedEmailDomain && email.toLowerCase().endsWith(`@${allowedEmailDomain}`));
}

function requireAuthSetup() {
  if (!authReady) {
    throw new Error("Firebase is not configured yet. Add the Firebase values and college email domain to .env.local, then restart Vite.");
  }
}

async function validateCampusAccount(user) {
  if (hasAllowedDomain(user.email)) return;
  await signOut(auth);
  throw new Error(`Use your college email address ending in @${allowedEmailDomain}.`);
}

export function AuthProvider({ children }) {
  const [demoSession, setDemoSession] = useState(getDemoSession);
  const [user, setUser] = useState(demoSession);
  const [loading, setLoading] = useState(Boolean(auth && !demoSession));
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!auth || demoSession) {
      return undefined;
    }
    return onAuthStateChanged(auth, async (nextUser) => {
      if (getDemoSession()) return;
      if (nextUser && !hasAllowedDomain(nextUser.email)) {
        await signOut(auth);
        setUser(null);
        setAuthError(`Use your college email address ending in @${allowedEmailDomain}.`);
      } else {
        setUser(nextUser);
      }
      setLoading(false);
    });
  }, [demoSession]);

  async function signInWithGoogle() {
    requireAuthSetup();
    setAuthError("");
    const result = await signInWithPopup(auth, googleProvider);
    await validateCampusAccount(result.user);
  }

  async function signInWithEmail(email, password) {
    requireAuthSetup();
    setAuthError("");
    const result = await signInWithEmailAndPassword(auth, email, password);
    await validateCampusAccount(result.user);
  }

  async function signInDemo(role) {
    if (!["student", "admin"].includes(role)) {
      throw new Error("Choose a valid prototype account.");
    }
    if (auth) await signOut(auth);
    const session = role === "admin"
      ? { uid: "demo-admin", displayName: "Campus Administrator", email: "admin@smartcampus.demo", role, isDemo: true }
      : { uid: "demo-student", displayName: "Bhavana", email: "student@smartcampus.demo", role, isDemo: true };
    saveDemoSession(session);
    setDemoSession(session);
    setUser(session);
    setAuthError("");
  }

  async function logOut() {
    if (user?.isDemo) {
      clearDemoSession();
      setDemoSession(null);
      setUser(null);
    }
    if (auth) await signOut(auth);
  }

  return <AuthContext.Provider value={{ user, loading, authError, setAuthError, signInWithGoogle, signInWithEmail, signInDemo, logOut }}>
    {children}
  </AuthContext.Provider>;
}
