import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { AuthContext } from "./auth-context";
import type { AuthContextValue, AuthResult } from "./auth-context";

/**
 * Holds the logged-in user for the whole app.
 *
 * Two things keep it in sync with Supabase:
 *  1. On first render we ask for any session saved in localStorage, so a page
 *     refresh doesn't log you out.
 *  2. onAuthStateChange fires on every login, logout, token refresh, and even
 *     in another browser tab -- so all of those update this state too.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If the component unmounts while getSession() is still in flight, we must
    // not call setState afterwards -- React warns about that.
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      // Once we've heard from Supabase at all, we're no longer "figuring it out".
      setLoading(false);
    });

    // Cleanup: stop listening when this provider goes away.
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        return { ok: false, message: error.message };
      }
      // No setSession() here on purpose: onAuthStateChange above will fire and
      // do it, so there is only ever one place that writes this state.
      return { ok: true };
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        return { ok: false, message: error.message };
      }

      // If email confirmation is turned on in the Supabase dashboard, signUp
      // succeeds but hands back no session -- the user is created and waiting.
      // That is a success with a different next step, not an error.
      if (!data.session) {
        return {
          ok: true,
          needsEmailConfirmation: true,
          message: "Check your email to confirm your account, then sign in.",
        };
      }

      return { ok: true, message: "Account created." };
    },
    [],
  );

  const signOut = useCallback(async (): Promise<AuthResult> => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true };
  }, []);

  // useMemo so the context value isn't a brand-new object on every render,
  // which would re-render every screen that calls useAuth().
  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      signIn,
      signUp,
      signOut,
    }),
    [session, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
