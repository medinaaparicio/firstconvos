import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { normalize } from "./normalize";

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

  function logLandmarks() {
    const hand = latestHandRef.current;
    if (!hand) {
      console.log("No hand visible");
      return;
    }
    // Keep only x, y, z (MediaPipe also adds a "visibility" field).
    const points = hand.map(({ x, y, z }) => ({ x, y, z }));
    console.log("Raw:");
    console.table(points); // readable grid in the browser console
    console.log(JSON.stringify(points)); // easy to copy

    const video = videoRef.current!;
    const normalized = normalize(points, video.videoWidth / video.videoHeight);
    console.log("Normalized (wrist = origin, palm = 1):");
    console.table(normalized);
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
    </div>
  );
}
