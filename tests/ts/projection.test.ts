import { describe, expect, it } from "vitest";
import { projectGoal, projectionText } from "../../lib/projection";
import type { Point } from "../../lib/plateau";
import { bodyBatteryBars, netBarGeom } from "../../lib/series";

// n daily predictions ending 2026-10-28, value = start + slope * i
const line = (n: number, start: number, slope: number): Point[] =>
  Array.from({ length: n }, (_, i) => ({
    day: new Date(Date.UTC(2026, 9, 28) - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10),
    value: start + slope * i,
  }));

describe("projectGoal", () => {
  it("needs 14 predictions", () => {
    const r = projectGoal(line(13, 5700, -1));
    expect(r).toEqual({ state: "short" });
    expect(projectionText(r)).toBe("Not enough history yet");
  });
  it("flat trend", () => {
    const r = projectGoal(line(20, 5700, 0));
    expect(r).toEqual({ state: "flat" });
    expect(projectionText(r)).toBe("No improvement trend yet");
  });
  it("rising trend", () => {
    expect(projectGoal(line(20, 5700, 3))).toEqual({ state: "flat" });
  });
  it("falling trend that reaches 5400", () => {
    // 20 points, last = 5700 - 19*5 = 5605; -5 s/day reaches 5400 at i = 60 -> 41 days after 2026-10-28
    const r = projectGoal(line(20, 5700, -5));
    expect(r).toEqual({ state: "reaches", date: "2026-12-08" });
    expect(projectionText(r)).toBe("On this trend: sub 1:30 by 8 Dec");
  });
  it("falling trend that does not reach 5400 within a year", () => {
    const r = projectGoal(line(20, 5700, -0.1));
    expect(r).toEqual({ state: "far" });
    expect(projectionText(r)).toBe("On this trend: not sub 1:30 within a year");
  });
  it("only fits the last 28 days", () => {
    const old = line(10, 9000, 50).map((p) => ({ ...p, day: "2026-08-" + String(10 + Number(p.day.slice(-2)) % 10).padStart(2, "0") }));
    expect(projectGoal([...old, ...line(20, 5700, 0)])).toEqual({ state: "flat" });
  });
});

describe("net bars", () => {
  const bars = bodyBatteryBars(
    [{ day: "2026-10-27", value: 80 }, { day: "2026-10-28", value: 40 }],
    [{ day: "2026-10-27", value: 50 }, { day: "2026-10-28", value: 70 }],
  );
  it("nets charged minus drained", () => {
    expect(bars.map((b) => b.net)).toEqual([30, -30]);
  });
  it("draws positive net green above zero and negative net red below", () => {
    const up = netBarGeom(30, 30, 60), down = netBarGeom(-30, 30, 60);
    expect(up).toEqual({ top: -60, height: 60, color: "#2f8f5b" });
    expect(down).toEqual({ top: 0, height: 60, color: "#d9534f" });
  });
});
