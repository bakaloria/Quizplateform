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
      tstate.submissions = allSubs;

      const pending = allSubs.filter(function (s) { return s.status === "pending" || s.status === "in_review"; });
      const graded = allSubs.filter(function (s) { return s.status === "graded"; });
      const scores = graded.map(function (s) { return s.percent || 0; }).filter(function (x) { return x !== null; });
      const avg = scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) : 0;

      shell("dashboard",
        '<div class="card-head"><h2>\u0644\u0648\u062d\u0629 ' + U.esc(teacher.name) + '</h2></div>' +
        '<div class="stat-grid">' +
        stat("\uD83D\uDC65", groups.length, "\u0645\u062c\u0645\u0648\u0639\u0627\u062a\u064a") +
        stat("\uD83D\uDCE5", allSubs.length, "\u062a\u0633\u0644\u064a\u0645\u0627\u062a") +
        stat("\u23F3", pending.length, "\u0642\u064a\u062f \u0627\u0644\u062a\u0635\u062d\u064a\u062d") +
        stat("\u2705", graded.length, "\u0645\u064f\u0635\u062d\u0651\u062d") +
        stat("\uD83D\uDCCA", avg + "%", "\u0627\u0644\u0645\u062a\u0648\u0633\u0637") +
        "</div>" +
        '<div class="card mt"><div class="card-head"><h3>\u0645\u0647\u0627\u0645 \u0633\u0631\u064a\u0639\u0629</h3></div>' +
        '<div class="flex flex-wrap">' +
        '<a class="btn btn-primary" href="#/pending">\u23F3 \u062a\u0635\u062d\u064a\u062d (' + pending.length + ')</a>' +
        '<a class="btn" href="#/groups">\uD83D\uDC65 \u0645\u062c\u0645\u0648\u0639\u0627\u062a\u064a (' + groups.length + ')</a>' +
        "</div></div>"
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
            '<td data-label=""><button class="btn btn-sm ' + (s.status !== "graded" ? "btn-primary" : "") + '" data-open="' + s.id + '">' +
            (s.status === "graded" ? "\u0639\u0631\u0636" : "\u062a\u0635\u062d\u064a\u062d") + "</button></td></tr>";
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
        '<div class="card-head"><h2>\u0627\u0644\u062a\u0633\u0644\u064a\u0645\u0627\u062a</h2></div>' +
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
    const group = await S.getGroup(sub.groupId);
    if (!group) return U.toast("\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f\u0629", "error");
    const canSee = (group.teacherAssignments || []).some(function (a) {
      return a.teacherId === tstate.teacher.id && a.subjectId === sub.subjectId;
    });
    if (!canSee) return U.toast("\u0644\u0627 \u062a\u0645\u0644\u0643 \u0635\u0644\u0627\u062d\u064a\u0629", "error");

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
      const showModel = ["essay", "short_answer", "fill_blank", "matching", "ordering", "classification", "comparison", "diagram_label"].indexOf(a.type) >= 0;
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