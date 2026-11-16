/**
 * Turn one normalized pose into the shared RecognitionResult (src/types.ts):
 * classify it, check it against the target letter, and add a hint.
 * Plain TypeScript, so it can be tested without a camera.
 */
import type { Letter, RecognitionResult } from "../types";
import { classify, MIN_CONFIDENCE } from "./classify";
import type { LabeledPose } from "./classify";
import { feedbackFor } from "./feedback";
import type { Point3 } from "./normalize";

export const NO_HAND: RecognitionResult = { letter: null, confidence: 0, correct: false };

/**
 * @param pose    normalized pose, or null when no hand is visible
 * @param target  the letter the user should sign, or null to just classify
 */
export function recognize(
  pose: readonly Point3[] | null,
  target: Letter | null,
  references: readonly LabeledPose[],
): RecognitionResult {
  if (!pose) return NO_HAND;

  const { letter, confidence } = classify(pose, references);
  const correct = target !== null && letter === target && confidence >= MIN_CONFIDENCE;

  // Only coach when there's a target and the user hasn't got it yet.
  const feedback =
    target !== null && !correct ? (feedbackFor(pose, target, references) ?? undefined) : undefined;

  return { letter, confidence, correct, feedback };
}
