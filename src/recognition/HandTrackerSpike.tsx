import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { normalize } from "./normalize";
import type { Point3 } from "./normalize";

/** What the "Log landmarks" button captured, shown under the video. */
type Snapshot = { raw: Point3[]; normalized: Point3[] } | "no-hand" | null;

const POINT_NAMES = [
  "wrist",
  "thumb 1", "thumb 2", "thumb 3", "thumb tip",
  "index base", "index 2", "index 3", "index tip",
  "middle base", "middle 2", "middle 3", "middle tip",
  "ring base", "ring 2", "ring 3", "ring tip",
  "pinky base", "pinky 2", "pinky 3", "pinky tip",
];

const fmt = (n: number) => n.toFixed(2);

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export default function HandTrackerSpike() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Loading hand model...");
  // Latest detected hand (21 points), or null if no hand is visible.
  // A ref, not state: it changes every frame and nothing on screen shows it,
  // so there's no reason to make React redraw.
  const latestHandRef = useRef<NormalizedLandmark[] | null>(null);
  // The snapshot IS shown on screen, so it's state: setting it redraws the table.
  const [snapshot, setSnapshot] = useState<Snapshot>(null);

  function logLandmarks() {
    const hand = latestHandRef.current;
    if (!hand) {
      setSnapshot("no-hand");
      return;
    }
    // Keep only x, y, z (MediaPipe also adds a "visibility" field).
    const raw = hand.map(({ x, y, z }) => ({ x, y, z }));
    const video = videoRef.current!;
    const normalized = normalize(raw, video.videoWidth / video.videoHeight);
    setSnapshot({ raw, normalized });
  }

  useEffect(() => {
    let cancelled = false;
    let landmarker: HandLandmarker | null = null;
    let stream: MediaStream | null = null;
    let rafId = 0;
    let lastVideoTime = -1;

    async function start() {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        });

        // React dev mode mounts twice; bail out if we were already cleaned up
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          landmarker.close();
          return;
        }

        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setStatus("Show your hand to the camera");
        loop();
      } catch (err) {
        setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    function loop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && landmarker && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const result = landmarker.detectForVideo(video, performance.now());
        latestHandRef.current = result.landmarks[0] ?? null;

        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const drawing = new DrawingUtils(ctx);
        for (const hand of result.landmarks) {
          drawing.drawConnectors(hand, HandLandmarker.HAND_CONNECTIONS, {
            color: "#6366f1",
            lineWidth: 3,
          });
          drawing.drawLandmarks(hand, { color: "#ffffff", radius: 3 });
        }
      }
      rafId = requestAnimationFrame(loop);
    }

    start();

    // cleanup: runs when the component goes away
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
      landmarker?.close();
    };
  }, []);

  return (
    <div className="p-8">
      <div className="mb-4 flex items-center gap-4">
        <p className="text-slate-600">{status}</p>
        <button
          type="button"
          onClick={logLandmarks}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Log landmarks
        </button>
      </div>
      <div className="relative w-[640px] max-w-full overflow-hidden rounded-xl bg-slate-900">
        {/* -scale-x-100 mirrors the view so it feels like a mirror */}
        <video ref={videoRef} className="block w-full -scale-x-100" playsInline muted />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full -scale-x-100"
        />
      </div>

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
