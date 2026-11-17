import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../app/auth-context";

type Mode = "login" | "signup";

/**
 * Pull the path the user was originally headed to out of the router state.
 *
 * ProtectedRoute navigates with `state={{ from: location.pathname }}`, so this
 * is a plain string like "/learn". We check the type at runtime because router
 * state is whatever the previous screen put there -- it could be anything, and
 * TypeScript can't promise otherwise. We also refuse anything that doesn't
 * start with a single "/" so a crafted link can't bounce us off-site.
 */
function redirectTarget(state: unknown): string {
  if (
    state &&
    typeof state === "object" &&
    "from" in state &&
    typeof (state as { from: unknown }).from === "string"
  ) {
    const from = (state as { from: string }).from;
    if (from.startsWith("/") && !from.startsWith("//")) return from;
  }
  return "/";
}

export function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const location = useLocation();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set after a signup that created the account but no session, i.e. Supabase
  // is waiting on the confirmation email. We swap the whole form for a notice.
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);

  const destination = redirectTarget(location.state);

  // Wait for the saved-session check before deciding anything. Without this the
  // form would flash on screen for a moment on every refresh.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  // Already logged in? Nothing to do here.
  if (user) {
    return <Navigate to={destination} replace />;
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Cheap checks first, so an obviously bad form never hits the network.
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const result =
        mode === "login"
          ? await signIn(trimmedEmail, password)
          : await signUp(trimmedEmail, password);

      if (!result.ok) {
        setError(result.message ?? "Something went wrong. Please try again.");
        return;
      }

      if (result.needsEmailConfirmation) {
        // Success, but there's no session yet -- don't redirect.
        setConfirmMessage(
          result.message ?? "Check your email to confirm your account.",
        );
        setPassword("");
        return;
      }

      // On a real success we deliberately do NOT navigate here. AuthProvider's
      // onAuthStateChange sets `user`, this component re-renders, and the
      // `if (user)` branch above does the redirect. One code path, no races.
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmMessage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-indigo-600">
            Check your email
          </h1>
          <p className="mt-3 text-slate-700">{confirmMessage}</p>
          <p className="mt-2 text-sm text-slate-500">
            We sent a confirmation link to{" "}
            <span className="font-medium text-slate-700">{email.trim()}</span>.
            Click it, then come back and log in.
          </p>
          <button
            type="button"
            onClick={() => {
              setConfirmMessage(null);
              switchMode("login");
            }}
            className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
          >
            Back to log in
          </button>
        </div>
      </main>
    );
  }

  const isLogin = mode === "login";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-indigo-600">
          {isLogin ? "Log in" : "Sign up"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isLogin
            ? "Welcome back to firstconvos."
            : "Create an account to start learning."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              // Tells the browser's password manager whether to offer a saved
              // password or to suggest a new one.
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
            />
            {!isLogin && (
              <p className="mt-1 text-xs text-slate-500">
                At least 6 characters.
              </p>
            )}
          </div>

          {error && (
            // role="alert" so screen readers announce the failure.
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {submitting
              ? isLogin
                ? "Logging in..."
                : "Creating account..."
              : isLogin
                ? "Log in"
                : "Sign up"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          {isLogin ? "No account yet?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => switchMode(isLogin ? "signup" : "login")}
            disabled={submitting}
            className="font-medium text-indigo-600 underline disabled:text-slate-400"
          >
            {isLogin ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </main>
  );
}
