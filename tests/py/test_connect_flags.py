import ast
import glob
import os

API = os.path.join(os.path.dirname(__file__), "..", "..", "api")


def _connect_calls():
    for path in glob.glob(os.path.join(API, "*.py")):
        for node in ast.walk(ast.parse(open(path).read())):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "connect":
                yield path, node


def test_every_connect_disables_prepared_statements():
    calls = list(_connect_calls())
    assert calls, "expected at least one psycopg.connect call in api/"
    for path, node in calls:
        kw = {k.arg: k.value for k in node.keywords}
        ok = "prepare_threshold" in kw and isinstance(kw["prepare_threshold"], ast.Constant) and kw["prepare_threshold"].value is None
        assert ok, f"{os.path.basename(path)}:{node.lineno} connect() must pass prepare_threshold=None"
