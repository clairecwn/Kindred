import { useState } from "react";
import { supabase } from "../lib/supabase.js";

/**
 * Email + password sign in / sign up.
 *
 * Reuses the .login-world markup so the full-bleed sky backdrop keyed off
 * `.viewport-fit:has(.login-world)` applies here too.
 */
export default function AuthScreen() {
  const [mode, setMode]         = useState("signin");   // "signin" | "signup"
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [notice, setNotice]     = useState("");

  const isSignUp = mode === "signup";

  async function submit(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (isSignUp && password.length < 6) {
      setError("Password needs to be at least 6 characters.");
      return;
    }

    setBusy(true);
    const { data, error: authError } = isSignUp
      ? await supabase.auth.signUp({ email: email.trim(), password })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    // With email confirmation switched on, sign-up returns a user but no
    // session — nothing else happens until they click the link in their inbox.
    if (isSignUp && !data.session) {
      setNotice("Check your email for a confirmation link, then sign in.");
      setMode("signin");
    }
    // On success SessionProvider's auth listener swaps this screen out.
  }

  return (
    <main className="login-world">
      <div className="login-sky" aria-hidden="true">
        <div className="login-cloud lc-1"/><div className="login-cloud lc-2"/>
        <div className="login-cloud lc-3"/><div className="login-cloud lc-4"/>
      </div>
      <section className="login-panel anim-pop-in">
        <h1 className="login-kindred-title">Kindred</h1>
        <p className="login-kindred-sub">
          {isSignUp ? "Make an account to keep your world safe." : "Welcome back."}
        </p>

        <form className="login-form" onSubmit={submit}>
          <input
            className="login-input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            aria-label="Email"
            autoComplete="email"
            required
            autoFocus
          />
          <input
            className="login-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
          />

          {error  && <p className="auth-message auth-message-error" role="alert">{error}</p>}
          {notice && <p className="auth-message auth-message-notice" role="status">{notice}</p>}

          <button className="login-btn" type="submit" disabled={busy}>
            {busy ? "One moment…" : isSignUp ? "Create my account" : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          className="auth-switch"
          onClick={() => { setMode(isSignUp ? "signin" : "signup"); setError(""); setNotice(""); }}
        >
          {isSignUp ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </section>
    </main>
  );
}
