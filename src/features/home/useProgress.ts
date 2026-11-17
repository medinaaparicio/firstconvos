import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../app/auth-context";

export type Progress = {
  /** How many lessons this user has finished. Counted from rows, never stored. */
  completed: number;
  /** How many lessons exist in total. */
  total: number;
  /** true only when there are lessons and the user has finished every one. */
  playUnlocked: boolean;
  /** true while we're still working out who the user is, or still counting. */
  loading: boolean;
  /** A message to show if either count failed. null when all is well. */
  error: string | null;
};

/** The answer we got back, tagged with who it was about. */
type Counts = {
  userId: string;
  completed: number;
  total: number;
  error: string | null;
};

/**
 * Counts the user's lesson progress.
 *
 * Deliberately derived, never stored: every load asks the database "how many
 * lesson rows are there, and how many progress rows does this user have?" There
 * is no counter in state and no count column in the database, so there is
 * nothing that can drift out of step with the real rows.
 *
 * Both queries use { count: "exact", head: true }. `head: true` means "don't
 * send me the rows, just the number" -- we only want a tally, so there's no
 * reason to download five (eventually twenty-six) rows to measure their length.
 *
 * Note the one piece of state: the finished answer, tagged with the user id it
 * belongs to. "Are we loading?" is then worked out by comparing that tag to the
 * current user, rather than being a second flag we have to remember to flip.
 * Two flags that must agree are two flags that can disagree.
 */
export function useProgress(): Progress {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    // Nothing to do until we know who the user is, and nothing to count when
    // there isn't one. Both cases are handled in the derived values below.
    if (authLoading || !userId) return;

    // Already have the answer for this user -- don't re-query on every render.
    if (counts?.userId === userId) return;

    // If the user changes (or the component unmounts) while these queries are
    // in flight, the old answers must not overwrite the new state.
    let active = true;

    async function loadCounts(currentUserId: string) {
      // Both counts at once rather than one after the other -- they don't
      // depend on each other, so waiting for the first to finish is wasted time.
      const [lessonsResult, progressResult] = await Promise.all([
        supabase.from("lessons").select("*", { count: "exact", head: true }),
        supabase
          .from("lesson_progress")
          .select("*", { count: "exact", head: true })
          .eq("user_id", currentUserId),
      ]);

      if (!active) return;

      if (lessonsResult.error || progressResult.error) {
        setCounts({
          userId: currentUserId,
          // Zero the counts so a half-finished load can't read as real
          // progress, and so playUnlocked below can't be true off the back
          // of a failure.
          completed: 0,
          total: 0,
          error:
            lessonsResult.error?.message ??
            progressResult.error?.message ??
            "Could not load your progress.",
        });
        return;
      }

      setCounts({
        userId: currentUserId,
        completed: progressResult.count ?? 0,
        total: lessonsResult.count ?? 0,
        error: null,
      });
    }

    void loadCounts(userId);

    return () => {
      active = false;
    };
  }, [userId, authLoading, counts]);

  // Is the answer we're holding about the user we currently have?
  const fresh = counts !== null && counts.userId === userId;

  const completed = fresh ? counts.completed : 0;
  const total = fresh ? counts.total : 0;
  const error = fresh ? counts.error : null;

  const loading = authLoading
    ? true
    : // Logged out: nothing to wait for. ProtectedRoute means this shouldn't
      // happen on the home page, but a hook shouldn't assume where it's used.
      userId === null
      ? false
      : !fresh;

  return {
    completed,
    total,
    // Four conditions, all required. `total > 0` matters: with an empty lessons
    // table 0 === 0 would otherwise unlock Play for everyone. A failed or
    // unfinished load must never unlock it either.
    playUnlocked: !loading && error === null && total > 0 && completed === total,
    loading,
    error,
  };
}
