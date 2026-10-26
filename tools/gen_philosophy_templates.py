#!/usr/bin/env python3
import json
import os

BASE = '/root/chat/inbox/Quizplateform-main'
BANK_PATH = os.path.join(BASE, 'data/philosophy.json')
OUT_PATH = os.path.join(BASE, 'data/philosophy_all_templates.json')

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
            "subjectId": "philosophy",
            "subjectName": "الفلسفة",
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
    
    # 1) لكل درس لوحده
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
            variants = max(3, (qcount + 24) // 25)
            if variants > 8:
                variants = 8
            for v in range(1, variants + 1):
                cnt = base_count
                add_template(f"نموذج - {l_title} (درس واحد) | نموذج {v}", [u_num], [l_num], cnt)
    
    # 2) أزواج دروس متتالية
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
            add_template(f"نموذج - درسان متتاليان: {t1} / {t2} | نموذج ب", [u_num], [l1n, l2n], cnt)
    
    # 3) ثلاثة دروس متتالية
    for u in units_sorted:
        u_num = int(u.get('unit_number') or 0)
        lessons = sorted(u.get('lessons') or [], key=lambda x: int(x.get('lesson_number') or 0))
        if len(lessons) < 3:
            continue
        for i in range(len(lessons) - 2):
            block = lessons[i:i+3]
            lnums = [int(x.get('lesson_number') or 0) for x in block]
            titles = [x.get('lesson_title') or f'الدرس {lnums[j]}' for j,x in enumerate(block)]
            qcount = sum(len(x.get('questions') or []) for x in block)
            cnt = min(35, max(30, qcount))
            add_template(f"نموذج - ثلاثة دروس متتالية: {titles[0]} / {titles[1]} / {titles[2]}", [u_num], lnums, cnt)
    
    # 4) من البداية حتى كل نقطة
    for u in units_sorted:
        u_num = int(u.get('unit_number') or 0)
        lessons = sorted(u.get('lessons') or [], key=lambda x: int(x.get('lesson_number') or 0))
        if len(lessons) < 2:
            continue
        for end in range(1, len(lessons)):
            block = lessons[0:end+1]
            lnums = [int(x.get('lesson_number') or 0) for x in block]
            if len(lnums) == len(lessons):
                continue
            qcount = sum(len(x.get('questions') or []) for x in block)
            cnt = min(35, max(25, qcount))
            add_template(f"نموذج - من الدرس الأول حتى الدرس {lnums[-1]} ({u.get('unit_title') or u_num})", [u_num], lnums, cnt)
    
    # 5) كل وحدة كاملة
    for u in units_sorted:
        u_num = int(u.get('unit_number') or 0)
        u_title = u.get('unit_title') or f'الوحدة {u_num}'
        lessons = sorted(u.get('lessons') or [], key=lambda x: int(x.get('lesson_number') or 0))
        lnums = [int(l.get('lesson_number') or 0) for l in lessons]
        qcount = sum(len(l.get('questions') or []) for l in lessons)
        cnt = min(40, max(35, qcount))
        add_template(f"نموذج - {u_title} كاملًا (وحدة {u_num})", [u_num], lnums, cnt)
        add_template(f"نموذج - {u_title} كاملًا (وحدة {u_num}) | نسخة ثانية", [u_num], lnums, cnt)
    
    # 6) وحدتان متتاليتان
    if len(units_sorted) >= 2:
        for i in range(len(units_sorted) - 1):
            u1 = units_sorted[i]; u2 = units_sorted[i+1]
            un1 = int(u1.get('unit_number') or 0)
            un2 = int(u2.get('unit_number') or 0)
            lessons1 = sorted(u1.get('lessons') or [], key=lambda x: int(x.get('lesson_number') or 0))
            lessons2 = sorted(u2.get('lessons') or [], key=lambda x: int(x.get('lesson_number') or 0))
            lnums = [int(l.get('lesson_number') or 0) for l in lessons1] + [int(l.get('lesson_number') or 0) for l in lessons2]
            qcount = sum(len(l.get('questions') or []) for l in lessons1) + sum(len(l.get('questions') or []) for l in lessons2)
            cnt = min(40, max(35, qcount))
            add_template(f"نموذج - وحدتان متتاليتان: {u1.get('unit_title')} / {u2.get('unit_title')}", [un1, un2], lnums, cnt)
    
    # 7) ثلاث وحدات متتالية
    if len(units_sorted) >= 3:
        for i in range(len(units_sorted) - 2):
            block = units_sorted[i:i+3]
            unums = [int(x.get('unit_number') or 0) for x in block]
            lnums = []
            qcount = 0
            for u in block:
                for l in sorted(u.get('lessons') or [], key=lambda x: int(x.get('lesson_number') or 0)):
                    lnums.append(int(l.get('lesson_number') or 0))
                    qcount += len(l.get('questions') or [])
            cnt = min(40, max(35, qcount))
            add_template(f"نموذج - ثلاث وحدات متتالية: {block[0].get('unit_title')} / {block[1].get('unit_title')} / {block[2].get('unit_title')}", unums, lnums, cnt)
    
    # 8) أربع وحدات متتالية
    if len(units_sorted) >= 4:
        for i in range(len(units_sorted) - 3):
            block = units_sorted[i:i+4]
            unums = [int(x.get('unit_number') or 0) for x in block]
            lnums = []
            qcount = 0
            for u in block:
                for l in sorted(u.get('lessons') or [], key=lambda x: int(x.get('lesson_number') or 0)):
                    lnums.append(int(l.get('lesson_number') or 0))
                    qcount += len(l.get('questions') or [])
            cnt = min(40, max(35, qcount))
            add_template(f"نموذج - أربع وحدات متتالية", unums, lnums, cnt)
    
    # 9) الكتاب كاملًا
    all_unums = [int(u.get('unit_number') or 0) for u in units_sorted]
    all_lnums = []
    qcount_total = 0
    for u in units_sorted:
        for l in sorted(u.get('lessons') or [], key=lambda x: int(x.get('lesson_number') or 0)):
            all_lnums.append(int(l.get('lesson_number') or 0))
            qcount_total += len(l.get('questions') or [])
    add_template("نموذج - الكتاب كاملًا", all_unums, all_lnums, min(40, max(40, qcount_total)))
    add_template("نموذج - الكتاب كاملًا | نسخة شاملة ٢", all_unums, all_lnums, min(40, max(40, qcount_total)))
    
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(templates, f, ensure_ascii=False, indent=2)
    
    print(f'Generated {len(templates)} templates -> {OUT_PATH}')

if __name__ == '__main__':
    main()
