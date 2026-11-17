/**
 * useHandTracker: the one React piece of src/recognition/.
 *
 * Opens the webcam, runs MediaPipe Hand Landmarker on every frame, and
 * reports a RecognitionResult for the target letter. Usage:
 *
 *   const { videoRef, canvasRef, result, held } = useHandTracker("B");
 *   <video ref={videoRef} playsInline muted />
 *   <canvas ref={canvasRef} />        // optional: draws the hand skeleton
 *
 * - result: live, updated every frame (flickers while the hand moves).
 * - held:   result of the last still hold (DEFAULT_STILLNESS.holdMs). This
 *           is what Learn and Play should judge. Cleared when the hand
 *           leaves the view or the target changes.
 *
 * Coordinates are the camera's un-mirrored view. If you mirror the video
 * for display, mirror the canvas the same way (CSS: -scale-x-100).
 */
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { DrawingUtils, FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { Letter, RecognitionResult } from "../types";
import { flattenSamples } from "./classify";
import { normalize } from "./normalize";
import { NO_HAND, recognize } from "./recognize";
import { RECORDED_SAMPLES } from "./samples";
import { createStillnessDetector } from "./stillness";
import type { HandFrame } from "./stillness";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const REFERENCES = flattenSamples(RECORDED_SAMPLES);

export type HandTrackerOptions = {
  /** Called on every processed frame (null = no hand). For dev tools. */
  onFrame?: (frame: HandFrame | null, timeMs: number) => void;
};

export type HandTracker = {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  status: "loading" | "ready" | "error";
  error: string | null;
  result: RecognitionResult;
  held: RecognitionResult | null;
  /** 0..1 progress toward the next held result. */
  holdProgress: number;
};

export function useHandTracker(
  target: Letter | null,
  options: HandTrackerOptions = {},
): HandTracker {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<HandTracker["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecognitionResult>(NO_HAND);
  const [held, setHeld] = useState<RecognitionResult | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);

  // The frame loop is set up once, so it reads the latest values from refs
  // instead of seeing stale ones. The effects below keep the refs current.
  const targetRef = useRef(target);
  const onFrameRef = useRef(options.onFrame);
  useEffect(() => {
    targetRef.current = target;
  }, [target]);
  useEffect(() => {
    onFrameRef.current = options.onFrame;
  }, [options.onFrame]);

  useEffect(() => {
    let cancelled = false;
    // Each resource is stored here only once start() owns it, and cleanup
    // releases exactly what's stored, so nothing is closed twice.
    let landmarker: HandLandmarker | null = null;
    let stream: MediaStream | null = null;
    let rafId = 0;
    let lastVideoTime = -1;
    let lastTarget = targetRef.current;
    const detector = createStillnessDetector();

    async function start() {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        const lm = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
        if (cancelled) return lm.close();
        landmarker = lm;

        const s = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        await video.play();
        if (cancelled) return;
        setStatus("ready");
        loop();
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    function loop() {
      // One bad frame shouldn't stop tracking for good.
      try {
        processFrame();
      } catch (err) {
        console.error(err);
      }
      rafId = requestAnimationFrame(loop);
    }

    function processFrame() {
      const video = videoRef.current;
      if (!video || !landmarker || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;

      const now = performance.now();
      const detected = landmarker.detectForVideo(video, now);
      const hand = detected.landmarks[0] ?? null;
      const frame = hand ? toFrame(hand, video) : null;
      const target = targetRef.current;

      // A new target means a new attempt: forget the previous hold.
      if (target !== lastTarget) {
        lastTarget = target;
        detector.reset();
        setHeld(null);
      }

      // Live result. Returning `prev` unchanged tells React not to redraw.
      const live = rounded(recognize(frame?.normalized ?? null, target, REFERENCES));
      setResult((prev) => (sameResult(prev, live) ? prev : live));

      // Held result: recognize the averaged pose once a still hold completes.
      const update = detector.push(frame, now);
      setHoldProgress(Math.round(update.progress * 20) / 20);
      if (update.pose) setHeld(recognize(update.pose, target, REFERENCES));
      if (!frame) setHeld(null);

      onFrameRef.current?.(frame, now);
      draw(detected.landmarks);
    }

    function draw(hands: NormalizedLandmark[][]) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const drawing = new DrawingUtils(ctx);
      for (const hand of hands) {
        drawing.drawConnectors(hand, HandLandmarker.HAND_CONNECTIONS, {
          color: "#6366f1",
          lineWidth: 3,
        });
        drawing.drawLandmarks(hand, { color: "#ffffff", radius: 3 });
      }
    }

    start();

    // Cleanup: runs when the component using the hook goes away (and on
    // hot reload). Stops the loop, the camera, and the model.
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
      landmarker?.close();
    };
  }, []);

  return { videoRef, canvasRef, status, error, result, held, holdProgress };
}

/** MediaPipe hand -> raw + normalized points. */
export function toFrame(hand: NormalizedLandmark[], video: HTMLVideoElement): HandFrame {
  // Keep only x, y, z (MediaPipe also adds a "visibility" field).
  const raw = hand.map(({ x, y, z }) => ({ x, y, z }));
  return { raw, normalized: normalize(raw, video.videoWidth / video.videoHeight) };
}

/** Round confidence to 5% steps so tiny wobbles don't cause redraws. */
function rounded(r: RecognitionResult): RecognitionResult {
  return { ...r, confidence: Math.round(r.confidence * 20) / 20 };
}

function sameResult(a: RecognitionResult, b: RecognitionResult): boolean {
  return (
    a.letter === b.letter &&
    a.confidence === b.confidence &&
    a.correct === b.correct &&
    a.feedback === b.feedback
  );
}
