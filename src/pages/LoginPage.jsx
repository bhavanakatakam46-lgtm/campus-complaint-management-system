import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, GraduationCap, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { authReady, missingFirebaseVariables } from "../firebase.js";
import { useAuth } from "../auth/useAuth.js";

function friendlyAuthError(error) {
  const messages = {
    "auth/invalid-credential": "That email and password combination was not recognized.",
    "auth/user-disabled": "This account has been disabled. Contact your campus administrator.",
    "auth/popup-closed-by-user": "The sign-in window was closed before finishing.",
    "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups and try again.",
    "auth/too-many-requests": "There were too many attempts. Please wait a moment and try again.",
  };
  return messages[error.code] ?? error.message ?? "Sign-in failed. Please try again.";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, authError, setAuthError, signInWithGoogle, signInWithEmail, signInDemo } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loadingMethod, setLoadingMethod] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) navigate(user.isDemo && user.role === "admin" ? "/admin" : "/dashboard", { replace: true });
  }, [user, navigate]);

  async function handleDemoSignIn(role) {
    setError(""); setAuthError(""); setLoadingMethod(`demo-${role}`);
    try { await signInDemo(role); }
    catch (signInError) { setError(friendlyAuthError(signInError)); }
    finally { setLoadingMethod(""); }
  }

  async function handleGoogleSignIn() {
    setError(""); setAuthError(""); setLoadingMethod("google");
    try { await signInWithGoogle(); }
    catch (signInError) { setError(friendlyAuthError(signInError)); }
    finally { setLoadingMethod(""); }
  }

  async function handleEmailSignIn(event) {
    event.preventDefault();
    setError(""); setAuthError(""); setLoadingMethod("email");
    try { await signInWithEmail(email.trim(), password); }
    catch (signInError) { setError(friendlyAuthError(signInError)); }
    finally { setLoadingMethod(""); }
  }

  const visibleError = error || authError;
  return <main className="login-page">
    <section className="login-story" aria-label="Campus community">
      <div className="story-photo" />
      <div className="story-content">
        <a className="login-brand" href="/login" aria-label="Smart Campus home"><span className="brand-mark"><GraduationCap size={21} /></span><span>Smart Campus</span></a>
        <div className="story-copy">
          <span className="eyebrow"><i className="eyebrow-dot" /> CAMPUS, CONNECTED</span>
          <h1>A better campus<br />starts with being heard.</h1>
          <p>One place to raise a concern, follow its progress, and help make student life work better for everyone.</p>
        </div>
        <div className="story-foot"><span className="story-shield"><ShieldCheck size={18} /></span><div><strong>Made for your campus</strong><span>Private, accountable, student-first</span></div><span className="story-index">01 <i /> 03</span></div>
      </div>
    </section>
    <section className="login-panel">
      <div className="login-form-wrap">
        <div className="mobile-login-brand"><span className="brand-mark"><GraduationCap size={20} /></span><span>Smart Campus</span></div>
        <div className="login-heading"><span className="form-kicker">STUDENT PORTAL</span><h2>Welcome back</h2><p>Choose a prototype account or sign in with your college account.</p></div>
        {!authReady && <div className="setup-notice" role="status"><LockKeyhole size={18} /><div><strong>Firebase setup needed</strong><p>Set these values in the project-root <code>.env.local</code> using your Firebase Web app config:</p><ul>{missingFirebaseVariables.map((variable) => <li key={variable}><code>{variable}</code></li>)}</ul><p>Then restart Vite. These settings are not present in this workspace.</p></div></div>}
        {visibleError && <div className="auth-error" role="alert">{visibleError}</div>}
        <section className="demo-access" aria-label="Prototype demo sign in">
          <div className="demo-access-heading"><span className="form-kicker">PROTOTYPE-ONLY DEMO AUTH</span><p>No Firebase account or password required.</p></div>
          <div className="demo-access-actions">
            <button className="demo-login-button" disabled={Boolean(loadingMethod)} onClick={() => handleDemoSignIn("student")} type="button">
              <GraduationCap size={17} /><span><strong>Continue as student</strong><small>Submit and track complaints</small></span><ArrowRight size={16} />
            </button>
            <button className="demo-login-button" disabled={Boolean(loadingMethod)} onClick={() => handleDemoSignIn("admin")} type="button">
              <ShieldCheck size={17} /><span><strong>Continue as admin</strong><small>Review and update reports</small></span><ArrowRight size={16} />
            </button>
          </div>
          <p className="demo-prototype-note">Demo authentication is for this college prototype only. It is not secure and must not be used for real accounts.</p>
        </section>
        <button className="google-button" type="button" onClick={handleGoogleSignIn} disabled={Boolean(loadingMethod)}>
          {loadingMethod === "google" ? <span className="spinner" /> : <span className="google-g">G</span>}
          <span>{loadingMethod === "google" ? "Connecting to Google..." : "Continue with Google"}</span>
          {loadingMethod !== "google" && <ArrowRight className="button-arrow" size={17} />}
        </button>
        <div className="form-divider"><span /> <span>or use your college email</span> <span /></div>
        <form className="email-form" onSubmit={handleEmailSignIn}>
          <label htmlFor="email">College email</label>
          <div className="input-wrap"><Mail size={17} /><input autoComplete="username" id="email" name="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@college.edu" required type="email" value={email} /></div>
          <div className="password-label-row"><label htmlFor="password">Password</label></div>
          <div className="input-wrap"><LockKeyhole size={17} /><input autoComplete="current-password" id="password" name="password" onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required type={showPassword ? "text" : "password"} value={password} /><button aria-label={showPassword ? "Hide password" : "Show password"} className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} type="button">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          <button className="submit-button" disabled={Boolean(loadingMethod)} type="submit">{loadingMethod === "email" && <span className="spinner spinner-light" />}{loadingMethod === "email" ? "Signing in..." : "Sign in with email"}{loadingMethod !== "email" && <ArrowRight size={17} />}</button>
        </form>
        <p className="login-note">Email and password sign-in must be enabled in your Firebase project.</p>
        <div className="login-privacy"><LockKeyhole size={14} /> Prototype data stays in this browser; demo sign-in is not secure.</div>
      </div>
      <footer className="login-footer"><span>SMART CAMPUS</span><span>Student services, made simpler.</span></footer>
    </section>
  </main>;
}
