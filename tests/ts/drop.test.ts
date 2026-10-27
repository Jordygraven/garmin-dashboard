import { describe, expect, it } from "vitest";
import { changeOver, dropCheck } from "../../lib/drop";
import type { Point } from "../../lib/plateau";

const series = (today: number, past: number): Point[] => [
  { day: "2026-10-13", value: past },
  { day: "2026-10-20", value: (today + past) / 2 },
  { day: "2026-10-27", value: today },
];

describe("changeOver", () => {
  it("compares with the point 14 days back", () => {
    expect(changeOver(series(90, 100))).toBeCloseTo(-0.1);
  });
  it("returns null without 14 days of history", () => {
    expect(changeOver([{ day: "2026-10-27", value: 5 }])).toBeNull();
    expect(changeOver([])).toBeNull();
  });
});

describe("dropCheck", () => {
  it("warns when an unresolved alert exists", () => {
    expect(dropCheck({ message: "Fitness fell 20%." }, 0.1)).toEqual({ state: "warning", text: "Fitness fell 20%." });
  });
  it("reports up", () => {
    expect(dropCheck(null, 0.08)).toMatchObject({ state: "ok", up: true, text: "No drop. Fitness is up 8%." });
  });
  it("reports small decline as no drop", () => {
    expect(dropCheck(null, -0.04).text).toBe("No drop. Fitness is down 4%.");
  });
  it("handles no data", () => {
    expect(dropCheck(null, null).state).toBe("none");
  });
});
