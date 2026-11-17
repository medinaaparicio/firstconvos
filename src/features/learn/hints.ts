import type { Letter } from "../../types";

/**
 * How to make each handshape, shown by the "Show hint" button on Learn.
 * Written for the right hand. Replace with lesson videos once they exist.
 */
export const HINTS: Partial<Record<Letter, string>> = {
  A: "Make a fist, with your thumb resting against the side of your index finger.",
  B: "Hold four fingers straight up and together, with your thumb folded across your palm.",
  C: "Curve your fingers and thumb into a C shape, as if holding a cup.",
  T: "Make a fist, with your thumb tucked between your index and middle fingers.",
};
