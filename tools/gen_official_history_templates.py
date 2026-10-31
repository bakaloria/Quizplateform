#!/usr/bin/env python3
import json
import os

BASE = '/root/chat/inbox/Quizplateform-main'
BANK_PATH = os.path.join(BASE, 'data/history.json')
OUT_PATH = os.path.join(BASE, 'data/history_templates.json')
OUT_PATH2 = os.path.join(BASE, 'data/history_all_templates.json')

def main():
    with open(BANK_PATH, 'r', encoding='utf-8') as f:
        bank = json.load(f)
    
    units = bank.get('units') or []
    units_sorted = sorted(units, key=lambda x: int(x.get('unit_number') or 0))
    all_units = [int(u.get('unit_number') or 0) for u in units_sorted]
    
    templates = []
    
    # نموذج رسمي مطابق تماماً للنموذج المرسل
    def add_official_template(name, unit_nums):
        tpl = {
            "name": name,
            "subjectId": "history",
            "subjectName": "التاريخ",
            "active": True,
            "sections": [
                {
                    "order": 1,
                    "title": "السؤال الأول - أولاً: اختر الإجابة الصحيحة",
                    "type": "mixed",
                    "count": 4,
                    "source": {"unitNumbers": unit_nums, "lessonNumbers": [], "types": ["mcq"]},
                    "shuffle": True
                },
                {
                    "order": 2,
                    "title": "السؤال الأول - ثانياً: صح أم خطأ",
                    "type": "mixed",
                    "count": 4,
                    "source": {"unitNumbers": unit_nums, "lessonNumbers": [], "types": ["true_false"]},
                    "shuffle": True
                },
                {
                    "order": 3,
                    "title": "السؤال الأول - ثالثاً: رتب الأحداث حسب التسلسل الزمني",
                    "type": "mixed",
                    "count": 1,
                    "source": {"unitNumbers": unit_nums, "lessonNumbers": [], "types": ["ordering"]},
                    "shuffle": True
                },
                {
                    "order": 4,
                    "title": "السؤال الأول - رابعاً: علل",
                    "type": "mixed",
                    "count": 2,
                    "source": {"unitNumbers": unit_nums, "lessonNumbers": [], "types": ["short_answer"]},
                    "shuffle": True
                },
                {
                    "order": 5,
                    "title": "السؤال الثاني - أجب عن سؤالين",
                    "type": "mixed",
                    "count": 2,
                    "source": {"unitNumbers": unit_nums, "lessonNumbers": [], "types": ["short_answer"]},
                    "shuffle": True
                },
                {
                    "order": 6,
                    "title": "السؤال الثالث - أجب عن الأسئلة",
                    "type": "mixed",
                    "count": 3,
                    "source": {"unitNumbers": unit_nums, "lessonNumbers": [], "types": ["short_answer"]},
                    "shuffle": True
                },
                {
                    "order": 7,
                    "title": "السؤال الرابع",
                    "type": "mixed",
                    "count": 4,
                    "source": {"unitNumbers": unit_nums, "lessonNumbers": [], "types": ["short_answer"]},
                    "shuffle": True
                }
            ],
            "rules": {"avoidDuplicates": True, "randomizeSections": False}
        }
        templates.append(tpl)
    
    # نموذج شامل لكل الوحدات
    add_official_template("نموذج امتحاني رسمي - كامل المادة (مطابق للنموذج)", all_units)
    
    # نموذج لكل وحدة
    for u in units_sorted:
        u_num = int(u.get('unit_number'))
        u_title = u.get('unit_title') or f'الوحدة {u_num}'
        add_official_template(f"نموذج امتحاني رسمي - {u_title}", [u_num])
    
    # نماذج لوحدتين متتاليتين
    for i in range(len(units_sorted)-1):
        u1 = units_sorted[i]; u2 = units_sorted[i+1]
        u1n = int(u1['unit_number']); u2n = int(u2['unit_number'])
        add_official_template(f"نموذج امتحاني رسمي - الوحدتان {u1n}-{u2n}", [u1n, u2n])
    
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(templates, f, ensure_ascii=False, indent=2)
    with open(OUT_PATH2, 'w', encoding='utf-8') as f:
        json.dump(templates, f, ensure_ascii=False, indent=2)
    
    print(f'Generated {len(templates)} official templates')

if __name__ == '__main__':
    main()
