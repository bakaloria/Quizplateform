/* utils.js - نسخة موسّعة مع أدوات جديدة */
(function () {
  const QP = window.QP;

  const TYPE_LABELS = {
    mcq: "اختيار من متعدد",
    multi: "اختيار متعدد",
    true_false: "صح أو خطأ",
    fill_blank: "أكمل الفراغ",
    short_answer: "إجابة قصيرة",
    essay: "مقالي",
    matching: "مطابقة/توصيل",
    ordering: "ترتيب",
    classification: "تصنيف",
    comparison: "جدول مقارنة",
    diagram_label: "تسمية الرسم",
    image_mcq: "سؤال على صورة"
  };

  /* الأنماط التي تعتمد على الصور (تحتاج حقل image) */
  const IMAGE_TYPES = ["diagram_label", "image_mcq"];
  /* الأنماط التفاعلية الجديدة */
  const NEW_TYPES = ["matching", "ordering", "classification", "comparison", "diagram_label", "image_mcq"];

  const SUBMISSION_STATUS = {
    pending: "قيد التصحيح",
    in_review: "قيد المراجعة",
    graded: "تم التصحيح"
  };

  /* أقسام النموذج الوزاري (تستنتج من الوسوم) */
  const SECTION_ORDER = ["فهم وتحليل", "مستوى فني", "قواعد ولغة", "منهج ومطالعة", "إبداعي"];
  const SECTION_TARGETS = {
    "فهم وتحليل": 13,
    "مستوى فني": 5,
    "قواعد ولغة": 7,
    "منهج ومطالعة": 2,
    "إبداعي": 2
  };

  function _str(v) { return v === null || v === undefined ? "" : String(v).trim(); }

  const utils = {
    TYPE_LABELS: TYPE_LABELS,
    IMAGE_TYPES: IMAGE_TYPES,
    NEW_TYPES: NEW_TYPES,
    SUBMISSION_STATUS: SUBMISSION_STATUS,
    SECTION_ORDER: SECTION_ORDER,
    SECTION_TARGETS: SECTION_TARGETS,

    esc: function (s) {
      if (s === null || s === undefined) return "";
      return String(s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    },

    uid: function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9); },

    code: function (len) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let s = "";
      for (let i = 0; i < (len || 6); i++) s += chars[Math.floor(Math.random() * chars.length)];
      return s;
    },

    /* توليد كلمة مرور عشوائية: 6 أحرف + رقمان */
    generateStudentPassword: function () {
      const letters = "abcdefghjkmnpqrstuvwxyz";
      const digits = "23456789";
      let pass = "";
      for (let i = 0; i < 6; i++) pass += letters[Math.floor(Math.random() * letters.length)];
      pass += digits[Math.floor(Math.random() * digits.length)];
      pass += digits[Math.floor(Math.random() * digits.length)];
      return pass;
    },

    /* التحقق من صحة كلمة مرور الطالب */
    isValidStudentPassword: function (pass) {
      if (!pass || pass.length !== 8) return false;
      const letters = pass.slice(0, 6);
      const digits = pass.slice(6);
      return /^[a-zA-Z]{6}$/.test(letters) && /^\d{2}$/.test(digits);
    },

    normalizeArabic: function (s) {
      if (s === null || s === undefined) return "";
      return String(s)
        .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
        .replace(/[إأآا]/g, "ا").replace(/ى/g, "ي")
        .replace(/ؤ/g, "و").replace(/ئ/g, "ي")
        .replace(/ة/g, "ه")
        .replace(/[^\u0621-\u064A0-9a-zA-Z]+/g, " ")
        .trim().replace(/\s+/g, " ").toLowerCase();
    },

    sameAnswer: function (a, b) {
      return utils.normalizeArabic(a) === utils.normalizeArabic(b);
    },

    acceptedAnswers: function (answer) {
      if (Array.isArray(answer)) return answer;
      if (typeof answer === "string") return answer.split("|").map(function (x) { return x.trim(); }).filter(Boolean);
      return [answer];
    },

    formatDate: function (ts) {
      if (!ts) return "—";
      let d;
      if (typeof ts === "object" && ts.toDate) d = ts.toDate();
      else if (typeof ts === "number") d = new Date(ts);
      else d = new Date(ts);
      if (isNaN(d.getTime())) return "—";
      try {
        return new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "short" }).format(d);
      } catch (e) { return d.toLocaleString(); }
    },

    formatDateOnly: function (ts) {
      if (!ts) return "—";
      let d;
      if (typeof ts === "object" && ts.toDate) d = ts.toDate();
      else d = new Date(ts);
      if (isNaN(d.getTime())) return "—";
      try {
        return new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(d);
      } catch (e) { return d.toLocaleDateString(); }
    },

    formatDuration: function (sec) {
      sec = Math.max(0, Math.floor(sec || 0));
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      const pad = function (n) { return String(n).padStart(2, "0"); };
      return (h > 0 ? pad(h) + ":" : "") + pad(m) + ":" + pad(s);
    },

    /* الوقت المتبقي حتى تاريخ معين */
    timeUntil: function (dateStr) {
      if (!dateStr) return null;
      const target = new Date(dateStr).getTime();
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) return null;
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      if (days > 0) return days + " يوم و " + hours + " ساعة";
      if (hours > 0) return hours + " ساعة و " + mins + " دقيقة";
      return mins + " دقيقة";
    },

    /* حالة الاختبار بالنسبة للطالب */
    examAvailability: function (exam) {
      const now = Date.now();
      const openAt = exam.openAt ? new Date(exam.openAt).getTime() : 0;
      const closeAt = exam.closeAt ? new Date(exam.closeAt).getTime() : 0;
      if (openAt && now < openAt) return "upcoming";
      if (closeAt && now > closeAt) return "expired";
      return "available";
    },

    pctColor: function (p) {
      if (p >= 75) return "var(--success)";
      if (p >= 50) return "var(--warning)";
      return "var(--danger)";
    },

    csvCell: function (v) {
      if (v === null || v === undefined) v = "";
      v = String(v).replace(/"/g, '""');
      return '"' + v + '"';
    },

    download: function (filename, content, mime) {
      const blob = new Blob([content], { type: (mime || "text/plain") + ";charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
    },

    copy: async function (text) {
      try {
        await navigator.clipboard.writeText(text);
        utils.toast("تم النسخ", "success");
      } catch (e) {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); utils.toast("تم النسخ", "success"); }
        catch (err) { utils.toast("تعذّر النسخ", "error"); }
        document.body.removeChild(ta);
      }
    },

    toast: function (message, kind, ms) {
      const root = document.getElementById("toast-root");
      if (!root) return;
      const t = document.createElement("div");
      t.className = "toast " + (kind || "");
      const icon = kind === "success" ? "✅" : kind === "error" ? "⛔" : kind === "warn" ? "⚠️" : "ℹ️";
      t.innerHTML = "<span>" + icon + "</span><span>" + utils.esc(message) + "</span>" +
        '<button class="toast-close" title="إغلاق">✕</button>';
      t.querySelector(".toast-close").addEventListener("click", function () { t.remove(); });
      root.appendChild(t);
      setTimeout(function () {
        if (!t.parentNode) return;
        t.style.transition = "opacity .25s, transform .25s";
        t.style.opacity = "0";
        t.style.transform = "translateX(-12px)";
        setTimeout(function () { t.remove(); }, 260);
      }, ms || 3000);
    },

    modal: function (opts) {
      const root = document.getElementById("modal-root");
      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      const size = opts.size === "lg" ? " modal-lg" : opts.size === "xl" ? " modal-xl" : "";
      backdrop.innerHTML =
        '<div class="modal' + size + '">' +
        '<div class="modal-head"><h3>' + utils.esc(opts.title || "") + '</h3>' +
        '<div class="spacer"></div>' +
        '<button class="icon-btn" data-close>✕</button></div>' +
        '<div class="modal-body">' + (opts.body || "") + "</div>" +
        (opts.footer ? '<div class="modal-foot">' + opts.footer + "</div>" : "") +
        "</div>";
      root.appendChild(backdrop);
      const close = function () { backdrop.remove(); };
      backdrop.addEventListener("click", function (e) {
        if (e.target === backdrop) close();
        if (e.target.closest("[data-close]")) close();
      });
      if (opts.onMount) opts.onMount(backdrop, close);
      return { el: backdrop, close: close };
    },

    confirm: function (message, opts) {
      opts = opts || {};
      return new Promise(function (resolve) {
        let resolved = false;
        const done = function (val) { if (!resolved) { resolved = true; resolve(val); } };
        utils.modal({
          title: opts.title || "تأكيد",
          body: '<p class="muted">' + utils.esc(message) + "</p>",
          footer:
            '<button class="btn btn-danger" data-yes>' + utils.esc(opts.yes || "تأكيد") + "</button>" +
            '<button class="btn btn-ghost" data-close>' + utils.esc(opts.no || "إلغاء") + "</button>",
          onMount: function (node, close) {
            node.querySelector("[data-yes]").addEventListener("click", function () { close(); done(true); });
            node.addEventListener("click", function (e) { if (e.target.closest("[data-close]")) done(false); });
            node.addEventListener("click", function (e) { if (e.target === node) done(false); });
          }
        });
      });
    },

    loaderHTML: function () { return '<div class="loader"></div>'; },

    badgeForType: function (type) {
      return '<span class="badge badge-muted">' + utils.esc(TYPE_LABELS[type] || type) + "</span>";
    },

    /* قسم السؤال: من حقل section أو من الوسوم */
    sectionOf: function (q) {
      if (!q) return "";
      if (q.section && SECTION_ORDER.indexOf(_str(q.section)) >= 0) return _str(q.section);
      const tags = Array.isArray(q.tags) ? q.tags : [];
      for (let i = 0; i < SECTION_ORDER.length; i++) {
        if (tags.indexOf(SECTION_ORDER[i]) >= 0) return SECTION_ORDER[i];
      }
      return "";
    },

    sectionBadge: function (q) {
      const s = utils.sectionOf(q);
      return s ? '<span class="badge badge-section">' + utils.esc(s) + "</span>" : "";
    },

    /* هل النمط يعتمد على صورة؟ */
    isImageType: function (type) { return IMAGE_TYPES.indexOf(type) >= 0; },

    /* توحيد قائمة عناصر (نصوص أو كائنات) */
    normalizeItemList: function (v) {
      if (Array.isArray(v)) return v.map(function (x) {
        if (x && typeof x === "object") return _str(x.text || x.label || x.value || x.name);
        return _str(x);
      }).filter(Boolean);
      if (typeof v === "string") return v.split(/[|\n]/).map(_str).filter(Boolean);
      return [];
    },

    /* مقارنة متتابعتين نصيّتين (ترتيب حسّاس) */
    sequenceEqual: function (a, b) {
      a = Array.isArray(a) ? a : [];
      b = Array.isArray(b) ? b : [];
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!utils.sameAnswer(a[i], b[i])) return false;
      }
      return true;
    },

    /* تجزئة نصية بسيطة (لتوليد ترتيب ثابت) */
    hashStr: function (s) {
      s = String(s || "");
      let h = 5381;
      for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
      return h;
    },

    /* خلط ثابت (نفس المدخل يعطي نفس الترتيب) */
    shuffleStable: function (seed, arr) {
      arr = (arr || []).slice();
      const h = utils.hashStr(seed);
      return arr.map(function (v, i) {
        return { v: v, k: (utils.hashStr(h + "|" + i + "|" + v) + i) >>> 0 };
      }).sort(function (a, b) { return a.k - b.k; }).map(function (x) { return x.v; });
    },

    /* النص القابل للقراءة للإجابة النموذجية حسب النوع */
    answerText: function (q) {
      if (!q) return "-";
      // كائن إجابة الطالب المحفوظ يخزّن الإجابة الصحيحة في correctAnswer، بينما السؤال الأصلي في answer
      if ((q.answer === undefined || q.answer === null) && q.correctAnswer !== undefined) {
        q = Object.assign({}, q, { answer: q.correctAnswer });
      }
      const t = q.type;
      if (t === "matching") {
        return (q.pairs || []).map(function (p) { return _str(p.left) + " ← " + _str(p.right); }).join(" ، ");
      }
      if (t === "ordering") return utils.normalizeItemList(q.items).join(" ← ") || "-";
      if (t === "classification") {
        const items = Array.isArray(q.items) ? q.items : [];
        return items.length ? items.map(function (x) { return _str(x.text) + " ← " + _str(x.category); }).join(" ، ") : "-";
      }
      if (t === "comparison") {
        const obj = (q.answer && typeof q.answer === "object") ? q.answer : {};
        const parts = [];
        (q.rows || []).forEach(function (row, r) {
          (q.blanks || []).forEach(function (c) {
            if (Array.isArray(c) && Number(c[0]) === r) {
              parts.push("ق" + (r + 1) + ": " + ((q.rows[r].values || [])[c[1]] || ""));
            }
          });
        });
        return parts.length ? parts.join(" ، ") : "-";
      }
      if (q.type === "diagram_label") {
        return (q.labels || []).map(function (l) { return (l.number || "") + ": " + (l.answer || ""); }).join(" ، ");
      }
      if (Array.isArray(q.answer)) return q.answer.join(" ، ");
      return _str(q.answer) || "-";
    },

    /* النص القابل للقراءة لإجابة الطالب حسب النوع */
    givenText: function (q, given) {
      if (given === null || given === undefined || given === "") return "-";
      const t = q ? q.type : "";
      if (t === "matching") {
        const pairs = (q.pairs || []);
        const arr = Array.isArray(given) ? given : [];
        return pairs.map(function (p, i) { return p.left + " ← " + (arr[i] || "-"); }).join(" ، ") || "-";
      }
      if (t === "ordering") return (Array.isArray(given) ? given : []).join(" ← ") || "-";
      if (t === "classification") {
        const obj = given && typeof given === "object" ? given : {};
        const keys = Object.keys(obj);
        return keys.length ? keys.map(function (k) { return k + " ← " + obj[k]; }).join(" ، ") : "-";
      }
      if (t === "comparison") {
        const obj = given && typeof given === "object" ? given : {};
        const parts = [];
        Object.keys(obj).forEach(function (r) {
          const cells = obj[r] || {};
          Object.keys(cells).forEach(function (c) { parts.push("ق" + (Number(r) + 1) + ": " + cells[c]); });
        });
        return parts.length ? parts.join(" ، ") : "-";
      }
      if (t === "diagram_label") {
        const obj = given && typeof given === "object" ? given : {};
        const keys = Object.keys(obj);
        return keys.length ? keys.map(function (k) { return k + ": " + obj[k]; }).join(" ، ") : "-";
      }
      if (Array.isArray(given)) return given.join(" ، ");
      return String(given);
    },

    /* التصحيح الآلي حسب النوع: true/false أو null (يدوي) */
    autoGrade: function (q, given) {
      if (!q) return null;
      const t = q.type;
      if (t === "mcq" || t === "true_false" || t === "image_mcq") {
        // الاختيار من متعدد: مطابقة دقيقة لنصّ الخيار (لتفادي تشابه الصيغ
        // الرياضية مثل ½kx² و kx بعد التطبيع الذي يحذف الرموز)
        if (given === "" || given === undefined || given === null) return false;
        if (given === q.answer) return true;
        // مطابقة متسامحة فقط إذا لم يتشابه أي خيار آخر مع الإجابة بعد التطبيع
        const na = utils.normalizeArabic(q.answer);
        const collide = (q.options || []).some(function (o) {
          return o !== q.answer && utils.normalizeArabic(o) === na;
        });
        if (collide) return false;
        return utils.sameAnswer(given, q.answer);
      }
      if (t === "multi") {
        const g = (given || []).slice().sort().join("|");
        const c = (Array.isArray(q.answer) ? q.answer : [q.answer]).slice().sort().join("|");
        return g !== "" && g === c;
      }
      if (t === "fill_blank" || t === "short_answer") {
        return utils.acceptedAnswers(q.answer).some(function (a) { return utils.sameAnswer(a, given); });
      }
      if (t === "matching") {
        const correct = (q.pairs || []).map(function (p) { return p.right; });
        return Array.isArray(given) && given.length > 0 && correct.length > 0 && utils.sequenceEqual(given, correct);
      }
      if (t === "ordering") {
        const correct = utils.normalizeItemList(q.items);
        return Array.isArray(given) && correct.length > 0 && utils.sequenceEqual(given, correct);
      }
      if (t === "classification" || t === "comparison" || t === "diagram_label") {
        const ans = (q.answer && typeof q.answer === "object" && !Array.isArray(q.answer)) ? q.answer : {};
        const keys = Object.keys(ans);
        const g = (given && typeof given === "object") ? given : {};
        return keys.length > 0 && keys.every(function (k) { return utils.sameAnswer(g[k], ans[k]); });
      }
      return null; // essay
    },

    /* نص/مقطع: توحيد الشكل إلى {title, text, notes} */
    normalizePassage: function (p) {
      if (!p) return null;
      if (typeof p === "string") {
        const t = p.trim();
        return t ? { title: "", text: t, notes: "" } : null;
      }
      if (typeof p !== "object" || Array.isArray(p)) return null;
      let text = p.text !== undefined ? p.text : (p.body !== undefined ? p.body : p.verses);
      let notes = p.notes !== undefined ? p.notes : p.vocab;
      if (Array.isArray(text)) text = text.map(_str).filter(Boolean).join("\n");
      if (Array.isArray(notes)) notes = notes.map(_str).filter(Boolean).join("، ");
      const out = {
        title: _str(p.title || p.name),
        text: _str(text),
        notes: _str(notes)
      };
      return (out.text || out.notes) ? out : null;
    },

    /* صندوق عرض النص (قصيدة/مقطع) */
    passageHTML: function (p, opts) {
      const pg = utils.normalizePassage(p);
      if (!pg) return "";
      opts = opts || {};
      const open = opts.open !== undefined ? !!opts.open : (pg.text.length <= 600);
      let body = pg.text
        ? '<div class="passage-text">' + utils.esc(pg.text).replace(/\n/g, "<br>") + "</div>"
        : "";
      if (pg.notes) {
        body += '<div class="passage-notes"><b>\uD83D\uDCD6 شرح المفردات:</b> ' +
          utils.esc(pg.notes) + "</div>";
      }
      return '<details class="passage-box"' + (open ? " open" : "") + ">" +
        '<summary><span class="passage-ico">\uD83D\uDCDC</span> ' +
        (pg.title ? utils.esc(pg.title) : "\u0627\u0644\u0646\u0635") + "</summary>" +
        body + "</details>";
    },

    submissionStatusBadge: function (status) {
      if (status === "pending") return '<span class="status-badge pending">⏳ بانتظار التصحيح</span>';
      if (status === "in_review") return '<span class="status-badge review">📝 قيد المراجعة</span>';
      if (status === "graded") return '<span class="status-badge graded">✅ تم التصحيح</span>';
      return '<span class="badge badge-muted">—</span>';
    },

    debounce: function (fn, wait) {
      let t;
      return function () {
        const args = arguments, ctx = this;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(ctx, args); }, wait || 300);
      };
    },

    clamp: function (n, a, b) { return Math.max(a, Math.min(b, n)); },

    sortBy: function (arr, key, dir) {
      const d = dir === "desc" ? -1 : 1;
      return arr.slice().sort(function (x, y) {
        const a = x[key], b = y[key];
        if (a === b) return 0;
        return a > b ? d : -d;
      });
    },

    setFontScale: function (scale) {
      document.documentElement.style.fontSize = (scale * 16) + "px";
      localStorage.setItem("qp_fontscale", String(scale));
    },
    getFontScale: function () { return Number(localStorage.getItem("qp_fontscale")) || 1; },

    focusFirstInput: function () {
      setTimeout(function () {
        const el = document.querySelector("input:not([type=hidden]), textarea, select");
        if (el) el.focus();
      }, 60);
    },

    logAction: function (action, details) {
      if (!QP.store || !QP.store.addAuditLog) return;
      try {
        QP.store.addAuditLog({
          action: action,
          details: details || "",
          role: document.body.dataset.app || "unknown",
          at: new Date().toISOString()
        });
      } catch (e) { }
    },

    /* قراءة صورة من ملف وتحويلها إلى DataURL مع تصغير الأبعاد (لرمز QR) */
    fileToDataURL: function (file, maxSize) {
      maxSize = maxSize || 512;
      return new Promise(function (resolve, reject) {
        if (!file) return reject(new Error("لا يوجد ملف"));
        if (file.type && file.type.indexOf("image/") !== 0) return reject(new Error("الملف ليس صورة"));
        const reader = new FileReader();
        reader.onerror = function () { reject(new Error("تعذّر قراءة الملف")); };
        reader.onload = function () {
          const img = new Image();
          img.onerror = function () { reject(new Error("تعذّر فتح الصورة")); };
          img.onload = function () {
            let w = img.width, h = img.height;
            const scale = Math.min(1, maxSize / Math.max(w, h));
            w = Math.round(w * scale); h = Math.round(h * scale);
            try {
              const canvas = document.createElement("canvas");
              canvas.width = w; canvas.height = h;
              canvas.getContext("2d").drawImage(img, 0, 0, w, h);
              resolve(canvas.toDataURL("image/png"));
            } catch (e) { resolve(reader.result); }
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    },

    /* هل الاختبار مدفوعاً؟ */
    isPaidExam: function (exam) { return !!(exam && exam.isPaid); },

    /* مبلغ الاختبار منسّقاً */
    priceLabel: function (exam) {
      if (!exam || !exam.isPaid) return "مجاني";
      const p = Number(exam.price) || 0;
      return (p > 0 ? p + " " + (exam.currency || "ل.س") : "مدفوع");
    },

    /* ============================================================
     * الدفع عبر شام كاش
     * ============================================================ */
    PAYMENT_WHATSAPP: "905375065536",
    PAYMENT_STATUS: {
      pending: "بانتظار تأكيد الدفع",
      approved: "تم تأكيد الدفع",
      rejected: "مرفوض"
    },
    paymentStatusLabel: function (s) {
      return utils.PAYMENT_STATUS[s] || s || "";
    },
    paymentStatusBadge: function (s) {
      const label = utils.paymentStatusLabel(s);
      if (s === "approved") return '<span class="badge badge-success">\u2705 ' + label + '</span>';
      if (s === "rejected") return '<span class="badge badge-danger">\u274C ' + label + '</span>';
      return '<span class="badge badge-warning">\u23F3 ' + label + '</span>';
    },
    /* رابط واتساب لإبلاغ المدير بالدفع مع تفاصيل الطالب/الاختبار */
    paymentWhatsAppLink: function (exam, student) {
      exam = exam || {}; student = student || {};
      const msg =
        "مرحباً، أنا " + (student.name || "") +
        (student.username ? " (" + student.username + ")" : "") +
        " — أُبلغكم بأنني دفعت رسوم الاختبار عبر شام كاش." +
        "\nالاختبار: " + (exam.title || "") +
        "\nالمادة: " + (exam.subjectName || "") +
        "\nالمبلغ: " + (Number(exam.price) || 0) + " " + (exam.currency || "ل.س") +
        "\nأرجو تأكيد الدفع ليتم فتح الاختبار لي.";
      return "https://wa.me/" + utils.PAYMENT_WHATSAPP + "?text=" + encodeURIComponent(msg);
    }
  };

  QP.utils = utils;
})();