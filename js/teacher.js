/* teacher.js v4.0 - تصحيح يدوي كامل لكل سؤال + عزل المجموعات */
(function () {
  const QP = window.QP;
  const U = QP.utils;
  const S = QP.store;
  const G = QP.groups;

  const tstate = {
    teacher: null,
    groups: [],
    submissions: [],
    filterGroup: "",
    filterSubject: "",
    currentTab: "pending",
    currentSubmission: null
  };

  function view(html) { document.getElementById("view").innerHTML = html; }
  function isLogged() {
    const raw = sessionStorage.getItem("qp_teacher");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  /* ============================================================
   * LOGIN
   * ============================================================ */
  function renderLogin() {
    view(
      '<div class="container container-narrow">' +
      '<div class="card mt">' +
      '<div class="center" style="padding:10px 0 6px">' +
      '<div class="emoji" style="font-size:46px">\uD83D\uDC68\u200D\uD83C\uDFEB</div>' +
      '<h2>\u062f\u062e\u0648\u0644 \u0627\u0644\u0645\u0639\u0644\u0645</h2>' +
      '<p class="muted">\u0623\u062f\u062e\u0644 \u0628\u064a\u0627\u0646\u0627\u062a\u0643</p>' +
      '</div>' +
      '<div class="field mt"><label>\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645</label>' +
      '<input id="tUser" autocomplete="username"></div>' +
      '<div class="field"><label>\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631</label>' +
      '<input type="password" id="tPass" autocomplete="current-password"></div>' +
      '<button class="btn btn-primary btn-block" id="tLoginBtn">\u062f\u062e\u0648\u0644</button>' +
      '</div></div>'
    );
    const doLogin = async function () {
      const username = document.getElementById("tUser").value.trim();
      const pass = document.getElementById("tPass").value.trim();
      if (!username || !pass) return U.toast("\u0623\u062f\u062e\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a", "warn");
      const btn = document.getElementById("tLoginBtn");
      btn.disabled = true; btn.textContent = "...";
      try {
        const t = await S.getTeacherByUsername(username);
        if (!t) {
          U.toast("\u0628\u064a\u0627\u0646\u0627\u062a \u062e\u0627\u0637\u0626\u0629", "error");
          btn.disabled = false; btn.textContent = "\u062f\u062e\u0648\u0644";
          return;
        }
        if (t.lockedUntil && Date.now() < t.lockedUntil) {
          const mins = Math.ceil((t.lockedUntil - Date.now()) / 60000);
          U.toast("\u0645\u0642\u0641\u0644 - \u062d\u0627\u0648\u0644 \u0628\u0639\u062f " + mins + " \u062f", "error");
          btn.disabled = false; btn.textContent = "\u062f\u062e\u0648\u0644";
          return;
        }
        const ok = await QP.crypto.verifyPassword(pass, t.salt, t.passwordHash);
        if (!ok) {
          await S.recordLoginAttempt(t.id, false);
          U.toast("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u062e\u0627\u0637\u0626\u0629", "error");
          btn.disabled = false; btn.textContent = "\u062f\u062e\u0648\u0644";
          return;
        }
        if (t.active === false) {
          U.toast("\u062d\u0633\u0627\u0628\u0643 \u0645\u0639\u0637\u0644", "error");
          btn.disabled = false; btn.textContent = "\u062f\u062e\u0648\u0644";
          return;
        }
        await S.recordLoginAttempt(t.id, true);
        sessionStorage.setItem("qp_teacher", JSON.stringify({ id: t.id, name: t.name, username: t.username }));
        tstate.teacher = t;
        U.toast("\u0645\u0631\u062d\u0628\u0627 " + t.name, "success");
        QP.teacher.render("dashboard");
        // إظهار زر تثبيت تطبيق المعلم بعد الدخول
        if (QP.pwa && QP.pwa.refreshInstall) QP.pwa.refreshInstall();
      } catch (e) {
        U.toast("Error: " + e.message, "error");
        btn.disabled = false; btn.textContent = "\u062f\u062e\u0648\u0644";
      }
    };
    document.getElementById("tLoginBtn").addEventListener("click", doLogin);
    document.getElementById("tPass").addEventListener("keydown", function (e) {
      if (e.key === "Enter") doLogin();
    });
  }

  function logout() {
    sessionStorage.removeItem("qp_teacher");
    if (QP.pwa && QP.pwa.hideInstall) QP.pwa.hideInstall();
    U.toast("\u062a\u0645 \u0627\u0644\u062e\u0631\u0648\u062c", "success");
    location.hash = "#/dashboard";
    setTimeout(function () { location.reload(); }, 300);
  }

  /* ============================================================
   * SHELL
   * ============================================================ */
  async function loadTeacherData() {
    const sess = isLogged();
    if (!sess) return null;
    const t = await S.getTeacher(sess.id);
    if (!t || t.active === false) {
      sessionStorage.removeItem("qp_teacher");
      return null;
    }
    tstate.teacher = t;
    return t;
  }

  function sideNav(active) {
    const items = [
      ["dashboard", "\uD83D\uDCCA", "\u0644\u0648\u062d\u062a\u064a"],
      ["pending", "\u23F3", "\u0642\u064a\u062f \u0627\u0644\u062a\u0635\u062d\u064a\u062d"],
      ["graded", "\u2705", "\u0627\u0644\u0645\u064f\u0635\u062d\u0651\u062d\u0629"],
      ["all", "\uD83D\uDCCB", "\u0627\u0644\u0643\u0644"],
      ["groups", "\uD83D\uDC65", "\u0645\u062c\u0645\u0648\u0639\u0627\u062a\u064a"],
      ["profile", "\uD83D\uDC64", "\u062d\u0633\u0627\u0628\u064a"]
    ];
    return (
      '<aside class="side">' +
      items.map(function (i) {
        return '<a href="#/' + i[0] + '" class="' + (active === i[0] ? "active" : "") + '"><span>' + i[1] + "</span><span>" + i[2] + "</span></a>";
      }).join("") +
      '<div class="side-sep"></div>' +
      '<a id="tLogoutBtn"><span>\uD83D\uDEAA</span><span>\u062e\u0631\u0648\u062c</span></a>' +
      "</aside>"
    );
  }

  function shell(active, contentHTML) {
    view(
      '<div class="container"><div class="admin-grid">' +
      sideNav(active) +
      "<section>" + contentHTML + "</section>" +
      "</div></div>"
    );
    const lb = document.getElementById("tLogoutBtn");
    if (lb) lb.addEventListener("click", logout);
  }

  function stat(ico, val, lbl) {
    return '<div class="stat"><div class="ico">' + ico + '</div><div><div class="val">' + val + '</div><div class="lbl">' + lbl + "</div></div></div>";
  }

  /* بطاقة مؤشر (KPI) للوحة التحكم */
  function kpiCard(color, ico, val, lbl) {
    return '<div class="kpi ' + color + '"><div class="kpi-ico">' + ico + '</div>' +
      '<div><div class="kpi-val">' + val + '</div><div class="kpi-lbl">' + lbl + '</div></div></div>';
  }

  /* تحويل أي قيمة تاريخ إلى ملّي ثانية للترتيب */
  function msOf(v) {
    if (!v) return 0;
    if (typeof v === "object" && v.toDate) return v.toDate().getTime();
    const d = new Date(typeof v === "number" ? v : String(v));
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  /* ============================================================
   * DASHBOARD
   * ============================================================ */
  async function renderDashboard() {
    shell("dashboard", U.loaderHTML());
    try {
      const teacher = tstate.teacher;
      // جلب مجموعات المعلم
      const groups = await G.getGroupTeachers ? (await S.listGroups()).filter(function (g) {
        return (g.teacherAssignments || []).some(function (a) { return a.teacherId === teacher.id; });
      }) : [];
      tstate.groups = groups;

      // جمع كل التسليمات من كل مجموعاته (حسب المواد التي يصحّحها)
      const allSubs = [];
      for (const g of groups) {
        const subs = await S.listSubmissionsForTeacherInGroup(teacher.id, g.id);
        subs.forEach(function (s) {
          s.groupName = g.name;
          allSubs.push(s);
        });
      }
      // تسليمات الضيوف (دخول بالاسم + كود الاختبار)
      try {
        const guestSubs = await S.listGuestSubmissionsForTeacher(teacher.id);
        guestSubs.forEach(function (s) { if (!s.groupName) s.groupName = "ضيوف"; allSubs.push(s); });
      } catch (eg) { console.warn("guest submissions", eg); }
      tstate.submissions = allSubs;

      const isPending = function (s) { return s.status === "pending" || s.status === "in_review"; };
      const pending = allSubs.filter(isPending);
      const graded = allSubs.filter(function (s) { return s.status === "graded"; });
      const scores = graded.map(function (s) { return Number(s.percent) || 0; });
      const avg = scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) : 0;
      const passCount = graded.filter(function (s) {
        return s.passed === true || (Number(s.percent) || 0) >= ((s.settings && s.settings.passScore) || 50);
      }).length;
      const passRate = graded.length ? Math.round((passCount / graded.length) * 100) : 0;

      /* توزيع النتائج إلى فئات */
      const buckets = [
        { lbl: "ممتاز (90%+)", min: 90, color: "var(--success)" },
        { lbl: "جيد جداً (80-89%)", min: 80, color: "#38bdf8" },
        { lbl: "جيد (70-79%)", min: 70, color: "var(--primary)" },
        { lbl: "مقبول (50-69%)", min: 50, color: "var(--warning)" },
        { lbl: "ضعيف (أقل من 50%)", min: -1, color: "var(--danger)" }
      ];
      const dist = buckets.map(function (b, i) {
        const upper = i === 0 ? 101 : buckets[i - 1].min;
        const n = graded.filter(function (s) {
          const p = Number(s.percent) || 0;
          return p >= b.min && p < upper;
        }).length;
        return { lbl: b.lbl, n: n, color: b.color };
      });
      const distMax = Math.max(1, Math.max.apply(null, dist.map(function (d) { return d.n; })));

      /* توزيع التسليمات حسب المادة */
      const bySubject = {};
      allSubs.forEach(function (s) {
        const k = s.subjectId || "—";
        if (!bySubject[k]) bySubject[k] = { name: s.subjectName || "—", total: 0, pending: 0, graded: 0, sum: 0 };
        const o = bySubject[k];
        o.total++;
        if (isPending(s)) o.pending++;
        if (s.status === "graded") { o.graded++; o.sum += Number(s.percent) || 0; }
      });
      const subjRows = Object.keys(bySubject).map(function (k) {
        const o = bySubject[k];
        return {
          name: o.name, total: o.total, pending: o.pending, graded: o.graded,
          avg: o.graded ? Math.round(o.sum / o.graded) : 0
        };
      }).sort(function (a, b) { return b.pending - a.pending; });

      /* أحدث التسليمات */
      const recent = allSubs.slice().sort(function (a, b) { return msOf(b.createdAt) - msOf(a.createdAt); }).slice(0, 6);

      const donePct = allSubs.length ? Math.round((graded.length / allSubs.length) * 100) : 0;

      shell("dashboard",
        /* ترويسة اللوحة */
        '<div class="dash-hero">' +
        '<div class="who">' +
        '<div class="dash-ava">👨‍🏫</div>' +
        '<div><div class="tiny" style="opacity:.85">مرحباً بك</div>' +
        '<div class="dash-name">' + U.esc(teacher.name) + '</div>' +
        '<div class="tiny" style="opacity:.8;margin-top:2px">' + U.formatDateOnly(new Date()) +
        ' · ' + groups.length + ' مجموعة · ' + subjRows.length + ' مادة</div></div>' +
        '</div>' +
        '<div class="flex" style="gap:8px;flex-wrap:wrap">' +
        (pending.length
          ? '<a class="btn btn-sm dash-cta" href="#/pending">⏳ لديك ' + pending.length + ' بانتظار التصحيح</a>'
          : '<span class="badge dash-ok">✅ لا مهام عالقة</span>') +
        '</div>' +
        '</div>' +

        /* مؤشرات */
        '<div class="kpi-grid">' +
        kpiCard("c-primary", "📥", allSubs.length, "إجمالي التسليمات") +
        kpiCard("c-warning", "⏳", pending.length, "قيد التصحيح") +
        kpiCard("c-success", "✅", graded.length, "مُصحّحة") +
        kpiCard("c-primary", "📊", avg + "%", "متوسط الدرجات") +
        kpiCard("c-success", "🎯", passRate + "%", "نسبة النجاح") +
        "</div>" +

        /* توزيع النتائج + تقدّم التصحيح */
        '<div class="dash-cols">' +
        '<div class="card"><div class="card-head"><h3>📈 توزيع النتائج</h3>' +
        '<span class="badge badge-muted">' + graded.length + ' مُصحّح</span></div>' +
        (graded.length
          ? '<div class="dist">' + dist.map(function (d) {
            const w = Math.round((d.n / distMax) * 100);
            return '<div class="dist-row">' +
              '<span class="tiny muted">' + d.lbl + '</span>' +
              '<div class="dist-bar"><span style="width:' + w + '%;background:' + d.color + '"></span></div>' +
              '<span class="dist-val">' + d.n + '</span>' +
              '</div>';
          }).join("") + '</div>'
          : '<p class="muted tiny">لا توجد نتائج مُصحّحة بعد.</p>') +
        '</div>' +

        '<div class="card"><div class="card-head"><h3>✅ تقدّم التصحيح</h3></div>' +
        '<div class="done-pct"><div class="big">' + donePct + '%</div>' +
        '<div class="tiny muted">' + graded.length + ' من ' + allSubs.length + ' تسليم</div></div>' +
        '<div class="progress"><span style="width:' + donePct + '%"></span></div>' +
        '<div class="flex" style="gap:8px;margin-top:14px">' +
        '<a class="btn btn-sm btn-primary" href="#/pending" style="flex:1">⏳ تصحيح الآن</a>' +
        '<a class="btn btn-sm" href="#/graded" style="flex:1">عرض المُصحّحة</a>' +
        '</div></div>' +
        '</div>' +

        /* حسب المادة */
        (subjRows.length
          ? '<div class="card mt"><div class="card-head"><h3>📚 حسب المادة</h3></div>' +
          '<div class="table-wrap"><table><thead><tr>' +
          '<th>المادة</th><th>التسليمات</th><th>قيد التصحيح</th><th>مُصحّحة</th><th>المتوسط</th>' +
          '</tr></thead><tbody>' +
          subjRows.map(function (r) {
            return '<tr><td><b>' + U.esc(r.name) + '</b></td>' +
              '<td>' + r.total + '</td>' +
              '<td>' + (r.pending ? '<span class="badge badge-warning">' + r.pending + '</span>' : "0") + '</td>' +
              '<td>' + r.graded + '</td>' +
              '<td>' + r.avg + '%</td></tr>';
          }).join("") + '</tbody></table></div></div>' : "") +

        /* أحدث التسليمات */
        '<div class="card mt"><div class="card-head"><h3>🕒 أحدث التسليمات</h3>' +
        '<a class="btn btn-sm" href="#/all">عرض الكل</a></div>' +
        (recent.length
          ? '<div class="recent-list">' + recent.map(function (s) {
            return '<a class="recent-item" href="#/' + (isPending(s) ? "pending" : "graded") + '">' +
              '<div class="who"><div class="nm">' + U.esc(s.studentName || "-") + '</div>' +
              '<div class="sm">' + U.esc(s.examTitle || "-") + ' · ' + U.esc(s.subjectName || "-") +
              ' · ' + U.formatDate(s.createdAt) + '</div></div>' +
              U.submissionStatusBadge(s.status) +
              (s.status === "graded" ? '<span class="badge badge-primary">' + (Number(s.percent) || 0) + '%</span>' : "") +
              '</a>';
          }).join("") + '</div>'
          : '<p class="muted tiny">لا توجد تسليمات بعد.</p>') +
        '</div>'
      );
    } catch (e) {
      shell("dashboard", '<div class="card"><div class="empty-state"><div class="emoji">\u26D4</div><h3>\u062e\u0637\u0623</h3><p>' + U.esc(e.message) + '</p></div></div>');
    }
  }

  /* ============================================================
   * LIST SUBMISSIONS
   * ============================================================ */
  async function renderList(active) {
    shell(active, U.loaderHTML());
    try {
      const teacher = tstate.teacher;

      const groups = (await S.listGroups()).filter(function (g) {
        return (g.teacherAssignments || []).some(function (a) { return a.teacherId === teacher.id; });
      });
      tstate.groups = groups;

      if (!groups.length) {
        shell(active,
          '<div class="card"><div class="empty-state">' +
          '<div class="emoji">\uD83D\uDC65</div>' +
          "<h3>\u0644\u0645 \u064a\u064f\u0639\u064a\u0651\u064e\u0646 \u0644\u0643 \u0645\u062c\u0645\u0648\u0639\u0629 \u0628\u0639\u062f</h3>" +
          '<p>\u062a\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u062f\u064a\u0631 \u0644\u0625\u0636\u0627\u0641\u062a\u0643 \u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a</p>' +
          "</div></div>"
        );
        return;
      }

      // جلب التسليمات
      const allSubs = [];
      for (const g of groups) {
        const subs = await S.listSubmissionsForTeacherInGroup(teacher.id, g.id);
        subs.forEach(function (s) {
          s.groupName = g.name;
          allSubs.push(s);
        });
      }
      // تسليمات الضيوف (دخول بالاسم + كود الاختبار)
      try {
        const guestSubs = await S.listGuestSubmissionsForTeacher(teacher.id);
        guestSubs.forEach(function (s) { if (!s.groupName) s.groupName = "ضيوف"; allSubs.push(s); });
      } catch (eg) { console.warn("guest submissions", eg); }
      tstate.submissions = allSubs;

      let list = allSubs.slice();
      if (active === "pending") list = list.filter(function (s) { return s.status === "pending" || s.status === "in_review"; });
      if (active === "graded") list = list.filter(function (s) { return s.status === "graded"; });

      const groupOpts = '<option value="">\u0643\u0644 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a</option>' +
        groups.map(function (g) {
          return '<option value="' + g.id + '"' + (tstate.filterGroup === g.id ? " selected" : "") + ">" + U.esc(g.name) + "</option>";
        }).join("");

      if (tstate.filterGroup) list = list.filter(function (s) { return s.groupId === tstate.filterGroup; });
      if (tstate.filterSubject) list = list.filter(function (s) { return s.subjectId === tstate.filterSubject; });

      const gradedInList = list.filter(function (s) { return s.status === "graded"; });

      const rows = list.length
        ? list.map(function (s) {
          const scoreTxt = (s.score !== null && s.score !== undefined) ? s.score + " / " + s.total : "-";
          return '<tr>' +
            '<td data-label="N"><b>' + U.esc(s.studentName || "-") + "</b></td>" +
            '<td data-label="G" class="muted tiny">' + U.esc(s.groupName || "-") + "</td>" +
            '<td data-label="S" class="muted tiny">' + U.esc(s.subjectName || "-") + "</td>" +
            '<td data-label="E">' + U.esc(s.examTitle || "-") + "</td>" +
            '<td data-label="St">' + U.submissionStatusBadge(s.status) + "</td>" +
            '<td data-label="Sc">' + scoreTxt + "</td>" +
            '<td data-label="D" class="tiny">' + U.formatDate(s.createdAt) + "</td>" +
            '<td data-label="" style="white-space:nowrap">' +
            '<button class="btn btn-sm ' + (s.status !== "graded" ? "btn-primary" : "") + '" data-open="' + s.id + '">' +
            (s.status === "graded" ? "\u0639\u0631\u0636" : "\u062a\u0635\u062d\u064a\u062d") + "</button> " +
            '<button class="btn btn-sm btn-danger" data-del="' + s.id + '" title="حذف التسليم">🗑</button>' +
            "</td></tr>";
        }).join("")
        : '<tr><td colspan="8" class="table-empty">\u0644\u0627 \u062a\u0648\u062c\u062f \u062a\u0633\u0644\u064a\u0645\u0627\u062a</td></tr>';

      const tabs =
        '<div class="tabs">' +
        ['pending', 'graded', 'all'].map(function (k) {
          const count = k === "pending" ? allSubs.filter(function (s) { return s.status === "pending" || s.status === "in_review"; }).length
            : k === "graded" ? allSubs.filter(function (s) { return s.status === "graded"; }).length
              : allSubs.length;
          const label = k === "pending" ? "\u23F3 \u0642\u064a\u062f \u0627\u0644\u062a\u0635\u062d\u064a\u062d"
            : k === "graded" ? "\u2705 \u0627\u0644\u0645\u064f\u0635\u062d\u0651\u062d\u0629" : "\uD83D\uDCCB \u0627\u0644\u0643\u0644";
          return '<a class="tab ' + (active === k ? "active" : "") + '" href="#/' + k + '">' + label + " (" + count + ")</a>";
        }).join("") + "</div>";

      shell(active,
        '<div class="card-head"><h2>\u0627\u0644\u062a\u0633\u0644\u064a\u0645\u0627\u062a</h2>' +
        '<span class="badge badge-primary">' + list.length + '</span>' +
        '<div class="spacer"></div>' +
        (gradedInList.length ? '<button class="btn btn-sm btn-danger" id="tDelGraded">🗑 حذف المُصحّحة (' + gradedInList.length + ')</button>' : "") +
        "</div>" +
        tabs +
        '<div class="card"><div class="form-row">' +
        '<div class="field" style="margin:0"><label>\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629</label><select id="tFilterGroup">' + groupOpts + "</select></div>" +
        "</div></div>" +
        '<div class="table-wrap responsive mt"><table><thead><tr>' +
        '<th>\u0627\u0644\u0637\u0627\u0644\u0628</th><th>\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629</th><th>\u0627\u0644\u0645\u0627\u062f\u0629</th><th>\u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631</th><th>\u0627\u0644\u062d\u0627\u0644\u0629</th><th>\u0627\u0644\u062f\u0631\u062c\u0629</th><th>\u0627\u0644\u062a\u0627\u0631\u064a\u062e</th><th></th>' +
        "</tr></thead><tbody>" + rows + "</tbody></table></div>"
      );

      document.getElementById("tFilterGroup").addEventListener("change", function (e) {
        tstate.filterGroup = e.target.value;
        renderList(active);
      });
      document.querySelectorAll("[data-open]").forEach(function (b) {
        b.addEventListener("click", function () { openGrading(b.dataset.open); });
      });

      /* حذف تسليم واحد */
      document.querySelectorAll("[data-del]").forEach(function (btn) {
        btn.addEventListener("click", async function () {
          const id = btn.dataset.del;
          const s = allSubs.find(function (x) { return x.id === id; });
          const info = s ? ((s.studentName || "-") + " — " + (s.examTitle || "-")) : "";
          if (!(await U.confirm("حذف هذا التسليم؟\n" + info + "\nلا يمكن التراجع عن الحذف."))) return;
          btn.disabled = true;
          try {
            await S.deleteSubmission(id);
            U.toast("تم حذف التسليم", "success");
          } catch (e) {
            btn.disabled = false;
            U.toast("تعذّر الحذف: " + ((e && e.message) || e), "error");
            return;
          }
          renderList(active);
        });
      });

      /* حذف كل التسليمات المُصحّحة المعروضة */
      const delGradedBtn = document.getElementById("tDelGraded");
      if (delGradedBtn) delGradedBtn.addEventListener("click", async function () {
        if (!gradedInList.length) return;
        if (!(await U.confirm("حذف " + gradedInList.length + " تسليماً مُصحّحاً؟\nلا يمكن التراجع عن الحذف."))) return;
        delGradedBtn.disabled = true;
        delGradedBtn.textContent = "...";
        let done = 0;
        try {
          for (const s of gradedInList) { await S.deleteSubmission(s.id); done++; }
          U.toast("تم حذف " + done + " تسليم", "success");
        } catch (e) {
          U.toast("حُذف " + done + " ثم تعذّر الباقي: " + ((e && e.message) || e), "error");
        }
        renderList(active);
      });
    } catch (e) {
      shell(active, '<div class="card"><div class="empty-state"><div class="emoji">\u26D4</div><h3>\u062e\u0637\u0623</h3><p>' + U.esc(e.message) + '</p></div></div>');
    }
  }

  /* ============================================================
   * GRADING SCREEN - تصحيح كامل لكل سؤال
   * ============================================================ */
  async function openGrading(submissionId) {
    const sub = await S.getSubmissionById(submissionId);
    if (!sub) return U.toast("\u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f", "error");

    // التحقق من الصلاحيات
    if (sub.isGuest || sub.groupId === "ALL") {
      // تسليم ضيف (لا توجد مجموعة فعلية) — نتحقق من مواد المعلّم مباشرة
      const groups = await S.listGroupsByTeacher(tstate.teacher.id);
      const canSeeGuest = groups.some(function (g) {
        return (g.teacherAssignments || []).some(function (a) {
          return a.teacherId === tstate.teacher.id && a.subjectId === sub.subjectId;
        });
      });
      if (!canSeeGuest) return U.toast("\u0644\u0627 \u062a\u0645\u0644\u0643 \u0635\u0644\u0627\u062d\u064a\u0629", "error");
    } else {
      const group = await S.getGroup(sub.groupId);
      if (!group) return U.toast("\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f\u0629", "error");
      const canSee = (group.teacherAssignments || []).some(function (a) {
        return a.teacherId === tstate.teacher.id && a.subjectId === sub.subjectId;
      });
      if (!canSee) return U.toast("\u0644\u0627 \u062a\u0645\u0644\u0643 \u0635\u0644\u0627\u062d\u064a\u0629", "error");
    }

    tstate.currentSubmission = sub;

    // تحديث الحالة إلى "قيد المراجعة" إذا كانت "قيد التصحيح"
    if (sub.status === "pending") {
      await S.gradeSubmission(sub.id, { status: "in_review" });
      sub.status = "in_review";
    }

    U.modal({
      title: "\u062a\u0635\u062d\u064a\u062d: " + sub.studentName,
      size: "xl",
      body: renderGradeSheet(sub),
      footer:
        '<button class="btn btn-success" data-finalize>\u2705 \u062a\u0645 \u0627\u0644\u062a\u0635\u062d\u064a\u062d \u0648\u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u0646\u062a\u064a\u062c\u0629</button>' +
        '<button class="btn btn-ghost" data-close>\u0625\u063a\u0644\u0627\u0642 \u0645\u0624\u0642\u062a</button>',
      onMount: function (node, close) {
        bindGradeSheet(node, sub, function () {
          close();
          renderList(tstate.currentTab);
        });
      }
    });
  }

  function renderGradeSheet(sub) {
    const header =
      '<div class="grade-sheet-header">' +
      '<div class="info-row">' +
      '<div><div class="lbl">\u0627\u0644\u0637\u0627\u0644\u0628</div><div class="val">' + U.esc(sub.studentName) + '</div></div>' +
      '<div><div class="lbl">\u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631</div><div class="val">' + U.esc(sub.examTitle) + '</div></div>' +
      '<div><div class="lbl">\u0627\u0644\u0645\u0627\u062f\u0629</div><div class="val">' + U.esc(sub.subjectName || "-") + '</div></div>' +
      '<div><div class="lbl">\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629</div><div class="val">' + U.esc(sub.groupName || "-") + '</div></div>' +
      '<div><div class="lbl">\u0627\u0644\u0648\u0642\u062a</div><div class="val">' + U.formatDuration(sub.durationSec) + '</div></div>' +
      '</div>' +
      '<div class="flex flex-wrap mt-sm" style="gap:8px">' +
      '<span class="badge badge-primary" id="liveScore">0 / ' + (sub.total || 0) + ' \u062f\u0631\u062c\u0629</span>' +
      '<span class="badge badge-muted" id="livePercent">0%</span>' +
      '</div>' +
      '</div>';

    const cards = (sub.answers || []).map(function (a, idx) {
      const givenTxt = U.givenText ? U.givenText(a, a.given) : (Array.isArray(a.given) ? a.given.join(" \u060c ") : (a.given || "-"));
      const ansTxt = U.answerText ? U.answerText(a) : (Array.isArray(a.correctAnswer) ? a.correctAnswer.join(" \u060c ") : (a.correctAnswer || "-"));
      // تُعرض الإجابة النموذجية لكل الأنواع (موضوعية ومقالية) لمساعدة المعلّم على التصحيح
      const showModel = true;
      const hasSuggestion = a.autoCorrect !== null && a.autoCorrect !== undefined;
      const suggested = a.autoCorrect === true;
      const currentScore = (a.earned !== null && a.earned !== undefined) ? a.earned : null;
      const pts = a.points || 1;

      let cls = "";
      if (!hasSuggestion) cls = "manual";
      else if (suggested) cls = "auto-suggested";

      return '<div class="question-grade-card ' + cls + '" data-answer="' + idx + '">' +
        '<div class="q-header">' +
        '<span class="q-number">\u0633' + (idx + 1) + '</span>' +
        U.badgeForType(a.type) +
        '<span class="badge badge-muted">' + pts + ' \u062f\u0631\u062c\u0629</span>' +
        (hasSuggestion ? '<span class="badge badge-primary">\uD83E\uDD16 \u0627\u0642\u062a\u0631\u0627\u062d: ' + (suggested ? "\u0635\u062d" : "\u062e\u0637\u0623") + '</span>'
          : '<span class="badge badge-warning">\u062a\u0635\u062d\u064a\u062d \u064a\u062f\u0648\u064a</span>') +
        '</div>' +

        '<div class="q-text">' + U.esc(a.text || "") + '</div>' +

        (a.image ? '<div style="text-align:center;margin:8px 0"><img src="' + U.esc(a.image) + '" alt="" style="max-width:100%;border-radius:8px;border:1px solid #ddd" /></div>' : "") +

        '<div class="answer-block"><div class="label">\u0625\u062c\u0627\u0628\u0629 \u0627\u0644\u0637\u0627\u0644\u0628:</div>' +
        '<div class="value">' + U.esc(givenTxt) + '</div></div>' +

        (showModel ?
          '<div class="answer-block"><div class="label">\u0627\u0644\u0625\u062c\u0627\u0628\u0629 \u0627\u0644\u0646\u0645\u0648\u0630\u062c\u064a\u0629:</div>' +
          '<div class="value" style="color:var(--success)">' + U.esc(ansTxt) + '</div></div>' : "") +

        '<div class="grade-input-row">' +
        '<div class="score-box">' +
        '<label class="tiny">\u0627\u0644\u062f\u0631\u062c\u0629:</label>' +
        '<input type="number" data-score="' + idx + '" min="0" max="' + pts + '" step="0.5" value="' +
        (currentScore !== null ? currentScore : (suggested ? pts : 0)) + '">' +
        '<span class="max-score">/ ' + pts + '</span>' +
        '</div>' +
        '<div class="score-presets">' +
        '<button type="button" data-preset="' + idx + '" data-value="' + pts + '">\u0635\u062d</button>' +
        '<button type="button" data-preset="' + idx + '" data-value="' + (pts / 2) + '">\u0646\u0635\u0641</button>' +
        '<button type="button" data-preset="' + idx + '" data-value="0">\u062e\u0637\u0623</button>' +
        '</div>' +
        '</div>' +

        '<div class="teacher-note-field">' +
        '<label class="tiny">\u0645\u0644\u0627\u062d\u0638\u0629 \u0644\u0644\u0637\u0627\u0644\u0628 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)</label>' +
        '<textarea data-note="' + idx + '" placeholder="\u0645\u0644\u0627\u062d\u0638\u0629...">' + U.esc(a.teacherNote || "") + '</textarea>' +
        '</div>' +

        '</div>';
    }).join("");

    return header + '<div class="grade-sheet">' + cards + '</div>';
  }

  function bindGradeSheet(node, sub, onFinalize) {
    const recalc = function () {
      let total = 0, max = 0;
      node.querySelectorAll("[data-answer]").forEach(function (box) {
        const idx = Number(box.dataset.answer);
        const a = sub.answers[idx];
        const pts = a.points || 1;
        max += pts;
        const input = box.querySelector("[data-score]");
        const val = Number(input.value) || 0;
        total += Math.max(0, Math.min(val, pts));
      });
      const percent = max > 0 ? Math.round((total / max) * 100) : 0;
      const scoreEl = node.querySelector("#liveScore");
      const pctEl = node.querySelector("#livePercent");
      if (scoreEl) scoreEl.textContent = total + " / " + max + " \u062f\u0631\u062c\u0629";
      if (pctEl) pctEl.textContent = percent + "%";
    };

    // استماع لتغيير كل حقل درجة
    node.querySelectorAll("[data-score]").forEach(function (input) {
      input.addEventListener("input", recalc);
    });

    // Preset buttons
    node.querySelectorAll("[data-preset]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const idx = btn.dataset.preset;
        const val = btn.dataset.value;
        const input = node.querySelector('[data-score="' + idx + '"]');
        if (input) {
          input.value = val;
          recalc();
        }
      });
    });

    recalc();

    // زر الاعتماد النهائي
    const finalBtn = node.querySelector("[data-finalize]");
    if (finalBtn) {
      finalBtn.addEventListener("click", async function () {
        if (!await U.confirm("\u0628\u0639\u062f \u0627\u0644\u0627\u0639\u062a\u0645\u0627\u062f\u060c \u0633\u064a\u0631\u0649 \u0627\u0644\u0637\u0627\u0644\u0628 \u0646\u062a\u064a\u062c\u062a\u0647. \u0645\u062a\u0623\u0643\u062f\u061f")) return;
        finalBtn.disabled = true;
        finalBtn.textContent = "...";

        try {
          // اجمع الدرجات والملاحظات
          const updatedAnswers = sub.answers.map(function (a, idx) {
            const box = node.querySelector('[data-answer="' + idx + '"]');
            const input = box.querySelector("[data-score]");
            const note = box.querySelector("[data-note]");
            const pts = a.points || 1;
            const earned = Math.max(0, Math.min(Number(input.value) || 0, pts));
            return Object.assign({}, a, {
              earned: earned,
              finalCorrect: earned === pts,
              teacherNote: (note.value || "").trim()
            });
          });

          let sum = 0;
          updatedAnswers.forEach(function (a) { sum += a.earned || 0; });
          const total = updatedAnswers.reduce(function (s, a) { return s + (a.points || 1); }, 0);
          const percent = total > 0 ? Math.round((sum / total) * 100) : 0;
          const pass = (sub.settings && sub.settings.passScore) || 50;

          await S.gradeSubmission(sub.id, {
            answers: updatedAnswers,
            score: sum,
            percent: percent,
            passed: percent >= pass,
            status: "graded",
            gradedBy: tstate.teacher.name,
            gradedByTeacherId: tstate.teacher.id,
            gradedAt: new Date().toISOString()
          });

          U.logAction("grade_submission", sub.id + " by " + tstate.teacher.username);
          U.toast("\u062a\u0645 \u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u2014 \u0633\u064a\u0631\u0627\u0647\u0627 \u0627\u0644\u0637\u0627\u0644\u0628", "success", 4000);
          if (onFinalize) onFinalize();
        } catch (e) {
          U.toast("Error: " + e.message, "error");
          finalBtn.disabled = false;
          finalBtn.textContent = "\u2705 \u062a\u0645 \u0627\u0644\u062a\u0635\u062d\u064a\u062d \u0648\u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u0646\u062a\u064a\u062c\u0629";
        }
      });
    }
  }

  /* ============================================================
   * GROUPS (مجموعاتي)
   * ============================================================ */
  async function renderGroups() {
    shell("groups", U.loaderHTML());
    try {
      const teacher = tstate.teacher;
      const all = await S.listGroups();
      const groups = all.filter(function (g) {
        return (g.teacherAssignments || []).some(function (a) { return a.teacherId === teacher.id; });
      });

      if (!groups.length) {
        shell("groups", '<div class="empty-state"><div class="emoji">\uD83D\uDC65</div><h3>\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u062c\u0645\u0648\u0639\u0627\u062a</h3></div>');
        return;
      }

      const subjects = await S.listSubjects();
      const cards = groups.map(function (g) {
        const myAssignments = (g.teacherAssignments || []).filter(function (a) { return a.teacherId === teacher.id; });
        const subjectsList = myAssignments.map(function (a) {
          const s = subjects.find(function (x) { return x.id === a.subjectId; });
          return '<span class="badge badge-primary">' + U.esc(s ? s.name : "?") + "</span>";
        }).join(" ");
        return '<div class="group-card">' +
          '<div class="group-card-head">' +
          '<div class="group-emoji">\uD83D\uDC65</div>' +
          '<div class="group-info"><h3>' + U.esc(g.name) + '</h3>' +
          (g.description ? '<p class="muted tiny">' + U.esc(g.description) + '</p>' : "") + '</div>' +
          '</div>' +
          '<div class="group-meta mb">' +
          '<span class="badge badge-muted">\uD83D\uDC66 ' + (g.studentCount || 0) + ' \u0637\u0627\u0644\u0628</span>' +
          '</div>' +
          '<div class="mb"><b class="tiny">\u0645\u0648\u0627\u062f\u064a:</b> ' + subjectsList + '</div>' +
          '</div>';
      }).join("");

      shell("groups",
        '<div class="card-head"><h2>\u0645\u062c\u0645\u0648\u0639\u0627\u062a\u064a</h2>' +
        '<span class="badge badge-primary">' + groups.length + '</span></div>' +
        '<div class="groups-grid">' + cards + '</div>'
      );
    } catch (e) {
      shell("groups", '<div class="card"><div class="empty-state"><div class="emoji">\u26D4</div><h3>\u062e\u0637\u0623</h3><p>' + U.esc(e.message) + '</p></div></div>');
    }
  }

  /* ============================================================
   * PROFILE
   * ============================================================ */
  async function renderProfile() {
    const t = tstate.teacher;
    const subjects = await S.listSubjects();
    const mySubjects = subjects.filter(function (s) { return (t.subjectIds || []).indexOf(s.id) >= 0; });
    const groups = (await S.listGroups()).filter(function (g) {
      return (g.teacherAssignments || []).some(function (a) { return a.teacherId === t.id; });
    });

    shell("profile",
      '<div class="card"><div class="card-head"><h2>\u062d\u0633\u0627\u0628\u064a</h2></div>' +
      '<div class="student-info-row">' +
      '<div class="item"><div class="lbl">\u0627\u0644\u0627\u0633\u0645</div><div class="val">' + U.esc(t.name) + '</div></div>' +
      '<div class="item"><div class="lbl">\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645</div><div class="val">' + U.esc(t.username) + '</div></div>' +
      '<div class="item"><div class="lbl">\u0622\u062e\u0631 \u062f\u062e\u0648\u0644</div><div class="val">' + U.formatDate(t.lastLoginAt) + '</div></div>' +
      '<div class="item"><div class="lbl">\u0627\u0644\u062d\u0627\u0644\u0629</div><div class="val">' + (t.active !== false ? '<span class="badge badge-success">\u0646\u0634\u0637</span>' : '<span class="badge badge-danger">\u0645\u0639\u0637\u0644</span>') + '</div></div>' +
      '</div>' +
      '<h3 class="mt">\u0645\u0648\u0627\u062f\u064a</h3>' +
      '<div class="flex flex-wrap">' + (mySubjects.length ? mySubjects.map(function (s) {
        return '<span class="chip">\uD83D\uDCD8 ' + U.esc(s.name) + '</span>';
      }).join("") : '<span class="muted">-</span>') + '</div>' +
      '<h3 class="mt">\u0645\u062c\u0645\u0648\u0639\u0627\u062a\u064a (' + groups.length + ')</h3>' +
      '<div class="flex flex-wrap">' + (groups.length ? groups.map(function (g) {
        return '<span class="chip">\uD83D\uDC65 ' + U.esc(g.name) + '</span>';
      }).join("") : '<span class="muted">-</span>') + '</div>' +
      '</div>'
    );
  }

  /* ============================================================
   * RENDER
   * ============================================================ */
  async function render(tab) {
    tab = tab || "dashboard";
    tstate.currentTab = tab;
    const sess = isLogged();
    if (!sess) { renderLogin(); return; }
    const t = await loadTeacherData();
    if (!t) { renderLogin(); return; }

    if (tab === "dashboard") return renderDashboard();
    if (tab === "groups") return renderGroups();
    if (tab === "profile") return renderProfile();
    return renderList(tab);
  }

  QP.teacher = {
    render: render,
    isLogged: function () { return !!isLogged(); },
    logout: logout
  };

  console.log("[teacher.js v4] QP.teacher loaded");
})();