/**
 * Per-finger feedback: compare the user's hand with the recorded samples
 * for the target letter and return one short hint for the biggest
 * difference, such as "curl your index finger more".
 *
 * Plain TypeScript. Works on normalized poses (see normalize.ts). The
 * measurements are angles and distances, which don't change when a hand is
 * mirrored, so this also works for left hands.
 */
import type { Letter } from "../types";
import type { LabeledPose } from "./classify";
import { MIDDLE_MCP, WRIST } from "./normalize";
import type { Point3 } from "./normalize";

type Finger = "thumb" | "index" | "middle" | "ring" | "pinky";

/** Landmark indices for each finger, from its base to its tip. */
const FINGER_POINTS: Record<Finger, number[]> = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};
const FINGER_NAMES: Record<Finger, string> = {
  thumb: "thumb",
  index: "index finger",
  middle: "middle finger",
  ring: "ring finger",
  pinky: "pinky",
};
const THUMB_TIP = 4;

export type HandFeatures = {
  /** Degrees of bend summed over the finger's joints. 0 = straight. */
  curl: Record<Finger, number>;
  /** Thumb tip distance from the middle-finger base, in palm lengths. */
  thumbOut: number;
};

/**
 * How big a difference must be before it's worth a hint. Recordings of the
 * same letter vary by roughly this much, so smaller gaps are just noise.
 */
export const CURL_TOLERANCE = 30; // degrees
export const THUMB_OUT_TOLERANCE = 0.3; // palm lengths

export function handFeatures(pose: readonly Point3[]): HandFeatures {
  const curl = {} as Record<Finger, number>;
  for (const finger of Object.keys(FINGER_POINTS) as Finger[]) {
    const [a, b, c, d] = FINGER_POINTS[finger].map((i) => pose[i]);
    // Thumb: bends at its two upper joints. Other fingers: also the knuckle,
    // measured from the wrist.
    const joints =
      finger === "thumb"
        ? [[a, b, c], [b, c, d]]
        : [[pose[WRIST], a, b], [a, b, c], [b, c, d]];
    curl[finger] = joints.reduce((sum, [p, q, r]) => sum + bendDegrees(p, q, r), 0);
  }
  return { curl, thumbOut: distance(pose[THUMB_TIP], pose[MIDDLE_MCP]) };
}

/** Average features over every recorded sample of `letter`. */
export function referenceFeatures(
  letter: Letter,
  references: readonly LabeledPose[],
): HandFeatures | null {
  const all = references.filter((r) => r.letter === letter).map((r) => handFeatures(r.pose));
  if (all.length === 0) return null;
  const avg = (get: (f: HandFeatures) => number) =>
    all.reduce((sum, f) => sum + get(f), 0) / all.length;
  const curl = {} as Record<Finger, number>;
  for (const finger of Object.keys(FINGER_POINTS) as Finger[]) {
    curl[finger] = avg((f) => f.curl[finger]);
  }
  return { curl, thumbOut: avg((f) => f.thumbOut) };
}

/**
 * One hint for the biggest difference from the target letter, or null when
 * every finger is within tolerance (or the letter has no samples yet).
 */
export function feedbackFor(
  pose: readonly Point3[],
  target: Letter,
  references: readonly LabeledPose[],
): string | null {
  const ref = referenceFeatures(target, references);
  if (!ref) return null;
  const user = handFeatures(pose);

  // Each candidate hint gets a score: difference / tolerance. Above 1 matters.
  const hints: { score: number; text: string }[] = [];
  for (const finger of Object.keys(FINGER_POINTS) as Finger[]) {
    const diff = user.curl[finger] - ref.curl[finger]; // > 0: user bends more
    const name = FINGER_NAMES[finger];
    hints.push({
      score: Math.abs(diff) / CURL_TOLERANCE,
      text: diff > 0 ? `straighten your ${name}` : `curl your ${name} more`,
    });
  }
  const thumbDiff = user.thumbOut - ref.thumbOut; // > 0: thumb sticks out more
  hints.push({
    score: Math.abs(thumbDiff) / THUMB_OUT_TOLERANCE,
    text: thumbDiff > 0 ? "tuck your thumb in closer" : "move your thumb out more",
  });

  const biggest = hints.reduce((a, b) => (b.score > a.score ? b : a));
  if (biggest.score < 1) return null;

  // If most of the four fingers need the same fix, say so in one hint
  // instead of naming just one of them (e.g. A -> B: open the whole hand).
  const fingers = (["index", "middle", "ring", "pinky"] as const).map(
    (f) => user.curl[f] - ref.curl[f],
  );
  const tooBent = fingers.filter((d) => d > CURL_TOLERANCE).length;
  const tooStraight = fingers.filter((d) => d < -CURL_TOLERANCE).length;
  if (tooBent >= 3) return "straighten your fingers";
  if (tooStraight >= 3) return "curl your fingers more";

  return biggest.text;
}

/** Angle in degrees by which the path p -> q -> r turns at q. 0 = straight. */
function bendDegrees(p: Point3, q: Point3, r: Point3): number {
  const u = { x: q.x - p.x, y: q.y - p.y, z: q.z - p.z };
  const v = { x: r.x - q.x, y: r.y - q.y, z: r.z - q.z };
  const lengths = Math.hypot(u.x, u.y, u.z) * Math.hypot(v.x, v.y, v.z);
  if (lengths === 0) return 0;
  const cos = (u.x * v.x + u.y * v.y + u.z * v.z) / lengths;
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

function distance(a: Point3, b: Point3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
