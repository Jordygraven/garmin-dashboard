import os
import sys
from datetime import date

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "mac"))

import garmin_sync as m  # noqa: E402
from test_mac_sync import FakeClient, FakeConn  # noqa: E402

TODAY = date(2026, 10, 27)


def test_no_arguments_keeps_default_window():
    args = m.parse_args([], today=TODAY)
    assert args.window is None
    assert m.default_window(TODAY) == (date(2026, 10, 26), TODAY)


def test_from_and_to_parsed():
    args = m.parse_args(["--from", "2026-10-01", "--to", "2026-10-20"], today=TODAY)
    assert args.window == (date(2026, 10, 1), date(2026, 10, 20))


def test_from_alone_ends_yesterday():
    assert m.parse_args(["--from", "2026-10-20"], today=TODAY).window == (date(2026, 10, 20), date(2026, 10, 26))


@pytest.mark.parametrize("argv", [
    ["--to", "2026-10-20"],
    ["--from", "2026-10-20", "--to", "2026-10-01"],
    ["--from", "2026-10-01", "--to", "2026-10-28"],
    ["--from", "2026-09-01", "--to", "2026-10-26"],
    ["--from", "nope"],
])
def test_bad_arguments_exit(argv):
    with pytest.raises(SystemExit) as e:
        m.parse_args(argv, today=TODAY)
    assert e.value.code == 2


def test_help_exits_before_any_sync(monkeypatch, capsys):
    monkeypatch.setattr(m, "keychain", lambda s: pytest.fail("help must not touch the keychain"))
    with pytest.raises(SystemExit) as e:
        m.main(["--help"])
    assert e.value.code == 0 and "--from" in capsys.readouterr().out


def test_backfill_writes_snapshots_oldest_first_and_nothing_else():
    c, conn = FakeClient(), FakeConn()
    code = m.backfill(c, conn, date(2026, 10, 20), date(2026, 10, 22))
    assert code == m.EXIT_OK
    assert [d for n, d in c.calls if n == "max_metrics"] == ["2026-10-20", "2026-10-21", "2026-10-22"]
    assert [p["day"] for _, p in conn.writes("training_snapshot")] == ["2026-10-20", "2026-10-21", "2026-10-22"]
    assert not conn.writes("readiness_reading") and not conn.writes("race_prediction")
    assert not [n for n, _ in c.calls if n in ("readiness", "races")]


def test_backfill_stops_at_first_429_and_reports_progress(capsys):
    c = FakeClient(fail_429_on=("training_status", "2026-10-22"))
    conn = FakeConn()
    code = m.backfill(c, conn, date(2026, 10, 20), date(2026, 10, 25))
    assert code == m.EXIT_RATE_LIMITED
    assert c.calls.count(("training_status", "2026-10-22")) == 1  # no retry
    assert all(d <= "2026-10-22" for _, d in c.calls)  # never went past the stop
    assert [p["day"] for _, p in conn.writes("training_snapshot")] == ["2026-10-20", "2026-10-21"]
    err = capsys.readouterr().err
    assert "status=429" in err and "day=2026-10-22" in err and "completed=2" in err and "last_completed=2026-10-21" in err
    assert "--from 2026-10-22" in err


def test_backfill_uses_ewma_only_when_garmin_has_no_load(capsys):
    class NoLoad(FakeClient):
        def get_training_status(self, d):
            self._hit("training_status", d)
            return {} if d == "2026-10-21" else super().get_training_status(d)

    conn = FakeConn(loads=[(date(2026, 10, 20), 150.0), (date(2026, 10, 21), 90.0)])
    m.backfill(NoLoad(), conn, date(2026, 10, 20), date(2026, 10, 21))
    out = capsys.readouterr().out
    assert "day=2026-10-20 snapshot_source=garmin" in out and "day=2026-10-21 snapshot_source=ewma" in out
