/* importer.js v5.2 - دعم كامل لـ unit/lesson + النصوص (قصائد/مقاطع) */
(function () {
  const QP = window.QP;
  const utils = QP.utils;

  const AR_OPT_LETTERS = {
    "\u0623": 0, "\u0627": 0, "\u0628": 1, "\u062c": 2,
    "\u062f": 3, "\u0647\u0640": 4, "\u0647": 4, "\u0648": 5, "\u0632": 6
  };

  function str(v) { return v === null || v === undefined ? "" : String(v).trim(); }
  function num(v) { const n = Number(v); return isNaN(n) ? null : n; }

  function normType(t, fallback) {
    t = str(t).toLowerCase();
    if (!t) return fallback || "mcq";
    if (["mcq", "choice", "single", "\u0627\u062e\u062a\u064a\u0627\u0631"].some(function (x) { return t.indexOf(x) >= 0; })) return "mcq";
    if (["multi", "multiple", "\u0645\u062a\u0639\u062f\u062f"].some(function (x) { return t.indexOf(x) >= 0; })) return "multi";
    if (["true", "false", "tf", "\u0635\u062d", "\u062e\u0637\u0623", "\u0635\u0648\u0627\u0628"].some(function (x) { return t.indexOf(x) >= 0; })) return "true_false";
    if (["fill", "blank", "\u0641\u0631\u0627\u063a", "\u0623\u0643\u0645\u0644", "\u0627\u0643\u0645\u0644"].some(function (x) { return t.indexOf(x) >= 0; })) return "fill_blank";
    if (["short", "text", "\u0642\u0635\u064a\u0631"].some(function (x) { return t.indexOf(x) >= 0; })) return "short_answer";
    if (["essay", "\u0645\u0642\u0627\u0644\u064a", "\u0645\u0642\u0627\u0644\u0629"].some(function (x) { return t.indexOf(x) >= 0; })) return "essay";
    return fallback || "mcq";
  }

  function normDifficulty(d) {
    d = str(d).toLowerCase();
    if (["easy", "\u0633\u0647\u0644", "\u0628\u0633\u064a\u0637"].some(function (x) { return d.indexOf(x) >= 0; })) return "easy";
    if (["hard", "\u0635\u0639\u0628", "\u0645\u062a\u0642\u062f\u0645"].some(function (x) { return d.indexOf(x) >= 0; })) return "hard";
    if (["medium", "\u0645\u062a\u0648\u0633\u0637", "\u0648\u0633\u0637"].some(function (x) { return d.indexOf(x) >= 0; })) return "medium";
    return "medium";
  }

  function toList(v) {
    if (Array.isArray(v)) return v.map(str).filter(Boolean);
    if (str(v)) return String(v).split(/[|\n]/).map(str).filter(Boolean);
    return [];
  }

  function resolveMcqAnswer(answer, options, answerIndex) {
    // إذا كان هناك answer_index صريح
    if (answerIndex !== undefined && answerIndex !== null) {
      const idx = Number(answerIndex);
      if (!isNaN(idx) && options[idx] !== undefined) return options[idx];
    }
    if (answer === null || answer === undefined || answer === "") return "";
    if (Array.isArray(answer)) {
      return answer.map(function (a) { return resolveMcqAnswer(a, options); }).filter(Boolean);
    }
    const a = str(answer);
    // رقم (1-based)
    if (/^\d+$/.test(a)) {
      let idx = parseInt(a, 10);
      if (idx >= 1 && idx <= options.length) idx -= 1;
      if (options[idx] !== undefined) return options[idx];
    }
    // حرف عربي
    if (a.length === 1 && AR_OPT_LETTERS[a] !== undefined && options[AR_OPT_LETTERS[a]] !== undefined) {
      return options[AR_OPT_LETTERS[a]];
    }
    // حرف إنجليزي
    if (/^[a-dA-D]$/.test(a)) {
      const idx = a.toLowerCase().charCodeAt(0) - 97;
      if (options[idx] !== undefined) return options[idx];
    }
    // مطابقة نصية
    const match = options.find(function (o) { return utils.sameAnswer(o, a); });
    return match !== undefined ? match : a;
  }

  /* ============================================================
   * normalizeQuestion - مع دعم كامل لـ unit/lesson
   * ============================================================ */
  function normalizeQuestion(raw, meta) {
    meta = meta || {};
    if (!raw || typeof raw !== "object") return null;

    // النص
    const text = str(
      raw.text || raw.question || raw.q || raw.title ||
      raw.question_text || raw.qtext || raw.content || raw.body ||
      raw["\u0633\u0624\u0627\u0644"] || raw["\u0627\u0644\u0633\u0624\u0627\u0644"] ||
      raw["\u0646\u0635"] || raw["\u0627\u0644\u0646\u0635"]
    );
    if (!text) return null;

    const type = normType(raw.type || raw.question_type || raw.kind || raw["\u0646\u0648\u0639"], meta.defaultType);

    // الخيارات
    let options = [];
    const optSources = [
      raw.options, raw.choices, raw.answers_list, raw.answer_options,
      raw["\u062e\u064a\u0627\u0631\u0627\u062a"], raw["\u0627\u0644\u062e\u064a\u0627\u0631\u0627\u062a"]
    ];
    for (let i = 0; i < optSources.length; i++) {
      const src = optSources[i];
      if (Array.isArray(src) && src.length) { options = src.map(str).filter(Boolean); break; }
      if (typeof src === "string" && src.trim()) { options = src.split("|").map(str).filter(Boolean); break; }
    }

    if (!options.length) {
      const numbered = [];
      for (let i = 1; i <= 8; i++) {
        const v = raw["option" + i] || raw["choice" + i] || raw["opt" + i] || raw["\u062e\u064a\u0627\u0631" + i];
        if (v) numbered.push(str(v));
      }
      options = numbered.filter(Boolean);
    }
    if (!options.length) {
      const letters = ["a", "b", "c", "d", "e", "f"];
      const lettered = [];
      letters.forEach(function (L) {
        if (raw[L] !== undefined) lettered.push(str(raw[L]));
        if (raw[L.toUpperCase()] !== undefined) lettered.push(str(raw[L.toUpperCase()]));
      });
      if (lettered.length) options = lettered.filter(Boolean);
    }

    // الإجابة
    let answer = raw.answer;
    if (answer === undefined) answer = raw.correct;
    if (answer === undefined) answer = raw.correctAnswer;
    if (answer === undefined) answer = raw.correct_answer;
    if (answer === undefined) answer = raw.right;
    if (answer === undefined) answer = raw.solution;
    if (answer === undefined) answer = raw["\u0627\u0644\u0625\u062c\u0627\u0628\u0629"];
    if (answer === undefined) answer = raw["\u0627\u0644\u062c\u0648\u0627\u0628"];

    if (answer && typeof answer === "object" && !Array.isArray(answer)) {
      answer = answer.value !== undefined ? answer.value :
        answer.text !== undefined ? answer.text :
          answer.answer !== undefined ? answer.answer : "";
    }

    const answerIndex = raw.answer_index !== undefined ? raw.answer_index : null;

    if (type === "true_false") {
      let a = str(answer);
      if (/^(true|\u0635\u062d|\u0635\u062d\u064a\u062d|\u0635\u0648\u0627\u0628|\u0646\u0639\u0645|1)$/i.test(a)) answer = "\u0635\u062d";
      else if (/^(false|\u062e\u0637\u0623|\u062e\u0637\u0627|\u062e\u0627\u0637\u0626|\u0644\u0627|0)$/i.test(a)) answer = "\u062e\u0637\u0623";
      else if (typeof answer === "boolean") answer = answer ? "\u0635\u062d" : "\u062e\u0637\u0623";
      else answer = "";
    } else if (type === "mcq" || type === "multi") {
      if (type === "multi") {
        answer = Array.isArray(answer) ?
          answer.map(function (x) { return resolveMcqAnswer(x, options); }) :
          toList(answer).map(function (x) { return resolveMcqAnswer(x, options); });
      } else {
        answer = resolveMcqAnswer(answer, options, answerIndex);
      }
    } else {
      answer = Array.isArray(answer) ? answer.join(" | ") : str(answer);
    }

    let points = Number(raw.points) || Number(raw.score) || Number(raw.marks) ||
      Number(raw["\u062f\u0631\u062c\u0629"]) || 1;
    if (points <= 0) points = 1;

    // === بيانات الوحدة والدرس (نسخة شاملة) ===
    let unitNumber = raw.unit_number !== undefined ? raw.unit_number :
      raw.unitNumber !== undefined ? raw.unitNumber :
        raw.unit_no !== undefined ? raw.unit_no :
          raw.unit !== undefined ? raw.unit :
            meta.unitNumber !== undefined ? meta.unitNumber : null;
    unitNumber = num(unitNumber);

    const unitTitle = str(
      raw.unit_title || raw.unitTitle || raw.unit_name || raw.unitName ||
      raw["\u0627\u0633\u0645_\u0627\u0644\u0648\u062d\u062f\u0629"] ||
      raw["\u0639\u0646\u0648\u0627\u0646_\u0627\u0644\u0648\u062d\u062f\u0629"] ||
      meta.unitTitle || ""
    );

    let lessonNumber = raw.lesson_number !== undefined ? raw.lesson_number :
      raw.lessonNumber !== undefined ? raw.lessonNumber :
        raw.lesson_no !== undefined ? raw.lesson_no :
          raw.lesson !== undefined ? raw.lesson :
            meta.lessonNumber !== undefined ? meta.lessonNumber : null;
    lessonNumber = num(lessonNumber);

    const lessonTitle = str(
      raw.lesson_title || raw.lessonTitle || raw.lesson_name || raw.lessonName ||
      raw["\u0627\u0633\u0645_\u0627\u0644\u062f\u0631\u0633"] ||
      raw["\u0639\u0646\u0648\u0627\u0646_\u0627\u0644\u062f\u0631\u0633"] ||
      meta.lessonTitle || ""
    );

    // المعرّف الأصلي
    const sourceId = str(raw.id || raw._id || raw.source_id || raw.question_id || "");

    // النص/المقطع المرافق (قصيدة، مقطع قراءة ...)
    const passage = utils.normalizePassage
      ? utils.normalizePassage(
        raw.passage || raw.lesson_passage || raw.unit_passage ||
        raw["\u0646\u0635_\u0627\u0644\u062f\u0631\u0633"] ||
        meta.passage || meta.unitPassage
      )
      : null;

    // إزالة undefined
    const result = {
      type: type,
      text: text,
      options: options,
      answer: answer,
      difficulty: normDifficulty(raw.difficulty || raw.level || raw["\u0627\u0644\u0645\u0633\u062a\u0648\u0649"]),
      tags: toList(raw.tags || raw["\u0648\u0633\u0648\u0645"]),
      explanation: str(raw.explanation || raw["\u0627\u0644\u0634\u0631\u062d"] || raw["\u062a\u0639\u0644\u064a\u0644"]),
      points: points,
      unitNumber: unitNumber,
      unitTitle: unitTitle,
      lessonNumber: lessonNumber,
      lessonTitle: lessonTitle,
      passage: passage,
      sourceId: sourceId
    };

    return result;
  }

  function validate(q) {
    const errs = [];
    if (!q.text) errs.push("\u0646\u0635 \u0627\u0644\u0633\u0624\u0627\u0644 \u0645\u0641\u0642\u0648\u062f");
    if (q.type === "mcq" || q.type === "multi") {
      if (!q.options || q.options.length < 2) errs.push("\u0639\u062f\u062f \u0627\u0644\u062e\u064a\u0627\u0631\u0627\u062a \u0623\u0642\u0644 \u0645\u0646 2");
      if (!q.answer || (Array.isArray(q.answer) && !q.answer.length)) errs.push("\u0627\u0644\u0625\u062c\u0627\u0628\u0629 \u0645\u0641\u0642\u0648\u062f\u0629");
      else if (q.options && q.options.length) {
        const ans = Array.isArray(q.answer) ? q.answer : [q.answer];
        ans.forEach(function (a) {
          if (q.options.indexOf(a) < 0) errs.push("\u0627\u0644\u0625\u062c\u0627\u0628\u0629 \u0644\u0627 \u062a\u0637\u0627\u0628\u0642: " + a);
        });
      }
    }
    if ((q.type === "fill_blank" || q.type === "short_answer") && !str(q.answer)) {
      errs.push("\u0627\u0644\u0625\u062c\u0627\u0628\u0629 \u0645\u0641\u0642\u0648\u062f\u0629");
    }
    if (q.type === "true_false" && ["\u0635\u062d", "\u062e\u0637\u0623"].indexOf(q.answer) < 0) {
      errs.push("\u0625\u062c\u0627\u0628\u0629 \u063a\u064a\u0631 \u0645\u062d\u062f\u062f\u0629");
    }
    return errs;
  }

  /* ============ CSV ============ */
  function parseCSV(text) {
    const rows = [];
    let row = [], field = "", inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQ = false;
        } else field += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ",") { row.push(field); field = ""; }
        else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
        else if (c === "\r") { }
        else field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return str(x) !== ""; }); });
  }

  function fromCSV(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) return [];
    const header = rows[0].map(function (h) { return str(h).toLowerCase(); });
    const idx = function (names) {
      return header.findIndex(function (h) {
        return names.some(function (n) { return h === n || h.indexOf(n) >= 0; });
      });
    };
    const iType = idx(["type", "\u0646\u0648\u0639"]);
    const iText = idx(["text", "question", "\u0633\u0624\u0627\u0644", "\u0646\u0635"]);
    const iAnswer = idx(["answer", "correct", "\u0625\u062c\u0627\u0628\u0629", "\u062c\u0648\u0627\u0628"]);
    const iDiff = idx(["difficulty", "level", "\u0645\u0633\u062a\u0648\u0649"]);
    const iTags = idx(["tags", "\u0648\u0633\u0648\u0645"]);
    const iExp = idx(["explanation", "\u0634\u0631\u062d"]);
    const iPoints = idx(["points", "\u062f\u0631\u062c\u0629"]);
    const iUnit = idx(["unit_number", "unit_no"]);
    const iUnitTitle = idx(["unit_title", "unit_name"]);
    const iLesson = idx(["lesson_title", "lesson_name"]);
    const iLessonNum = idx(["lesson_number", "lesson_no"]);
    const optCols = header.map(function (h, i) { return (/option|\u062e\u064a\u0627\u0631/i.test(h) ? i : -1); })
      .filter(function (i) { return i >= 0; });
    const iOptions = idx(["options", "choices", "\u062e\u064a\u0627\u0631\u0627\u062a"]);

    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const raw = {
        type: iType >= 0 ? row[iType] : "mcq",
        text: iText >= 0 ? row[iText] : row[0],
        answer: iAnswer >= 0 ? row[iAnswer] : "",
        difficulty: iDiff >= 0 ? row[iDiff] : "",
        tags: iTags >= 0 ? row[iTags] : "",
        explanation: iExp >= 0 ? row[iExp] : "",
        points: iPoints >= 0 ? row[iPoints] : 1,
        unit_number: iUnit >= 0 ? row[iUnit] : null,
        unit_title: iUnitTitle >= 0 ? row[iUnitTitle] : "",
        lesson_number: iLessonNum >= 0 ? row[iLessonNum] : null,
        lesson_title: iLesson >= 0 ? row[iLesson] : "",
        options: []
      };
      if (iOptions >= 0 && str(row[iOptions])) raw.options = String(row[iOptions]).split("|").map(str).filter(Boolean);
      else if (optCols.length) raw.options = optCols.map(function (i) { return str(row[i]); }).filter(Boolean);
      else raw.options = row.slice(2, 6).map(str).filter(Boolean);
      const q = normalizeQuestion(raw);
      if (q) out.push(q);
    }
    return out;
  }

  /* ============ TEXT ============ */
  function fromText(text) {
    const blocks = text.split(/\n\s*\n|(?=^#{2,}\s)/m).map(function (b) { return b.trim(); }).filter(Boolean);
    const out = [];
    for (const block of blocks) {
      const raw = { options: [], tags: [] };
      const optLines = [];
      let answer = "";
      let qText = "";
      const lines = block.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
      for (const line of lines) {
        let m;
        if ((m = line.match(/^\s*(?:\[([^\]]+)\]|([^\]:]+))\s*[:\uFF1A]?\s*(.*)$/))) {
          const tag = (m[1] || m[2] || "").trim();
          if (/^(mcq|choice|single|multi|multiple|tf|true_?false|fill_?blank|short_?answer|essay|\u0627\u062e\u062a\u064a\u0627\u0631|\u0645\u062a\u0639\u062f\u062f|\u0635\u062d|\u062e\u0637\u0623|\u0641\u0631\u0627\u063a|\u0623\u0643\u0645\u0644)/i.test(tag)) {
            raw.type = normType(tag);
            const rest = (m[3] || "").trim();
            if (rest && !qText) qText = rest;
            continue;
          }
        }
        if ((m = line.match(/^(?:\u0627\u0644\u0625\u062c\u0627\u0628\u0629|\u0627\u0644\u062c\u0648\u0627\u0628|answer|correct|\u062c)\s*[:\uFF1A]\s*(.+)$/i))) { answer = m[1].trim(); continue; }
        if ((m = line.match(/^(?:\u0627\u0644\u0634\u0631\u062d|\u062a\u0648\u0636\u064a\u062d|explanation)\s*[:\uFF1A]\s*(.+)$/i))) { raw.explanation = m[1].trim(); continue; }
        if ((m = line.match(/^(?:\u0627\u0644\u0645\u0633\u062a\u0648\u0649|\u0627\u0644\u0635\u0639\u0648\u0628\u0629|difficulty)\s*[:\uFF1A]\s*(.+)$/i))) { raw.difficulty = m[1].trim(); continue; }
        if ((m = line.match(/^(?:\u0627\u0644\u0648\u062d\u062f\u0629|unit)\s*[:\uFF1A]\s*(.+)$/i))) { raw.unit_title = m[1].trim(); continue; }
        if ((m = line.match(/^(?:\u0627\u0644\u062f\u0631\u0633|lesson)\s*[:\uFF1A]\s*(.+)$/i))) { raw.lesson_title = m[1].trim(); continue; }
        if (/^[*+\-\u2022]|^[\u0623\u0628\u062c\u062f\u0648\u0647\u0640][\)\].]|^\d+[\)\].]/.test(line)) {
          const correct = /^\*|^\+/.test(line) || /\((\u0635\u062d|\u0635\u062d\u064a\u062d|correct)\)/i.test(line);
          let val = line.replace(/^[*+\-\u2022]\s*/, "")
            .replace(/^[\u0623\u0628\u062c\u062f\u0648\u0647\u0640][\)\].]\s*/, "")
            .replace(/^\d+[\)\].]\s*/, "");
          val = val.replace(/\((\u0635\u062d|\u0635\u062d\u064a\u062d|correct)\)/i, "").trim();
          optLines.push({ val: val, correct: correct });
          continue;
        }
        if (!qText) { qText = line; continue; }
      }
      raw.text = qText;
      if (optLines.length) {
        raw.options = optLines.map(function (o) { return o.val; });
        const corrects = optLines.filter(function (o) { return o.correct; }).map(function (o) { return o.val; });
        if (corrects.length) answer = corrects.join(" | ");
        raw.type = raw.type || "mcq";
      }
      if (answer !== "") raw.answer = answer;
      if (!raw.type) {
        if (optLines.length) raw.type = "mcq";
        else raw.type = "short_answer";
      }
      const q = normalizeQuestion(raw);
      if (q) out.push(q);
    }
    return out;
  }

  /* ============ JSON ============ */
  function looksLikeQuestion(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const hasText = item.text || item.question || item.q || item.title ||
      item.question_text || item.qtext ||
      item["\u0633\u0624\u0627\u0644"] || item["\u0627\u0644\u0633\u0624\u0627\u0644"];
    if (!hasText) return false;
    const hasContent = item.answer !== undefined || item.correct !== undefined ||
      item.options !== undefined || item.choices !== undefined ||
      item.type !== undefined || item.question_type !== undefined ||
      item.answer_index !== undefined;
    return hasContent;
  }

  function extractQuestionsFromArray(arr, meta) {
    const out = [];
    arr.forEach(function (item) {
      if (!item) return;
      if (looksLikeQuestion(item)) {
        const q = normalizeQuestion(item, meta);
        if (q) out.push(q);
      }
    });
    return out;
  }

  function deepFindQuestions(obj, out, meta, depth) {
    if (!obj || depth > 15) return;
    meta = meta || {};

    if (Array.isArray(obj)) {
      obj.forEach(function (item) { deepFindQuestions(item, out, meta, depth + 1); });
      return;
    }
    if (typeof obj !== "object") return;

    if (looksLikeQuestion(obj)) {
      const q = normalizeQuestion(obj, meta);
      if (q && q.text) out.push(q);
      return;
    }

    const currentMeta = Object.assign({}, meta);
    if (obj.unit_number !== undefined) currentMeta.unitNumber = num(obj.unit_number);
    if (obj.unitNumber !== undefined) currentMeta.unitNumber = num(obj.unitNumber);
    if (obj.unit_title || obj.unitTitle) currentMeta.unitTitle = str(obj.unit_title || obj.unitTitle);
    if (obj.lesson_number !== undefined) currentMeta.lessonNumber = num(obj.lesson_number);
    if (obj.lessonNumber !== undefined) currentMeta.lessonNumber = num(obj.lessonNumber);
    if (obj.lesson_title || obj.lessonTitle) currentMeta.lessonTitle = str(obj.lesson_title || obj.lessonTitle);
    if (obj.passage && utils.normalizePassage) {
      currentMeta.passage = utils.normalizePassage(obj.passage) || currentMeta.passage;
    }

    Object.keys(obj).forEach(function (key) {
      const val = obj[key];
      if (val && typeof val === "object") {
        deepFindQuestions(val, out, currentMeta, depth + 1);
      }
    });
  }

  function fromJSON(obj) {
    if (!obj) return [];

    if (Array.isArray(obj)) {
      const direct = extractQuestionsFromArray(obj, {});
      if (direct.length) return direct;

      const deep = [];
      deepFindQuestions(obj, deep, {}, 0);
      return deep;
    }

    if (typeof obj === "object") {
      // {units: [...]}
      if (obj.units || obj.chapters) {
        const arr = obj.units || obj.chapters;
        if (Array.isArray(arr)) {
          const out = [];
          arr.forEach(function (u) {
            const uMeta = {
              unitNumber: num(u.unit_number || u.unitNumber) || null,
              unitTitle: str(u.unit_title || u.unitTitle || u.title || ""),
              unitPassage: utils.normalizePassage
                ? utils.normalizePassage(u.passage || u.unit_passage || u["\u0646\u0635"])
                : null
            };
            // أسئلة مباشرة
            const directQ = u.questions || u.items;
            if (Array.isArray(directQ)) {
              extractQuestionsFromArray(directQ, uMeta).forEach(function (q) { out.push(q); });
            }
            // دروس
            const lessons = u.lessons || u.topics;
            if (Array.isArray(lessons)) {
              lessons.forEach(function (l) {
                const lMeta = Object.assign({}, uMeta, {
                  lessonNumber: num(l.lesson_number || l.lessonNumber) || null,
                  lessonTitle: str(l.lesson_title || l.lessonTitle || l.title || ""),
                  passage: (utils.normalizePassage
                    ? utils.normalizePassage(l.passage || l.lesson_passage || l["\u0646\u0635"])
                    : null) || uMeta.unitPassage
                });
                const lQ = l.questions || l.items;
                if (Array.isArray(lQ)) {
                  extractQuestionsFromArray(lQ, lMeta).forEach(function (q) { out.push(q); });
                }
              });
            }
          });
          if (out.length) return out;
        }
      }

      if (obj.questions || obj.data || obj.items) {
        const arr = obj.questions || obj.data || obj.items;
        if (Array.isArray(arr)) {
          const out = extractQuestionsFromArray(arr, {});
          if (out.length) return out;
        }
      }

      if (obj.book || obj.curriculum) {
        // ابحث عن units داخل book
        const book = obj.book || obj.curriculum;
        if (book.units) return fromJSON(book);
        if (book.questions) return fromJSON(book);
      }

      if (looksLikeQuestion(obj)) {
        const q = normalizeQuestion(obj, {});
        if (q) return [q];
      }

      const deep = [];
      deepFindQuestions(obj, deep, {}, 0);
      return deep;
    }

    return [];
  }

  /* ============ API ============ */
  const importer = {
    parse: function (text, format) {
      text = String(text || "").trim();
      if (!text) return { questions: [], errors: ["\u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u062d\u062a\u0648\u0649"], format: null };

      let f = format || "auto";
      if (f === "auto") {
        try {
          JSON.parse(text);
          f = "json";
        } catch (e) {
          const firstLine = text.split("\n")[0];
          if (text.indexOf(",") >= 0 && /\n/.test(text) &&
            /(type|text|question|option|answer|\u0646\u0648\u0639|\u0633\u0624\u0627\u0644|\u0625\u062c\u0627\u0628\u0629)/i.test(firstLine)) {
            f = "csv";
          } else {
            f = "text";
          }
        }
      }

      let questions = [];
      const errors = [];

      try {
        if (f === "json") {
          const parsed = JSON.parse(text);
          questions = fromJSON(parsed);
          if (!questions.length) {
            errors.push("\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0623\u0633\u0626\u0644\u0629 \u0641\u064a \u0627\u0644\u0645\u0644\u0641.");
          }
        } else if (f === "csv") {
          questions = fromCSV(text);
        } else {
          questions = fromText(text);
        }
      } catch (e) {
        return { questions: [], errors: ["\u062e\u0637\u0623 \u0641\u064a \u0627\u0644\u062a\u062d\u0644\u064a\u0644: " + e.message], format: f };
      }

      questions = questions.filter(function (q) { return q && q.text; });
      questions.forEach(function (q, i) {
        const errs = validate(q);
        q._row = i + 1;
        q._errors = errs;
        errs.forEach(function (e) { errors.push("\u0633\u0637\u0631 " + (i + 1) + ": " + e); });
      });

      return { questions: questions, errors: errors, format: f };
    },
    normalizeQuestion: normalizeQuestion,
    validate: validate,
    fromJSON: fromJSON,
    fromCSV: fromCSV,
    fromText: fromText
  };

  QP.importer = importer;
  console.log("[importer.js v5.2] loaded \u2705");
})();