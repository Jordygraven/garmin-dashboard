import os
import re
import sys
from datetime import date, datetime, timedelta, timezone

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "mac"))

import garmin_sync as m  # noqa: E402

DAY = date(2026, 10, 27)
YDAY = date(2026, 10, 26)


# ---------- EWMA fallback ----------

def test_ewma_constant_load_converges_to_load():
    loads = {DAY - timedelta(days=i): 100.0 for i in range(0, 181)}
    r = m.ewma_load(loads, DAY)
    assert r["atl"] == pytest.approx(100, rel=0.01)
    assert r["ctl"] == pytest.approx(100, rel=0.02)  # 42-day average, 180 days of history
    assert r["tsb"] == pytest.approx(r["ctl"] - r["atl"])


def test_ewma_single_spike_atl_moves_faster_than_ctl():
    r = m.ewma_load({DAY: 420.0}, DAY)
    assert r["ctl"] == pytest.approx(420 / 42)
    assert r["atl"] == pytest.approx(420 / 7)
    assert r["load_ratio"] == pytest.approx(r["atl"] / r["ctl"])
    assert r["tsb"] < 0


def test_ewma_no_history_returns_none():
    assert m.ewma_load({}, DAY) is None
    assert m.ewma_load({DAY - timedelta(days=400): 50.0}, DAY) is None


# ---------- fakes ----------

class FakeCur:
    def __init__(self, db):
        self.db, self.rows = db, []

    def __enter__(self):
        return self

    def __exit__(self, *a):
        pass

    def execute(self, sql, params=None):
        self.db["sql"].append((" ".join(sql.split()), params))
        if "from garmin.goal" in sql:
            self.rows = [(d,) for d in self.db["goal"]]
        elif "from garmin.activity_load" in sql:
            self.rows = self.db["loads"]

    def fetchall(self):
        return self.rows


class FakeConn:
    def __init__(self, goal=("half_marathon", "marathon"), loads=()):
        self.db = {"sql": [], "goal": list(goal), "loads": list(loads)}

    def cursor(self):
        return FakeCur(self.db)

    def writes(self, table):
        return [(s, p) for s, p in self.db["sql"] if s.startswith(f"insert into garmin.{table}")]


class Http429(Exception):
    pass


Http429.__name__ = "GarminConnectTooManyRequestsError"


class FakeClient:
    def __init__(self, fail_429_on=None):
        self.calls, self.fail_429_on = [], fail_429_on

    def _hit(self, name, d):
        self.calls.append((name, d))
        if (name, d) == self.fail_429_on:
            raise Http429()

    def get_training_readiness(self, d):
        self._hit("readiness", d)
        return [{"calendarDate": d, "timestamp": f"{d}T01:08:52.0", "score": 69, "level": "HIGH",
                 "feedbackShort": "GOOD", "sleepScore": 80, "hrvWeeklyAverage": 63}]

    def get_max_metrics(self, d):
        self._hit("max_metrics", d)
        return [{"generic": {"calendarDate": d, "vo2MaxValue": 61, "vo2MaxPreciseValue": 61.2}}]

    def get_training_status(self, d):
        self._hit("training_status", d)
        return {"mostRecentTrainingStatus": {"latestTrainingStatusData": {"1": {
            "calendarDate": d, "primaryTrainingDevice": True, "trainingStatusFeedbackPhrase": "PRODUCTIVE_1",
            "fitnessTrend": 2,
            "acuteTrainingLoadDTO": {"dailyTrainingLoadAcute": 380, "dailyTrainingLoadChronic": 400,
                                     "dailyAcuteChronicWorkloadRatio": 0.9}}}}}

    def get_race_predictions(self, *args):
        d = args[0] if args else DAY.isoformat()
        self._hit("races", d)
        return {"calendarDate": d, "time5K": 1100.4, "time10K": 2300, "timeHalfMarathon": 5469, "timeMarathon": 11500}


# ---------- upsert keys ----------

def test_upsert_conflict_keys():
    assert "on conflict (day, read_at) do update" in m.UPSERT_READINESS
    assert "on conflict (day) do update" in m.UPSERT_SNAPSHOT
    assert "on conflict (day, distance) do update" in m.UPSERT_RACE


def test_run_writes_both_days_with_upserts():
    conn = FakeConn()
    assert m.sync(FakeClient(), conn, DAY) == m.EXIT_OK
    assert len(conn.writes("readiness_reading")) == 2
    assert len(conn.writes("training_snapshot")) == 2
    assert len(conn.writes("race_prediction")) == 8  # 4 distances x 2 days
    assert all("on conflict" in s for t in ("readiness_reading", "training_snapshot", "race_prediction") for s, _ in conn.writes(t))
    snap = conn.writes("training_snapshot")[0][1]
    assert (snap["day"], snap["ctl"], snap["atl"], snap["tsb"], snap["load_ratio"]) == ("2026-10-26", 400, 380, 20, 0.9)
    assert {p["distance"] for _, p in conn.writes("race_prediction")} == {"5k", "10k", "half_marathon", "marathon"}


def test_rerun_issues_identical_params():
    a, b = FakeConn(), FakeConn()
    m.sync(FakeClient(), a, DAY)
    m.sync(FakeClient(), b, DAY)
    assert a.db["sql"] == b.db["sql"]


def test_yesterday_comes_before_today():
    c = FakeClient()
    m.sync(c, FakeConn(), DAY)
    days = [d for name, d in c.calls if name == "readiness"]
    assert days == ["2026-10-26", "2026-10-27"]


# ---------- Garmin vs EWMA source ----------

def test_ewma_used_only_when_garmin_has_no_load():
    class NoLoad(FakeClient):
        def get_training_status(self, d):
            self._hit("training_status", d)
            return {}

    conn = FakeConn(loads=[(YDAY, 200.0), (DAY, 100.0)])
    m.sync(NoLoad(), conn, DAY)
    snap = conn.writes("training_snapshot")[-1][1]
    assert snap["ctl"] is not None and snap["atl"] is not None and snap["acute_load"] is None


def test_no_fabricated_load_without_any_history():
    class NoLoad(FakeClient):
        def get_training_status(self, d):
            return {}

    conn = FakeConn(loads=[])
    m.sync(NoLoad(), conn, DAY)
    snap = conn.writes("training_snapshot")[0][1]
    assert snap["ctl"] is None and snap["atl"] is None


# ---------- rate limit ----------

def test_429_stops_run_without_retry_and_exits_nonzero(capsys):
    c = FakeClient(fail_429_on=("max_metrics", "2026-10-26"))
    conn = FakeConn()
    code = m.sync(c, conn, DAY)
    assert code == m.EXIT_RATE_LIMITED != 0
    assert c.calls.count(("max_metrics", "2026-10-26")) == 1  # no retry
    assert all(d == "2026-10-26" for _, d in c.calls)  # never reached today
    err = capsys.readouterr().err
    assert "status=429" in err and "day=2026-10-26" in err


def test_429_on_today_keeps_yesterday_writes():
    conn = FakeConn()
    code = m.sync(FakeClient(fail_429_on=("training_status", "2026-10-27")), conn, DAY)
    assert code == m.EXIT_RATE_LIMITED
    assert len(conn.writes("readiness_reading")) == 2  # yesterday done, today's readiness already written
    assert len(conn.writes("race_prediction")) == 4  # only yesterday


def test_non_429_failure_logged_by_class_only(capsys):
    class Boom(FakeClient):
        def get_max_metrics(self, d):
            raise RuntimeError("secret-body-text")

    code = m.sync(Boom(), FakeConn(), DAY)
    err = capsys.readouterr().err
    assert code == m.EXIT_FAILED
    assert "RuntimeError" in err and "secret-body-text" not in err


def test_goal_distance_mismatch_skips_races():
    conn = FakeConn(goal=("21097",))
    code = m.sync(FakeClient(), conn, DAY)
    assert code == m.EXIT_FAILED and not conn.writes("race_prediction")


def test_main_connect_disables_prepared_statements():
    src = open(os.path.join(os.path.dirname(m.__file__), "garmin_sync.py")).read()
    assert re.search(r"psycopg\.connect\([^)]*prepare_threshold=None", src)
