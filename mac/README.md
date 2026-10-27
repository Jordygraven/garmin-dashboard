# Mac-side Garmin sync (phase 2)

Fills `garmin.readiness_reading`, `garmin.training_snapshot` and `garmin.race_prediction`
once a day at 10:00 (Mac local time, which should be Asia/Kuala_Lumpur). Each run writes
yesterday and today, so one late run after the Mac wakes fills the gap. All writes are upserts.

## Setup

```sh
cd /Users/jordygraven/Developer/garmin-dashboard
uv venv --python 3.12 mac/.venv
uv pip install --python mac/.venv/bin/python -r mac/requirements.txt
mkdir -p ~/Library/Logs/garmin-mac-sync
```

### Keychain (each command prompts for the value, so nothing lands in shell history)

```sh
security add-generic-password -s garmin-email      -a "$USER" -w
security add-generic-password -s garmin-password   -a "$USER" -w
security add-generic-password -s garmin-writer-db  -a "$USER" -w   # the garmin_writer connection string
```

Use the transaction-pooler (port 6543) string. The script disables prepared statements for it.

## Try it once by hand

```sh
mac/.venv/bin/python mac/garmin_sync.py; echo "exit=$?"
```

Exit codes: `0` ok, `1` a call, login, keychain or database step failed, `2` Garmin rate limit (HTTP 429).
On a 429 the run stops, logs the status and the day, and does not retry.

## Backfill history

```sh
mac/.venv/bin/python mac/garmin_sync.py --from 2026-10-01 --to 2026-10-20
```

Fills `training_snapshot` only (VO2 max, training status, load), oldest day first. Readiness and race
predictions are not backfilled because Garmin keeps no history for them. `--to` defaults to yesterday and
the range is capped at 31 days. The quota is shared with the Vercel backfill, so run chunks of about 20 days.
On a 429 the run stops, logs the day it reached and the `--from` to resume with, and exits with code 2.
`--help` prints usage and exits without syncing.

## Schedule with launchd

```sh
cp mac/com.jordy.garmin-mac-sync.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.jordy.garmin-mac-sync.plist
```

Run it now (optional): `launchctl kickstart -k gui/$(id -u)/com.jordy.garmin-mac-sync`

Remove it:

```sh
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.jordy.garmin-mac-sync.plist
```

Logs: `~/Library/Logs/garmin-mac-sync/out.log` and `err.log`. If the Mac sleeps through 10:00,
launchd runs the job once on wake.

## Data sources and fitness load

| Table | Source (garminconnect 0.3.x) |
|---|---|
| `readiness_reading` | `get_training_readiness(day)`: one row per reading, key `(day, read_at)` |
| `training_snapshot` | `get_max_metrics(day)` (VO2 max), `get_training_status(day)` (status, trend, acute/chronic load), key `day` |
| `race_prediction` | `get_race_predictions()` for today, `get_race_predictions(day, day, "daily")` for yesterday, key `(day, distance)` |

`ctl` is Garmin's chronic load, `atl` its acute load, `tsb = ctl - atl`, `load_ratio` Garmin's acute:chronic ratio.
Only when Garmin returns no load for a day, they are computed from `garmin.activity_load` with exponentially
weighted averages (alpha = 1/42 for ctl, 1/7 for atl, seeded at 0 over the last 180 days). Each run logs which source
it used (`snapshot_source=garmin|ewma|none`). The table has no source column.

## Race distance format

`DISTANCE_KEYS` in `garmin_sync.py` sets the `distance` value written to `race_prediction`
(`5k`, `10k`, `half_marathon`, `marathon`). It must equal the values in `garmin.goal.distance`, because
the dashboard matches them by equality. At startup the script checks `goal.distance` against this mapping and
skips race predictions (exit code 1) if they differ. Edit the mapping if your goals use another format.

## Limits

- Credential login happens every run. No token file is stored, to keep secrets out of files.
- The EWMA fallback starts from zero, so it understates load until about 180 days of `activity_load` exist.
