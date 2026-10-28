import { describe, expect, it } from "vitest";
import { loadColor, loadZone } from "../../lib/loadRatio";
import { paceLabel } from "../../lib/pace";
import type { Point } from "../../lib/plateau";
import { bodyBatteryBars, movingAvg, windowPoints } from "../../lib/series";

const days = (n: number, f: (i: number) => number = (i) => i): Point[] =>
  Array.from({ length: n }, (_, i) => ({ day: new Date(Date.UTC(2026, 6, 1) + i * 86_400_000).toISOString().slice(0, 10), value: f(i) }));

describe("windowPoints", () => {
  it("keeps the last 30 or 90 days ending at the latest point", () => {
    const s = days(120);
    expect(windowPoints(s, 30)).toHaveLength(30);
    expect(windowPoints(s, 90)).toHaveLength(90);
    expect(windowPoints(s, 30)[29]).toBe(s[119]);
  });
  it("returns everything when history is shorter, and [] when empty", () => {
    expect(windowPoints(days(10), 90)).toHaveLength(10);
    expect(windowPoints([], 30)).toEqual([]);
  });
});

describe("movingAvg", () => {
  it("averages the trailing 7 calendar days", () => {
    const a = movingAvg(days(10));
    expect(a[0].value).toBe(0);
    expect(a[2].value).toBe(1);
    expect(a[9].value).toBe(6); // days 3..9
  });
  it("ignores points older than 7 days across a gap", () => {
    const s = [{ day: "2026-07-01", value: 100 }, { day: "2026-07-20", value: 10 }];
    expect(movingAvg(s)[1].value).toBe(10);
  });
});

describe("paceLabel", () => {
  it("gives 4:16/km for the 1:30:00 target", () => {
    expect(paceLabel(5400)).toBe("4:16/km");
  });
  it("rounds the current prediction to the nearest second", () => {
    expect(paceLabel(5500)).toBe("4:21/km"); // 260.7 s
  });
});

describe("load ratio zones", () => {
  it.each([[0.79, "Low", "#f0a03c"], [0.8, "Good", "#2f8f5b"], [1.3, "Good", "#2f8f5b"], [1.31, "High", "#f0a03c"]])(
    "%s is %s", (v, zone, color) => {
      expect(loadZone(v)).toBe(zone);
      expect(loadColor(v)).toBe(color);
    });
});

describe("bodyBatteryBars", () => {
  it("pairs charged and drained by day with the net", () => {
    const c = [{ day: "2026-07-01", value: 80 }, { day: "2026-07-02", value: 60 }];
    const d = [{ day: "2026-07-01", value: 50 }, { day: "2026-07-03", value: 40 }];
    expect(bodyBatteryBars(c, d)).toEqual([
      { day: "2026-07-01", charged: 80, drained: 50, net: 30 },
      { day: "2026-07-02", charged: 60, drained: 0, net: 60 },
      { day: "2026-07-03", charged: 0, drained: 40, net: -40 },
    ]);
  });
});
