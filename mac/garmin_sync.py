"""Daily Mac-side Garmin sync: readiness, VO2 max, training status, load, race predictions.

Writes yesterday and today (catch-up for a missed launchd run) with idempotent upserts.
Secrets come from the macOS Keychain only. Logs carry exception class names and
status codes, never response bodies or secret values.
"""
from __future__ import annotations

import subprocess
import sys
from decimal import ROUND_HALF_UP, Decimal
from datetime import date, datetime, timedelta, timezone

KL = timezone(timedelta(hours=8))  # Asia/Kuala_Lumpur, no DST

KEYCHAIN_EMAIL = "garmin-email"
KEYCHAIN_PASSWORD = "garmin-password"
KEYCHAIN_WRITER_DB = "garmin-writer-db"

# Garmin race-prediction key -> value stored in garmin.race_prediction.distance (text).
# half_marathon and marathon match the existing garmin.goal.distance values; checked at startup.
DISTANCE_KEYS = {
    "time5K": "5k",
    "time10K": "10k",
    "timeHalfMarathon": "half_marathon",
    "timeMarathon": "marathon",
}

CTL_DAYS, ATL_DAYS = 42, 7
EWMA_HISTORY_DAYS = 180  # ~4 time constants of the 42-day average

EXIT_OK, EXIT_FAILED, EXIT_RATE_LIMITED = 0, 1, 2

UPSERT_READINESS = (
    "insert into garmin.readiness_reading (day, read_at, score, level, feedback, sleep_score, hrv_weekly_avg, synced_at) "
    "values (%(day)s, %(read_at)s, %(score)s, %(level)s, %(feedback)s, %(sleep_score)s, %(hrv_weekly_avg)s, now()) "
    "on conflict (day, read_at) do update set score = excluded.score, level = excluded.level, "
    "feedback = excluded.feedback, sleep_score = excluded.sleep_score, hrv_weekly_avg = excluded.hrv_weekly_avg, "
    "synced_at = now()"
)

SNAPSHOT_COLS = [
    "vo2_max", "vo2_max_precise", "training_status", "fitness_trend",
    "acute_load", "chronic_load", "ctl", "atl", "tsb", "load_ratio",
]
# coalesce keeps an earlier good value when a re-run gets nothing for a column
UPSERT_SNAPSHOT = (
    f"insert into garmin.training_snapshot (day, {', '.join(SNAPSHOT_COLS)}, synced_at) "
    f"values (%(day)s, {', '.join(f'%({c})s' for c in SNAPSHOT_COLS)}, now()) "
    "on conflict (day) do update set "
    + ", ".join(f"{c} = coalesce(excluded.{c}, garmin.training_snapshot.{c})" for c in SNAPSHOT_COLS)
    + ", synced_at = now()"
)

UPSERT_RACE = (
    "insert into garmin.race_prediction (day, distance, seconds) values (%(day)s, %(distance)s, %(seconds)s) "
    "on conflict (day, distance) do update set seconds = excluded.seconds"
)


def log(msg):
    print(f"{datetime.now(KL).isoformat(timespec='seconds')} {msg}", flush=True)


def log_err(msg):
    print(f"{datetime.now(KL).isoformat(timespec='seconds')} {msg}", file=sys.stderr, flush=True)


# ---------- keychain ----------

def keychain(service):
    r = subprocess.run(
        ["/usr/bin/security", "find-generic-password", "-s", service, "-w"],
        capture_output=True, text=True,
    )
    if r.returncode != 0 or not r.stdout.strip():
        raise KeyError(service)
    return r.stdout.strip()


# ---------- errors ----------

class RateLimited(Exception):
    def __init__(self, day):
        super().__init__("rate limited")
        self.day = day


def status_of(exc):
    if type(exc).__name__ == "GarminConnectTooManyRequestsError":
        return 429
    return getattr(getattr(exc, "response", None), "status_code", None) or getattr(exc, "status_code", None)


class Run:
    """Collects non-fatal failures so the exit code can reflect them."""

    def __init__(self):
        self.failures = 0

    def call(self, day, what, fn):
        try:
            return fn()
        except Exception as exc:
            status = status_of(exc)
            if status == 429:
                raise RateLimited(day) from None
            log_err(f"call failed what={what} day={day} exc={type(exc).__name__} status={status}")
            if status != 404:
                self.failures += 1
            return None


# ---------- type coercion (schema: integer columns vs numeric columns) ----------

def to_int(v):
    """Round half up to int for integer columns; Garmin sends decimals like 379.6."""
    if v is None:
        return None
    return int(Decimal(str(v)).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def to_float(v):
    return None if v is None else float(v)


# ---------- extraction (pure) ----------

def _as_list(data):
    if data is None:
        return []
    return data if isinstance(data, list) else [data]


def parse_gmt(ts):
    """Garmin GMT timestamps look like '2026-10-26T01:08:52.0'. Returns an aware UTC datetime."""
    if not ts:
        return None
    try:
        return datetime.fromisoformat(str(ts).replace("Z", "").split(".")[0]).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def readiness_rows(data, day):
    rows = []
    for e in _as_list(data):
        read_at = parse_gmt(e.get("timestamp"))
        if read_at is None or e.get("score") is None:
            continue
        rows.append({
            "day": e.get("calendarDate") or day.isoformat(),
            # read_at is timestamp WITHOUT time zone: store Kuala Lumpur wall-clock time, naive
            "read_at": read_at.astimezone(KL).replace(tzinfo=None),
            "score": to_int(e.get("score")),
            "level": e.get("level"),
            "feedback": e.get("feedbackShort") or e.get("feedbackLong"),
            "sleep_score": to_int(e.get("sleepScore")),
            "hrv_weekly_avg": to_int(e.get("hrvWeeklyAverage")),
        })
    return rows


def vo2_from_max_metrics(data):
    for e in _as_list(data):
        g = e.get("generic") if isinstance(e, dict) else None
        if g and (g.get("vo2MaxValue") is not None or g.get("vo2MaxPreciseValue") is not None):
            return g.get("vo2MaxValue"), g.get("vo2MaxPreciseValue")
    return None, None


def training_status_fields(data, day):
    """Training status phrase, fitness trend and Garmin's acute/chronic load for `day`, if present."""
    out = {}
    if not isinstance(data, dict):
        return out
    devices = ((data.get("mostRecentTrainingStatus") or {}).get("latestTrainingStatusData")) or {}
    entries = [e for e in devices.values() if isinstance(e, dict)]
    entries.sort(key=lambda e: not e.get("primaryTrainingDevice"))
    for e in entries:
        if e.get("calendarDate") not in (None, day.isoformat()):
            continue  # Garmin has nothing for this exact day on this device
        dto = e.get("acuteTrainingLoadDTO") or {}
        out = {
            "training_status": e.get("trainingStatusFeedbackPhrase"),
            "fitness_trend": e.get("fitnessTrend"),
            "acute_load": dto.get("dailyTrainingLoadAcute"),
            "chronic_load": dto.get("dailyTrainingLoadChronic"),
            "garmin_ratio": dto.get("dailyAcuteChronicWorkloadRatio"),
        }
        break
    g = ((data.get("mostRecentVO2Max") or {}).get("generic")) or {}
    if g and g.get("calendarDate") in (None, day.isoformat()):
        out["vo2_max"], out["vo2_max_precise"] = g.get("vo2MaxValue"), g.get("vo2MaxPreciseValue")
    return out


def race_rows(data, day):
    rows = []
    for e in _as_list(data):
        if not isinstance(e, dict):
            continue
        d = e.get("calendarDate") or day.isoformat()
        if d != day.isoformat():
            continue
        for key, dist in DISTANCE_KEYS.items():
            if e.get(key) is not None:
                rows.append({"day": d, "distance": dist, "seconds": to_int(e[key])})
    return rows


# ---------- EWMA fallback ----------

def ewma_load(daily, day, history=EWMA_HISTORY_DAYS):
    """ctl/atl/tsb/load_ratio from {date: training_load}. alpha = 1/N, seeded at 0.

    Returns None when there is no load history at all (nothing honest to compute).
    """
    start = day - timedelta(days=history)
    if not any(start <= d <= day and v for d, v in daily.items()):
        return None
    ctl = atl = 0.0
    d = start
    while d <= day:
        load = float(daily.get(d) or 0)
        ctl += (load - ctl) / CTL_DAYS
        atl += (load - atl) / ATL_DAYS
        d += timedelta(days=1)
    return {"ctl": ctl, "atl": atl, "tsb": ctl - atl, "load_ratio": (atl / ctl) if ctl > 0 else None}


def daily_loads(conn, day):
    start = day - timedelta(days=EWMA_HISTORY_DAYS)
    with conn.cursor() as cur:
        cur.execute(
            "select day, sum(training_load) from garmin.activity_load where day between %s and %s group by day",
            (start, day),
        )
        return {r[0]: float(r[1]) for r in cur.fetchall() if r[1] is not None}


# ---------- sync ----------

def build_snapshot(day, vo2, status, conn):
    """Returns (params, source). Garmin's own load values win; EWMA only when Garmin gave none.

    ctl, atl, tsb, acute_load, chronic_load, fitness_trend are integer columns; load_ratio and the
    VO2 values are numeric and stay float.
    """
    p = {c: None for c in SNAPSHOT_COLS}
    p["day"] = day.isoformat()
    p["vo2_max"], p["vo2_max_precise"] = vo2
    for k in ("vo2_max", "vo2_max_precise"):
        if status.get(k) is not None and p[k] is None:
            p[k] = status[k]
    p["training_status"] = status.get("training_status")
    p["fitness_trend"] = status.get("fitness_trend")
    p["acute_load"], p["chronic_load"] = status.get("acute_load"), status.get("chronic_load")

    source = "none"
    if p["acute_load"] is not None and p["chronic_load"] is not None:
        p["atl"], p["ctl"] = p["acute_load"], p["chronic_load"]
        ratio = status.get("garmin_ratio")
        if ratio is None and p["ctl"]:
            ratio = p["atl"] / p["ctl"]
        p["load_ratio"] = ratio
        source = "garmin"
    else:
        fallback = ewma_load(daily_loads(conn, day), day)
        if fallback:
            p.update(fallback)
            source = "ewma"

    for k in ("ctl", "atl", "acute_load", "chronic_load", "fitness_trend"):
        p[k] = to_int(p[k])
    if p["ctl"] is not None and p["atl"] is not None:
        p["tsb"] = p["ctl"] - p["atl"]  # from the rounded values, so the three columns agree
    for k in ("load_ratio", "vo2_max", "vo2_max_precise"):
        p[k] = to_float(p[k])
    return p, source


def execute(conn, sql, params):
    with conn.cursor() as cur:
        cur.execute(sql, params)


def check_distances(conn):
    """True when goal distances use the same format DISTANCE_KEYS writes."""
    with conn.cursor() as cur:
        cur.execute("select distinct distance from garmin.goal")
        goal = {str(r[0]) for r in cur.fetchall()}
    return goal <= set(DISTANCE_KEYS.values()), goal


def sync_day(client, conn, day, run, races_ok=True, today=False):
    d = day.isoformat()

    readings = readiness_rows(run.call(day, "readiness", lambda: client.get_training_readiness(d)), day)
    for row in readings:
        execute(conn, UPSERT_READINESS, row)

    vo2 = vo2_from_max_metrics(run.call(day, "max_metrics", lambda: client.get_max_metrics(d)))
    status = training_status_fields(run.call(day, "training_status", lambda: client.get_training_status(d)), day)
    snap, source = build_snapshot(day, vo2, status, conn)
    if any(snap[c] is not None for c in SNAPSHOT_COLS):
        execute(conn, UPSERT_SNAPSHOT, snap)

    races = []
    if races_ok:
        fetch = (lambda: client.get_race_predictions()) if today else (lambda: client.get_race_predictions(d, d, "daily"))
        races = race_rows(run.call(day, "race_predictions", fetch), day)
        for row in races:
            execute(conn, UPSERT_RACE, row)

    log(f"day={d} readiness={len(readings)} snapshot_source={source} races={len(races)}")


def sync(client, conn, today_date):
    run = Run()
    races_ok, goal = check_distances(conn)
    if not races_ok:
        run.failures += 1
        log_err(f"goal distance values {sorted(goal)} not covered by DISTANCE_KEYS; skipping race predictions")
    try:
        for day in (today_date - timedelta(days=1), today_date):  # yesterday first, then today
            sync_day(client, conn, day, run, races_ok=races_ok, today=(day == today_date))
    except RateLimited as rl:
        log_err(f"rate limited status=429 day={rl.day.isoformat()}; stopping, no retry")
        return EXIT_RATE_LIMITED
    return EXIT_FAILED if run.failures else EXIT_OK


def main():
    import psycopg
    from garminconnect import Garmin

    try:
        email, password, db_url = keychain(KEYCHAIN_EMAIL), keychain(KEYCHAIN_PASSWORD), keychain(KEYCHAIN_WRITER_DB)
    except KeyError as missing:
        log_err(f"keychain item not found: {missing.args[0]}")
        return EXIT_FAILED

    try:
        client = Garmin(email, password)
        client.login()
    except Exception as exc:
        status = status_of(exc)
        log_err(f"garmin login failed exc={type(exc).__name__} status={status}")
        return EXIT_RATE_LIMITED if status == 429 else EXIT_FAILED

    try:
        # prepare_threshold=None: Supabase transaction pooler has no server-side prepared statements
        with psycopg.connect(db_url, prepare_threshold=None, autocommit=True) as conn:
            return sync(client, conn, datetime.now(KL).date())
    except Exception as exc:
        log_err(f"database error exc={type(exc).__name__} sqlstate={getattr(exc, 'sqlstate', None)}")
        return EXIT_FAILED


if __name__ == "__main__":
    sys.exit(main())
