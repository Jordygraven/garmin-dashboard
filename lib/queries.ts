import { pool } from "./db";
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
    "select vo2_max, vo2_max_precise, load_ratio from garmin.training_snapshot order by day desc limit 1",
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

export async function goals() {
  const { rows } = await pool.query("select id, label, distance, target_seconds from garmin.goal order by due_date");
  return rows.map((r) => ({ id: r.id as number, label: r.label as string, distance: r.distance, target: Number(r.target_seconds) }));
}

export async function predictions(distance: unknown) {
  const { rows } = await pool.query(
    `select ${D("day")} as day, seconds from garmin.race_prediction where distance = $1 order by day`,
    [distance],
  );
  return rows.map((r) => ({ day: r.day as string, seconds: Number(r.seconds) }));
}
