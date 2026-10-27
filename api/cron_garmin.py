from __future__ import annotations

import hmac
import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(__file__))


def authorized(header):
    secret = os.environ.get("CRON_SECRET")
    if not secret:
        return False
    return hmac.compare_digest(header or "", f"Bearer {secret}")


class handler(BaseHTTPRequestHandler):
    def _send(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if not authorized(self.headers.get("Authorization")):
            return self._send(401, {"error": "unauthorized"})
        qs = parse_qs(urlparse(self.path).query)
        manual = qs.get("manual", ["0"])[0] == "1"
        backfill = qs.get("mode", [""])[0] == "backfill"
        try:
            import psycopg
            from _drop_rule import check_fitness_drop
            from _garmin_sync import make_client_ctx, parse_days, run_sync

            with psycopg.connect(os.environ["GARMIN_WRITER_DB_URL"]) as conn:
                with make_client_ctx() as client:
                    result = run_sync(conn, client, backfill=backfill, days=parse_days(qs.get("days", [None])[0]))
                if result.get("ok") is False:  # rate limited: keep completed days, skip the drop check
                    return self._send(429, result)
                # manual button runs the data pull only ("lane A")
                result["alert"] = None if manual else check_fitness_drop(conn)
            self._send(200, {"ok": True, **result})
        except Exception as exc:
            print(f"cron failed: {type(exc).__name__}")
            self._send(500, {"ok": False, "error": type(exc).__name__})
