import os
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "api"))

import _garmin_sync as g  # noqa: E402


def test_parse_days():
    assert g.parse_days(None) == 14
    assert g.parse_days("abc") == 14
    assert g.parse_days("7") == 7
    assert g.parse_days("500") == 90
    assert g.parse_days("0") == 1
    assert g.parse_days("-3") == 1


def test_window_ends_yesterday_and_spans_n_days():
    assert g.window(date(2026, 10, 26), 14) == (date(2026, 10, 13), date(2026, 10, 26))
    assert g.window(date(2026, 10, 26), 1) == (date(2026, 10, 26), date(2026, 10, 26))
    start, end = g.window(date(2026, 10, 26), 90)
    assert (end - start).days == 89


class HttpErr(Exception):
    def __init__(self, status):
        super().__init__(f"GET https://x/y returned HTTP {status}")
        self.status_code, self.url = status, "https://x/y"


class FakeClient:
    def __init__(self, fail_on=None, status=429, activities_status=None):
        self.fail_on, self.status, self.activities_status = fail_on, status, activities_status
        self.sleep_calls = []

    def get_daily_body_battery(self, s, e):
        return []

    def get_daily_stress(self, s, e):
        return []

    def get_daily_sleep(self, iso):
        self.sleep_calls.append(iso)
        if iso == self.fail_on:
            raise HttpErr(self.status)
        return {"sleepTimeSeconds": 25000}

    def get_daily_hrv(self, iso):
        return {"hrvSummary": {"lastNightAvg": 60, "weeklyAvg": 62}}

    def get_daily_heart_rate(self, iso):
        return {"restingHeartRate": 41}

    def get_fitness_age(self, iso):
        return {"fitnessAge": 21.4}

    def search_activities(self, **kw):
        if self.activities_status:
            raise HttpErr(self.activities_status)
        return []


class FakeCur:
    def __init__(self, db):
        self.db = db

    def __enter__(self):
        return self

    def __exit__(self, *a):
        pass

    def execute(self, sql, params=None):
        if "count(*)" in sql:
            self.res = (5,)
        elif "garmin.daily_official" in sql:
            self.db["upserted"].append(params[0])

    def fetchone(self):
        return self.res


class FakeConn:
    def __init__(self):
        self.db = {"upserted": []}

    def cursor(self):
        return FakeCur(self.db)


def run(client, days, monkeypatch):
    monkeypatch.setattr(g, "yesterday_kl", lambda: date(2026, 10, 26))
    conn = FakeConn()
    return g.run_sync(conn, client, backfill=True, days=days), conn.db["upserted"]


def test_stops_at_first_429_without_retry(monkeypatch):
    client = FakeClient(fail_on="2026-10-24")
    result, upserted = run(client, 5, monkeypatch)
    assert result["ok"] is False and result["reason"] == "rate_limited"
    assert result["stopped_on"] == "2026-10-24" and result["days_completed"] == 2
    assert upserted == ["2026-10-22", "2026-10-23"]
    assert client.sleep_calls == ["2026-10-22", "2026-10-23", "2026-10-24"]  # one try, then stop


def test_non_429_error_does_not_stop(monkeypatch):
    client = FakeClient(fail_on="2026-10-24", status=500)
    result, upserted = run(client, 5, monkeypatch)
    assert result["days"] == 5 and "2026-10-26" in upserted


def test_activities_429_reported_after_days_saved(monkeypatch):
    result, upserted = run(FakeClient(activities_status=429), 3, monkeypatch)
    assert result["reason"] == "rate_limited" and result["stopped_on"] == "activities"
    assert result["days_completed"] == 3 and len(upserted) == 3


def test_ok_run(monkeypatch):
    result, _ = run(FakeClient(), 3, monkeypatch)
    assert result == {"from": "2026-10-24", "to": "2026-10-26", "days": 3, "activities": 0}
