/* استيراد دفعات النماذج الامتحانية (صيغة JSON مشتركة) */
(function () {
  "use strict";
  const QP = window.QP, U = QP.utils, S = QP.store;
  const root = document.getElementById("import-view");
  const esc = U.esc;
  const byId = id => document.getElementById(id);
  const FAMILY = "arabic-exam-models";
  const SECTIONS = [
    ["section1_language_thought_emotion", "فهم وتحليل"],
    ["section2_art_structure_grammar", "قواعد ولغة"],
    ["section3_reading_and_study", "منهج ومطالعة"]
  ];
  const SECTION4 = "section4_expression";
  let exams = [], subjects = [], batches = [];

  function msg(text, kind) { if (U.toast) U.toast(text, kind || "info", 5000); else alert(text); }
  function session() { return sessionStorage.getItem("qp_admin") === "1"; }
  function safeKey(text) { return String(text || "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "exam-models"; }
  function batchKey(name, meta) { return safeKey((meta && meta.batchKey) || name.replace(/\.json$/i, "")); }
  function durationToMinutes(value) {
    const t = String(value || "");
    if (t.indexOf("نصف") >= 0 && (t.indexOf("ساعت") >= 0 || t.indexOf("ساعتين") >= 0)) return 150;
    if (t.indexOf("ساعتين") >= 0 || t.indexOf("ساعتان") >= 0) return 120;
    let m = t.match(/(\d+)\s*ساعة/); if (m) return Number(m[1]) * 60;
    m = t.match(/(\d+)\s*دقيقة/); if (m) return Number(m[1]);
    return 150;
  }
  function buildPassage(model, section) {
    const mp = model.main_passage || {};
    const poem = String(mp.poem || "");
    const poet = String(mp.poet || "");
    let text = String(mp.instruction || "").trim();
    const notes = [];
    if (poem) notes.push("القصيدة: " + poem);
    if (poet) notes.push("الشاعر: " + poet);
    if (mp.unit !== undefined && mp.unit !== null && mp.unit !== "") notes.push("الوحدة " + mp.unit);
    if (mp.book_pages) notes.push("ص" + mp.book_pages);
    if (mp.verses) notes.push("الأبيات " + mp.verses);
    const ref = String((section || {}).passage_ref || "").trim();
    if (ref) text = (text + "\n\nنص القراءة والمطالعة: " + ref).trim();
    return { title: poem ? "النص المرافق — " + poem : "النص المرافق", text, notes: notes.join(" | ") };
  }
  function appQuestion(q, sectionLabel, passage, modelNo, key) {
    let text = String(q.question || "").trim();
    let answer = String(q.answer || "").trim();
    const parts = Array.isArray(q.parts) ? q.parts : [];
    if (parts.length) {
      const itemLines = [], answerLines = [];
      if (answer) answerLines.push(answer);
      parts.forEach(p => {
        const item = String(p.item || "").trim();
        const ans = String(p.answer || "").trim();
        if (item) { itemLines.push("• " + item); answerLines.push(item + ": " + ans); }
      });
      if (itemLines.length) text += "\n" + itemLines.join("\n");
      answer = answerLines.join("\n");
    }
    return {
      id: "arabic-m" + modelNo + "-" + key + "-" + (q.no !== undefined ? q.no : Math.random().toString(36).slice(2, 8)),
      type: "essay",
      text, answer,
      points: Number(q.marks) || 1,
      section: sectionLabel,
      passage: passage,
      explanation: "",
      tags: ["نموذج امتحاني", "اللغة العربية"],
      modelNo: modelNo,
      originalNo: q.no
    };
  }
  function chooseOption(options, strategy, modelNo) {
    if (!options || !options.length) return { option: null, index: 0 };
    let idx = 0;
    if (strategy === "second") idx = 1;
    else if (strategy === "even") idx = (modelNo % 2 === 0) ? 0 : 1;
    else idx = (modelNo % 2 === 1) ? 1 : 0; // odd
    idx = Math.min(Math.max(idx, 0), options.length - 1);
    return { option: options[idx], index: idx };
  }
  function modelToExam(model, meta, fileName, batch, status, strategy, subject) {
    const modelNo = Number(model.model_no) || 0;
    const questions = [];
    SECTIONS.forEach(function (entry) {
      const key = entry[0], label = entry[1];
      const section = model[key] || {};
      const passage = buildPassage(model, section);
      (section.questions || []).forEach(q => questions.push(appQuestion(q, label, passage, modelNo, key)));
    });

    const sec4 = model[SECTION4] || {};
    const passage4 = buildPassage(model, sec4);
    const compulsory = sec4.compulsory || {};
    const expected = Array.isArray(compulsory.expected_points) ? compulsory.expected_points : [];
    questions.push({
      id: "arabic-m" + modelNo + "-expression-compulsory",
      type: "essay",
      text: String(compulsory.question || "").trim(),
      answer: "نقاط الإجابة المتوقعة:\n" + expected.map(p => "- " + p).join("\n"),
      points: Number(compulsory.marks) || 10,
      section: "إبداعي",
      passage: passage4,
      explanation: "",
      tags: ["نموذج امتحاني", "التعبير"],
      modelNo: modelNo,
      originalNo: "compulsory"
    });

    const optional = sec4.optional || {};
    const options = Array.isArray(optional.options) ? optional.options : [];
    const chosen = chooseOption(options, strategy, modelNo);
    if (chosen.option) {
      questions.push({
        id: "arabic-m" + modelNo + "-expression-option-" + (chosen.index + 1),
        type: "essay",
        text: String(chosen.option.question || "").trim(),
        answer: String(chosen.option.expected_answer || "").trim(),
        points: Number(chosen.option.marks) || Number(optional.marks) || 6,
        section: "إبداعي",
        passage: passage4,
        explanation: "",
        tags: ["نموذج امتحاني", "التعبير"],
        modelNo: modelNo,
        originalNo: "option-" + (chosen.index + 1)
      });
    }

    const note = "السؤال الاختياري في قسم التعبير: " +
      (chosen.option ? "تم اختيار الخيار رقم " + (chosen.index + 1) + " تلقائياً." : "لا يوجد خيار اختياري.") +
      " الخيارات كلها محفوظة في إعدادات النموذج.";
    const description = [String((meta && meta.description) || "نموذج امتحاني مستورد"),
      String((meta && meta.note) || ""), note].filter(Boolean).join("\n").slice(0, 1400);

    return {
      title: String(model.title || ("نموذج " + modelNo)),
      subjectId: subject.id,
      subjectName: subject.name,
      description: description,
      durationMin: durationToMinutes(model.duration),
      settings: {
        batchKey: batch,
        sourceFile: fileName,
        sourceMeta: meta || {},
        sourceModel: model,
        expressionOptions: options,
        optionalStrategy: strategy,
        chosenOptionIndex: chosen.index,
        gradeMode: "manual"
      },
      questions: questions,
      totalPoints: questions.reduce((s, q) => s + (Number(q.points) || 0), 0),
      status: status,
      targetGroups: ["ALL"],
      autoGenerated: false,
      modelFamily: FAMILY,
      isApproved: status === "published",
      templateKey: batch + "-model-" + modelNo,
      templateName: String(model.title || ("نموذج " + modelNo)),
      filterCriteria: {
        source: "json-exam-models-importer",
        batchKey: batch,
        modelNo: modelNo,
        mainPassage: model.main_passage || {}
      },
      versionNo: 1,
      versionStatus: status
    };
  }

  function validate(payload, name) {
    if (!payload || typeof payload !== "object") throw Error(name + ": الملف ليس كائناً JSON");
    if (!payload.meta || typeof payload.meta !== "object") throw Error(name + ": يفتقد إلى meta");
    if (!Array.isArray(payload.models) || !payload.models.length) throw Error(name + ": يفتقد إلى مصفوفة models");
    payload.models.forEach((m, i) => {
      if (!m || !m.model_no) throw Error(name + ": نموذج رقم " + (i + 1) + " بلا model_no");
      if (!m.title) throw Error(name + ": نموذج " + m.model_no + " بلا title");
      const total = SECTIONS.reduce((s, e) => s + (Number((m[e[0]] || {}).marks) || 0), 0) +
        Number((m[SECTION4] || {}).marks || 0);
      if (Number(payload.meta.marks_per_model) && total !== Number(payload.meta.marks_per_model)) {
        throw Error(name + ": مجموع درجات النموذج " + m.model_no + " = " + total + " وليس " + payload.meta.marks_per_model);
      }
    });
    return payload;
  }

  function addBatch(text, name) {
    let payload;
    try { payload = JSON.parse(text); } catch (e) { throw Error(name + ": JSON غير صالح — " + e.message); }
    validate(payload, name);
    const key = batchKey(name, payload.meta);
    batches = batches.filter(b => b.key !== key);
    batches.push({ name, key, payload, meta: payload.meta, models: payload.models });
  }

  async function ensureSubject(name) {
    name = String(name || "اللغة العربية").trim();
    const found = subjects.find(s => String(s.name || "").trim() === name);
    if (found) return found;
    const ref = await QP.db.collection("subjects").add({
      name: name,
      description: "نماذج امتحانية مستوردة — " + name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    const subject = { id: ref.id, name: name, description: "نماذج امتحانية مستوردة — " + name };
    subjects.push(subject);
    return subject;
  }

  async function refresh() {
    const data = await Promise.all([S.listExams(), S.listSubjects()]);
    exams = data[0]; subjects = data[1];
    renderImported();
  }

  function statusBadge(e) {
    if (e.status === "published" && e.isApproved) return '<span class="badge badge-success">منشور ومعتمد</span>';
    if (e.status === "archived") return '<span class="badge badge-muted">مؤرشف</span>';
    return '<span class="badge badge-warning">مسودة — لا تظهر للطالب</span>';
  }

  function renderImported() {
    const box = byId("importedList");
    if (!box) return;
    const list = exams.filter(e => e.modelFamily === FAMILY);
    const groups = {};
    list.forEach(e => {
      const key = (e.settings && e.settings.batchKey) || "?";
      (groups[key] = groups[key] || []).push(e);
    });
    const keys = Object.keys(groups).sort();
    if (!keys.length) {
      box.innerHTML = '<div class="empty-state"><div class="emoji">📥</div><h3>لا توجد نماذج مستوردة بعد</h3><p>استورد ملف JSON أولاً من الأعلى.</p></div>';
      return;
    }
    box.innerHTML = keys.map(key => {
      const items = groups[key].slice().sort((a, b) => (a.filterCriteria && a.filterCriteria.modelNo || 0) - (b.filterCriteria && b.filterCriteria.modelNo || 0));
      const published = items.filter(e => e.status === "published" && e.isApproved).length;
      return '<div class="card mb-sm"><div class="card-head"><div><h3>' + esc(key) + '</h3>' +
        '<p class="tiny muted">' + items.length + ' نموذج · ' + published + ' منشور</p></div></div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>النموذج</th><th>الكود</th><th>الدرجات</th><th>الأسئلة</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>' +
        items.map(e => '<tr><td>' + esc(e.title) + '</td><td><code>' + esc(e.code || "-") + '</code></td>' +
          '<td>' + (e.totalPoints || 0) + '</td><td>' + ((e.questions || []).length) + '</td><td>' + statusBadge(e) + '</td>' +
          '<td>' + ((e.status === "published" && e.isApproved)
            ? '<button class="btn btn-sm" data-archive="' + esc(e.id) + '">أرشفة</button>'
            : '<button class="btn btn-primary btn-sm" data-publish="' + esc(e.id) + '">اعتماد ونشر</button>') + '</td></tr>').join("") +
        '</tbody></table></div></div>';
    }).join("");
    box.querySelectorAll("[data-publish]").forEach(b => b.addEventListener("click", async () => {
      if (!confirm("سيظهر هذا النموذج للطلاب بعد النشر. متابعة؟")) return;
      b.disabled = true;
      try { await S.updateExam(b.dataset.publish, { status: "published", isApproved: true }); msg("تم النشر", "success"); await refresh(); }
      catch (e) { msg(e.message, "error"); b.disabled = false; }
    }));
    box.querySelectorAll("[data-archive]").forEach(b => b.addEventListener("click", async () => {
      try { await S.updateExam(b.dataset.archive, { status: "archived", isApproved: false }); msg("تمت الأرشفة", "success"); await refresh(); }
      catch (e) { msg(e.message, "error"); }
    }));
  }

  function renderPreview() {
    const box = byId("batchPreview");
    if (!box) return;
    if (!batches.length) { box.innerHTML = '<p class="muted">لم تُضف أي ملف بعد.</p>'; return; }
    box.innerHTML = batches.map(b => '<div class="card mb-sm"><div class="flex flex-wrap" style="justify-content:space-between;gap:8px"><div>' +
      '<b>' + esc(b.name) + '</b><div class="tiny muted">' + esc(b.key) + ' · ' + b.models.length + ' نموذج · ' +
      esc(b.meta.grade || "-") + ' · ' + esc(b.meta.marks_per_model || 40) + ' درجة</div></div>' +
      '<button class="btn btn-sm" data-remove="' + esc(b.key) + '">إزالة</button></div>' +
      '<div class="tiny muted">' + esc(String(b.meta.description || "").slice(0, 180)) + '</div></div>').join("");
    box.querySelectorAll("[data-remove]").forEach(b => b.addEventListener("click", () => {
      batches = batches.filter(x => x.key !== b.dataset.remove); renderPreview();
    }));
  }

  async function doImport(publish) {
    if (!batches.length) return msg("أضف ملف JSON أولاً", "warn");
    const subject = await ensureSubject(byId("subjectName").value);
    const strategy = byId("optionalStrategy").value;
    const status = publish ? "published" : "draft";
    const btn = byId(publish ? "importPublish" : "importDraft");
    btn.disabled = true;
    let created = 0, updated = 0, skipped = 0;
    try {
      for (const b of batches) {
        for (const model of b.models) {
          const payload = modelToExam(model, b.meta, b.name, b.key, status, strategy, subject);
          const existing = exams.find(e => e.templateKey === payload.templateKey);
          if (existing) {
            let subs = 0;
            try { subs = await S.countSubmissionsByExam(existing.id); } catch (e) { subs = 0; }
            if (subs > 0) { skipped++; continue; }
            await S.updateExam(existing.id, payload); updated++;
          } else {
            await S.createExam(payload); created++;
          }
        }
      }
      msg("تم الاستيراد: " + created + " جديد، " + updated + " محدّث، " + skipped + " تخطي", "success", 7000);
      batches = []; renderPreview(); await refresh();
    } catch (e) {
      msg("توقف الاستيراد: " + e.message, "error", 8000);
    } finally { btn.disabled = false; }
  }

  function render() {
    root.innerHTML = '<div class="container container-narrow">' +
      '<div class="card-head"><div><h1>📥 استيراد نماذج امتحانية</h1>' +
      '<p class="muted">استورد دفعة JSON واحدة أو أكثر بالنموذج المشترك.تبقى النماذج مسودات حتى تعتمدها وتنشرها من الأسفل.</p></div>' +
      '<div class="flex flex-wrap" style="gap:6px"><a class="btn btn-sm" href="admin.html#/dashboard">اللوحة</a>' +
      '<button class="btn btn-sm" id="refreshBtn">تحديث</button></div></div>' +

      '<div class="card mb"><h3>1) اختر الملفات أو الصق JSON</h3>' +
      '<div class="form-row"><div class="field"><label>ملفات JSON (يمكن اختيار أكثر من ملف)</label>' +
      '<input type="file" id="fileInput" accept=".json,application/json" multiple></div>' +
      '<div class="field"><label>اسم المادة</label><input id="subjectName" value="اللغة العربية"></div></div>' +
      '<div class="field"><label>الصق محتوى ملف JSON (اختياري)</label>' +
      '<textarea id="pasteJson" rows="5" placeholder=\'{"meta":{...},"models":[...]}\'></textarea></div>' +
      '<div class="form-row"><div class="field"><label>السؤال الاختياري في التعبير</label>' +
      '<select id="optionalStrategy"><option value="odd">بالتبادل حسب رقم النموذج (فردي/زوجي)</option>' +
      '<option value="first">دائماً الخيار الأول</option><option value="second">دائماً الخيار الثاني</option></select></div>' +
      '<div class="field" style="display:flex;align-items:end;gap:8px;flex-wrap:wrap">' +
      '<button class="btn" id="addPaste">إضافة JSON الملصق</button>' +
      '<button class="btn btn-primary" id="importDraft">حفظ كمسودات</button>' +
      '<button class="btn btn-success" id="importPublish">حفظ ونشر مباشر</button></div></div>' +
      '<p class="help">كل ملف يُعامل كدفعة مستقلة؛ إعادة استيراد نفس الملف تُحدّث النماذج الموجودة بدل تكرارها، ما لم يكن الطلاب قد سلموا فيها.</p>' +
      '</div>' +

      '<div class="card mb"><div class="card-head"><h3>2) معاينة الدفعات المضافة</h3></div><div id="batchPreview"></div></div>' +
      '<div class="card"><div class="card-head"><h3>3) النماذج المستوردة</h3></div><div id="importedList">' + U.loaderHTML() + '</div></div>' +
      '</div>';

    byId("fileInput").addEventListener("change", async function () {
      for (const file of Array.from(this.files || [])) {
        try { addBatch(await file.text(), file.name); msg("تمت إضافة " + file.name, "success"); }
        catch (e) { msg(e.message, "error", 8000); }
      }
      this.value = ""; renderPreview();
    });
    byId("addPaste").addEventListener("click", function () {
      try { addBatch(byId("pasteJson").value, "paste-" + Date.now() + ".json"); byId("pasteJson").value = ""; msg("تمت إضافة JSON", "success"); renderPreview(); }
      catch (e) { msg(e.message, "error", 8000); }
    });
    byId("importDraft").addEventListener("click", () => doImport(false));
    byId("importPublish").addEventListener("click", () => { if (confirm("سيتم نشر النماذج للطلاب مباشرة. متابعة؟")) doImport(true); });
    byId("refreshBtn").addEventListener("click", refresh);
    renderPreview(); renderImported();
  }

  async function init() {
    if (!session()) {
      root.innerHTML = '<div class="container container-narrow"><div class="card empty-state"><h2>يجب تسجيل الدخول كمدير</h2><a class="btn btn-primary" href="admin.html">فتح لوحة المدير</a></div></div>';
      return;
    }
    root.innerHTML = '<div class="container container-narrow">' + U.loaderHTML() + '</div>';
    try { await refresh(); render(); }
    catch (e) { root.innerHTML = '<div class="container container-narrow"><div class="card"><h3>تعذر تحميل البيانات</h3><p>' + esc(e.message) + '</p></div></div>'; }
  }
  init();
})();
