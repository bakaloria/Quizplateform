#!/usr/bin/env python3
import json
import os

BASE = '/root/chat/inbox/Quizplateform-main'
HISTORY_PATH = os.path.join(BASE, 'data/history.json')
NEW_BANK_PATH = os.path.join(BASE, 'data/بنك_اسئلة_التاريخ_الثالث_الثانوي_الادبي_موحد_1210.json')
OUT_PATH = os.path.join(BASE, 'data/history.json')

def map_type(t):
    t = str(t).lower()
    if t == 'mcq':
        return 'mcq'
    elif t == 'true_false':
        return 'true_false'
    elif t in ('fill_blank', 'short_answer', 'enumeration'):
        # Treat fill_blank/enumeration as short_answer for compatibility
        return 'short_answer'
    elif t in ('essay',):
        return 'essay'
    elif t in ('matching',):
        return 'matching'
    elif t in ('ordering',):
        return 'ordering'
    return t

def convert_question(q, unit_num, lesson_num):
    qtype = map_type(q.get('type'))
    res = {
        "lesson_number": int(lesson_num),
        "type": qtype,
        "text": q.get('question') or q.get('text') or '',
        "unit_number": int(unit_num),
        "points": 1 if qtype == 'mcq' or qtype == 'true_false' else 2,
        "explanation": "",
        "id": q.get('id') or f"hist-{qtype}-{hash(q.get('question',''))}",
        "book": "كتاب التاريخ للصف الثالث الثانوي الأدبي 2025-2026",
        "unitNumber": int(unit_num),
        "lessonNumber": int(lesson_num)
    }
    
    if qtype == 'mcq':
        res["options"] = q.get('options') or []
        res["answer"] = q.get('answer') or (res["options"][q['answer_index']] if q.get('answer_index') is not None and res["options"] else '')
    elif qtype == 'true_false':
        res["answer"] = q.get('answer') or ''
    elif qtype == 'short_answer':
        ans = q.get('answer') or ''
        res["answer"] = ans
    else:
        res["answer"] = q.get('answer') or ''
    
    # Add tags if available
    res["tags"] = []
    return res

def main():
    with open(HISTORY_PATH, 'r', encoding='utf-8') as f:
        history = json.load(f)
    
    with open(NEW_BANK_PATH, 'r', encoding='utf-8') as f:
        bank = json.load(f)
    
    # Build map of existing questions by text
    existing = set()
    for u in history.get('units', []):
        for l in u.get('lessons', []):
            for q in l.get('questions', []):
                t = (q.get('text') or q.get('question') or '').strip()
                if t:
                    existing.add(t)
    
    added = 0
    for unit in bank.get('units', []):
        unit_num = int(unit.get('unit_number'))
        unit_title = unit.get('unit_title')
        
        # Find matching unit in history
        hist_unit = None
        for hu in history.get('units', []):
            if int(hu.get('unit_number')) == unit_num:
                hist_unit = hu
                break
        
        if not hist_unit:
            # Create new unit if doesn't exist
            hist_unit = {
                "unit_number": unit_num,
                "unit_title": unit_title,
                "lessons": []
            }
            history['units'].append(hist_unit)
        
        # Build lesson map
        lesson_map = {}
        for hl in hist_unit.get('lessons', []):
            lesson_map[int(hl.get('lesson_number'))] = hl
        
        for q in unit.get('questions', []):
            qtext = (q.get('question') or '').strip()
            if qtext in existing:
                continue
            lesson_num = q.get('lesson')
            if lesson_num is None:
                lesson_num = 1
            lesson_num = int(lesson_num)
            
            if lesson_num not in lesson_map:
                # Create lesson
                lesson_map[lesson_num] = {
                    "lesson_number": lesson_num,
                    "lesson_title": q.get('lesson_title') or f'الدرس {lesson_num}',
                    "questions": []
                }
                hist_unit['lessons'].append(lesson_map[lesson_num])
            
            cq = convert_question(q, unit_num, lesson_num)
            lesson_map[lesson_num]['questions'].append(cq)
            existing.add(qtext)
            added += 1
    
    # Sort
    for u in history.get('units', []):
        u['lessons'] = sorted(u['lessons'], key=lambda x: int(x.get('lesson_number') or 0))
        for l in u['lessons']:
            # Deduplicate within lesson
            seen = set()
            newq = []
            for q in l['questions']:
                t = (q.get('text') or '').strip()
                if t and t not in seen:
                    seen.add(t)
                    newq.append(q)
            l['questions'] = newq
    
    history['units'] = sorted(history['units'], key=lambda x: int(x.get('unit_number') or 0))
    
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False, indent=2)
    
    print(f'Added {added} new questions')

if __name__ == '__main__':
    main()
