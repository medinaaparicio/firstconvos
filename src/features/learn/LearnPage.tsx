import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Letter } from "../../types";
import { MIN_CONFIDENCE } from "../../recognition/classify";
import { RECORDED_SAMPLES } from "../../recognition/samples";
import { useHandTracker } from "../../recognition/useHandTracker";
import { HINTS } from "./hints";
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

/** Row of lesson letters; completed ones get a check mark. */
function LetterPicker(props: {
  letters: Letter[];
  completed: Letter[];
  current: Letter | null;
  onPick: (letter: Letter) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {props.letters.map((l) => {
        const done = props.completed.includes(l);
        const selected = l === props.current;
        return (
          <button
            key={l}
            type="button"
            onClick={() => props.onPick(l)}
            aria-pressed={selected}
            className={`min-w-12 rounded-lg border px-3 py-2 font-semibold ${
              selected
                ? "border-indigo-600 bg-indigo-600 text-white"
                : done
                  ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {l}
            {done && " ✓"}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Camera + recognition for one target letter. It's its own component so the
 * camera only runs while it's on screen: when it disappears, useHandTracker's
 * cleanup stops the camera. Changing `target` keeps the camera running.
 */
function Practice(props: { target: Letter; paused: boolean; onCorrect: () => void }) {
  // While paused (showing "Correct!"), pass null so nothing gets judged.
  const { videoRef, canvasRef, status, error, held, holdProgress } = useHandTracker(
    props.paused ? null : props.target,
  );

  // useEffect runs after React draws; [held] means "whenever held changes",
  // i.e. each time a 3-second still hold finishes.
  useEffect(() => {
    if (held?.correct) props.onCorrect();
    // Only a new held result should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held]);

  return (
    <>
      <div className="relative mt-4 overflow-hidden rounded-xl bg-slate-900">
        {/* Mirrored for display only, like a mirror. */}
        <video ref={videoRef} className="block w-full -scale-x-100" playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full -scale-x-100" />
        {status !== "ready" && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
            {status === "loading" ? "Starting camera..." : `Camera error: ${error}`}
          </p>
        )}
      </div>

      {!props.paused && (
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
              {held.letter && held.confidence >= MIN_CONFIDENCE
                ? ` (that looked like ${held.letter})`
                : ""}
              {held.feedback ? `: ${held.feedback}.` : ". Try again."}
            </p>
          )}
        </div>
      )}
    </>
  );
}

export function LearnPage() {
  const { letters, completed, loading, error, markComplete } = useLessons();
  // A letter the user picked; null means "the next unfinished one".
  const [chosen, setChosen] = useState<Letter | null>(null);
  // The letter just signed correctly, kept on screen until "Next" is pressed.
  const [justDone, setJustDone] = useState<Letter | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Which letter's hint is open. Storing the letter (not true/false) means
  // the hint closes by itself when the target letter changes.
  const [hintFor, setHintFor] = useState<Letter | null>(null);

  const nextLetter = letters.find((l) => !completed.includes(l)) ?? null;
  const target = justDone ?? chosen ?? nextLetter;

  function pick(letter: Letter) {
    setChosen(letter);
    setJustDone(null);
    setSaveError(null);
  }

  function next() {
    setJustDone(null);
    setChosen(null); // back to the next unfinished letter
  }

  function handleCorrect() {
    if (!target || justDone) return;
    const letter = target;
    void markComplete(letter).then((message) => {
      if (message) {
        setSaveError(message);
      } else {
        setSaveError(null);
        setJustDone(letter);
      }
    });
  }

  if (loading) {
    return (
      <Shell>
        <p className="mt-6 text-slate-500">Loading lessons...</p>
      </Shell>
    );
  }
  if (error) {
    return (
      <Shell>
        <p role="alert" className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      </Shell>
    );
  }

  const picker = (
    <LetterPicker letters={letters} completed={completed} current={target} onPick={pick} />
  );

  if (!target) {
    return (
      <Shell>
        <h1 className="mt-4 text-2xl font-bold text-indigo-600">All lessons done!</h1>
        <p className="mt-2 text-slate-600">
          Play is unlocked on the home screen. Pick a letter to practice:
        </p>
        {picker}
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mt-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-slate-800">
          Sign <span className="text-indigo-600">{target}</span>
        </h1>
        <p className="text-sm text-slate-500">
          {completed.length} of {letters.length} done
        </p>
      </div>
      {picker}

      {!RECOGNIZED.has(target) && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No recorded samples for {target} yet, so it can't be recognized.
        </p>
      )}

      <Practice target={target} paused={justDone !== null} onCorrect={handleCorrect} />

      {!justDone && HINTS[target] && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setHintFor(hintFor === target ? null : target)}
            aria-expanded={hintFor === target}
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            {hintFor === target ? "Hide hint" : "Show hint"}
          </button>
          {hintFor === target && (
            <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-slate-700">{HINTS[target]}</p>
          )}
        </div>
      )}

      {justDone && (
        <div className="mt-4 rounded-lg bg-green-50 p-4">
          <p className="text-lg font-semibold text-green-700">Correct! {justDone} is done.</p>
          <button
            type="button"
            onClick={next}
            className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700"
          >
            {nextLetter ? `Next: ${nextLetter}` : "Finish"}
          </button>
        </div>
      )}
      {saveError && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn't save your progress: {saveError}
        </p>
      )}
    </Shell>
  );
}
