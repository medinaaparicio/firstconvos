export type Letter =
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M"
  | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z";

export type RecognitionResult = {
  letter: Letter | null;   // best guess, null if no hand visible
  confidence: number;      // 0 to 1
  correct: boolean;        // matches the target letter
  feedback?: string;       // e.g. "curl your index finger more"
};

export type GameEvent =
  | { type: "sign_started"; playerId: string }
  | { type: "sign_result"; playerId: string; letters: Letter[]; matchedWord: boolean }
  | { type: "timer_tick"; secondsLeft: number };