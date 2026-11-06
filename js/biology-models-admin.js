/* مولد نماذج علم الأحياء: اختيار الوحدة/الدرس وإنشاء نموذج */
(function () {
  "use strict";
  const QP = window.QP, U = QP.utils, S = QP.store;
  const root = document.getElementById("biology-models-view");
  let bank = null, exams = [];
  const esc = U.esc;
  const byId = id => document.getElementById(id);
  const session = () => sessionStorage.getItem("qp_admin") === "1";
  function msg(text, kind) { if (U.toast) U.toast(text, kind || "info", 5000); else alert(text); }
  function loadJSON(path) { return fetch(path + "?v=" + Date.now()).then(r => { if (!r.ok) throw Error("تعذر تحميل " + path); return r.json(); }); }

  const DEFAULT_PLAN = [
    { section: "section1", title: "اختر الإجابة الصحيحة", types: ["mcq","true_false"], count: 10, points: 10 },
    { section: "section2", title: "أجب عن الأسئلة الآتية", types: ["short_answer","fill_blank","essay","genetics_problem"], count: 4, points: 15 },
    { section: "section3", title: "سمِّ البيانات على الرسم", types: ["diagram_label","image_mcq","short_answer"], count: 1, points: 20 },
    { section: "section4", title: "مسألة وراثية", types: ["genetics_problem","essay","short_answer"], count: 1, points: 20 }
  ];

  function allLessons(unitNos) {
    const out = [];
    (bank.units || []).forEach(u => {
      if (unitNos && unitNos.length && unitNos.indexOf(Number(u.unit_number)) < 0) return;
      (u.lessons || []).forEach(l => out.push({ unit: Number(u.unit_number), unitTitle: u.unit_title, lesson: Number(l.lesson_number), title: l.lesson_title, data: l }));
    });
    return out;
  }
  function selectedUnits() { const el = byId("bioUnits"); return el ? Array.from(el.selectedOptions).map(o => Number(o.value)) : []; }
  function selectedLessons() { return Array.from(document.querySelectorAll("#bioLessons input:checked")).map(x => ({ unit: Number(x.dataset.unit), lesson: Number(x.value) })); }
  function renderLessons() {
    const units = selectedUnits(), list = allLessons(units.length ? units : null), old = new Set(selectedLessons().map(x => x.unit + ":" + x.lesson));
    byId("bioLessons").innerHTML = list.length ? list.map(x => '<label class="check" style="display:block;margin:5px 0"><input type="checkbox" data-unit="' + x.unit + '" value="' + x.lesson + '"' + (old.has(x.unit + ":" + x.lesson) ? " checked" : "") + '> الوحدة ' + x.unit + ' — الدرس ' + x.lesson + ': ' + esc(x.title) + '</label>').join("") : '<span class="muted">اختر وحدة أو اتركها فارغة لعرض كل الدروس</span>';
  }
  function unitOptions() {
    return (bank.units || []).map(u => '<option value="' + u.unit_number + '">الوحدة ' + u.unit_number + ': ' + esc(u.unit_title) + '</option>').join("");
  }
  function poolFor(selection) {
    const out = [];
    if (!selection || !selection.length) {
      (bank.units || []).forEach(u => (u.lessons || []).forEach(l => (l.questions || []).forEach(q => out.push({ q, lesson: l, unit: u }))));
      return out;
    }
    (bank.units || []).forEach(u => {
      const us = Number(u.unit_number);
      const wanted = selection.filter(x => x.unit === us).map(x => x.lesson);
      if (!wanted.length) return;
      (u.lessons || []).forEach(l => { if (wanted.indexOf(Number(l.lesson_number)) >= 0) (l.questions || []).forEach(q => out.push({ q, lesson: l, unit: u })); });
    });
    return out;
  }
  function cloneQ(q, section, points, lesson, index, sectionTitle) {
    const x = JSON.parse(JSON.stringify(q || {}));
    x.id = "bio-" + section + "-" + index + "-" + Math.random().toString(36).slice(2, 8);
    x.section = section; x.sectionTitle = sectionTitle || ""; x.points = points;
    if (lesson && lesson.passage && lesson.passage.text) x.passage = JSON.parse(JSON.stringify(lesson.passage));
    if (lesson && lesson.lesson_title) x.lessonTitle = lesson.lesson_title;
    return x;
  }
  function pick(arr, types, count, used) {
    const out = [], seen = used || new Set();
    const keyOf = q => (q.id || q.text || q.question || "") + "|" + (q.type||"");
    (types||[]).forEach(type => arr.forEach(item => { if (out.length < count && item.q.type === type && !seen.has(keyOf(item.q))) { out.push(item); seen.add(keyOf(item.q)); } }));
    if (out.length < count) arr.forEach(item => { if (out.length < count && !seen.has(keyOf(item.q))) { out.push(item); seen.add(keyOf(item.q)); } });
    for (let i = 0; out.length < count && arr.length; i++) out.push(arr[i % arr.length]);
    return out;
  }

  function readPlan() {
    const raw = (byId("bioPlan") || {}).value || "";
    if (!raw.trim()) return DEFAULT_PLAN;
    try {
      const p = JSON.parse(raw);
      if (!Array.isArray(p) || !p.length) throw Error("خطة النموذج يجب أن تكون مصفوفة JSON.");
      return p.map(function(x,i){ return { section: x.section || ("section"+(i+1)), title: x.title || ("القسم "+(i+1)), types: Array.isArray(x.types)?x.types:["mcq","short_answer"], count: Math.max(1, Number(x.count||1)), points: Math.max(0.5, Number(x.points||1)) }; });
    } catch(e) { throw Error("تعذر قراءة بنية النموذج (JSON): " + e.message); }
  }

  function buildBiologyModel(selection, opts) {
    opts = opts || {};
    const pool = poolFor(selection);
    if (!pool.length) throw Error("لا توجد أسئلة في النطاق المحدد");
    const used = new Set(), result = [];
    const plan = opts.plan || DEFAULT_PLAN;
    plan.forEach(p => {
      pick(pool, p.types, p.count, used).forEach((x,i) => result.push(cloneQ(x.q, p.section, p.points, x.lesson, result.length, p.title)));
    });
    return result;
  }

  function labelFor(selection) {
    if (!selection || !selection.length) return "علم الأحياء | جميع الوحدات";
    const units = Array.from(new Set(selection.map(x => x.unit))).sort((a,b)=>a-b);
    const lessons = selection.map(x => "و" + x.unit + "/د" + x.lesson).join("، ");
    return "علم الأحياء | الوحدات " + units.join("، ") + " | " + lessons;
  }

  async function createDraft(selection, customTitle, plan) {
    const questions = buildBiologyModel(selection, { plan });
    const title = customTitle || labelFor(selection);
    const payload = {
      title, subjectId: "biology", subjectName: "علم الأحياء", description: "نموذج امتحاني لمادة علم الأحياء — مسودة حتى اعتماد المدير ونشره.",
      code: "", durationMin: 120, questions, status: "draft", isApproved: false, autoGenerated: true,
      modelFamily: "biology-official-models", templateKey: "bio-" + Date.now() + "-" + Math.random().toString(36).slice(2),
      templateName: title, filterCriteria: { modelFamily: "biology-official-models", selections: selection, plan, generatedAt: new Date().toISOString() },
      targetGroups: ["ALL"]
    };
    return S.createExam(payload);
  }

  function statusLabel(e) { return e.status === "published" && e.isApproved ? '<span class="badge badge-success">منشور ومعتمد</span>' : e.status === "archived" ? '<span class="badge badge-muted">مؤرشف</span>' : '<span class="badge badge-warning">مسودة — لا تظهر للطالب</span>'; }

  async function refresh() { exams = await S.listExams(); renderList(); }
  function renderList() {
    const arr = exams.filter(e => e.modelFamily === "biology-official-models");
    byId("bioModelList").innerHTML = arr.length ? arr.map(e => '<div class="card mb-sm"><div class="flex flex-wrap" style="justify-content:space-between;gap:10px"><div><b>' + esc(e.title) + '</b><div class="tiny muted">' + (e.questions||[]).length + ' سؤال · ' + statusLabel(e) + '</div></div><div class="flex flex-wrap" style="gap:6px">' + ((e.status === "published" && e.isApproved) ? '<button class="btn btn-sm" data-bio-archive="' + esc(e.id) + '">أرشفة</button>' : '<button class="btn btn-primary btn-sm" data-bio-publish="' + esc(e.id) + '">اعتماد ونشر</button>') + '</div></div></div>').join("") : '<div class="empty-state"><div class="emoji">🧬</div><h3>لا توجد نماذج أحياء بعد</h3><p>اختر الوحدة والدرس ثم أنشئ نموذجاً.</p></div>';
    document.querySelectorAll("[data-bio-publish]").forEach(b => b.addEventListener("click", async () => { if (!confirm("سيظهر النموذج للطلاب بعد النشر. متابعة؟")) return; b.disabled = true; try { await S.updateExam(b.dataset.bioPublish, { status: "published", isApproved: true }); msg("تم اعتماد النموذج ونشره", "success"); await refresh(); } catch(e) { msg(e.message, "error"); b.disabled = false; } }));
    document.querySelectorAll("[data-bio-archive]").forEach(b => b.addEventListener("click", async () => { try { await S.updateExam(b.dataset.bioArchive, { status: "archived", isApproved: false }); msg("تمت الأرشفة", "success"); await refresh(); } catch(e) { msg(e.message, "error"); } }));
  }

  function render() {
    root.innerHTML = '<div class="container container-narrow"><div class="card-head"><div><h1>🧬 نماذج علم الأحياء</h1><p class="muted">يحدد المدير الوحدة والدرس ثم ينشئ نموذجاً. النموذج يُحفظ كمسودة ولا يظهر للطلاب إلا بعد الاعتماد والنشر.</p></div><div class="flex flex-wrap" style="gap:6px"><a class="btn btn-sm" href="admin.html#/exams">الاختبارات</a></div></div>' +
      '<div class="card mb"><h3>إنشاء نموذج</h3><div class="help" style="margin-bottom:10px">الملفان المرجعيان للنموذج: <code>inbox/الصورة_المعدلة (4).pdf</code> و <code>inbox/الصورة_المعدلة (5).pdf</code> (صور داخل PDF بدون نص قابل للاستخراج). عدّل <b>بنية النموذج</b> أدناه لتطابق النموذج المرفق (أقسام/عدد/أنواع/درجات)، ثم أنشئ النموذج.</div>' +
      '<div class="form-row"><div class="field"><label>الوحدات (اختياري — اتركها فارغة للكل)</label><select id="bioUnits" multiple size="4">' + unitOptions() + '</select></div></div>' +
      '<div class="field"><label>الدروس المشمولة</label><div id="bioLessons" class="card" style="max-height:220px;overflow:auto">اختر وحدة أو اتركها فارغة</div></div>' +
      '<div class="form-row"><div class="field"><label>اسم النموذج (اختياري)</label><input id="bioTitle" placeholder="يُولد تلقائياً"></div></div>' +
      '<details class="card mb-sm" style="padding:10px"><summary><b>بنية النموذج (JSON) — عدّلها لمطابقة النموذج المرفق</b></summary>' +
      '<p class="help" style="margin:8px 0">كل عنصر: <code>section</code>، <code>title</code>، <code>types</code> (مثل mcq, true_false, short_answer, essay, diagram_label, genetics_problem)، <code>count</code>، <code>points</code> لكل سؤال في القسم.</p>' +
      '<textarea id="bioPlan" style="min-height:170px;font-family:monospace;font-size:12px;direction:ltr;text-align:left">' + esc(JSON.stringify(DEFAULT_PLAN, null, 2)) + '</textarea></details>' +
      '<div class="flex flex-wrap" style="gap:8px"><button class="btn btn-primary" id="bioCreate">إنشاء النموذج (مسودة)</button></div></div>' +
      '<div class="card"><div class="card-head"><h3>النماذج المنشأة</h3><button class="btn btn-sm" id="bioRefresh">تحديث</button></div><div id="bioModelList">' + U.loaderHTML() + '</div></div></div>';
    const uEl = byId("bioUnits"); if (uEl) uEl.addEventListener("change", renderLessons);
    byId("bioCreate").addEventListener("click", async () => {
      try {
        const sel = selectedLessons();
        const plan = readPlan();
        const b = byId("bioCreate"); b.disabled = true;
        await createDraft(sel, byId("bioTitle").value.trim(), plan);
        msg("تم حفظ النموذج كمسودة", "success");
        await refresh();
        b.disabled = false;
      } catch(e) { msg(e.message, "error"); byId("bioCreate").disabled = false; }
    });
    byId("bioRefresh").addEventListener("click", refresh);
    renderLessons(); renderList();
  }

  async function init() {
    if (!session()) { root.innerHTML = '<div class="container container-narrow"><div class="card empty-state"><h2>يجب تسجيل الدخول كمدير</h2><a class="btn btn-primary" href="admin.html">فتح لوحة المدير</a></div></div>'; return; }
    root.innerHTML = '<div class="container container-narrow">' + U.loaderHTML() + '</div>';
    try {
      const data = await Promise.all([loadJSON("data/biology.json"), S.listExams()]);
      bank = data[0]; exams = data[1];
      render();
    } catch(e) { root.innerHTML = '<div class="container container-narrow"><div class="card"><h3>تعذر تحميل البيانات</h3><p>' + esc(e.message) + '</p></div></div>'; }
  }
  init();
})();
