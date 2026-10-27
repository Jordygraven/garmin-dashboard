import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "api"))

from _drop_rule import check_fitness_drop, pct_change, should_alert  # noqa: E402


def test_pct_change():
    assert pct_change(90, 100) == -0.1
    assert pct_change(None, 100) is None
    assert pct_change(90, 0) is None


def test_alert_at_exactly_10_percent():
    assert should_alert(90, 100, False)


def test_no_alert_under_threshold():
    assert not should_alert(91, 100, False)
    assert not should_alert(120, 100, False)


def test_no_alert_when_unresolved_exists():
    assert not should_alert(50, 100, True)


class FakeCur:
    def __init__(self, db):
        self.db, self.res = db, None

    def __enter__(self):
        return self

    def __exit__(self, *a):
        pass

    def execute(self, sql, params=None):
        s = " ".join(sql.split())
        if "order by day desc limit 1" in s and "<=" not in s:
            self.res = self.db["snap"][0] if self.db["snap"] else None
        elif "<=" in s:
            day, win = params
            older = [r for r in self.db["snap"] if (day - r[0]).days >= win]
            self.res = (older[0][1],) if older else None
        elif "from garmin.alert" in s:
            self.res = (1,) if self.db["unresolved"] else None
        elif s.startswith("insert into garmin.alert"):
            self.db["inserted"].append(params[0])

    def fetchone(self):
        return self.res


class FakeConn:
    def __init__(self, snap, unresolved=False):
        self.db = {"snap": snap, "unresolved": unresolved, "inserted": []}

    def cursor(self):
        return FakeCur(self.db)


def _d(n):
    from datetime import date, timedelta
    return date(2026, 10, 27) - timedelta(days=n)


def test_inserts_on_drop():
    c = FakeConn([(_d(0), 80), (_d(14), 100)])
    msg = check_fitness_drop(c)
    assert "20%" in msg and c.db["inserted"] == [msg]


def test_idempotent_with_unresolved():
    c = FakeConn([(_d(0), 80), (_d(14), 100)], unresolved=True)
    assert check_fitness_drop(c) is None and not c.db["inserted"]


def test_no_rows_does_nothing():
    assert check_fitness_drop(FakeConn([])) is None
    c = FakeConn([(_d(0), 80)])
    assert check_fitness_drop(c) is None


def test_stable_fitness_no_alert():
    c = FakeConn([(_d(0), 98), (_d(14), 100)])
    assert check_fitness_drop(c) is None
