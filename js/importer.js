/* importer.js v3.0 - Multi-format JSON support */
(function () {
  const QP = window.QP;
  const utils = QP.utils;

  const AR_OPT_LETTERS = {
    "\u0623": 0, "\u0627": 0, "\u0628": 1, "\u062c": 2,
    "\u062f": 3, "\u0647\u0640": 4, "\u0647": 4, "\u0648": 5, "\u0632": 6
  };

  function str(v) { return v === null || v === undefined ? "" : String(v).trim(); }

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

  function resolveMcqAnswer(answer, options) {
    if (answer === null || answer === undefined || answer === "") return "";
    if (Array.isArray(answer)) return answer.map(function (a) { return resolveMcqAnswer(a, options); }).filter(Boolean);
    const a = str(answer);
    if (/^\d+$/.test(a)) {
      let idx = parseInt(a, 10);
      if (idx >= 1 && idx <= options.length) idx -= 1;
      if (options[idx] !== undefined) return options[idx];
    }
    if (a.length === 1 && AR_OPT_LETTERS[a] !== undefined && options[AR_OPT_LETTERS[a]] !== undefined) {
      return options[AR_OPT_LETTERS[a]];
    }
    if (/^[a-dA-D]$/.test(a)) {
      const idx = a.toLowerCase().charCodeAt(0) - 97;
      if (options[idx] !== undefined) return options[idx];
    }
    const match = options.find(function (o) { return utils.sameAnswer(o, a); });
    return match !== undefined ? match : a;
  }

  /* ============================================================
   * normalizeQuestion - يحول أي كائن خام إلى سؤال موحّد
   * ============================================================ */
  function normalizeQuestion(raw, opts) {
    opts = opts || {};
    if (!raw || typeof raw !== "object") return null;

    // البحث عن النص في عدة احتمالات
    const text = str(
      raw.text || raw.question || raw.q || raw.title ||
      raw.question_text || raw.qtext || raw.content || raw.body ||
      raw["\u0633\u0624\u0627\u0644"] || raw["\u0627\u0644\u0633\u0624\u0627\u0644"] ||
      raw["\u0646\u0635"] || raw["\u0627\u0644\u0646\u0635"] ||
      raw["\u0646\u0635_\u0627\u0644\u0633\u0624\u0627\u0644"]
    );
    if (!text) return null;

    const type = normType(raw.type || raw.question_type || raw.kind || raw["\u0646\u0648\u0639"], opts.defaultType);

    // استخراج الخيارات من عدة احتمالات
    let options = [];
    const optSources = [
      raw.options, raw.choices, raw.answers_list, raw.answer_options,
      raw["\u062e\u064a\u0627\u0631\u0627\u062a"], raw["\u0627\u0644\u062e\u064a\u0627\u0631\u0627\u062a"]
    ];
    for (const src of optSources) {
      if (Array.isArray(src) && src.length) { options = src.map(str).filter(Boolean); break; }
      if (typeof src === "string" && src.trim()) { options = src.split("|").map(str).filter(Boolean); break; }
    }

    // البحث عن خيارات مرقمة أو حرفية
    if (!options.length) {
      const numbered = [];
      for (let i = 1; i <= 8; i++) {
        const v = raw["option" + i] || raw["choice" + i] || raw["opt" + i] ||
          raw["\u062e\u064a\u0627\u0631" + i];
        if (v) numbered.push(str(v));
      }
      options = numbered.filter(Boolean);
    }
    // خيارات بصيغة a, b, c, d
    if (!options.length) {
      const letters = ["a", "b", "c", "d", "e", "f"];
      const lettered = [];
      letters.forEach(function (L) {
        if (raw[L] !== undefined) lettered.push(str(raw[L]));
        if (raw[L.toUpperCase()] !== undefined) lettered.push(str(raw[L.toUpperCase()]));
      });
      if (lettered.length) options = lettered.filter(Boolean);
    }

    // استخراج الإجابة
    let answer = raw.answer;
    if (answer === undefined) answer = raw.correct;
    if (answer === undefined) answer = raw.correctAnswer;
    if (answer === undefined) answer = raw.correct_answer;
    if (answer === undefined) answer = raw.right;
    if (answer === undefined) answer = raw.solution;
    if (answer === undefined) answer = raw["\u0627\u0644\u0625\u062c\u0627\u0628\u0629"];
    if (answer === undefined) answer = raw["\u0627\u0644\u062c\u0648\u0627\u0628"];

    // إذا كان كائن الإجابة {value, text, ...} نستخرج القيمة
    if (answer && typeof answer === "object" && !Array.isArray(answer)) {
      answer = answer.value !== undefined ? answer.value :
        answer.text !== undefined ? answer.text :
          answer.answer !== undefined ? answer.answer : "";
    }

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
        answer = resolveMcqAnswer(answer, options);
      }
    } else {
      answer = Array.isArray(answer) ? answer.join(" | ") : str(answer);
    }

    // نقاط
    let points = Number(raw.points) || Number(raw.score) || Number(raw.marks) ||
      Number(raw["\u062f\u0631\u062c\u0629"]) || 1;
    if (points <= 0) points = 1;

    return {
      type: type,
      text: text,
      options: options,
      answer: answer,
      difficulty: normDifficulty(raw.difficulty || raw.level || raw["\u0627\u0644\u0645\u0633\u062a\u0648\u0649"]),
      tags: toList(raw.tags || raw["\u0648\u0633\u0648\u0645"]),
      explanation: str(raw.explanation || raw["\u0627\u0644\u0634\u0631\u062d"] || raw["\u062a\u0639\u0644\u064a\u0644"]),
      points: points
    };
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

  /* ============================================================
   * من CSV
   * ============================================================ */
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

  /* ============================================================
   * من نص / قالب
   * ============================================================ */
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

  /* ============================================================
   * محرك JSON متعدد الترتيبات
   * ============================================================ */

  // البحث العميق عن مصفوفات الأسئلة داخل أي كائن
  function deepFindQuestions(obj, out, depth) {
    if (!obj || depth > 10) return;
    if (Array.isArray(obj)) {
      // هل هذه مصفوفة أسئلة؟
      const looksLikeQuestions = obj.length > 0 && obj.every(function (item) {
        return item && typeof item === "object" && !Array.isArray(item) &&
          (item.text || item.question || item.q || item.title ||
            item.question_text || item.qtext ||
            item["\u0633\u0624\u0627\u0644"] || item["\u0627\u0644\u0633\u0624\u0627\u0644"]);
      });
      if (looksLikeQuestions) {
        obj.forEach(function (item) {
          const q = normalizeQuestion(item);
          if (q) out.push(q);
        });
        return;
      }
      // مصفوفة عامة - ابحث بداخلها
      obj.forEach(function (item) { deepFindQuestions(item, out, depth + 1); });
      return;
    }
    if (typeof obj === "object") {
      // هل هذا سؤال مباشر؟
      const isQuestion = obj.text || obj.question || obj.q || obj.title ||
        obj.question_text || obj.qtext ||
        obj["\u0633\u0624\u0627\u0644"] || obj["\u0627\u0644\u0633\u0624\u0627\u0644"];
      if (isQuestion && !Array.isArray(obj)) {
        // نتأكد أنه ليس كائناً يحتوي فقط بيانات وصفية
        const hasContent = isQuestion && (
          obj.answer !== undefined || obj.correct !== undefined ||
          obj.options !== undefined || obj.choices !== undefined ||
          obj.type !== undefined || obj.question_type !== undefined
        );
        if (hasContent) {
          const q = normalizeQuestion(obj);
          if (q) out.push(q);
          return;
        }
      }
      // ابحث في كل القيم
      Object.keys(obj).forEach(function (key) {
        const val = obj[key];
        if (val && typeof val === "object") {
          deepFindQuestions(val, out, depth + 1);
        }
      });
    }
  }

  // الشكل 1: مصفوفة أسئلة مباشرة
  function parseArrayOfQuestions(arr) {
    const out = [];
    arr.forEach(function (item) {
      const q = normalizeQuestion(item);
      if (q) out.push(q);
    });
    return out;
  }

  // الشكل 2: كائن يحتوي units
  function parseUnitsFormat(obj) {
    const out = [];
    const units = obj.units || obj.Units || obj["\u0627\u0644\u0648\u062d\u062f\u0627\u062a"] || [];
    if (!Array.isArray(units)) return out;

    units.forEach(function (u) {
      if (!u) return;
      const unitTitle = str(u.unit_title || u.title || u.name || u["\u0639\u0646\u0648\u0627\u0646"]);
      const unitNum = u.unit_number || u.number || u.unit_no;

      // أسئلة مباشرة داخل الوحدة
      const directQuestions = u.questions || u["\u0627\u0644\u0623\u0633\u0626\u0644\u0629"] || [];
      if (Array.isArray(directQuestions)) {
        directQuestions.forEach(function (q) {
          const nq = normalizeQuestion(q);
          if (nq) {
            if (unitTitle && nq.tags.indexOf(unitTitle) < 0) nq.tags.push(unitTitle);
            out.push(nq);
          }
        });
      }

      // دروس داخل الوحدة
      const lessons = u.lessons || u["\u0627\u0644\u062f\u0631\u0648\u0633"] || [];
      if (Array.isArray(lessons)) {
        lessons.forEach(function (l) {
          if (!l) return;
          const lessonTitle = str(l.lesson_title || l.title || l.name || l["\u0639\u0646\u0648\u0627\u0646"]);
          const lessonQ = l.questions || l["\u0627\u0644\u0623\u0633\u0626\u0644\u0629"] || [];
          if (Array.isArray(lessonQ)) {
            lessonQ.forEach(function (q) {
              const nq = normalizeQuestion(q);
              if (nq) {
                if (unitTitle && nq.tags.indexOf(unitTitle) < 0) nq.tags.push(unitTitle);
                if (lessonTitle && nq.tags.indexOf(lessonTitle) < 0) nq.tags.push(lessonTitle);
                out.push(nq);
              }
            });
          }
        });
      }
    });
    return out;
  }

  // الشكل 3: كائن يحتوي questions مباشرة
  function parseQuestionsFormat(obj) {
    const out = [];
    const questions = obj.questions || obj.data || obj.items || obj["\u0627\u0644\u0623\u0633\u0626\u0644\u0629"];
    if (Array.isArray(questions)) {
      questions.forEach(function (q) {
        const nq = normalizeQuestion(q);
        if (nq) out.push(nq);
      });
    }
    return out;
  }

  // الشكل 4: كائن يحتوي subjects → units → lessons → questions
  function parseSubjectsFormat(obj) {
    const out = [];
    const subjects = obj.subjects || obj.courses || obj["\u0627\u0644\u0645\u0648\u0627\u062f"];
    if (!Array.isArray(subjects)) return out;

    subjects.forEach(function (s) {
      if (!s) return;
      const subjectTitle = str(s.title || s.name || s.subject || s["\u0627\u0644\u0645\u0627\u062f\u0629"]);

      // أسئلة مباشرة
      const directQ = s.questions || s["\u0627\u0644\u0623\u0633\u0626\u0644\u0629"] || [];
      if (Array.isArray(directQ)) {
        directQ.forEach(function (q) {
          const nq = normalizeQuestion(q);
          if (nq) {
            if (subjectTitle) nq.tags.push(subjectTitle);
            out.push(nq);
          }
        });
      }

      // وحدات
      const units = s.units || s["\u0627\u0644\u0648\u062d\u062f\u0627\u062a"] || [];
      if (Array.isArray(units)) {
        units.forEach(function (u) {
          if (!u) return;
          const unitTitle = str(u.title || u.name || u["\u0639\u0646\u0648\u0627\u0646"]);
          const uQ = u.questions || [];
          if (Array.isArray(uQ)) {
            uQ.forEach(function (q) {
              const nq = normalizeQuestion(q);
              if (nq) {
                if (subjectTitle) nq.tags.push(subjectTitle);
                if (unitTitle) nq.tags.push(unitTitle);
                out.push(nq);
              }
            });
          }
          const lessons = u.lessons || [];
          if (Array.isArray(lessons)) {
            lessons.forEach(function (l) {
              if (!l) return;
              const lessonTitle = str(l.title || l.name || l["\u0639\u0646\u0648\u0627\u0646"]);
              const lQ = l.questions || [];
              if (Array.isArray(lQ)) {
                lQ.forEach(function (q) {
                  const nq = normalizeQuestion(q);
                  if (nq) {
                    if (subjectTitle) nq.tags.push(subjectTitle);
                    if (unitTitle) nq.tags.push(unitTitle);
                    if (lessonTitle) nq.tags.push(lessonTitle);
                    out.push(nq);
                  }
                });
              }
            });
          }
        });
      }
    });
    return out;
  }

  // الشكل 5: كائن يحتوي grades → subjects
  function parseGradesFormat(obj) {
    const out = [];
    const grades = obj.grades || obj.levels || obj["\u0627\u0644\u0635\u0641\u0648\u0641"];
    if (!Array.isArray(grades)) return out;
    grades.forEach(function (g) {
      const res = parseSubjectsFormat(g);
      res.forEach(function (q) { out.push(q); });
    });
    return out;
  }

  // الشكل 6: مصفوفة وحدات (بدون مفتاح units)
  function parseArrayOfUnits(arr) {
    const out = [];
    arr.forEach(function (u) {
      if (!u || typeof u !== "object") return;
      const unitTitle = str(u.unit_title || u.title || u.name);
      const questions = u.questions || [];
      if (Array.isArray(questions)) {
        questions.forEach(function (q) {
          const nq = normalizeQuestion(q);
          if (nq) {
            if (unitTitle) nq.tags.push(unitTitle);
            out.push(nq);
          }
        });
      }
      const lessons = u.lessons || [];
      if (Array.isArray(lessons)) {
        lessons.forEach(function (l) {
          const lessonTitle = str(l.lesson_title || l.title || l.name);
          const lQ = l.questions || [];
          if (Array.isArray(lQ)) {
            lQ.forEach(function (q) {
              const nq = normalizeQuestion(q);
              if (nq) {
                if (unitTitle) nq.tags.push(unitTitle);
                if (lessonTitle) nq.tags.push(lessonTitle);
                out.push(nq);
              }
            });
          }
        });
      }
    });
    return out;
  }

  /* ============================================================
   * fromJSON - يجرّب كل الأشكال المعروفة
   * ============================================================ */
  function fromJSON(obj) {
    if (!obj) return [];

    let out = [];

    // الشكل 1: مصفوفة
    if (Array.isArray(obj)) {
      // 1a: مصفوفة أسئلة مباشرة
      out = parseArrayOfQuestions(obj);
      if (out.length) return out;

      // 1b: مصفوفة وحدات
      out = parseArrayOfUnits(obj);
      if (out.length) return out;

      // 1c: بحث عميق
      const deep = [];
      deepFindQuestions(obj, deep, 0);
      return deep;
    }

    // الشكل 2: كائن
    if (typeof obj === "object") {
      // 2a: units
      out = parseUnitsFormat(obj);
      if (out.length) return out;

      // 2b: questions
      out = parseQuestionsFormat(obj);
      if (out.length) return out;

      // 2c: subjects
      out = parseSubjectsFormat(obj);
      if (out.length) return out;

      // 2d: grades
      out = parseGradesFormat(obj);
      if (out.length) return out;

      // 2e: كائن واحد يمثل سؤالاً
      const single = normalizeQuestion(obj);
      if (single) return [single];

      // 2f: بحث عميق في كل الحقول
      const deep = [];
      deepFindQuestions(obj, deep, 0);
      return deep;
    }

    return [];
  }

  /* ============================================================
   * الواجهة العامة
   * ============================================================ */
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
            errors.push("\u062a\u0645 \u062a\u062d\u0644\u064a\u0644 JSON \u0628\u0646\u062c\u0627\u062d \u0644\u0643\u0646 \u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0623\u0633\u0626\u0644\u0629. \u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0628\u0646\u064a\u0629.");
          }
        } else if (f === "csv") {
          questions = fromCSV(text);
        } else {
          questions = fromText(text);
        }
      } catch (e) {
        return { questions: [], errors: ["\u062e\u0637\u0623 \u0641\u064a \u0627\u0644\u062a\u062d\u0644\u064a\u0644: " + e.message], format: f };
      }

      questions.forEach(function (q, i) {
        if (!q) return;
        const errs = validate(q);
        q._row = i + 1;
        q._errors = errs;
        errs.forEach(function (e) { errors.push("\u0633\u0637\u0631 " + (i + 1) + ": " + e); });
      });

      // فلترة أي null
      questions = questions.filter(function (q) { return q && q.text; });

      return { questions: questions, errors: errors, format: f };
    },
    normalizeQuestion: normalizeQuestion,
    validate: validate,
    fromJSON: fromJSON,
    fromCSV: fromCSV,
    fromText: fromText
  };

  QP.importer = importer;
})();