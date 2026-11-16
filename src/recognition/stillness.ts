/**
 * Detects when a hand has been held still (same shape, same place) for a
 * while. Used to record samples now, and later to decide when the user is
 * "submitting" a sign, so the app doesn't judge the hand mid-movement.
 *
 * Plain TypeScript: feed it one frame at a time with push().
 */
import { WRIST } from "./normalize";
import type { Point3 } from "./normalize";

export type HandFrame = {
  /** MediaPipe points as returned (x, y as 0..1 of the video). */
  raw: Point3[];
  /** Output of normalize(). */
  normalized: Point3[];
};

export type StillnessOptions = {
  /** How long the hand must stay still, in milliseconds. */
  holdMs: number;
  /** Max average point movement in normalized units (palm length = 1). */
  shapeTolerance: number;
  /** Max wrist movement as a fraction of the video size. */
  moveTolerance: number;
};

// Starting values; tune them by feel. Tracking jitter is a few hundredths.
export const DEFAULT_STILLNESS: StillnessOptions = {
  holdMs: 3000,
  shapeTolerance: 0.15,
  moveTolerance: 0.05,
};

export type StillnessUpdate = {
  /** 0..1, how far through the current hold we are. */
  progress: number;
  /** Set on the one frame a hold completes: the average pose of the hold. */
  pose: Point3[] | null;
  /** true after a hold completes, until the hand changes or leaves. */
  waitingForMove: boolean;
};

export type StillnessDetector = {
  push(frame: HandFrame | null, timeMs: number): StillnessUpdate;
  reset(): void;
};

export function createStillnessDetector(
  options: StillnessOptions = DEFAULT_STILLNESS,
): StillnessDetector {
  let anchor: HandFrame | null = null; // first frame of the current hold
  let startMs = 0;
  let run: Point3[][] = []; // normalized frames in the current hold
  // After a hold completes, the hand must change before the next one starts,
  // so keeping still doesn't record the same pose over and over.
  let lastHold: HandFrame | null = null;

  function changed(a: HandFrame, b: HandFrame): boolean {
    const wristMove = Math.hypot(
      a.raw[WRIST].x - b.raw[WRIST].x,
      a.raw[WRIST].y - b.raw[WRIST].y,
    );
    return (
      shapeDistance(a.normalized, b.normalized) > options.shapeTolerance ||
      wristMove > options.moveTolerance
    );
  }

  function reset() {
    anchor = null;
    run = [];
    lastHold = null;
  }

  function push(frame: HandFrame | null, timeMs: number): StillnessUpdate {
    if (!frame) {
      reset(); // hand left the view: start over
      return { progress: 0, pose: null, waitingForMove: false };
    }

    if (lastHold) {
      if (!changed(frame, lastHold)) {
        return { progress: 0, pose: null, waitingForMove: true };
      }
      lastHold = null;
    }

    if (!anchor || changed(frame, anchor)) {
      anchor = frame;
      startMs = timeMs;
      run = [];
    }
    run.push(frame.normalized);

    const progress = Math.min(1, (timeMs - startMs) / options.holdMs);
    if (progress < 1) {
      return { progress, pose: null, waitingForMove: false };
    }

    const pose = averagePoses(run);
    lastHold = anchor;
    anchor = null;
    run = [];
    return { progress: 1, pose, waitingForMove: false };
  }

  return { push, reset };
}

/** Average distance between matching points of two poses. */
export function shapeDistance(a: readonly Point3[], b: readonly Point3[]): number {
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    total += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y, a[i].z - b[i].z);
  }
  return total / a.length;
}

/** Point-by-point average of several poses (smooths out jitter). */
export function averagePoses(poses: readonly Point3[][]): Point3[] {
  return poses[0].map((_, i) => {
    let x = 0, y = 0, z = 0;
    for (const pose of poses) {
      x += pose[i].x;
      y += pose[i].y;
      z += pose[i].z;
    }
    const n = poses.length;
    return { x: x / n, y: y / n, z: z / n };
  });
}
