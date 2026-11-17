import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth-context";

/**
 * Wrap any route that should require a login.
 *
 * While we're still restoring the saved session we show a loading screen. That
 * matters: without it there's a split second where user === null and the app
 * would bounce a logged-in person to /login on every refresh.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  if (!user) {
    // `state` remembers where they were headed so the login screen can send
    // them back there afterwards. `replace` keeps /login out of the back button.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
