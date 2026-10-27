import { describe, expect, it } from "vitest";
import { MAX_TICKS, TICK_GAP, overlaps, pickTicks } from "../../lib/chartTicks";

const W = 330, XR = 326;
const days = (n: number) => Array.from({ length: n }, (_, i) => `${i + 1} Oct`.padStart(6, "0"));
const run = (n: number) => pickTicks(days(n), (i) => (n === 1 ? XR : (i / (n - 1)) * XR), W);

function expectClean(ticks: ReturnType<typeof run>) {
  for (let i = 1; i < ticks.length; i++) {
    expect(overlaps(ticks[i - 1].box, ticks[i].box, TICK_GAP)).toBe(false);
  }
  for (const t of ticks) {
    expect(t.box.left).toBeGreaterThanOrEqual(0);
    expect(t.box.right).toBeLessThanOrEqual(W);
  }
}

describe("pickTicks", () => {
  it("2 points: first and last only, not colliding", () => {
    const t = run(2);
    expect(t.map((x) => x.index)).toEqual([0, 1]);
    expect(t.map((x) => x.anchor)).toEqual(["start", "end"]);
    expectClean(t);
  });

  it("5 points: all five labels fit", () => {
    const t = run(5);
    expect(t.map((x) => x.index)).toEqual([0, 1, 2, 3, 4]);
    expectClean(t);
  });

  it("30 points: at most 5 labels, first and last kept, no overlaps", () => {
    const t = run(30);
    expect(t.length).toBeLessThanOrEqual(MAX_TICKS);
    expect(t[0].index).toBe(0);
    expect(t[t.length - 1].index).toBe(29);
    expectClean(t);
  });

  it("drops middle labels that would overlap on a narrow chart", () => {
    const t = pickTicks(days(30), (i) => (i / 29) * 90, 100);
    expectClean(t);
    expect(t.length).toBeLessThan(MAX_TICKS);
  });

  it("handles 0 and 1 points", () => {
    expect(run(0)).toEqual([]);
    expect(run(1)).toHaveLength(1);
  });
});
