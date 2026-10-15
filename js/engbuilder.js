/* ============================================================
 * engbuilder.js — باني أسئلة مادة اللغة الإنكليزية (صفحة مستقلة)
 * خاصّ بمادة اللغة الإنكليزية فقط — يبني الأسئلة وفق النموذج الامتحاني
 * ============================================================ */
(function () {
  const QP = window.QP;
  const S = QP.store;
  const U = QP.utils;

  /* الوحدات الدراسية للغة الإنكليزية (العلمي) */
  const UNITS = [
    { n: 1, title: "Life Choices" },
    { n: 2, title: "Success" },
    { n: 3, title: "Medicine" },
    { n: 4, title: "Engineering" },
    { n: 5, title: "Civil Rights" },
    { n: 6, title: "United Nations" },
    { n: 7, title: "Microorganisms" },
    { n: 8, title: "Facts about the Human Body" },
    { n: 9, title: "Citizenship" },
    { n: 10, title: "Culture Shock" },
    { n: 11, title: "Artificial Intelligence" },
    { n: 12, title: "Digital Literacy" },
    { n: 13, title: "Progress Test 1 (1-4)" },
    { n: 14, title: "Progress Test 2 (5-8)" },
    { n: 15, title: "Progress Test 3 (9-12)" }
  ];

  /* ============================================================
   * النموذج الافتراضي للامتحان الإنكليزي (قابل للتعديل من الصفحة)
   * النوعان الأول والثاني قائمان على النص (passageBased)
   * بقية الأنواع لها صيغة سؤال ثابتة (format) + فروع
   * ============================================================ */
  const DEFAULT_MODEL = {
    types: [
      {
        key: "t1",
        title: "النوع الأول: فهم المقروء — النص الأول",
        passageBased: true,
        subtypes: [
          { key: "t1a", title: "أجب عن الأسئلة التالية" },
          { key: "t1b", title: "استخرج كلمة تعني" },
          { key: "t1c", title: "صحّح المعلومات" }
        ]
      },
      {
        key: "t2",
        title: "النوع الثاني: فهم المقروء — النص الثاني",
        passageBased: true,
        subtypes: [
          { key: "t2a", title: "أجب عن الأسئلة التالية" },
          { key: "t2b", title: "أكمل من النص" },
          { key: "t2c", title: "استخرج كلمة تعني" }
        ]
      },
      {
        key: "t3",
        title: "المفردات والتعبيرات",
        passageBased: false,
        format: "اختر الإجابة الصحيحة a أو b أو c أو d",
        subtypes: [{ key: "t3a", title: "اختيار من متعدد" }]
      },
      {
        key: "t4",
        title: "القواعد",
        passageBased: false,
        format: "اختر الإجابة الصحيحة / صحّح الفعل بين القوسين",
        subtypes: [{ key: "t4a", title: "اختيار من متعدد" }]
      },
      {
        key: "t5",
        title: "اللفظ (Pronunciation)",
        passageBased: false,
        format: "اختر الكلمة التي يختلف لفظها",
        subtypes: [{ key: "t5a", title: "اختيار من متعدد" }]
      },
      {
        key: "t6",
        title: "الوظائف اللغوية (Everyday English)",
        passageBased: false,
        format: "اختر الإجابة الصحيحة a أو b أو c أو d",
        subtypes: [{ key: "t6a", title: "اختيار من متعدد" }]
      },
      {
        key: "t7",
        title: "إعادة الصياغة (Rewrite)",
        passageBased: false,
        format: "أعد كتابة الجملة كما هو مطلوب",
        subtypes: [{ key: "t7a", title: "إعادة صياغة" }]
      },
      {
        key: "t8",
        title: "الترجمة",
        passageBased: false,
        format: "ترجم الجملة",
        subtypes: [
          { key: "t8a", title: "من الإنكليزية إلى العربية" },
          { key: "t8b", title: "من العربية إلى الإنكليزية" }
        ]
      },
      {
        key: "t9",
        title: "التعبير (Composition)",
        passageBased: false,
        format: "اكتب موضوعاً لا يقل عن 80 كلمة",
        subtypes: [{ key: "t9a", title: "موضوع تعبير" }]
      }
    ]
  };

  const state = {
    model: null,
    passages: [],
    items: [],
    tab: "passages"
  };

  /* ---------- أدوات ---------- */
  function view(html) { document.getElementById("view").innerHTML = html; }
  function isLogged() { return sessionStorage.getItem("qp_admin") === "1"; }

  function unitLabel(n) {
    const u = UNITS.find(function (x) { return String(x.n) === String(n); });
    return u ? ("الوحدة " + u.n + " — " + u.title) : (n ? ("الوحدة " + n) : "—");
  }
  function unitOptions(sel) {
    return '<option value="">— الوحدة —</option>' + UNITS.map(function (u) {
      return '<option value="' + u.n + '"' + (String(sel) === String(u.n) ? " selected" : "") + ">" +
        U.esc(unitLabel(u.n)) + "</option>";
    }).join("");
  }
  function typeByKey(k) { return (state.model.types || []).find(function (t) { return t.key === k; }) || null; }
  function subtypeByKey(t, k) { return t && (t.subtypes || []).find(function (s) { return s.key === k; }) || null; }
  function passageById(id) { return state.passages.find(function (p) { return p.id === id; }) || null; }

  function tabsHTML(active) {
    const tabs = [
      ["passages", "📚 المقاطع (النصوص)"],
      ["model", "🧩 عناصر النموذج"],
      ["add", "➕ إضافة أسئلة"],
      ["build", "🏗️ بناء الاختبار"]
    ];
    return '<div class="eng-tabs">' + tabs.map(function (t) {
      return '<button class="eng-tab' + (active === t[0] ? " active" : "") + '" data-tab="' + t[0] + '">' + t[1] + "</button>";
    }).join("") + "</div>";
  }
  function bindTabs() {
    document.querySelectorAll(".eng-tab").forEach(function (b) {
      b.addEventListener("click", function () { state.tab = b.dataset.tab; render(); });
    });
  }

  /* ============================================================
   * الدخول
   * ============================================================ */
  function renderLogin() {
    view(
      '<div class="container container-narrow">' +
      '<div class="card mt"><div class="center" style="padding:10px 0 6px">' +
      '<div class="emoji" style="font-size:46px">🔐</div>' +
      "<h2>دخول باني الأسئلة</h2>" +
      '<p class="muted">صفحة خاصة بمادة اللغة الإنكليزية — يتطلب رمز المدير</p></div>' +
      '<div class="field mt"><label>رمز المدير</label>' +
      '<input type="password" id="adminPass" placeholder="admin123"></div>' +
      '<button class="btn btn-primary btn-block" id="loginBtn">دخول</button>' +
      '<p class="help center mt-sm">أو افتح <a href="admin.html">لوحة الإدارة</a></p>' +
      "</div></div>"
    );
    const doLogin = async function () {
      const val = document.getElementById("adminPass").value.trim();
      try {
        const res = await S.getAdminPass();
        if (val === res.pass) {
          sessionStorage.setItem("qp_admin", "1");
          U.toast("مرحباً", "success");
          render();
        } else {
          U.toast("رمز خاطئ", "error");
        }
      } catch (e) { U.toast("خطأ: " + e.message, "error"); }
    };
    document.getElementById("loginBtn").addEventListener("click", doLogin);
    document.getElementById("adminPass").addEventListener("keydown", function (e) { if (e.key === "Enter") doLogin(); });
  }

  /* ============================================================
   * التحميل
   * ============================================================ */
  async function loadData() {
    const arr = await Promise.all([
      S.getEngModel().catch(function () { return null; }),
      S.listEngPassages().catch(function () { return []; }),
      S.listEngItems().catch(function () { return []; })
    ]);
    state.model = (arr[0] && arr[0].types && arr[0].types.length) ? arr[0] : JSON.parse(JSON.stringify(DEFAULT_MODEL));
    state.passages = arr[1] || [];
    state.items = arr[2] || [];
  }

  async function render() {
    if (!isLogged()) { renderLogin(); return; }
    view('<div class="container">' + U.loaderHTML() + "</div>");
    try {
      await loadData();
    } catch (e) {
      view('<div class="container"><div class="card"><div class="empty-state">⛔<h3>خطأ</h3><p>' + U.esc(e.message) + "</p></div></div></div>");
      return;
    }
    const body =
      '<div class="container">' +
      '<div class="card"><div class="card-head"><h2>🇬🇧 باني أسئلة اللغة الإنكليزية</h2>' +
      '<div class="spacer"></div>' +
      '<span class="badge badge-muted">' + state.passages.length + " مقطع</span> " +
      '<span class="badge badge-muted">' + state.items.length + " سؤال</span></div>" +
      tabsHTML(state.tab) +
      '<div id="engBody" class="mt"></div>' +
      "</div></div>";
    view(body);
    bindTabs();
    if (state.tab === "passages") renderPassages();
    else if (state.tab === "model") renderModel();
    else if (state.tab === "add") renderAdd();
    else renderBuild();
  }

  /* ============================================================
   * 1) المقاطع
   * ============================================================ */
  function renderPassages() {
    const titles = Array.from(new Set(state.passages.map(function (p) { return p.title; }).filter(Boolean)));
    // تصنيف المقاطع حسب عنوان المقطع
    const groups = {};
    state.passages.forEach(function (p) {
      const t = p.title || "(بلا عنوان)";
      (groups[t] = groups[t] || []).push(p);
    });

    const listHTML = Object.keys(groups).length
      ? Object.keys(groups).map(function (t) {
        return '<div class="eng-group"><h4 class="eng-group-title">📑 ' + U.esc(t) + " <span class=\"muted tiny\">(" + groups[t].length + ")</span></h4>" +
          groups[t].map(function (p) {
            return '<div class="eng-passage">' +
              '<div class="flex" style="gap:8px;align-items:center;flex-wrap:wrap">' +
              '<span class="badge badge-primary">' + U.esc(unitLabel(p.unitNumber)) + "</span>" +
              '<span class="muted tiny">' + U.esc((p.text || "").slice(0, 90)) + "…</span>" +
              '<div class="spacer"></div>' +
              '<button class="btn btn-sm" data-pedit="' + p.id + '">✎</button>' +
              '<button class="btn btn-sm btn-danger" data-pdel="' + p.id + '">🗑</button>' +
              "</div></div>";
          }).join("") + "</div>";
      }).join("")
      : '<p class="muted center mt">لا توجد مقاطع بعد — أضف مقطعاً من الأعلى.</p>';

    document.getElementById("engBody").innerHTML =
      '<div class="eng-grid">' +
      /* نموذج الإضافة */
      '<div class="eng-panel">' +
      "<h3>إضافة مقطع جديد</h3>" +
      '<div class="field"><label>عنوان المقطع *</label>' +
      '<input id="pTitle" list="pTitleList" placeholder="مثال: A Learned Lesson is a Good Lesson">' +
      '<datalist id="pTitleList">' + titles.map(function (t) { return '<option value="' + U.esc(t) + '">'; }).join("") + "</datalist></div>" +
      '<div class="field"><label>الوحدة</label><select id="pUnit">' + unitOptions("") + "</select></div>" +
      '<div class="field"><label>نص المقطع *</label>' +
      '<textarea id="pText" style="min-height:170px" placeholder="الصق نص المقطع هنا..."></textarea></div>' +
      '<div class="field"><label>شرح المفردات (اختياري)</label>' +
      '<textarea id="pNotes" style="min-height:60px"></textarea></div>' +
      '<button class="btn btn-primary btn-block" id="pAdd">➕ إضافة المقطع</button>' +
      "</div>" +
      /* القائمة */
      '<div class="eng-panel">' +
      "<h3>المقاطع (مصنّفة حسب العنوان)</h3>" + listHTML +
      "</div></div>";

    document.getElementById("pAdd").addEventListener("click", async function () {
      const title = document.getElementById("pTitle").value.trim();
      const text = document.getElementById("pText").value.trim();
      const unitNumber = document.getElementById("pUnit").value;
      const notes = document.getElementById("pNotes").value.trim();
      if (!title || !text) return U.toast("العنوان والنص مطلوبان", "warn");
      try {
        const u = UNITS.find(function (x) { return String(x.n) === String(unitNumber); });
        await S.addEngPassage({ title: title, text: text, notes: notes, unitNumber: unitNumber, unitTitle: u ? u.title : "" });
        U.toast("تمت إضافة المقطع ✓", "success");
        render();
      } catch (e) { U.toast("تعذّرت الإضافة: " + e.message, "error"); }
    });

    document.querySelectorAll("[data-pdel]").forEach(function (b) {
      b.addEventListener("click", async function () {
        if (!(await U.confirm("حذف المقطع وأسئلته؟"))) return;
        try { await S.deleteEngPassage(b.dataset.pdel); U.toast("تم الحذف", "success"); render(); }
        catch (e) { U.toast("تعذّر الحذف: " + e.message, "error"); }
      });
    });
    document.querySelectorAll("[data-pedit]").forEach(function (b) {
      b.addEventListener("click", function () { editPassage(b.dataset.pedit); });
    });
  }

  function editPassage(id) {
    const p = passageById(id);
    if (!p) return;
    U.modal({
      title: "تعديل المقطع",
      size: "lg",
      body:
        '<div class="field"><label>العنوان</label><input id="epTitle" value="' + U.esc(p.title) + '"></div>' +
        '<div class="field"><label>الوحدة</label><select id="epUnit">' + unitOptions(p.unitNumber) + "</select></div>" +
        '<div class="field"><label>النص</label><textarea id="epText" style="min-height:200px">' + U.esc(p.text) + "</textarea></div>" +
        '<div class="field"><label>شرح المفردات</label><textarea id="epNotes" style="min-height:60px">' + U.esc(p.notes || "") + "</textarea></div>",
      footer: '<button class="btn btn-primary" id="epSave">حفظ</button><button class="btn btn-ghost" data-close>إلغاء</button>',
      onMount: function (node, close) {
        node.querySelector("#epSave").addEventListener("click", async function () {
          const unitNumber = node.querySelector("#epUnit").value;
          const u = UNITS.find(function (x) { return String(x.n) === String(unitNumber); });
          try {
            await S.updateEngPassage(id, {
              title: node.querySelector("#epTitle").value.trim(),
              text: node.querySelector("#epText").value.trim(),
              notes: node.querySelector("#epNotes").value.trim(),
              unitNumber: unitNumber,
              unitTitle: u ? u.title : ""
            });
            close(); U.toast("تم الحفظ ✓", "success"); render();
          } catch (e) { U.toast("تعذّر الحفظ: " + e.message, "error"); }
        });
      }
    });
  }

  /* ============================================================
   * 2) عناصر النموذج
   * ============================================================ */
  function renderModel() {
    document.getElementById("engBody").innerHTML =
      '<p class="muted">هذه عناوين الأسئلة الرئيسية في النموذج الامتحاني وأنواعها الفرعية. يمكنك تعديلها ثم حفظها.</p>' +
      '<div id="modelList"></div>' +
      '<div class="mt"><button class="btn btn-ghost" id="mAddType">➕ إضافة عنوان رئيسي</button> ' +
      '<button class="btn btn-primary" id="mSave">💾 حفظ النموذج</button></div>';
    drawModelList();
    document.getElementById("mAddType").addEventListener("click", function () {
      const n = state.model.types.length + 1;
      state.model.types.push({ key: "t" + Date.now(), title: "عنوان " + n, passageBased: false, format: "", subtypes: [{ key: "s" + Date.now(), title: "فرع 1" }] });
      drawModelList();
    });
    document.getElementById("mSave").addEventListener("click", async function () {
      try { await S.saveEngModel(state.model); U.toast("تم حفظ النموذج ✓", "success"); }
      catch (e) { U.toast("تعذّر الحفظ: " + e.message, "error"); }
    });
  }

  function drawModelList() {
    const wrap = document.getElementById("modelList");
    wrap.innerHTML = state.model.types.map(function (t, ti) {
      return '<div class="eng-panel mt">' +
        '<div class="field"><label>العنوان الرئيسي</label>' +
        '<input data-mt-title="' + ti + '" value="' + U.esc(t.title) + '"></div>' +
        '<div class="flex" style="gap:14px;align-items:center;flex-wrap:wrap">' +
        '<label class="check"><input type="checkbox" data-mt-passage="' + ti + '"' + (t.passageBased ? " checked" : "") + "> قائم على النص (passage-based)</label>" +
        '<button class="btn btn-sm btn-danger" data-mt-del="' + ti + '">🗑 حذف العنوان</button></div>' +
        (t.passageBased ? "" : '<div class="field"><label>صيغة السؤال (تظهر عند الإضافة)</label><input data-mt-format="' + ti + '" value="' + U.esc(t.format || "") + '"></div>') +
        "<h4>الأنواع الفرعية</h4>" +
        (t.subtypes || []).map(function (st, si) {
          return '<div class="flex" style="gap:8px;align-items:center;margin-bottom:6px">' +
            '<input data-ms-title="' + ti + "-" + si + '" value="' + U.esc(st.title) + '" style="flex:1">' +
            '<button class="btn btn-sm btn-danger" data-ms-del="' + ti + "-" + si + '">🗑</button></div>';
        }).join("") +
        '<button class="btn btn-sm btn-ghost" data-ms-add="' + ti + '">➕ فرع</button>' +
        "</div>";
    }).join("");

    wrap.querySelectorAll("[data-mt-title]").forEach(function (inp) {
      inp.addEventListener("input", function () { state.model.types[+inp.dataset.mtTitle].title = inp.value; });
    });
    wrap.querySelectorAll("[data-mt-passage]").forEach(function (inp) {
      inp.addEventListener("change", function () { state.model.types[+inp.dataset.mtPassage].passageBased = inp.checked; drawModelList(); });
    });
    wrap.querySelectorAll("[data-mt-format]").forEach(function (inp) {
      inp.addEventListener("input", function () { state.model.types[+inp.dataset.mtFormat].format = inp.value; });
    });
    wrap.querySelectorAll("[data-mt-del]").forEach(function (b) {
      b.addEventListener("click", function () { state.model.types.splice(+b.dataset.mtDel, 1); drawModelList(); });
    });
    wrap.querySelectorAll("[data-ms-title]").forEach(function (inp) {
      inp.addEventListener("input", function () {
        const a = inp.dataset.msTitle.split("-");
        state.model.types[+a[0]].subtypes[+a[1]].title = inp.value;
      });
    });
    wrap.querySelectorAll("[data-ms-del]").forEach(function (b) {
      b.addEventListener("click", function () {
        const a = b.dataset.msDel.split("-");
        state.model.types[+a[0]].subtypes.splice(+a[1], 1); drawModelList();
      });
    });
    wrap.querySelectorAll("[data-ms-add]").forEach(function (b) {
      b.addEventListener("click", function () {
        const t = state.model.types[+b.dataset.msAdd];
        t.subtypes = t.subtypes || [];
        t.subtypes.push({ key: "s" + Date.now(), title: "فرع " + (t.subtypes.length + 1) });
        drawModelList();
      });
    });
  }

  /* ============================================================
   * 3) إضافة أسئلة
   * ============================================================ */
  let addSel = { typeKey: "", passageId: "" };

  function renderAdd() {
    const types = state.model.types || [];
    if (!addSel.typeKey && types.length) addSel.typeKey = types[0].key;
    const t = typeByKey(addSel.typeKey);

    let panel = "";
    if (t) {
      if (t.passageBased) {
        panel =
          '<div class="field"><label>اختر النص / المقطع</label><select id="addPassage">' +
          '<option value="">— اختر مقطعاً —</option>' +
          state.passages.map(function (p) {
            return '<option value="' + p.id + '"' + (addSel.passageId === p.id ? " selected" : "") + ">" +
              U.esc(p.title) + " — " + U.esc(unitLabel(p.unitNumber)) + "</option>";
          }).join("") + "</select></div>";
        if (!state.passages.length) {
          panel += '<p class="muted">لا توجد مقاطع — أضفها من تبويب «المقاطع».</p>';
        } else if (addSel.passageId && passageById(addSel.passageId)) {
          const p = passageById(addSel.passageId);
          panel += '<div class="eng-passage-preview"><b>' + U.esc(p.title) + "</b><p>" + U.esc((p.text || "").slice(0, 300)) + "…</p></div>";
          panel += (t.subtypes || []).map(function (st) {
            return subtypeCard(t, st, addSel.passageId);
          }).join("");
        } else {
          panel += '<p class="muted">اختر مقطعاً لعرض أنواع الأسئلة الفرعية للنص.</p>';
        }
      } else {
        panel += '<div class="eng-format">صيغة السؤال: <b>' + U.esc(t.format || "—") + "</b></div>";
        panel += (t.subtypes || []).map(function (st) { return subtypeCard(t, st, ""); }).join("");
      }
    }

    document.getElementById("engBody").innerHTML =
      '<div class="field"><label>عنوان السؤال الرئيسي</label><select id="addType">' +
      types.map(function (x) { return '<option value="' + x.key + '"' + (x.key === addSel.typeKey ? " selected" : "") + ">" + U.esc(x.title) + "</option>"; }).join("") +
      "</select></div>" + panel;

    document.getElementById("addType").addEventListener("change", function (e) {
      addSel.typeKey = e.target.value; addSel.passageId = ""; renderAdd();
    });
    const ps = document.getElementById("addPassage");
    if (ps) ps.addEventListener("change", function (e) { addSel.passageId = e.target.value; renderAdd(); });

    bindSubtypeCards();
  }

  function subtypeCard(t, st, passageId) {
    const items = state.items.filter(function (it) {
      return it.typeKey === t.key && it.subtypeKey === st.key && (passageId ? it.passageId === passageId : true);
    });
    return '<div class="eng-panel mt" data-subcard="' + t.key + "|" + st.key + "|" + (passageId || "") + '">' +
      "<h4>◾ " + U.esc(st.title) + "</h4>" +
      (items.length
        ? '<div class="eng-items">' + items.map(function (it) {
          return '<div class="eng-item"><div class="flex" style="gap:8px"><div style="flex:1">' +
            '<div>' + U.esc(it.text) + "</div>" +
            (it.options && it.options.length ? '<div class="tiny muted">الخيارات: ' + U.esc(it.options.join(" / ")) + "</div>" : "") +
            '<div class="tiny badge badge-success">الإجابة: ' + U.esc(it.answer || "—") + "</div>" +
            '<div class="tiny muted">' + U.esc(unitLabel(it.unitNumber)) + "</div></div>" +
            '<button class="btn btn-sm btn-danger" data-idel="' + it.id + '">🗑</button>' +
            "</div></div>";
        }).join("") + "</div>"
        : '<p class="muted tiny">لا أسئلة بعد.</p>') +
      '<div class="eng-addform">' +
      '<textarea data-q-text placeholder="نص السؤال"></textarea>' +
      '<div class="field mt-sm"><label>الخيارات (سطر لكل خيار — اتركه فارغاً للأسئلة النصّية)</label>' +
      '<textarea data-q-opts style="min-height:50px" placeholder="خيار 1&#10;خيار 2&#10;خيار 3&#10;خيار 4"></textarea></div>' +
      '<div class="flex" style="gap:8px;flex-wrap:wrap;margin-top:6px">' +
      '<input data-q-answer placeholder="الإجابة الصحيحة" style="flex:2;min-width:140px">' +
      '<select data-q-unit style="flex:1;min-width:120px">' + unitOptions("") + "</select>" +
      "</div>" +
      '<button class="btn btn-sm btn-primary" data-q-add>➕ إضافة السؤال</button>' +
      "</div></div>";
  }

  function collectSubForm(card) {
    const text = card.querySelector("[data-q-text]").value.trim();
    const opts = card.querySelector("[data-q-opts]").value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    const answer = card.querySelector("[data-q-answer]").value.trim();
    const unitNumber = card.querySelector("[data-q-unit]").value;
    return { text: text, options: opts, answer: answer, unitNumber: unitNumber };
  }

  async function saveItem(t, st, passageId, form) {
    if (!form.text || !form.answer) { U.toast("نص السؤال والإجابة مطلوبان", "warn"); return false; }
    const u = UNITS.find(function (x) { return String(x.n) === String(form.unitNumber); });
    await S.addEngItem({
      typeKey: t.key, subtypeKey: st.key, passageId: passageId || "",
      text: form.text, options: form.options, answer: form.answer,
      unitNumber: form.unitNumber, unitTitle: u ? u.title : ""
    });
    return true;
  }

  function bindSubtypeCards() {
    document.querySelectorAll("[data-subcard]").forEach(function (card) {
      const parts = card.dataset.subcard.split("|");
      const t = typeByKey(parts[0]);
      const st = subtypeByKey(t, parts[1]);
      const passageId = parts[2] || "";
      const addOne = card.querySelector("[data-q-add]");
      if (addOne) addOne.addEventListener("click", async function () {
        const form = collectSubForm(card);
        try {
          if (await saveItem(t, st, passageId, form)) {
            await loadData();
            U.toast("تمت الإضافة ✓", "success");
            renderAdd();
          }
        } catch (e) { U.toast("خطأ: " + e.message, "error"); }
      });
    });
    document.querySelectorAll("[data-idel]").forEach(function (b) {
      b.addEventListener("click", async function () {
        if (!(await U.confirm("حذف السؤال؟"))) return;
        try { await S.deleteEngItem(b.dataset.idel); await loadData(); U.toast("تم الحذف", "success"); renderAdd(); }
        catch (e) { U.toast("خطأ: " + e.message, "error"); }
      });
    });
  }

  /* ============================================================
   * 4) بناء الاختبار
   * ============================================================ */
  const buildSel = {};   // typeKey -> { include, count, passageId }

  function renderBuild() {
    const types = state.model.types || [];
    const rows = types.map(function (t) {
      const bs = buildSel[t.key] || (buildSel[t.key] = { include: true, count: 1, passageId: "" });
      const count = state.items.filter(function (it) {
        if (it.typeKey !== t.key) return false;
        if (t.passageBased && bs.passageId) return it.passageId === bs.passageId;
        return true;
      }).length;
      return "<tr>" +
        '<td><label class="check"><input type="checkbox" data-b-inc="' + t.key + '"' + (bs.include ? " checked" : "") + "></label></td>" +
        '<td><b>' + U.esc(t.title) + "</b><div class=\"tiny muted\">" + (t.passageBased ? "قائم على النص" : "صيغة ثابتة") + "</div></td>" +
        "<td>" + (t.passageBased
          ? '<select data-b-pass="' + t.key + '"><option value="">— اختر النص —</option>' +
          state.passages.map(function (p) { return '<option value="' + p.id + '"' + (bs.passageId === p.id ? " selected" : "") + ">" + U.esc(p.title) + "</option>"; }).join("") + "</select>"
          : '<span class="muted tiny">—</span>') + "</td>" +
        '<td><input type="number" min="0" data-b-cnt="' + t.key + '" value="' + bs.count + '" style="width:70px"></td>' +
        '<td><span class="badge badge-muted">' + count + "</span></td>" +
        "</tr>";
    }).join("");

    document.getElementById("engBody").innerHTML =
      '<p class="muted">ضع الرقم <b>1</b> أمام كل عنوان لإدراجه في النموذج الكامل (يمكن تجاوزه لأكثر من سؤال). للنوعين الأول والثاني اختر النص.</p>' +
      '<div class="field"><label>عنوان الاختبار</label><input id="bTitle" value="اختبار اللغة الإنكليزية — نموذج كامل"></div>' +
      '<div class="table-wrap responsive"><table><thead><tr>' +
      "<th>تضمين</th><th>العنوان الرئيسي</th><th>النص</th><th>العدد</th><th>المتاح</th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table></div>" +
      '<div class="mt flex" style="gap:10px;flex-wrap:wrap">' +
      '<button class="btn btn-primary" id="bBuild">🏗️ إنشاء الاختبار من النموذج</button>' +
      '<span id="bPreview" class="muted"></span></div>';

    document.querySelectorAll("[data-b-inc]").forEach(function (cb) {
      cb.addEventListener("change", function () { buildSel[cb.dataset.bInc].include = cb.checked; });
    });
    document.querySelectorAll("[data-b-cnt]").forEach(function (inp) {
      inp.addEventListener("change", function () { buildSel[inp.dataset.bCnt].count = Math.max(0, Number(inp.value) || 0); });
    });
    document.querySelectorAll("[data-b-pass]").forEach(function (sel) {
      sel.addEventListener("change", function () { buildSel[sel.dataset.bPass].passageId = sel.value; });
    });
    document.getElementById("bBuild").addEventListener("click", buildExam);
  }

  function assembleQuestions() {
    const out = [];
    (state.model.types || []).forEach(function (t) {
      const bs = buildSel[t.key];
      if (!bs || !bs.include) return;
      let pool = state.items.filter(function (it) { return it.typeKey === t.key; });
      if (t.passageBased) {
        if (!bs.passageId) return;
        const p = passageById(bs.passageId);
        pool = pool.filter(function (it) { return it.passageId === bs.passageId; });
        const passageObj = p ? { title: p.title, text: p.text, notes: p.notes || "" } : null;
        pool.forEach(function (it) {
          out.push(toExamQuestion(it, passageObj, t));
        });
      } else {
        pool = pool.slice(0, bs.count > 0 ? bs.count : pool.length);
        pool.forEach(function (it) { out.push(toExamQuestion(it, null, t)); });
      }
    });
    return out;
  }

  function toExamQuestion(it, passageObj, t) {
    const type = (it.options && it.options.length) ? "mcq" : "short_answer";
    return {
      type: type,
      text: it.text,
      options: it.options || [],
      answer: it.answer || "",
      points: Number(it.points) || (type === "mcq" ? 1 : 2),
      difficulty: "medium",
      tags: ["eng-model", t.key],
      unitNumber: it.unitNumber !== undefined ? it.unitNumber : null,
      unitTitle: it.unitTitle || "",
      lessonTitle: t.title,
      passage: passageObj || null
    };
  }

  async function buildExam() {
    const title = document.getElementById("bTitle").value.trim() || "اختبار اللغة الإنكليزية";
    const questions = assembleQuestions();
    if (!questions.length) return U.toast("لا أسئلة مُختارة — أضف أسئلة وحدّد العناوين", "warn");
    try {
      const subjects = await S.listSubjects();
      const eng = subjects.find(function (s) { return s.name && s.name.indexOf("الإنكليزي") >= 0; }) ||
        subjects.find(function (s) { return s.name && s.name.indexOf("الانكليزي") >= 0; });
      const res = await S.createExam({
        title: title,
        subjectId: eng ? eng.id : "",
        subjectName: eng ? eng.name : "اللغة الإنكليزية",
        description: "أُنشئ من باني أسئلة الإنكليزي وفق النموذج الامتحاني",
        questions: questions,
        status: "draft",
        settings: { shuffleQuestions: false, allowReview: true, passScore: 50 }
      });
      U.toast("تم إنشاء الاختبار ✓ الرمز: " + res.code, "success", 5000);
      document.getElementById("bPreview").innerHTML = "عدد الأسئلة: <b>" + questions.length + "</b> — رمز: <b>" + U.esc(res.code) + "</b>";
    } catch (e) { U.toast("تعذّر الإنشاء: " + e.message, "error"); }
  }

  function initTheme() {
    const t = localStorage.getItem("qp_theme") ||
      (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "dark");
    const btn = document.getElementById("themeToggle");
    if (btn) {
      btn.textContent = t === "light" ? "☀️" : "🌙";
      btn.addEventListener("click", function () {
        const nt = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", nt);
        btn.textContent = nt === "light" ? "☀️" : "🌙";
        localStorage.setItem("qp_theme", nt);
      });
    }
  }

  function boot() { initTheme(); render(); }

  QP.engbuilder = { render: render, _state: state };
  document.addEventListener("DOMContentLoaded", boot);
  if (document.readyState !== "loading") boot();
  console.log("[engbuilder.js] QP.engbuilder loaded ✅");
})();
