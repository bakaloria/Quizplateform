/* student.js v4.0 - تسجيل + مجموعات + انتظار تصحيح + لوحة الطالب */
(function () {
  const QP = window.QP;
  const U = QP.utils;
  const S = QP.store;
  const G = QP.groups;

  const st = {
    student: null,
    group: null,
    exam: null,
    questions: [],
    answers: [],
    flags: [],
    current: 0,
    startMs: 0,
    remaining: 0,
    timerId: null,
    submitted: false,
    settings: {}
  };

  function view(html) { document.getElementById("view").innerHTML = html; }

  /* ============================================================
   * AUTH SCREEN - تسجيل / دخول
   * ============================================================ */
  function renderAuth(prefillTab) {
    const session = getSession();
    if (session) {
      // جلسة موجودة - تحقق من صحة الحساب
      S.getStudent(session.id).then(function (s) {
        if (s && s.active !== false) {
          st.student = s;
          routeAfterLogin();
        } else {
          clearSession();
          renderAuth();
        }
      }).catch(function () {
        clearSession();
        renderAuth("login");
      });
      return;
    }

    view(
      '<div class="auth-screen">' +
      '<div class="auth-card">' +
      '<div class="auth-logo">\uD83C\uDF93</div>' +
      '<h2>\u0645\u0646\u0635\u0629 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a</h2>' +
      '<p class="sub">\u0623\u062f\u062e\u0644 \u0628\u0627\u0633\u0645\u0643 \u0648\u0627\u0628\u062f\u0623 \u0627\u0644\u062d\u0644</p>' +
      '<div class="auth-tabs">' +
      '<button data-tab="login">\u062f\u062e\u0648\u0644</button>' +
      '<button data-tab="register">\u062d\u0633\u0627\u0628 \u062c\u062f\u064a\u062f</button>' +
      '</div>' +
      '<div id="authForm"></div>' +
      '</div>' +
      '</div>'
    );

    const tabs = document.querySelectorAll(".auth-tabs button");
    tabs.forEach(function (b) {
      b.addEventListener("click", function () {
        tabs.forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        renderAuthForm(b.dataset.tab);
      });
    });

    const initial = prefillTab || "login";
    tabs.forEach(function (b) { b.classList.toggle("active", b.dataset.tab === initial); });
    renderAuthForm(initial);
  }

  function renderAuthForm(tab) {
    const form = document.getElementById("authForm");
    if (tab === "login") {
      form.innerHTML =
        '<div class="field"><label>\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644</label>' +
        '<input id="loginName" placeholder="\u0627\u0643\u062a\u0628 \u0627\u0633\u0645\u0643"></div>' +
        '<div class="field"><label>\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631</label>' +
        '<input type="password" id="loginPass" placeholder="6 \u0623\u062d\u0631\u0641 + \u0631\u0642\u0645\u0627\u0646"></div>' +
        '<button class="btn btn-primary btn-block" id="doLogin">\u062f\u062e\u0648\u0644</button>' +
        '<p class="help center mt-sm">\u0644\u0627 \u062a\u0645\u0644\u0643 \u062d\u0633\u0627\u0628\u0627\u064b\u061f \u0627\u062e\u062a\u0631 "\u062d\u0633\u0627\u0628 \u062c\u062f\u064a\u062f"</p>';

      U.focusFirstInput();
      document.getElementById("doLogin").addEventListener("click", doLogin);
      document.getElementById("loginPass").addEventListener("keydown", function (e) {
        if (e.key === "Enter") doLogin();
      });
    } else {
      form.innerHTML =
        '<div class="field"><label>\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644 *</label>' +
        '<input id="regName" placeholder="\u0627\u0643\u062a\u0628 \u0627\u0633\u0645\u0643 \u0627\u0644\u0631\u0628\u0627\u0639\u064a"></div>' +
        '<div class="field"><label>\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 * (\u0666 \u0623\u062d\u0631\u0641 + \u0662 \u0631\u0642\u0645)</label>' +
        '<div class="flex"><input type="text" id="regPass" placeholder="abcdef12" style="font-family:monospace;font-size:18px;letter-spacing:3px;text-align:center">' +
        '<button class="btn btn-sm" id="genPass" type="button">\uD83C\uDFB2 \u062a\u0648\u0644\u064a\u062f</button></div>' +
        '<p class="help">\u0645\u062b\u0627\u0644 \u0635\u062d\u064a\u062d: <code>ahmedm23</code> \u2014 \u0645\u062b\u0627\u0644 \u062e\u0627\u0637\u0626: <code>ahmed123</code></p></div>' +
        '<button class="btn btn-primary btn-block" id="doRegister">\u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628</button>' +
        '<p class="help center mt-sm">\u0627\u062d\u0641\u0638 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u062c\u064a\u062f\u0627\u064b \u2014 \u0633\u062a\u062d\u062a\u0627\u062c\u0647\u0627 \u0644\u062f\u062e\u0648\u0644 \u0644\u0627\u062d\u0642</p>';

      U.focusFirstInput();
      document.getElementById("genPass").addEventListener("click", function () {
        const p = U.generateStudentPassword();
        document.getElementById("regPass").value = p;
        U.toast("\u062a\u0645 \u062a\u0648\u0644\u064a\u062f: " + p, "success", 5000);
      });
      document.getElementById("doRegister").addEventListener("click", doRegister);
      document.getElementById("regPass").addEventListener("keydown", function (e) {
        if (e.key === "Enter") doRegister();
      });
    }
  }

  /* ============================================================
   * SESSION (localStorage)
   * ============================================================ */
  function getSession() {
    try {
      const raw = localStorage.getItem("qp_student");
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function setSession(s) {
    localStorage.setItem("qp_student", JSON.stringify({
      id: s.id, name: s.name, username: s.username
    }));
  }
  function clearSession() {
    localStorage.removeItem("qp_student");
  }

  /* ============================================================
   * LOGIN
   * ============================================================ */
  async function doLogin() {
    const name = document.getElementById("loginName").value.trim();
    const pass = document.getElementById("loginPass").value.trim();
    if (!name) return U.toast("\u0623\u062f\u062e\u0644 \u0627\u0644\u0627\u0633\u0645", "warn");
    if (!pass) return U.toast("\u0623\u062f\u062e\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", "warn");
    const btn = document.getElementById("doLogin");
    btn.disabled = true; btn.textContent = "...";
    try {
      const username = S.makeUsername(name);
      const student = await S.getStudentByUsername(username);
      if (!student) {
        U.toast("\u0644\u0627 \u064a\u0648\u062c\u062f \u062d\u0633\u0627\u0628 \u0628\u0647\u0630\u0627 \u0627\u0644\u0627\u0633\u0645", "error");
        btn.disabled = false; btn.textContent = "\u062f\u062e\u0648\u0644";
        return;
      }
      const ok = await QP.crypto.verifyPassword(pass, student.salt, student.passwordHash);
      if (!ok) {
        U.toast("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u062e\u0627\u0637\u0626\u0629", "error");
        btn.disabled = false; btn.textContent = "\u062f\u062e\u0648\u0644";
        return;
      }
      if (student.active === false) {
        U.toast("\u0627\u0644\u062d\u0633\u0627\u0628 \u0645\u0639\u0637\u0644", "error");
        btn.disabled = false; btn.textContent = "\u062f\u062e\u0648\u0644";
        return;
      }
      await S.recordStudentLogin(student.id);
      st.student = student;
      setSession(student);
      U.toast("\u0645\u0631\u062d\u0628\u0627 " + student.name, "success");
      routeAfterLogin();
    } catch (e) {
      U.toast("Error: " + e.message, "error");
      btn.disabled = false; btn.textContent = "\u062f\u062e\u0648\u0644";
    }
  }

  /* ============================================================
   * REGISTER
   * ============================================================ */
  async function doRegister() {
    const name = document.getElementById("regName").value.trim();
    const pass = document.getElementById("regPass").value.trim();
    if (!name) return U.toast("\u0623\u062f\u062e\u0644 \u0627\u0644\u0627\u0633\u0645", "warn");
    if (!U.isValidStudentPassword(pass)) {
      return U.toast("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631: 6 \u0623\u062d\u0631\u0641 + \u0631\u0642\u0645\u0627\u0646", "error", 4000);
    }
    const btn = document.getElementById("doRegister");
    btn.disabled = true; btn.textContent = "...";
    try {
      const username = S.makeUsername(name);
      const existing = await S.getStudentByUsername(username);
      if (existing) {
        U.toast("\u0627\u0644\u0627\u0633\u0645 \u0645\u0633\u062a\u062e\u062f\u0645 \u0645\u0633\u0628\u0642\u0627\u064b", "error", 4000);
        btn.disabled = false; btn.textContent = "\u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628";
        return;
      }
      const id = await S.addStudent({ name: name, username: username, password: pass });
      const student = await S.getStudent(id);

      // عرض كلمة المرور للتأكيد
      U.modal({
        title: "\u2705 \u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628\u0643",
        body:
          '<p class="muted mb">\u0627\u062d\u0641\u0638 \u0647\u0630\u0647 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u062c\u064a\u062f\u0627\u064b:</p>' +
          '<div class="student-info-row">' +
          '<div class="item"><div class="lbl">\u0627\u0644\u0627\u0633\u0645</div><div class="val">' + U.esc(name) + '</div></div>' +
          '<div class="item"><div class="lbl">\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631</div><div class="val" style="font-family:monospace;letter-spacing:2px">' + U.esc(pass) + '</div></div>' +
          '</div>' +
          '<div class="info-banner warning"><span class="emoji">\u26A0\uFE0F</span>' +
          '<div><b>\u0645\u0647\u0645 \u062c\u062f\u0627\u064b</b>\u0633\u062a\u062d\u062a\u0627\u062c \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0641\u064a \u0643\u0644 \u062f\u062e\u0648\u0644. \u0627\u062d\u0641\u0638\u0647\u0627 \u0641\u064a \u0645\u0643\u0627\u0646 \u0622\u0645\u0646.</div></div>',
        footer: '<button class="btn btn-primary" data-continue>\u0645\u062a\u0627\u0628\u0639\u0629</button>',
        onMount: function (node, close) {
          node.querySelector("[data-continue]").addEventListener("click", function () {
            close();
            st.student = student;
            setSession(student);
            routeAfterLogin();
          });
        }
      });
    } catch (e) {
      U.toast("Error: " + e.message, "error");
      btn.disabled = false; btn.textContent = "\u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628";
    }
  }

  /* ============================================================
   * ROUTE AFTER LOGIN
   * ============================================================ */
  async function routeAfterLogin() {
    if (!st.student) return renderAuth();
    // ابحث عن مجموعة الطالب
    const enrollment = await S.getEnrollment(st.student.id);
    if (!enrollment || !enrollment.groupId) {
      // لا يوجد انضمام → اعرض المجموعات
      return renderGroupsList();
    }
    // تحقق من وجود المجموعة
    const group = await S.getGroup(enrollment.groupId);
    if (!group) {
      return renderGroupsList();
    }
    st.group = group;
    renderDashboard();
  }

  /* ============================================================
   * GROUPS LIST (اختيار مجموعة)
   * ============================================================ */
  async function renderGroupsList() {
    view('<div class="container">' + U.loaderHTML() + '</div>');
    try {
      const groups = await S.listGroups();
      const subjects = await S.listSubjects();

      const activeGroups = groups.filter(function (g) { return g.active !== false; });

      const content = activeGroups.length
        ? '<div class="groups-grid">' + activeGroups.map(function (g) {
          const assignments = g.teacherAssignments || [];
          const teachersTxt = assignments.length
            ? assignments.map(function (a) {
              const subj = subjects.find(function (s) { return s.id === a.subjectId; });
              return U.esc(a.teacherName) + " (" + U.esc(subj ? subj.name : "?") + ")";
            }).join(" \u2022 ")
            : "\u0644\u0645 \u064a\u064f\u0639\u064a\u0651\u064e\u0646 \u0628\u0639\u062f";

          return '<div class="group-card">' +
            '<div class="group-card-head">' +
            '<div class="group-emoji">\uD83D\uDC65</div>' +
            '<div class="group-info">' +
            '<h3>' + U.esc(g.name) + '</h3>' +
            (g.description ? '<p class="muted tiny">' + U.esc(g.description) + '</p>' : "") +
            '</div>' +
            '</div>' +
            '<div class="group-meta mb">' +
            '<span class="badge badge-primary">\uD83D\uDC66 ' + (g.studentCount || 0) + ' \u0637\u0627\u0644\u0628</span>' +
            '</div>' +
            '<div class="mb"><b class="tiny">\u0627\u0644\u0645\u0639\u0644\u0645\u0648\u0646 \u0627\u0644\u0645\u0635\u062d\u0651\u062d\u0648\u0646:</b><br>' +
            '<span class="tiny muted">' + teachersTxt + '</span></div>' +
            '<button class="btn btn-primary btn-block" data-join="' + g.id + '">\u0627\u0646\u0636\u0645\u0627\u0645 \u0644\u0644\u0645\u062c\u0645\u0648\u0639\u0629</button>' +
            '</div>';
        }).join("") + '</div>'
        : '<div class="empty-state"><div class="emoji">\uD83D\uDC65</div>' +
        '<h3>\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u062c\u0645\u0648\u0639\u0627\u062a \u0645\u062a\u0627\u062d\u0629</h3>' +
        '<p>\u062a\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u062f\u064a\u0631</p></div>';

      view(
        '<div class="container container-narrow">' +
        '<div class="student-hero">' +
        '<div class="greeting">\u0645\u0631\u062d\u0628\u0627 ' + U.esc(st.student.name) + ' \uD83D\uDC4B</div>' +
        '<div class="subtitle">\u0627\u062e\u062a\u0631 \u0645\u062c\u0645\u0648\u0639\u0629 \u0644\u0644\u0627\u0646\u0636\u0645\u0627\u0645</div>' +
        '</div>' +
        '<div class="card-head"><h2>\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a \u0627\u0644\u0645\u062a\u0627\u062d\u0629</h2>' +
        '<div class="spacer"></div>' +
        '<button class="btn btn-sm" id="logoutBtn">\uD83D\uDEAA \u062e\u0631\u0648\u062c</button></div>' +
        content +
        '</div>'
      );

      document.getElementById("logoutBtn").addEventListener("click", doLogout);
      document.querySelectorAll("[data-join]").forEach(function (b) {
        b.addEventListener("click", function () { joinGroup(b.dataset.join); });
      });
    } catch (e) {
      view('<div class="container container-narrow"><div class="card"><div class="empty-state">' +
        '<div class="emoji">\u26D4</div><h3>\u062e\u0637\u0623</h3><p>' + U.esc(e.message) + '</p></div></div></div>');
    }
  }

  async function joinGroup(groupId) {
    if (!await U.confirm("\u0628\u0639\u062f \u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645 \u0644\u0646 \u062a\u062a\u0645\u0643\u0646 \u0645\u0646 \u0627\u0644\u0627\u0646\u062a\u0642\u0627\u0644 \u0644\u0645\u062c\u0645\u0648\u0639\u0629 \u0623\u062e\u0631\u0649. \u0645\u062a\u0623\u0643\u062f\u061f")) return;
    try {
      const group = await S.getGroup(groupId);
      if (!group || group.active === false) return U.toast("\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629", "error");

      await S.enrollStudent(st.student.id, groupId, st.student.name);
      st.group = group;
      U.toast("\u062a\u0645 \u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645 \u0625\u0644\u0649 " + group.name, "success");
      renderDashboard();
    } catch (e) {
      U.toast("Error: " + e.message, "error");
    }
  }

  /* ============================================================
   * DASHBOARD - لوحة الطالب
   * ============================================================ */
  async function renderDashboard() {
    if (!st.group) return routeAfterLogin();
    view('<div class="container">' + U.loaderHTML() + '</div>');

    try {
      const group = st.group;
      const subjects = await S.listSubjects();
      const exams = await S.listExamsForGroup(group.id);
      const submissions = await S.listSubmissionsByStudent(st.student.id);

      // ربط التسليمات بالاختبارات
      const subByExam = {};
      submissions.forEach(function (s) { subByExam[s.examId] = s; });

      const available = [];
      const upcoming = [];
      const expired = [];
      const completed = [];

      exams.forEach(function (e) {
        const avail = U.examAvailability(e);
        const sub = subByExam[e.id];
        const item = { exam: e, status: avail, submission: sub };
        if (sub) completed.push(item);
        else if (avail === "expired") expired.push(item);
        else if (avail === "upcoming") upcoming.push(item);
        else available.push(item);
      });

      // ترتيب الأحدث أولاً
      [available, upcoming, expired, completed].forEach(function (arr) {
        arr.sort(function (a, b) {
          const da = a.exam.createdAt && a.exam.createdAt.toDate ? a.exam.createdAt.toDate().getTime() : 0;
          const db = b.exam.createdAt && b.exam.createdAt.toDate ? b.exam.createdAt.toDate().getTime() : 0;
          return db - da;
        });
      });

      const renderCard = function (item) {
        const e = item.exam;
        const sub = item.submission;
        const state = item.status;
        let cls = "", actions = "", statusBadge = "";

        if (sub) {
          cls = "completed";
          statusBadge = U.submissionStatusBadge(sub.status);
          if (sub.status === "graded") {
            actions = '<button class="btn btn-primary btn-sm" data-view-result="' + sub.id + '">\uD83D\uDCCA \u0639\u0631\u0636 \u0627\u0644\u0646\u062a\u064a\u062c\u0629</button>';
          } else {
            actions = '<span class="badge badge-warning">\u23F3 \u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u062a\u0635\u062d\u064a\u062d</span>';
          }
        } else if (state === "expired") {
          cls = "expired";
          actions = '<span class="badge badge-danger">\u0627\u0646\u062a\u0647\u062a \u0627\u0644\u0645\u062f\u0629</span>';
        } else if (state === "upcoming") {
          cls = "upcoming";
          const until = U.timeUntil(e.openAt);
          statusBadge = '<span class="badge badge-warning">\u064a\u0641\u062a\u062d \u0628\u0639\u062f ' + (until || "?") + '</span>';
          actions = '<span class="muted tiny">\u064a\u0641\u062a\u062d: ' + U.formatDate(e.openAt) + '</span>';
        } else {
          cls = "available";
          statusBadge = '<span class="badge badge-success">\u0645\u062a\u0627\u062d \u0627\u0644\u0622\u0646</span>';
          actions = '<button class="btn btn-primary btn-sm" data-start="' + e.id + '">\u25B6 \u0627\u0628\u062f\u0623 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631</button>';
        }

        // الوقت المتبقي للإغلاق
        let closeHint = "";
        if (e.closeAt && !sub && state === "available") {
          const until = U.timeUntil(e.closeAt);
          if (until) closeHint = '<span class="badge badge-danger">\u064a\u063a\u0644\u0642 \u0628\u0639\u062f ' + until + '</span>';
        }

        return '<div class="exam-card ' + cls + '">' +
          '<div class="exam-title">' + U.esc(e.title) + '</div>' +
          '<div class="exam-meta">' +
          '<span class="badge badge-muted">\uD83D\uDCD8 ' + U.esc(e.subjectName || "-") + '</span>' +
          '<span class="badge badge-muted">\u2753 ' + (e.questions || []).length + ' \u0633\u0624\u0627\u0644</span>' +
          (e.durationMin ? '<span class="badge badge-muted">\u23F1 ' + e.durationMin + ' \u062f</span>' : "") +
          statusBadge +
          closeHint +
          '</div>' +
          (e.description ? '<p class="tiny muted">' + U.esc(e.description) + '</p>' : "") +
          '<div class="exam-actions">' + actions + '</div>' +
          '</div>';
      };

      const teachersTxt = (group.teacherAssignments || []).map(function (a) {
        const subj = subjects.find(function (s) { return s.id === a.subjectId; });
        return U.esc(a.teacherName) + " (" + U.esc(subj ? subj.name : "?") + ")";
      }).join(" \u2022 ") || "\u0644\u0645 \u064a\u064f\u0639\u064a\u0651\u064e\u0646 \u0628\u0639\u062f";

      view(
        '<div class="container container-narrow">' +
        '<div class="student-hero">' +
        '<div class="flex flex-wrap" style="justify-content:space-between;gap:10px">' +
        '<div>' +
        '<div class="greeting">\u0645\u0631\u062d\u0628\u0627 ' + U.esc(st.student.name) + ' \uD83D\uDC4B</div>' +
        '<div class="subtitle">\u0645\u062c\u0645\u0648\u0639\u062a\u0643: <b>' + U.esc(group.name) + '</b></div>' +
        '<div class="tiny muted">\u0627\u0644\u0645\u0639\u0644\u0645\u0648\u0646: ' + teachersTxt + '</div>' +
        '</div>' +
        '<div>' +
        '<button class="btn btn-sm" id="logoutBtn">\uD83D\uDEAA \u062e\u0631\u0648\u062c</button>' +
        '</div>' +
        '</div>' +
        '</div>' +

        (available.length ?
          '<div class="card-head"><h3>\uD83D\uDFE2 \u0627\u0644\u0645\u062a\u0627\u062d\u0629 \u0627\u0644\u0622\u0646</h3>' +
          '<span class="badge badge-success">' + available.length + '</span></div>' +
          '<div class="exams-grid mb">' + available.map(renderCard).join("") + '</div>' : "") +

        (upcoming.length ?
          '<div class="card-head"><h3>\uD83D\uDFE1 \u0627\u0644\u0642\u0627\u062f\u0645\u0629</h3>' +
          '<span class="badge badge-warning">' + upcoming.length + '</span></div>' +
          '<div class="exams-grid mb">' + upcoming.map(renderCard).join("") + '</div>' : "") +

        (completed.length ?
          '<div class="card-head"><h3>\u2705 \u0627\u0644\u0645\u064f\u0643\u0645\u0644\u0629</h3>' +
          '<span class="badge badge-info">' + completed.length + '</span></div>' +
          '<div class="exams-grid mb">' + completed.map(renderCard).join("") + '</div>' : "") +

        (expired.length ?
          '<div class="card-head"><h3>\uD83D\uDD34 \u0627\u0644\u0645\u0646\u062a\u0647\u064a\u0629</h3>' +
          '<span class="badge badge-danger">' + expired.length + '</span></div>' +
          '<div class="exams-grid">' + expired.map(renderCard).join("") + '</div>' : "") +

        (!exams.length ? '<div class="empty-state"><div class="emoji">\uD83D\uDCDA</div>' +
          '<h3>\u0644\u0627 \u062a\u0648\u062c\u062f \u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a</h3>' +
          '<p>\u0644\u0645 \u064a\u0646\u0634\u0631 \u0627\u0644\u0645\u062f\u064a\u0631 \u0623\u064a \u0627\u062e\u062a\u0628\u0627\u0631 \u0644\u0645\u062c\u0645\u0648\u0639\u062a\u0643 \u0628\u0639\u062f</p></div>' : "") +
        '</div>'
      );

      document.getElementById("logoutBtn").addEventListener("click", doLogout);
      document.querySelectorAll("[data-start]").forEach(function (b) {
        b.addEventListener("click", function () { startExam(b.dataset.start); });
      });
      document.querySelectorAll("[data-view-result]").forEach(function (b) {
        b.addEventListener("click", function () { viewResult(b.dataset.viewResult); });
      });
    } catch (e) {
      view('<div class="container container-narrow"><div class="card"><div class="empty-state">' +
        '<div class="emoji">\u26D4</div><h3>\u062e\u0637\u0623</h3><p>' + U.esc(e.message) + '</p></div></div></div>');
    }
  }

  function doLogout() {
    if (!confirm("\u0647\u0644 \u062a\u0631\u064a\u062f \u0627\u0644\u062e\u0631\u0648\u062c\u061f")) return;
    clearSession();
    st.student = null;
    st.group = null;
    U.toast("\u062a\u0645 \u0627\u0644\u062e\u0631\u0648\u062c", "success");
    renderAuth("login");
  }

  /* ============================================================
   * EXAM FLOW
   * ============================================================ */
  async function startExam(examId) {
    const exam = await S.getExam(examId);
    if (!exam) return U.toast("\u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f", "error");

    const existing = await S.findSubmission(examId, st.student.id);
    if (existing) return U.toast("\u0644\u0642\u062f \u0633\u0644\u0651\u0645\u062a \u0647\u0630\u0627 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0645\u0633\u0628\u0642\u0627\u064b", "warn");

    st.exam = exam;
    st.settings = exam.settings || {};

    // ابدأ الاختبار
    view(
      '<div class="container container-narrow">' +
      '<div class="card mt">' +
      '<div class="emoji" style="font-size:48px;text-align:center">\uD83D\uDCDD</div>' +
      '<h2 style="text-align:center">' + U.esc(exam.title) + '</h2>' +
      '<div class="flex flex-wrap mt" style="justify-content:center">' +
      '<span class="badge badge-muted">\u2753 ' + (exam.questions || []).length + ' \u0633\u0624\u0627\u0644</span>' +
      (exam.durationMin ? '<span class="badge badge-muted">\u23F1 ' + exam.durationMin + ' \u062f\u0642\u064a\u0642\u0629</span>' : '<span class="badge badge-muted">\u23F1 \u0628\u062f\u0648\u0646 \u0648\u0642\u062a</span>') +
      '<span class="badge badge-muted">\uD83C\uDFAF ' + (exam.totalPoints || exam.questions.length) + ' \u062f\u0631\u062c\u0629</span>' +
      '</div>' +
      '<div class="info-banner warning mt">' +
      '<span class="emoji">\u26A0\uFE0F</span>' +
      '<div><b>\u062a\u0646\u0628\u064a\u0647</b> \u0628\u0639\u062f \u0627\u0644\u062a\u0633\u0644\u064a\u0645 \u0644\u0646 \u062a\u0638\u0647\u0631 \u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u0641\u0648\u0631\u0627\u064b\u060c ' +
      '\u0633\u064a\u0631\u0627\u062c\u0639\u0647\u0627 \u0627\u0644\u0645\u0639\u0644\u0645 \u0648\u064a\u0639\u062a\u0645\u062f\u0647\u0627</div></div>' +
      '<button class="btn btn-primary btn-block mt" id="beginBtn">\u25B6 \u0627\u0628\u062f\u0623 \u0627\u0644\u062d\u0644</button>' +
      '<button class="btn btn-ghost btn-block mt-sm" id="cancelBtn">\u0631\u062c\u0648\u0639</button>' +
      '</div></div>'
    );

    document.getElementById("beginBtn").addEventListener("click", beginExamFlow);
    document.getElementById("cancelBtn").addEventListener("click", renderDashboard);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function beginExamFlow() {
    let qs = st.exam.questions.map(function (q) { return Object.assign({}, q); });
    if (st.settings.shuffleQuestions) qs = shuffle(qs);
    st.questions = qs;
    st.answers = qs.map(function (q) { return q.type === "multi" ? [] : ""; });
    st.flags = [];
    st.current = 0;
    st.startMs = Date.now();
    st.submitted = false;

    const mins = st.exam.durationMin || 0;
    if (mins) {
      st.remaining = mins * 60;
      clearInterval(st.timerId);
      st.timerId = setInterval(tick, 1000);
    } else {
      st.remaining = 0;
    }

    renderExam();
  }

  function tick() {
    if (st.submitted) return;
    st.remaining--;
    if (st.remaining <= 0) {
      st.remaining = 0;
      clearInterval(st.timerId);
      U.toast("\u0627\u0646\u062a\u0647\u0649 \u0627\u0644\u0648\u0642\u062a", "warn");
      submitExam(true);
      return;
    }
    const el = document.getElementById("examTimer");
    if (el) {
      el.textContent = U.formatDuration(st.remaining);
      el.className = "timer" + (st.remaining <= 30 ? " danger" : st.remaining <= 120 ? " warn" : "");
    }
  }

  function renderExam() {
    const q = st.questions[st.current];
    const total = st.questions.length;
    const answeredCount = st.answers.filter(function (a) {
      return Array.isArray(a) ? a.length : (a !== "" && a !== null && a !== undefined);
    }).length;
    const progress = Math.round((answeredCount / total) * 100);

    const topbar =
      '<div class="exam-topbar">' +
      '<div><div class="tiny">' + U.esc(st.exam.title) + '</div>' +
      '<div style="font-weight:700">' + U.esc(st.student.name) + '</div></div>' +
      '<div class="spacer"></div>' +
      '<div class="timer" id="examTimer">' + (st.exam.durationMin ? U.formatDuration(st.remaining) : "\u221E") + '</div>' +
      '<button class="btn btn-sm" id="flagBtn">' + (st.flags[st.current] ? "\uD83D\uDEA9" : "\uD83C\uDFF3") + '</button>' +
      '<button class="btn btn-success btn-sm" id="submitBtn">\u062a\u0633\u0644\u064a\u0645</button>' +
      '</div>';

    const qnav = '<div class="q-nav mt">' + st.questions.map(function (_, i) {
      const ans = st.answers[i];
      const answered = Array.isArray(ans) ? ans.length : (ans !== "" && ans !== null && ans !== undefined);
      return '<button class="q-dot' + (answered ? " answered" : "") + (st.flags[i] ? " flagged" : "") + (i === st.current ? " current" : "") + '" data-go="' + i + '">' + (i + 1) + "</button>";
    }).join("") + '</div>';

    view(
      '<div class="container"><div class="exam-shell">' +
      topbar +
      '<div class="card" style="padding:16px 18px;margin-bottom:14px">' +
      '<div class="flex"><span class="tiny">\u0627\u0644\u062a\u0642\u062f\u0645: ' + answeredCount + " / " + total + '</span>' +
      '<div class="spacer right tiny">' + progress + '%</div></div>' +
      '<div class="progress mt-sm"><span style="width:' + progress + '%"></span></div>' +
      '</div>' +
      '<div class="q-card">' +
      '<div class="q-index">\u0627\u0644\u0633\u0624\u0627\u0644 ' + (st.current + 1) + " \u0645\u0646 " + total + " \u00B7 " + (U.TYPE_LABELS[q.type] || q.type) + " \u00B7 " + (q.points || 1) + ' \u062f\u0631\u062c\u0629</div>' +
      '<div class="q-text">' + U.esc(q.text) + '</div>' +
      '<div id="qBody">' + renderQuestionBody(q, st.answers[st.current]) + '</div>' +
      '<div class="q-actions">' +
      '<button class="btn" id="prevBtn"' + (st.current === 0 ? " disabled" : "") + '>\u0627\u0644\u0633\u0627\u0628\u0642</button>' +
      '<div class="spacer"></div>' +
      (st.current < total - 1
        ? '<button class="btn btn-primary" id="nextBtn">\u0627\u0644\u062a\u0627\u0644\u064a</button>'
        : '<button class="btn btn-success" id="finishBtn">\u0625\u0646\u0647\u0627\u0621</button>') +
      '</div></div>' +
      '<div class="card"><div class="tiny mb">\u0627\u0644\u062a\u0646\u0642\u0651\u0644 \u0627\u0644\u0633\u0631\u064a\u0639</div>' + qnav + '</div>' +
      '</div></div>'
    );

    bindExam();
  }

  function renderQuestionBody(q, val) {
    if (q.type === "mcq" || q.type === "true_false") {
      const opts = q.type === "true_false" ? ["\u0635\u062d", "\u062e\u0637\u0623"] : q.options;
      return opts.map(function (o) {
        const sel = val === o ? " selected" : "";
        return '<div class="opt' + sel + '" data-opt="' + U.esc(o) + '">' +
          '<span class="mark">' + (val === o ? "\u2713" : "") + '</span>' +
          '<span>' + U.esc(o) + '</span></div>';
      }).join("");
    }
    if (q.type === "multi") {
      const arr = Array.isArray(val) ? val : [];
      return (q.options || []).map(function (o) {
        const sel = arr.indexOf(o) >= 0 ? " selected" : "";
        return '<div class="opt' + sel + '" data-multi="' + U.esc(o) + '">' +
          '<span class="mark">' + (arr.indexOf(o) >= 0 ? "\u2713" : "") + '</span>' +
          '<span>' + U.esc(o) + '</span></div>';
      }).join("");
    }
    if (q.type === "fill_blank") {
      return '<input id="textAnswer" placeholder="\u0627\u0643\u062a\u0628 \u0625\u062c\u0627\u0628\u062a\u0643" value="' + U.esc(val || "") + '">';
    }
    return '<textarea id="textAnswer" style="min-height:120px" placeholder="\u0627\u0643\u062a\u0628 \u0625\u062c\u0627\u0628\u062a\u0643...">' + U.esc(val || "") + '</textarea>';
  }

  function captureCurrent() {
    const q = st.questions[st.current];
    if (q.type === "mcq" || q.type === "true_false") {
      const sel = document.querySelector(".opt.selected");
      if (sel) st.answers[st.current] = sel.dataset.opt;
    } else if (q.type === "fill_blank" || q.type === "short_answer" || q.type === "essay") {
      const ta = document.getElementById("textAnswer");
      if (ta) st.answers[st.current] = ta.value.trim();
    }
  }

  function bindExam() {
    document.querySelectorAll("[data-opt]").forEach(function (el) {
      el.addEventListener("click", function () {
        document.querySelectorAll("[data-opt]").forEach(function (x) {
          x.classList.remove("selected");
          x.querySelector(".mark").textContent = "";
        });
        el.classList.add("selected");
        el.querySelector(".mark").textContent = "\u2713";
        st.answers[st.current] = el.dataset.opt;
        updateNavDots();
      });
    });
    document.querySelectorAll("[data-multi]").forEach(function (el) {
      el.addEventListener("click", function () {
        const o = el.dataset.multi;
        let arr = Array.isArray(st.answers[st.current]) ? st.answers[st.current].slice() : [];
        if (arr.indexOf(o) >= 0) {
          arr = arr.filter(function (x) { return x !== o; });
          el.classList.remove("selected");
          el.querySelector(".mark").textContent = "";
        } else {
          arr.push(o);
          el.classList.add("selected");
          el.querySelector(".mark").textContent = "\u2713";
        }
        st.answers[st.current] = arr;
        updateNavDots();
      });
    });
    const ta = document.getElementById("textAnswer");
    if (ta) ta.addEventListener("input", function () {
      st.answers[st.current] = ta.value.trim();
      updateNavDots();
    });

    document.getElementById("prevBtn").addEventListener("click", function () {
      captureCurrent(); st.current--; renderExam();
    });
    const nb = document.getElementById("nextBtn");
    if (nb) nb.addEventListener("click", function () {
      captureCurrent(); st.current++; renderExam();
    });
    const fb = document.getElementById("finishBtn");
    if (fb) fb.addEventListener("click", function () { captureCurrent(); submitExam(false); });
    document.getElementById("submitBtn").addEventListener("click", function () { captureCurrent(); submitExam(false); });
    document.getElementById("flagBtn").addEventListener("click", function () {
      st.flags[st.current] = !st.flags[st.current];
      renderExam();
    });
    document.querySelectorAll("[data-go]").forEach(function (b) {
      b.addEventListener("click", function () {
        captureCurrent();
        st.current = Number(b.dataset.go);
        renderExam();
      });
    });
  }

  function updateNavDots() {
    document.querySelectorAll(".q-dot").forEach(function (d, i) {
      const ans = st.answers[i];
      const answered = Array.isArray(ans) ? ans.length : (ans !== "" && ans !== null && ans !== undefined);
      d.classList.toggle("answered", answered);
    });
  }

  /* ============================================================
   * SUBMIT
   * ============================================================ */
  async function submitExam(auto) {
    if (st.submitted) return;
    const unanswered = st.answers.filter(function (a) {
      return Array.isArray(a) ? !a.length : (a === "" || a === null || a === undefined);
    }).length;
    if (!auto && unanswered > 0) {
      if (!await U.confirm("\u0644\u062f\u064a\u0643 " + unanswered + " \u0633\u0624\u0627\u0644 \u0628\u062f\u0648\u0646 \u0625\u062c\u0627\u0628\u0629. \u0647\u0644 \u062a\u0631\u064a\u062f \u0627\u0644\u062a\u0633\u0644\u064a\u0645\u061f", { yes: "\u062a\u0633\u0644\u064a\u0645" })) return;
    }
    st.submitted = true;
    clearInterval(st.timerId);

    const graded = st.questions.map(function (q, i) {
      const pts = Number(q.points) || 1;
      const given = st.answers[i];
      let autoCorrect = null;
      if (q.type === "mcq" || q.type === "true_false") {
        autoCorrect = given !== "" && U.sameAnswer(given, q.answer);
      } else if (q.type === "multi") {
        const g = (given || []).map(U.normalizeArabic).sort().join("|");
        const c = (Array.isArray(q.answer) ? q.answer : [q.answer]).map(U.normalizeArabic).sort().join("|");
        autoCorrect = g !== "" && g === c;
      } else if (q.type === "fill_blank" || q.type === "short_answer") {
        autoCorrect = U.acceptedAnswers(q.answer).some(function (a) { return U.sameAnswer(a, given); });
      } else {
        autoCorrect = null; // essay
      }
      return {
        qIndex: i, type: q.type, text: q.text,
        options: q.options || [], given: given,
        correctAnswer: q.answer, explanation: q.explanation || "",
        autoCorrect: autoCorrect, finalCorrect: autoCorrect,
        earned: null, points: pts, teacherNote: ""
      };
    });

    const durationSec = Math.floor((Date.now() - st.startMs) / 1000);
    const total = graded.reduce(function (s, g) { return s + g.points; }, 0);
    const nowIso = new Date().toISOString();

    const submission = {
      examId: st.exam.id,
      examCode: st.exam.code,
      examTitle: st.exam.title,
      subjectId: st.exam.subjectId || "",
      subjectName: st.exam.subjectName || "",
      groupId: st.group.id,
      groupName: st.group.name,
      studentId: st.student.id,
      studentName: st.student.name,
      studentNameNormalized: U.normalizeArabic(st.student.name),
      answers: graded,
      total: total,
      score: null,
      percent: null,
      passed: null,
      durationSec: durationSec,
      status: "pending",
      needsManualReview: true,
      gradedBy: null,
      gradedByTeacherId: null,
      gradedAt: null,
      createdAt: nowIso,
      autoSubmit: !!auto
    };

    try {
      await S.addSubmission(submission);
    } catch (e) {
      U.toast("\u062a\u0639\u0630\u0631 \u0627\u0644\u062d\u0641\u0638: " + e.message, "error", 5000);
    }
    renderSubmitted();
  }

  function renderSubmitted() {
    view(
      '<div class="container container-narrow">' +
      '<div class="card mt">' +
      '<div class="waiting-screen">' +
      '<div class="pulse-icon">\uD83D\uDCE8</div>' +
      '<h2>\u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0625\u062c\u0627\u0628\u0627\u062a\u0643</h2>' +
      '<p class="hint">\u0634\u0643\u0631\u0627\u064b \u0644\u0643 \u064a\u0627 ' + U.esc(st.student.name) + '</p>' +
      '<div class="info-banner warning" style="text-align:start">' +
      '<span class="emoji">\u23F3</span>' +
      '<div><b>\u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u0644\u0645 \u062a\u0635\u062f\u0631 \u0628\u0639\u062f</b>' +
      '\u0633\u064a\u0631\u0627\u062c\u0639 \u0627\u0644\u0645\u0639\u0644\u0645 \u0625\u062c\u0627\u0628\u0627\u062a\u0643 \u0648\u064a\u0639\u062a\u0645\u062f \u0627\u0644\u062f\u0631\u062c\u0629. ' +
      '\u0639\u0646\u062f\u0645\u0627 \u064a\u062a\u0645 \u0627\u0644\u0627\u0639\u062a\u0645\u0627\u062f\u060c \u0633\u062a\u0631\u0649 \u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u0641\u064a \u0644\u0648\u062d\u062a\u0643.</div>' +
      '</div>' +
      '<button class="btn btn-primary btn-block mt" id="backBtn">\u0631\u062c\u0648\u0639 \u0644\u0644\u0648\u062d\u0629</button>' +
      '</div></div></div>'
    );
    document.getElementById("backBtn").addEventListener("click", renderDashboard);
  }

  /* ============================================================
   * VIEW RESULT (بعد الاعتماد)
   * ============================================================ */
  async function viewResult(submissionId) {
    const sub = await S.getSubmissionById(submissionId);
    if (!sub) return U.toast("\u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f", "error");
    if (sub.status !== "graded") return U.toast("\u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u0644\u0645 \u062a\u0635\u062f\u0631 \u0628\u0639\u062f", "warn");

    const circumference = 2 * Math.PI * 80;
    const dash = ((sub.percent || 0) / 100) * circumference;
    const ringColor = U.pctColor(sub.percent || 0);
    const banner = sub.percent >= 85 ? "\uD83C\uDFC6" : sub.percent >= 50 ? "\uD83C\uDF89" : "\uD83D\uDCD8";

    let reviewHTML = "";
    const settings = (st.exam && st.exam.settings) || {};
    reviewHTML = '<div class="card"><div class="card-head"><h3>\u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u0625\u062c\u0627\u0628\u0627\u062a</h3></div>' +
      (sub.answers || []).map(function (a, i) {
        const givenTxt = Array.isArray(a.given) ? a.given.join(" \u060C ") : (a.given || "-");
        const ansTxt = Array.isArray(a.correctAnswer) ? a.correctAnswer.join(" \u060C ") : (a.correctAnswer || "-");
        const ok = a.finalCorrect === true;
        const earnedTxt = (a.earned !== null && a.earned !== undefined) ? a.earned : (ok ? a.points : 0);
        return '<div class="grade-answer ' + (ok ? "correct" : "wrong") + '">' +
          '<div class="q-index">\u0627\u0644\u0633\u0624\u0627\u0644 ' + (i + 1) + " \u2014 " + U.badgeForType(a.type) +
          (ok ? ' <span class="badge badge-success">\u2713 +' + earnedTxt + '</span>' : ' <span class="badge badge-danger">\u2717 ' + earnedTxt + '</span>') +
          '</div>' +
          '<div style="font-weight:700;margin:6px 0">' + U.esc(a.text || "") + '</div>' +
          '<div class="rev-line"><span class="muted">\u0625\u062c\u0627\u0628\u062a\u0643:</span> <b style="color:' + (ok ? "var(--success)" : "var(--danger)") + '">' + U.esc(givenTxt) + '</b></div>' +
          '<div class="rev-line"><span class="muted">\u0627\u0644\u0635\u062d\u064a\u062d\u0629:</span> <b>' + U.esc(ansTxt) + '</b></div>' +
          (a.teacherNote ? '<div class="rev-line muted">\uD83D\uDCDD <b>\u0645\u0644\u0627\u062d\u0638\u0629 \u0627\u0644\u0645\u0639\u0644\u0645:</b> ' + U.esc(a.teacherNote) + '</div>' : "") +
          (a.explanation ? '<div class="rev-line muted">\uD83D\uDCA1 ' + U.esc(a.explanation) + '</div>' : "") +
          '</div>';
      }).join("") + "</div>";

    view(
      '<div class="container"><div class="exam-shell">' +
      '<div class="card result-banner">' +
      '<div class="emoji">' + banner + '</div>' +
      '<h2>\u0646\u062a\u064a\u062c\u062a\u0643</h2>' +
      '<div class="score-ring mt">' +
      '<svg width="190" height="190"><circle cx="95" cy="95" r="80" stroke="var(--surface-3)" stroke-width="14" fill="none"></circle>' +
      '<circle cx="95" cy="95" r="80" stroke="' + ringColor + '" stroke-width="14" fill="none" stroke-linecap="round" stroke-dasharray="' + dash + " " + circumference + '"></circle></svg>' +
      '<div class="center"><div class="pct" style="color:' + ringColor + '">' + sub.percent + '%</div>' +
      '<div class="tiny">' + sub.score + " / " + sub.total + ' \u062f\u0631\u062c\u0629</div></div>' +
      '</div>' +
      '<div class="flex flex-wrap mt" style="justify-content:center">' +
      '<span class="badge ' + (sub.passed ? "badge-success" : "badge-danger") + '">' + (sub.passed ? "\u0646\u0627\u062c\u062d \u2705" : "\u0644\u0645 \u064a\u062c\u062a\u0632") + '</span>' +
      '<span class="badge badge-muted">\uD83D\uDC64 ' + U.esc(sub.studentName) + '</span>' +
      '<span class="badge badge-muted">\u23F1 ' + U.formatDuration(sub.durationSec) + '</span>' +
      '</div>' +
      (sub.gradedBy ? '<p class="tiny mt">\u0635\u062d\u0651\u062d\u0647\u0627: ' + U.esc(sub.gradedBy) + ' \u2014 ' + U.formatDate(sub.gradedAt) + '</p>' : "") +
      '<div class="flex mt" style="justify-content:center;gap:10px;flex-wrap:wrap">' +
      '<button class="btn" id="backBtn">\u0631\u062c\u0648\u0639</button>' +
      '<button class="btn" id="printBtn">\uD83D\uDDA8 \u0637\u0628\u0627\u0639\u0629</button>' +
      '</div>' +
      '</div>' +
      reviewHTML +
      '</div></div>'
    );

    document.getElementById("backBtn").addEventListener("click", renderDashboard);
    document.getElementById("printBtn").addEventListener("click", function () { window.print(); });
  }

  /* ============================================================
   * PUBLIC API
   * ============================================================ */
  QP.student = {
    render: function () {
      renderAuth("login");
    },
    goToDashboard: function () {
      routeAfterLogin();
    }
  };

  console.log("[student.js v4] QP.student loaded");
})();