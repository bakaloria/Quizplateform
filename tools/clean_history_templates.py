#!/usr/bin/env python3
import json
import os

BASE = '/root/chat/inbox/Quizplateform-main'
OUT_PATH = os.path.join(BASE, 'data/history_templates.json')
OUT_PATH2 = os.path.join(BASE, 'data/history_all_templates.json')
OUT_PATH3 = os.path.join(BASE, 'data/history_exam_templates.json')

def main():
    # Keep only official templates
    templates = []
    
    # Load official ones
    with open(OUT_PATH, 'r', encoding='utf-8') as f:
        current = json.load(f)
    
    for t in current:
        if 'نموذج امتحاني رسمي' in t.get('name', ''):
            # Verify it has 20 questions total
            total = sum(s.get('count', 0) for s in t.get('sections', []))
            if total == 20:
                templates.append(t)
    
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(templates, f, ensure_ascii=False, indent=2)
    with open(OUT_PATH2, 'w', encoding='utf-8') as f:
        json.dump(templates, f, ensure_ascii=False, indent=2)
    
    print(f'Kept {len(templates)} templates')

if __name__ == '__main__':
    main()
