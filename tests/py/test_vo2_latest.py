import os
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "mac"))

import garmin_sync as m  # noqa: E402
from test_mac_sync import FakeConn  # noqa: E402

DAY = date(2026, 10, 27)
GENERIC = {"vo2MaxValue": 61.0, "vo2MaxPreciseValue": 61.2}


class Run:
    failures = 0

    def call(self, day, what, fn):
        return fn()


class Client:
    def __init__(self, daily, latest):
        self.daily, self.latest = daily, latest

    def get_max_metrics(self, d):
        return self.daily

    def get_max_metrics_latest(self, d):
        return self.latest

    def get_training_status(self, d):
        return None


def test_dict_shape():
    assert m.vo2_from_max_metrics({"generic": GENERIC}) == (61.0, 61.2)


def test_list_shape():
    assert m.vo2_from_max_metrics([{"generic": GENERIC}]) == (61.0, 61.2)


def test_empty_list_falls_back_to_latest(monkeypatch):
    saved = []
    monkeypatch.setattr(m, "execute", lambda conn, sql, snap: saved.append(snap))
    m.sync_snapshot(Client([], {"generic": GENERIC}), FakeConn(), DAY, Run())
    assert saved[0]["vo2_max"] == 61.0 and saved[0]["vo2_max_precise"] == 61.2


def test_most_recent_vo2_from_earlier_day_is_kept():
    status = m.training_status_fields({"mostRecentVO2Max": {"generic": {"calendarDate": "2026-10-20", **GENERIC}}}, DAY)
    assert status["vo2_max"] == 61.0
