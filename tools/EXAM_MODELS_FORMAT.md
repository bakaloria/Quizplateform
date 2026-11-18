# صيغة ملفات دفعات النماذج الامتحانية

هذا الدليل يشرح الصيغة المشتركة التي يفهمها مستورد النماذج في التطبيق، بحيث يمكن إضافة ملفات جديدة بنفس البنية لاحقاً دون تعديل الكود.

## 1) البنية العامة

الملف كائن JSON واحد في أعلى مستوى:

```json
{
  "meta": {
    "description": "وصف الدفعة",
    "grade": "الثالث الثانوي العلمي",
    "total_models": 20,
    "marks_per_model": 40,
    "note": "ملاحظات عامة تظهر في وصف النموذج",
    "models_per_poem": 2,
    "batchKey": "arabic_exam_models_batch2"
  },
  "models": [ ... ]
}
```

- `meta.batchKey` اختياري. إذا لم يوجد يُشتق مفتاح الدفعة من اسم الملف تلقائياً.
- `meta.marks_per_model` يُستخدم للتحقق من مجموع درجات كل نموذج.
- عدد العناصر في `models` يجب أن يساوي `meta.total_models` (تظهر رسالة تحذير فقط عند اختلافهما).

## 2) بنية النموذج الواحد

```json
{
  "model_no": 1,
  "title": "نموذج امتحاني رقم 1 — اللغة العربية — الشهادة الثانوية (الفرع العلمي)",
  "duration": "ساعتان ونصف",
  "total_marks": 40,
  "main_passage": {
    "poem": "عرس المجد",
    "poet": "عمر أبو ريشة",
    "unit": 1,
    "book_pages": "7-8",
    "verses": "1-5",
    "instruction": "اقرأ الأبيات ... ثم أجب",
    "text": "نص المقطع المختار من القصيدة (اختياري ويُعرض للطالب)"
  },
  "section1_language_thought_emotion": {
    "title": "أولاً: المهارات اللغوية والبنية الفكرية والعاطفة",
    "marks": 8,
    "questions": [
      { "no": 1, "marks": 1, "question": "ما مفرد كلمة (الشهب)؟", "answer": "شهاب" }
    ]
  },
  "section2_art_structure_grammar": {
    "marks": 12,
    "questions": [
      { "no": 9, "marks": 4, "question": "...", "parts": [
          { "item": "أ- ...", "answer": "..." },
          { "item": "ب- ...", "answer": "..." }
      ] }
    ]
  },
  "section3_reading_and_study": {
    "marks": 4,
    "passage_ref": "نص القراءة والمطالعة ...",
    "questions": [ ... ]
  },
  "section4_expression": {
    "marks": 16,
    "compulsory": {
      "question": "اكتب ...",
      "marks": 10,
      "expected_points": ["نقطة 1", "نقطة 2"]
    },
    "optional": {
      "marks": 6,
      "options": [
        { "question": "الخيار الأول", "marks": 6, "expected_answer": "إجابة نموذجية" },
        { "question": "الخيار الثاني", "marks": 6, "expected_answer": "إجابة نموذجية" }
      ]
    }
  }
}
```

### الحقول المطلوبة
- `model_no`, `title` لكل نموذج.
- الأقسام الأربعة: `section1_language_thought_emotion`, `section2_art_structure_grammar`, `section3_reading_and_study`, `section4_expression`.
- لكل سؤال في الأقسام 1-3: `question` و `marks`، و`answer` أو `parts` تحوي `item` و `answer`.
- في القسم 4: `compulsory.expected_points` و `optional.options`.

### حقول اختيارية مفيدة
- `parts` للأسئلة متعددة الأجزاء: يُضاف نص كل `item` إلى نص السؤال، وتُجمع الإجابات في مفتاح الإجابة.
- `passage_ref` في القسم 3: يُضاف إلى صندوق النص المرافق.
- `main_passage.instruction` و `book_pages` و `verses`: تظهر للطالب كتعليمات وملاحظات مرجعية داخل صندوق النص.
- `main_passage.text`: اختياري؛ يُلحق بنص التعليمات داخل صندوق النص، ويُستخدم لإدراج المقطع/الأبيات المشار إليها فقط (لا نص القصيدة كاملاً).
- نصوص المقاطع العشرين المشار إليها محفوظة في `data/arabic_poems.json` ومفتاحها رقم النموذج في الدفعة الأولى.

## 3) كيف يُحوّل المستورد الملف إلى نماذج في التطبيق؟

- كل نموذج يصبح مستنداً في مجموعة `exams` يحمل:
  - `modelFamily: "arabic-exam-models"` حتى يُميّز عن نماذج الفلسفة والأحياء.
  - `templateKey: "<batchKey>-model-<model_no>"` لمنع التكرار عند إعادة الاستيراد.
  - `settings.sourceModel` و `settings.sourceMeta` و `settings.expressionOptions` تحفظ النسخة الأصلية كاملة للرجوع إليها.
  - `targetGroups: ["ALL"]`، و`status` إما `draft` أو `published`.
- جميع الأسئلة تُخزّن بنمط `essay` (تصحيح يدوي) حتى لا يُعتبر الطالب خطئاً بسبب اختلاف صياغة الإجابة العربية.
- إجمالي الدرجات لكل نموذج = مجموع `marks` للأسئلة + 10 للسؤال الإلزامي + 6 للخيار المختار = 40 درجة.
- السؤالان الاختياريان في التعبير لا يعرضان معاً للطالب (لأن التطبيق لا يدعم "اختر واحداً"). يتم اختيار أحدهما تلقائياً حسب الإعداد:
  - `odd`: الخيار الثاني للأرقام الفردية والأول للأرقام الزوجية (الافتراضي، يعطي تنوعاً).
  - `even`: العكس.
  - `first` / `second`: تثبيت خيار واحد دائماً.
  - الخيار الآخر يبقى محفوظاً في `settings.expressionOptions` و `settings.sourceModel` للمدير.

## 4) طرق الاستيراد

### أ) من المتصفح (للاستخدام اليومي)
1. افتح `admin.html` → سجّل الدخول كمدير.
2. اضغط **📥 استيراد النماذج** من الشريط العلوي (أو افتح `import-exam-models.html`).
3. اختر ملفاً أو أكثر بنفس الصيغة، أو الصق محتوى JSON.
4. راجع المعاينة، ثم اضغط **حفظ كمسودات** أو **حفظ ونشر مباشر**.
5. من جدول **النماذج المستوردة** تستطيع اعتماد/نشر أي نموذج أو أرشفته.
6. إعادة استيراد نفس الملف تُحدّث النماذج الموجودة فقط إذا لم يكن الطلاب قد سلموا فيها.

### ب) من سطر الأوامر (للدفعات الكبيرة أو الاستيراد الأولي)
```bash
python3 tools/import_exam_models.py --file /path/to/batch.json --dry-run
python3 tools/import_exam_models.py --file /path/to/batch.json
python3 tools/import_exam_models.py --file /path/to/batch.json --status published
python3 tools/import_exam_models.py --file /path/to/batch.json --replace
python3 tools/import_exam_models.py --verify
```

### ج) توليد دفعات موسّعة وحقن نصوص القصائد
```bash
# توليد 500 نموذج من المقاطع العشرين الموجودة في data/arabic_poems.json
python3 tools/generate_arabic_models.py --count 500 --out data/arabic_exam_models_batch2.json

# إدراج الأبيات المشار إليها في نماذج دفعة موجودة (يتخطى النماذج التي سُلّم فيها الطلاب)
python3 tools/inject_arabic_poems.py --dry-run
python3 tools/inject_arabic_poems.py --apply
python3 tools/inject_arabic_poems.py --verify
```

## 5) ملاحظات للطلاب
- تظهر النماذج المنشورة فقط في قائمة الاختبارات/النماذج.
- كل نموذج يحتوي على 20 سؤالاً: 18 من الأقسام الثلاثة + سؤال التعبير الإلزامي + سؤال تعبير اختياري واحد.
- مفتاح الإجابة الكامل (بما في ذلك نقاط الإجابة المتوقعة) متاح للمدير عند التصحيح؛ التصحيح يدوي بالكامل.
