import { describe, expect, it } from "vitest";
import { METRIC_INFO } from "../../lib/metricInfo";
import { METRIC_SOURCES, metricSql, type MetricKey, type SourceKey } from "../../lib/metricSource";

const expected: Record<SourceKey, [string, string]> = {
  readiness: ["readiness_reading", "score"],
  fitness: ["training_snapshot", "ctl"],
  vo2: ["training_snapshot", "vo2_max"],
  bodyBattery: ["daily_official", "body_battery_charged"],
  restingHr: ["daily_official", "resting_hr"],
  stress: ["daily_official", "stress_overall"],
  sleep: ["daily_official", "sleep_score"],
  hrv: ["daily_official", "hrv_last_night"],
  fitnessAge: ["daily_official", "fitness_age"],
  bodyBatteryDrained: ["daily_official", "body_battery_drained"],
  loadRatio: ["training_snapshot", "load_ratio"],
};

describe("modal data mapping", () => {
  it.each(Object.entries(expected))("%s reads %s.%s", (key, [table, column]) => {
    const { text } = metricSql(key as SourceKey);
    expect(text).toContain(`garmin.${table}`);
    expect(text).toContain(`${column} as value`);
    expect(text).toContain("$1::int");
    if (key in METRIC_INFO) expect(METRIC_INFO[key as MetricKey].text.length).toBeGreaterThan(0);
  });
  it("covers the tiles, VO2 and the chart-only series", () => {
    expect(Object.keys(METRIC_SOURCES).sort()).toEqual(Object.keys(expected).sort());
  });
  it("takes the latest readiness reading per day", () => {
    const { text } = metricSql("readiness");
    expect(text).toContain("distinct on (read_at::date)");
    expect(text).toContain("read_at desc");
  });
});
