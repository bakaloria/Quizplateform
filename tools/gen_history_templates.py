#!/usr/bin/env python3
import json
import os

BASE = '/root/chat/inbox/Quizplateform-main'
BANK_PATH = os.path.join(BASE, 'data/history.json')
OUT_PATH = os.path.join(BASE, 'data/history_all_templates.json')
OUT_PATH2 = os.path.join(BASE, 'data/history_templates.json')

def main():
    with open(BANK_PATH, 'r', encoding='utf-8') as f:
        bank = json.load(f)
    
    units = bank.get('units') or []
    units_sorted = sorted(units, key=lambda x: int(x.get('unit_number') or 0))
    
    templates = []
    
    def add_template(name, unit_nums, lesson_nums, count=25):
        if count < 1:
            return
        tpl = {
            "name": name,
            "subjectId": "history",
            "subjectName": "التاريخ",
            "active": True,
            "sections": [
                {
                    "order": 1,
                    "title": "نموذج امتحاني",
                    "type": "mixed",
                    "count": int(count),
                    "source": {
                        "unitNumbers": sorted(list(set(int(x) for x in unit_nums if x is not None))),
                        "lessonNumbers": sorted(list(set(int(x) for x in lesson_nums if x is not None))),
                        "types": []
                    },
                    "shuffle": True
                }
            ],
            "rules": {
                "avoidDuplicates": True,
                "randomizeSections": False
            }
        }
        templates.append(tpl)
    
    for u in units_sorted:
        u_num = int(u.get('unit_number') or 0)
        lessons = sorted(u.get('lessons') or [], key=lambda x: int(x.get('lesson_number') or 0))
        for l in lessons:
            l_num = int(l.get('lesson_number') or 0)
            l_title = l.get('lesson_title') or f'الدرس {l_num}'
            qcount = len(l.get('questions') or [])
            if qcount == 0:
                continue
            base_count = min(25, qcount)
            variants = max(2, (qcount + 24) // 25)
            if variants > 6:
                variants = 6
            for v in range(1, variants + 1):
                cnt = base_count
                add_template(f"نموذج - {l_title} (درس واحد) | نموذج {v}", [u_num], [l_num], cnt)
    
    for u in units_sorted:
        u_num = int(u.get('unit_number') or 0)
        lessons = sorted(u.get('lessons') or [], key=lambda x: int(x.get('lesson_number') or 0))
        if len(lessons) < 2:
            continue
        for i in range(len(lessons) - 1):
            l1 = lessons[i]; l2 = lessons[i+1]
            l1n = int(l1.get('lesson_number') or 0)
            l2n = int(l2.get('lesson_number') or 0)
            t1 = l1.get('lesson_title') or f'الدرس {l1n}'
            t2 = l2.get('lesson_title') or f'الدرس {l2n}'
            qcount = len(l1.get('questions') or []) + len(l2.get('questions') or [])
            cnt = min(30, max(25, qcount))
            add_template(f"نموذج - درسان متتاليان: {t1} / {t2}", [u_num], [l1n, l2n], cnt)
    
    for u in units_sorted:
        u_num = int(u.get('unit_number') or 0)
        lessons = sorted(u.get('lessons') or [], key=lambda x: int(x.get('lesson_number') or 0))
        if not lessons:
            continue
        lnums = [int(x.get('lesson_number') or 0) for x in lessons]
        qcount = sum(len(x.get('questions') or []) for x in lessons)
        cnt = min(40, max(30, qcount))
        u_title = u.get('unit_title') or f'الوحدة {u_num}'
        add_template(f"نموذج - {u_title} (وحدة كاملة)", [u_num], [], cnt)
    
    if len(units_sorted) >= 2:
        for i in range(len(units_sorted) - 1):
            u1 = units_sorted[i]; u2 = units_sorted[i+1]
            u1n = int(u1.get('unit_number') or 0)
            u2n = int(u2.get('unit_number') or 0)
            t1 = u1.get('unit_title') or f'الوحدة {u1n}'
            t2 = u2.get('unit_title') or f'الوحدة {u2n}'
            qcount = sum(len(l.get('questions') or []) for u in [u1,u2] for l in (u.get('lessons') or []))
            cnt = min(50, max(35, qcount))
            add_template(f"نموذج - وحدتان متتاليتان: {t1} / {t2}", [u1n, u2n], [], cnt)
    
    if units_sorted:
        all_units = [int(u.get('unit_number') or 0) for u in units_sorted]
        qcount = sum(len(l.get('questions') or []) for u in units_sorted for l in (u.get('lessons') or []))
        cnt = min(60, max(40, qcount))
        add_template("نموذج - كامل المادة (جميع الوحدات)", all_units, [], cnt)
    
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(templates, f, ensure_ascii=False, indent=2)
    
    with open(OUT_PATH2, 'w', encoding='utf-8') as f:
        json.dump(templates, f, ensure_ascii=False, indent=2)
    
    print(f'Generated {len(templates)} templates')

if __name__ == '__main__':
    main()
