from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone

BACKFILL_DAYS = 90
TOKEN_CACHE_DIR = "/tmp/garmin"
KL = timezone(timedelta(hours=8))  # Asia/Kuala_Lumpur, no DST

DAILY_COLS = [
    "sleep_seconds", "sleep_score", "hrv_last_night", "hrv_weekly_avg", "resting_hr",
    "body_battery_charged", "body_battery_drained", "stress_overall", "fitness_age",
    "deep_seconds", "light_seconds", "rem_seconds", "awake_seconds",
]


def yesterday_kl():
    return datetime.now(KL).date() - timedelta(days=1)


def _g(d, *path):
    for k in path:
        if not isinstance(d, dict):
            return None
        d = d.get(k)
    return d


def _int(v):
    return None if v is None else int(round(v))


def map_sleep(s):
    return {
        "sleep_seconds": _int(_g(s, "sleepTimeSeconds")),
        "sleep_score": _int(_g(s, "sleepScores", "overall", "value")),
        "deep_seconds": _int(_g(s, "deepSleepSeconds")),
        "light_seconds": _int(_g(s, "lightSleepSeconds")),
        "rem_seconds": _int(_g(s, "remSleepSeconds")),
        "awake_seconds": _int(_g(s, "awakeSleepSeconds")),
    }


def map_hrv(h):
    return {
        "hrv_last_night": _int(_g(h, "hrvSummary", "lastNightAvg")),
        "hrv_weekly_avg": _int(_g(h, "hrvSummary", "weeklyAvg")),
    }


def map_heart_rate(h):
    return {"resting_hr": _int(_g(h, "restingHeartRate"))}


def map_body_battery(b):
    return {"body_battery_charged": _int(_g(b, "charged")), "body_battery_drained": _int(_g(b, "drained"))}


def map_stress(s):
    return {"stress_overall": _int(_g(s, "values", "overallStressLevel"))}


def map_fitness_age(f):
    return {"fitness_age": _int(_g(f, "fitnessAge"))}


def map_activity(a):
    start = a.get("startTimeLocal") or ""
    return {
        "activity_id": a["activityId"],
        "day": start[:10],
        "activity_type": _g(a, "activityType", "typeKey"),
        "duration_seconds": _int(a.get("duration")),
        "training_load": a.get("activityTrainingLoad"),
        "aerobic_effect": a.get("aerobicTrainingEffect"),
        "anaerobic_effect": a.get("anaerobicTrainingEffect"),
    }


def _safe(fn):
    try:
        return fn()
    except Exception as exc:  # one failed endpoint must not abort the day
        print(f"garmin call failed: {type(exc).__name__}")
        return None


def fetch_days(client, start, end):
    """Return {iso_day: {col: value}} for start..end inclusive."""
    days = [start + timedelta(days=i) for i in range((end - start).days + 1)]
    rows = {d.isoformat(): {} for d in days}
    s, e = start.isoformat(), end.isoformat()

    for item in _safe(lambda: client.get_daily_body_battery(s, e)) or []:
        if item.get("date") in rows:
            rows[item["date"]].update(map_body_battery(item))
    for item in _safe(lambda: client.get_daily_stress(s, e)) or []:
        if item.get("calendarDate") in rows:
            rows[item["calendarDate"]].update(map_stress(item))

    def per_day(d):
        iso = d.isoformat()
        out = {}
        for fn, mapper in (
            (client.get_daily_sleep, map_sleep),
            (client.get_daily_hrv, map_hrv),
            (client.get_daily_heart_rate, map_heart_rate),
        ):
            data = _safe(lambda: fn(iso))
            if data:
                out.update(mapper(data))
        return iso, out

    with ThreadPoolExecutor(max_workers=6) as pool:
        for iso, out in pool.map(per_day, days):
            rows[iso].update(out)

    fa = _safe(lambda: client.get_fitness_age(e))
    if fa:
        rows[e].update(map_fitness_age(fa))
    return rows


def upsert_days(conn, rows):
    cols = ", ".join(DAILY_COLS)
    ph = ", ".join(["%s"] * len(DAILY_COLS))
    # COALESCE keeps an earlier good value when a re-run gets nothing for a column
    sets = ", ".join(f"{c} = coalesce(excluded.{c}, garmin.daily_official.{c})" for c in DAILY_COLS)
    sql = (
        f"insert into garmin.daily_official (day, {cols}, synced_at) values (%s, {ph}, now()) "
        f"on conflict (day) do update set {sets}, synced_at = now()"
    )
    n = 0
    with conn.cursor() as cur:
        for day, vals in rows.items():
            if not vals:
                continue
            cur.execute(sql, [day] + [vals.get(c) for c in DAILY_COLS])
            n += 1
    return n


def upsert_activities(conn, acts):
    sql = (
        "insert into garmin.activity_load (activity_id, day, activity_type, duration_seconds, training_load, "
        "aerobic_effect, anaerobic_effect, synced_at) values (%(activity_id)s, %(day)s, %(activity_type)s, "
        "%(duration_seconds)s, %(training_load)s, %(aerobic_effect)s, %(anaerobic_effect)s, now()) "
        "on conflict (activity_id) do update set day = excluded.day, activity_type = excluded.activity_type, "
        "duration_seconds = excluded.duration_seconds, training_load = excluded.training_load, "
        "aerobic_effect = excluded.aerobic_effect, anaerobic_effect = excluded.anaerobic_effect, synced_at = now()"
    )
    with conn.cursor() as cur:
        for a in acts:
            cur.execute(sql, a)
    return len(acts)


def fetch_activities(client, start, end):
    res = _safe(lambda: client.search_activities(start_date=start.isoformat(), end_date=end.isoformat(), limit=200))
    return [map_activity(a) for a in (res or []) if a.get("activityId") and a.get("startTimeLocal")]


def make_client_ctx():
    from garmin_personal_api import GarminPersonalApiClient
    from garmin_personal_api.auth import PersonalApiAuthenticator

    # the package defaults its token cache to ~/.config, which is read-only on Vercel
    os.makedirs(TOKEN_CACHE_DIR, exist_ok=True)
    with PersonalApiAuthenticator(bearer_token_cache_file=os.path.join(TOKEN_CACHE_DIR, "bearer-token.json")) as auth:
        token = auth.obtain_token(os.environ["GARMIN_PERSONAL_API_KEY"])
    return GarminPersonalApiClient(bearer_token=token.access_token)


def run_sync(conn, client, backfill=False):
    end = yesterday_kl()
    with conn.cursor() as cur:
        cur.execute("select count(*) from garmin.daily_official")
        empty = cur.fetchone()[0] == 0
    start = end - timedelta(days=BACKFILL_DAYS - 1) if (backfill or empty) else end
    rows = fetch_days(client, start, end)
    days = upsert_days(conn, rows)
    acts = upsert_activities(conn, fetch_activities(client, start, end))
    return {"from": start.isoformat(), "to": end.isoformat(), "days": days, "activities": acts}
