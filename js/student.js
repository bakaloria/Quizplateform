/* student.js v4.1 - تسجيل + مجموعات + انتظار تصحيح + لوحة الطالب */
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
      '<button data-tab="guest">\u062f\u062e\u0648\u0644 \u0628\u0643\u0648\u062f \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631</button>' +
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

  /* رسالة التواصل مع مشرف التطبيق — تُقرأ من إعدادات المدير (settings/contact) */
  const DEFAULT_CONTACT = { text: "", phone: "", bg: "#f7fbff", marquee: "للتواصل مع مشرف التطبيق عبر واتساب" };

  function getContactMerged() {
    const base = DEFAULT_CONTACT;
    const c = st.contact || {};
    return {
      text: (c.text === undefined || c.text === null) ? base.text : String(c.text),
      phone: (c.phone === undefined || c.phone === null) ? base.phone : String(c.phone),
      bg: (c.bg === undefined || c.bg === null) ? base.bg : String(c.bg),
      marquee: (c.marquee === undefined || c.marquee === null) ? base.marquee : String(c.marquee)
    };
  }

  function contactMsgHTML() {
    const c = getContactMerged();
    const phone = (c.phone === undefined || c.phone === null) ? "" : String(c.phone).trim();
    let text = (c.text === undefined || c.text === null) ? "" : String(c.text);
    /* نحتفظ بالأسطر الجديدة لكن نُزيل الفراغات الزائدة من الأطراف */
    text = text.replace(/\r\n/g, "\n").trimEnd();
    const bg = (c.bg === undefined || c.bg === null) ? "" : String(c.bg).trim();
    let marquee = (c.marquee === undefined || c.marquee === null) ? DEFAULT_CONTACT.marquee : String(c.marquee).trim();
    if (marquee === "") marquee = DEFAULT_CONTACT.marquee;

    /* حالة 1: نص موجود (حتى لو مع أسطر) +/– رقم */
    if (text !== "") {
      const textHTML = '<span class="contact-text">' + U.esc(text) + "</span>";
      let inner;
      if (!phone) {
        inner = textHTML;
      } else {
        const cleanPhone = phone.replace(/[^\d+]/g, "");
        const display = phone.indexOf("wa.me") >= 0 ? phone : "wa.me/" + (cleanPhone.charAt(0) === "+" ? cleanPhone : "+" + cleanPhone);
        inner = textHTML + " " +
          '<a class="contact-link" href="https://wa.me/' + U.esc(cleanPhone) + '" target="_blank" rel="noopener">' + U.esc(display) + "</a>";
      }
      const style = bg ? ' style="background:' + U.esc(bg) + '"' : "";
      return '<div class="contact-box mt-sm"' + style + ">" + "💬 " + inner + "</div>";
    }

    /* حالة 2: نص فارغ + رقم موجود => يظهر الرقم داخل الإطار */
    if (text === "" && phone !== "") {
      const cleanPhone = phone.replace(/[^\d+]/g, "");
      const display = phone.indexOf("wa.me") >= 0 ? phone : "wa.me/" + (cleanPhone.charAt(0) === "+" ? cleanPhone : "+" + cleanPhone);
      const inner = '<a class="contact-link" href="https://wa.me/' + U.esc(cleanPhone) + '" target="_blank" rel="noopener">' + U.esc(display) + "</a>";
      const style = bg ? ' style="background:' + U.esc(bg) + '"' : "";
      return '<div class="contact-box mt-sm"' + style + ">" + "💬 " + inner + "</div>";
    }

    /* حالة 3: نص فارغ + رقم فارغ => شريط متحرك من اليمين إلى اليسار */
    const style = bg ? ' style="background:' + U.esc(bg) + '"' : "";
    return '<div class="contact-box contact-marquee mt-sm"' + style + ' aria-label="' + U.esc(marquee) + '">' +
      '<div class="contact-marquee-track">' +
      '<span>' + U.esc(marquee) + '</span>' +
      '<span>' + U.esc(marquee) + '</span>' +
      '<span>' + U.esc(marquee) + '</span>' +
      '<span>' + U.esc(marquee) + '</span>' +
      "</div></div>";
  }

  /* تحميل بيانات التواصل مرة واحدة وتحديث الواجهة إن كانت شاشة الدخول معروضة */
  (function loadContact() {
    /* أولوية للنسخة المحلية (لضمان ظهور التعديل الجديد فوراً) */
    try {
      const cached = localStorage.getItem("qp_contact");
      if (cached) {
        const c2 = JSON.parse(cached);
        if (c2 && (typeof c2.marquee === "string" || typeof c2.text === "string" || typeof c2.phone === "string")) {
          st.contact = {
            text: c2.text !== undefined ? c2.text : DEFAULT_CONTACT.text,
            phone: c2.phone !== undefined ? c2.phone : DEFAULT_CONTACT.phone,
            bg: c2.bg !== undefined ? c2.bg : DEFAULT_CONTACT.bg,
            marquee: typeof c2.marquee === "string" ? c2.marquee : DEFAULT_CONTACT.marquee
          };
          if (document.getElementById("authForm")) {
            const active = document.querySelector(".auth-tabs button.active");
            renderAuthForm(active ? active.dataset.tab : "login");
          }
        }
      }
    } catch (e) {}
    S.getContactInfo().then(function (c) {
      /* دمج مع القيم الافتراضية وضمان ظهور marquee حتى لو أتى من cache قديم */
      st.contact = {
        text: c.text !== undefined ? c.text : DEFAULT_CONTACT.text,
        phone: c.phone !== undefined ? c.phone : DEFAULT_CONTACT.phone,
        bg: c.bg !== undefined ? c.bg : DEFAULT_CONTACT.bg,
        marquee: typeof c.marquee === "string" ? c.marquee : DEFAULT_CONTACT.marquee
      };
      if (document.getElementById("authForm")) {
        const active = document.querySelector(".auth-tabs button.active");
        renderAuthForm(active ? active.dataset.tab : "login");
      }
    }).catch(function () { /* استخدم ما لدينا */ });
  })();

  function renderAuthForm(tab) {
    const form = document.getElementById("authForm");
    if (tab === "login") {
      form.innerHTML =
        '<div class="field"><label>\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644</label>' +
        '<input id="loginName" placeholder="\u0627\u0643\u062a\u0628 \u0627\u0633\u0645\u0643"></div>' +
        '<div class="field"><label>\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631</label>' +
        '<input type="password" id="loginPass" placeholder="6 \u0623\u062d\u0631\u0641 + \u0631\u0642\u0645\u0627\u0646"></div>' +
        '<button class="btn btn-primary btn-block" id="doLogin">\u062f\u062e\u0648\u0644</button>' +
        '<p class="help center mt-sm">\u0644\u0627 \u062a\u0645\u0644\u0643 \u062d\u0633\u0627\u0628\u0627\u064b\u061f \u0627\u062e\u062a\u0631 "\u062d\u0633\u0627\u0628 \u062c\u062f\u064a\u062f"</p>' +
        contactMsgHTML();

      U.focusFirstInput();
      document.getElementById("doLogin").addEventListener("click", doLogin);
      document.getElementById("loginPass").addEventListener("keydown", function (e) {
        if (e.key === "Enter") doLogin();
      });
    } else if (tab === "guest") {
      form.innerHTML =
        '<div class="field"><label>اسمك الكامل</label>' +
        '<input id="guestName" placeholder="اكتب اسمك كما تريد أن يظهر في النتيجة"></div>' +
        '<div class="field"><label>كود الاختبار</label>' +
        '<input id="guestCode" placeholder="مثال: ABC123" style="text-transform:uppercase;letter-spacing:4px;text-align:center"></div>' +
        '<button class="btn btn-primary btn-block" id="doGuest">دخول الاختبار</button>' +
        contactMsgHTML();

      U.focusFirstInput();
      document.getElementById("guestName").addEventListener("keydown", function (e) {
        if (e.key === "Enter") document.getElementById("guestCode").focus();
      });
      document.getElementById("guestCode").addEventListener("keydown", function (e) {
        if (e.key === "Enter") guestEnter();
      });
      document.getElementById("doGuest").addEventListener("click", guestEnter);
    } else {
      form.innerHTML =
        '<div class="field"><label>\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644 *</label>' +
        '<input id="regName" placeholder="\u0627\u0643\u062a\u0628 \u0627\u0633\u0645\u0643 \u0627\u0644\u0631\u0628\u0627\u0639\u064a"></div>' +
        '<div class="field"><label>\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 * (\u0666 \u0623\u062d\u0631\u0641 + \u0662 \u0631\u0642\u0645)</label>' +
        '<div class="flex"><input type="text" id="regPass" placeholder="abcdef12" style="font-family:monospace;font-size:18px;letter-spacing:3px;text-align:center">' +
        '<button class="btn btn-sm" id="genPass" type="button">\uD83C\uDFB2 \u062a\u0648\u0644\u064a\u062f</button></div>' +
        '<p class="help">\u0645\u062b\u0627\u0644 \u0635\u062d\u064a\u062d: <code>ahmedm23</code> \u2014 \u0645\u062b\u0627\u0644 \u062e\u0627\u0637\u0626: <code>ahmed123</code></p></div>' +
        '<button class="btn btn-primary btn-block" id="doRegister">\u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628</button>' +
        '<p class="help center mt-sm">\u0627\u062d\u0641\u0638 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u062c\u064a\u062f\u0627\u064b \u2014 \u0633\u062a\u062d\u062a\u0627\u062c\u0647\u0627 \u0644\u062f\u062e\u0648\u0644 \u0644\u0627\u062d\u0642</p>' +
        contactMsgHTML();

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

      // حالة طلبات الدفع (اختبار مدفوع): approved/pending/rejected
      const payByExam = await S.approvalMapForStudent(st.student.id);
      const notifs = S.listNotifications ? await S.listNotifications(st.student.id, 30) : [];
      const unread = S.countUnreadNotifications ? await S.countUnreadNotifications(st.student.id) : notifs.filter(function (n){return !n.read;}).length;

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
        if (e.isPaid && payByExam[e.id] !== "approved" && !sub && state === "available") {
          actions = '<span class="badge badge-warning">🔒 يتطلب تأكيد الدفع</span>';
        }
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
          (e.isPaid ? '<span class="badge badge-warning">💳 ' + U.esc(U.priceLabel(e)) + '</span>' : "") +
          '</div>' +
          (e.description ? '<p class="tiny muted">' + U.esc(e.description) + '</p>' : "") +
          '<div class="exam-actions">' + actions + '</div>' +
          (e.isPaid
            ? (function () {
                const ps = payByExam[e.id];
                const ok = ps === "approved";
                const statusHtml = ps
                  ? U.paymentStatusBadge(ps)
                  : '<span class="badge badge-muted">لم تُبلّغ عن الدفع بعد</span>';
                return '<div class="paid-box mt" style="border-top:1px dashed var(--border);margin-top:10px;padding-top:10px">' +
                  '<div class="flex" style="justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">' +
                  '<div><div><b>💳 اختبار مدفوع:</b> ' + U.esc(U.priceLabel(e)) + '</div>' +
                  '<div class="tiny muted">' + (ok ? 'تم تأكيد الدفع — يمكنك بدء الاختبار.' : 'ادفع قيمة الاختبار عبر شام كاش، ثم أبلغ المدير عبر واتساب ليؤكّد الدفع.') + '</div></div>' +
                  (e.qrImage
                    ? '<img alt="QR" data-qr-view="' + e.id + '" title="تكبير الرمز" src="' + U.esc(e.qrImage) + '" style="height:96px;width:96px;object-fit:contain;border-radius:10px;border:1px solid var(--border);background:#fff;padding:4px;cursor:zoom-in">'
                    : '<span class="tiny muted">لم يُرفَق رمز الدفع بعد</span>') +
                  '</div>' +
                  (ok
                    ? '<div class="mt-sm">' + statusHtml + '</div>'
                    : '<div class="mt-sm" style="border-top:1px solid var(--border);padding-top:8px">' +
                        '<div style="margin-bottom:8px">' + statusHtml + '</div>' +
                        '<div class="flex flex-wrap" style="gap:8px">' +
                          '<a class="btn btn-sm" data-pay-whatsapp="' + e.id + '" target="_blank" rel="noopener" href="' + U.esc(U.paymentWhatsAppLink(e, st.student)) + '" style="background:#25D366;color:#fff;border:none">📲 إبلاغ المدير أنني دفعت (واتساب)</a>' +
                        '</div>' +
                        (ps === "pending" ? '<div class="tiny muted mt-sm">تم إبلاغ المدير — بانتظار تأكيد الدفع.</div>' : "") +
                        (ps === "rejected" ? '<div class="tiny muted mt-sm">تم رفض الطلب — تواصل مع المدير.</div>' : "") +
                      '</div>') +
                  '</div>';
              })()
            : "") +
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
        '<div class="flex" style="gap:8px;align-items:center">' +
        '<button class="btn btn-sm" id="notifBtn">\uD83D\uDD14 ' + (unread ? '<span class="badge badge-danger">' + unread + '</span>' : '') + '</button>' +
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
      var nb = document.getElementById("notifBtn");
      if (nb) {
        nb.addEventListener("click", function () {
          var listHtml = (notifs.length ? notifs.map(function (n) {
            return '<div style="padding:10px 12px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;' + (n.read ? '' : 'background:var(--primary-soft)') + '">' +
              '<div style="font-weight:600">' + U.esc(n.title || '\u0625\u0634\u0639\u0627\u0631') + '</div>' +
              '<div class="tiny muted">' + U.esc(n.body || '') + '</div>' +
              '</div>';
          }).join('') : '<div class="empty-state"><div class="emoji">\ud83d\udd14</div><h3>\u0644\u0627 \u062a\u0648\u062c\u062f \u0625\u0634\u0639\u0627\u0631\u0627\u062a</h3></div>');
          U.modal({
            title: '\ud83d\udd14 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a',
            body: '<div style="max-height:60vh;overflow:auto">' + listHtml + '</div>',
            footer: '<button class="btn btn-primary btn-sm" id="markAll">\ud83d\udcd6 \u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0643\u0644 \u0643\u0645\u0642\u0631\u0648\u0621</button>'
          });
          setTimeout(function () {
            var ma = document.getElementById("markAll");
            if (ma) ma.addEventListener("click", async function () {
              try { if (S.markAllNotificationsRead) await S.markAllNotificationsRead(st.student.id); U.toast('\u062a\u0645 \u062a\u0639\u0644\u064a\u0645 \u0627\u0644\u0643\u0644 \u0643\u0645\u0642\u0631\u0648\u0621', 'success'); U.closeModal(); renderDashboard(); } catch (e) { U.toast('\u062e\u0637\u0623', 'error'); }
            });
          }, 50);
        });
      }
      document.querySelectorAll("[data-start]").forEach(function (b) {
        b.addEventListener("click", function () { startExam(b.dataset.start); });
      });
      document.querySelectorAll("[data-view-result]").forEach(function (b) {
        b.addEventListener("click", function () { viewResult(b.dataset.viewResult); });
      });
      document.querySelectorAll("[data-qr-view]").forEach(function (img) {
        img.addEventListener("click", function () {
          const e = exams.find(function (x) { return x.id === img.dataset.qrView; }) || {};
          U.modal({
            title: "💳 الدفع — " + (e.title || ""),
            body: '<div style="text-align:center">' +
              '<div class="mb"><b>' + U.esc(U.priceLabel(e)) + '</b></div>' +
              '<img alt="QR" src="' + U.esc(e.qrImage || "") + '" style="max-width:320px;width:100%;border-radius:12px;background:#fff;padding:8px">' +
              '</div>'
          });
        });
      });
      document.querySelectorAll("[data-pay-whatsapp]").forEach(function (a) {
        a.addEventListener("click", function () {
          const examId = a.dataset.payWhatsapp;
          const exam = exams.find(function (x) { return x.id === examId; });
          if (exam) sendPaymentNotice(exam);
        });
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
  /* إبلاغ المدير بالدفع عبر واتساب + تسجيل الطلب ليعتمده المدير داخل التطبيق */
  async function sendPaymentNotice(exam) {
    if (!exam || !st.student) return;
    try {
      const list = S.listPaymentRequestsByStudent
        ? await S.listPaymentRequestsByStudent(st.student.id)
        : [];
      const already = (list || []).some(function (p) {
        return p.examId === exam.id && p.status !== "rejected";
      });
      if (!already) {
        await S.createPaymentRequest({
          examId: exam.id,
          examTitle: exam.title,
          subjectId: exam.subjectId,
          subjectName: exam.subjectName,
          studentId: st.student.id,
          studentName: st.student.name,
          groupId: st.group ? st.group.id : "",
          price: exam.price,
          currency: exam.currency,
          method: "whatsapp"
        });
      }
      U.toast("تم إبلاغ المدير عبر واتساب ✅ — بانتظار تأكيد الدفع", "success", 5000);
      renderDashboard();
    } catch (e) {
      U.toast("تعذّر إرسال الإبلاغ: " + (e && e.message || e), "error", 5000);
    }
  }

  async function startExam(examId) {
    const exam = await S.getExam(examId);
    if (exam && exam.isPaid) {
      const okPay = await S.isExamPaidForStudent(examId, st.student.id);
      if (!okPay) {
        U.toast("🔒 هذا اختبار مدفوع — يجب تأكيد الدفع أولاً. أبلغ المدير عبر واتساب أنك دفعت المبلغ.", "warn", 6000);
        return;
      }
    }
    if (!exam) return U.toast("\u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f", "error");

    const existing = await S.findSubmission(examId, st.student.id);
    if (existing) {
      if (st.guest) { st.exam = exam; st.settings = exam.settings || {}; return renderSubmitted(existing); }
    if (existing) return U.toast("\u0644\u0642\u062f \u0633\u0644\u0651\u0645\u062a \u0647\u0630\u0627 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0645\u0633\u0628\u0642\u0627\u064b", "warn");
    }

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
    document.getElementById("cancelBtn").addEventListener("click", function () { if (st.guest) renderAuth(); else renderDashboard(); });
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
      '<div class="q-index">\u0627\u0644\u0633\u0624\u0627\u0644 ' + (st.current + 1) + " \u0645\u0646 " + total + " \u00B7 " + (U.TYPE_LABELS[q.type] || q.type) +
      (U.sectionOf && U.sectionOf(q) ? ' \u00B7 <span class="badge badge-section">' + U.esc(U.sectionOf(q)) + '</span>' : "") +
      " \u00B7 " + (q.points || 1) + ' \u062f\u0631\u062c\u0629</div>' +
      (q.passage && U.passageHTML ? U.passageHTML(q.passage) : "") +
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

  function qImageBlock(q) {
    if (!q || !q.image) return "";
    return '<div class="q-image" style="text-align:center;margin:10px 0">' +
      '<img src="' + U.esc(q.image) + '" alt="\u0635\u0648\u0631\u0629" style="max-width:100%;border-radius:10px;border:1px solid #ddd" /></div>';
  }

  function renderMatching(q, val) {
    const pairs = q.pairs || [];
    const rights = U.shuffleStable((q.id || q.text) + "-r", pairs.map(function (p) { return p.right; }));
    const chosen = Array.isArray(val) ? val : [];
    return '<div class="match-wrap">' + pairs.map(function (p, i) {
      return '<div class="match-row" style="display:flex;gap:8px;align-items:center;margin:6px 0">' +
        '<span style="flex:1">' + U.esc(p.left) + '</span>' +
        '<select class="match-sel" data-match="' + i + '">' +
        '<option value="">- \u0627\u062e\u062a\u0631 -</option>' +
        rights.map(function (r) {
          return '<option value="' + U.esc(r) + '"' + (chosen[i] === r ? " selected" : "") + '>' + U.esc(r) + '</option>';
        }).join("") +
        '</select></div>';
    }).join("") + '</div>';
  }

  function renderOrderingList(order) {
    return '<div class="order-wrap">' + order.map(function (it, i) {
      return '<div class="order-row" style="display:flex;gap:8px;align-items:center;margin:6px 0">' +
        '<span class="badge badge-section" style="min-width:2.5em;text-align:center">' + (i + 1) + '</span>' +
        '<span style="flex:1">' + U.esc(it) + '</span>' +
        '<button type="button" class="btn btn-ghost" data-ord-up="' + i + '"' + (i === 0 ? " disabled" : "") + '>\u25B2</button>' +
        '<button type="button" class="btn btn-ghost" data-ord-down="' + i + '"' + (i === order.length - 1 ? " disabled" : "") + '>\u25BC</button>' +
        '</div>';
    }).join("") + '</div>';
  }

  function renderOrdering(q, val) {
    let order;
    if (Array.isArray(val) && val.length) order = val.slice();
    else { order = U.shuffleStable((q.id || q.text) + "-o", q.items || []); st.answers[st.current] = order.slice(); }
    return renderOrderingList(order);
  }

  function renderClassification(q, val) {
    const cats = q.categories || [];
    const obj = (val && typeof val === "object" && !Array.isArray(val)) ? val : {};
    return '<div class="cls-wrap">' + (q.items || []).map(function (it) {
      return '<div class="cls-row" style="display:flex;gap:8px;align-items:center;margin:6px 0">' +
        '<span style="flex:1">' + U.esc(it.text) + '</span>' +
        '<select class="cls-sel" data-cls="' + U.esc(it.text) + '">' +
        '<option value="">- \u0627\u062e\u062a\u0631 -</option>' +
        cats.map(function (c) {
          return '<option value="' + U.esc(c) + '"' + (obj[it.text] === c ? " selected" : "") + '>' + U.esc(c) + '</option>';
        }).join("") +
        '</select></div>';
    }).join("") + '</div>';
  }

  function renderComparison(q, val) {
    const cols = q.columns || [];
    const rows = q.rows || [];
    const blanks = q.blanks || [];
    const obj = (val && typeof val === "object" && !Array.isArray(val)) ? val : {};
    function isBlank(r, c) {
      return blanks.some(function (b) { return Number(b[0]) === r && Number(b[1]) === c; });
    }
    let html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">' +
      '<thead><tr><th style="border:1px solid #ccc;padding:6px">\u0648\u062c\u0647 \u0627\u0644\u0645\u0642\u0627\u0631\u0646\u0629</th>';
    cols.forEach(function (c) { html += '<th style="border:1px solid #ccc;padding:6px">' + U.esc(c) + '</th>'; });
    html += '</tr></thead><tbody>';
    (q.rows || []).forEach(function (row, r) {
      html += '<tr><td style="border:1px solid #ccc;padding:6px;font-weight:600">' + U.esc(row.criterion) + '</td>';
      (row.values || []).forEach(function (v, c) {
        if (isBlank(r, c)) {
          html += '<td style="border:1px solid #ccc;padding:4px"><input class="cmp-in" data-cmp="' + r + ',' + c + '" value="' + U.esc(obj[r + "," + c] || "") + '" style="width:100%" /></td>';
        } else {
          html += '<td style="border:1px solid #ccc;padding:6px">' + U.esc(v) + '</td>';
        }
      });
      html += '</tr>';
    });
    return html + '</tbody></table></div>';
  }

  function renderDiagramLabel(q, val) {
    const obj = (val && typeof val === "object" && !Array.isArray(val)) ? val : {};
    return qImageBlock(q) + '<div class="dl-wrap">' + (q.labels || []).map(function (l) {
      return '<div class="dl-row" style="display:flex;gap:8px;align-items:center;margin:6px 0">' +
        '<span style="min-width:2.5em;font-weight:600">' + U.esc(l.number) + '</span>' +
        '<input class="dl-in" data-lbl="' + U.esc(l.number) + '" value="' + U.esc(obj[l.number] || "") + '" placeholder="\u0627\u0644\u0627\u0633\u0645" /></div>';
    }).join("") + '</div>';
  }

  function renderQuestionBody(q, val) {
    const t = q.type;
    if (t === "mcq" || t === "true_false" || t === "image_mcq") {
      const opts = t === "true_false" ? ["\u0635\u062d", "\u062e\u0637\u0623"] : (q.options || []);
      return qImageBlock(q) + opts.map(function (o) {
        const sel = val === o ? " selected" : "";
        return '<div class="opt' + sel + '" data-opt="' + U.esc(o) + '">' +
          '<span class="mark">' + (val === o ? "\u2713" : "") + '</span>' +
          '<span>' + U.esc(o) + '</span></div>';
      }).join("");
    }
    if (t === "multi") {
      const arr = Array.isArray(val) ? val : [];
      return qImageBlock(q) + (q.options || []).map(function (o) {
        const sel = arr.indexOf(o) >= 0 ? " selected" : "";
        return '<div class="opt' + sel + '" data-multi="' + U.esc(o) + '">' +
          '<span class="mark">' + (arr.indexOf(o) >= 0 ? "\u2713" : "") + '</span>' +
          '<span>' + U.esc(o) + '</span></div>';
      }).join("");
    }
    if (t === "matching") return qImageBlock(q) + renderMatching(q, val);
    if (t === "ordering") return qImageBlock(q) + renderOrdering(q, val);
    if (t === "classification") return qImageBlock(q) + renderClassification(q, val);
    if (t === "comparison") return qImageBlock(q) + renderComparison(q, val);
    if (t === "diagram_label") return renderDiagramLabel(q, val);
    if (t === "fill_blank") {
      return qImageBlock(q) + '<input id="textAnswer" placeholder="\u0627\u0643\u062a\u0628 \u0625\u062c\u0627\u0628\u062a\u0643" value="' + U.esc(val || "") + '">';
    }
    return qImageBlock(q) + '<textarea id="textAnswer" style="min-height:120px" placeholder="\u0627\u0643\u062a\u0628 \u0625\u062c\u0627\u0628\u062a\u0643...">' + U.esc(val || "") + '</textarea>';
  }

  function isAnswered(a) {
    if (Array.isArray(a)) return a.length > 0;
    if (a && typeof a === "object") {
      return Object.keys(a).some(function (k) {
        return String(a[k] === undefined || a[k] === null ? "" : a[k]) !== "";
      });
    }
    return a !== "" && a !== null && a !== undefined;
  }

  function captureCurrent() {
    const q = st.questions[st.current];
    if (!q) return;
    const t = q.type;
    const body = document.getElementById("qBody") || document;
    if (t === "mcq" || t === "true_false" || t === "image_mcq") {
      const sel = body.querySelector(".opt.selected");
      st.answers[st.current] = sel ? sel.getAttribute("data-opt") : "";
    } else if (t === "multi") {
      const sel = Array.prototype.slice.call(body.querySelectorAll(".opt.selected"));
      st.answers[st.current] = sel.map(function (s) { return s.getAttribute("data-opt"); });
    } else if (t === "matching") {
      const out = [];
      body.querySelectorAll(".match-sel").forEach(function (s) { out[Number(s.getAttribute("data-match"))] = s.value; });
      st.answers[st.current] = out;
    } else if (t === "classification") {
      const obj = {};
      body.querySelectorAll(".cls-sel").forEach(function (s) { obj[s.getAttribute("data-cls")] = s.value; });
      st.answers[st.current] = obj;
    } else if (t === "comparison") {
      const obj = {};
      body.querySelectorAll(".cmp-in").forEach(function (s) { obj[s.getAttribute("data-cmp")] = s.value.trim(); });
      st.answers[st.current] = obj;
    } else if (t === "diagram_label") {
      const obj = {};
      body.querySelectorAll(".dl-in").forEach(function (s) { obj[s.getAttribute("data-lbl")] = s.value.trim(); });
      st.answers[st.current] = obj;
    } else if (t === "ordering") {
      if (!Array.isArray(st.answers[st.current])) st.answers[st.current] = [];
    } else {
      const box = document.getElementById("textAnswer");
      if (box) st.answers[st.current] = box.value.trim();
    }
  }

  function bindOrderingButtons() {
    const body = document.getElementById("qBody");
    if (!body) return;
    body.querySelectorAll("[data-ord-up]").forEach(function (b) {
      b.addEventListener("click", function () { moveOrder(Number(b.getAttribute("data-ord-up")), -1); });
    });
    body.querySelectorAll("[data-ord-down]").forEach(function (b) {
      b.addEventListener("click", function () { moveOrder(Number(b.getAttribute("data-ord-down")), 1); });
    });
  }

  function moveOrder(i, dir) {
    const q = st.questions[st.current];
    const order = Array.isArray(st.answers[st.current]) ? st.answers[st.current].slice() : [];
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    st.answers[st.current] = order;
    const body = document.getElementById("qBody");
    if (body) {
      body.innerHTML = qImageBlock(q) + renderOrderingList(order);
      bindOrderingButtons();
    }
    updateNavDots();
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
    const qBody = document.getElementById("qBody");
    if (qBody) {
      qBody.querySelectorAll(".match-sel").forEach(function (s) {
        s.addEventListener("change", function () { captureCurrent(); updateNavDots(); });
      });
      qBody.querySelectorAll(".cls-sel").forEach(function (s) {
        s.addEventListener("change", function () { captureCurrent(); updateNavDots(); });
      });
      qBody.querySelectorAll(".cmp-in, .dl-in").forEach(function (s) {
        s.addEventListener("input", function () { captureCurrent(); updateNavDots(); });
      });
    }
    bindOrderingButtons();
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
      d.classList.toggle("answered", isAnswered(st.answers[i]));
    });
  }

  /* ============================================================
   * SUBMIT
   * ============================================================ */
  async function submitExam(auto) {
    if (st.submitted) return;
    const unanswered = st.answers.filter(function (a) { return !isAnswered(a); }).length;
    if (!auto && unanswered > 0) {
      if (!await U.confirm("\u0644\u062f\u064a\u0643 " + unanswered + " \u0633\u0624\u0627\u0644 \u0628\u062f\u0648\u0646 \u0625\u062c\u0627\u0628\u0629. \u0647\u0644 \u062a\u0631\u064a\u062f \u0627\u0644\u062a\u0633\u0644\u064a\u0645\u061f", { yes: "\u062a\u0633\u0644\u064a\u0645" })) return;
    }
    st.submitted = true;
    clearInterval(st.timerId);

    const graded = st.questions.map(function (q, i) {
      const pts = Number(q.points) || 1;
      const given = st.answers[i];
      let autoCorrect = null;
      if (U.autoGrade) {
        autoCorrect = U.autoGrade(q, given);
      } else if (q.type === "mcq" || q.type === "true_false") {
        autoCorrect = given !== "" && U.sameAnswer(given, q.answer);
      }
      return {
        qIndex: i, type: q.type, text: q.text,
        options: q.options || [], given: given,
        correctAnswer: q.answer, explanation: q.explanation || "",
        image: q.image || "",
        pairs: q.pairs || [],
        items: q.items || [],
        categories: q.categories || [],
        columns: q.columns || [],
        rows: q.rows || [],
        blanks: q.blanks || [],
        labels: q.labels || [],
        autoCorrect: autoCorrect, finalCorrect: autoCorrect,
        earned: null, points: pts, teacherNote: ""
      };
    });

    const durationSec = Math.floor((Date.now() - st.startMs) / 1000);
    const total = graded.reduce(function (s, g) { return s + g.points; }, 0);
    const nowIso = new Date().toISOString();

    var submission = {
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
      autoSubmit: !!auto,
      isGuest: st.guest
    };

    /* ⚡ النتيجة الفورية: تصحيح تلقائي عند تفعيل المدير (الأسئلة التلقائية فقط) */
    if (st.exam.settings && st.exam.settings.autoResult) {
      var pendingCount = 0;
      var autoScore = 0;
      graded.forEach(function (g) {
        if (g.autoCorrect === null || g.autoCorrect === undefined) {
          pendingCount++;
          return;
        }
        if (g.autoCorrect) {
          g.earned = g.points;
          g.finalCorrect = true;
          autoScore += g.points;
        } else {
          g.earned = 0;
          g.finalCorrect = false;
        }
      });
      if (pendingCount === 0) {
        const passScore = st.exam.settings.passScore || 50;
        submission.score = autoScore;
        submission.percent = total > 0 ? Math.round((autoScore / total) * 100) : 0;
        submission.passed = submission.percent >= passScore;
        submission.status = "graded";
        submission.needsManualReview = false;
        submission.gradedBy = "تصحيح تلقائي";
        submission.gradedAt = nowIso;
      } else {
        submission.autoScore = autoScore;
        submission.autoPendingCount = pendingCount;
      }
    }

    try {
      var subId = await S.addSubmission(submission);
      submission.id = subId;
    } catch (e) {
      U.toast("\u062a\u0639\u0630\u0631 \u0627\u0644\u062d\u0641\u0638: " + e.message, "error", 5000);
    }
    renderSubmitted(submission);
  }

  function bindGuestRefresh(sub) {
    var btn = document.getElementById("refreshStatusBtn");
    if (!btn) return;
    btn.addEventListener("click", async function () {
      if (!sub || !sub.id) return U.toast("لا يمكن التحقق الآن — أعد الدخول بالاسم والكود", "warn");
      btn.disabled = true;
      try {
        var fresh = await S.getSubmissionById(sub.id);
        if (fresh && fresh.status === "graded") return viewResult(fresh.id, fresh);
        U.toast("النتيجة لم تُعتمد بعد — حاول لاحقاً", "info");
      } catch (e) {
        U.toast("تعذّر التحقق: " + e.message, "error");
      }
      btn.disabled = false;
    });
  }

  function renderSubmitted(sub) {
    if (sub && sub.status === "graded" && sub.id) {
      return viewResult(sub.id, sub);
    }
    var partial = sub && sub.status === "pending" && sub.autoPendingCount && sub.autoPendingCount > 0;
    var guestHint = st.guest
      ? "للاطّلاع على نتيجتك لاحقاً: أعد إدخال نفس الاسم وكود الاختبار، أو اضغط زر التحديث."
      : "عندما يتم الاعتماد، سترى النتيجة في لوحتك.";
    view(
      '<div class="container container-narrow">' +
      '<div class="card mt">' +
      '<div class="waiting-screen">' +
      '<div class="pulse-icon">\uD83D\uDCE8</div>' +
      '<h2>\u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0625\u062c\u0627\u0628\u0627\u062a\u0643</h2>' +
      '<p class="hint">\u0634\u0643\u0631\u0627\u064b \u0644\u0643 \u064a\u0627 ' + U.esc(st.student.name) + '</p>' +
      (partial ? (
        '<div class="info-banner info" style="text-align:start">' +
        '<span class="emoji">\u26A1</span>' +
        '<div><b>\u062a\u0645 \u0627\u0644\u062a\u0635\u062d\u064a\u062d \u0627\u0644\u062a\u0644\u0642\u0627\u0626\u064a \u0644\u062c\u0632\u0621 \u0645\u0646 \u0627\u0644\u0623\u0633\u0626\u0644\u0629</b> \u2022 \u0627\u0644\u062f\u0631\u062c\u0627\u062a \u0627\u0644\u062d\u0627\u0644\u064a\u0629: ' + (sub.autoScore || 0) + '/' + (sub.total || 0) + ' \u062f\u0631\u062c\u0629 (\u0628\u0627\u0642\u064a ' + sub.autoPendingCount + ' \u0633\u0624\u0627\u0644 \u064a\u062d\u062a\u0627\u062c \u062a\u0635\u062d\u064a\u062d \u0627\u0644\u0645\u0639\u0644\u0645).<br>' + guestHint + '</div>' +
        '</div>'
      ) : (
        '<div class="info-banner warning" style="text-align:start">' +
        '<span class="emoji">\u23F3</span>' +
        '<div><b>\u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u0644\u0645 \u062a\u0635\u062f\u0631 \u0628\u0639\u062f</b> \u0633\u064a\u0631\u0627\u062c\u0639 \u0627\u0644\u0645\u0639\u0644\u0645 \u0625\u062c\u0627\u0628\u0627\u062a\u0643 \u0648\u064a\u0639\u062a\u0645\u062f \u0627\u0644\u062f\u0631\u062c\u0629. ' + guestHint + '</div>' +
        '</div>'
      )) +
      (st.guest ? '<button class="btn btn-primary btn-block mt" id="refreshStatusBtn">\uD83D\uDD04 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062d\u0627\u0644\u0629</button>' : '') +
      '<button class="btn ' + (st.guest ? "btn-ghost" : "btn-primary") + ' btn-block mt" id="backBtn">' + (st.guest ? "\u0631\u062c\u0648\u0639" : "\u0631\u062c\u0648\u0639 \u0644\u0644\u0648\u062d\u0629") + '</button>' +
      '</div></div></div>'
    );
    if (st.guest) bindGuestRefresh(sub);
    document.getElementById("backBtn").addEventListener("click", function () { if (st.guest) renderAuth(); else renderDashboard(); });
  }

  /* ============================================================
   * VIEW RESULT (بعد الاعتماد)
   * ============================================================ */
  async function viewResult(submissionId, preloaded) {
    const sub = preloaded || await S.getSubmissionById(submissionId);
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
        const givenTxt = U.givenText ? U.givenText(a, a.given) : (Array.isArray(a.given) ? a.given.join(" \u060C ") : (a.given || "-"));
        const ansTxt = U.answerText ? U.answerText(a) : (Array.isArray(a.correctAnswer) ? a.correctAnswer.join(" \u060C ") : (a.correctAnswer || "-"));
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

    document.getElementById("backBtn").addEventListener("click", function () { if (st.guest) renderAuth(); else renderDashboard(); });
    document.getElementById("printBtn").addEventListener("click", function () { window.print(); });
  }

  async function guestEnter() {
    const nameInput = document.getElementById("guestName");
    const codeInput = document.getElementById("guestCode");
    const name = nameInput && nameInput.value ? nameInput.value.trim() : "";
    const code = codeInput && codeInput.value ? codeInput.value.trim().toUpperCase() : "";
    if (!name) return U.toast("أدخل اسمك", "warn");
    if (!code) return U.toast("أدخل كود الاختبار", "warn");
    const exam = await S.getExamByCode(code);
    if (!exam) return U.toast("كود الاختبار غير صحيح", "error");
    if (exam.isPaid) return U.toast("هذا اختبار مدفوع — يجب تسجيل الدخول بحساب طالب وتأكيد الدفع أولاً", "warn", 6000);
    st.student = {
      id: "guest:" + (U.normalizeArabic ? U.normalizeArabic(name) : name).replace(/\s+/g, "") + ":" + (exam.id || code),
      name: name,
      username: "",
      isGuest: true
    };
    st.group = { id: "ALL", name: "ضيوف" };
    st.guest = true;
    // إن سبق لهذا الضيف (نفس الاسم والكود) التسليم → اعرض نتيجته أو حالة انتظار التصحيح
    const existingGuest = await S.findSubmission(exam.id || code, st.student.id);
    if (existingGuest) {
      st.exam = exam;
      st.settings = exam.settings || {};
      return renderSubmitted(existingGuest);
    }
    const avail = U.examAvailability ? U.examAvailability(exam) : "available";
    if (avail === "upcoming") return U.toast("لم يبدأ وقت الاختبار بعد", "warn");
    if (avail === "expired") return U.toast("انتهى وقت الاختبار", "error");
    await startExam(exam.id);
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

  console.log("[student.js v4.2] QP.student loaded");
})();