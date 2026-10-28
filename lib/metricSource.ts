export type MetricKey =
  | "readiness" | "fitness" | "bodyBattery" | "restingHr" | "stress" | "sleep" | "hrv" | "fitnessAge" | "vo2";
/** Metrics with a tile, plus series that only feed a chart. */
export type SourceKey = MetricKey | "bodyBatteryDrained" | "loadRatio";

type Source = { table: string; column: string; dayColumn: string };

/** Where each tile's 90-day modal chart reads from. Body battery charts charged (up) and drained (down). */
export const METRIC_SOURCES: Record<SourceKey, Source> = {
  readiness: { table: "readiness_reading", column: "score", dayColumn: "read_at" },
  fitness: { table: "training_snapshot", column: "ctl", dayColumn: "day" },
  vo2: { table: "training_snapshot", column: "vo2_max", dayColumn: "day" },
  loadRatio: { table: "training_snapshot", column: "load_ratio", dayColumn: "day" },
  bodyBatteryDrained: { table: "daily_official", column: "body_battery_drained", dayColumn: "day" },
  bodyBattery: { table: "daily_official", column: "body_battery_charged", dayColumn: "day" },
  restingHr: { table: "daily_official", column: "resting_hr", dayColumn: "day" },
  stress: { table: "daily_official", column: "stress_overall", dayColumn: "day" },
  sleep: { table: "daily_official", column: "sleep_score", dayColumn: "day" },
  hrv: { table: "daily_official", column: "hrv_last_night", dayColumn: "day" },
  fitnessAge: { table: "daily_official", column: "fitness_age", dayColumn: "day" },
};

/** Query returning (day, value) for the last $1 days. Identifiers come only from METRIC_SOURCES. */
export function metricSql(key: SourceKey): { text: string } {
  const { table, column, dayColumn } = METRIC_SOURCES[key];
  const since = "(now() at time zone 'Asia/Kuala_Lumpur')::date - $1::int";
  if (dayColumn === "read_at") {
    // read_at is Kuala Lumpur wall-clock without time zone: latest reading per calendar day
    return {
      text: `select distinct on (read_at::date) to_char(read_at::date, 'YYYY-MM-DD') as day, ${column} as value
               from garmin.${table} where ${column} is not null and read_at::date >= ${since}
              order by read_at::date, read_at desc`,
    };
  }
  return {
    text: `select to_char(${dayColumn}, 'YYYY-MM-DD') as day, ${column} as value
             from garmin.${table} where ${column} is not null and ${dayColumn} >= ${since} order by ${dayColumn}`,
  };
}
