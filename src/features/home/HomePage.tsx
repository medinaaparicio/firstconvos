import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/auth-context";
import { useProgress } from "./useProgress";

/** Card shell so the page stays centered and readable at phone width. */
function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-sm rounded-xl bg-white p-6 shadow-sm">
        {children}
      </div>
    </main>
  );
}

export function HomePage() {
  const { user, signOut } = useAuth();
  const { completed, total, playUnlocked, loading, error } = useProgress();
  const navigate = useNavigate();

  // Play is enabled only on a clean, finished load. Written as one expression
  // so there's no path where a later edit accidentally leaves it on.
  const playEnabled = !loading && error === null && playUnlocked;

  return (
    <Shell>
      <h1 className="text-2xl font-bold text-indigo-600">firstconvos</h1>
      <p className="mt-1 truncate text-sm text-slate-500">{user?.email}</p>

      {/* --- Progress line: one of three states --- */}
      <div className="mt-6">
        {loading ? (
          <p className="text-slate-500">Loading your progress...</p>
        ) : error ? (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        ) : (
          <p className="text-lg font-medium text-slate-800">
            {completed} of {total}{" "}
            {total === 1 ? "lesson" : "lessons"} complete
          </p>
        )}
      </div>

      {/* --- Actions --- */}
      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={() => navigate("/learn")}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700"
        >
          Learn
        </button>

        <button
          type="button"
          onClick={() => navigate("/play")}
          disabled={!playEnabled}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:hover:bg-slate-200"
        >
          Play
        </button>

        {!playEnabled && !loading && (
          <p className="text-center text-sm text-slate-500">
            {error
              ? "Play is unavailable until your progress loads."
              : "Complete all lessons to unlock Play."}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-8 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        Sign out
      </button>
    </Shell>
  );
}
