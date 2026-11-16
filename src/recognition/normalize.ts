/**
 * Turn raw MediaPipe hand landmarks into a pose that is comparable across
 * hand positions, hand sizes, and distances from the camera.
 *
 * CONVENTIONS (keep these the same everywhere in src/recognition/):
 * - Input is the camera's un-mirrored view, exactly as MediaPipe returns it.
 *   Mirroring is display-only (CSS on the video and canvas). Never flip x here.
 * - Samples are recorded with the RIGHT hand. A left hand is the mirror image
 *   and will not match until we add a handedness flip.
 * - Units: x, y, z are all expressed in image heights before scaling, so a
 *   non-square video (640x480) doesn't squash tilted hands.
 */

export type Point3 = { x: number; y: number; z: number };

/** MediaPipe landmark indices used here. */
export const WRIST = 0;
export const MIDDLE_MCP = 9; // base of the middle finger
export const NUM_LANDMARKS = 21;

/**
 * @param points 21 landmarks from MediaPipe (x, y in 0..1 of width/height;
 *               z in roughly the same units as x).
 * @param aspect video width / height, e.g. 640 / 480.
 * @returns 21 points with the wrist at (0, 0, 0) and the wrist-to-middle-base
 *          distance equal to 1.
 */
export function normalize(points: readonly Point3[], aspect: number): Point3[] {
  if (points.length !== NUM_LANDMARKS) {
    throw new Error(`Expected ${NUM_LANDMARKS} landmarks, got ${points.length}`);
  }

  // 1. Same units on every axis: x and z are fractions of the width, y of the
  //    height. Multiplying x and z by width/height puts all three in heights.
  const even = points.map((p) => ({ x: p.x * aspect, y: p.y, z: p.z * aspect }));

  // 2. Move: wrist becomes the origin.
  const wrist = even[WRIST];
  const moved = even.map((p) => ({
    x: p.x - wrist.x,
    y: p.y - wrist.y,
    z: p.z - wrist.z,
  }));

  // 3. Scale: palm size (wrist to middle-finger base) becomes 1.
  const palm = length(moved[MIDDLE_MCP]);
  if (palm === 0) {
    throw new Error("Palm size is zero; landmarks look invalid");
  }
  return moved.map((p) => ({ x: p.x / palm, y: p.y / palm, z: p.z / palm }));
}

function length(p: Point3): number {
  return Math.hypot(p.x, p.y, p.z);
}
