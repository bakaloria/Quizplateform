/* utils.js - نسخة موسّعة مع أدوات جديدة */
(function () {
  const QP = window.QP;

  const TYPE_LABELS = {
    mcq: "اختيار من متعدد",
    multi: "متعدد الإجابات",
    true_false: "صح أو خطأ",
    fill_blank: "أكمل الفراغ",
    short_answer: "إجابة قصيرة",
    essay: "مقالي"
  };

  const SUBMISSION_STATUS = {
    pending: "قيد التصحيح",
    in_review: "قيد المراجعة",
    graded: "تم التصحيح"
  };

  const utils = {
    TYPE_LABELS: TYPE_LABELS,
    SUBMISSION_STATUS: SUBMISSION_STATUS,

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
            '<button class="btn btn-ghost" data-close>إلغاء</button>',
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
    }
  };

  QP.utils = utils;
})();