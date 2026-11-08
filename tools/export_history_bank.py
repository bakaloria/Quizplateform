#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Export the cleaned History questions from Firestore into data/history.json
so that re-running import-history.html does not bring back duplicates or
questions without a model answer.

Usage:
  python3 tools/export_history_bank.py
"""

import json
import os
import sys

# Allow running as a script from the project root.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.cleanup_history_firestore import (  # noqa: E402
    HISTORY_RE,
    fetch_subject_questions,
    list_subjects,
)

OUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data",
    "history.json",
)


def as_int(value, default=0):
    try:
        return int(value)
    except Exception:
        return default


def main():
    subjects = list_subjects()
    history = [
        s
        for s in subjects
        if HISTORY_RE.search(str(s["data"].get("name") or ""))
        or HISTORY_RE.search(str(s["data"].get("description") or ""))
    ]
    if len(history) != 1:
        raise SystemExit(
            "Expected exactly one History subject, found %d: %s"
            % (len(history), [(s["id"], s["data"].get("name")) for s in history])
        )
    subject = history[0]
    print("Exporting from %s (%s) ..." % (subject["data"].get("name"), subject["id"]))
    docs = fetch_subject_questions(subject["id"])
    print("Fetched %d questions" % len(docs))

    units = {}
    for doc in docs:
        q = dict(doc.get("data") or {})
        unit_no = as_int(q.get("unit_number", q.get("unitNumber")), 0)
        lesson_no = as_int(q.get("lesson_number", q.get("lessonNumber")), 0)
        unit_title = str(q.get("unitTitle") or q.get("unit_title") or "").strip()
        lesson_title = str(q.get("lessonTitle") or q.get("lesson_title") or "").strip()

        q.pop("subjectId", None)
        q.pop("subjectName", None)
        q["unit_number"] = unit_no
        q["lesson_number"] = lesson_no
        q["unitNumber"] = unit_no
        q["lessonNumber"] = lesson_no
        if unit_title:
            q["unitTitle"] = unit_title
        if lesson_title:
            q["lessonTitle"] = lesson_title
        q.setdefault("points", 1)
        q.setdefault("difficulty", "medium")
        q.setdefault("tags", [])

        u = units.setdefault(
            unit_no,
            {
                "unit_number": unit_no,
                "unit_title": unit_title,
                "lessons": {},
                "_titles": set(),
            },
        )
        if unit_title:
            u["_titles"].add(unit_title)
        l = u["lessons"].setdefault(
            lesson_no,
            {
                "lesson_number": lesson_no,
                "lesson_title": lesson_title,
                "questions": [],
                "_titles": set(),
            },
        )
        if lesson_title:
            l["_titles"].add(lesson_title)
        l["questions"].append(q)

    out_units = []
    for unit_no in sorted(units):
        u = units[unit_no]
        if u["_titles"]:
            u["unit_title"] = sorted(u["_titles"], key=len, reverse=True)[0]
        u.pop("_titles", None)
        lessons = []
        for lesson_no in sorted(u["lessons"]):
            l = u["lessons"][lesson_no]
            if l["_titles"]:
                l["lesson_title"] = sorted(l["_titles"], key=len, reverse=True)[0]
            l.pop("_titles", None)
            l["questions"].sort(
                key=lambda q: (
                    str(q.get("id") or ""),
                    str(q.get("text") or ""),
                )
            )
            lessons.append(l)
        u["lessons"] = lessons
        out_units.append(u)

    payload = {"subject": "التاريخ", "units": out_units}
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    total = sum(
        len(l["questions"]) for u in out_units for l in u["lessons"]
    )
    print("Wrote %s units, %s questions to %s" % (len(out_units), total, OUT_PATH))


if __name__ == "__main__":
    main()
