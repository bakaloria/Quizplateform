#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fast importer for large exam-model batches using Firestore batch commit.

Unlike import_exam_models.py, this does not scan the whole `exams` collection.
It is intended for brand-new batch keys (e.g. the 500-model expanded batch).
It creates each exam plus its access code in at most two commit requests.

Usage:
  python3 tools/import_batch_fast.py --file data/arabic_exam_models_batch2.json --dry-run
  python3 tools/import_batch_fast.py --file data/arabic_exam_models_batch2.json --status draft
"""

import argparse
import datetime as dt
import json
import os
import string
import sys
import uuid
import urllib.parse

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from tools.cleanup_history_firestore import BASE, KEY, http, parse_value  # noqa: E402
from tools.import_exam_models import (  # noqa: E402
    batch_key_from_path,
    enc,
    existing_codes,
    model_to_exam,
    now_ts,
    random_code,
)

SUBJECT = {"id": "vfMyryVH36h2TqyxdTNU", "name": "اللغة العربية"}
COMMIT_URL = f"{BASE}:commit?key={KEY}"
QUERY_URL = f"{BASE}:runQuery?key={KEY}"
DOC_BASE = BASE.split("/v1/", 1)[1]  # relative document path required by commit writes
MAX_WRITES = 20


def existing_templates():
    """Fast scan of only templateKey (+ document path) to avoid full exam downloads."""
    out = {}
    token = None
    while True:
        url = f"{BASE}/exams?key={KEY}&pageSize=300&mask.fieldPaths=templateKey"
        if token:
            url += f"&pageToken={urllib.parse.quote(token)}"
        st, data = http("GET", url)
        if st != 200:
            raise RuntimeError(f"masked exam scan failed: {st}")
        for doc in data.get("documents", []) or []:
            val = parse_value((doc.get("fields") or {}).get("templateKey") or {})
            name = str(doc.get("name") or "")
            if val and "/documents/" in name:
                out[str(val)] = name.split("/documents/", 1)[1]
        token = data.get("nextPageToken")
        if not token:
            break
    return out


def existing_template_keys():
    return set(existing_templates())


def find_template_docs(keys):
    """Look up only the requested templateKeys with indexed queries (no full scan)."""
    out = {}
    keys = list(keys)
    for i in range(0, len(keys), 10):
        chunk = keys[i:i + 10]
        payload = {
            "structuredQuery": {
                "from": [{"collectionId": "exams"}],
                "where": {
                    "fieldFilter": {
                        "field": {"fieldPath": "templateKey"},
                        "op": "IN",
                        "value": {"arrayValue": {"values": [{"stringValue": k} for k in chunk]}},
                    }
                },
                "select": {"fields": [{"fieldPath": "templateKey"}]},
            }
        }
        st, resp = http("POST", QUERY_URL, payload)
        if st != 200:
            raise RuntimeError(f"template query failed: {st} {str(resp)[:300]}")
        for item in resp or []:
            doc = item.get("document")
            if not doc:
                continue
            val = parse_value((doc.get("fields") or {}).get("templateKey") or {})
            name = str(doc.get("name") or "")
            if val and "/documents/" in name:
                out[str(val)] = name.split("/documents/", 1)[1]
    return out


def commit(writes):
    st, resp = http("POST", COMMIT_URL, {"writes": writes})
    if st != 200:
        raise RuntimeError(f"commit failed: {st} {str(resp)[:600]}")
    return len(resp.get("results") or [])


def make_write(path, fields, create_only=True):
    write = {"update": {"name": f"{DOC_BASE}/{path}", "fields": fields}}
    if create_only:
        write["currentDocument"] = {"exists": False}
    return write


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--status", choices=["draft", "published"], default="draft")
    ap.add_argument("--optional", choices=["odd", "even", "first", "second"], default="odd")
    ap.add_argument("--update", action="store_true",
                    help="update existing templateKey exams instead of skipping them")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    with open(args.file, encoding="utf-8") as f:
        payload = json.load(f)
    meta = payload.get("meta") or {}
    models = payload.get("models") or []
    batch = batch_key_from_path(args.file, meta)
    print(f"Batch: {batch} | models: {len(models)} | status: {args.status}")

    built = [
        model_to_exam(m, meta, args.file, batch, args.status, args.optional, SUBJECT)
        for m in models
    ]
    if args.dry_run:
        first = built[0]
        print("DRY sample:", first["title"], first["templateKey"], first["totalPoints"],
              len(first["questions"]), "questions")
        print("DRY — no writes performed")
        return

    if args.update:
        existing = find_template_docs([p["templateKey"] for p in built])
        pending = list(built)
        print(f"Update mode | existing: {len(set(p['templateKey'] for p in built) & set(existing))}")
    else:
        existing = existing_templates()
        pending = [p for p in built if p["templateKey"] not in existing]
        print(f"Already present: {len(built) - len(pending)} | remaining: {len(pending)}")
    if not pending:
        print("Nothing to do.")
        return

    need_new_codes = any(not (args.update and existing.get(p["templateKey"])) for p in pending)
    codes = existing_codes() if need_new_codes else set()

    created = []
    updated = 0
    batch_writes = []
    batch_meta = []
    for payload_exam in pending:
        doc_path = existing.get(payload_exam["templateKey"])
        if args.update and doc_path:
            fields = {k: enc(v) for k, v in payload_exam.items()}
            batch_writes.append({
                "update": {"name": f"{DOC_BASE}/{doc_path}", "fields": fields}
            })
            updated += 1
            if len(batch_writes) >= MAX_WRITES:
                n = commit(batch_writes)
                print(f"Committed {n} writes — updated {updated}/{len(pending)}")
                batch_writes = []
            continue
        exam_id = uuid.uuid4().hex
        code = random_code(8)
        while code in codes:
            code = random_code(8)
        codes.add(code)
        doc = dict(payload_exam)
        doc.update({
            "code": code,
            "codeRotateEnabled": False,
            "codeRotateMinutes": 0,
            "codeRotatedAt": now_ts(),
            "createdBy": "importer-fast",
            "createdAt": now_ts(),
        })
        batch_writes.append(make_write(f"exams/{exam_id}", {k: enc(v) for k, v in doc.items()}))
        batch_writes.append(make_write(
            f"examCodes/{code}",
            {
                "code": enc(code),
                "examId": enc(exam_id),
                "createdAt": enc(dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")),
            },
        ))
        batch_meta.append((payload_exam["templateKey"], code, exam_id))
        if len(batch_writes) >= MAX_WRITES:
            n = commit(batch_writes)
            created.extend(batch_meta)
            print(f"Committed {n} writes — {len(created)}/{len(pending)} exams")
            batch_writes, batch_meta = [], []
    if batch_writes:
        n = commit(batch_writes)
        created.extend(batch_meta)
        print(f"Committed {n} writes — {len(created)}/{len(pending)} exams")

    print(f"Done — updated: {updated} | created: {len(created)}")
    for key, code, exam_id in created[:5]:
        print(f"  {key} -> {code} ({exam_id})")
    print("  ...")


if __name__ == "__main__":
    main()
