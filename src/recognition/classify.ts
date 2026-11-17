/**
 * Letter classification with k-nearest-neighbors (kNN).
 *
 * Compare the user's normalized pose with every recorded sample, take the K
 * closest, and let them vote, with closer samples getting a bigger vote.
 * Pure function: no camera, no React, no files.
 */
import type { Letter } from "../types";
import type { Point3 } from "./normalize";
import type { SampleFile } from "./samples";
import { shapeDistance } from "./stillness";

/**
 * How many nearest samples vote. 3, not 5: for look-alikes (A vs T) the
 * single closest sample is usually right, and with 5 voters the other
 * letter could outvote it. Tested on the A/B/C/T recordings.
 */
export const K = 3;

/** Floor on distance when weighting votes, so an exact match can't dominate. */
const MIN_VOTE_DISTANCE = 0.02;

/**
 * Distance (average point gap, in palm lengths) at which closeness drops to
 * 0. Same-letter samples sit about 0.18 apart and A vs B about 0.62, so a
 * hand this far from every sample doesn't look like any recorded letter.
 */
export const MAX_DISTANCE = 0.6;

/** Below this confidence, callers should treat the guess as "not sure". */
export const MIN_CONFIDENCE = 0.5;

export type LabeledPose = { letter: Letter; pose: Point3[] };

export type Classification = {
  /** Best guess, or null if there are no samples to compare against. */
  letter: Letter | null;
  /** 0 to 1: share of the (distance-weighted) vote times closeness. */
  confidence: number;
  /** Average distance to the winning letter's voting samples. */
  distance: number;
};

/** Turn sample files into one flat list of labeled poses. */
export function flattenSamples(files: readonly SampleFile[]): LabeledPose[] {
  return files.flatMap((file) =>
    file.samples.map((pose) => ({ letter: file.letter, pose })),
  );
}

export function classify(
  pose: readonly Point3[],
  references: readonly LabeledPose[],
  k: number = K,
): Classification {
  if (references.length === 0) {
    return { letter: null, confidence: 0, distance: Infinity };
  }

  // 1. Distance to every sample, closest first, keep the k nearest.
  const nearest = references
    .map((ref) => ({ letter: ref.letter, distance: shapeDistance(pose, ref.pose) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k);

  // 2. Add up votes per letter. Each sample's vote is 1 / distance, so a
  //    very close sample counts more than one that's barely in the top k.
  const votes = new Map<Letter, { weight: number; count: number; total: number }>();
  let allWeight = 0;
  for (const n of nearest) {
    const weight = 1 / Math.max(n.distance, MIN_VOTE_DISTANCE);
    const v = votes.get(n.letter) ?? { weight: 0, count: 0, total: 0 };
    v.weight += weight;
    v.count += 1;
    v.total += n.distance;
    votes.set(n.letter, v);
    allWeight += weight;
  }

  // 3. The letter with the most vote weight wins.
  let best: Letter = nearest[0].letter;
  let bestVote = votes.get(best)!;
  for (const [letter, v] of votes) {
    if (v.weight > bestVote.weight) {
      best = letter;
      bestVote = v;
    }
  }

  // 4. Confidence = how much the neighbors agree x how close they are.
  const distance = bestVote.total / bestVote.count;
  const voteShare = bestVote.weight / allWeight;
  const closeness = Math.max(0, 1 - distance / MAX_DISTANCE);
  return { letter: best, confidence: voteShare * closeness, distance };
}
