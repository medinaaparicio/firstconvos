/**
 * Developer page for Track A: live hand tracking, a landmark inspector, and
 * the sample capture tool. Camera and recognition come from useHandTracker.
 */
import { useRef, useState } from "react";
import type { Letter } from "../types";
import { MIN_CONFIDENCE } from "./classify";
import type { Point3 } from "./normalize";
import {
  downloadJson,
  makeSampleFile,
  SAMPLES_PER_LETTER,
  STARTER_LETTERS,
} from "./samples";
import { createStillnessDetector, DEFAULT_STILLNESS } from "./stillness";
import type { HandFrame } from "./stillness";
import { useHandTracker } from "./useHandTracker";

/** What the "Log landmarks" button captured, shown under the video. */
type Snapshot = HandFrame | "no-hand" | null;

/** Recorded samples so far, per letter. */
type SampleMap = Partial<Record<Letter, Point3[][]>>;

const POINT_NAMES = [
  "wrist",
  "thumb 1", "thumb 2", "thumb 3", "thumb tip",
  "index base", "index 2", "index 3", "index tip",
  "middle base", "middle 2", "middle 3", "middle tip",
  "ring base", "ring 2", "ring 3", "ring tip",
  "pinky base", "pinky 2", "pinky 3", "pinky tip",
];

const fmt = (n: number) => n.toFixed(2);

export default function HandTrackerSpike() {
  // Latest hand seen by the tracker. A ref: it changes every frame and is
  // only read when the button is clicked, so no redraw is needed.
  const latestFrameRef = useRef<HandFrame | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>(null);

  // --- Capture tool state ---
  const [letter, setLetter] = useState<Letter>(STARTER_LETTERS[0]);
  const [capturing, setCapturing] = useState(false);
  const detectorRef = useRef(createStillnessDetector());
  const [holdProgress, setHoldProgress] = useState(0);
  const [waitingForMove, setWaitingForMove] = useState(false);
  const [samples, setSamples] = useState<SampleMap>({});

  // No target letter: the spike just shows the best guess.
  const { videoRef, canvasRef, status: trackerStatus, error, result: guess } = useHandTracker(null, {
    // useHandTracker always calls the latest version of this function, so it
    // sees current state (capturing, letter) without extra refs.
    onFrame(frame, timeMs) {
      latestFrameRef.current = frame;
      if (!capturing) return;
      const update = detectorRef.current.push(frame, timeMs);
      setHoldProgress(Math.round(update.progress * 20) / 20);
      setWaitingForMove(update.waitingForMove);
      const pose = update.pose;
      if (pose) {
        setSamples((prev) => ({ ...prev, [letter]: [...(prev[letter] ?? []), pose] }));
      }
    },
  });

  const count = samples[letter]?.length ?? 0;

  function logLandmarks() {
    setSnapshot(latestFrameRef.current ?? "no-hand");
  }

  function startStopCapture() {
    setCapturing(!capturing);
    detectorRef.current.reset();
    setHoldProgress(0);
    setWaitingForMove(false);
  }

  function chooseLetter(next: Letter) {
    setLetter(next);
    detectorRef.current.reset();
    setHoldProgress(0);
  }

  function undoLast() {
    // Passing a function to a state setter means "compute the new value from
    // the latest old value", which is safe even if several updates queue up.
    setSamples((prev) => ({ ...prev, [letter]: (prev[letter] ?? []).slice(0, -1) }));
  }

  function save() {
    downloadJson(`${letter}.json`, makeSampleFile(letter, samples[letter] ?? []));
  }

  const status =
    trackerStatus === "loading"
      ? "Loading hand model..."
      : trackerStatus === "error"
        ? `Error: ${error}`
        : "Show your hand to the camera";

  const button =
    "rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40";
  const primary = `${button} bg-indigo-600 text-white hover:bg-indigo-700`;
  const secondary = `${button} border border-slate-300 text-slate-700 hover:bg-slate-50`;

  let captureMessage = "Press Start, then hold the sign still.";
  if (capturing) {
    captureMessage = waitingForMove
      ? "Saved! Change your angle or distance a little, then hold again."
      : `Hold still for ${DEFAULT_STILLNESS.holdMs / 1000} seconds...`;
  }

  return (
    <div className="p-8">
      <div className="mb-4 flex items-center gap-4">
        <p className="text-slate-600">{status}</p>
        <button type="button" onClick={logLandmarks} className={primary}>
          Log landmarks
        </button>
      </div>
      <p className="mb-4 text-lg text-slate-800">
        Guess:{" "}
        {guess.letter === null ? (
          <span className="text-slate-400">no hand</span>
        ) : guess.confidence >= MIN_CONFIDENCE ? (
          <span className="font-bold text-indigo-600">
            {guess.letter} ({Math.round(guess.confidence * 100)}%)
          </span>
        ) : (
          <span className="text-slate-500">
            not sure (closest: {guess.letter}, {Math.round(guess.confidence * 100)}%)
          </span>
        )}
      </p>
      <div className="relative w-[640px] max-w-full overflow-hidden rounded-xl bg-slate-900">
        {/* -scale-x-100 mirrors the view so it feels like a mirror */}
        <video
          ref={videoRef}
          className="block w-full -scale-x-100"
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full -scale-x-100"
        />
      </div>

      {/* --- Capture tool --- */}
      <section className="mt-6 w-[640px] max-w-full rounded-xl border border-slate-200 p-4">
        <h2 className="font-semibold text-slate-800">Capture samples (right hand)</h2>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-sm text-slate-600">
            Letter{" "}
            <select
              value={letter}
              onChange={(e) => chooseLetter(e.target.value as Letter)}
              className="rounded-lg border border-slate-300 px-2 py-1"
            >
              {STARTER_LETTERS.map((l) => (
                <option key={l} value={l}>
                  {l} ({samples[l]?.length ?? 0}/{SAMPLES_PER_LETTER})
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={startStopCapture} className={primary}>
            {capturing ? "Stop" : "Start"}
          </button>
          <button type="button" onClick={undoLast} disabled={count === 0} className={secondary}>
            Undo last
          </button>
          <button type="button" onClick={save} disabled={count === 0} className={secondary}>
            Save {letter}.json
          </button>
        </div>

        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-indigo-500 transition-[width] duration-100"
            style={{ width: `${(capturing ? holdProgress : 0) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-slate-600">{captureMessage}</p>
        <p className="mt-1 text-sm font-medium text-slate-800">
          {letter}: {count} / {SAMPLES_PER_LETTER}
          {count >= SAMPLES_PER_LETTER && " ✓ done. Save, then pick the next letter."}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Saving downloads the file. Move it into src/recognition/samples/.
        </p>
      </section>

      {/* --- Snapshot from the "Log landmarks" button --- */}
      {snapshot === "no-hand" && (
        <p className="mt-4 text-slate-600">No hand visible. Hold your hand up and try again.</p>
      )}
      {snapshot && snapshot !== "no-hand" && (
        <div className="mt-4 w-[640px] max-w-full overflow-x-auto">
          <table className="w-full text-right font-mono text-xs text-slate-700">
            <thead className="text-slate-500">
              <tr>
                <th className="text-left font-normal">point</th>
                <th colSpan={3} className="font-normal">raw x, y, z</th>
                <th colSpan={3} className="font-normal">normalized x, y, z</th>
              </tr>
            </thead>
            <tbody>
              {/* .map turns each point into a table row; key lets React tell rows apart */}
              {snapshot.raw.map((p, i) => {
                const n = snapshot.normalized[i];
                return (
                  <tr key={i} className="odd:bg-slate-50">
                    <td className="text-left">{i} {POINT_NAMES[i]}</td>
                    <td>{fmt(p.x)}</td>
                    <td>{fmt(p.y)}</td>
                    <td>{fmt(p.z)}</td>
                    <td className="pl-4">{fmt(n.x)}</td>
                    <td>{fmt(n.y)}</td>
                    <td>{fmt(n.z)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
