import { useState } from "react";
import { supabase, setLocalOnly } from "../lib/supabase.js";

// Every browser words a dead connection differently: "Failed to fetch" in
// Chrome, "Load failed" in Safari, "NetworkError when attempting to fetch
// resource." in Firefox. None of them mean anything to a player.
const NETWORK_ERROR_RE = /failed to fetch|load failed|networkerror|fetch failed|network request failed/i;

function isNetworkFailure(err) {
  if (!err) return false;
  return err.name === "AuthRetryableFetchError"
      || err.status === 0
      || NETWORK_ERROR_RE.test(err.message ?? "");
}

// Supabase's own wording means nothing to a player; say what actually happened.
function friendlyAuthError(err) {
  const msg = String(err?.message ?? "");
  if (/email not confirmed/i.test(msg)) return "Your email isn't confirmed yet. Use the link we sent, or resend it below.";
  if (/rate limit|too many|security purposes/i.test(msg)) return "Too many emails were sent just now. Wait a little and try again.";
  if (/not authori[sz]ed/i.test(msg)) return "Sign-up emails can't be sent to this address yet (the email service is still in test mode).";
  if (/already registered|already exists/i.test(msg)) return "That email already has an account. Try signing in.";
  if (/invalid login credentials/i.test(msg)) return "That email and password don't match.";
  return msg || "Something went wrong. Please try again.";
}

const UNREACHABLE_MESSAGE =
  "Can't reach the Kindred server, so accounts aren't available right now. " +
  "You can keep playing on this device — your world saves here.";

/**
 * Email + password sign in / sign up.
 *
 * Reuses the .login-world markup so the full-bleed sky backdrop keyed off
 * `.viewport-fit:has(.login-world)` applies here too.
 */
export default function AuthScreen({ onContinueOffline }) {
  const [mode, setMode]         = useState("signin");   // "signin" | "signup"
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [notice, setNotice]     = useState("");
  const [offline, setOffline]   = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const isSignUp = mode === "signup";

  async function submit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setOffline(false);

    if (isSignUp && password.length < 6) {
      setError("Password needs to be at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      const { data, error: authError } = isSignUp
        // The confirmation link must come back to this app, not Supabase's
        // default Site URL (localhost:3000), or it opens a dead page.
        ? await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (authError) throw authError;

      // With email confirmation switched on, sign-up returns a user but no
      // session — nothing else happens until they click the link in their inbox.
      if (isSignUp && !data.session) {
        setNotice(`We sent a confirmation link to ${email.trim()}. Check your inbox and spam folder, then sign in.`);
        setNeedsConfirm(true);
        setMode("signin");
      }
      // On success SessionProvider's auth listener swaps this screen out.
    } catch (err) {
      if (isNetworkFailure(err)) {
        setOffline(true);
        setError(UNREACHABLE_MESSAGE);
      } else {
        setError(friendlyAuthError(err));
        if (/email not confirmed/i.test(err?.message ?? "")) setNeedsConfirm(true);
      }
    } finally {
      // Always clears. A thrown error used to skip the old setBusy(false) and
      // leave the button stuck on "One moment…" with no way to retry.
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!email.trim()) { setError("Type your email first."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: resendError } = await supabase.auth.resend({ type: "signup", email: email.trim(),
        options: { emailRedirectTo: window.location.origin } });
      if (resendError) throw resendError;
      setNotice(`Sent again to ${email.trim()}. It can take a minute; check spam too.`);
    } catch (err) {
      setError(isNetworkFailure(err) ? UNREACHABLE_MESSAGE : friendlyAuthError(err));
    } finally { setBusy(false); }
  }

  function continueOffline() {
    setLocalOnly(true);
    onContinueOffline?.();
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

        {needsConfirm && !isSignUp && (
          <button type="button" className="auth-switch" onClick={resendConfirmation} disabled={busy}>
            Didn't get the email? Send it again
          </button>
        )}

        {offline && (
          <button type="button" className="auth-switch" onClick={continueOffline}>
            Continue without an account
          </button>
        )}
      </section>
    </main>
  );
}
