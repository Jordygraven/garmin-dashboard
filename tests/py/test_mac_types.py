import os
import sys
from datetime import date, datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "mac"))

import garmin_sync as m  # noqa: E402
from test_mac_sync import FakeConn  # noqa: E402

DAY = date(2026, 10, 27)

READINESS = [{
    "calendarDate": "2026-10-27", "timestamp": "2026-10-27T12:15:30.0",  # 20:15:30 in Kuala Lumpur
    "score": 68.6, "level": "HIGH", "feedbackShort": "GOOD", "sleepScore": 79.5, "hrvWeeklyAverage": 62.5,
}]
STATUS = {
    "mostRecentTrainingStatus": {"latestTrainingStatusData": {"1": {
        "calendarDate": "2026-10-27", "primaryTrainingDevice": True,
        "trainingStatusFeedbackPhrase": "PRODUCTIVE_1", "fitnessTrend": 2.4,
        "acuteTrainingLoadDTO": {"dailyTrainingLoadAcute": 379.6, "dailyTrainingLoadChronic": 585.5,
                                 "dailyAcuteChronicWorkloadRatio": 0.6482},
    }}},
}


def snapshot(vo2=(61.0, 61.24), status=STATUS):
    return m.build_snapshot(DAY, vo2, m.training_status_fields(status, DAY), FakeConn())[0]


def test_integer_columns_are_ints_rounded_half_up():
    p = snapshot()
    assert (p["acute_load"], p["chronic_load"], p["fitness_trend"]) == (380, 586, 2)
    assert (p["atl"], p["ctl"]) == (380, 586)
    for k in ("ctl", "atl", "tsb", "acute_load", "chronic_load", "fitness_trend"):
        assert type(p[k]) is int, k


def test_tsb_is_difference_of_rounded_values():
    p = snapshot()
    assert p["tsb"] == p["ctl"] - p["atl"] == 206


def test_numeric_columns_stay_float():
    p = snapshot()
    assert p["load_ratio"] == 0.6482 and type(p["load_ratio"]) is float
    assert p["vo2_max"] == 61.0 and type(p["vo2_max"]) is float
    assert p["vo2_max_precise"] == 61.24 and type(p["vo2_max_precise"]) is float


def test_training_status_is_text():
    assert snapshot()["training_status"] == "PRODUCTIVE_1"


def test_ewma_fallback_values_are_also_ints():
    conn = FakeConn(loads=[(date(2026, 10, 20), 183.7), (DAY, 95.3)])
    p, source = m.build_snapshot(DAY, (None, None), {}, conn)
    assert source == "ewma"
    for k in ("ctl", "atl", "tsb"):
        assert type(p[k]) is int, k
    assert type(p["load_ratio"]) is float


def test_readiness_ints_and_naive_local_read_at():
    (row,) = m.readiness_rows(READINESS, DAY)
    assert (row["score"], row["sleep_score"], row["hrv_weekly_avg"]) == (69, 80, 63)
    assert all(type(row[k]) is int for k in ("score", "sleep_score", "hrv_weekly_avg"))
    assert row["read_at"] == datetime(2026, 10, 27, 20, 15, 30)
    assert row["read_at"].tzinfo is None
    assert row["level"] == "HIGH" and row["feedback"] == "GOOD"


def test_race_seconds_are_ints_and_distances_match_schema_strings():
    data = {"calendarDate": "2026-10-27", "time5K": 1100.4, "time10K": 2300.5,
            "timeHalfMarathon": 5469.6, "timeMarathon": 11500.2}
    rows = m.race_rows(data, DAY)
    assert {r["distance"]: r["seconds"] for r in rows} == {
        "5k": 1100, "10k": 2301, "half_marathon": 5470, "marathon": 11500}
    assert all(type(r["seconds"]) is int for r in rows)
    assert m.DISTANCE_KEYS["timeHalfMarathon"] == "half_marathon" and m.DISTANCE_KEYS["timeMarathon"] == "marathon"


def test_goal_strings_pass_the_startup_check():
    ok, _ = m.check_distances(FakeConn(goal=("marathon", "half_marathon")))
    assert ok


def test_to_int_edges():
    assert m.to_int(None) is None
    assert m.to_int(0.5) == 1 and m.to_int(2.5) == 3 and m.to_int(-0.4) == 0
    assert m.to_int("12.4") == 12
