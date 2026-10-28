import { pool } from "./db";
import { metricSql, type MetricKey } from "./metricSource";
import type { Point } from "./plateau";

const D = (col: string) => `to_char(${col}, 'YYYY-MM-DD')`;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function latestDaily() {
  const { rows } = await pool.query(
    `select ${D("day")} as day, sleep_score, hrv_last_night, resting_hr, body_battery_charged,
            body_battery_drained, stress_overall, fitness_age
       from garmin.daily_official order by day desc limit 1`,
  );
  const r = rows[0];
  if (!r) return null;
  return {
    day: r.day as string, sleep_score: num(r.sleep_score), hrv: num(r.hrv_last_night),
    resting_hr: num(r.resting_hr), bb_charged: num(r.body_battery_charged), bb_drained: num(r.body_battery_drained),
    stress: num(r.stress_overall), fitness_age: num(r.fitness_age),
  };
}

export async function lastSynced(): Promise<Date | null> {
  const { rows } = await pool.query("select max(synced_at) as t from garmin.daily_official");
  return rows[0]?.t ?? null;
}

export async function latestReadiness() {
  const { rows } = await pool.query(
    // read_at is timestamp without time zone holding Kuala Lumpur wall-clock time: take the text, never a Date
    "select score, level, to_char(read_at, 'HH24:MI') as read_time from garmin.readiness_reading order by read_at desc limit 1",
  );
  const r = rows[0];
  return r ? { score: num(r.score), level: (r.level as string) ?? null, read_time: r.read_time as string } : null;
}

export async function latestSnapshot() {
  const { rows } = await pool.query(
    `select (select vo2_max_precise from garmin.training_snapshot where vo2_max_precise is not null order by day desc limit 1) as vo2_max_precise,
            (select vo2_max from garmin.training_snapshot where vo2_max is not null order by day desc limit 1) as vo2_max,
            (select load_ratio from garmin.training_snapshot order by day desc limit 1) as load_ratio`,
  );
  const r = rows[0];
  return r ? { vo2: num(r.vo2_max_precise) ?? num(r.vo2_max), load_ratio: num(r.load_ratio) } : null;
}

export async function ctlSeries(days: number): Promise<Point[]> {
  const { rows } = await pool.query(
    `select ${D("day")} as day, ctl from garmin.training_snapshot
      where ctl is not null and day >= (now() at time zone 'Asia/Kuala_Lumpur')::date - $1::int
      order by day`,
    [days],
  );
  return rows.map((r) => ({ day: r.day as string, value: Number(r.ctl) }));
}

export async function unresolvedDrop() {
  const { rows } = await pool.query(
    "select message from garmin.alert where kind = 'fitness_drop' and resolved_at is null order by created_at desc limit 1",
  );
  return (rows[0] as { message: string } | undefined) ?? null;
}

/** First and latest half-marathon prediction plus the April goal, for the progress bar. */
export async function halfMarathon() {
  const { rows } = await pool.query(
    `select (select seconds from garmin.race_prediction where distance = 'half_marathon' order by day asc limit 1) as start,
            (select seconds from garmin.race_prediction where distance = 'half_marathon' order by day desc limit 1) as current,
            (select target_seconds from garmin.goal where id = 'half-marathon-april') as target`,
  );
  const r = rows[0];
  if (!r || r.start === null || r.current === null || r.target === null) return null;
  return { start: Number(r.start), current: Number(r.current), target: Number(r.target) };
}

export async function metricSeries(key: MetricKey, days = 90): Promise<Point[]> {
  const { text } = metricSql(key);
  const { rows } = await pool.query(text, [days]);
  return rows.map((r) => ({ day: r.day as string, value: Number(r.value) }));
}
