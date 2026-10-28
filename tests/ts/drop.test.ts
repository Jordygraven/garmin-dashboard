import { describe, expect, it } from "vitest";
import { changeOver, dropCheck, trendLabel } from "../../lib/drop";
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
    expect(dropCheck(null, 0.08)).toMatchObject({ state: "ok", up: true, text: "Stable: up 8% in 14 days. Warning at 10%." });
  });
  it("reports small decline as no drop", () => {
    expect(dropCheck(null, -0.04).text).toBe("Stable: down 4% in 14 days. Warning at 10%.");
  });
  it("handles no data", () => {
    expect(dropCheck(null, null).state).toBe("none");
  });
});

describe("trendLabel", () => {
  it("is Increasing with an up arrow when latest ctl is above 14 days ago", () => {
    expect(trendLabel(changeOver(series(110, 100)))).toEqual({ word: "Increasing", arrow: "↑" });
  });
  it("is Decreasing with a down arrow when below", () => {
    expect(trendLabel(changeOver(series(90, 100)))).toEqual({ word: "Decreasing", arrow: "↓" });
  });
  it("is null without history", () => {
    expect(trendLabel(null)).toBeNull();
  });
});
