import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

/**
 * What signIn / signUp / signOut hand back.
 *
 * We deliberately do NOT throw on a failed login. A wrong password is a normal
 * thing for a user to do, not a crash, so the UI gets a result object it can
 * render as a message.
 */
export type AuthResult = {
  /** true when the call did what was asked. */
  ok: boolean;
  /** Something safe to show the user, success or failure. */
  message?: string;
  /**
   * true when the account was created but Supabase is waiting on the user to
   * click the link in their email. Not an error -- just not logged in yet.
   */
  needsEmailConfirmation?: boolean;
};

export type AuthContextValue = {
  /** The logged-in user, or null when logged out. */
  user: User | null;
  /** The full session (includes the access token). null when logged out. */
  session: Session | null;
  /**
   * true until we've finished asking Supabase "is there a saved session?".
   * Screens should wait on this instead of assuming logged out.
   */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Read the auth state from anywhere below <AuthProvider>.
 * Example:  const { user, signOut } = useAuth();
 */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth() must be called inside <AuthProvider>.");
  }
  return value;
}
