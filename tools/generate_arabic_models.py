#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate additional Arabic exam models in the shared importer JSON format.

Strategy (recommended for quality at scale):
  * reuse the answer-bearing questions from the original 20 models as a seed bank
  * add word-level grammar/rhetoric questions derived from each curated excerpt
  * add a same-poem bayt comparison question in every model
  * keep the original four-section / 40-mark / 20-question structure

Output default: data/arabic_exam_models_batch2.json
"""

import argparse
import json
import os
import random
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED_PATH = os.path.join(ROOT, "data", "arabic_exam_models_batch1.json")
POEMS_PATH = os.path.join(ROOT, "data", "arabic_poems.json")
OUT_PATH = os.path.join(ROOT, "data", "arabic_exam_models_batch2.json")

SEC_KEYS = [
    "section1_language_thought_emotion",
    "section2_art_structure_grammar",
    "section3_reading_and_study",
]
SEC_TITLES = {
    SEC_KEYS[0]: "الفهم والتحليل والتذوق",
    SEC_KEYS[1]: "الفنون الأدبية والقواعد والبلاغة",
    SEC_KEYS[2]: "القراءة والمطالعة والتطبيق",
}

ALIASES = {
    "الأمير الدمشقي": "الأميري الدمشقي",
}

CASE_BY_MARK = {
    "ُ": ("مرفوع", "الضمة"),
    "ً": ("منصوب", "الفتحة"),
    "ِ": ("مجرور", "الكسرة"),
    "ْ": ("مجزوم", "السكون"),
}


def clean_word(w):
    return re.sub(r"[ًٌٍَُِّْـ«»،؛؟.!؟:()\[\]\*]+$", "", w.strip(" ***،؛؟.!" ))


def lines_of(text):
    return [ln.strip() for ln in text.splitlines() if ln.strip()]


def words_of(text):
    out = []
    for ln in lines_of(text):
        for w in re.split(r"\s+", ln):
            w = w.strip()
            if w in ("***", "") or w.startswith("***"):
                continue
            c = clean_word(w)
            if len(c) >= 3:
                out.append(c)
    return list(dict.fromkeys(out))


def case_of(word):
    for ch in reversed(word):
        if ch in CASE_BY_MARK:
            return CASE_BY_MARK[ch]
    return None


def word_questions(text):
    """Generate form-based grammar/rhetoric questions from an excerpt."""
    qs = []
    for w in words_of(text):
        case = case_of(w)
        if case:
            state, sign = case
            qs.append({
                "question": f"ما علامة إعراب كلمة ({w}) في قول الشاعر؟",
                "answer": f"علامة إعرابها {sign}؛ فهي {state}.",
            })
            qs.append({
                "question": f"أعرب كلمة ({w}) إعراباً مختصراً في جملتها.",
                "answer": f"كلمة ({w}) {state} وعلامة إعرابها {sign} الظاهرة على آخرها.",
            })
        if w.endswith("ون"):
            qs.append({
                "question": f"ما نوع الجمع في كلمة ({w})؟",
                "answer": "جمع مذكر سالم، مرفوع بثبوت الواو لأنه ملحق بجمع المذكر السالم.",
            })
        elif w.endswith("ين"):
            qs.append({
                "question": f"ما نوع الجمع في كلمة ({w})؟",
                "answer": "جمع مذكر سالم، منصوب أو مجرور بثبوت الياء.",
            })
        if w.endswith("ة"):
            qs.append({
                "question": f"ما الذي يدلّ عليه آخر كلمة ({w})؟",
                "answer": "تاء التأنيث الساكنة، وهي علامة على التأنيث في آخر الكلمة.",
            })
        if "ك" in w[1:-1] or w.startswith("كـ"):
            qs.append({
                "question": f"ما القيمة البلاغية للحرف (ك) في ({w})؟",
                "answer": "الكاف هنا حرف تشبيه، ويفيد إلحاق المشبه بالمشبه به في وجه شبه.",
            })
    return qs


def comparison_questions(text):
    lines = [re.sub(r"\*+", "", ln) for ln in lines_of(text)]
    if len(lines) < 2:
        return []
    out = []
    for i in (0, len(lines) // 2):
        j = min(i + 1, len(lines) - 1)
        if i == j:
            continue
        a, b = lines[i], lines[j]
        out.append({
            "question": (
                f"قارن بين قول الشاعر: «{a}» وقوله: «{b}» من حيث الفكرة والصورة الفنية."
            ),
            "answer": (
                "يحمل البيت الأول دلالة مباشرة في وصف الحال، ويأتي الثاني بصورة "
                "مغايرة تؤكد المعنى نفسه وتعمّقه؛ وكلاهما يخدم الفكرة العامة للقصيدة."
            ),
        })
    return out


def assign_marks(items, total):
    n = len(items)
    if n == 0:
        return []
    base = total // n
    rem = total - base * n
    out = []
    for i, q in enumerate(items):
        q = dict(q)
        q["marks"] = base + (1 if i < rem else 0)
        out.append(q)
    return out


def numbered(items):
    return [dict(q, no=i + 1) for i, q in enumerate(items)]


def seed_bank(seed):
    """Return {poem: {section_key: [questions]}} plus section4 templates."""
    bank = {}
    expression = {}
    for m in seed["models"]:
        poem = (m.get("main_passage") or {}).get("poem")
        if not poem:
            continue
        b = bank.setdefault(poem, {k: [] for k in SEC_KEYS})
        for k in SEC_KEYS:
            for q in (m.get(k) or {}).get("questions", []) or []:
                b[k].append(
                    {key: q.get(key) for key in ("question", "answer", "marks", "parts") if key in q}
                )
        expression.setdefault(poem, []).append(m.get("section4_expression") or {})
    return bank, expression


def make_model(no, excerpt, seed_bank_for_poem, templates, rng):
    poem = excerpt["poem"]
    bank = seed_bank_for_poem
    generated = word_questions(excerpt["text"])
    comparisons = comparison_questions(excerpt["text"])
    rng.shuffle(generated)

    model = {
        "model_no": no,
        "title": f"نموذج امتحاني رقم {no + 20} — اللغة العربية — الشهادة الثانوية (الفرع العلمي)",
        "duration": "ساعتان ونصف",
        "total_marks": 40,
        "main_passage": {
            "poem": poem,
            "poet": excerpt["poet"],
            "unit": "وحدة القصائد",
            "book_pages": excerpt["pages"],
            "verses": excerpt["verses"],
            "instruction": (
                f"اقرأ المقطع المشار إليه من قصيدة ({poem}) للشاعر ({excerpt['poet']}) "
                f"الوارد في الصفحة {excerpt['pages']} من الكتاب المقرر، ثم أجب عمّا يلي:"
            ),
            "text": excerpt["text"],
        },
    }

    targets = [(SEC_KEYS[0], 7, 8), (SEC_KEYS[1], 8, 12), (SEC_KEYS[2], 3, 4)]
    for idx, (key, count, marks) in enumerate(targets):
        seed_qs = list(bank.get(key, []))
        rng.shuffle(seed_qs)
        gen_qs = list(generated)
        rng.shuffle(gen_qs)
        # Keep at least half of each section from the vetted seed bank.
        n_seed = min(len(seed_qs), max(1, count // 2))
        chosen = seed_qs[:n_seed]
        # Every model must contain one comparison between two bayts of the same poem.
        if key == SEC_KEYS[1] and comparisons:
            chosen.append(comparisons[no % len(comparisons)])
        chosen += gen_qs[: count - len(chosen)]
        if len(chosen) < count and seed_qs:
            chosen += seed_qs[n_seed:n_seed + (count - len(chosen))]
        numbered_qs = numbered(assign_marks(chosen[:count], marks))
        model[key] = {
            "title": SEC_TITLES[key],
            "marks": marks,
            "questions": numbered_qs,
        }

    templates = templates or [{}]
    tpl = templates[no % len(templates)]
    sec4 = json.loads(json.dumps(tpl))
    sec4["title"] = "التعبير الكتابي"
    sec4["marks"] = 16
    model["section4_expression"] = sec4
    return model


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=500)
    ap.add_argument("--out", default=OUT_PATH)
    ap.add_argument("--seed", default=SEED_PATH)
    ap.add_argument("--seed-random", type=int, default=2025)
    args = ap.parse_args()

    with open(args.seed, encoding="utf-8") as f:
        seed = json.load(f)
    with open(POEMS_PATH, encoding="utf-8") as f:
        poems = json.load(f)
    bank, expression = seed_bank(seed)
    rng = random.Random(args.seed_random)

    keys = [str(i) for i in range(1, 21)]
    models = []
    for i in range(args.count):
        key = keys[i % len(keys)]
        excerpt = poems[key]
        seed_name = ALIASES.get(excerpt["poem"], excerpt["poem"])
        models.append(make_model(i + 1, excerpt, bank[seed_name], expression[seed_name], rng))

    payload = {
        "meta": {
            "description": (
                "دفعة موسّعة: نماذج امتحانية في اللغة العربية — الصف الثالث الثانوي العلمي — "
                "مبنية على المقطعات الواردة في الكتاب المقرر، مع أسئلة نحوية وبلاغية لكل كلمة "
                "وسؤال مقارنة بين بيتين من القصيدة نفسها."
            ),
            "grade": "الثالث الثانوي العلمي",
            "total_models": len(models),
            "marks_per_model": 40,
            "models_per_poem_excerpt": args.count // 20,
            "note": (
                "نصوص المقاطع مأخوذة من الكتاب المدرسي؛ مفاتيح الإجابة مرفقة. "
                "تُراجع الأسئلة المولّدة من قبل المعلم قبل اعتمادها نهائياً."
            ),
            "poemSource": "data/arabic_poems.json",
        },
        "models": models,
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(models)} models to {args.out}")


if __name__ == "__main__":
    main()
