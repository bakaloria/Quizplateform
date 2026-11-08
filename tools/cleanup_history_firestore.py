#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Merge all History subjects into one, remove duplicate questions,
remove questions without a model answer, and repair incomplete
ordering/matching/comparison questions where possible.

Usage:
  python3 tools/cleanup_history_firestore.py --scan
  python3 tools/cleanup_history_firestore.py --apply
  python3 tools/cleanup_history_firestore.py --verify
"""

import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PROJECT = "tasks-for-quran"
KEY = "AIzaSyBfsSesYqniyBituMfbQ6S-7PQgsxx_ETc"
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
PREFERRED_ID = "ia5oFVzDcuWGnwaiVq36"
HISTORY_RE = re.compile(r"(تاريخ|history)", re.I)
PAGE = 300
BATCH = 400
PLAN_PATH = "/tmp/history_cleanup_plan.json"
REPORT_PATH = "/tmp/history_cleanup_report.json"


def http(method, url, body=None, retries=6):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method, headers={"Content-Type": "application/json"}
    )
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                raw = resp.read().decode("utf-8")
                return resp.status, json.loads(raw) if raw.strip() else {}
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8", "replace")
            try:
                parsed = json.loads(raw) if raw.strip() else {}
            except Exception:
                parsed = {"raw": raw}
            if e.code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            return e.code, parsed
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            raise
    raise RuntimeError("unreachable")


def parse_value(v):
    if "stringValue" in v:
        return v["stringValue"]
    if "integerValue" in v:
        return int(v["integerValue"])
    if "doubleValue" in v:
        return float(v["doubleValue"])
    if "booleanValue" in v:
        return v["booleanValue"]
    if "timestampValue" in v:
        return v["timestampValue"]
    if "nullValue" in v:
        return None
    if "arrayValue" in v:
        return [parse_value(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v:
        return {k: parse_value(x) for k, x in v["mapValue"].get("fields", {}).items()}
    if "referenceValue" in v:
        return v["referenceValue"]
    if "geoPointValue" in v:
        return v["geoPointValue"]
    return None


def encode_value(v):
    if v is None:
        return {"nullValue": None}
    if isinstance(v, bool):
        return {"booleanValue": v}
    if isinstance(v, int):
        return {"integerValue": str(v)}
    if isinstance(v, float):
        return {"doubleValue": v}
    if isinstance(v, str):
        return {"stringValue": v}
    if isinstance(v, list):
        return {"arrayValue": {"values": [encode_value(x) for x in v]}}
    if isinstance(v, dict):
        return {
            "mapValue": {
                "fields": {str(k): encode_value(x) for k, x in v.items()}
            }
        }
    return {"stringValue": str(v)}


def parse_document(doc):
    return {
        "id": doc["name"].rsplit("/", 1)[-1],
        "name": doc["name"],
        "createTime": doc.get("createTime"),
        "updateTime": doc.get("updateTime"),
        "data": {
            k: parse_value(v) for k, v in (doc.get("fields") or {}).items()
        },
    }


def list_subjects():
    out = []
    token = None
    while True:
        url = f"{BASE}/subjects?key={KEY}&pageSize={PAGE}"
        if token:
            url += f"&pageToken={urllib.parse.quote(token)}"
        st, data = http("GET", url)
        if st != 200:
            raise RuntimeError(f"subjects GET failed: {st} {data}")
        for doc in data.get("documents", []) or []:
            out.append(parse_document(doc))
        token = data.get("nextPageToken")
        if not token:
            break
    return out


def run_query_questions(subject_id, last_name=None):
    sq = {
        "from": [{"collectionId": "questions"}],
        "where": {
            "fieldFilter": {
                "field": {"fieldPath": "subjectId"},
                "op": "EQUAL",
                "value": {"stringValue": subject_id},
            }
        },
        "orderBy": [{"field": {"fieldPath": "__name__"}, "direction": "ASCENDING"}],
        "limit": PAGE,
    }
    if last_name:
        # REST uses startAt with before=false to start just after the cursor.
        sq["startAt"] = {"values": [{"referenceValue": last_name}], "before": False}
    st, data = http(
        "POST", f"{BASE}:runQuery?key={KEY}", {"structuredQuery": sq}
    )
    if st != 200:
        raise RuntimeError(f"runQuery failed: {st} {data}")
    docs = []
    for item in data if isinstance(data, list) else []:
        if "document" in item:
            docs.append(parse_document(item["document"]))
    return docs


def list_all_questions():
    out = []
    token = None
    page = 0
    while True:
        page += 1
        url = f"{BASE}/questions?key={KEY}&pageSize={PAGE}"
        if token:
            url += f"&pageToken={urllib.parse.quote(token)}"
        st, data = http("GET", url)
        if st != 200:
            raise RuntimeError(f"questions GET failed: {st} {data}")
        for doc in data.get("documents", []) or []:
            out.append(parse_document(doc))
        print(f"  all questions page {page}: total {len(out)}", flush=True)
        token = data.get("nextPageToken")
        if not token:
            break
    return out


def fetch_subject_questions(subject_id):
    docs = []
    last = None
    page = 0
    while True:
        page += 1
        try:
            batch = run_query_questions(subject_id, last)
        except Exception as e:
            print(f"  runQuery failed for {subject_id}: {e}; falling back to full scan", flush=True)
            return [d for d in list_all_questions() if d["data"].get("subjectId") == subject_id]
        docs.extend(batch)
        print(f"  {subject_id} page {page}: {len(batch)} (total {len(docs)})", flush=True)
        if len(batch) < PAGE:
            break
        last = batch[-1]["name"]
    return docs


def non_empty(v):
    if v is None:
        return False
    if isinstance(v, bool):
        return True
    if isinstance(v, (int, float)):
        return True
    if isinstance(v, str):
        return bool(v.strip())
    if isinstance(v, list):
        return len(v) > 0 and any(non_empty(x) for x in v)
    if isinstance(v, dict):
        return len(v) > 0
    return False


def norm_text(s):
    s = str(s) if s is not None else ""
    s = re.sub(r"[\u064B-\u065F\u0670\u0640]", "", s)
    s = re.sub(r"[أإآٱ]", "ا", s)
    s = s.replace("ى", "ي").replace("ة", "ه")
    s = re.sub(r"[^\u0600-\u06FF0-9A-Za-z]+", " ", s)
    return re.sub(r"\s+", " ", s).strip().lower()


def get_model_answer(q):
    for k in ("answer", "correctAnswer", "modelAnswer"):
        if non_empty(q.get(k)):
            return q.get(k)
    return None


def normalize_tf(v):
    if v is True or v == 1:
        return "صح"
    if v is False or v == 0:
        return "خطأ"
    s = str(v).strip().lower() if v is not None else ""
    if s in ("true", "1", "صح", "صحيح", "yes", "نعم"):
        return "صح"
    if s in ("false", "0", "خطأ", "خطا", "غير صحيح", "no", "لا"):
        return "خطأ"
    return None


def same_set(a, b):
    if not isinstance(a, list) or not isinstance(b, list) or len(a) != len(b):
        return False

    def key(x):
        if isinstance(x, dict):
            return norm_text(json.dumps(x, ensure_ascii=False, sort_keys=True))
        return norm_text(x)

    return sorted(key(x) for x in a) == sorted(key(x) for x in b)


def evaluate_question(doc):
    q = doc.get("data") or {}
    typ = str(q.get("type") or "").strip()
    reasons = []
    patch = {}
    answer = get_model_answer(q)

    if not typ:
        reasons.append("نوع السؤال غير محدد")
    if not non_empty(q.get("text")):
        reasons.append("نص السؤال فارغ")

    if typ in ("mcq", "image_mcq", "multi"):
        opts = q.get("options") if isinstance(q.get("options"), list) else []
        opts = [o for o in opts if non_empty(o)]
        if len(opts) < 2:
            reasons.append("خيارات أقل من اثنين")
        if not non_empty(answer):
            reasons.append("لا توجد إجابة نموذجية")
        else:
            if not non_empty(q.get("answer")):
                patch["answer"] = answer
            ans_list = answer if isinstance(answer, list) else [answer]
            missing = [
                a
                for a in ans_list
                if not any(norm_text(o) == norm_text(a) for o in opts)
            ]
            if missing:
                reasons.append("الإجابة غير موجودة ضمن الخيارات")

        # Figure-based MCQs whose options are only letters/numbers and that
        # have no attached image are unusable for the student.
        img = q.get("image") or q.get("imageUrl") or q.get("img") or q.get("figure")
        letter_opts = {"أ", "ب", "ج", "د", "a", "b", "c", "d"}
        if (
            typ in ("mcq", "image_mcq")
            and len(opts) >= 2
            and all(str(o).strip() in letter_opts for o in opts)
            and not non_empty(img)
        ):
            reasons.append("سؤال يعتمد على شكل/رسم بدون صورة")
        text = str(q.get("text") or "")
        fig_ref = re.search(
            r"(?:الشكل|شكل|الخريطة|خريطة|الجدول|جدول|المخطط|مخطط)"
            r"\s*[\u200e\u200f]*[\(\[]?\s*[0-9\u0660-\u0669]+",
            text,
        )
        if fig_ref and not non_empty(img):
            reasons.append("سؤال يعتمد على شكل/خريطة بدون صورة")

    elif typ == "true_false":
        if not non_empty(answer):
            reasons.append("لا توجد إجابة نموذجية")
        else:
            tf = normalize_tf(answer)
            if not tf:
                reasons.append("إجابة صح/خطأ غير صالحة")
            elif q.get("answer") != tf:
                patch["answer"] = tf

    elif typ in ("short_answer", "fill_blank", "essay", "genetics_problem"):
        if not non_empty(answer):
            reasons.append("لا توجد إجابة نموذجية")
        elif not non_empty(q.get("answer")):
            patch["answer"] = answer

    elif typ == "ordering":
        ans = q.get("answer") if isinstance(q.get("answer"), list) else []
        ans = [x for x in ans if non_empty(x)]
        items = q.get("items") if isinstance(q.get("items"), list) else []
        items = [x for x in items if non_empty(x)]
        if len(ans) < 2:
            reasons.append("لا توجد إجابة ترتيب صالحة")
        elif any(not isinstance(x, str) or not x.strip() for x in ans):
            reasons.append("عناصر إجابة الترتيب غير صالحة")
        elif len(items) < 2:
            patch["items"] = ans[:]
        elif any(not isinstance(x, str) or not x.strip() for x in items):
            reasons.append("عناصر الترتيب غير صالحة")
        elif not same_set(items, ans):
            patch["items"] = ans[:]

    elif typ == "matching":
        pairs = q.get("pairs") if isinstance(q.get("pairs"), list) else []
        clean = [
            p
            for p in pairs
            if isinstance(p, dict) and non_empty(p.get("left")) and non_empty(p.get("right"))
        ]
        if len(clean) >= 2:
            if len(clean) != len(pairs):
                patch["pairs"] = clean
        else:
            arr = q.get("answer") if isinstance(q.get("answer"), list) else []
            converted = []
            for a in arr:
                if not isinstance(a, dict):
                    continue
                left = a.get("left", a.get("item"))
                right = a.get("right", a.get("match"))
                if non_empty(left) and non_empty(right):
                    converted.append({"left": left, "right": right})
            if len(converted) >= 2:
                patch["pairs"] = converted
            else:
                reasons.append("أزواج المطابقة غير مكتملة")

    elif typ == "comparison":
        cols = q.get("columns") if isinstance(q.get("columns"), list) else []
        rows = q.get("rows") if isinstance(q.get("rows"), list) else []
        blanks = q.get("blanks") if isinstance(q.get("blanks"), list) else []
        has_table = bool(cols and rows and blanks)
        if has_table and non_empty(answer):
            if isinstance(answer, str):
                if len(blanks) == 1:
                    patch["answer"] = {"0,0": answer}
                else:
                    reasons.append("إجابة المقارنة غير متوافقة مع الجدول")
            elif isinstance(answer, dict):
                if not answer:
                    reasons.append("إجابة المقارنة فارغة")
                elif not all(re.match(r"^\d+,\d+$", str(k)) for k in answer.keys()):
                    if len(blanks) == len(answer):
                        new_ans = {}
                        for k, blank in zip(answer.keys(), blanks):
                            new_ans[f"{blank[0]},{blank[1]}"] = str(answer[k])
                        patch["answer"] = new_ans
                    else:
                        reasons.append("إجابة المقارنة غير متوافقة مع الجدول")
        elif isinstance(answer, dict):
            keys = list(answer.keys())
            if not keys:
                reasons.append("بنية المقارنة غير مكتملة")
            elif all(re.match(r"^\d+,\d+$", str(k)) for k in keys):
                max_r = max(int(str(k).split(",")[0]) for k in keys)
                max_c = max(int(str(k).split(",")[1]) for k in keys)
                r_count, c_count = max_r + 1, max_c + 1
                patch["columns"] = [f"عمود {i+1}" for i in range(c_count)]
                patch["rows"] = [
                    {
                        "criterion": "وجه المقارنة",
                        "values": ["" for _ in range(c_count)],
                    }
                    for _ in range(r_count)
                ]
                patch["blanks"] = [
                    [r, c] for r in range(r_count) for c in range(c_count)
                ]
            else:
                new_ans = {
                    f"0,{i}": str(answer[k]) for i, k in enumerate(keys)
                }
                patch["columns"] = keys
                patch["rows"] = [
                    {"criterion": "وجه المقارنة", "values": ["" for _ in keys]}
                ]
                patch["blanks"] = [[0, i] for i in range(len(keys))]
                patch["answer"] = new_ans
        elif isinstance(answer, str) and answer.strip():
            patch["columns"] = ["الإجابة"]
            patch["rows"] = [{"criterion": "وجه المقارنة", "values": [""]}]
            patch["blanks"] = [[0, 0]]
            patch["answer"] = {"0,0": answer}
        else:
            reasons.append("بنية المقارنة غير مكتملة")

    elif typ == "classification":
        items = q.get("items") if isinstance(q.get("items"), list) else []
        cats = q.get("categories") if isinstance(q.get("categories"), list) else []
        if not items or not cats:
            reasons.append("بنية التصنيف غير مكتملة")
        if not non_empty(answer):
            reasons.append("لا توجد إجابة نموذجية")

    elif typ == "diagram_label":
        labels = q.get("labels") if isinstance(q.get("labels"), list) else []
        labels = [
            l
            for l in labels
            if isinstance(l, dict) and non_empty(l.get("answer"))
        ]
        if not labels:
            reasons.append("مواضع الرسم غير مكتملة")
        elif not non_empty(q.get("answer")):
            patch["answer"] = {str(l.get("number")): l.get("answer") for l in labels}

    else:
        if not non_empty(answer):
            reasons.append("لا توجد إجابة نموذجية")
        elif not non_empty(q.get("answer")):
            patch["answer"] = answer

    reasons = list(dict.fromkeys(reasons))
    return {
        "valid": not reasons,
        "reasons": reasons,
        "patch": patch,
        "type": typ,
        "answer": answer,
    }


def score_question(entry, canonical_id):
    q = entry["doc"].get("data") or {}
    score = 0
    if non_empty(q.get("explanation")):
        score += 50
    if non_empty(q.get("difficulty")):
        score += 20
    if isinstance(q.get("tags"), list) and q["tags"]:
        score += 15
    try:
        if float(q.get("points") or 0) > 0:
            score += 10
    except Exception:
        pass
    if non_empty(q.get("book")):
        score += 5
    if non_empty(q.get("id")):
        score += 5
    if entry["doc"].get("subjectId") == canonical_id:
        score += 30
    if not entry.get("patch"):
        score += 10
    if entry.get("type") in ("mcq", "true_false", "image_mcq", "multi"):
        score += 5
    return score


def scan():
    print("Reading subjects...", flush=True)
    subjects = list_subjects()
    history = [
        s
        for s in subjects
        if HISTORY_RE.search(str(s["data"].get("name") or ""))
        or HISTORY_RE.search(str(s["data"].get("description") or ""))
    ]
    print(f"Subjects: {len(subjects)}; History subjects: {len(history)}", flush=True)
    for s in history:
        print(f"  - {s['data'].get('name')} | {s['id']}", flush=True)

    if not history:
        raise RuntimeError("No History subject found")

    all_docs = []
    for s in history:
        print(f"Fetching questions for {s['id']} ...", flush=True)
        docs = fetch_subject_questions(s["id"])
        s["count"] = len(docs)
        for d in docs:
            d["subjectId"] = s["id"]
            d["subjectName"] = s["data"].get("name")
        all_docs.extend(docs)

    canonical = next((s for s in history if s["id"] == PREFERRED_ID), None)
    if canonical is None:
        canonical = max(history, key=lambda s: s.get("count", 0))
    canonical_name = "التاريخ"
    print(
        f"Canonical: {canonical['data'].get('name')} ({canonical['id']}) "
        f"with {canonical.get('count', 0)} questions",
        flush=True,
    )

    invalid = []
    valid = []
    for doc in all_docs:
        ev = evaluate_question(doc)
        if ev["valid"]:
            valid.append({"doc": doc, "ev": ev, "patch": ev["patch"], "type": ev["type"]})
        else:
            invalid.append({"doc": doc, "ev": ev})

    groups = {}
    for e in valid:
        key = norm_text((e["doc"].get("data") or {}).get("text")) or ("id:" + e["doc"]["id"])
        groups.setdefault(key, []).append(e)

    keep = []
    duplicates = []
    for arr in groups.values():
        for e in arr:
            e["score"] = score_question(e, canonical["id"])
        arr.sort(key=lambda e: (-e["score"], e["doc"]["id"]))
        keep.append(arr[0])
        duplicates.extend(arr[1:])

    deletes = []
    updates = []
    for x in invalid:
        deletes.append({"t": "d", "id": x["doc"]["id"]})
    for x in duplicates:
        deletes.append({"t": "d", "id": x["doc"]["id"]})
    for e in keep:
        patch = dict(e["ev"]["patch"])
        if e["doc"].get("subjectId") != canonical["id"]:
            patch["subjectId"] = canonical["id"]
            patch["subjectName"] = canonical_name
        elif (e["doc"].get("data") or {}).get("subjectName") != canonical_name:
            patch["subjectName"] = canonical_name
        if patch:
            updates.append({"t": "u", "id": e["doc"]["id"], "patch": patch})

    updates.append(
        {
            "t": "s",
            "id": canonical["id"],
            "patch": {
                "name": canonical_name,
                "description": (canonical["data"].get("description") or "بنك أسئلة التاريخ الموحد — الصف الثالث الثانوي الأدبي"),
            },
        }
    )
    delete_subjects = [
        {"t": "ds", "id": s["id"]} for s in history if s["id"] != canonical["id"]
    ]
    ops = updates + deletes + delete_subjects

    reason_counts = {}
    for x in invalid:
        for r in x["ev"]["reasons"]:
            reason_counts[r] = reason_counts.get(r, 0) + 1

    report = {
        "historySubjects": [
            {"id": s["id"], "name": s["data"].get("name"), "count": s.get("count", 0)}
            for s in history
        ],
        "canonical": {
            "id": canonical["id"],
            "name": canonical["data"].get("name"),
            "count": canonical.get("count", 0),
        },
        "totalHistoryQuestions": len(all_docs),
        "validUnique": len(keep),
        "duplicatesRemoved": len(duplicates),
        "invalidRemoved": len(invalid),
        "repaired": sum(1 for e in keep if e["ev"]["patch"]),
        "ops": {
            "updates": len(updates),
            "deletes": len(deletes),
            "deleteSubjects": len(delete_subjects),
            "total": len(ops),
        },
        "invalidReasons": reason_counts,
        "sampleDuplicates": [
            {
                "id": e["doc"]["id"],
                "text": str((e["doc"].get("data") or {}).get("text") or "")[:180],
            }
            for e in duplicates[:10]
        ],
        "sampleInvalid": [
            {
                "id": x["doc"]["id"],
                "text": str((x["doc"].get("data") or {}).get("text") or "")[:180],
                "reasons": x["ev"]["reasons"],
            }
            for x in invalid[:10]
        ],
        "totalChunks": (len(ops) + BATCH - 1) // BATCH,
    }

    with open(PLAN_PATH, "w", encoding="utf-8") as f:
        json.dump({"ops": ops, "report": report}, f, ensure_ascii=False, indent=1)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("\n===== REPORT =====", flush=True)
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
    print(f"\nPlan saved to {PLAN_PATH}", flush=True)
    print(f"Report saved to {REPORT_PATH}", flush=True)
    return report


def backup_history(path="/tmp/history_backup.json"):
    """Read-only snapshot of all History subjects and their questions."""
    subjects = list_subjects()
    history = [
        s
        for s in subjects
        if HISTORY_RE.search(str(s["data"].get("name") or ""))
        or HISTORY_RE.search(str(s["data"].get("description") or ""))
    ]
    out = {"subjects": history, "questions": []}
    for s in history:
        print(f"Backing up {s['id']} ...", flush=True)
        docs = fetch_subject_questions(s["id"])
        for d in docs:
            d["subjectId"] = s["id"]
            d["subjectName"] = s["data"].get("name")
        out["questions"].extend(docs)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"Backup saved to {path} ({len(out['questions'])} questions)", flush=True)
    return path


def apply_plan():
    with open(PLAN_PATH, "r", encoding="utf-8") as f:
        plan = json.load(f)
    ops = plan["ops"]
    report = plan.get("report") or {}
    chunks = (len(ops) + BATCH - 1) // BATCH
    print(f"Applying {len(ops)} operations in {chunks} chunks...", flush=True)
    applied = 0
    for c in range(chunks):
        part = ops[c * BATCH : (c + 1) * BATCH]
        writes = []
        for op in part:
            if op["t"] == "d":
                writes.append(
                    {
                        "delete": f"projects/{PROJECT}/databases/(default)/documents/questions/{op['id']}"
                    }
                )
            elif op["t"] == "u":
                patch = op.get("patch") or {}
                writes.append(
                    {
                        "update": {
                            "name": f"projects/{PROJECT}/databases/(default)/documents/questions/{op['id']}",
                            "fields": {k: encode_value(v) for k, v in patch.items()},
                        },
                        "updateMask": {"fieldPaths": list(patch.keys())},
                    }
                )
            elif op["t"] == "s":
                patch = op.get("patch") or {}
                writes.append(
                    {
                        "update": {
                            "name": f"projects/{PROJECT}/databases/(default)/documents/subjects/{op['id']}",
                            "fields": {k: encode_value(v) for k, v in patch.items()},
                        },
                        "updateMask": {"fieldPaths": list(patch.keys())},
                    }
                )
            elif op["t"] == "ds":
                writes.append(
                    {
                        "delete": f"projects/{PROJECT}/databases/(default)/documents/subjects/{op['id']}"
                    }
                )
        st, data = http("POST", f"{BASE}:commit?key={KEY}", {"writes": writes})
        print(f"Chunk {c+1}/{chunks}: HTTP {st}", flush=True)
        if st != 200:
            print(json.dumps(data, ensure_ascii=False, indent=2), flush=True)
            raise RuntimeError(f"Commit failed at chunk {c+1}")
        applied += len(part)
    print(f"Applied {applied} operations successfully.", flush=True)
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
    return applied


def count_questions(subject_id):
    body = {
        "structuredAggregationQuery": {
            "structuredQuery": {
                "from": [{"collectionId": "questions"}],
                "where": {
                    "fieldFilter": {
                        "field": {"fieldPath": "subjectId"},
                        "op": "EQUAL",
                        "value": {"stringValue": subject_id},
                    }
                },
            },
            "aggregations": [{"alias": "count", "count": {}}],
        }
    }
    st, data = http("POST", f"{BASE}:runAggregationQuery?key={KEY}", body)
    if st != 200:
        return None
    try:
        if isinstance(data, list):
            item = data[0]
        else:
            item = data
        fields = item.get("result", {}).get("aggregateFields", {})
        return int(fields.get("count", {}).get("integerValue", 0))
    except Exception:
        return None


def verify():
    subjects = list_subjects()
    history = [
        s
        for s in subjects
        if HISTORY_RE.search(str(s["data"].get("name") or ""))
        or HISTORY_RE.search(str(s["data"].get("description") or ""))
    ]
    print(f"History subjects remaining: {len(history)}", flush=True)
    for s in history:
        c = count_questions(s["id"])
        print(f"  - {s['data'].get('name')} | {s['id']} | count={c}", flush=True)
    return history


def main():
    args = set(sys.argv[1:])
    if "--apply" in args:
        apply_plan()
        verify()
    elif "--verify" in args:
        verify()
    elif "--backup" in args:
        backup_history()
    else:
        scan()


if __name__ == "__main__":
    main()
