import { describe, expect, it } from "vitest";
import { findPlateaus, type Point } from "../../lib/plateau";

const mk = (vals: number[], start = 1): Point[] =>
  vals.map((value, i) => ({ day: `2026-10-${String(start + i).padStart(2, "0")}`, value }));

describe("findPlateaus", () => {
  it("flags 5 days within 2%", () => {
    expect(findPlateaus(mk([100, 100.5, 101, 100.2, 100.8]))).toEqual([{ start: 0, end: 4 }]);
  });
  it("ignores 4-day flat runs", () => {
    expect(findPlateaus(mk([100, 100, 100, 100, 130]))).toEqual([]);
  });
  it("rejects a 2% range", () => {
    expect(findPlateaus(mk([100, 100, 100, 100, 98]))).toEqual([]);
  });
  it("merges overlapping windows", () => {
    expect(findPlateaus(mk([50, 100, 100, 100, 100, 100, 100, 100, 150]))).toEqual([{ start: 1, end: 7 }]);
  });
  it("splits separate plateaus", () => {
    const s = findPlateaus(mk([100, 100, 100, 100, 100, 150, 200, 200, 200, 200, 200]));
    expect(s).toEqual([{ start: 0, end: 4 }, { start: 6, end: 10 }]);
  });
  it("does not span date gaps", () => {
    const p = [...mk([100, 100, 100]), ...mk([100, 100], 10)];
    expect(findPlateaus(p)).toEqual([]);
  });
  it("handles short and zero series", () => {
    expect(findPlateaus([])).toEqual([]);
    expect(findPlateaus(mk([0, 0, 0, 0, 0]))).toEqual([]);
  });
});
