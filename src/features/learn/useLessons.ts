import { useCallback, useEffect, useState } from "react";
import type { Letter } from "../../types";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../app/auth-context";

export type Lessons = {
  /** All lesson letters, in lesson order (sort_order). */
  letters: Letter[];
  /** Letters this user has completed. */
  completed: Letter[];
  loading: boolean;
  error: string | null;
  /** Save a completed lesson. Resolves to an error message, or null on success. */
  markComplete: (letter: Letter) => Promise<string | null>;
};

type Loaded = { userId: string; letters: Letter[]; completed: Letter[]; error: string | null };

/**
 * Loads the lesson list and the user's progress, and saves completions.
 * Same approach as useProgress on the home screen: the loaded data is
 * tagged with the user it belongs to, and "loading" is derived from that.
 */
export function useLessons(): Lessons {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    if (authLoading || !userId || data?.userId === userId) return;
    let active = true; // ignore answers that arrive after the user changed

    async function load(currentUserId: string) {
      const [lessons, progress] = await Promise.all([
        supabase.from("lessons").select("letter").order("sort_order"),
        supabase.from("lesson_progress").select("letter").eq("user_id", currentUserId),
      ]);
      if (!active) return;
      const error = lessons.error?.message ?? progress.error?.message ?? null;
      setData({
        userId: currentUserId,
        letters: error ? [] : (lessons.data ?? []).map((r) => r.letter as Letter),
        completed: error ? [] : (progress.data ?? []).map((r) => r.letter as Letter),
        error,
      });
    }

    void load(userId);
    return () => {
      active = false;
    };
  }, [authLoading, userId, data]);

  const markComplete = useCallback(
    async (letter: Letter): Promise<string | null> => {
      // user_id is filled in by the database (default auth.uid()).
      const { error } = await supabase.from("lesson_progress").insert({ letter });
      // 23505 = already saved (duplicate row). That still counts as done.
      if (error && error.code !== "23505") return error.message;
      setData((prev) =>
        prev && !prev.completed.includes(letter)
          ? { ...prev, completed: [...prev.completed, letter] }
          : prev,
      );
      return null;
    },
    [],
  );

  const fresh = data !== null && data.userId === userId;
  return {
    letters: fresh ? data.letters : [],
    completed: fresh ? data.completed : [],
    loading: authLoading || (userId !== null && !fresh),
    error: fresh ? data.error : null,
    markComplete,
  };
}
