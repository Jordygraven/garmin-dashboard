import { describe, expect, it } from "vitest";
import { progressPct } from "../../lib/progress";

describe("progressPct", () => {
  it("is the share of the gap closed", () => {
    expect(progressPct(6000, 5700, 5400)).toBeCloseTo(50);
  });
  it("clamps to 0 when slower than the start", () => {
    expect(progressPct(6000, 6200, 5400)).toBe(0);
  });
  it("clamps to 100 when faster than the target", () => {
    expect(progressPct(6000, 5300, 5400)).toBe(100);
  });
  it("is 100 when the start is already at or under target", () => {
    expect(progressPct(5400, 5500, 5400)).toBe(100);
    expect(progressPct(5300, 5300, 5400)).toBe(100);
  });
});
