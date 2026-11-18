#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Inject curated poem excerpts into the imported Arabic exam models.

Reads data/arabic_poems.json (keyed by model number) and patches each exam's
`questions[].passage` with the exact verses referenced by that model, plus a
page/verse source note. Exams with student submissions are never modified.

Usage:
  python3 tools/inject_arabic_poems.py --dry-run
  python3 tools/inject_arabic_poems.py --apply
  python3 tools/inject_arabic_poems.py --verify
"""

import argparse
import json
import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from tools.import_exam_models import FAMILY, get_doc, list_docs, patch_doc  # noqa: E402

POEMS_PATH = os.path.join(PROJECT_ROOT, "data", "arabic_poems.json")
BATCH = "arabic_exam_models_batch1"


def load_poems():
    with open(POEMS_PATH, encoding="utf-8") as f:
        return json.load(f)


def exam_model_no(exam):
    data = exam["data"]
    no = data.get("modelNo")
    if no is not None:
        try:
            return int(no)
        except Exception:
            pass
    key = str(data.get("templateKey") or "")
    if key.startswith(f"{BATCH}-model-"):
        try:
            return int(key.rsplit("-", 1)[-1])
        except Exception:
            pass
    return None


def inject_passage(question, poem):
    passage = dict(question.get("passage") or {})
    original = str(passage.get("text") or "").strip()
    excerpt = poem["text"].strip()
    if excerpt not in original:
        passage["text"] = (original + "\n\n" + excerpt).strip() if original else excerpt
    notes = str(passage.get("notes") or "").strip()
    src = (
        f"النص من الكتاب المدرسي: ص{poem['pages']} — الأبيات {poem['verses']}"
    )
    if src not in notes:
        passage["notes"] = (notes + " | " + src).strip(" |") if notes else src
    if not passage.get("title"):
        passage["title"] = f"النص المرافق — {poem['poem']}"
    new_q = dict(question)
    new_q["passage"] = passage
    return new_q


def main():
    ap = argparse.ArgumentParser(description="Inject poem excerpts into Arabic exams")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--dry-run", action="store_true")
    g.add_argument("--apply", action="store_true")
    g.add_argument("--verify", action="store_true")
    args = ap.parse_args()

    poems = load_poems()
    exams = [e for e in list_docs("exams") if e["data"].get("modelFamily") == FAMILY]
    submissions = {
        str(s["data"].get("examId"))
        for s in list_docs("submissions")
        if s["data"].get("examId")
    }
    print(f"Arabic exams in Firestore: {len(exams)} | exams with submissions: {len(submissions)}")

    if args.verify:
        ok = 0
        for e in exams:
            no = exam_model_no(e)
            poem = poems.get(str(no)) if no else None
            with_text = sum(
                1 for q in e["data"].get("questions", [])
                if poem and poem["text"].strip() in str((q.get("passage") or {}).get("text") or "")
            )
            total = len(e["data"].get("questions", []))
            status = e["data"].get("status")
            print(f"  model {no:>2}: {with_text}/{total} questions with excerpt | {status}")
            if with_text == total and total:
                ok += 1
        print(f"Verified {ok}/{len(exams)} exams fully injected")
        return

    applied, skipped = 0, []
    for e in exams:
        no = exam_model_no(e)
        poem = poems.get(str(no)) if no else None
        if not poem:
            skipped.append((e["id"], "no poem entry"))
            continue
        if e["id"] in submissions:
            skipped.append((e["id"], "students already submitted"))
            continue
        questions = e["data"].get("questions", []) or []
        new_questions = [inject_passage(q, poem) for q in questions]
        if args.dry_run:
            sample = new_questions[0]["passage"]
            print(f"DRY model {no}: {poem['poem']} | {len(new_questions)} questions")
            print("  text tail:", repr(sample["text"][-180:]))
            print("  notes:", sample["notes"])
            continue
        patch_doc(f"exams/{e['id']}", {"questions": new_questions})
        applied += 1
        print(f"PATCHED model {no} ({e['id']}): {len(new_questions)} questions")

    if args.dry_run:
        print("\nDRY RUN — no writes performed")
    else:
        print(f"\nInjected {applied} exams")
    for eid, reason in skipped:
        print(f"  SKIP {eid}: {reason}")


if __name__ == "__main__":
    main()
