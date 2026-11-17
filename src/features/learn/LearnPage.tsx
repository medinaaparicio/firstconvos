import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Letter } from "../../types";
import { MIN_CONFIDENCE } from "../../recognition/classify";
import { RECORDED_SAMPLES } from "../../recognition/samples";
import { useHandTracker } from "../../recognition/useHandTracker";
import { useLessons } from "./useLessons";

const RECOGNIZED = new Set(RECORDED_SAMPLES.map((f) => f.letter));

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-xl rounded-xl bg-white p-6 shadow-sm">
        <Link to="/" className="text-sm text-indigo-600 hover:underline">
          ← Home
        </Link>
        {children}
      </div>
    </main>
  );
}

export function LearnPage() {
  const { letters, completed, loading, error, markComplete } = useLessons();
  // The letter just signed correctly, kept on screen until "Next" is pressed.
  const [justDone, setJustDone] = useState<Letter | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const nextLetter = letters.find((l) => !completed.includes(l)) ?? null;
  const target = justDone ?? nextLetter;

  // While showing "Correct!", pass null so recognition doesn't judge again.
  const { videoRef, canvasRef, status, error: cameraError, held, holdProgress } =
    useHandTracker(justDone ? null : target);

  // When a still hold is recognized as correct, save the lesson.
  // useEffect runs after React draws; [held] means "whenever held changes".
  useEffect(() => {
    if (!held?.correct || !target || justDone) return;
    const letter = target;
    void markComplete(letter).then((message) => {
      if (message) setSaveError(message);
      else {
        setSaveError(null);
        setJustDone(letter);
      }
    });
    // Only a new held result should trigger a save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held]);

  if (loading) return <Shell><p className="mt-6 text-slate-500">Loading lessons...</p></Shell>;
  if (error) {
    return (
      <Shell>
        <p role="alert" className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      </Shell>
    );
  }
  if (!target) {
    return (
      <Shell>
        <h1 className="mt-4 text-2xl font-bold text-indigo-600">All lessons done!</h1>
        <p className="mt-2 text-slate-600">Play is unlocked on the home screen.</p>
      </Shell>
    );
  }

  const lessonNumber = letters.indexOf(target) + 1;

  return (
    <Shell>
      <div className="mt-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-slate-800">
          Sign <span className="text-indigo-600">{target}</span>
        </h1>
        <p className="text-sm text-slate-500">
          Lesson {lessonNumber} of {letters.length} · {completed.length} done
        </p>
      </div>

      {!RECOGNIZED.has(target) && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No recorded samples for {target} yet, so it can't be recognized.
        </p>
      )}

      <div className="relative mt-4 overflow-hidden rounded-xl bg-slate-900">
        {/* Mirrored for display only, like a mirror. */}
        <video ref={videoRef} className="block w-full -scale-x-100" playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full -scale-x-100" />
        {status !== "ready" && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
            {status === "loading" ? "Starting camera..." : `Camera error: ${cameraError}`}
          </p>
        )}
      </div>

      {justDone ? (
        <div className="mt-4 rounded-lg bg-green-50 p-4">
          <p className="text-lg font-semibold text-green-700">Correct! {justDone} is done.</p>
          <button
            type="button"
            onClick={() => setJustDone(null)}
            className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700"
          >
            {nextLetter ? `Next: ${nextLetter}` : "Finish"}
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-indigo-500 transition-[width] duration-100"
              style={{ width: `${holdProgress * 100}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Make the sign with your right hand and hold it still for 3 seconds.
          </p>
          {held && !held.correct && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
              Not quite
              {held.letter && held.confidence >= MIN_CONFIDENCE ? ` (that looked like ${held.letter})` : ""}
              {held.feedback ? `: ${held.feedback}.` : ". Try again."}
            </p>
          )}
          {saveError && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Couldn't save your progress: {saveError}
            </p>
          )}
        </div>
      )}
    </Shell>
  );
}
