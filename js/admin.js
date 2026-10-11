/* admin.js v4.0 - Groups + Auto Exam + Teacher assignments */
(function () {
  const QP = window.QP;
  const U = QP.utils;
  const S = QP.store;
  const G = QP.groups;

  const state = {
    subs: [], subjects: [], questions: [], exams: [],
    teachers: [], groups: [], adminPass: null,
    pendingResultExam: null
  };

  function view(html) { document.getElementById("view").innerHTML = html; }
  function isLogged() { return sessionStorage.getItem("qp_admin") === "1"; }

  /* ============================================================
   * LOGIN
   * ============================================================ */
  function renderLogin() {
    view(
      '<div class="container container-narrow">' +
      '<div class="card mt">' +
      '<div class="center" style="padding:10px 0 6px">' +
      '<div class="emoji" style="font-size:46px">\uD83D\uDD10</div>' +
      '<h2>\u062f\u062e\u0648\u0644 \u0627\u0644\u0645\u062f\u064a\u0631</h2>' +
      '<p class="muted">\u0623\u062f\u062e\u0644 \u0631\u0645\u0632 \u0627\u0644\u062f\u062e\u0648\u0644</p>' +
      '</div>' +
      '<div class="field mt"><label>\u0631\u0645\u0632 \u0627\u0644\u0645\u062f\u064a\u0631</label>' +
      '<input type="password" id="adminPass" placeholder="admin123" autocomplete="current-password"></div>' +
      '<button class="btn btn-primary btn-block" id="loginBtn">\u062f\u062e\u0648\u0644</button>' +
      '<p class="help center mt-sm">\u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u0627\u0641\u062a\u0631\u0627\u0636\u064a: <b>admin123</b></p>' +
      '</div></div>'
    );
    if (U.focusFirstInput) U.focusFirstInput();

    const doLogin = async function () {
      const val = document.getElementById("adminPass").value.trim();
      const btn = document.getElementById("loginBtn");
      btn.disabled = true; btn.textContent = "...";
      try {
        const res = await S.getAdminPass();
        state.adminPass = res.pass;
        if (res.created) U.toast("\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0631\u0645\u0632: admin123", "warn", 5000);
        if (val === res.pass) {
          sessionStorage.setItem("qp_admin", "1");
          U.toast("\u0645\u0631\u062d\u0628\u0627", "success");
          const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
          QP.admin.render(parts[0] || "dashboard");
        } else {
          U.toast("\u0631\u0645\u0632 \u062e\u0627\u0637\u0626", "error");
          btn.disabled = false; btn.textContent = "\u062f\u062e\u0648\u0644";
        }
      } catch (e) {
        U.toast("Error: " + e.message, "error", 5000);
        btn.disabled = false; btn.textContent = "\u062f\u062e\u0648\u0644";
      }
    };
    document.getElementById("loginBtn").addEventListener("click", doLogin);
    document.getElementById("adminPass").addEventListener("keydown", function (e) {
      if (e.key === "Enter") doLogin();
    });
  }

  function logout() {
    sessionStorage.removeItem("qp_admin");
    U.toast("\u062a\u0645 \u0627\u0644\u062e\u0631\u0648\u062c", "success");
    location.hash = "#/dashboard";
    setTimeout(function () { location.reload(); }, 300);
  }

  /* ============================================================
   * SHELL
   * ============================================================ */
  function sideNav(active) {
    const items = [
      ["dashboard", "\uD83D\uDCCA", "\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645"],
      ["groups", "\uD83D\uDC65", "\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a"],
      ["subjects", "\uD83D\uDCDA", "\u0627\u0644\u0645\u0648\u0627\u062f"],
      ["questions", "\u2753", "\u0628\u0646\u0643 \u0627\u0644\u0623\u0633\u0626\u0644\u0629"],
      ["exams", "\uD83D\uDCDD", "\u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a"],
      ["teachers", "\uD83D\uDC68\u200D\uD83C\uDFEB", "\u0627\u0644\u0645\u0639\u0644\u0645\u0648\u0646"],
      ["students", "\uD83D\uDC66", "\u0627\u0644\u0637\u0644\u0627\u0628"],
      ["results", "\uD83D\uDCC8", "\u0627\u0644\u0646\u062a\u0627\u0626\u062c"],
      ["analytics", "\uD83E\uDDEE", "\u0627\u0644\u062a\u062d\u0644\u064a\u0644\u0627\u062a"],
      ["audit", "\uD83D\uDCDC", "\u0627\u0644\u0633\u062c\u0644"],
      ["settings", "\u2699", "\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a"]
    ];
    return (
      '<aside class="side">' +
      items.map(function (i) {
        return '<a href="#/' + i[0] + '" class="' + (active === i[0] ? "active" : "") + '">' +
          "<span>" + i[1] + "</span><span>" + i[2] + "</span></a>";
      }).join("") +
      '<div class="side-sep"></div>' +
      '<a id="logoutBtn"><span>\uD83D\uDEAA</span><span>\u062e\u0631\u0648\u062c</span></a>' +
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
    const lb = document.getElementById("logoutBtn");
    if (lb) lb.addEventListener("click", logout);
  }

  function stat(ico, val, lbl) {
    return '<div class="stat"><div class="ico">' + ico +
      '</div><div><div class="val">' + val +
      '</div><div class="lbl">' + lbl + "</div></div></div>";
  }

  function errorCard(e) {
    return '<div class="card"><div class="empty-state">' +
      '<div class="emoji">\u26D4</div>' +
      "<h3>\u062e\u0637\u0623</h3>" +
      "<p>" + U.esc(e.message) + "</p>" +
      "</div></div>";
  }

  /* ============================================================
   * DASHBOARD
   * ============================================================ */
  async function renderDashboard() {
    shell("dashboard", U.loaderHTML());
    try {
      const arr = await Promise.all([
        S.listSubjects(), S.listQuestions(), S.listExams(),
        S.listTeachers(), S.countSubmissions(),
        S.countPendingSubmissions(), S.listRecentSubmissions(8),
        S.listGroups()
      ]);
      const subjects = arr[0], questions = arr[1], exams = arr[2];
      const teachers = arr[3], subs = arr[4], pending = arr[5], recent = arr[6], groups = arr[7];

      state.subjects = subjects;
      state.questions = questions;
      state.exams = exams;
      state.teachers = teachers;
      state.groups = groups;

      const totalStudents = groups.reduce(function (s, g) { return s + (g.studentCount || 0); }, 0);

      const recentRows = recent.length
        ? recent.map(function (r) {
          return "<tr>" +
            '<td data-label="A">' + U.esc(r.studentName || "-") + "</td>" +
            '<td data-label="B">' + U.esc(r.examTitle || "-") + "</td>" +
            '<td data-label="C">' + U.submissionStatusBadge(r.status) + "</td>" +
            '<td data-label="D">' + (r.percent != null ? r.percent + "%" : "-") + "</td>" +
            '<td data-label="E" class="tiny">' + U.formatDate(r.createdAt) + "</td></tr>";
        }).join("")
        : '<tr><td colspan="5" class="table-empty">-</td></tr>';

      shell("dashboard",
        '<div class="card-head"><h2>\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645</h2><div class="spacer"></div>' +
        '<button class="btn btn-primary btn-sm" id="quickExam">+ \u0627\u062e\u062a\u0628\u0627\u0631</button></div>' +
        '<div class="stat-grid">' +
        stat("\uD83D\uDC65", groups.length, "\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a") +
        stat("\uD83D\uDC66", totalStudents, "\u0627\u0644\u0637\u0644\u0627\u0628") +
        stat("\uD83D\uDCDA", subjects.length, "\u0627\u0644\u0645\u0648\u0627\u062f") +
        stat("\u2753", questions.length, "\u0627\u0644\u0623\u0633\u0626\u0644\u0629") +
        stat("\uD83D\uDCDD", exams.length, "\u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a") +
        stat("\u23F3", pending, "\u0642\u064a\u062f \u0627\u0644\u062a\u0635\u062d\u064a\u062d") +
        "</div>" +
        '<div class="card mt"><div class="card-head"><h3>\u0623\u062d\u062f\u062b \u0627\u0644\u0646\u062a\u0627\u0626\u062c</h3><div class="spacer"></div>' +
        '<a class="btn btn-sm" href="#/results">\u0639\u0631\u0636 \u0627\u0644\u0643\u0644</a></div>' +
        '<div class="table-wrap responsive"><table><thead><tr>' +
        '<th>\u0627\u0644\u0637\u0627\u0644\u0628</th><th>\u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631</th><th>\u0627\u0644\u062d\u0627\u0644\u0629</th><th>\u0627\u0644\u0646\u0633\u0628\u0629</th><th>\u0627\u0644\u062a\u0627\u0631\u064a\u062e</th>' +
        "</tr></thead><tbody>" + recentRows + "</tbody></table></div></div>"
      );

      const qe = document.getElementById("quickExam");
      if (qe) qe.addEventListener("click", function () { location.hash = "#/exams"; });
    } catch (e) {
      shell("dashboard", errorCard(e));
    }
  }

  /* ============================================================
   * GROUPS (إدارة المجموعات)
   * ============================================================ */
  async function renderGroups() {
    shell("groups", U.loaderHTML());
    try {
      const arr = await Promise.all([S.listGroups(), S.listTeachers(), S.listSubjects()]);
      const groups = arr[0], teachers = arr[1], subjects = arr[2];
      state.groups = groups;
      state.teachers = teachers;
      state.subjects = subjects;

      const cards = groups.length
        ? '<div class="groups-grid">' + groups.map(function (g) {
          const assignments = g.teacherAssignments || [];
          const chips = assignments.length
            ? assignments.map(function (a) {
              const subj = subjects.find(function (s) { return s.id === a.subjectId; });
              return '<span class="assignment-chip">\uD83D\uDC68\u200D\uD83C\uDFEB ' +
                U.esc(a.teacherName || "?") + ' - ' + U.esc(subj ? subj.name : "?") +
                '<button class="chip-close" data-remove-assign="' + U.esc(g.id) + '|' + U.esc(a.teacherId) + '|' + U.esc(a.subjectId) + '">\u2715</button></span>';
            }).join("")
            : '<span class="muted tiny">\u0644\u0645 \u064a\u064f\u0639\u064a\u0651\u064e\u0646 \u0645\u0639\u0644\u0645 \u0628\u0639\u062f</span>';

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
            '<span class="badge ' + (g.active !== false ? "badge-success" : "badge-danger") + '">' +
            (g.active !== false ? "\u0646\u0634\u0637\u0629" : "\u0645\u0639\u0637\u0651\u0644\u0629") + '</span>' +
            '</div>' +
            '<div class="mb">' + chips + '</div>' +
            '<div class="flex flex-wrap">' +
            '<button class="btn btn-sm" data-manage="' + U.esc(g.id) + '">\u0627\u0644\u0645\u0639\u0644\u0645\u0648\u0646</button> ' +
            '<button class="btn btn-sm" data-edit-group="' + U.esc(g.id) + '">\u062a\u0639\u062f\u064a\u0644</button> ' +
            '<button class="btn btn-sm btn-danger" data-del-group="' + U.esc(g.id) + '">\u062d\u0630\u0641</button>' +
            '</div>' +
            '</div>';
        }).join("") + '</div>'
        : '<div class="empty-state"><div class="emoji">\uD83D\uDC65</div>' +
        "<h3>\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u062c\u0645\u0648\u0639\u0627\u062a</h3>" +
        '<p>\u0623\u0646\u0634\u0626 \u0623\u0648\u0644 \u0645\u062c\u0645\u0648\u0639\u0629</p></div>';

      shell("groups",
        '<div class="card-head"><h2>\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a</h2>' +
        '<span class="badge badge-primary">' + groups.length + '</span>' +
        '<div class="spacer"></div>' +
        '<button class="btn btn-primary" id="addGroup">+ \u0645\u062c\u0645\u0648\u0639\u0629 \u062c\u062f\u064a\u062f\u0629</button></div>' +
        '<div class="info-banner info">' +
        '<span class="emoji">\u2139\uFE0F</span>' +
        '<div><b>\u0643\u064a\u0641 \u064a\u0639\u0645\u0644 \u0627\u0644\u0646\u0637\u0627\u0645\u061f</b>' +
        '\u0643\u0644 \u0645\u062c\u0645\u0648\u0639\u0629 \u062a\u062c\u0645\u0639 \u0637\u0644\u0627\u0628\u0627\u064b \u0648\u0645\u0639\u0644\u0645\u064a\u0646. ' +
        '\u0627\u0644\u0645\u0639\u0644\u0645 \u064a\u0631\u0649 \u0641\u0642\u0637 \u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 \u0648\u064a\u0635\u062d\u0651\u062d \u0645\u0627\u062f\u062a\u0647.</div>' +
        '</div>' +
        cards
      );

      document.getElementById("addGroup").addEventListener("click", function () { groupModal(null); });
      document.querySelectorAll("[data-edit-group]").forEach(function (b) {
        b.addEventListener("click", function () {
          groupModal(groups.find(function (g) { return g.id === b.dataset.editGroup; }));
        });
      });
      document.querySelectorAll("[data-manage]").forEach(function (b) {
        b.addEventListener("click", function () { manageTeachersModal(b.dataset.manage); });
      });
      document.querySelectorAll("[data-del-group]").forEach(function (b) {
        b.addEventListener("click", async function () {
          if (await U.confirm("\u062d\u0630\u0641 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 \u0648\u062c\u0645\u064a\u0639 \u0627\u0646\u0636\u0645\u0627\u0645\u0627\u062a \u0627\u0644\u0637\u0644\u0627\u0628\u061f")) {
            await S.deleteGroup(b.dataset.delGroup);
            U.toast("\u062a\u0645 \u0627\u0644\u062d\u0630\u0641", "success");
            renderGroups();
          }
        });
      });
      document.querySelectorAll("[data-remove-assign]").forEach(function (b) {
        b.addEventListener("click", async function () {
          const parts = b.dataset.removeAssign.split("|");
          if (await U.confirm("\u0625\u0632\u0627\u0644\u0629 \u0647\u0630\u0627 \u0627\u0644\u0645\u0639\u0644\u0645 \u0645\u0646 \u0647\u0630\u0647 \u0627\u0644\u0645\u0627\u062f\u0629\u061f")) {
            await G.removeTeacherFromGroup(parts[0], parts[1], parts[2]);
            U.toast("\u062a\u0645\u062a \u0627\u0644\u0625\u0632\u0627\u0644\u0629", "success");
            renderGroups();
          }
        });
      });
    } catch (e) {
      shell("groups", errorCard(e));
    }
  }

  function groupModal(g) {
    const isEdit = !!g;
    U.modal({
      title: isEdit ? "\u062a\u0639\u062f\u064a\u0644 \u0645\u062c\u0645\u0648\u0639\u0629" : "\u0645\u062c\u0645\u0648\u0639\u0629 \u062c\u062f\u064a\u062f\u0629",
      body:
        '<div class="field"><label>\u0627\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 *</label>' +
        '<input id="gName" value="' + U.esc(g ? g.name : "") + '" placeholder="\u0645\u062b\u0627\u0644: \u0627\u0644\u0635\u0641 \u0627\u0644\u0633\u0627\u0628\u0639 - \u0623"></div>' +
        '<div class="field"><label>\u0627\u0644\u0648\u0635\u0641</label>' +
        '<textarea id="gDesc" style="min-height:70px">' + U.esc(g ? g.description : "") + "</textarea></div>" +
        (isEdit ? '<label class="check"><input type="checkbox" id="gActive"' +
          (g.active !== false ? " checked" : "") + '> \u0645\u062c\u0645\u0648\u0639\u0629 \u0646\u0634\u0637\u0629</label>' : ""),
      footer:
        '<button class="btn btn-primary" data-save>\u062d\u0641\u0638</button>' +
        '<button class="btn btn-ghost" data-close>\u0625\u0644\u063a\u0627\u0621</button>',
      onMount: function (node, close) {
        node.querySelector("[data-save]").addEventListener("click", async function () {
          const name = node.querySelector("#gName").value.trim();
          if (!name) return U.toast("\u0623\u062f\u062e\u0644 \u0627\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629", "warn");
          const data = {
            name: name,
            description: node.querySelector("#gDesc").value.trim()
          };
          if (isEdit) {
            const activeEl = node.querySelector("#gActive");
            if (activeEl) data.active = activeEl.checked;
          }
          try {
            if (isEdit) await S.updateGroup(g.id, data);
            else {
              data.teacherAssignments = [];
              await S.addGroup(data);
            }
            close();
            U.toast("\u062a\u0645 \u0627\u0644\u062d\u0641\u0638", "success");
            renderGroups();
          } catch (e) {
            U.toast("Error: " + e.message, "error");
          }
        });
      }
    });
  }

  function manageTeachersModal(groupId) {
    const group = state.groups.find(function (x) { return x.id === groupId; });
    if (!group) return;

    const render = function () {
      const teachers = state.teachers;
      const subjects = state.subjects;
      const assignments = group.teacherAssignments || [];

      const list = assignments.length
        ? assignments.map(function (a) {
          const subj = subjects.find(function (s) { return s.id === a.subjectId; });
          return '<div class="assignment-chip" style="padding:8px 12px;font-size:13px">' +
            '\uD83D\uDC68\u200D\uD83C\uDFEB <b>' + U.esc(a.teacherName) + '</b> \u2014 ' +
            '\uD83D\uDCD8 ' + U.esc(subj ? subj.name : "?") +
            '<button class="chip-close" data-remove="' + U.esc(a.teacherId) + '|' + U.esc(a.subjectId) + '">\u2715</button></div>';
        }).join("")
        : '<p class="muted">\u0644\u0645 \u064a\u064f\u0639\u064a\u0651\u064e\u0646 \u0623\u064a \u0645\u0639\u0644\u0645</p>';

      const teacherOpts = '<option value="">-- \u0627\u062e\u062a\u0631 \u0645\u0639\u0644\u0645 --</option>' +
        teachers.map(function (t) {
          return '<option value="' + t.id + '">' + U.esc(t.name) + '</option>';
        }).join("");

      const subjectOpts = '<option value="">-- \u0627\u062e\u062a\u0631 \u0645\u0627\u062f\u0629 --</option>' +
        subjects.map(function (s) {
          return '<option value="' + s.id + '">' + U.esc(s.name) + '</option>';
        }).join("");

      const body = document.getElementById("manageTeachersBody");
      if (body) {
        body.innerHTML =
          '<div class="field"><label>\u0627\u0644\u0645\u0639\u0644\u0645\u0648\u0646 \u0627\u0644\u062d\u0627\u0644\u064a\u0648\u0646</label>' +
          '<div style="background:var(--surface-2);padding:12px;border-radius:10px">' + list + '</div></div>' +
          '<div class="hr"></div>' +
          '<h4>\u0625\u0636\u0627\u0641\u0629 \u0645\u0639\u0644\u0645</h4>' +
          '<div class="subject-assignment-row">' +
          '<div class="field"><label>\u0627\u0644\u0645\u0639\u0644\u0645</label><select id="mTeacher">' + teacherOpts + '</select></div>' +
          '<div class="field"><label>\u0627\u0644\u0645\u0627\u062f\u0629</label><select id="mSubject">' + subjectOpts + '</select></div>' +
          '<button class="btn btn-primary" id="mAdd">\u0625\u0636\u0627\u0641\u0629</button>' +
          '</div>';

        body.querySelector("#mAdd").addEventListener("click", async function () {
          const tid = body.querySelector("#mTeacher").value;
          const sid = body.querySelector("#mSubject").value;
          if (!tid || !sid) return U.toast("\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0639\u0644\u0645 \u0648\u0627\u0644\u0645\u0627\u062f\u0629", "warn");
          try {
            await G.assignTeacherToGroup(groupId, tid, sid);
            U.toast("\u062a\u0645 \u0627\u0644\u062a\u0639\u064a\u064a\u0646", "success");
            // إعادة تحميل الحالة
            const fresh = await S.getGroup(groupId);
            Object.assign(group, fresh);
            render();
          } catch (e) {
            U.toast("Error: " + e.message, "error");
          }
        });

        body.querySelectorAll("[data-remove]").forEach(function (b) {
          b.addEventListener("click", async function () {
            const parts = b.dataset.remove.split("|");
            try {
              await G.removeTeacherFromGroup(groupId, parts[0], parts[1]);
              U.toast("\u062a\u0645\u062a \u0627\u0644\u0625\u0632\u0627\u0644\u0629", "success");
              const fresh = await S.getGroup(groupId);
              Object.assign(group, fresh);
              render();
            } catch (e) {
              U.toast("Error: " + e.message, "error");
            }
          });
        });
      }
    };

    U.modal({
      title: "\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0639\u0644\u0645\u064a\u0646 - " + group.name,
      size: "lg",
      body: '<div id="manageTeachersBody"></div>',
      footer: '<button class="btn btn-ghost" data-close>\u0625\u063a\u0644\u0627\u0642</button>',
      onMount: function (node, close) {
        render();
        // عند الإغلاق نعيد تحميل الصفحة
        const closeBtn = node.querySelector("[data-close]");
        if (closeBtn) {
          const originalClick = closeBtn.onclick;
        }
        // مراقبة إغلاق المودال
        const observer = new MutationObserver(function () {
          if (!document.body.contains(node)) {
            observer.disconnect();
            renderGroups();
          }
        });
        observer.observe(document.body, { childList: true });
      }
    });
  }

  /* ============================================================
   * SUBJECTS
   * ============================================================ */
  async function renderSubjects() {
    shell("subjects", U.loaderHTML());
    try {
      const subjects = await S.listSubjects();
      state.subjects = subjects;
      const qCounts = {};
      const qs = await S.listQuestions();
      qs.forEach(function (q) { qCounts[q.subjectId] = (qCounts[q.subjectId] || 0) + 1; });

      const rows = subjects.length
        ? subjects.map(function (s) {
          return "<tr>" +
            '<td data-label="A"><b>' + U.esc(s.name) + "</b></td>" +
            '<td data-label="B" class="muted">' + U.esc(s.description || "-") + "</td>" +
            '<td data-label="C"><span class="badge badge-primary">' + (qCounts[s.id] || 0) + "</span></td>" +
            '<td data-label="D" class="tiny">' + U.formatDate(s.createdAt) + "</td>" +
            '<td data-label="E">' +
            '<button class="btn btn-sm" data-edit="' + s.id + '">\u062a\u0639\u062f\u064a\u0644</button> ' +
            '<button class="btn btn-sm btn-danger" data-del="' + s.id + '">\u062d\u0630\u0641</button></td></tr>';
        }).join("")
        : '<tr><td colspan="5" class="table-empty">-</td></tr>';

      shell("subjects",
        '<div class="card-head"><h2>\u0627\u0644\u0645\u0648\u0627\u062f</h2><div class="spacer"></div>' +
        '<button class="btn btn-primary" id="addSub">+ \u0645\u0627\u062f\u0629</button></div>' +
        '<div class="table-wrap responsive"><table><thead><tr>' +
        '<th>\u0627\u0644\u0645\u0627\u062f\u0629</th><th>\u0627\u0644\u0648\u0635\u0641</th><th>\u0627\u0644\u0623\u0633\u0626\u0644\u0629</th><th>\u0623\u064f\u0646\u0634\u0626\u062a</th><th>\u0625\u062c\u0631\u0627\u0621\u0627\u062a</th>' +
        "</tr></thead><tbody>" + rows + "</tbody></table></div>"
      );

      document.getElementById("addSub").addEventListener("click", function () { subjectModal(); });
      document.querySelectorAll("[data-edit]").forEach(function (b) {
        b.addEventListener("click", function () {
          subjectModal(subjects.find(function (s) { return s.id === b.dataset.edit; }));
        });
      });
      document.querySelectorAll("[data-del]").forEach(function (b) {
        b.addEventListener("click", async function () {
          if (await U.confirm("\u062d\u0630\u0641 \u0627\u0644\u0645\u0627\u062f\u0629 \u0648\u0643\u0644 \u0623\u0633\u0626\u0644\u062a\u0647\u0627\u061f")) {
            await S.deleteSubject(b.dataset.del);
            U.toast("\u062a\u0645 \u0627\u0644\u062d\u0630\u0641", "success");
            renderSubjects();
          }
        });
      });
    } catch (e) {
      shell("subjects", errorCard(e));
    }
  }

  function subjectModal(s) {
    const isEdit = !!s;
    U.modal({
      title: isEdit ? "\u062a\u0639\u062f\u064a\u0644" : "\u0645\u0627\u062f\u0629 \u062c\u062f\u064a\u062f\u0629",
      body:
        '<div class="field"><label>\u0627\u0633\u0645 \u0627\u0644\u0645\u0627\u062f\u0629 *</label>' +
        '<input id="subName" value="' + U.esc(s ? s.name : "") + '"></div>' +
        '<div class="field"><label>\u0627\u0644\u0648\u0635\u0641</label>' +
        '<textarea id="subDesc" style="min-height:80px">' + U.esc(s ? s.description : "") + "</textarea></div>",
      footer:
        '<button class="btn btn-primary" data-save>\u062d\u0641\u0638</button>' +
        '<button class="btn btn-ghost" data-close>\u0625\u0644\u063a\u0627\u0621</button>',
      onMount: function (node, close) {
        node.querySelector("[data-save]").addEventListener("click", async function () {
          const name = node.querySelector("#subName").value.trim();
          if (!name) return U.toast("\u0623\u062f\u062e\u0644 \u0627\u0644\u0627\u0633\u0645", "warn");
          const data = { name: name, description: node.querySelector("#subDesc").value.trim() };
          try {
            if (isEdit) await S.updateSubject(s.id, data);
            else await S.addSubject(data);
            close();
            U.toast("\u062a\u0645 \u0627\u0644\u062d\u0641\u0638", "success");
            renderSubjects();
          } catch (e) {
            U.toast("Error: " + e.message, "error");
          }
        });
      }
    });
  }

  /* ============================================================
   * QUESTIONS
   * ============================================================ */
  const qFilter = { subjectId: "", type: "", diff: "", search: "", unit: "", lesson: "" };

  function diffLabel(d) {
    return d === "easy" ? "\u0633\u0647\u0644" : d === "hard" ? "\u0635\u0639\u0628" : "\u0645\u062a\u0648\u0633\u0637";
  }

  async function renderQuestions() {
    shell("questions", U.loaderHTML());
    try {
      const arr = await Promise.all([S.listSubjects(), S.listQuestions()]);
      const subjects = arr[0], questions = arr[1];
      state.subjects = subjects;
      state.questions = questions;

      // استخراج الوحدات والدروس الفريدة
      const unitsMap = {};
      const lessonsMap = {};
      questions.forEach(function (q) {
        if (q.unitNumber !== null && q.unitNumber !== undefined) {
          const key = "u:" + q.unitNumber;
          if (!unitsMap[key]) unitsMap[key] = { type: "number", value: q.unitNumber, label: "\u0627\u0644\u0648\u062d\u062f\u0629 " + q.unitNumber };
        }
        if (q.unitTitle) {
          const key = "ut:" + q.unitTitle;
          if (!unitsMap[key]) unitsMap[key] = { type: "title", value: q.unitTitle, label: q.unitTitle };
        }
        if (q.lessonTitle) lessonsMap[q.lessonTitle] = q.lessonTitle;
      });
      const units = Object.values(unitsMap).sort(function (a, b) {
        if (a.type === "number" && b.type === "number") return a.value - b.value;
        return a.label.localeCompare(b.label);
      });
      const lessons = Object.keys(lessonsMap).sort();

      const list = questions.filter(function (q) {
        if (qFilter.subjectId && q.subjectId !== qFilter.subjectId) return false;
        if (qFilter.type && q.type !== qFilter.type) return false;
        if (qFilter.diff && q.difficulty !== qFilter.diff) return false;
        if (qFilter.unit) {
          const parts = qFilter.unit.split(":");
          const kind = parts[0], val = parts.slice(1).join(":");
          if (kind === "u" && String(q.unitNumber) !== val) return false;
          if (kind === "ut" && q.unitTitle !== val) return false;
        }
        if (qFilter.lesson && q.lessonTitle !== qFilter.lesson) return false;
        if (qFilter.search && U.normalizeArabic(q.text).indexOf(U.normalizeArabic(qFilter.search)) < 0) return false;
        return true;
      });

      list.sort(function (a, b) {
        const ua = (a.unitNumber !== null && a.unitNumber !== undefined) ? a.unitNumber : 9999;
        const ub = (b.unitNumber !== null && b.unitNumber !== undefined) ? b.unitNumber : 9999;
        if (ua !== ub) return ua - ub;
        return (a.lessonTitle || "").localeCompare(b.lessonTitle || "");
      });

      const rows = list.length
        ? list.slice(0, 500).map(function (q) {
          const shortText = (q.text || "").slice(0, 80) + ((q.text && q.text.length > 80) ? "..." : "");
          const loc = [];
          if (q.unitNumber !== null && q.unitNumber !== undefined) loc.push("W" + q.unitNumber);
          else if (q.unitTitle) loc.push(U.esc(q.unitTitle));
          if (q.lessonTitle) loc.push(U.esc(q.lessonTitle));
          return "<tr>" +
            '<td data-label="T">' + U.badgeForType(q.type) + "</td>" +
            '<td data-label="Q">' + U.esc(shortText) + "</td>" +
            '<td data-label="Loc" class="tiny">' + (loc.length ? loc.join(" / ") : "-") + "</td>" +
            '<td data-label="S" class="muted">' + U.esc(q.subjectName || "-") + "</td>" +
            '<td data-label="D"><span class="badge badge-muted">' + diffLabel(q.difficulty) + "</span></td>" +
            '<td data-label="P">' + (q.points || 1) + "</td>" +
            '<td data-label="A">' +
            '<button class="btn btn-sm" data-view="' + q.id + '">\uD83D\uDC41</button> ' +
            '<button class="btn btn-sm" data-edit="' + q.id + '">\u270E</button> ' +
            '<button class="btn btn-sm btn-danger" data-del="' + q.id + '">\uD83D\uDDD1</button></td></tr>';
        }).join("")
        : '<tr><td colspan="7" class="table-empty">\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u0633\u0626\u0644\u0629 \u0645\u0637\u0627\u0628\u0642\u0629</td></tr>';

      const typeOpts = '<option value="">\u0643\u0644 \u0627\u0644\u0623\u0646\u0648\u0627\u0639</option>' +
        Object.keys(U.TYPE_LABELS).map(function (t) {
          return '<option value="' + t + '"' + (qFilter.type === t ? " selected" : "") + ">" + U.TYPE_LABELS[t] + "</option>";
        }).join("");

      const subjOpts = '<option value="">\u0643\u0644 \u0627\u0644\u0645\u0648\u0627\u062f</option>' +
        subjects.map(function (s) {
          return '<option value="' + s.id + '"' + (qFilter.subjectId === s.id ? " selected" : "") + ">" + U.esc(s.name) + "</option>";
        }).join("");

      const unitOpts = '<option value="">\u0643\u0644 \u0627\u0644\u0648\u062d\u062f\u0627\u062a</option>' +
        units.map(function (u) {
          const val = (u.type === "number" ? "u:" : "ut:") + u.value;
          return '<option value="' + U.esc(val) + '"' + (qFilter.unit === val ? " selected" : "") + ">" + U.esc(u.label) + "</option>";
        }).join("");

      const lessonOpts = '<option value="">\u0643\u0644 \u0627\u0644\u062f\u0631\u0648\u0633</option>' +
        lessons.map(function (l) {
          return '<option value="' + U.esc(l) + '"' + (qFilter.lesson === l ? " selected" : "") + ">" + U.esc(l) + "</option>";
        }).join("");

      shell("questions",
        '<div class="card-head"><h2>\u0628\u0646\u0643 \u0627\u0644\u0623\u0633\u0626\u0644\u0629</h2>' +
        '<span class="badge badge-primary">' + list.length + " / " + questions.length + "</span>" +
        '<div class="spacer"></div>' +
        '<button class="btn" id="importBtn">\u2b07 \u0627\u0633\u062a\u064a\u0631\u0627\u062f</button> ' +
        '<button class="btn btn-primary" id="addQ">+ \u0633\u0624\u0627\u0644</button></div>' +

        '<div class="card"><div class="form-row-3">' +
        '<div class="field" style="margin:0"><input id="fSearch" placeholder="\uD83D\uDD0D \u0628\u062d\u062b..." value="' + U.esc(qFilter.search) + '"></div>' +
        '<div class="field" style="margin:0"><select id="fSubj">' + subjOpts + "</select></div>" +
        '<div class="field" style="margin:0"><select id="fType">' + typeOpts + "</select></div>" +
        "</div>" +
        '<div class="form-row-3 mt-sm">' +
        '<div class="field" style="margin:0"><select id="fUnit">' + unitOpts + "</select></div>" +
        '<div class="field" style="margin:0"><select id="fLesson">' + lessonOpts + "</select></div>" +
        '<div class="field" style="margin:0"><button class="btn btn-sm" id="resetFilters" style="width:100%">\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u0641\u0644\u0627\u062a\u0631</button></div>' +
        "</div></div>" +

        '<div class="table-wrap responsive mt"><table><thead><tr>' +
        '<th>\u0627\u0644\u0646\u0648\u0639</th><th>\u0627\u0644\u0633\u0624\u0627\u0644</th><th>\u0627\u0644\u0645\u0648\u0642\u0639</th><th>\u0627\u0644\u0645\u0627\u062f\u0629</th><th>\u0627\u0644\u0635\u0639\u0648\u0628\u0629</th><th>\u0627\u0644\u062f\u0631\u062c\u0629</th><th></th>' +
        "</tr></thead><tbody>" + rows + "</tbody></table></div>" +

        (list.length > 500 ? '<p class="help mt-sm center">\u064a\u0639\u0631\u0636 \u0623\u0648\u0644 500 \u0633\u0624\u0627\u0644</p>' : "")
      );

      document.getElementById("addQ").addEventListener("click", function () {
        questionModal(null, function () { renderQuestions(); });
      });
      document.getElementById("importBtn").addEventListener("click", function () {
        importModal(function () { renderQuestions(); });
      });
      document.getElementById("fSearch").addEventListener("input", U.debounce(function (e) {
        qFilter.search = e.target.value;
        renderQuestions().then(function () {
          const el = document.getElementById("fSearch");
          if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
        });
      }, 350));
      document.getElementById("fSubj").addEventListener("change", function (e) {
        qFilter.subjectId = e.target.value; renderQuestions();
      });
      document.getElementById("fType").addEventListener("change", function (e) {
        qFilter.type = e.target.value; renderQuestions();
      });
      document.getElementById("fUnit").addEventListener("change", function (e) {
        qFilter.unit = e.target.value; renderQuestions();
      });
      document.getElementById("fLesson").addEventListener("change", function (e) {
        qFilter.lesson = e.target.value; renderQuestions();
      });
      document.getElementById("resetFilters").addEventListener("click", function () {
        qFilter.subjectId = ""; qFilter.type = ""; qFilter.diff = "";
        qFilter.search = ""; qFilter.unit = ""; qFilter.lesson = "";
        renderQuestions();
      });

      document.querySelectorAll("[data-edit]").forEach(function (b) {
        b.addEventListener("click", function () {
          questionModal(questions.find(function (x) { return x.id === b.dataset.edit; }), function () { renderQuestions(); });
        });
      });
      document.querySelectorAll("[data-view]").forEach(function (b) {
        b.addEventListener("click", function () {
          const q = questions.find(function (x) { return x.id === b.dataset.view; });
          if (q) viewQuestionModal(q);
        });
      });
      document.querySelectorAll("[data-del]").forEach(function (b) {
        b.addEventListener("click", async function () {
          if (await U.confirm("\u062d\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u0633\u0624\u0627\u0644\u061f")) {
            await S.deleteQuestion(b.dataset.del);
            U.toast("\u062a\u0645 \u0627\u0644\u062d\u0630\u0641", "success");
            renderQuestions();
          }
        });
      });
    } catch (e) {
      shell("questions", errorCard(e));
    }
  }

  function viewQuestionModal(q) {
    const ansTxt = Array.isArray(q.answer) ? q.answer.join(" \u060C ") : (q.answer || "-");
    U.modal({
      title: "\u0639\u0631\u0636 \u0627\u0644\u0633\u0624\u0627\u0644",
      body:
        '<div class="student-info-row mb">' +
        '<div class="item"><div class="lbl">\u0627\u0644\u0646\u0648\u0639</div><div class="val">' + (U.TYPE_LABELS[q.type] || q.type) + "</div></div>" +
        '<div class="item"><div class="lbl">\u0627\u0644\u0645\u0627\u062f\u0629</div><div class="val">' + U.esc(q.subjectName || "-") + "</div></div>" +
        '<div class="item"><div class="lbl">\u0627\u0644\u0648\u062d\u062f\u0629</div><div class="val">' + U.esc((q.unitNumber !== null && q.unitNumber !== undefined) ? "\u0631\u0642\u0645 " + q.unitNumber : (q.unitTitle || "-")) + "</div></div>" +
        '<div class="item"><div class="lbl">\u0627\u0644\u062f\u0631\u0633</div><div class="val">' + U.esc(q.lessonTitle || "-") + "</div></div>" +
        '<div class="item"><div class="lbl">\u0627\u0644\u062f\u0631\u062c\u0629</div><div class="val">' + (q.points || 1) + "</div></div>" +
        "</div>" +
        '<div class="field"><label>\u0627\u0644\u0633\u0624\u0627\u0644</label>' +
        '<div style="background:var(--surface-2);padding:12px;border-radius:10px;line-height:1.8">' + U.esc(q.text) + "</div></div>" +
        (q.options && q.options.length ?
          '<div class="field"><label>\u0627\u0644\u062e\u064a\u0627\u0631\u0627\u062a</label>' +
          q.options.map(function (o, i) {
            const isCorrect = Array.isArray(q.answer) ? q.answer.indexOf(o) >= 0 : q.answer === o;
            return '<div style="padding:6px 0"><span class="badge ' + (isCorrect ? "badge-success" : "badge-muted") + '">' + (i + 1) + "</span> " + U.esc(o) + "</div>";
          }).join("") + "</div>" : "") +
        '<div class="field"><label>\u0627\u0644\u0625\u062c\u0627\u0628\u0629 \u0627\u0644\u0635\u062d\u064a\u062d\u0629</label>' +
        '<b style="color:var(--success)">' + U.esc(ansTxt) + "</b></div>" +
        (q.explanation ? '<div class="field"><label>\u0627\u0644\u0634\u0631\u062d</label><div class="muted">' + U.esc(q.explanation) + "</div></div>" : ""),
      footer: '<button class="btn btn-ghost" data-close>\u0625\u063a\u0644\u0627\u0642</button>'
    });
  }

  function optionsEditorHTML(options, correct, type) {
    options = options && options.length ? options : ["", "", "", ""];
    const inputType = type === "multi" ? "checkbox" : "radio";
    return options.map(function (o, i) {
      const checked = Array.isArray(correct) ? correct.indexOf(o) >= 0 : correct === o;
      return '<div class="flex opt-row" data-opt style="margin-bottom:8px">' +
        '<input type="' + inputType + '" name="correctMark" data-correct style="width:auto"' + (checked && o ? " checked" : "") + ">" +
        '<input type="text" data-opttext value="' + U.esc(o) + '" placeholder="\u0627\u0644\u062e\u064a\u0627\u0631 ' + (i + 1) + '">' +
        '<button type="button" class="btn btn-sm btn-danger" data-rmopt>\u2715</button></div>';
    }).join("");
  }

  function questionFormHTML(q) {
    q = q || { type: "mcq", options: ["", "", "", ""], answer: "", difficulty: "medium", points: 1, tags: [], explanation: "" };
    const isMCQ = q.type === "mcq" || q.type === "multi";
    const isTF = q.type === "true_false";
    const isText = ["fill_blank", "short_answer", "essay"].indexOf(q.type) >= 0;
    return (
      '<div class="field"><label>\u0646\u0648\u0639 \u0627\u0644\u0633\u0624\u0627\u0644</label><select id="qType">' +
      Object.keys(U.TYPE_LABELS).map(function (t) {
        return '<option value="' + t + '"' + (q.type === t ? " selected" : "") + ">" + U.TYPE_LABELS[t] + "</option>";
      }).join("") + "</select></div>" +
      '<div class="field"><label>\u0646\u0635 \u0627\u0644\u0633\u0624\u0627\u0644 *</label>' +
      '<textarea id="qText" style="min-height:80px">' + U.esc(q.text || "") + "</textarea></div>" +
      '<div id="fieldsOptions" class="' + (isMCQ ? "" : "hidden") + '">' +
      '<label class="tiny">\u0627\u0644\u062e\u064a\u0627\u0631\u0627\u062a</label>' +
      '<div id="optionsBox">' + optionsEditorHTML(q.options, q.answer, q.type) + "</div>" +
      '<button type="button" class="btn btn-sm mt-sm" id="addOpt">+ \u062e\u064a\u0627\u0631</button></div>' +
      '<div id="fieldsTF" class="field ' + (isTF ? "" : "hidden") + '"><label>\u0627\u0644\u0625\u062c\u0627\u0628\u0629</label>' +
      '<label class="check"><input type="radio" name="tf" value="\u0635\u062d"' + (q.answer === "\u0635\u062d" ? " checked" : "") + "> \u0635\u062d</label>" +
      '<label class="check"><input type="radio" name="tf" value="\u062e\u0637\u0623"' + (q.answer === "\u062e\u0637\u0623" ? " checked" : "") + "> \u062e\u0637\u0623</label></div>" +
      '<div id="fieldsText" class="field ' + (isText ? "" : "hidden") + '">' +
      '<label>\u0627\u0644\u0625\u062c\u0627\u0628\u0629 \u0627\u0644\u0646\u0645\u0648\u0630\u062c\u064a\u0629' + (q.type === "essay" ? "" : " *") + '</label>' +
      '<textarea id="qAnswer" style="min-height:70px">' +
      U.esc((q.type === "true_false" || q.type === "mcq" || q.type === "multi") ? "" : (q.answer || "")) +
      "</textarea></div>" +
      '<div class="form-row-3">' +
      '<div class="field"><label>\u0627\u0644\u0635\u0639\u0648\u0628\u0629</label><select id="qDiff">' +
      ["easy", "medium", "hard"].map(function (d) {
        return '<option value="' + d + '"' + (q.difficulty === d ? " selected" : "") + ">" + diffLabel(d) + "</option>";
      }).join("") + "</select></div>" +
      '<div class="field"><label>\u0627\u0644\u062f\u0631\u062c\u0629</label>' +
      '<input type="number" id="qPoints" min="0.5" step="0.5" value="' + (q.points || 1) + '"></div>' +
      '<div class="field"><label>\u0627\u0644\u0648\u062d\u062f\u0629</label>' +
      '<input type="number" id="qUnitNumber" value="' + ((q.unitNumber !== null && q.unitNumber !== undefined) ? q.unitNumber : "") + '" placeholder="\u0631\u0642\u0645"></div>' +
      "</div>" +
      '<div class="form-row">' +
      '<div class="field"><label>\u0627\u0633\u0645 \u0627\u0644\u062f\u0631\u0633</label>' +
      '<input id="qLesson" value="' + U.esc(q.lessonTitle || "") + '"></div>' +
      '<div class="field"><label>\u0648\u0633\u0648\u0645</label>' +
      '<input id="qTags" value="' + U.esc((q.tags || []).join(", ")) + '"></div>' +
      "</div>" +
      '<div class="field"><label>\u0627\u0644\u0634\u0631\u062d (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)</label>' +
      '<textarea id="qExp" style="min-height:60px">' + U.esc(q.explanation || "") + "</textarea></div>"
    );
  }

  function bindQuestionForm(node) {
    const typeSel = node.querySelector("#qType");
    const syncType = function () {
      const t = typeSel.value;
      node.querySelector("#fieldsOptions").classList.toggle("hidden", !(t === "mcq" || t === "multi"));
      node.querySelector("#fieldsTF").classList.toggle("hidden", t !== "true_false");
      node.querySelector("#fieldsText").classList.toggle("hidden", !(t === "fill_blank" || t === "short_answer" || t === "essay"));
      node.querySelectorAll("input[data-correct]").forEach(function (r) { r.type = t === "multi" ? "checkbox" : "radio"; });
    };
    typeSel.addEventListener("change", syncType);
    node.querySelector("#addOpt").addEventListener("click", function () {
      const box = node.querySelector("#optionsBox");
      if (box.querySelectorAll("[data-opt]").length >= 8) return U.toast("\u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649 8", "warn");
      const t = typeSel.value;
      const div = document.createElement("div");
      div.className = "flex opt-row";
      div.setAttribute("data-opt");
      div.style.marginBottom = "8px";
      div.innerHTML = '<input type="' + (t === "multi" ? "checkbox" : "radio") + '" name="correctMark" data-correct style="width:auto">' +
        '<input type="text" data-opttext placeholder="\u062e\u064a\u0627\u0631 \u062c\u062f\u064a\u062f">' +
        '<button type="button" class="btn btn-sm btn-danger" data-rmopt>\u2715</button>';
      box.appendChild(div);
      bindOptionRow(div);
    });
    node.querySelectorAll("[data-opt]").forEach(bindOptionRow);
  }

  function bindOptionRow(row) {
    const rm = row.querySelector("[data-rmopt]");
    rm.addEventListener("click", function () {
      const box = row.parentElement;
      if (box.querySelectorAll("[data-opt]").length <= 2) return U.toast("\u0644\u0627 \u064a\u0645\u0643\u0646 \u0623\u0642\u0644 \u0645\u0646 2", "warn");
      row.remove();
    });
  }

  function collectQuestionForm(node) {
    const type = node.querySelector("#qType").value;
    const text = node.querySelector("#qText").value.trim();
    const points = Number(node.querySelector("#qPoints").value) || 1;
    const difficulty = node.querySelector("#qDiff").value;
    const tags = node.querySelector("#qTags").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    const explanation = node.querySelector("#qExp").value.trim();
    const unitNumberRaw = node.querySelector("#qUnitNumber").value.trim();
    const unitNumber = unitNumberRaw === "" ? null : Number(unitNumberRaw);
    const lessonTitle = node.querySelector("#qLesson").value.trim();
    let options = [], answer = null;
    if (type === "mcq" || type === "multi") {
      const rows = Array.from(node.querySelectorAll("[data-opt]"));
      options = rows.map(function (r) { return r.querySelector("[data-opttext]").value.trim(); }).filter(Boolean);
      const corrects = rows.filter(function (r) { return r.querySelector("[data-correct]").checked; })
        .map(function (r) { return r.querySelector("[data-opttext]").value.trim(); });
      answer = type === "multi" ? corrects : (corrects[0] || "");
      if (type === "mcq" && options.length < 2) throw new Error("\u0623\u062f\u062e\u0644 \u062e\u064a\u0627\u0631\u064a\u0646 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644");
      if (!answer || (Array.isArray(answer) && !answer.length)) throw new Error("\u062d\u062f\u062f \u0627\u0644\u0625\u062c\u0627\u0628\u0629");
    } else if (type === "true_false") {
      const r = node.querySelector('input[name="tf"]:checked');
      answer = r ? r.value : "";
      if (!answer) throw new Error("\u062d\u062f\u062f \u0635\u062d \u0623\u0648 \u062e\u0637\u0623");
    } else {
      answer = node.querySelector("#qAnswer").value.trim();
      if (type !== "essay" && !answer) throw new Error("\u0623\u062f\u062e\u0644 \u0627\u0644\u0625\u062c\u0627\u0628\u0629");
    }
    if (!text) throw new Error("\u0623\u062f\u062e\u0644 \u0646\u0635 \u0627\u0644\u0633\u0624\u0627\u0644");
    return {
      type: type, text: text, options: options, answer: answer,
      difficulty: difficulty, tags: tags, explanation: explanation, points: points,
      unitNumber: unitNumber, lessonTitle: lessonTitle
    };
  }

  function questionModal(q, onDone) {
    const isEdit = !!q;
    U.modal({
      title: isEdit ? "\u062a\u0639\u062f\u064a\u0644 \u0633\u0624\u0627\u0644" : "\u0625\u0636\u0627\u0641\u0629 \u0633\u0624\u0627\u0644",
      size: "lg",
      body: (isEdit ? "" :
        '<div class="field"><label>\u0627\u0644\u0645\u0627\u062f\u0629</label><select id="qSubj"><option value="">- \u0628\u062f\u0648\u0646 -</option>' +
        state.subjects.map(function (s) { return '<option value="' + s.id + '">' + U.esc(s.name) + "</option>"; }).join("") +
        "</select></div>") + questionFormHTML(q),
      footer: '<button class="btn btn-primary" data-save>\u062d\u0641\u0638</button>' +
        '<button class="btn btn-ghost" data-close>\u0625\u0644\u063a\u0627\u0621</button>',
      onMount: function (node, close) {
        bindQuestionForm(node);
        node.querySelector("[data-save]").addEventListener("click", async function () {
          try {
            const data = collectQuestionForm(node);
            let subjectId = q && q.subjectId, subjectName = q && q.subjectName;
            if (!isEdit) {
              subjectId = node.querySelector("#qSubj").value;
              const subj = state.subjects.find(function (s) { return s.id === subjectId; });
              subjectName = subj ? subj.name : "";
            }
            if (isEdit) await S.updateQuestion(q.id, data);
            else await S.addQuestion(data, subjectId, subjectName);
            close();
            U.toast("\u062a\u0645 \u0627\u0644\u062d\u0641\u0638", "success");
            if (onDone) onDone();
          } catch (e) {
            U.toast(e.message, "error");
          }
        });
      }
    });
  }

  /* ============================================================
   * IMPORT (كما هو من v3 — أعرضه مختصراً)
   * ============================================================ */
  function importModal(onDone) {
    U.modal({
      title: "\u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0623\u0633\u0626\u0644\u0629",
      size: "lg",
      body:
        '<div class="form-row">' +
        '<div class="field"><label>\u0627\u0644\u0645\u0627\u062f\u0629</label><select id="impSubj"><option value="">-</option>' +
        state.subjects.map(function (s) { return '<option value="' + s.id + '">' + U.esc(s.name) + "</option>"; }).join("") +
        "</select></div>" +
        '<div class="field"><label>\u0627\u0644\u0635\u064a\u063a\u0629</label><select id="impFormat">' +
        '<option value="auto">\u0627\u0643\u062a\u0634\u0627\u0641</option>' +
        '<option value="json">JSON</option>' +
        '<option value="csv">CSV</option>' +
        '<option value="text">\u0646\u0635</option></select></div></div>' +
        '<div class="field"><label>\u0627\u0644\u0645\u062d\u062a\u0648\u0649</label>' +
        '<textarea id="impText" style="min-height:180px"></textarea></div>' +
        '<div class="flex"><label class="btn btn-sm">\uD83D\uDCC1 \u0645\u0644\u0641' +
        '<input type="file" id="impFile" accept=".json,.csv,.txt" class="hidden"></label>' +
        '<div class="spacer right"></div>' +
        '<button class="btn btn-sm" id="previewBtn">\u0645\u0639\u0627\u064a\u0646\u0629</button></div>' +
        '<div id="impPreview" class="mt"></div>',
      footer: '<button class="btn btn-primary" data-save disabled>\u0627\u0633\u062a\u064a\u0631\u0627\u062f</button>' +
        '<button class="btn btn-ghost" data-close>\u0625\u0644\u063a\u0627\u0621</button>',
      onMount: function (node, close) {
        let parsed = [];
        const preview = node.querySelector("#impPreview");
        const saveBtn = node.querySelector("[data-save]");
        node.querySelector("#impFile").addEventListener("change", function (e) {
          const f = e.target.files[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = function () { node.querySelector("#impText").value = reader.result; };
          reader.readAsText(f);
        });
        const doPreview = function () {
          const res = QP.importer.parse(node.querySelector("#impText").value, node.querySelector("#impFormat").value);
          parsed = res.questions;
          const ok = parsed.filter(function (q) { return !q._errors.length; }).length;
          const bad = parsed.length - ok;
          let html = '<div class="flex flex-wrap">' +
            '<span class="badge badge-success">' + ok + " \u0635\u0627\u0644\u062d</span>" +
            (bad ? '<span class="badge badge-danger">' + bad + " \u062e\u0637\u0623</span>" : "") +
            '<span class="badge badge-muted">' + (res.format || "-") + "</span></div>";
          if (res.errors.length) html += '<p class="help">' + res.errors.slice(0, 6).map(U.esc).join("<br>") + "</p>";
          html += '<div class="import-preview mt-sm">' + parsed.slice(0, 40).map(function (q, i) {
            return '<div class="row"><b>' + (i + 1) + ".</b> " + U.badgeForType(q.type) + " " +
              U.esc((q.text || "").slice(0, 80)) +
              (q._errors.length ? ' <span class="badge badge-danger">' + U.esc(q._errors[0]) + "</span>" : "") + "</div>";
          }).join("") + "</div>";
          preview.innerHTML = html;
          saveBtn.disabled = ok === 0;
        };
        node.querySelector("#previewBtn").addEventListener("click", doPreview);
        saveBtn.addEventListener("click", async function () {
          const valid = parsed.filter(function (q) { return !q._errors.length; });
          if (!valid.length) return U.toast("\u0644\u0627 \u064a\u0648\u062c\u062f \u0635\u0627\u0644\u062d", "warn");
          const subjectId = node.querySelector("#impSubj").value;
          const subj = state.subjects.find(function (s) { return s.id === subjectId; });
          saveBtn.disabled = true; saveBtn.textContent = "...";
          try {
            const n = await S.addQuestionsBulk(valid, subjectId, subj ? subj.name : "");
            close();
            U.toast("\u062a\u0645 \u0627\u0633\u062a\u064a\u0631\u0627\u062f " + n, "success");
            if (onDone) onDone();
          } catch (e) {
            U.toast("Error: " + e.message, "error");
            saveBtn.disabled = false; saveBtn.textContent = "\u0627\u0633\u062a\u064a\u0631\u0627\u062f";
          }
        });
      }
    });
  }

  /* ============================================================
   * EXAMS (مع الإنشاء التلقائي + استهداف المجموعات)
   * ============================================================ */
  function statusBadge(s) {
    if (s === "published") return '<span class="badge badge-success">\u0645\u0646\u0634\u0648\u0631</span>';
    if (s === "closed") return '<span class="badge badge-danger">\u0645\u063a\u0644\u0642</span>';
    return '<span class="badge badge-warning">\u0645\u0633\u0648\u062f\u0629</span>';
  }

  async function renderExams() {
    shell("exams", U.loaderHTML());
    try {
      const arr = await Promise.all([S.listExams(), S.listGroups()]);
      const exams = arr[0], groups = arr[1];
      state.exams = exams;
      state.groups = groups;

      const groupName = function (id) {
        if (id === "ALL") return "\u0627\u0644\u0643\u0644";
        const g = groups.find(function (x) { return x.id === id; });
        return g ? g.name : "?";
      };

      const rows = exams.length
        ? exams.map(function (e) {
          const groupsTxt = (e.targetGroups || []).length
            ? (e.targetGroups || []).map(function (id) {
              return '<span class="badge badge-muted">' + U.esc(groupName(id)) + "</span>";
            }).join(" ")
            : '<span class="muted tiny">-</span>';

          return "<tr>" +
            '<td data-label="T"><b>' + U.esc(e.title) + "</b>" +
            (e.autoGenerated ? ' <span class="badge badge-primary">\u062a\u0644\u0642\u0627\u0626\u064a</span>' : "") +
            "<div class='tiny'>" + U.esc(e.subjectName || "-") + "</div></td>" +
            '<td data-label="C"><span class="code-box" style="padding:4px 10px"><span class="code" style="font-size:16px">' + U.esc(e.code) + "</span></span></td>" +
            '<td data-label="Q">' + (e.questions || []).length + "</td>" +
            '<td data-label="G">' + groupsTxt + "</td>" +
            '<td data-label="S">' + statusBadge(e.status) + "</td>" +
            '<td data-label="A">' +
            '<button class="btn btn-sm" data-copy="' + U.esc(e.code) + '">\uD83D\uDCCB</button> ' +
            '<button class="btn btn-sm" data-res="' + e.id + '">\uD83D\uDCCA</button> ' +
            '<button class="btn btn-sm" data-edit="' + e.id + '">\u270E</button> ' +
            '<button class="btn btn-sm btn-danger" data-del="' + e.id + '">\uD83D\uDDD1</button></td></tr>';
        }).join("")
        : '<tr><td colspan="6" class="table-empty">\u0644\u0627 \u062a\u0648\u062c\u062f \u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a</td></tr>';

      shell("exams",
        '<div class="card-head"><h2>\u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a</h2><div class="spacer"></div>' +
        '<button class="btn btn-primary" id="newExam">+ \u0627\u062e\u062a\u0628\u0627\u0631</button></div>' +
        '<div class="table-wrap responsive"><table><thead><tr>' +
        '<th>\u0627\u0644\u0639\u0646\u0648\u0627\u0646</th><th>\u0627\u0644\u0643\u0648\u062f</th><th>\u0627\u0644\u0623\u0633\u0626\u0644\u0629</th><th>\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a</th><th>\u0627\u0644\u062d\u0627\u0644\u0629</th><th></th>' +
        "</tr></thead><tbody>" + rows + "</tbody></table></div>"
      );

      document.getElementById("newExam").addEventListener("click", function () { examWizard(null); });
      document.querySelectorAll("[data-copy]").forEach(function (b) {
        b.addEventListener("click", function () { U.copy(b.dataset.copy); });
      });
      document.querySelectorAll("[data-res]").forEach(function (b) {
        b.addEventListener("click", function () {
          state.pendingResultExam = b.dataset.res;
          location.hash = "#/results";
        });
      });
      document.querySelectorAll("[data-edit]").forEach(function (b) {
        b.addEventListener("click", function () {
          examWizard(exams.find(function (e) { return e.id === b.dataset.edit; }));
        });
      });
      document.querySelectorAll("[data-del]").forEach(function (b) {
        b.addEventListener("click", async function () {
          if (await U.confirm("\u062d\u0630\u0641 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631\u061f")) {
            await S.deleteExam(b.dataset.del);
            U.toast("\u062a\u0645 \u0627\u0644\u062d\u0630\u0641", "success");
            renderExams();
          }
        });
      });
    } catch (e) {
      shell("exams", errorCard(e));
    }
  }

  /* ============================================================
   * EXAM WIZARD - إنشاء اختبار (تلقائي + استهداف مجموعات)
   * ============================================================ */
  function examWizard(exam) {
    const isEdit = !!exam;
    const chosen = [];
    const selectedIds = {};

    // إذا كان تعديل، نبدأ بالأسئلة المحفوظة
    if (isEdit && exam.questions) {
      exam.questions.forEach(function (q) {
        chosen.push(Object.assign({}, q));
        if (q._sourceId) selectedIds[q._sourceId] = true;
      });
    }

    U.modal({
      title: isEdit ? "\u062a\u0639\u062f\u064a\u0644 \u0627\u062e\u062a\u0628\u0627\u0631" : "\u0627\u062e\u062a\u0628\u0627\u0631 \u062c\u062f\u064a\u062f",
      size: "xl",
      body:
        '<div class="form-row">' +
        '<div class="field"><label>\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 *</label>' +
        '<input id="exTitle" value="' + U.esc(exam ? exam.title : "") + '"></div>' +
        '<div class="field"><label>\u0627\u0644\u0645\u0627\u062f\u0629 *</label><select id="exSubj">' +
        '<option value="">-</option>' +
        state.subjects.map(function (s) {
          return '<option value="' + s.id + '"' + (exam && exam.subjectId === s.id ? " selected" : "") + ">" + U.esc(s.name) + "</option>";
        }).join("") + "</select></div></div>" +

        '<div class="field"><label>\u0627\u0644\u0648\u0635\u0641</label>' +
        '<input id="exDesc" value="' + U.esc(exam ? exam.description : "") + '"></div>' +

        '<div class="form-row-3">' +
        '<div class="field"><label>\u0627\u0644\u0645\u062f\u0629 (\u062f\u0642\u064a\u0642\u0629)</label>' +
        '<input type="number" id="exDur" min="0" value="' + (exam ? exam.durationMin || 0 : 30) + '"></div>' +
        '<div class="field"><label>\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0641\u062a\u062d</label>' +
        '<input type="datetime-local" id="exOpenAt" value="' + (exam && exam.openAt ? exam.openAt.slice(0, 16) : "") + '"></div>' +
        '<div class="field"><label>\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0625\u063a\u0644\u0627\u0642</label>' +
        '<input type="datetime-local" id="exCloseAt" value="' + (exam && exam.closeAt ? exam.closeAt.slice(0, 16) : "") + '"></div>' +
        "</div>" +

        '<div class="form-row-3">' +
        '<div class="field"><label>\u0646\u0633\u0628\u0629 \u0627\u0644\u0646\u062c\u0627\u062d %</label>' +
        '<input type="number" id="exPass" min="0" max="100" value="' + (exam && exam.settings ? exam.settings.passScore || 50 : 50) + '"></div>' +
        '<label class="check"><input type="checkbox" id="shuffleQuestions"' +
        (exam && exam.settings && exam.settings.shuffleQuestions ? " checked" : "") + '> \u062a\u0631\u062a\u064a\u0628 \u0639\u0634\u0648\u0627\u0626\u064a</label>' +
        '<label class="check"><input type="checkbox" id="allowReview"' +
        (exam && exam.settings && exam.settings.allowReview !== false ? " checked" : "") + '> \u0627\u0644\u0633\u0645\u0627\u062d \u0628\u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u0625\u062c\u0627\u0628\u0627\u062a</label>' +
        "</div>" +

        '<div class="hr"></div>' +

        '<h3>\uD83C\uDFAF \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u0647\u062f\u0641\u0629</h3>' +
        '<div id="groupsBox" class="mb"></div>' +

        '<div class="hr"></div>' +

        '<h3>\uD83D\uDD0D \u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u0623\u0633\u0626\u0644\u0629</h3>' +

        '<div class="filter-bar">' +
        '<div class="field"><label>\u0627\u0644\u0648\u062d\u062f\u0629</label><select id="exUnit"><option value="">\u0627\u0644\u0643\u0644</option></select></div>' +
        '<div class="field"><label>\u0627\u0644\u062f\u0631\u0633</label><select id="exLesson"><option value="">\u0627\u0644\u0643\u0644</option></select></div>' +
        '<div class="field"><label>\u0627\u0644\u0635\u0639\u0648\u0628\u0629</label><select id="exDiff">' +
        '<option value="">\u0627\u0644\u0643\u0644</option>' +
        '<option value="easy">\u0633\u0647\u0644</option>' +
        '<option value="medium">\u0645\u062a\u0648\u0633\u0637</option>' +
        '<option value="hard">\u0635\u0639\u0628</option></select></div>' +
        '<div class="field"><label>\u0627\u0644\u0639\u062f\u062f \u0627\u0644\u0623\u0642\u0635\u0649</label>' +
        '<input type="number" id="exMax" min="0" placeholder="\u0627\u0644\u0643\u0644"></div>' +
        '</div>' +
        '<div class="flex flex-wrap mb">' +
        '<button class="btn btn-primary btn-sm" id="fetchBtn">\uD83D\uDD0D \u062c\u0644\u0628 \u0627\u0644\u0623\u0633\u0626\u0644\u0629</button> ' +
        '<button class="btn btn-sm" id="selectAllBtn">\u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0643\u0644</button> ' +
        '<button class="btn btn-sm" id="clearBtn">\u0645\u0633\u062d \u0627\u0644\u062a\u062d\u062f\u064a\u062f</button> ' +
        '<div class="spacer right"></div>' +
        '<span class="badge badge-primary" id="chosenCount">0 \u0633\u0624\u0627\u0644</span>' +
        '<span class="badge badge-muted" id="chosenPoints">0 \u062f\u0631\u062c\u0629</span>' +
        '</div>' +
        '<div id="fetchInfo" class="tiny muted mb"></div>' +
        '<div id="qList" class="auto-exam-list"><p class="muted center" style="padding:20px">\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0627\u062f\u0629 \u062b\u0645 \u0627\u0636\u063a\u0637 "\u062c\u0644\u0628"</p></div>',

      footer:
        '<button class="btn btn-primary" data-save>\uD83D\uDCBE ' + (isEdit ? "\u062d\u0641\u0638" : "\u0625\u0646\u0634\u0627\u0621") + '</button>' +
        '<button class="btn btn-ghost" data-close>\u0625\u0644\u063a\u0627\u0621</button>',

      onMount: function (node, close) {
        const listBox = node.querySelector("#qList");
        const fetchInfo = node.querySelector("#fetchInfo");

        /* ====== المجموعات المستهدفة ====== */
        const renderGroupsBox = function () {
          const groups = state.groups;
          const target = (exam && exam.targetGroups) || [];
          const box = node.querySelector("#groupsBox");
          if (!groups.length) {
            box.innerHTML = '<p class="muted">\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u062c\u0645\u0648\u0639\u0627\u062a \u2014 \u0623\u0646\u0634\u0626 \u0645\u0646 \u0642\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a</p>';
            return;
          }
          let html = '<label class="check mb"><input type="checkbox" id="gAll"' +
            (target.indexOf("ALL") >= 0 ? " checked" : "") + '> <b>\u062c\u0645\u064a\u0639 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a</b></label>';
          html += '<div class="flex flex-wrap">';
          groups.forEach(function (g) {
            const checked = target.indexOf(g.id) >= 0;
            html += '<label class="check" style="padding:6px 10px;background:var(--surface-2);border-radius:8px;margin:3px">' +
              '<input type="checkbox" class="grp-check" value="' + g.id + '"' + (checked ? " checked" : "") + '> ' +
              U.esc(g.name) + ' <span class="tiny muted">(' + (g.studentCount || 0) + ')</span></label>';
          });
          html += '</div>';
          box.innerHTML = html;

          const allCb = box.querySelector("#gAll");
          allCb.addEventListener("change", function () {
            box.querySelectorAll(".grp-check").forEach(function (cb) {
              cb.checked = allCb.checked;
              cb.disabled = allCb.checked;
            });
          });
          if (allCb.checked) {
            box.querySelectorAll(".grp-check").forEach(function (cb) {
              cb.checked = true; cb.disabled = true;
            });
          }
        };
        renderGroupsBox();

        /* ====== جلب الأسئلة حسب الفلاتر ====== */
        const updateChosenCount = function () {
          const pts = chosen.reduce(function (s, q) { return s + (Number(q.points) || 1); }, 0);
          node.querySelector("#chosenCount").textContent = chosen.length + " \u0633\u0624\u0627\u0644";
          node.querySelector("#chosenPoints").textContent = pts + " \u062f\u0631\u062c\u0629";
        };

        const renderQuestionList = function (questions) {
          if (!questions.length) {
            listBox.innerHTML = '<p class="muted center" style="padding:20px">\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u0633\u0626\u0644\u0629 \u0645\u0637\u0627\u0628\u0642\u0629</p>';
            return;
          }
          listBox.innerHTML = questions.map(function (q) {
            const isSelected = selectedIds[q.id];
            return '<label class="auto-exam-item">' +
              '<input type="checkbox" data-qid="' + q.id + '"' + (isSelected ? " checked" : "") + '>' +
              '<div class="content">' +
              '<div class="flex flex-wrap" style="gap:6px;margin-bottom:4px">' +
              U.badgeForType(q.type) +
              (q.unitNumber !== null && q.unitNumber !== undefined ? ' <span class="badge badge-muted">W' + q.unitNumber + '</span>' : '') +
              (q.lessonTitle ? ' <span class="badge badge-muted">' + U.esc(q.lessonTitle) + '</span>' : '') +
              '<span class="badge badge-primary">' + (q.points || 1) + ' \u062f\u0631\u062c\u0629</span>' +
              '</div>' +
              '<div class="text">' + U.esc(q.text) + '</div>' +
              '</div>' +
              '</label>';
          }).join("");

          listBox.querySelectorAll("[data-qid]").forEach(function (cb) {
            cb.addEventListener("change", function () {
              const q = questions.find(function (x) { return x.id === cb.dataset.qid; });
              if (cb.checked) {
                selectedIds[q.id] = true;
                chosen.push({
                  type: q.type, text: q.text, options: q.options || [],
                  answer: q.answer, difficulty: q.difficulty,
                  explanation: q.explanation || "", points: q.points || 1,
                  _sourceId: q.id, unitNumber: q.unitNumber, unitTitle: q.unitTitle, lessonTitle: q.lessonTitle
                });
              } else {
                delete selectedIds[q.id];
                const idx = chosen.findIndex(function (c) { return c._sourceId === q.id; });
                if (idx >= 0) chosen.splice(idx, 1);
              }
              updateChosenCount();
            });
          });
        };

        /* ====== تحديث فلاتر الوحدة/الدرس عند تغيير المادة ====== */
        const refreshFilterOptions = async function () {
          const subjectId = node.querySelector("#exSubj").value;
          const unitSel = node.querySelector("#exUnit");
          const lessonSel = node.querySelector("#exLesson");
          unitSel.innerHTML = '<option value="">\u0627\u0644\u0643\u0644</option>';
          lessonSel.innerHTML = '<option value="">\u0627\u0644\u0643\u0644</option>';
          if (!subjectId) return;
          const qs = await S.listQuestions(subjectId);
          const unitsMap = {};
          const lessonsMap = {};
          qs.forEach(function (q) {
            if (q.unitNumber !== null && q.unitNumber !== undefined) {
              unitsMap["u:" + q.unitNumber] = "\u0627\u0644\u0648\u062d\u062f\u0629 " + q.unitNumber;
            }
            if (q.unitTitle) unitsMap["ut:" + q.unitTitle] = q.unitTitle;
            if (q.lessonTitle) lessonsMap[q.lessonTitle] = q.lessonTitle;
          });
          Object.keys(unitsMap).forEach(function (k) {
            const opt = document.createElement("option");
            opt.value = k; opt.textContent = unitsMap[k];
            unitSel.appendChild(opt);
          });
          Object.keys(lessonsMap).sort().forEach(function (l) {
            const opt = document.createElement("option");
            opt.value = l; opt.textContent = l;
            lessonSel.appendChild(opt);
          });
        };

        node.querySelector("#exSubj").addEventListener("change", refreshFilterOptions);

        /* ====== زر جلب الأسئلة ====== */
        node.querySelector("#fetchBtn").addEventListener("click", async function () {
          const subjectId = node.querySelector("#exSubj").value;
          if (!subjectId) return U.toast("\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0627\u062f\u0629 \u0623\u0648\u0644\u0627\u064b", "warn");
          listBox.innerHTML = U.loaderHTML();
          fetchInfo.textContent = "\u062c\u0627\u0631\u064d \u0627\u0644\u062c\u0644\u0628...";
          try {
            const unitSel = node.querySelector("#exUnit").value;
            const lessonSel = node.querySelector("#exLesson").value;
            const diffSel = node.querySelector("#exDiff").value;
            const maxSel = Number(node.querySelector("#exMax").value) || 0;

            let criteria = { subjectId: subjectId };
            if (unitSel) {
              const parts = unitSel.split(":");
              if (parts[0] === "u") criteria.unitNumber = Number(parts.slice(1).join(":"));
              else criteria.unitTitle = parts.slice(1).join(":");
            }
            if (lessonSel) criteria.lessonTitle = lessonSel;
            if (diffSel) criteria.difficulty = diffSel;

            let questions = await S.filterQuestions(criteria);

            // اختيار عشوائي إذا حُدد العدد
            if (maxSel && questions.length > maxSel) {
              questions = questions.sort(function () { return Math.random() - 0.5; }).slice(0, maxSel);
            }
            questions.sort(function (a, b) {
              const ua = (a.unitNumber !== null && a.unitNumber !== undefined) ? a.unitNumber : 9999;
              const ub = (b.unitNumber !== null && b.unitNumber !== undefined) ? b.unitNumber : 9999;
              if (ua !== ub) return ua - ub;
              return (a.lessonTitle || "").localeCompare(b.lessonTitle || "");
            });

            fetchInfo.textContent = "\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 " + questions.length + " \u0633\u0624\u0627\u0644 \u2014 \u062d\u062f\u0651\u062f \u0645\u0627 \u062a\u0631\u064a\u062f \u0627\u0633\u062a\u062e\u062f\u0627\u0645\u0647";
            renderQuestionList(questions);
            updateChosenCount();
          } catch (e) {
            fetchInfo.textContent = "\u062e\u0637\u0623: " + e.message;
          }
        });

        node.querySelector("#selectAllBtn").addEventListener("click", function () {
          listBox.querySelectorAll("[data-qid]").forEach(function (cb) {
            if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event("change")); }
          });
        });
        node.querySelector("#clearBtn").addEventListener("click", function () {
          chosen.length = 0;
          Object.keys(selectedIds).forEach(function (k) { delete selectedIds[k]; });
          listBox.querySelectorAll("[data-qid]").forEach(function (cb) { cb.checked = false; });
          updateChosenCount();
        });

        /* ====== حفظ الاختبار ====== */
        node.querySelector("[data-save]").addEventListener("click", async function () {
          const title = node.querySelector("#exTitle").value.trim();
          if (!title) return U.toast("\u0623\u062f\u062e\u0644 \u0627\u0644\u0639\u0646\u0648\u0627\u0646", "warn");
          const subjectId = node.querySelector("#exSubj").value;
          if (!subjectId) return U.toast("\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0627\u062f\u0629", "warn");
          if (!chosen.length) return U.toast("\u0627\u062e\u062a\u0631 \u0633\u0624\u0627\u0644\u0627\u064b \u0648\u0627\u062d\u062f\u0627\u064b \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644", "warn");

          // المجموعات المستهدفة
          const targetGroups = [];
          const allCb = node.querySelector("#gAll");
          if (allCb && allCb.checked) {
            targetGroups.push("ALL");
          } else {
            node.querySelectorAll(".grp-check:checked").forEach(function (cb) {
              targetGroups.push(cb.value);
            });
          }
          if (!targetGroups.length) return U.toast("\u0627\u062e\u062a\u0631 \u0645\u062c\u0645\u0648\u0639\u0629 \u0648\u0627\u062d\u062f\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644", "warn");

          const openAt = node.querySelector("#exOpenAt").value;
          const closeAt = node.querySelector("#exCloseAt").value;

          const data = {
            title: title,
            subjectId: subjectId,
            subjectName: (state.subjects.find(function (s) { return s.id === subjectId; }) || {}).name || "",
            description: node.querySelector("#exDesc").value.trim(),
            durationMin: Number(node.querySelector("#exDur").value) || 0,
            settings: {
              shuffleQuestions: node.querySelector("#shuffleQuestions").checked,
              shuffleOptions: false,
              showResults: false,
              allowReview: node.querySelector("#allowReview").checked,
              negative: false,
              requireName: true,
              passScore: Number(node.querySelector("#exPass").value) || 50,
              maxAttempts: 1
            },
            questions: chosen,
            targetGroups: targetGroups,
            autoGenerated: true,
            filterCriteria: {
              subjectId: subjectId,
              unit: node.querySelector("#exUnit").value,
              lesson: node.querySelector("#exLesson").value,
              difficulty: node.querySelector("#exDiff").value
            },
            openAt: openAt ? new Date(openAt).toISOString() : null,
            closeAt: closeAt ? new Date(closeAt).toISOString() : null,
            status: "published"
          };

          try {
            if (isEdit) {
              await S.updateExam(exam.id, data);
              U.toast("\u062a\u0645 \u0627\u0644\u062a\u062d\u062f\u064a\u062b", "success");
            } else {
              const r = await S.createExam(data);
              U.copy(r.code);
              U.toast("\u062a\u0645 \u0627\u0644\u0625\u0646\u0634\u0627\u0621 \u2014 \u0627\u0644\u0643\u0648\u062f: " + r.code, "success", 6000);
            }
            close();
            renderExams();
          } catch (e) {
            U.toast("Error: " + e.message, "error");
          }
        });

        // إذا كان تعديل، جهّز فلاتر المادة
        if (isEdit && exam.subjectId) {
          refreshFilterOptions().then(function () {
            // ضع القيم القديمة
            const fc = exam.filterCriteria || {};
            if (fc.unit) {
              const unitSel = node.querySelector("#exUnit");
              if (unitSel.querySelector('option[value="' + fc.unit + '"]')) unitSel.value = fc.unit;
            }
            if (fc.lesson) {
              const lessonSel = node.querySelector("#exLesson");
              if (lessonSel.querySelector('option[value="' + fc.lesson + '"]')) lessonSel.value = fc.lesson;
            }
            if (fc.difficulty) node.querySelector("#exDiff").value = fc.difficulty;
          });
        }

        updateChosenCount();
      }
    });
  }

  /* ============================================================
   * TEACHERS
   * ============================================================ */
  async function renderTeachers() {
    shell("teachers", U.loaderHTML());
    try {
      const arr = await Promise.all([S.listTeachers(), S.listSubjects(), S.listGroups()]);
      const teachers = arr[0], subjects = arr[1], groups = arr[2];
      state.teachers = teachers;
      state.subjects = subjects;
      state.groups = groups;

      const subjectName = function (id) {
        const s = subjects.find(function (x) { return x.id === id; });
        return s ? s.name : "?";
      };

      const groupsOfTeacher = function (teacherId) {
        return groups.filter(function (g) {
          return (g.teacherAssignments || []).some(function (a) { return a.teacherId === teacherId; });
        });
      };

      const rows = teachers.length
        ? teachers.map(function (t) {
          const subjectsBadges = (t.subjectIds || []).map(function (id) {
            return '<span class="badge badge-primary">' + U.esc(subjectName(id)) + "</span>";
          }).join(" ") || "-";
          const grp = groupsOfTeacher(t.id);
          const grpBadges = grp.length
            ? grp.map(function (g) { return '<span class="badge badge-muted">' + U.esc(g.name) + "</span>"; }).join(" ")
            : '<span class="muted tiny">-</span>';
          return "<tr>" +
            '<td data-label="N"><b>' + U.esc(t.name) + "</b></td>" +
            '<td data-label="U" class="muted">' + U.esc(t.username) + "</td>" +
            '<td data-label="S">' + subjectsBadges + "</td>" +
            '<td data-label="G">' + grpBadges + "</td>" +
            '<td data-label="A">' + (t.active !== false ? '<span class="badge badge-success">\u0646\u0634\u0637</span>' : '<span class="badge badge-danger">\u0645\u0639\u0637\u0644</span>') + "</td>" +
            '<td data-label="Ac">' +
            '<button class="btn btn-sm" data-edit="' + t.id + '">\u270E</button> ' +
            '<button class="btn btn-sm btn-danger" data-del="' + t.id + '">\uD83D\uDDD1</button></td></tr>';
        }).join("")
        : '<tr><td colspan="6" class="table-empty">-</td></tr>';

      shell("teachers",
        '<div class="card-head"><h2>\u0627\u0644\u0645\u0639\u0644\u0645\u0648\u0646</h2><div class="spacer"></div>' +
        '<button class="btn btn-primary" id="addTeacher">+ \u0645\u0639\u0644\u0645</button></div>' +
        '<div class="info-banner info">' +
        '<span class="emoji">\u2139\uFE0F</span>' +
        '<div><b>\u0627\u0644\u0645\u0639\u0644\u0645 \u064a\u0631\u0649 \u0641\u0642\u0637:</b> ' +
        '\u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a \u0627\u0644\u0645\u0639\u064a\u0651\u0646 \u0641\u064a\u0647\u0627 + \u0645\u0627\u062f\u062a\u0647 \u0641\u0642\u0637</div>' +
        '</div>' +
        '<div class="table-wrap responsive mt"><table><thead><tr>' +
        '<th>\u0627\u0644\u0627\u0633\u0645</th><th>\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645</th><th>\u0627\u0644\u0645\u0648\u0627\u062f</th><th>\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a</th><th>\u0627\u0644\u062d\u0627\u0644\u0629</th><th></th>' +
        "</tr></thead><tbody>" + rows + "</tbody></table></div>"
      );

      document.getElementById("addTeacher").addEventListener("click", function () { teacherModal(null); });
      document.querySelectorAll("[data-edit]").forEach(function (b) {
        b.addEventListener("click", function () {
          teacherModal(teachers.find(function (t) { return t.id === b.dataset.edit; }));
        });
      });
      document.querySelectorAll("[data-del]").forEach(function (b) {
        b.addEventListener("click", async function () {
          if (await U.confirm("\u062d\u0630\u0641 \u0627\u0644\u0645\u0639\u0644\u0645 \u0648\u0625\u0632\u0627\u0644\u062a\u0647 \u0645\u0646 \u0643\u0644 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a\u061f")) {
            await S.deleteTeacher(b.dataset.del);
            U.toast("\u062a\u0645 \u0627\u0644\u062d\u0630\u0641", "success");
            renderTeachers();
          }
        });
      });
    } catch (e) {
      shell("teachers", errorCard(e));
    }
  }

  function teacherModal(t) {
    const isEdit = !!t;
    const current = t || { name: "", username: "", subjectIds: [], active: true };
    const subjectChecks = state.subjects.map(function (s) {
      return '<label class="check"><input type="checkbox" class="subj-check" value="' + s.id + '"' +
        (current.subjectIds.indexOf(s.id) >= 0 ? " checked" : "") + "> " + U.esc(s.name) + "</label>";
    }).join("") || '<p class="muted">\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0648\u0627\u062f</p>';

    U.modal({
      title: isEdit ? "\u062a\u0639\u062f\u064a\u0644 \u0645\u0639\u0644\u0645" : "\u0645\u0639\u0644\u0645 \u062c\u062f\u064a\u062f",
      body:
        '<div class="field"><label>\u0627\u0644\u0627\u0633\u0645 *</label>' +
        '<input id="tName" value="' + U.esc(current.name) + '"></div>' +
        '<div class="form-row">' +
        '<div class="field"><label>\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 *</label>' +
        '<input id="tUser" value="' + U.esc(current.username) + '"' + (isEdit ? " disabled" : "") + "></div>" +
        '<div class="field"><label>' + (isEdit ? "\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u062c\u062f\u064a\u062f\u0629" : "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 *") + '</label>' +
        '<input type="password" id="tPass"></div></div>' +
        '<div class="field"><label>\u0627\u0644\u0645\u0648\u0627\u062f \u0627\u0644\u062a\u064a \u064a\u0635\u062d\u0651\u062d\u0647\u0627</label>' +
        '<div style="max-height:220px;overflow:auto;border:1px solid var(--border);border-radius:10px;padding:10px">' +
        subjectChecks + "</div></div>" +
        '<label class="check mt"><input type="checkbox" id="tActive"' +
        (current.active !== false ? " checked" : "") + '> \u0646\u0634\u0637</label>',
      footer: '<button class="btn btn-primary" data-save>\u062d\u0641\u0638</button>' +
        '<button class="btn btn-ghost" data-close>\u0625\u0644\u063a\u0627\u0621</button>',
      onMount: function (node, close) {
        node.querySelector("[data-save]").addEventListener("click", async function () {
          const name = node.querySelector("#tName").value.trim();
          const username = node.querySelector("#tUser").value.trim().toLowerCase();
          const password = node.querySelector("#tPass").value.trim();
          const active = node.querySelector("#tActive").checked;
          const subjectIds = Array.from(node.querySelectorAll(".subj-check:checked")).map(function (c) { return c.value; });

          if (!name) return U.toast("\u0623\u062f\u062e\u0644 \u0627\u0644\u0627\u0633\u0645", "warn");
          if (!isEdit && !username) return U.toast("\u0623\u062f\u062e\u0644 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645", "warn");
          if (!isEdit && !password) return U.toast("\u0623\u062f\u062e\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", "warn");

          try {
            if (isEdit) {
              const patch = { name: name, subjectIds: subjectIds, active: active };
              if (password) patch.password = password;
              await S.updateTeacher(t.id, patch);
            } else {
              const ex = await S.getTeacherByUsername(username);
              if (ex) return U.toast("\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0645\u0648\u062c\u0648\u062f", "error");
              await S.addTeacher({ name: name, username: username, password: password, subjectIds: subjectIds, active: active });
            }
            close();
            U.toast("\u062a\u0645 \u0627\u0644\u062d\u0641\u0638", "success");
            renderTeachers();
          } catch (e) {
            U.toast("Error: " + e.message, "error");
          }
        });
      }
    });
  }

  /* ============================================================
   * STUDENTS (عرض الطلاب + إدارتهم)
   * ============================================================ */
  async function renderStudents() {
    shell("students", U.loaderHTML());
    try {
      const arr = await Promise.all([
        QP.db.collection("students").get(),
        S.listGroups()
      ]);
      const students = arr[0].docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      const groups = arr[1];
      state.groups = groups;

      const groupName = function (id) {
        const g = groups.find(function (x) { return x.id === id; });
        return g ? g.name : "-";
      };

      const rows = students.length
        ? students.map(function (s) {
          return "<tr>" +
            '<td data-label="N"><b>' + U.esc(s.name) + "</b></td>" +
            '<td data-label="U" class="muted tiny">' + U.esc(s.username) + "</td>" +
            '<td data-label="G">' + U.esc(groupName(s.groupId)) + "</td>" +
            '<td data-label="L" class="tiny">' + U.formatDate(s.lastLoginAt) + "</td>" +
            '<td data-label=""><button class="btn btn-sm btn-danger" data-del-student="' + s.id + '">\uD83D\uDDD1</button></td></tr>';
        }).join("")
        : '<tr><td colspan="5" class="table-empty">\u0644\u0627 \u064a\u0648\u062c\u062f \u0637\u0644\u0627\u0628 \u0645\u0633\u062c\u0644\u0648\u0646</td></tr>';

      shell("students",
        '<div class="card-head"><h2>\u0627\u0644\u0637\u0644\u0627\u0628</h2>' +
        '<span class="badge badge-primary">' + students.length + '</span></div>' +
        '<div class="info-banner info"><span class="emoji">\u2139\uFE0F</span>' +
        '<div>\u0627\u0644\u0637\u0644\u0627\u0628 \u064a\u064f\u0646\u0634\u0626\u0648\u0646 \u062d\u0633\u0627\u0628\u0627\u062a\u0647\u0645 \u0628\u0623\u0646\u0641\u0633\u0647\u0645 \u0645\u0646 \u0635\u0641\u062d\u0629 \u0627\u0644\u0637\u0627\u0644\u0628. \u0647\u0646\u0627 \u062a\u0631\u0627\u062c\u0639\u0647\u0645 \u0641\u0642\u0637.</div></div>' +
        '<div class="table-wrap responsive mt"><table><thead><tr>' +
        '<th>\u0627\u0644\u0627\u0633\u0645</th><th>\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645</th><th>\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629</th><th>\u0622\u062e\u0631 \u062f\u062e\u0648\u0644</th><th></th>' +
        "</tr></thead><tbody>" + rows + "</tbody></table></div>"
      );

      document.querySelectorAll("[data-del-student]").forEach(function (b) {
        b.addEventListener("click", async function () {
          if (await U.confirm("\u062d\u0630\u0641 \u0627\u0644\u0637\u0627\u0644\u0628\u061f")) {
            await S.deleteStudent(b.dataset.delStudent);
            U.toast("\u062a\u0645 \u0627\u0644\u062d\u0630\u0641", "success");
            renderStudents();
          }
        });
      });
    } catch (e) {
      shell("students", errorCard(e));
    }
  }

  /* ============================================================
   * RESULTS
   * ============================================================ */
  async function renderResults() {
    shell("results", U.loaderHTML());
    try {
      const exams = await S.listExams();
      state.exams = exams;
      const opts = exams.map(function (e) {
        return '<option value="' + e.id + '">' + U.esc(e.title) + " (" + U.esc(e.code) + ")</option>";
      }).join("");

      shell("results",
        '<div class="card-head"><h2>\u0627\u0644\u0646\u062a\u0627\u0626\u062c</h2><div class="spacer"></div>' +
        '<select id="resExam" style="max-width:320px"><option value="">- \u0627\u062e\u062a\u0631 -</option>' + opts + "</select></div>" +
        '<div id="resBody"><div class="empty-state"><div class="emoji">\uD83D\uDCC8</div>' +
        "<h3>\u0627\u062e\u062a\u0631 \u0627\u062e\u062a\u0628\u0627\u0631\u0627\u064b</h3></div></div>"
      );

      document.getElementById("resExam").addEventListener("change", function (e) { openExamResults(e.target.value); });
      if (state.pendingResultExam) {
        const id = state.pendingResultExam;
        state.pendingResultExam = null;
        await openExamResults(id);
      }
    } catch (e) {
      shell("results", errorCard(e));
    }
  }

  async function openExamResults(examId) {
    const sel = document.getElementById("resExam");
    if (sel && examId) sel.value = examId;
    const body = document.getElementById("resBody");
    if (!examId) {
      body.innerHTML = '<div class="empty-state"><div class="emoji">\uD83D\uDCC8</div><h3>\u0627\u062e\u062a\u0631 \u0627\u062e\u062a\u0628\u0627\u0631\u0627\u064b</h3></div>';
      return;
    }
    body.innerHTML = U.loaderHTML();
    try {
      const subs = await S.listSubmissionsByExam(examId);
      const exam = state.exams.find(function (e) { return e.id === examId; });
      if (!subs.length) {
        body.innerHTML = '<div class="empty-state"><div class="emoji">\uD83D\uDDC2</div><h3>\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0634\u0627\u0631\u0643\u0627\u062a</h3></div>';
        return;
      }

      const graded = subs.filter(function (s) { return s.status === "graded" && s.percent !== null; });
      const pending = subs.filter(function (s) { return s.status === "pending" || s.status === "in_review"; });
      const scores = graded.map(function (s) { return s.percent || 0; });
      const avg = scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) : 0;

      const rows = subs.map(function (s, i) {
        const scoreTxt = (s.score !== null && s.score !== undefined) ? s.score + " / " + s.total : "-";
        const pctTxt = (s.percent !== null && s.percent !== undefined) ? s.percent + "%" : "-";
        const pctColor = (s.percent !== null && s.percent !== undefined) ? U.pctColor(s.percent) : "var(--text-3)";
        return "<tr>" +
          '<td data-label="#">' + (i + 1) + "</td>" +
          '<td data-label="N"><b>' + U.esc(s.studentName || "-") + "</b></td>" +
          '<td data-label="G" class="tiny">' + U.esc(s.groupName || "-") + "</td>" +
          '<td data-label="Sc">' + scoreTxt + "</td>" +
          '<td data-label="P" style="color:' + pctColor + '"><b>' + pctTxt + "</b></td>" +
          '<td data-label="St">' + U.submissionStatusBadge(s.status) + "</td>" +
          '<td data-label="D" class="tiny">' + U.formatDate(s.createdAt) + "</td>" +
          '</tr>';
      }).join("");

      body.innerHTML =
        '<div class="stat-grid mb">' +
        stat("\uD83D\uDC65", subs.length, "\u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0648\u0646") +
        stat("\u23F3", pending.length, "\u0642\u064a\u062f \u0627\u0644\u062a\u0635\u062d\u064a\u062d") +
        stat("\u2705", graded.length, "\u0645\u064f\u0635\u062d\u0651\u062d") +
        stat("\uD83D\uDCCA", avg + "%", "\u0627\u0644\u0645\u062a\u0648\u0633\u0637") +
        "</div>" +
        '<div class="table-wrap responsive"><table><thead><tr>' +
        '<th>#</th><th>\u0627\u0644\u0637\u0627\u0644\u0628</th><th>\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629</th><th>\u0627\u0644\u062f\u0631\u062c\u0629</th><th>\u0627\u0644\u0646\u0633\u0628\u0629</th><th>\u0627\u0644\u062d\u0627\u0644\u0629</th><th>\u0627\u0644\u062a\u0627\u0631\u064a\u062e</th>' +
        "</tr></thead><tbody>" + rows + "</tbody></table></div>";
    } catch (e) {
      body.innerHTML = errorCard(e);
    }
  }

  /* ============================================================
   * ANALYTICS + AUDIT + SETTINGS (مختصرة من v3)
   * ============================================================ */
  async function renderAnalytics() {
    shell("analytics", U.loaderHTML());
    shell("analytics", '<div class="card"><div class="empty-state"><div class="emoji">\uD83E\uDDEE</div><h3>\u0642\u0631\u064a\u0628\u0627\u064b</h3></div></div>');
  }
  async function renderAuditLog() {
    shell("audit", U.loaderHTML());
    try {
      const logs = await S.listAuditLog(200);
      shell("audit",
        '<div class="card-head"><h2>\u0627\u0644\u0633\u062c\u0644</h2></div>' +
        '<div class="audit-log">' +
        (logs.length ? logs.map(function (l) {
          return '<div class="audit-row">' +
            '<span class="audit-time">' + U.formatDate(l.at) + "</span> - " +
            '<span class="audit-action">' + U.esc(l.action) + "</span> " +
            '<span class="muted">' + U.esc(l.details || "") + "</span></div>";
        }).join("") : '<div class="muted center" style="padding:30px">\u0644\u0627 \u064a\u0648\u062c\u062f</div>') +
        "</div>"
      );
    } catch (e) { shell("audit", errorCard(e)); }
  }
  async function renderSettings() {
    shell("settings", U.loaderHTML());
    shell("settings",
      '<div class="card"><div class="card-head"><h3>\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0627\u0644\u0645\u062f\u064a\u0631</h3></div>' +
      '<div class="form-row">' +
      '<div class="field"><label>\u0627\u0644\u062c\u062f\u064a\u062f</label><input type="password" id="newPass"></div>' +
      '<div class="field"><label>\u062a\u0623\u0643\u064a\u062f</label><input type="password" id="newPass2"></div></div>' +
      '<button class="btn btn-primary" id="savePass">\u062d\u0641\u0638</button></div>'
    );
    document.getElementById("savePass").addEventListener("click", async function () {
      const a = document.getElementById("newPass").value.trim();
      const b = document.getElementById("newPass2").value.trim();
      if (!a) return U.toast("\u0623\u062f\u062e\u0644 \u0627\u0644\u0631\u0645\u0632", "warn");
      if (a !== b) return U.toast("\u063a\u064a\u0631 \u0645\u062a\u0637\u0627\u0628\u0642\u064a\u0646", "error");
      if (a.length < 4) return U.toast("\u0642\u0635\u064a\u0631", "warn");
      await S.setAdminPass(a);
      state.adminPass = a;
      U.toast("OK", "success");
    });
  }

  /* ============================================================
   * ROUTER
   * ============================================================ */
  const renders = {
    dashboard: renderDashboard,
    groups: renderGroups,
    subjects: renderSubjects,
    questions: renderQuestions,
    exams: renderExams,
    teachers: renderTeachers,
    students: renderStudents,
    results: renderResults,
    analytics: renderAnalytics,
    audit: renderAuditLog,
    settings: renderSettings
  };

  QP.admin = {
    render: async function (sub) {
      if (!isLogged()) { renderLogin(); return; }
      const fn = renders[sub] || renderDashboard;
      try { await fn(); }
      catch (e) {
        console.error("[admin]", e);
        shell(sub || "dashboard", errorCard(e));
      }
    }
  };

  console.log("[admin.js v4] QP.admin loaded");
})();