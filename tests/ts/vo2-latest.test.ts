import { describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../../lib/db", () => ({ pool: { query } }));

import { latestSnapshot } from "../../lib/queries";

describe("latestSnapshot", () => {
  it("returns the latest non-null VO2 even when the newest row's VO2 is null", async () => {
    query.mockResolvedValueOnce({ rows: [{ vo2_max: "60", vo2_max_precise: "60.4", load_ratio: "0.9" }] });
    expect(await latestSnapshot()).toEqual({ vo2: 60.4, load_ratio: 0.9 });
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("vo2_max_precise is not null");
    expect(sql).toContain("vo2_max is not null");
  });
});
