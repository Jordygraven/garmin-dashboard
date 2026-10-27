import { describe, expect, it, vi } from "vitest";

process.env.TZ = "UTC"; // Vercel server timezone

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../../lib/db", () => ({ pool: { query } }));

import { clock } from "../../lib/format";
import { latestReadiness } from "../../lib/queries";
import { readinessLabel } from "../../lib/verdict";

describe("readiness time", () => {
  it("renders a reading stored as 20:15 as 20:15 under a UTC server", async () => {
    query.mockResolvedValueOnce({ rows: [{ score: 69, level: "HIGH", read_time: "20:15" }] });
    const r = await latestReadiness();
    expect(readinessLabel(r)).toBe("69 at 20:15");
    expect(query.mock.calls[0][0]).toContain("to_char(read_at, 'HH24:MI') as read_time");
  });

  it("does not select the raw read_at for display", async () => {
    query.mockResolvedValueOnce({ rows: [{ score: 69, level: null, read_time: "20:15" }] });
    expect(await latestReadiness()).not.toHaveProperty("read_at");
  });

  it("shows why the old path was wrong: a naive 20:15 parsed as UTC then passed through clock() gives 04:15", () => {
    expect(clock(new Date("2026-10-26T20:15:00Z"))).toBe("04:15");
  });

  it("has a dash when there is no reading", () => {
    expect(readinessLabel(null)).toBe("–");
  });
});
