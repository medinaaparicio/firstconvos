/**
 * Recorded sample poses: the file format and how to save it.
 * Files live in src/recognition/samples/<LETTER>.json (see README there).
 */
import type { Letter } from "../types";
import type { Point3 } from "./normalize";

/** The starter set agreed with Track B's lessons table. */
export const STARTER_LETTERS: Letter[] = ["A", "B", "L", "V", "Y"];

/** How many holds to record per letter. */
export const SAMPLES_PER_LETTER = 10;

export type SampleFile = {
  letter: Letter;
  /** Which hand was recorded. Only "right" for now (see normalize.ts). */
  hand: "right";
  /** Each sample is 21 normalized points, averaged over one still hold. */
  samples: Point3[][];
};

export function makeSampleFile(letter: Letter, samples: Point3[][]): SampleFile {
  // 3 decimals is far finer than tracking accuracy and keeps files small.
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return {
    letter,
    hand: "right",
    samples: samples.map((pose) =>
      pose.map((p) => ({ x: round(p.x), y: round(p.y), z: round(p.z) })),
    ),
  };
}

/**
 * Every recorded file in ./samples/, bundled in at build time. Adding a new
 * <LETTER>.json there is enough; no code change needed.
 * (import.meta.glob is a Vite feature, not React.)
 */
export const RECORDED_SAMPLES: SampleFile[] = Object.values(
  import.meta.glob<SampleFile>("./samples/*.json", { eager: true, import: "default" }),
);

/** Make the browser download `data` as a JSON file. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
