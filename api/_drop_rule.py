from __future__ import annotations

DROP_THRESHOLD = -0.10
WINDOW_DAYS = 14


def pct_change(today, past):
    if today is None or not past:
        return None
    return (today - past) / past


def should_alert(today_ctl, past_ctl, has_unresolved):
    change = pct_change(today_ctl, past_ctl)
    return change is not None and change <= DROP_THRESHOLD and not has_unresolved


def check_fitness_drop(conn):
    """Insert a fitness_drop alert if ctl fell >=10% vs 14 days ago. Returns the message or None."""
    with conn.cursor() as cur:
        cur.execute("select day, ctl from garmin.training_snapshot where ctl is not null order by day desc limit 1")
        latest = cur.fetchone()
        if not latest:
            return None
        day, ctl = latest
        cur.execute(
            "select ctl from garmin.training_snapshot where ctl is not null and day <= %s - %s order by day desc limit 1",
            (day, WINDOW_DAYS),
        )
        past = cur.fetchone()
        if not past:
            return None
        cur.execute("select 1 from garmin.alert where kind = 'fitness_drop' and resolved_at is null limit 1")
        unresolved = cur.fetchone() is not None
        if not should_alert(float(ctl), float(past[0]), unresolved):
            return None
        pct = abs(pct_change(float(ctl), float(past[0]))) * 100
        msg = f"Fitness fell {pct:.0f}% in the last {WINDOW_DAYS} days (from {float(past[0]):.0f} to {float(ctl):.0f})."
        cur.execute("insert into garmin.alert (kind, message) values ('fitness_drop', %s)", (msg,))
        return msg
