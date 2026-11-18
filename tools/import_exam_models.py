#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Import a JSON file of Arabic (or any subject) exam models into Firestore.

The importer understands the shared "exam models batch" format:

    {
      "meta": { ... },
      "models": [
        {
          "model_no": 1,
          "title": "...",
          "duration": "...",
          "total_marks": 40,
          "main_passage": {...},
          "section1_language_thought_emotion": {"marks":8,"questions":[...]},
          "section2_art_structure_grammar": {"marks":12,"questions":[...]},
          "section3_reading_and_study": {"marks":4,"passage_ref":"...","questions":[...]},
          "section4_expression": {"marks":16,"compulsory":{...},"optional":{...}}
        }
      ]
    }

Each model becomes one document in the `exams` collection, ready to be
reviewed/published from the admin importer page.

Usage:
  python3 tools/import_exam_models.py --file /path/to/batch.json --dry-run
  python3 tools/import_exam_models.py --file /path/to/batch.json
  python3 tools/import_exam_models.py --file /path/to/batch.json --status published
  python3 tools/import_exam_models.py --verify
"""

import argparse
import datetime as dt
import json
import os
import random
import re
import string
import sys
import urllib.parse

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from tools.cleanup_history_firestore import (  # noqa: E402
    BASE,
    KEY,
    encode_value,
    http,
    list_subjects,
    parse_value,
)

FAMILY = "arabic-exam-models"
DEFAULT_SUBJECT = "اللغة العربية"
SECTION_MAP = [
    ("section1_language_thought_emotion", "فهم وتحليل"),
    ("section2_art_structure_grammar", "قواعد ولغة"),
    ("section3_reading_and_study", "منهج ومطالعة"),
]

SECTION4 = "section4_expression"
EXPRESSION_SECTION = "إبداعي"


def now_ts():
    return {"__ts__": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")}


def enc(value):
    """Encode a value, recognizing our internal timestamp marker."""
    if isinstance(value, dict) and set(value.keys()) == {"__ts__"}:
        return {"timestampValue": value["__ts__"]}
    return encode_value(value)


def list_docs(collection, page_size=300):
    """List all documents in a collection using pageToken pagination."""
    out = []
    token = None
    while True:
        url = f"{BASE}/{collection}?key={KEY}&pageSize={page_size}"
        if token:
            url += f"&pageToken={urllib.parse.quote(token)}"
        st, data = http("GET", url)
        if st != 200:
            raise RuntimeError(f"GET {collection} failed: {st} {data}")
        out.extend(data.get("documents", []) or [])
        token = data.get("nextPageToken")
        if not token:
            break
    return [
        {
            "id": d["name"].rsplit("/", 1)[-1],
            "name": d["name"],
            "data": {k: parse_value(v) for k, v in (d.get("fields") or {}).items()},
        }
        for d in out
    ]


def get_doc(path):
    st, data = http("GET", f"{BASE}/{path}?key={KEY}")
    if st == 404:
        return None
    if st != 200:
        raise RuntimeError(f"GET {path} failed: {st} {data}")
    return {k: parse_value(v) for k, v in (data.get("fields") or {}).items()}


def create_doc_with_id(collection, doc_id, data):
    """Create a document with an explicit ID (Firestore createDocument)."""
    fields = {key: enc(value) for key, value in data.items()}
    url = f"{BASE}/{collection}?key={KEY}&documentId={urllib.parse.quote(doc_id)}"
    st, resp = http("POST", url, {"fields": fields})
    if st not in (200, 201):
        raise RuntimeError(f"POST {collection}/{doc_id} failed: {st} {resp}")
    return resp


def patch_doc(path, data):
    """Update selected fields of an existing document."""
    fields = {key: enc(value) for key, value in data.items()}
    url = f"{BASE}/{path}?key={KEY}"
    for key in data.keys():
        url += f"&updateMask.fieldPaths={urllib.parse.quote(key)}"
    st, resp = http("PATCH", url, {"fields": fields})
    if st != 200:
        raise RuntimeError(f"PATCH {path} failed: {st} {resp}")
    return resp


def create_doc(collection, data):
    fields = {key: enc(value) for key, value in data.items()}
    st, resp = http("POST", f"{BASE}/{collection}?key={KEY}", {"fields": fields})
    if st not in (200, 201):
        raise RuntimeError(f"POST {collection} failed: {st} {resp}")
    return resp


def random_code(length=6):
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(length))


def batch_key_from_path(path, meta):
    explicit = str((meta or {}).get("batchKey") or "").strip()
    if explicit:
        return re.sub(r"[^A-Za-z0-9_-]+", "-", explicit).strip("-").lower()
    stem = os.path.splitext(os.path.basename(path))[0]
    return re.sub(r"[^A-Za-z0-9_-]+", "-", stem).strip("-").lower() or "exam-models"


def duration_to_minutes(value, default=150):
    text = str(value or "")
    if "نصف" in text and ("ساعت" in text or "ساعتين" in text):
        return 150
    if "ساعتين" in text or "ساعتان" in text:
        return 120
    m = re.search(r"(\d+)\s*ساعة", text)
    if m:
        return int(m.group(1)) * 60
    m = re.search(r"(\d+)\s*دقيقة", text)
    if m:
        return int(m.group(1))
    return default


def build_passage(model, section):
    mp = model.get("main_passage") or {}
    poem = str(mp.get("poem") or "")
    poet = str(mp.get("poet") or "")
    text = str(mp.get("instruction") or "").strip()
    notes = []
    if poem:
        notes.append(f"القصيدة: {poem}")
    if poet:
        notes.append(f"الشاعر: {poet}")
    if mp.get("unit") not in (None, ""):
        notes.append(f"الوحدة {mp['unit']}")
    if mp.get("book_pages"):
        notes.append(f"ص{mp['book_pages']}")
    if mp.get("verses"):
        notes.append(f"الأبيات {mp['verses']}")
    ref = str((section or {}).get("passage_ref") or "").strip()
    if ref:
        text = (text + "\n\nنص القراءة والمطالعة: " + ref).strip()
    return {
        "title": f"النص المرافق — {poem}" if poem else "النص المرافق",
        "text": text,
        "notes": " | ".join(notes),
    }


def question_to_app(q, section_label, passage, model_no, key, points_default=1):
    text = str(q.get("question") or "").strip()
    answer = str(q.get("answer") or "").strip()
    parts = q.get("parts") or []
    if parts:
        item_lines, answer_lines = [], []
        if answer:
            answer_lines.append(answer)
        for p in parts:
            item = str(p.get("item") or "").strip()
            ans = str(p.get("answer") or "").strip()
            if item:
                item_lines.append("• " + item)
                answer_lines.append(f"{item}: {ans}")
        if item_lines:
            text += "\n" + "\n".join(item_lines)
        answer = "\n".join(answer_lines)
    no = q.get("no")
    qid = f"arabic-m{model_no}-{key}-{no if no is not None else random_code(4)}"
    points = q.get("marks", points_default)
    try:
        points = int(points)
    except Exception:
        points = points_default
    return {
        "id": qid,
        "type": "essay",
        "text": text,
        "answer": answer,
        "points": points,
        "section": section_label,
        "passage": passage,
        "explanation": "",
        "tags": ["نموذج امتحاني", DEFAULT_SUBJECT],
        "modelNo": model_no,
        "originalNo": no,
    }


def choose_optional(options, strategy, model_no):
    if not options:
        return None, 0
    n = len(options)
    if strategy == "first":
        idx = 0
    elif strategy == "second":
        idx = 1 if n > 1 else 0
    elif strategy == "even":
        idx = 0 if model_no % 2 == 0 else (1 if n > 1 else 0)
    else:  # odd (default)
        idx = 1 if (model_no % 2 == 1 and n > 1) else 0
    idx = min(max(idx, 0), n - 1)
    return options[idx], idx


def model_to_exam(model, meta, source_file, batch, status, optional_strategy, subject):
    model_no = int(model.get("model_no") or 0)
    questions = []
    for key, label in SECTION_MAP:
        section = model.get(key) or {}
        passage = build_passage(model, section)
        for q in section.get("questions", []) or []:
            questions.append(question_to_app(q, label, passage, model_no, key))

    sec4 = model.get(SECTION4) or {}
    passage4 = build_passage(model, sec4)
    compulsory = sec4.get("compulsory") or {}
    points_list = compulsory.get("expected_points") or []
    comp_answer = "نقاط الإجابة المتوقعة:\n" + "\n".join("- " + str(p) for p in points_list)
    questions.append(
        {
            "id": f"arabic-m{model_no}-expression-compulsory",
            "type": "essay",
            "text": str(compulsory.get("question") or "").strip(),
            "answer": comp_answer,
            "points": int(compulsory.get("marks") or 10),
            "section": EXPRESSION_SECTION,
            "passage": passage4,
            "explanation": "",
            "tags": ["نموذج امتحاني", "التعبير"],
            "modelNo": model_no,
            "originalNo": "compulsory",
        }
    )

    optional = sec4.get("optional") or {}
    options = optional.get("options") or []
    chosen, chosen_idx = choose_optional(options, optional_strategy, model_no)
    if chosen:
        questions.append(
            {
                "id": f"arabic-m{model_no}-expression-option-{chosen_idx + 1}",
                "type": "essay",
                "text": str(chosen.get("question") or "").strip(),
                "answer": str(chosen.get("expected_answer") or "").strip(),
                "points": int(chosen.get("marks") or optional.get("marks") or 6),
                "section": EXPRESSION_SECTION,
                "passage": passage4,
                "explanation": "",
                "tags": ["نموذج امتحاني", "التعبير"],
                "modelNo": model_no,
                "originalNo": f"option-{chosen_idx + 1}",
            }
        )

    total = sum(int(q.get("points") or 0) for q in questions)
    title = str(model.get("title") or f"نموذج {model_no}")
    note = (
        "السؤال الاختياري في قسم التعبير: "
        + (f"تم اختيار الخيار رقم {chosen_idx + 1} تلقائياً." if chosen else "لا يوجد خيار اختياري.")
        + " الخيارات كلها محفوظة في إعدادات النموذج."
    )
    description = (
        str((meta or {}).get("description") or "نموذج امتحاني مستورد")
        + "\n"
        + str((meta or {}).get("note") or "")
        + "\n"
        + note
    ).strip()

    settings = {
        "batchKey": batch,
        "sourceFile": os.path.basename(source_file),
        "sourceMeta": meta or {},
        "sourceModel": model,
        "expressionOptions": options,
        "optionalStrategy": optional_strategy,
        "chosenOptionIndex": chosen_idx,
        "gradeMode": "manual",
    }

    return {
        "title": title,
        "subjectId": subject["id"],
        "subjectName": subject["name"],
        "description": description[:1400],
        "durationMin": duration_to_minutes(model.get("duration")),
        "settings": settings,
        "questions": questions,
        "totalPoints": total,
        "status": status,
        "targetGroups": ["ALL"],
        "autoGenerated": False,
        "modelFamily": FAMILY,
        "isApproved": status == "published",
        "templateKey": f"{batch}-model-{model_no}",
        "templateName": title,
        "filterCriteria": {
            "source": "json-exam-models-importer",
            "batchKey": batch,
            "modelNo": model_no,
            "mainPassage": model.get("main_passage") or {},
        },
        "versionNo": 1,
        "versionStatus": status,
    }


def ensure_subject(name):
    subjects = list_subjects()
    for s in subjects:
        if str(s["data"].get("name") or "").strip() == name.strip():
            return s["data"], s["id"]
    print(f"Creating subject: {name}")
    ref = create_doc(
        "subjects",
        {
            "name": name,
            "description": "نماذج امتحانية مستوردة — اللغة العربية",
            "createdAt": now_ts(),
        },
    )
    sid = ref["name"].rsplit("/", 1)[-1]
    return {"name": name, "description": "نماذج امتحانية مستوردة — اللغة العربية"}, sid


def existing_by_template(exams):
    out = {}
    for e in exams:
        key = str(e["data"].get("templateKey") or "")
        if key:
            out[key] = e
    return out


def existing_codes():
    return {d["name"].rsplit("/", 1)[-1] for d in list_docs("examCodes")}


def main():
    ap = argparse.ArgumentParser(description="Import exam model JSON batches into Firestore")
    ap.add_argument("--file", help="Path to a JSON batch file")
    ap.add_argument("--dry-run", action="store_true", help="Validate and preview without writing")
    ap.add_argument("--status", choices=["draft", "published"], default="draft")
    ap.add_argument("--optional", choices=["odd", "even", "first", "second"], default="odd")
    ap.add_argument("--subject-name", default=DEFAULT_SUBJECT)
    ap.add_argument("--replace", action="store_true", help="Update existing exams with the same templateKey")
    ap.add_argument("--verify", action="store_true", help="Show imported exam counts")
    args = ap.parse_args()

    if args.verify:
        exams = [e for e in list_docs("exams") if e["data"].get("modelFamily") == FAMILY]
        by_batch = {}
        for e in exams:
            key = str((e["data"].get("settings") or {}).get("batchKey") or "?")
            by_batch.setdefault(key, []).append(e)
        print(f"Total exams in family {FAMILY}: {len(exams)}")
        for batch, items in sorted(by_batch.items()):
            print(f"  {batch}: {len(items)} models, "
                  f"published={sum(1 for x in items if x['data'].get('status') == 'published')}")
        return

    if not args.file:
        ap.error("--file is required (or use --verify)")

    with open(args.file, encoding="utf-8") as f:
        payload = json.load(f)
    if not isinstance(payload, dict):
        raise SystemExit("Top level must be an object with meta and models")
    meta = payload.get("meta") or {}
    models = payload.get("models") or []
    if not isinstance(models, list) or not models:
        raise SystemExit("No models found in JSON")
    expected = meta.get("total_models")
    if expected and int(expected) != len(models):
        print(f"WARNING: meta.total_models={expected} but found {len(models)} models")

    batch = batch_key_from_path(args.file, meta)
    print(f"File: {os.path.basename(args.file)}")
    print(f"Batch key: {batch}")
    print(f"Models: {len(models)} | status: {args.status} | optional: {args.optional}")

    # Validate and build all payloads first.
    built = []
    for m in models:
        if not isinstance(m, dict) or not m.get("model_no"):
            raise SystemExit(f"Invalid model entry: {str(m)[:120]}")
        built.append(model_to_exam(m, meta, args.file, batch, args.status, args.optional, {"id": "", "name": args.subject_name}))

    total_points = {int(m.get("model_no")): p["totalPoints"] for m, p in zip(models, built)}
    bad = [no for no, pts in total_points.items() if pts != int(meta.get("marks_per_model") or 40)]
    if bad:
        print(f"WARNING: models with marks != meta.marks_per_model: {bad}")

    if args.dry_run:
        first = built[0]
        print("\nDRY RUN — sample converted exam:")
        print(json.dumps({
            "title": first["title"],
            "templateKey": first["templateKey"],
            "durationMin": first["durationMin"],
            "totalPoints": first["totalPoints"],
            "questionCount": len(first["questions"]),
            "firstQuestion": first["questions"][0],
            "lastQuestion": first["questions"][-1],
        }, ensure_ascii=False, indent=2)[:4000])
        print("\nDRY RUN — no writes performed")
        return

    subject_data, subject_id = ensure_subject(args.subject_name)
    print(f"Subject: {subject_data['name']} ({subject_id})")

    exams = list_docs("exams")
    by_template = existing_by_template(exams)
    codes = existing_codes()
    submissions = {str(s["data"].get("examId")) for s in list_docs("submissions") if s["data"].get("examId")}

    created, updated, skipped = [], [], []
    for m, payload in zip(models, built):
        payload["subjectId"] = subject_id
        payload["subjectName"] = subject_data["name"]
        key = payload["templateKey"]
        existing = by_template.get(key)
        if existing:
            exam_id = existing["id"]
            if exam_id in submissions:
                skipped.append((key, "students already submitted"))
                continue
            if not args.replace:
                skipped.append((key, "exists (use --replace)"))
                continue
            code = str(existing["data"].get("code") or "")
            if not code or code not in codes:
                if not code:
                    code = random_code()
                    while code in codes:
                        code = random_code()
                codes.add(code)
                create_doc_with_id("examCodes", code, {"code": code, "examId": exam_id, "createdAt": now_ts()})
            fields = dict(payload)
            fields["code"] = code
            fields["codeRotatedAt"] = now_ts()
            fields["createdAt"] = existing["data"].get("createdAt") or now_ts()
            patch_doc(f"exams/{exam_id}", fields)
            updated.append((key, code, exam_id))
            continue

        code = random_code()
        while code in codes:
            code = random_code()
        codes.add(code)
        doc = create_doc(
            "exams",
            dict(payload, code=code, codeRotateEnabled=False, codeRotateMinutes=0,
                 codeRotatedAt=now_ts(), createdBy="importer", createdAt=now_ts()),
        )
        exam_id = doc["name"].rsplit("/", 1)[-1]
        create_doc_with_id("examCodes", code, {"code": code, "examId": exam_id, "createdAt": now_ts()})
        created.append((key, code, exam_id))

    print(f"\nCreated: {len(created)} | Updated: {len(updated)} | Skipped: {len(skipped)}")
    for key, code, exam_id in (created + updated):
        print(f"  {key} -> {code} ({exam_id})")
    for key, reason in skipped:
        print(f"  SKIP {key}: {reason}")
    print("\nDone. Review/publish from the admin importer page or set --status published.")


if __name__ == "__main__":
    main()
