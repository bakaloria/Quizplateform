#!/usr/bin/env python3
import json
import os

BASE = '/root/chat/inbox/Quizplateform-main'
BANK_PATH = os.path.join(BASE, 'data/history.json')
OUT_PATH = os.path.join(BASE, 'data/history_exam_templates.json')

def main():
    with open(BANK_PATH, 'r', encoding='utf-8') as f:
        bank = json.load(f)
    
    units = bank.get('units') or []
    units_sorted = sorted(units, key=lambda x: int(x.get('unit_number') or 0))
    all_units = [int(u.get('unit_number') or 0) for u in units_sorted]
    
    templates = []
    
    # نموذج مطابق للامتحان الرسمي - 20 سؤال
    # القسم الأول: 4 اختيار متعدد + 4 صح/خطأ + 1 ترتيب + 1 تعليل
    # القسم الثاني: 2 إجابة قصيرة
    # القسم الثالث: 3 أسئلة متنوعة
    # القسم الرابع: 3 أسئلة
    tpl = {
        "name": "نموذج امتحان التاريخ الرسمي - مطابق للنموذج",
        "subjectId": "history",
        "subjectName": "التاريخ",
        "active": True,
        "sections": [
            {
                "order": 1,
                "title": "السؤال الأول",
                "type": "mixed",
                "count": 10,
                "source": {
                    "unitNumbers": all_units,
                    "lessonNumbers": [],
                    "types": ["mcq", "true_false", "ordering", "short_answer"]
                },
                "shuffle": True
            },
            {
                "order": 2,
                "title": "السؤال الثاني",
                "type": "mixed",
                "count": 2,
                "source": {
                    "unitNumbers": all_units,
                    "lessonNumbers": [],
                    "types": ["short_answer"]
                },
                "shuffle": True
            },
            {
                "order": 3,
                "title": "السؤال الثالث",
                "type": "mixed",
                "count": 3,
                "source": {
                    "unitNumbers": all_units,
                    "lessonNumbers": [],
                    "types": ["short_answer"]
                },
                "shuffle": True
            },
            {
                "order": 4,
                "title": "السؤال الرابع",
                "type": "mixed",
                "count": 5,
                "source": {
                    "unitNumbers": all_units,
                    "lessonNumbers": [],
                    "types": ["short_answer"]
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
    
    # نموذج آخر أكثر تركيزاً على جميع الوحدات
    tpl2 = {
        "name": "نموذج امتحان التاريخ (20 سؤال) - شامل",
        "subjectId": "history",
        "subjectName": "التاريخ",
        "active": True,
        "sections": [
            {
                "order": 1,
                "title": "أولاً - اختر / صح وخطأ / رتب / علل",
                "type": "mixed",
                "count": 4,
                "source": {
                    "unitNumbers": all_units,
                    "lessonNumbers": [],
                    "types": ["mcq"]
                },
                "shuffle": True
            },
            {
                "order": 2,
                "title": "ثانياً - صح أم خطأ",
                "type": "mixed",
                "count": 4,
                "source": {
                    "unitNumbers": all_units,
                    "lessonNumbers": [],
                    "types": ["true_false"]
                },
                "shuffle": True
            },
            {
                "order": 3,
                "title": "ثالثاً - رتب الأحداث",
                "type": "mixed",
                "count": 2,
                "source": {
                    "unitNumbers": all_units,
                    "lessonNumbers": [],
                    "types": ["ordering"]
                },
                "shuffle": True
            },
            {
                "order": 4,
                "title": "رابعاً - التعليل",
                "type": "mixed",
                "count": 2,
                "source": {
                    "unitNumbers": all_units,
                    "lessonNumbers": [],
                    "types": ["short_answer"]
                },
                "shuffle": True
            },
            {
                "order": 5,
                "title": "السؤال الثاني - أجب عن سؤالين",
                "type": "mixed",
                "count": 2,
                "source": {
                    "unitNumbers": all_units,
                    "lessonNumbers": [],
                    "types": ["short_answer"]
                },
                "shuffle": True
            },
            {
                "order": 6,
                "title": "السؤال الثالث والرابع",
                "type": "mixed",
                "count": 6,
                "source": {
                    "unitNumbers": all_units,
                    "lessonNumbers": [],
                    "types": ["short_answer"]
                },
                "shuffle": True
            }
        ],
        "rules": {
            "avoidDuplicates": True,
            "randomizeSections": False
        }
    }
    templates.append(tpl2)
    
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(templates, f, ensure_ascii=False, indent=2)
    
    print(f'Generated {len(templates)} exam templates')

if __name__ == '__main__':
    main()
