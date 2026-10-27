/* إدارة نماذج الفلسفة: مسودات، اعتماد، كود، ونشر */
(function () {
  "use strict";
  const QP = window.QP, U = QP.utils, S = QP.store;
  const root = document.getElementById("models-view");
  let bank = null, templates = [], exams = [];
  const esc = U.esc;
  const byId = id => document.getElementById(id);
  const session = () => sessionStorage.getItem("qp_admin") === "1";
  function msg(text, kind) { if (U.toast) U.toast(text, kind || "info", 5000); else alert(text); }
  function safeName(x) { return String(x || "").replace(/[\\/:*?"<>|]/g, "-").slice(0, 100); }

  function allLessons(unitNos) {
    const out = [];
    (bank.units || []).forEach(u => {
      if (unitNos.indexOf(Number(u.unit_number)) < 0) return;
      (u.lessons || []).forEach(l => out.push({ unit: Number(u.unit_number), lesson: Number(l.lesson_number), title: l.lesson_title, data: l }));
    });
    return out;
  }
  function selectedUnits() { return Array.from(byId("modelUnits").selectedOptions).map(o => Number(o.value)); }
  function selectedLessons() { return Array.from(document.querySelectorAll("#modelLessons input:checked")).map(x => ({ unit: Number(x.dataset.unit), lesson: Number(x.value) })); }
  function renderLessons() {
    const units = selectedUnits(), list = allLessons(units), old = new Set(selectedLessons().map(x => x.unit + ":" + x.lesson));
    byId("modelLessons").innerHTML = list.length ? list.map(x => '<label class="check" style="display:block;margin:5px 0"><input type="checkbox" data-unit="' + x.unit + '" value="' + x.lesson + '"' + (old.has(x.unit + ":" + x.lesson) ? " checked" : "") + '> الوحدة ' + x.unit + ' — الدرس ' + x.lesson + ': ' + esc(x.title) + '</label>').join("") : '<span class="muted">اختر وحدة واحدة أو أكثر</span>';
  }
  function unitOptions() {
    return (bank.units || []).map(u => '<option value="' + u.unit_number + '">الوحدة ' + u.unit_number + ': ' + esc(u.unit_title) + '</option>').join("");
  }
  function loadJSON(path) { return fetch(path + "?v=20261027").then(r => { if (!r.ok) throw Error("تعذر تحميل " + path); return r.json(); }); }

  function cloneQuestion(q, section, points, index) {
    const x = JSON.parse(JSON.stringify(q || {}));
    x.id = "model-" + section + "-" + index + "-" + Math.random().toString(36).slice(2, 8);
    x.section = section; x.points = points;
    return x;
  }
  function poolFor(selection) {
    const out = [];
    (bank.units || []).forEach(u => {
      const us = Number(u.unit_number), wanted = selection.filter(x => x.unit === us).map(x => x.lesson);
      if (!wanted.length) return;
      (u.lessons || []).forEach(l => { if (wanted.indexOf(Number(l.lesson_number)) >= 0) (l.questions || []).forEach(q => out.push({ q, lesson: l })); });
    });
    return out;
  }
  function pick(arr, types, count, used) {
    const out = [], seen = used || new Set();
    types.forEach(type => arr.forEach(item => { if (out.length < count && item.q.type === type && !seen.has(item.q.id || item.q.question || item.q.text)) { out.push(item); seen.add(item.q.id || item.q.question || item.q.text); } }));
    if (out.length < count) arr.forEach(item => { if (out.length < count && !seen.has(item.q.id || item.q.question || item.q.text)) { out.push(item); seen.add(item.q.id || item.q.question || item.q.text); } });
    /* بعض الدروس المنفردة تحتوي أسئلة أقل من عدد فقرات النموذج الرسمي؛ نكمل الفقرات من البنك نفسه مع إبقاء النطاق صحيحًا */
    for (let i = 0; out.length < count && arr.length; i++) out.push(arr[i % arr.length]);
    return out;
  }
  function officialQuestions(selection) {
    const pool = poolFor(selection), used = new Set(), result = [];
    if (!pool.length) throw Error("لا توجد أسئلة في النطاق المحدد");
    let a = pick(pool, ["mcq", "true_false", "fill_blank", "short_answer"], 7, used);
    a.forEach((x, i) => result.push(cloneQuestion(x.q, "section1", [10,10,10,10,10,15,15][i], result.length)));
    let b = pick(pool, ["short_answer", "fill_blank", "essay", "mcq"], 5, used);
    b.forEach(x => result.push(cloneQuestion(x.q, "section2", 24, result.length)));
    let passage = pool.filter(x => x.lesson.passage && x.lesson.passage.text);
    let c = pick(passage.length ? passage : pool, ["short_answer", "essay", "true_false"], 4, used);
    c.forEach(x => result.push(cloneQuestion(x.q, "section3", 25, result.length)));
    let d = pick(pool, ["essay", "short_answer"], 1, used);
    d.forEach(x => result.push(cloneQuestion(x.q, "section4", 100, result.length)));
    return result;
  }
  function criteria(selection, type, label) {
    return { modelFamily: "philosophy-official-models", coverageType: type, label: label, selections: selection, generatedAt: new Date().toISOString() };
  }
  function labelFor(selection, type) {
    const units = Array.from(new Set(selection.map(x => x.unit))).sort((a,b)=>a-b);
    const lessons = selection.map(x => "و" + x.unit + "/د" + x.lesson).join("، ");
    const names = { one_lesson:"درس واحد", two_consecutive:"درسان متتاليان", two_nonconsecutive:"درسان غير متتاليين", three_consecutive:"ثلاثة دروس متتالية", three_nonconsecutive:"ثلاثة دروس غير متتالية", full_unit:"وحدة كاملة", multi_units:"عدة وحدات" };
    return "الفلسفة والعلوم الإنسانية | " + (names[type] || "نطاق مخصص") + " | " + (units.length ? "الوحدات " + units.join("، ") : "") + " | " + lessons;
  }
  function normalizeSelection(selection) { return selection.sort((a,b) => a.unit-b.unit || a.lesson-b.lesson); }

  async function createDraft(selection, type, customTitle, code) {
    selection = normalizeSelection(selection);
    const questions = officialQuestions(selection);
    const title = customTitle || labelFor(selection, type);
    const payload = {
      title, subjectId: "philosophy", subjectName: "الفلسفة والعلوم الإنسانية", description: "نموذج امتحاني رسمي — لا يظهر للطلاب قبل اعتماد المدير ونشره.",
      code: code || "", durationMin: 180, questions, status: "draft", isApproved: false, autoGenerated: true,
      modelFamily: "philosophy-official-models", templateKey: "manual-" + Date.now() + "-" + Math.random().toString(36).slice(2),
      templateName: title, filterCriteria: criteria(selection, type, title), targetGroups: ["ALL"], totalPoints: 400
    };
    return S.createExam(payload);
  }
  function statusLabel(e) { return e.status === "published" && e.isApproved ? '<span class="badge badge-success">منشور ومعتمد</span>' : e.status === "archived" ? '<span class="badge badge-muted">مؤرشف</span>' : '<span class="badge badge-warning">مسودة — لا تظهر للطالب</span>'; }

  function renderList() {
    const arr = exams.filter(e => e.modelFamily === "philosophy-official-models");
    const html = arr.length ? arr.map(e => '<div class="card mb-sm" data-model-row="' + esc(e.id) + '"><div class="flex flex-wrap" style="justify-content:space-between;gap:10px"><div><b>' + esc(e.title) + '</b><div class="tiny muted">الكود: <code>' + esc(e.code || "-") + '</code> · ' + (e.questions || []).length + ' سؤال · ' + statusLabel(e) + '</div></div><div class="flex flex-wrap" style="gap:6px">' + ((e.status === "published" && e.isApproved) ? '<button class="btn btn-sm" data-model-archive="' + esc(e.id) + '">أرشفة</button>' : '<button class="btn btn-primary btn-sm" data-model-publish="' + esc(e.id) + '">اعتماد ونشر</button>') + '</div></div></div>').join("") : '<div class="empty-state"><div class="emoji">📋</div><h3>لا توجد نماذج بعد</h3><p>أنشئ نموذجًا واحدًا أو أنشئ 400 مسودة للمراجعة.</p></div>';
    byId("modelList").innerHTML = html;
    document.querySelectorAll("[data-model-publish]").forEach(b => b.addEventListener("click", async () => { if (!confirm("سيظهر النموذج للطلاب بعد النشر. متابعة؟")) return; b.disabled = true; try { await S.updateExam(b.dataset.modelPublish, { status: "published", isApproved: true }); msg("تم اعتماد النموذج ونشره للطلاب", "success"); await refresh(); } catch(e) { msg(e.message, "error"); b.disabled = false; } }));
    document.querySelectorAll("[data-model-archive]").forEach(b => b.addEventListener("click", async () => { try { await S.updateExam(b.dataset.modelArchive, { status: "archived", isApproved: false }); msg("تمت أرشفة النموذج", "success"); await refresh(); } catch(e) { msg(e.message, "error"); } }));
  }
  async function refresh() { exams = await S.listExams(); renderList(); }

  function render() {
    root.innerHTML = '<div class="container container-narrow"><div class="card-head"><div><h1>📋 نماذج الفلسفة</h1><p class="muted">كل نموذج يبدأ كمسودة، ولا يظهر للطالب إلا بعد اعتماد المدير ونشره.</p></div><a class="btn btn-sm" href="admin.html#/exams">الاختبارات القديمة</a></div>' +
      '<div class="card mb"><h3>إنشاء نموذج من فلتر</h3><div class="form-row"><div class="field"><label>نوع التغطية</label><select id="modelType"><option value="one_lesson">درس واحد</option><option value="two_consecutive">درسان متتاليان</option><option value="two_nonconsecutive">درسان غير متتاليين</option><option value="three_consecutive">ثلاثة دروس متتالية</option><option value="three_nonconsecutive">ثلاثة دروس غير متتالية</option><option value="full_unit">وحدة كاملة</option><option value="multi_units">عدة وحدات</option></select></div><div class="field"><label>الوحدات (يمكن اختيار أكثر من وحدة)</label><select id="modelUnits" multiple size="5">' + unitOptions() + '</select></div></div><div class="field"><label>الدروس المشمولة</label><div id="modelLessons" class="card" style="max-height:260px;overflow:auto">اختر وحدة</div></div><div class="form-row"><div class="field"><label>اسم النموذج (اختياري)</label><input id="modelTitle" placeholder="يُولد تلقائيًا من الفلتر"></div><div class="field"><label>الكود (اختياري)</label><input id="modelCode" placeholder="مثال: PHIL-U7-001" style="text-transform:uppercase"></div></div><div class="flex flex-wrap" style="gap:8px"><button class="btn btn-primary" id="createOne">حفظ كمسودة</button><button class="btn" id="create400">إنشاء 400 مسودة متسلسلة</button></div><p class="help">الاعتماد والنشر يتمان من القائمة أدناه. الاختبارات الحالية لا تتأثر.</p></div>' +
      '<div class="card"><div class="card-head"><h3>النماذج المنشأة</h3><button class="btn btn-sm" id="refreshModels">تحديث</button></div><div id="modelList">' + U.loaderHTML() + '</div></div></div>';
    byId("modelUnits").addEventListener("change", renderLessons); byId("createOne").addEventListener("click", one); byId("create400").addEventListener("click", bulk); byId("refreshModels").addEventListener("click", refresh); renderLessons(); renderList();
  }
  async function one() { try { const s = selectedLessons(); if (!s.length) return msg("اختر درسًا واحدًا على الأقل", "warn"); const b = byId("createOne"); b.disabled = true; await createDraft(s, byId("modelType").value, byId("modelTitle").value.trim(), byId("modelCode").value.trim()); msg("تم حفظ النموذج كمسودة وبكوده الخاص", "success"); await refresh(); b.disabled = false; } catch(e) { msg(e.message, "error"); byId("createOne").disabled = false; } }
  async function bulk() {
    if (!confirm("سيتم إنشاء 400 نموذج كمسودات، ولن يظهر أي منها للطلاب قبل اعتمادك ونشره. هل تتابع؟")) return;
    const b = byId("create400"); b.disabled = true; let made = 0;
    try {
      const existing = new Set(exams.filter(e => e.modelFamily === "philosophy-official-models").map(e => e.templateKey));
      for (let i = 0; i < 400; i++) {
        const all = (bank.units || []).flatMap(u => (u.lessons || []).map(l => ({ unit: Number(u.unit_number), lesson: Number(l.lesson_number) })));
        const start = i % all.length, len = 1 + (i % 5), sel = [];
        for (let j = 0; j < len; j++) sel.push(all[(start + j * ((i % 3) + 1)) % all.length]);
        const type = len === 1 ? "one_lesson" : len === 2 ? "two_consecutive" : len === 3 ? "three_consecutive" : "multi_units";
        const key = "series-" + String(i + 1).padStart(3, "0"); if (existing.has(key)) continue;
        const questions = officialQuestions(sel); await S.createExam({ title: "فلسفة | سلسلة " + String(i + 1).padStart(3, "0") + " | " + labelFor(sel, type), subjectId: "philosophy", subjectName: "الفلسفة والعلوم الإنسانية", description: "مسودة نموذج امتحاني — يراجعها المدير قبل النشر.", durationMin: 180, questions, status: "draft", isApproved: false, autoGenerated: true, modelFamily: "philosophy-official-models", templateKey: key, templateName: key, filterCriteria: criteria(sel, type, key), targetGroups: ["ALL"] }); made++; if (i % 10 === 0) msg("تم إنشاء " + made + " من 400 مسودة", "info", 1200);
      }
      msg("اكتمل إنشاء " + made + " مسودة. راجعها ثم اعتمد ما تريد نشره.", "success", 7000); await refresh();
    } catch(e) { msg("توقف الإنشاء بعد " + made + " مسودة: " + e.message, "error"); await refresh(); } finally { b.disabled = false; }
  }
  async function init() {
    if (!session()) { root.innerHTML = '<div class="container container-narrow"><div class="card empty-state"><h2>يجب تسجيل الدخول كمدير</h2><a class="btn btn-primary" href="admin.html">فتح لوحة المدير</a></div></div>'; return; }
    root.innerHTML = '<div class="container container-narrow">' + U.loaderHTML() + '</div>';
    try { const data = await Promise.all([loadJSON("data/philosophy.json"), S.listExams()]); bank = data[0]; exams = data[1]; render(); } catch(e) { root.innerHTML = '<div class="container container-narrow"><div class="card"><h3>تعذر تحميل البيانات</h3><p>' + esc(e.message) + '</p></div></div>'; }
  }
  init();
})();
