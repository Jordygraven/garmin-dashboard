import { describe, expect, it } from "vitest";
import manifest from "../../app/manifest";

describe("manifest", () => {
  const m = manifest();
  it("is a standalone Fitness app", () => {
    expect(m.name).toBe("Fitness");
    expect(m.short_name).toBe("Fitness");
    expect(m.display).toBe("standalone");
  });
  it("points at the two icon files", () => {
    expect(m.icons?.map((i) => i.src)).toEqual(["/icon.svg", "/apple-icon.png"]);
  });
});
