export type Level = "rest" | "ease" | "okay" | "strong";

export const STEPS: { key: Level; label: string; color: string }[] = [
  { key: "rest", label: "Rest", color: "#d9534f" },
  { key: "ease", label: "Ease off", color: "#f0a03c" },
  { key: "okay", label: "Okay", color: "#8fd18a" },
  { key: "strong", label: "Strong", color: "#2f8f5b" },
];

const PHRASES: Record<Level, [string, string]> = {
  strong: ["You're looking strong today.", "Go for the planned session. Your body is ready for it."],
  okay: ["You're okay today.", "Stick to the plan, and listen to how it feels."],
  ease: ["Ease off today.", "Keep it light. Go shorter or easier than planned."],
  rest: ["Rest today.", "Your body needs recovery. Skip the hard training."],
};
export const AWAITING: [string, string] = ["Awaiting readiness.", "Garmin's readiness score has not arrived yet."];

/** Garmin's own level wins; score bands are only a fallback. Never computed from other data. */
export function levelOf(r: { level: string | null; score: number | null } | null): Level | null {
  if (!r) return null;
  switch ((r.level ?? "").toUpperCase()) {
    case "POOR": return "rest";
    case "LOW": return "ease";
    case "MODERATE": return "okay";
    case "HIGH": case "PRIME": return "strong";
  }
  if (r.score === null) return null;
  return r.score < 25 ? "rest" : r.score < 50 ? "ease" : r.score < 75 ? "okay" : "strong";
}

export const phraseFor = (l: Level | null) => (l ? PHRASES[l] : AWAITING);
