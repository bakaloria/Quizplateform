#!/usr/bin/env python3
import json
import os

BASE = '/root/chat/inbox/Quizplateform-main'
OUT_PATH = os.path.join(BASE, 'data/history_templates.json')
OUT_PATH2 = os.path.join(BASE, 'data/history_all_templates.json')

# Load history bank
with open(os.path.join(BASE, 'data/history.json'), 'r', encoding='utf-8') as f:
    bank = json.load(f)

# Build questions by type
mcq_qs = []
tf_qs = []
ord_qs = []
sa_qs = []

for u in bank.get('units', []):
    for l in u.get('lessons', []):
        for q in l.get('questions', []):
            qt = q.get('type')
            if qt == 'mcq':
                mcq_qs.append(q)
            elif qt == 'true_false':
                tf_qs.append(q)
            elif qt == 'ordering':
                ord_qs.append(q)
            elif qt == 'short_answer':
                sa_qs.append(q)

print('mcq:', len(mcq_qs), 'tf:', len(tf_qs), 'ord:', len(ord_qs), 'sa:', len(sa_qs))

# Create fixed templates
templates = []
units = sorted([int(u.get('unit_number') or 0) for u in bank.get('units', [])])
all_units = units

# كامل المادة
for v in range(1, 51):
    tpl = {
        "name": f"نموذج امتحاني رسمي - كامل المادة | نموذج {v}",
        "subjectId": "history",
        "subjectName": "التاريخ",
        "active": True,
        "sections": [
            {
                "order": 1,
                "title": "السؤال الأول - أولاً: اختر الإجابة الصحيحة",
                "type": "mixed",
                "count": 4,
                "source": {"unitNumbers": all_units, "lessonNumbers": [], "types": ["mcq"], "hasPassage": False},
                "shuffle": True,
                "requireAnswer": True
            },
            {
                "order": 2,
                "title": "السؤال الأول - ثانياً: ضع علامة (صح) أو (خطأ)",
                "type": "mixed",
                "count": 4,
                "source": {"unitNumbers": all_units, "lessonNumbers": [], "types": ["true_false"], "hasPassage": False},
                "shuffle": True,
                "requireAnswer": True
            },
            {
                "order": 3,
                "title": "السؤال الأول - ثالثاً: رتب ما يلي ترتيباً زمنياً",
                "type": "mixed",
                "count": 1,
                "source": {"unitNumbers": all_units, "lessonNumbers": [], "types": ["ordering"], "hasPassage": False},
                "shuffle": True,
                "requireAnswer": True
            },
            {
                "order": 4,
                "title": "السؤال الأول - رابعاً: علل ما يأتي تعليلاً موجزاً",
                "type": "mixed",
                "count": 2,
                "source": {"unitNumbers": all_units, "lessonNumbers": [], "types": ["short_answer"], "hasPassage": False},
                "shuffle": True,
                "requireAnswer": True
            },
            {
                "order": 5,
                "title": "السؤال الثاني: أجب عن اثنين مما يلي",
                "type": "mixed",
                "count": 2,
                "source": {"unitNumbers": all_units, "lessonNumbers": [], "types": ["short_answer"], "hasPassage": False},
                "shuffle": True,
                "requireAnswer": True
            },
            {
                "order": 6,
                "title": "السؤال الثالث: أجب عن ثلاثة مما يلي",
                "type": "mixed",
                "count": 3,
                "source": {"unitNumbers": all_units, "lessonNumbers": [], "types": ["short_answer"], "hasPassage": False},
                "shuffle": True,
                "requireAnswer": True
            },
            {
                "order": 7,
                "title": "السؤال الرابع: أجب عما يأتي",
                "type": "mixed",
                "count": 4,
                "source": {"unitNumbers": all_units, "lessonNumbers": [], "types": ["short_answer"], "hasPassage": False},
                "shuffle": True,
                "requireAnswer": True
            }
        ],
        "rules": {"avoidDuplicates": True, "randomizeSections": False, "noPassage": True}
    }
    templates.append(tpl)

# لكل وحدة
for u_num in all_units:
    u_title = None
    for u in bank.get('units', []):
        if int(u.get('unit_number')) == u_num:
            u_title = u.get('unit_title')
            break
    for v in range(1, 21):
        tpl = {
            "name": f"نموذج امتحاني رسمي - {u_title or f'الوحدة {u_num}'} | نموذج {v}",
            "subjectId": "history",
            "subjectName": "التاريخ",
            "active": True,
            "sections": [
                {"order": 1, "title": "السؤال الأول - أولاً: اختر الإجابة الصحيحة", "type": "mixed", "count": 4, "source": {"unitNumbers": [u_num], "lessonNumbers": [], "types": ["mcq"], "hasPassage": False}, "shuffle": True, "requireAnswer": True},
                {"order": 2, "title": "السؤال الأول - ثانياً: ضع علامة (صح) أو (خطأ)", "type": "mixed", "count": 4, "source": {"unitNumbers": [u_num], "lessonNumbers": [], "types": ["true_false"], "hasPassage": False}, "shuffle": True, "requireAnswer": True},
                {"order": 3, "title": "السؤال الأول - ثالثاً: رتب ما يلي ترتيباً زمنياً", "type": "mixed", "count": 1, "source": {"unitNumbers": [u_num], "lessonNumbers": [], "types": ["ordering"], "hasPassage": False}, "shuffle": True, "requireAnswer": True},
                {"order": 4, "title": "السؤال الأول - رابعاً: علل ما يأتي تعليلاً موجزاً", "type": "mixed", "count": 2, "source": {"unitNumbers": [u_num], "lessonNumbers": [], "types": ["short_answer"], "hasPassage": False}, "shuffle": True, "requireAnswer": True},
                {"order": 5, "title": "السؤال الثاني: أجب عن اثنين مما يلي", "type": "mixed", "count": 2, "source": {"unitNumbers": [u_num], "lessonNumbers": [], "types": ["short_answer"], "hasPassage": False}, "shuffle": True, "requireAnswer": True},
                {"order": 6, "title": "السؤال الثالث: أجب عن ثلاثة مما يلي", "type": "mixed", "count": 3, "source": {"unitNumbers": [u_num], "lessonNumbers": [], "types": ["short_answer"], "hasPassage": False}, "shuffle": True, "requireAnswer": True},
                {"order": 7, "title": "السؤال الرابع: أجب عما يأتي", "type": "mixed", "count": 4, "source": {"unitNumbers": [u_num], "lessonNumbers": [], "types": ["short_answer"], "hasPassage": False}, "shuffle": True, "requireAnswer": True},
            ],
            "rules": {"avoidDuplicates": True, "randomizeSections": False, "noPassage": True}
        }
        templates.append(tpl)

with open(OUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(templates, f, ensure_ascii=False, indent=2)
with open(OUT_PATH2, 'w', encoding='utf-8') as f:
    json.dump(templates, f, ensure_ascii=False, indent=2)

print('Generated', len(templates))
