/* ============================================================
 * admin.js v6.0 - لوحة الإدارة الكاملة
 * مع الفلاتر المنسدلة + التوزيع الذكي + إدارة المجموعات
 * ============================================================ */
(function () {
  "use strict";

  const QP = window.QP;
  const U = QP.utils;
  const S = QP.store;
  const G = QP.groups;

  /* ============================================================
   * كشف الأسئلة المكررة (نص مطهّر موحّد)
   * ============================================================ */
  const dupCache = {};

  function qNorm(s) {
    return U.normalizeArabic(s);
  }

  async function loadDupMap(subjectId) {
    const key = "s:" + subjectId;
    if (dupCache[key]) return dupCache[key];
    const map = {};
    const qs = await S.listQuestions(subjectId);
    qs.forEach(function (q) {
      const k = qNorm(q.text);
      map[k] = (map[k] || 0) + 1;
    });
    dupCache[key] = map;
    return map;
  }

  /* ============================================================
   * الحالة العامة
   * ============================================================ */
  const state = {
    subs: [],
    subjects: [],
    questions: [],
    exams: [],
    teachers: [],
    groups: [],
    adminPass: null,
    pendingResultExam: null
  };

  function view(html) {
    document.getElementById("view").innerHTML = html;
  }

  function isLogged() {
    return sessionStorage.getItem("qp_admin") === "1";
  }

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
      btn.disabled = true;
      btn.textContent = "...";
      try {
        const res = await S.getAdminPass();
        state.adminPass = res.pass;
        if (res.created) {
          U.toast("\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0631\u0645\u0632: admin123", "warn", 5000);
        }
        if (val === res.pass) {
          sessionStorage.setItem("qp_admin", "1");
          U.toast("\u0645\u0631\u062d\u0628\u0627", "success");
          const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
          QP.admin.render(parts[0] || "dashboard");
        } else {
          U.toast("\u0631\u0645\u0632 \u062e\u0627\u0637\u0626", "error");
          btn.disabled = false;
          btn.textContent = "\u062f\u062e\u0648\u0644";
        }
      } catch (e) {
        U.toast("Error: " + e.message, "error", 5000);
        btn.disabled = false;
        btn.textContent = "\u062f\u062e\u0648\u0644";
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
   * SHELL - Side Navigation
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

  /* ============================================================
   * أدوات مساعدة
   * ============================================================ */
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

  function diffLabel(d) {
    return d === "easy" ? "\u0633\u0647\u0644" :
      d === "hard" ? "\u0635\u0639\u0628" : "\u0645\u062a\u0648\u0633\u0637";
  }

  function statusBadge(s) {
    if (s === "published") return '<span class="badge badge-success">\u0645\u0646\u0634\u0648\u0631</span>';
    if (s === "closed") return '<span class="badge badge-danger">\u0645\u063a\u0644\u0642</span>';
    return '<span class="badge badge-warning">\u0645\u0633\u0648\u062f\u0629</span>';
  }

  /* ============================================================
   * DASHBOARD
   * ============================================================ */
  async function renderDashboard() {
    shell("dashboard", U.loaderHTML());
    try {
      const arr = await Promise.all([
        S.listSubjects(),
        S.listQuestions(),
        S.listExams(),
        S.listTeachers(),
        S.countSubmissions(),
        S.countPendingSubmissions(),
        S.listRecentSubmissions(8),
        S.listGroups()
      ]);

      const subjects = arr[0];
      const questions = arr[1];
      const exams = arr[2];
      const teachers = arr[3];
      const subs = arr[4];
      const pending = arr[5];
      const recent = arr[6];
      const groups = arr[7];

      state.subjects = subjects;
      state.questions = questions;
      state.exams = exams;
      state.teachers = teachers;
      state.groups = groups;

      const totalStudents = groups.reduce(function (s, g) {
        return s + (g.studentCount || 0);
      }, 0);

      const recentRows = recent.length
        ? recent.map(function (r) {
          return "<tr>" +
            '<td data-label="\u0627\u0644\u0637\u0627\u0644\u0628">' + U.esc(r.studentName || "-") + "</td>" +
            '<td data-label="\u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631">' + U.esc(r.examTitle || "-") + "</td>" +
            '<td data-label="\u0627\u0644\u062d\u0627\u0644\u0629">' + U.submissionStatusBadge(r.status) + "</td>" +
            '<td data-label="\u0627\u0644\u0646\u0633\u0628\u0629">' + (r.percent != null ? r.percent + "%" : "-") + "</td>" +
            '<td data-label="\u0627\u0644\u062a\u0627\u0631\u064a\u062e" class="tiny">' + U.formatDate(r.createdAt) + "</td>" +
            "</tr>";
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
        stat("\uD83D\uDC68\u200D\uD83C\uDFEB", teachers.length, "\u0627\u0644\u0645\u0639\u0644\u0645\u0648\u0646") +
        "</div>" +

        '<div class="stat-grid mt">' +
        stat("\uD83D\uDCE5", subs, "\u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0627\u062a") +
        stat("\u23F3", pending, "\u0642\u064a\u062f \u0627\u0644\u062a\u0635\u062d\u064a\u062d") +
        "</div>" +

        '<div class="card mt"><div class="card-head"><h3>\u0623\u062d\u062f\u062b \u0627\u0644\u0646\u062a\u0627\u0626\u062c</h3>' +
        '<div class="spacer"></div>' +
        '<a class="btn btn-sm" href="#/results">\u0639\u0631\u0636 \u0627\u0644\u0643\u0644</a></div>' +
        '<div class="table-wrap responsive"><table><thead><tr>' +
        '<th>\u0627\u0644\u0637\u0627\u0644\u0628</th><th>\u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631</th><th>\u0627\u0644\u062d\u0627\u0644\u0629</th><th>\u0627\u0644\u0646\u0633\u0628\u0629</th><th>\u0627\u0644\u062a\u0627\u0631\u064a\u062e</th>' +
        "</tr></thead><tbody>" + recentRows + "</tbody></table></div></div>"
      );

      const qe = document.getElementById("quickExam");
      if (qe) qe.addEventListener("click", function () {
        location.hash = "#/exams";
      });
    } catch (e) {
      shell("dashboard", errorCard(e));
    }
  }

  /* ============================================================
   * GROUPS
   * ============================================================ */
  async function renderGroups() {
    shell("groups", U.loaderHTML());
    try {
      const arr = await Promise.all([
        S.listGroups(),
        S.listTeachers(),
        S.listSubjects()
      ]);
      const groups = arr[0];
      const teachers = arr[1];
      const subjects = arr[2];

      state.groups = groups;
      state.teachers = teachers;
      state.subjects = subjects;

      const cards = groups.length
        ? '<div class="groups-grid">' + groups.map(function (g) {
          const assignments = g.teacherAssignments || [];
          const chips = assignments.length
            ? assignments.map(function (a) {
              const subj = subjects.find(function (s) { return s.id === a.subjectId; });
              return '<span class="assignment-chip">' +
                '\uD83D\uDC68\u200D\uD83C\uDFEB ' +
                U.esc(a.teacherName || "?") + ' - ' +
                U.esc(subj ? subj.name : "?") +
                '<button class="chip-close" data-remove-assign="' +
                U.esc(g.id) + '|' + U.esc(a.teacherId) + '|' + U.esc(a.subjectId) +
                '">\u2715</button></span>';
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
            (g.active !== false ? "\u0646\u0634\u0637\u0629" : "\u0645\u0639\u0637\u0651\u0644\u0629") +
            '</span>' +
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

      document.getElementById("addGroup").addEventListener("click", function () {
        groupModal(null);
      });

      document.querySelectorAll("[data-edit-group]").forEach(function (b) {
        b.addEventListener("click", function () {
          groupModal(groups.find(function (g) { return g.id === b.dataset.editGroup; }));
        });
      });

      document.querySelectorAll("[data-manage]").forEach(function (b) {
        b.addEventListener("click", function () {
          manageTeachersModal(b.dataset.manage);
        });
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
        (isEdit
          ? '<label class="check"><input type="checkbox" id="gActive"' +
            (g.active !== false ? " checked" : "") +
            '> \u0645\u062c\u0645\u0648\u0639\u0629 \u0646\u0634\u0637\u0629</label>'
          : ""),
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
            '<button class="chip-close" data-remove="' + U.esc(a.teacherId) + '|' + U.esc(a.subjectId) + '">\u2715</button>' +
            '</div>';
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
      qs.forEach(function (q) {
        qCounts[q.subjectId] = (qCounts[q.subjectId] || 0) + 1;
      });

      const rows = subjects.length
        ? subjects.map(function (s) {
          return "<tr>" +
            '<td data-label="\u0627\u0644\u0645\u0627\u062f\u0629"><b>' + U.esc(s.name) + "</b></td>" +
            '<td data-label="\u0627\u0644\u0648\u0635\u0641" class="muted">' + U.esc(s.description || "-") + "</td>" +
            '<td data-label="\u0627\u0644\u0623\u0633\u0626\u0644\u0629"><span class="badge badge-primary">' + (qCounts[s.id] || 0) + "</span></td>" +
            '<td data-label="\u0623\u064f\u0646\u0634\u0626\u062a" class="tiny">' + U.formatDate(s.createdAt) + "</td>" +
            '<td data-label="\u0625\u062c\u0631\u0627\u0621\u0627\u062a">' +
            '<button class="btn btn-sm" data-edit="' + s.id + '">\u062a\u0639\u062f\u064a\u0644</button> ' +
            '<button class="btn btn-sm btn-danger" data-del="' + s.id + '">\u062d\u0630\u0641</button></td></tr>';
        }).join("")
        : '<tr><td colspan="5" class="table-empty">-</td></tr>';

      let seedCards = "";
      let seedStatuses = [];
      try {
        seedStatuses = await QP.seed.statusAll();
        const totals = await Promise.all(seedStatuses.map(async function (st) {
          if (st.installed) return null;
          try { return QP.seed.flatten(await QP.seed.loadBank(st.url)).length; } catch (e2) { return null; }
        }));
        seedCards = seedStatuses.map(function (st, i) {
          const n = st.installed ? st.count : totals[i];
          const msg = st.installed
            ? "تم التثبيت في مادة «" + st.subject + "»" + (n ? " (" + n + " سؤال)" : "")
            : "لم يُثبَّت بعد — سيُنشئ مادة «" + st.subject + "» ويضيف" + (n ? " " + n + " سؤالاً" : " الأسئلة") + " من الوحدات كلها.";
          return '<div class="card mt mb">' +
            '<div class="card-head"><h2>📚 بنك جاهز: ' + U.esc(st.subject) + '</h2><div class="spacer"></div>' +
            '<button class="btn btn-sm ' + (st.installed ? "btn-ghost" : "btn-primary") + '" data-seed="' + U.esc(st.flag) + '">' +
            (st.installed ? "إعادة التثبيت" : "تثبيت بنك " + U.esc(st.subject)) +
            "</button></div>" +
            '<p class="muted tiny">' + U.esc(msg) + "</p>" +
            "</div>";
        }).join("");
      } catch (e) { seedCards = ""; }

      shell("subjects",
        '<div class="card-head"><h2>\u0627\u0644\u0645\u0648\u0627\u062f</h2><div class="spacer"></div>' +
        '<button class="btn btn-primary" id="addSub">+ \u0645\u0627\u062f\u0629</button></div>' +
        seedCards +
        '<div class="table-wrap responsive"><table><thead><tr>' +
        '<th>\u0627\u0644\u0645\u0627\u062f\u0629</th><th>\u0627\u0644\u0648\u0635\u0641</th><th>\u0627\u0644\u0623\u0633\u0626\u0644\u0629</th><th>\u0623\u064f\u0646\u0634\u0626\u062a</th><th>\u0625\u062c\u0631\u0627\u0621\u0627\u062a</th>' +
        "</tr></thead><tbody>" + rows + "</tbody></table></div>"
      );

      document.getElementById("addSub").addEventListener("click", function () {
        subjectModal();
      });

      document.querySelectorAll("[data-seed]").forEach(function (btn) {
        btn.addEventListener("click", async function () {
          const ds = QP.seed.DATASETS.find(function (d) { return d.flag === btn.dataset.seed; });
          if (!ds) return;
          const st = seedStatuses.find(function (s) { return s.flag === ds.flag; });
          const question = st && st.installed
            ? "إعادة التثبيت؟ سيتم حذف مادة «" + ds.subject + "» وأسئلتها ثم إعادة الإضافة."
            : "سيتم إنشاء مادة «" + ds.subject + "» وإضافة الأسئلة. متابعة؟";
          if (!(await U.confirm(question))) return;
          btn.disabled = true;
          btn.textContent = "جارٍ التثبيت...";
          try {
            const r = await QP.seed.installDataset(ds, { force: true, reset: st && st.installed });
            U.toast("تم تثبيت " + r.count + " سؤالاً في «" + ds.subject + "»", "success", 4000);
            renderSubjects();
          } catch (e) {
            U.toast("فشل التثبيت: " + e.message, "error", 6000);
            btn.disabled = false;
            btn.textContent = "تثبيت بنك " + ds.subject;
          }
        });
      });

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
      title: isEdit ? "\u062a\u0639\u062f\u064a\u0644 \u0645\u0627\u062f\u0629" : "\u0645\u0627\u062f\u0629 \u062c\u062f\u064a\u062f\u0629",
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
          const data = {
            name: name,
            description: node.querySelector("#subDesc").value.trim()
          };
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
   * placeholder - سيتم إكمال باقي الأقسام في الجزء 2
   * ============================================================ */

  /* هذه الأسطر مهمة — سنستخدمها لاحقاً */
  window.__QP_ADMIN_STATE = state;
  window.__QP_ADMIN_VIEW = view;
  window.__QP_ADMIN_SHELL = shell;
  window.__QP_ADMIN_STAT = stat;
  window.__QP_ADMIN_ERRORCARD = errorCard;
  window.__QP_ADMIN_DIFFLABEL = diffLabel;
  window.__QP_ADMIN_STATUSBADGE = statusBadge;
  
  /* ============================================================
 * QUESTIONS - بنك الأسئلة مع الفلاتر
 * ============================================================ */
const qFilter = {
  subjectId: "",
  type: "",
  diff: "",
  search: "",
  unit: "",
  lesson: ""
};

async function renderQuestions() {
  shell("questions", U.loaderHTML());
  try {
    const arr = await Promise.all([S.listSubjects(), S.listQuestions()]);
    const subjects = arr[0];
    const questions = arr[1];
    state.subjects = subjects;
    state.questions = questions;

    /* استخراج الوحدات والدروس الفريدة */
    const unitsMap = {};
    const lessonsMap = {};
    questions.forEach(function (q) {
      if (q.unitNumber !== null && q.unitNumber !== undefined) {
        const key = "u:" + q.unitNumber;
        if (!unitsMap[key]) {
          unitsMap[key] = {
            type: "number",
            value: q.unitNumber,
            label: "\u0627\u0644\u0648\u062d\u062f\u0629 " + q.unitNumber
          };
        }
      }
      if (q.unitTitle) {
        const key = "ut:" + q.unitTitle;
        if (!unitsMap[key]) {
          unitsMap[key] = {
            type: "title",
            value: q.unitTitle,
            label: q.unitTitle
          };
        }
      }
      if (q.lessonTitle) {
        lessonsMap[q.lessonTitle] = q.lessonTitle;
      }
    });

    const units = Object.values(unitsMap).sort(function (a, b) {
      if (a.type === "number" && b.type === "number") return a.value - b.value;
      return a.label.localeCompare(b.label);
    });
    const lessons = Object.keys(lessonsMap).sort();

    /* الفلترة */
    const list = questions.filter(function (q) {
      if (qFilter.subjectId && q.subjectId !== qFilter.subjectId) return false;
      if (qFilter.type && q.type !== qFilter.type) return false;
      if (qFilter.diff && q.difficulty !== qFilter.diff) return false;
      if (qFilter.unit) {
        const parts = qFilter.unit.split(":");
        const kind = parts[0];
        const val = parts.slice(1).join(":");
        if (kind === "u" && String(q.unitNumber) !== val) return false;
        if (kind === "ut" && q.unitTitle !== val) return false;
      }
      if (qFilter.lesson && q.lessonTitle !== qFilter.lesson) return false;
      if (qFilter.search &&
        U.normalizeArabic(q.text).indexOf(U.normalizeArabic(qFilter.search)) < 0) {
        return false;
      }
      return true;
    });

    /* الترتيب حسب الوحدة ثم الدرس */
    list.sort(function (a, b) {
      const ua = (a.unitNumber !== null && a.unitNumber !== undefined) ? a.unitNumber : 9999;
      const ub = (b.unitNumber !== null && b.unitNumber !== undefined) ? b.unitNumber : 9999;
      if (ua !== ub) return ua - ub;
      return (a.lessonTitle || "").localeCompare(b.lessonTitle || "");
    });

    /* الصفوف */
    const rows = list.length
      ? list.slice(0, 500).map(function (q) {
        const shortText = (q.text || "").slice(0, 80) +
          ((q.text && q.text.length > 80) ? "..." : "");
        const loc = [];
        if (q.unitNumber !== null && q.unitNumber !== undefined) {
          loc.push("W" + q.unitNumber);
        } else if (q.unitTitle) {
          loc.push(U.esc(q.unitTitle));
        }
        if (q.lessonTitle) loc.push(U.esc(q.lessonTitle));

        return "<tr>" +
          '<td data-label="\u0627\u0644\u0646\u0648\u0639">' + U.badgeForType(q.type) +
          (U.sectionBadge(q) ? " " + U.sectionBadge(q) : "") + "</td>" +
          '<td data-label="\u0627\u0644\u0633\u0624\u0627\u0644">' +
          (q.passage ? '<span class="badge badge-passage" title="\u0645\u0631\u0641\u0642 \u0628\u0646\u0635">\uD83D\uDCDC \u0646\u0635</span> ' : "") +
          U.esc(shortText) + "</td>" +
          '<td data-label="\u0627\u0644\u0645\u0648\u0642\u0639" class="tiny">' +
          (loc.length ? loc.join(" / ") : "-") + "</td>" +
          '<td data-label="\u0627\u0644\u0645\u0627\u062f\u0629" class="muted">' +
          U.esc(q.subjectName || "-") + "</td>" +
          '<td data-label="\u0627\u0644\u0635\u0639\u0648\u0628\u0629"><span class="badge badge-muted">' +
          diffLabel(q.difficulty) + "</span></td>" +
          '<td data-label="\u0627\u0644\u062f\u0631\u062c\u0629">' + (q.points || 1) + "</td>" +
          '<td data-label="\u0625\u062c\u0631\u0627\u0621\u0627\u062a">' +
          '<button class="btn btn-sm" data-view="' + q.id + '">\uD83D\uDC41</button> ' +
          '<button class="btn btn-sm" data-edit="' + q.id + '">\u270E</button> ' +
          '<button class="btn btn-sm btn-danger" data-del="' + q.id + '">\uD83D\uDDD1</button>' +
          '</td></tr>';
      }).join("")
      : '<tr><td colspan="7" class="table-empty">\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u0633\u0626\u0644\u0629 \u0645\u0637\u0627\u0628\u0642\u0629</td></tr>';

    /* قوائم الفلترة */
    const typeOpts = '<option value="">\u0643\u0644 \u0627\u0644\u0623\u0646\u0648\u0627\u0639</option>' +
      Object.keys(U.TYPE_LABELS).map(function (t) {
        return '<option value="' + t + '"' +
          (qFilter.type === t ? " selected" : "") + ">" +
          U.TYPE_LABELS[t] + "</option>";
      }).join("");

    const subjOpts = '<option value="">\u0643\u0644 \u0627\u0644\u0645\u0648\u0627\u062f</option>' +
      subjects.map(function (s) {
        return '<option value="' + s.id + '"' +
          (qFilter.subjectId === s.id ? " selected" : "") + ">" +
          U.esc(s.name) + "</option>";
      }).join("");

    const unitOpts = '<option value="">\u0643\u0644 \u0627\u0644\u0648\u062d\u062f\u0627\u062a</option>' +
      units.map(function (u) {
        const val = (u.type === "number" ? "u:" : "ut:") + u.value;
        return '<option value="' + U.esc(val) + '"' +
          (qFilter.unit === val ? " selected" : "") + ">" +
          U.esc(u.label) + "</option>";
      }).join("");

    const lessonOpts = '<option value="">\u0643\u0644 \u0627\u0644\u062f\u0631\u0648\u0633</option>' +
      lessons.map(function (l) {
        return '<option value="' + U.esc(l) + '"' +
          (qFilter.lesson === l ? " selected" : "") + ">" +
          U.esc(l) + "</option>";
      }).join("");

    shell("questions",
      '<div class="card-head"><h2>\u0628\u0646\u0643 \u0627\u0644\u0623\u0633\u0626\u0644\u0629</h2>' +
      '<span class="badge badge-primary">' + list.length + " / " + questions.length + "</span>" +
      '<div class="spacer"></div>' +
      '<button class="btn" id="importBtn">\u2b07 \u0627\u0633\u062a\u064a\u0631\u0627\u062f</button> ' +
      '<button class="btn btn-primary" id="addQ">+ \u0633\u0624\u0627\u0644</button></div>' +

      '<div class="card">' +
      '<div class="form-row-3">' +
      '<div class="field" style="margin:0"><input id="fSearch" placeholder="\uD83D\uDD0D \u0628\u062d\u062b..." value="' + U.esc(qFilter.search) + '"></div>' +
      '<div class="field" style="margin:0"><select id="fSubj">' + subjOpts + "</select></div>" +
      '<div class="field" style="margin:0"><select id="fType">' + typeOpts + "</select></div>" +
      '</div>' +
      '<div class="form-row-3 mt-sm">' +
      '<div class="field" style="margin:0"><select id="fUnit">' + unitOpts + "</select></div>" +
      '<div class="field" style="margin:0"><select id="fLesson">' + lessonOpts + "</select></div>" +
      '<div class="field" style="margin:0"><button class="btn btn-sm" id="resetFilters" style="width:100%">\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u0641\u0644\u0627\u062a\u0631</button></div>' +
      '</div></div>' +

      '<div class="table-wrap responsive mt"><table><thead><tr>' +
      '<th>\u0627\u0644\u0646\u0648\u0639</th><th>\u0627\u0644\u0633\u0624\u0627\u0644</th><th>\u0627\u0644\u0645\u0648\u0642\u0639</th><th>\u0627\u0644\u0645\u0627\u062f\u0629</th><th>\u0627\u0644\u0635\u0639\u0648\u0628\u0629</th><th>\u0627\u0644\u062f\u0631\u062c\u0629</th><th></th>' +
      "</tr></thead><tbody>" + rows + "</tbody></table></div>" +

      (list.length > 500 ? '<p class="help mt-sm center">\u064a\u0639\u0631\u0636 \u0623\u0648\u0644 500 \u0633\u0624\u0627\u0644</p>' : "")
    );

    /* الأحداث */
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
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    }, 350));

    document.getElementById("fSubj").addEventListener("change", function (e) {
      qFilter.subjectId = e.target.value;
      renderQuestions();
    });

    document.getElementById("fType").addEventListener("change", function (e) {
      qFilter.type = e.target.value;
      renderQuestions();
    });

    document.getElementById("fUnit").addEventListener("change", function (e) {
      qFilter.unit = e.target.value;
      renderQuestions();
    });

    document.getElementById("fLesson").addEventListener("change", function (e) {
      qFilter.lesson = e.target.value;
      renderQuestions();
    });

    document.getElementById("resetFilters").addEventListener("click", function () {
      qFilter.subjectId = "";
      qFilter.type = "";
      qFilter.diff = "";
      qFilter.search = "";
      qFilter.unit = "";
      qFilter.lesson = "";
      renderQuestions();
    });

    document.querySelectorAll("[data-edit]").forEach(function (b) {
      b.addEventListener("click", function () {
        questionModal(
          questions.find(function (x) { return x.id === b.dataset.edit; }),
          function () { renderQuestions(); }
        );
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
  const ansTxt = U.answerText ? U.answerText(q) : (Array.isArray(q.answer) ? q.answer.join(" \u060C ") : (q.answer || "-"));

  U.modal({
    title: "\u0639\u0631\u0636 \u0627\u0644\u0633\u0624\u0627\u0644",
    body:
      '<div class="student-info-row mb">' +
      '<div class="item"><div class="lbl">\u0627\u0644\u0646\u0648\u0639</div><div class="val">' +
      (U.TYPE_LABELS[q.type] || q.type) + "</div></div>" +
      '<div class="item"><div class="lbl">\u0627\u0644\u0645\u0627\u062f\u0629</div><div class="val">' +
      U.esc(q.subjectName || "-") + "</div></div>" +
      '<div class="item"><div class="lbl">\u0627\u0644\u0648\u062d\u062f\u0629</div><div class="val">' +
      U.esc(
        (q.unitNumber !== null && q.unitNumber !== undefined)
          ? "\u0631\u0642\u0645 " + q.unitNumber
          : (q.unitTitle || "-")
      ) + "</div></div>" +
      '<div class="item"><div class="lbl">\u0627\u0644\u062f\u0631\u0633</div><div class="val">' +
      U.esc(q.lessonTitle || "-") + "</div></div>" +
      '<div class="item"><div class="lbl">\u0627\u0644\u062f\u0631\u062c\u0629</div><div class="val">' +
      (q.points || 1) + "</div></div>" +
      (U.sectionOf(q) ? '<div class="item"><div class="lbl">\u0627\u0644\u0642\u0633\u0645</div><div class="val">' +
        U.esc(U.sectionOf(q)) + "</div></div>" : "") +
      '</div>' +

      U.passageHTML(q.passage) +

      (q.image ? '<div class="field"><label>\u0627\u0644\u0635\u0648\u0631\u0629</label>' +
        '<div style="text-align:center"><img src="' + U.esc(q.image) + '" style="max-width:100%;border-radius:10px;border:1px solid #ddd"></div></div>' : "") +

      '<div class="field"><label>\u0627\u0644\u0633\u0624\u0627\u0644</label>' +
      '<div style="background:var(--surface-2);padding:12px;border-radius:10px;line-height:1.8">' +
      U.esc(q.text) + "</div></div>" +

      (q.options && q.options.length
        ? '<div class="field"><label>\u0627\u0644\u062e\u064a\u0627\u0631\u0627\u062a</label>' +
          q.options.map(function (o, i) {
            const isCorrect = Array.isArray(q.answer)
              ? q.answer.indexOf(o) >= 0
              : q.answer === o;
            return '<div style="padding:6px 0"><span class="badge ' +
              (isCorrect ? "badge-success" : "badge-muted") + '">' +
              (i + 1) + "</span> " + U.esc(o) + "</div>";
          }).join("") + "</div>"
        : "") +

      (q.type === "matching" && q.pairs && q.pairs.length
        ? '<div class="field"><label>\u0623\u0632\u0648\u0627\u062c \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629</label>' +
          q.pairs.map(function (p) { return '<div style="padding:4px 0">' + U.esc(p.left) + ' \u2190 <b style="color:var(--success)">' + U.esc(p.right) + '</b></div>'; }).join("") + "</div>" : "") +

      (q.type === "ordering" && q.items && q.items.length
        ? '<div class="field"><label>\u0627\u0644\u062a\u0631\u062a\u064a\u0628 \u0627\u0644\u0635\u062d\u064a\u062d</label>' +
          q.items.map(function (x, i) { return '<div style="padding:4px 0">' + (i + 1) + '. ' + U.esc((x && typeof x === "object") ? x.text : x) + '</div>'; }).join("") + '</div>' : "") +

      (q.type === "classification" && q.items && q.items.length
        ? '<div class="field"><label>\u0627\u0644\u062a\u0635\u0646\u064a\u0641</label>' +
          q.items.map(function (x) { return '<div style="padding:4px 0">' + U.esc(x.text) + ' \u2190 <b style="color:var(--success)">' + U.esc(x.category) + '</b></div>'; }).join("") + '</div>' : "") +

      (q.type === "comparison" && q.rows && q.rows.length
        ? '<div class="field"><label>\u062c\u062f\u0648\u0644 \u0627\u0644\u0645\u0642\u0627\u0631\u0646\u0629</label><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">' +
          '<tr><th style="border:1px solid #ccc;padding:6px">\u0648\u062c\u0647 \u0627\u0644\u0645\u0642\u0627\u0631\u0646\u0629</th>' +
          (q.columns || []).map(function (c) { return '<th style="border:1px solid #ccc;padding:6px">' + U.esc(c) + '</th>'; }).join("") + '</tr>' +
          q.rows.map(function (row, r) {
            return '<tr><td style="border:1px solid #ccc;padding:6px">' + U.esc(row.criterion) + '</td>' +
              (q.values || row.values || []).map(function (v, c) {
                const isB = (q.blanks || []).some(function (b) { return Number(b[0]) === r && Number(b[1]) === c; });
                return '<td style="border:1px solid #ccc;padding:6px' + (isB ? ';color:var(--success);font-weight:600' : "") + '">' + U.esc(v) + '</td>';
              }).join("") + '</tr>';
          }).join("") + '</table></div></div>' : "") +

      (q.type === "diagram_label" && q.labels && q.labels.length
        ? '<div class="field"><label>\u0627\u0644\u062a\u0633\u0645\u064a\u0627\u062a</label>' +
          q.labels.map(function (l) { return '<div style="padding:4px 0">' + U.esc(l.number) + '. <b style="color:var(--success)">' + U.esc(l.answer) + '</b></div>'; }).join("") + '</div>' : "") +

      '<div class="field"><label>\u0627\u0644\u0625\u062c\u0627\u0628\u0629 \u0627\u0644\u0635\u062d\u064a\u062d\u0629</label>' +
      '<b style="color:var(--success)">' + U.esc(ansTxt) + "</b></div>" +

      (q.explanation
        ? '<div class="field"><label>\u0627\u0644\u0634\u0631\u062d</label>' +
          '<div class="muted">' + U.esc(q.explanation) + "</div></div>"
        : ""),

    footer: '<button class="btn btn-ghost" data-close>\u0625\u063a\u0644\u0627\u0642</button>'
  });
}

function optionsEditorHTML(options, correct, type) {
  options = options && options.length ? options : ["", "", "", ""];
  const inputType = type === "multi" ? "checkbox" : "radio";

  return options.map(function (o, i) {
    const checked = Array.isArray(correct)
      ? correct.indexOf(o) >= 0
      : correct === o;

    return '<div class="flex opt-row" data-opt style="margin-bottom:8px">' +
      '<input type="' + inputType + '" name="correctMark" data-correct style="width:auto"' +
      (checked && o ? " checked" : "") + ">" +
      '<input type="text" data-opttext value="' + U.esc(o) + '" placeholder="\u0627\u0644\u062e\u064a\u0627\u0631 ' + (i + 1) + '">' +
      '<button type="button" class="btn btn-sm btn-danger" data-rmopt>\u2715</button></div>';
  }).join("");
}

function questionFormHTML(q) {
  q = q || {
    type: "mcq",
    options: ["", "", "", ""],
    answer: "",
    difficulty: "medium",
    points: 1,
    tags: [],
    explanation: ""
  };

  const isMCQ = q.type === "mcq" || q.type === "multi";
  const isTF = q.type === "true_false";
  const isImage = q.type === "image_mcq" || q.type === "diagram_label";
  const isMatching = q.type === "matching";
  const isOrdering = q.type === "ordering";
  const isClass = q.type === "classification";
  const isCompare = q.type === "comparison";
  const isDiagram = q.type === "diagram_label";

  const qPairsText = (q.pairs || []).map(function (p) { return p.left + " = " + p.right; }).join("\n");
  const qOrderText = (q.items || []).map(function (x) { return (x && typeof x === "object") ? x.text : x; }).join("\n");
  const qCatsText = (q.categories || []).join(", ");
  const qClsText = (q.items || []).map(function (x) { return x.text + " = " + (x.category || ""); }).join("\n");
  const qColsText = (q.columns || []).join(", ");
  const qRowsText = (q.rows || []).map(function (r, ri) {
    const cells = [r.criterion].concat((r.values || []).map(function (v, c) {
      const isB = (q.blanks || []).some(function (b) { return Number(b[0]) === ri && Number(b[1]) === c; });
      return isB ? "[" + v + "]" : v;
    }));
    return cells.join(" | ");
  }).join("\n");
  const qLabelsText = (q.labels || []).map(function (l) { return l.number + " = " + l.answer; }).join("\n");
  const isText = ["fill_blank", "short_answer", "essay"].indexOf(q.type) >= 0;
  const passage = U.normalizePassage(q.passage) || { title: "", text: "", notes: "" };

  return (
    '<div class="field"><label>\u0646\u0648\u0639 \u0627\u0644\u0633\u0624\u0627\u0644</label><select id="qType">' +
    Object.keys(U.TYPE_LABELS).map(function (t) {
      return '<option value="' + t + '"' +
        (q.type === t ? " selected" : "") + ">" +
        U.TYPE_LABELS[t] + "</option>";
    }).join("") +
    "</select></div>" +

    '<div class="field"><label>\u0646\u0635 \u0627\u0644\u0633\u0624\u0627\u0644 *</label>' +
    '<textarea id="qText" style="min-height:80px">' + U.esc(q.text || "") + "</textarea></div>" +

    '<div id="fieldsOptions" class="' + (isMCQ || q.type === "image_mcq" ? "" : "hidden") + '">' +
    '<label class="tiny">\u0627\u0644\u062e\u064a\u0627\u0631\u0627\u062a</label>' +
    '<div id="optionsBox">' + optionsEditorHTML(q.options, q.answer, q.type) + "</div>" +
    '<button type="button" class="btn btn-sm mt-sm" id="addOpt">+ \u062e\u064a\u0627\u0631</button></div>' +

    '<div id="fieldsImage" class="field ' + (isImage ? "" : "hidden") + '">' +
    '<label>\u0627\u0644\u0635\u0648\u0631\u0629 (\u0631\u0627\u0628\u0637 \u0623\u0648 \u0631\u0641\u0639 \u0645\u0644\u0641)</label>' +
    '<div class="flex" style="gap:8px;align-items:center">' +
    '<input id="qImage" value="' + U.esc(q.image || "") + '" placeholder="https://... \u0623\u0648 data:image/...">' +
    '<input type="file" id="qImageFile" accept="image/*" style="width:auto">' +
    '</div>' +
    '<div id="qImagePreview" style="margin-top:8px">' +
    (q.image ? '<img src="' + U.esc(q.image) + '" style="max-width:220px;border-radius:8px;border:1px solid #ddd">' : "") +
    '</div></div>' +

    '<div id="fieldsMatching" class="field ' + (isMatching ? "" : "hidden") + '">' +
    '<label>\u0623\u0632\u0648\u0627\u062c \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629 (\u0643\u0644 \u0633\u0637\u0631: \u0627\u0644\u0639\u0646\u0635\u0631 = \u0627\u0644\u0645\u0642\u0627\u0628\u0644)</label>' +
    '<textarea id="qPairs" style="min-height:90px" placeholder="\u0627\u0644\u062e\u0644\u064a\u0629 \u0627\u0644\u0639\u0635\u0628\u064a\u0629 = \u0627\u0644\u0648\u062d\u062f\u0629 \u0627\u0644\u0648\u0638\u064a\u0641\u064a\u0629 \u0644\u0644\u062c\u0647\u0627\u0632 \u0627\u0644\u0639\u0635\u0628\u064a">' + U.esc(qPairsText) + '</textarea></div>' +

    '<div id="fieldsOrdering" class="field ' + (isOrdering ? "" : "hidden") + '">' +
    '<label>\u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u062a\u0631\u062a\u064a\u0628 (\u0643\u0644 \u0633\u0637\u0631 \u0639\u0646\u0635\u0631\u060c \u0628\u0627\u0644\u062a\u0631\u062a\u064a\u0628 \u0627\u0644\u0635\u062d\u064a\u062d)</label>' +
    '<textarea id="qOrder" style="min-height:90px">' + U.esc(qOrderText) + '</textarea></div>' +

    '<div id="fieldsClass" class="field ' + (isClass ? "" : "hidden") + '">' +
    '<label>\u0627\u0644\u0641\u0626\u0627\u062a (\u0645\u0641\u0635\u0648\u0644\u0629 \u0628\u0641\u0648\u0627\u0635\u0644)</label>' +
    '<input id="qCats" value="' + U.esc(qCatsText) + '" placeholder="\u062e\u0644\u0627\u064a\u0627 \u062f\u0628\u0642\u064a\u0629, \u062e\u0644\u0627\u064a\u0627 \u0639\u0635\u0628\u064a\u0629">' +
    '<label class="tiny" style="display:block;margin-top:8px">\u0627\u0644\u0639\u0646\u0627\u0635\u0631 (\u0643\u0644 \u0633\u0637\u0631: \u0627\u0644\u0639\u0646\u0635\u0631 = \u0627\u0644\u0641\u0626\u0629)</label>' +
    '<textarea id="qClsItems" style="min-height:90px" placeholder="\u0627\u0644\u062e\u0644\u0627\u064a\u0627 \u0642\u0644\u064a\u0644\u0629 \u0627\u0644\u062a\u063a\u0635\u0646\u0627\u062a = \u062e\u0644\u0627\u064a\u0627 \u062f\u0628\u0642\u064a\u0629">' + U.esc(qClsText) + '</textarea></div>' +

    '<div id="fieldsCompare" class="field ' + (isCompare ? "" : "hidden") + '">' +
    '<label>\u0623\u0639\u0645\u062f\u0629 \u0627\u0644\u0645\u0642\u0627\u0631\u0646\u0629 (\u0645\u0641\u0635\u0648\u0644\u0629 \u0628\u0641\u0648\u0627\u0635\u0644)</label>' +
    '<input id="qCols" value="' + U.esc(qColsText) + '" placeholder="\u0627\u0644\u062c\u0647\u0627\u0632 \u0627\u0644\u0639\u0635\u0628\u064a \u0627\u0644\u0645\u0631\u0643\u0632\u064a, \u0627\u0644\u062c\u0647\u0627\u0632 \u0627\u0644\u0639\u0635\u0628\u064a \u0627\u0644\u0645\u062d\u064a\u0637\u064a">' +
    '<label class="tiny" style="display:block;margin-top:8px">\u0627\u0644\u0635\u0641\u0648\u0641 (\u0643\u0644 \u0633\u0637\u0631: \u0648\u062c\u0647 \u0627\u0644\u0645\u0642\u0627\u0631\u0646\u0629 | \u0642\u064a\u0645\u0629 | \u0642\u064a\u0645\u0629). \u0636\u0639 \u0627\u0644\u062e\u0644\u064a\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u062a\u0639\u0628\u0626\u062a\u0647\u0627 \u0628\u064a\u0646 [ ]</label>' +
    '<textarea id="qRows" style="min-height:90px" placeholder="\u0627\u0644\u062a\u0631\u0643\u064a\u0628 | [\u0627\u0644\u062f\u0645\u0627\u063a \u0648\u0627\u0644\u0646\u062e\u0627\u0639 \u0627\u0644\u0634\u0648\u0643\u064a] | \u0627\u0644\u0623\u0639\u0635\u0627\u0628">' + U.esc(qRowsText) + '</textarea></div>' +

    '<div id="fieldsDiagram" class="field ' + (isDiagram ? "" : "hidden") + '">' +
    '<label>\u0627\u0644\u062a\u0633\u0645\u064a\u0627\u062a (\u0643\u0644 \u0633\u0637\u0631: \u0627\u0644\u0631\u0642\u0645 = \u0627\u0644\u0627\u0633\u0645)</label>' +
    '<textarea id="qLabels" style="min-height:90px" placeholder="1 = \u062c\u0633\u0645 \u0627\u0644\u062e\u0644\u064a\u0629\n2 = \u0627\u0644\u0645\u062d\u0648\u0631">' + U.esc(qLabelsText) + '</textarea></div>' +

    '<div id="fieldsTF" class="field ' + (isTF ? "" : "hidden") + '"><label>\u0627\u0644\u0625\u062c\u0627\u0628\u0629</label>' +
    '<label class="check"><input type="radio" name="tf" value="\u0635\u062d"' +
    (q.answer === "\u0635\u062d" ? " checked" : "") + "> \u0635\u062d</label>" +
    '<label class="check"><input type="radio" name="tf" value="\u062e\u0637\u0623"' +
    (q.answer === "\u062e\u0637\u0623" ? " checked" : "") + "> \u062e\u0637\u0623</label></div>" +

    '<div id="fieldsText" class="field ' + (isText ? "" : "hidden") + '">' +
    '<label>\u0627\u0644\u0625\u062c\u0627\u0628\u0629 \u0627\u0644\u0646\u0645\u0648\u0630\u062c\u064a\u0629' +
    (q.type === "essay" ? "" : " *") + '</label>' +
    '<textarea id="qAnswer" style="min-height:70px">' +
    U.esc(
      (q.type === "true_false" || q.type === "mcq" || q.type === "multi")
        ? ""
        : (q.answer || "")
    ) +
    "</textarea></div>" +

    '<div class="form-row-3">' +
    '<div class="field"><label>\u0627\u0644\u0635\u0639\u0648\u0628\u0629</label><select id="qDiff">' +
    ["easy", "medium", "hard"].map(function (d) {
      return '<option value="' + d + '"' +
        (q.difficulty === d ? " selected" : "") + ">" +
        diffLabel(d) + "</option>";
    }).join("") + "</select></div>" +

    '<div class="field"><label>\u0627\u0644\u062f\u0631\u062c\u0629</label>' +
    '<input type="number" id="qPoints" min="0.5" step="0.5" value="' + (q.points || 1) + '"></div>' +

    '<div class="field"><label>\u0631\u0642\u0645 \u0627\u0644\u0648\u062d\u062f\u0629</label>' +
    '<input type="number" id="qUnitNumber" value="' +
    ((q.unitNumber !== null && q.unitNumber !== undefined) ? q.unitNumber : "") +
    '" placeholder="\u0631\u0642\u0645"></div>' +
    "</div>" +

    '<div class="form-row">' +
    '<div class="field"><label>\u0627\u0633\u0645 \u0627\u0644\u062f\u0631\u0633</label>' +
    '<input id="qLesson" value="' + U.esc(q.lessonTitle || "") + '"></div>' +

    '<div class="field"><label>\u0648\u0633\u0648\u0645</label>' +
    '<input id="qTags" value="' + U.esc((q.tags || []).join(", ")) + '"></div>' +
    "</div>" +

    '<details class="passage-edit" id="qPassBox"' +
    ((passage.text || passage.notes) ? " open" : "") + ">" +
    '<summary>\uD83D\uDCDC \u0646\u0635 \u0627\u0644\u0642\u0635\u064a\u062f\u0629 / \u0627\u0644\u0645\u0642\u0637\u0639 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)</summary>' +
    '<div class="field"><label>\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0646\u0635</label>' +
    '<input id="qPassTitle" value="' + U.esc(passage.title) + '"></div>' +
    '<div class="field"><label>\u0646\u0635 \u0627\u0644\u0645\u0642\u0637\u0639</label>' +
    '<textarea id="qPassText" style="min-height:110px">' + U.esc(passage.text) + "</textarea></div>" +
    '<div class="field" style="margin-bottom:0"><label>\u0634\u0631\u062d \u0627\u0644\u0645\u0641\u0631\u062f\u0627\u062a (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)</label>' +
    '<textarea id="qPassNotes" style="min-height:60px">' + U.esc(passage.notes) + "</textarea></div>" +
    "</details>" +

    '<div class="field"><label>\u0627\u0644\u0634\u0631\u062d (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)</label>' +
    '<textarea id="qExp" style="min-height:60px">' + U.esc(q.explanation || "") + "</textarea></div>"
  );
}

function bindQuestionForm(node) {
  const typeSel = node.querySelector("#qType");
  const syncType = function () {
    const t = typeSel.value;
    const show = function (id, on) { const el = node.querySelector(id); if (el) el.classList.toggle("hidden", !on); };
    show("#fieldsOptions", t === "mcq" || t === "multi" || t === "image_mcq");
    show("#fieldsTF", t === "true_false");
    show("#fieldsText", t === "fill_blank" || t === "short_answer" || t === "essay");
    show("#fieldsImage", t === "image_mcq" || t === "diagram_label");
    show("#fieldsMatching", t === "matching");
    show("#fieldsOrdering", t === "ordering");
    show("#fieldsClass", t === "classification");
    show("#fieldsCompare", t === "comparison");
    show("#fieldsDiagram", t === "diagram_label");
    node.querySelectorAll("input[data-correct]").forEach(function (r) {
      r.type = t === "multi" ? "checkbox" : "radio";
    });
  };

  typeSel.addEventListener("change", syncType);

  const imgFile = node.querySelector("#qImageFile");
  if (imgFile) imgFile.addEventListener("change", function () {
    const f = imgFile.files && imgFile.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = function () {
      const field = node.querySelector("#qImage");
      if (field) field.value = reader.result;
      const prev = node.querySelector("#qImagePreview");
      if (prev) prev.innerHTML = '<img src="' + reader.result + '" style="max-width:220px;border-radius:8px;border:1px solid #ddd">';
    };
    reader.readAsDataURL(f);
  });

  node.querySelector("#addOpt").addEventListener("click", function () {
    const box = node.querySelector("#optionsBox");
    if (box.querySelectorAll("[data-opt]").length >= 8) {
      return U.toast("\u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649 8", "warn");
    }
    const t = typeSel.value;
    const div = document.createElement("div");
    div.className = "flex opt-row";
    div.setAttribute("data-opt");
    div.style.marginBottom = "8px";
    div.innerHTML =
      '<input type="' + (t === "multi" ? "checkbox" : "radio") + '" name="correctMark" data-correct style="width:auto">' +
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
    if (box.querySelectorAll("[data-opt]").length <= 2) {
      return U.toast("\u0644\u0627 \u064a\u0645\u0643\u0646 \u0623\u0642\u0644 \u0645\u0646 2", "warn");
    }
    row.remove();
  });
}

function collectQuestionForm(node) {
  const type = node.querySelector("#qType").value;
  const text = node.querySelector("#qText").value.trim();
  const points = Number(node.querySelector("#qPoints").value) || 1;
  const difficulty = node.querySelector("#qDiff").value;
  const tags = node.querySelector("#qTags").value
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
  const explanation = node.querySelector("#qExp").value.trim();
  const unitNumberRaw = node.querySelector("#qUnitNumber").value.trim();
  const unitNumber = unitNumberRaw === "" ? null : Number(unitNumberRaw);
  const lessonTitle = node.querySelector("#qLesson").value.trim();

  let options = [];
  let answer = null;
  let image = "";
  let pairs = [];
  let items = [];
  let categories = [];
  let columns = [];
  let rows = [];
  let blanks = [];
  let labels = [];

  if (type === "mcq" || type === "multi" || type === "image_mcq") {
    const rows = Array.from(node.querySelectorAll("[data-opt]"));
    options = rows.map(function (r) {
      return r.querySelector("[data-opttext]").value.trim();
    }).filter(Boolean);

    const corrects = rows
      .filter(function (r) { return r.querySelector("[data-correct]").checked; })
      .map(function (r) {
        return r.querySelector("[data-opttext]").value.trim();
      });

    answer = type === "multi" ? corrects : (corrects[0] || "");

    if (type === "mcq" && options.length < 2) {
      throw new Error("\u0623\u062f\u062e\u0644 \u062e\u064a\u0627\u0631\u064a\u0646 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644");
    }
    if (!answer || (Array.isArray(answer) && !answer.length)) {
      throw new Error("\u062d\u062f\u062f \u0627\u0644\u0625\u062c\u0627\u0628\u0629");
    }
    if (type === "image_mcq") {
      image = node.querySelector("#qImage").value.trim();
      if (!image) throw new Error("\u0623\u0636\u0641 \u0627\u0644\u0635\u0648\u0631\u0629");
    }
  } else if (type === "true_false") {
    const r = node.querySelector('input[name="tf"]:checked');
    answer = r ? r.value : "";
    if (!answer) throw new Error("\u062d\u062f\u062f \u0635\u062d \u0623\u0648 \u062e\u0637\u0623");
  } else if (type === "matching") {
    pairs = node.querySelector("#qPairs").value.split("\n").map(function (l) { return l.trim(); }).filter(Boolean)
      .map(function (l) {
        const i = l.indexOf("=");
        return { left: i < 0 ? l : l.slice(0, i).trim(), right: i < 0 ? "" : l.slice(i + 1).trim() };
      }).filter(function (p) { return p.left && p.right; });
    answer = pairs.map(function (p) { return p.right; });
    if (pairs.length < 2) throw new Error("\u0623\u062f\u062e\u0644 \u0632\u0648\u062c\u064a\u0646 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644");
  } else if (type === "ordering") {
    items = node.querySelector("#qOrder").value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    answer = items.slice();
    if (items.length < 2) throw new Error("\u0623\u062f\u062e\u0644 \u0639\u0646\u0635\u0631\u064a\u0646 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644");
  } else if (type === "classification") {
    categories = node.querySelector("#qCats").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    items = node.querySelector("#qClsItems").value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean).map(function (l) {
      const i = l.indexOf("=");
      return { text: (i >= 0 ? l.slice(0, i) : l).trim(), category: (i >= 0 ? l.slice(i + 1) : "").trim() };
    }).filter(function (x) { return x.text; });
    answer = {};
    items.forEach(function (it) { if (it.category) answer[it.text] = it.category; });
    if (categories.length < 2 || !items.length) throw new Error("\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u062a\u0635\u0646\u064a\u0641 \u063a\u064a\u0631 \u0645\u0643\u062a\u0645\u0644\u0629");
  } else if (type === "comparison") {
    columns = node.querySelector("#qCols").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    answer = {};
    node.querySelector("#qRows").value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (line, r) {
      const cells = line.split("|").map(function (s) { return s.trim(); });
      const criterion = cells.shift() || "";
      const values = cells.map(function (c) { return c.replace(/^\[|\]$/g, ""); });
      cells.forEach(function (c, ci) {
        if (/^\[.*\]$/.test(c)) { blanks.push([r, ci]); answer[r + "," + ci] = c.replace(/^\[|\]$/g, ""); }
      });
      if (criterion) rows.push({ criterion: criterion, values: values });
    });
    if (!rows.length) throw new Error("\u0623\u062f\u062e\u0644 \u0635\u0641\u0627\u064b \u0648\u0627\u062d\u062f\u0627\u064b \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644");
  } else if (type === "diagram_label") {
    image = node.querySelector("#qImage").value.trim();
    labels = node.querySelector("#qLabels").value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean).map(function (l) {
      const i = l.indexOf("=");
      return { number: (i >= 0 ? l.slice(0, i) : l).trim(), answer: (i >= 0 ? l.slice(i + 1) : "").trim() };
    }).filter(function (x) { return x.answer; });
    answer = {};
    labels.forEach(function (l) { answer[l.number] = l.answer; });
    if (!image || !labels.length) throw new Error("\u0628\u064a\u0627\u0646\u0627\u062a \u062a\u0633\u0645\u064a\u0629 \u0627\u0644\u0631\u0633\u0645 \u063a\u064a\u0631 \u0645\u0643\u062a\u0645\u0644\u0629");
  } else {
    answer = node.querySelector("#qAnswer").value.trim();
    if (type !== "essay" && !answer) {
      throw new Error("\u0623\u062f\u062e\u0644 \u0627\u0644\u0625\u062c\u0627\u0628\u0629");
    }
  }

  if (!text) throw new Error("\u0623\u062f\u062e\u0644 \u0646\u0635 \u0627\u0644\u0633\u0624\u0627\u0644");

  const passBox = node.querySelector("#qPassBox");
  const passage = (passBox && (U.normalizePassage !== undefined))
    ? U.normalizePassage({
      title: node.querySelector("#qPassTitle").value,
      text: node.querySelector("#qPassText").value,
      notes: node.querySelector("#qPassNotes").value
    })
    : null;

  return {
    type: type,
    text: text,
    options: options,
    answer: answer,
    image: image,
    pairs: pairs,
    items: items,
    categories: categories,
    columns: columns,
    rows: rows,
    blanks: blanks,
    labels: labels,
    difficulty: difficulty,
    tags: tags,
    explanation: explanation,
    points: points,
    unitNumber: unitNumber,
    lessonTitle: lessonTitle,
    passage: passage
  };
}

function questionModal(q, onDone) {
  const isEdit = !!q;

  U.modal({
    title: isEdit ? "\u062a\u0639\u062f\u064a\u0644 \u0633\u0624\u0627\u0644" : "\u0625\u0636\u0627\u0641\u0629 \u0633\u0624\u0627\u0644",
    size: "lg",
    body:
      (isEdit ? "" :
        '<div class="field"><label>\u0627\u0644\u0645\u0627\u062f\u0629</label><select id="qSubj"><option value="">- \u0628\u062f\u0648\u0646 -</option>' +
        state.subjects.map(function (s) {
          return '<option value="' + s.id + '">' + U.esc(s.name) + "</option>";
        }).join("") +
        "</select></div>") +
      questionFormHTML(q),

    footer: '<button class="btn btn-primary" data-save>\u062d\u0641\u0638</button>' +
      '<button class="btn btn-ghost" data-close>\u0625\u0644\u063a\u0627\u0621</button>',

    onMount: function (node, close) {
      bindQuestionForm(node);

      node.querySelector("[data-save]").addEventListener("click", async function () {
        try {
          const data = collectQuestionForm(node);
          let subjectId = q && q.subjectId;
          let subjectName = q && q.subjectName;

          if (!isEdit) {
            subjectId = node.querySelector("#qSubj").value;
            const subj = state.subjects.find(function (s) { return s.id === subjectId; });
            subjectName = subj ? subj.name : "";

            if (subjectId) {
              const map = await loadDupMap(subjectId);
              const k = qNorm(data.text);
              if (map[k]) {
                const yes = await U.confirm(
                  "\u26A0\uFE0F \u0647\u0630\u0627 \u0627\u0644\u0633\u0624\u0627\u0644 \u0645\u0648\u062c\u0648\u062f \u0645\u0633\u0628\u0642\u0627\u064b \u0641\u064a \u0645\u0627\u062f\u0629 \u00ab" +
                  (subjectName || "") + "\u00bb" +
                  (map[k] > 1 ? " (" + map[k] + " \u0646\u0633\u062e)" : "") +
                  ".\n\u0647\u0644 \u062a\u0631\u064a\u062f \u0625\u0636\u0627\u0641\u062a\u0647 \u0639\u0644\u0649 \u0623\u064a \u062d\u0627\u0644\u061f"
                );
                if (!yes) return;
              }
            }
          }

          if (isEdit) await S.updateQuestion(q.id, data);
          else {
            await S.addQuestion(data, subjectId, subjectName);
            delete dupCache["s:" + subjectId];
          }

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
 * IMPORT
 * ============================================================ */
function importModal(onDone) {
  U.modal({
    title: "\u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0623\u0633\u0626\u0644\u0629",
    size: "lg",
    body:
      '<div class="form-row">' +
      '<div class="field"><label>\u0627\u0644\u0645\u0627\u062f\u0629</label><select id="impSubj"><option value="">-</option>' +
      state.subjects.map(function (s) {
        return '<option value="' + s.id + '">' + U.esc(s.name) + "</option>";
      }).join("") +
      "</select></div>" +

      '<div class="field"><label>\u0627\u0644\u0635\u064a\u063a\u0629</label><select id="impFormat">' +
      '<option value="auto">\u0627\u0643\u062a\u0634\u0627\u0641 \u062a\u0644\u0642\u0627\u0626\u064a</option>' +
      '<option value="json">JSON</option>' +
      '<option value="csv">CSV</option>' +
      '<option value="text">\u0646\u0635</option></select></div>' +
      "</div>" +

      '<div class="field"><label>\u0627\u0644\u0645\u062d\u062a\u0648\u0649</label>' +
      '<textarea id="impText" style="min-height:180px"></textarea></div>' +

      '<div class="flex">' +
      '<label class="btn btn-sm">\uD83D\uDCC1 \u0645\u0644\u0641' +
      '<input type="file" id="impFile" accept=".json,.csv,.txt" class="hidden"></label>' +
      '<div class="spacer right"></div>' +
      '<button class="btn btn-sm" id="previewBtn">\u0645\u0639\u0627\u064a\u0646\u0629</button>' +
      "</div>" +

      '<div id="impPreview" class="mt"></div>',

    footer:
      '<button class="btn btn-primary" data-save disabled>\u0627\u0633\u062a\u064a\u0631\u0627\u062f</button>' +
      '<button class="btn btn-ghost" data-close>\u0625\u0644\u063a\u0627\u0621</button>',

    onMount: function (node, close) {
      let parsed = [];
      let latestDup = null;
      const preview = node.querySelector("#impPreview");
      const saveBtn = node.querySelector("[data-save]");

      node.querySelector("#impFile").addEventListener("change", function (e) {
        const f = e.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = function () {
          node.querySelector("#impText").value = reader.result;
        };
        reader.readAsText(f);
      });

      const doPreview = async function () {
        if (!QP.importer || typeof QP.importer.parse !== "function") {
          return U.toast("\u0645\u062d\u0631\u0643 \u0627\u0644\u0627\u0633\u062a\u064a\u0631\u0627\u062f \u063a\u064a\u0631 \u0645\u062a\u0627\u062d. \u0623\u0639\u062f \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0641\u062d\u0629.", "error", 5000);
        }

        const res = QP.importer.parse(
          node.querySelector("#impText").value,
          node.querySelector("#impFormat").value
        );

        parsed = res.questions;
        const ok = parsed.filter(function (q) { return !q._errors.length; }).length;
        const bad = parsed.length - ok;

        let html = '<div class="flex flex-wrap">' +
          '<span class="badge badge-success">' + ok + " \u0635\u0627\u0644\u062d</span>" +
          (bad ? '<span class="badge badge-danger">' + bad + " \u062e\u0637\u0623</span>" : "") +
          '<span class="badge badge-muted">' + (res.format || "-") + "</span></div>";

        if (res.errors.length) {
          html += '<p class="help">' +
            res.errors.slice(0, 6).map(U.esc).join("<br>") +
            "</p>";
        }

        /* ===== كشف المكرر قبل الاستيراد ===== */
        latestDup = null;
        const subjectId = node.querySelector("#impSubj").value;
        let dupIndex = null;
        if (subjectId && ok) {
          try {
            const map = await loadDupMap(subjectId);
            dupIndex = {};
            parsed.forEach(function (q, i) {
              if (!q._errors.length && map[qNorm(q.text)]) dupIndex[i] = true;
            });
            const dcount = Object.keys(dupIndex).length;
            latestDup = dupIndex;
            if (dcount) {
              html += '<div class="imp-dup-warn"><span class="badge badge-warning">\u26A0\uFE0F ' + dcount +
                " \u0645\u0643\u0631\u0631 \u0645\u0648\u062c\u0648\u062f \u0645\u0633\u0628\u0642\u0627\u064b \u2014 \u0633\u064a\u062a\u0645 \u062a\u062c\u0627\u0647\u0644\u0647</span></div>";
            }
          } catch (e) {
            /* تجاهل فشل الفحص */
          }
        }

        html += '<div class="import-preview mt-sm">' +
          parsed.slice(0, 40).map(function (q, i) {
            return '<div class="row"><b>' + (i + 1) + ".</b> " +
              U.badgeForType(q.type) + " " +
              U.esc((q.text || "").slice(0, 80)) +
              (q._errors.length
                ? ' <span class="badge badge-danger">' + U.esc(q._errors[0]) + "</span>"
                : (dupIndex && dupIndex[i]
                  ? ' <span class="badge badge-warning">\u0645\u0643\u0631\u0631</span>'
                  : "")) + "</div>";
          }).join("") +
          "</div>";

        preview.innerHTML = html;
        saveBtn.disabled = ok === 0;
      };

      node.querySelector("#previewBtn").addEventListener("click", doPreview);

      saveBtn.addEventListener("click", async function () {
        const valid = parsed.filter(function (q) { return !q._errors.length; });
        if (!valid.length) return U.toast("\u0644\u0627 \u064a\u0648\u062c\u062f \u0635\u0627\u0644\u062d", "warn");

        const subjectId = node.querySelector("#impSubj").value;
        const subj = state.subjects.find(function (s) { return s.id === subjectId; });

        let toImport = valid;
        let skipped = 0;
        if (latestDup) {
          toImport = [];
          valid.forEach(function (q) {
            const idx = parsed.indexOf(q);
            if (latestDup[idx]) skipped++;
            else toImport.push(q);
          });
        }

        saveBtn.disabled = true;
        saveBtn.textContent = "...";

        try {
          const n = await S.addQuestionsBulk(toImport, subjectId, subj ? subj.name : "");
          delete dupCache["s:" + subjectId];
          close();
          if (skipped) U.toast("\u062a\u0645 \u0627\u0633\u062a\u064a\u0631\u0627\u062f " + n + " (\u062a\u062c\u0627\u0647\u0644\u0646\u0627 " + skipped + " \u0645\u0643\u0631\u0631\u0627\u064b)", "warn", 5000);
          else U.toast("\u062a\u0645 \u0627\u0633\u062a\u064a\u0631\u0627\u062f " + n, "success");
          if (onDone) onDone();
        } catch (e) {
          U.toast("Error: " + e.message, "error");
          saveBtn.disabled = false;
          saveBtn.textContent = "\u0627\u0633\u062a\u064a\u0631\u0627\u062f";
        }
      });
    }
  });
}

/* ============================================================
 * TEACHERS
 * ============================================================ */
async function renderTeachers() {
  shell("teachers", U.loaderHTML());
  try {
    const arr = await Promise.all([
      S.listTeachers(),
      S.listSubjects(),
      S.listGroups()
    ]);
    const teachers = arr[0];
    const subjects = arr[1];
    const groups = arr[2];

    state.teachers = teachers;
    state.subjects = subjects;
    state.groups = groups;

    const subjectName = function (id) {
      const s = subjects.find(function (x) { return x.id === id; });
      return s ? s.name : "?";
    };

    const groupsOfTeacher = function (teacherId) {
      return groups.filter(function (g) {
        return (g.teacherAssignments || []).some(function (a) {
          return a.teacherId === teacherId;
        });
      });
    };

    const rows = teachers.length
      ? teachers.map(function (t) {
        const subjectsBadges = (t.subjectIds || []).map(function (id) {
          return '<span class="badge badge-primary">' + U.esc(subjectName(id)) + "</span>";
        }).join(" ") || "-";

        const grp = groupsOfTeacher(t.id);
        const grpBadges = grp.length
          ? grp.map(function (g) {
            return '<span class="badge badge-muted">' + U.esc(g.name) + "</span>";
          }).join(" ")
          : '<span class="muted tiny">-</span>';

        return "<tr>" +
          '<td data-label="\u0627\u0644\u0627\u0633\u0645"><b>' + U.esc(t.name) + "</b></td>" +
          '<td data-label="\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645" class="muted">' + U.esc(t.username) + "</td>" +
          '<td data-label="\u0627\u0644\u0645\u0648\u0627\u062f">' + subjectsBadges + "</td>" +
          '<td data-label="\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a">' + grpBadges + "</td>" +
          '<td data-label="\u0627\u0644\u062d\u0627\u0644\u0629">' +
          (t.active !== false
            ? '<span class="badge badge-success">\u0646\u0634\u0637</span>'
            : '<span class="badge badge-danger">\u0645\u0639\u0637\u0644</span>') + "</td>" +
          '<td data-label="\u0625\u062c\u0631\u0627\u0621\u0627\u062a">' +
          '<button class="btn btn-sm" data-edit="' + t.id + '">\u270E</button> ' +
          '<button class="btn btn-sm btn-danger" data-del="' + t.id + '">\uD83D\uDDD1</button>' +
          '</td></tr>';
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

    document.getElementById("addTeacher").addEventListener("click", function () {
      teacherModal(null);
    });

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
  const current = t || {
    name: "",
    username: "",
    subjectIds: [],
    active: true
  };

  const subjectChecks = state.subjects.map(function (s) {
    return '<label class="check"><input type="checkbox" class="subj-check" value="' + s.id + '"' +
      (current.subjectIds.indexOf(s.id) >= 0 ? " checked" : "") + "> " +
      U.esc(s.name) + "</label>";
  }).join("") || '<p class="muted">\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0648\u0627\u062f</p>';

  U.modal({
    title: isEdit ? "\u062a\u0639\u062f\u064a\u0644 \u0645\u0639\u0644\u0645" : "\u0645\u0639\u0644\u0645 \u062c\u062f\u064a\u062f",
    body:
      '<div class="field"><label>\u0627\u0644\u0627\u0633\u0645 *</label>' +
      '<input id="tName" value="' + U.esc(current.name) + '"></div>' +

      '<div class="form-row">' +
      '<div class="field"><label>\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 *</label>' +
      '<input id="tUser" value="' + U.esc(current.username) + '"' +
      (isEdit ? " disabled" : "") + "></div>" +

      '<div class="field"><label>' +
      (isEdit
        ? "\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u062c\u062f\u064a\u062f\u0629"
        : "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 *") +
      '</label><input type="password" id="tPass"></div>' +
      "</div>" +

      '<div class="field"><label>\u0627\u0644\u0645\u0648\u0627\u062f \u0627\u0644\u062a\u064a \u064a\u0635\u062d\u0651\u062d\u0647\u0627</label>' +
      '<div style="max-height:220px;overflow:auto;border:1px solid var(--border);border-radius:10px;padding:10px">' +
      subjectChecks + "</div></div>" +

      '<label class="check mt"><input type="checkbox" id="tActive"' +
      (current.active !== false ? " checked" : "") + '> \u0646\u0634\u0637</label>',

    footer:
      '<button class="btn btn-primary" data-save>\u062d\u0641\u0638</button>' +
      '<button class="btn btn-ghost" data-close>\u0625\u0644\u063a\u0627\u0621</button>',

    onMount: function (node, close) {
      node.querySelector("[data-save]").addEventListener("click", async function () {
        const name = node.querySelector("#tName").value.trim();
        const username = node.querySelector("#tUser").value.trim().toLowerCase();
        const password = node.querySelector("#tPass").value.trim();
        const active = node.querySelector("#tActive").checked;
        const subjectIds = Array.from(node.querySelectorAll(".subj-check:checked"))
          .map(function (c) { return c.value; });

        if (!name) return U.toast("\u0623\u062f\u062e\u0644 \u0627\u0644\u0627\u0633\u0645", "warn");
        if (!isEdit && !username) return U.toast("\u0623\u062f\u062e\u0644 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645", "warn");
        if (!isEdit && !password) return U.toast("\u0623\u062f\u062e\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", "warn");

        try {
          if (isEdit) {
            const patch = {
              name: name,
              subjectIds: subjectIds,
              active: active
            };
            if (password) patch.password = password;
            await S.updateTeacher(t.id, patch);
          } else {
            const ex = await S.getTeacherByUsername(username);
            if (ex) return U.toast("\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0645\u0648\u062c\u0648\u062f", "error");
            await S.addTeacher({
              name: name,
              username: username,
              password: password,
              subjectIds: subjectIds,
              active: active
            });
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
 * STUDENTS
 * ============================================================ */
async function renderStudents() {
  shell("students", U.loaderHTML());
  try {
    const arr = await Promise.all([
      QP.db.collection("students").get(),
      S.listGroups()
    ]);

    const students = arr[0].docs.map(function (d) {
      return Object.assign({ id: d.id }, d.data());
    });
    const groups = arr[1];
    state.groups = groups;

    const groupName = function (id) {
      const g = groups.find(function (x) { return x.id === id; });
      return g ? g.name : "-";
    };

    const rows = students.length
      ? students.map(function (s) {
        return "<tr>" +
          '<td data-label="\u0627\u0644\u0627\u0633\u0645"><b>' + U.esc(s.name) + "</b></td>" +
          '<td data-label="\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645" class="muted tiny">' + U.esc(s.username) + "</td>" +
          '<td data-label="\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629">' + U.esc(groupName(s.groupId)) + "</td>" +
          '<td data-label="\u0622\u062e\u0631 \u062f\u062e\u0648\u0644" class="tiny">' + U.formatDate(s.lastLoginAt) + "</td>" +
          '<td data-label=""><button class="btn btn-sm btn-danger" data-del-student="' + s.id + '">\uD83D\uDDD1</button></td>' +
          "</tr>";
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
   * EXAMS - عرض الاختبارات
   * ============================================================ */
  async function renderExams() {
    shell("exams", U.loaderHTML());
    try {
      const arr = await Promise.all([S.listExams(), S.listGroups()]);
      const exams = arr[0];
      const groups = arr[1];
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
            '<td data-label="\u0627\u0644\u0639\u0646\u0648\u0627\u0646"><b>' + U.esc(e.title) + "</b>" +
            (e.autoGenerated
              ? ' <span class="badge badge-primary">\u062a\u0644\u0642\u0627\u0626\u064a</span>'
              : "") +
            "<div class='tiny'>" + U.esc(e.subjectName || "-") + "</div></td>" +

            '<td data-label="\u0627\u0644\u0643\u0648\u062f">' +
            '<span class="code-box" style="padding:4px 10px">' +
            '<span class="code" style="font-size:16px">' + U.esc(e.code) + "</span></span></td>" +

            '<td data-label="\u0627\u0644\u0623\u0633\u0626\u0644\u0629">' + (e.questions || []).length + "</td>" +

            '<td data-label="\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a">' + groupsTxt + "</td>" +

            '<td data-label="\u0627\u0644\u062d\u0627\u0644\u0629">' + statusBadge(e.status) + "</td>" +

            '<td data-label="الدفع">' +
            '<label class="check tiny" style="display:block;margin-bottom:4px">' +
            '<input type="checkbox" data-exam-paid="' + e.id + '"' + (e.isPaid ? " checked" : "") + '> مدفوع</label>' +
            (e.isPaid
              ? '<div class="flex" style="gap:6px;align-items:center;flex-wrap:wrap">' +
              '<input type="number" min="0" step="any" data-exam-price="' + e.id + '" value="' + (e.price || "") + '" style="width:90px" placeholder="السعر">' +
              '<span class="tiny muted">' + U.esc(e.currency || "ل.س") + '</span></div>' +
              '<div class="flex" style="gap:6px;align-items:center;margin-top:6px">' +
              '<label class="btn btn-sm btn-ghost" style="cursor:pointer;margin:0">📷 QR' +
              '<input type="file" accept="image/*" data-exam-qr="' + e.id + '" style="display:none"></label>' +
              (e.qrImage
                ? '<img alt="QR" src="' + U.esc(e.qrImage) + '" style="height:40px;border-radius:6px;border:1px solid var(--border)">'
                : '<span class="tiny muted">لا صورة</span>') +
              "</div>"
              : "") +
            "</td>" +

            '<td data-label="\u0625\u062c\u0631\u0627\u0621\u0627\u062a">' +
            '<button class="btn btn-sm" data-copy="' + U.esc(e.code) + '">\uD83D\uDCCB</button> ' +
            '<button class="btn btn-sm" data-res="' + e.id + '">\uD83D\uDCCA</button> ' +
            '<button class="btn btn-sm" data-edit="' + e.id + '">\u270E</button> ' +
            '<button class="btn btn-sm btn-danger" data-del="' + e.id + '">\uD83D\uDDD1</button>' +
            "</td></tr>";
        }).join("")
        : '<tr><td colspan="7" class="table-empty">\u0644\u0627 \u062a\u0648\u062c\u062f \u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a</td></tr>';

      shell("exams",
        '<div class="card-head"><h2>\u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a</h2>' +
        '<div class="spacer"></div>' +
        '<button class="btn btn-primary" id="newExam">+ \u0627\u062e\u062a\u0628\u0627\u0631</button></div>' +

        '<div class="table-wrap responsive"><table><thead><tr>' +
        '<th>\u0627\u0644\u0639\u0646\u0648\u0627\u0646</th><th>\u0627\u0644\u0643\u0648\u062f</th><th>\u0627\u0644\u0623\u0633\u0626\u0644\u0629</th><th>\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a</th><th>\u0627\u0644\u062d\u0627\u0644\u0629</th><th>الدفع</th><th></th>' +
        "</tr></thead><tbody>" + rows + "</tbody></table></div>"
      );

      document.getElementById("newExam").addEventListener("click", function () {
        examWizard(null);
      });

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

      /* ===== التحكم بالدفع (مدفوع/مجاني + السعر + رمز QR) ===== */
      document.querySelectorAll("[data-exam-paid]").forEach(function (cb) {
        cb.addEventListener("change", async function () {
          const id = cb.dataset.examPaid;
          const paid = cb.checked;
          try {
            await S.updateExamMeta(id, { isPaid: paid });
            if (paid) U.toast("تم تعيين الاختبار مدفوعاً — حدّد السعر وارفع رمز QR", "info", 4000);
            renderExams();
          } catch (e) {
            U.toast("تعذّر الحفظ: " + (e && e.message || e), "error", 4000);
            renderExams();
          }
        });
      });

      document.querySelectorAll("[data-exam-price]").forEach(function (inp) {
        inp.addEventListener("change", async function () {
          try {
            await S.updateExamMeta(inp.dataset.examPrice, { price: Number(inp.value) || 0 });
            U.toast("تم حفظ السعر", "success", 1500);
          } catch (e) {
            U.toast("تعذّر حفظ السعر: " + (e && e.message || e), "error", 3000);
          }
        });
      });

      document.querySelectorAll("[data-exam-qr]").forEach(function (f) {
        f.addEventListener("change", async function () {
          const file = f.files && f.files[0];
          if (!file) return;
          try {
            const dataUrl = await U.fileToDataURL(file, 512);
            await S.updateExamMeta(f.dataset.examQr, { qrImage: dataUrl });
            U.toast("تم حفظ صورة رمز الدفع ✓", "success", 2000);
            renderExams();
          } catch (e) {
            U.toast("تعذّر رفع الصورة: " + (e && e.message || e), "error", 4000);
          }
        });
      });
    } catch (e) {
      shell("exams", errorCard(e));
    }
  }

  /* ============================================================
   * EXAM WIZARD v6 - مع الفلاتر المنسدلة (Dropdowns + Chips)
   * ============================================================ */
  function examWizard(exam) {
    const isEdit = !!exam;
    const chosen = [];
    const selectedIds = {};
    let qrImage = (exam && exam.qrImage) || "";

    /* الفلاتر المتعددة */
    const selectedUnits = new Set();
    const selectedLessons = new Set();
    const selectedTypes = new Set();

    /* استرجاع الأسئلة المحفوظة عند التعديل */
    if (isEdit && exam.questions) {
      exam.questions.forEach(function (q) {
        chosen.push(Object.assign({}, q));
        if (q._sourceId) selectedIds[q._sourceId] = true;
      });
    }

    /* استرجاع الفلاتر السابقة */
    const prevFilter = (exam && exam.filterCriteria) || {};
    if (prevFilter.units) prevFilter.units.forEach(function (u) { selectedUnits.add(u); });
    if (prevFilter.lessons) prevFilter.lessons.forEach(function (l) { selectedLessons.add(l); });
    if (prevFilter.types) prevFilter.types.forEach(function (t) { selectedTypes.add(t); });

    U.modal({
      title: isEdit ? "\u270F\uFE0F \u062a\u0639\u062f\u064a\u0644 \u0627\u062e\u062a\u0628\u0627\u0631" : "\uD83C\uDD95 \u0627\u062e\u062a\u0628\u0627\u0631 \u062c\u062f\u064a\u062f",
      size: "xl",
      body:
        /* ===== 1. معلومات أساسية ===== */
        '<div class="form-row">' +
        '<div class="field"><label>\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 *</label>' +
        '<input id="exTitle" value="' + U.esc(exam ? exam.title : "") + '" placeholder="\u0645\u062b\u0627\u0644: \u0627\u062e\u062a\u0628\u0627\u0631 \u0627\u0644\u0648\u062d\u062f\u0629 \u0627\u0644\u0623\u0648\u0644\u0649"></div>' +

        '<div class="field"><label>\u0627\u0644\u0645\u0627\u062f\u0629 *</label><select id="exSubj">' +
        '<option value="">\u2014 \u0627\u062e\u062a\u0631 \u0645\u0627\u062f\u0629 \u2014</option>' +
        state.subjects.map(function (s) {
          return '<option value="' + s.id + '"' +
            (exam && exam.subjectId === s.id ? " selected" : "") + ">" +
            U.esc(s.name) + "</option>";
        }).join("") +
        "</select></div></div>" +

        '<div class="field"><label>\u0627\u0644\u0648\u0635\u0641 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)</label>' +
        '<input id="exDesc" value="' + U.esc(exam ? exam.description : "") + '" placeholder="\u0648\u0635\u0641 \u0645\u062e\u062a\u0635\u0631"></div>' +

        /* ===== 2. الإعدادات ===== */
        '<div class="form-row-3">' +
        '<div class="field"><label>\u23F1 \u0627\u0644\u0645\u062f\u0629 (\u062f\u0642\u064a\u0642\u0629\u060c 0 = \u0628\u062f\u0648\u0646 \u0648\u0642\u062a)</label>' +
        '<input type="number" id="exDur" min="0" value="' + (exam ? exam.durationMin || 0 : 30) + '"></div>' +

        '<div class="field"><label>\uD83D\uDCC5 \u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0641\u062a\u062d (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)</label>' +
        '<input type="datetime-local" id="exOpenAt" value="' + (exam && exam.openAt ? exam.openAt.slice(0, 16) : "") + '"></div>' +

        '<div class="field"><label>\uD83D\uDCC5 \u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0625\u063a\u0644\u0627\u0642 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)</label>' +
        '<input type="datetime-local" id="exCloseAt" value="' + (exam && exam.closeAt ? exam.closeAt.slice(0, 16) : "") + '"></div>' +
        "</div>" +

        '<div class="form-row-3">' +
        '<div class="field"><label>\uD83C\uDFAF \u0646\u0633\u0628\u0629 \u0627\u0644\u0646\u062c\u0627\u062d %</label>' +
        '<input type="number" id="exPass" min="0" max="100" value="' +
        (exam && exam.settings ? exam.settings.passScore || 50 : 50) + '"></div>' +

        '<label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" id="shuffleQuestions"' +
        (exam && exam.settings && exam.settings.shuffleQuestions ? " checked" : "") +
        '> \uD83D\uDD00 \u062a\u0631\u062a\u064a\u0628 \u0639\u0634\u0648\u0627\u0626\u064a</label>' +

        '<label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" id="allowReview"' +
        (exam && exam.settings && exam.settings.allowReview !== false ? " checked" : "") +
        '> \uD83D\uDC41\uFE0F \u0627\u0644\u0633\u0645\u0627\u062d \u0628\u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629</label>' +
        "</div>" +

        '<div class="hr"></div>' +

        /* ===== الإعداد المالي / الدفع ===== */
        '<h3 style="margin:0 0 10px">💳 الدفع</h3>' +
        '<div class="form-row-3">' +
        '<label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" id="exPaid"' +
        (exam && exam.isPaid ? " checked" : "") + '> اختبار مدفوع</label>' +
        '<div class="field"><label>سعر الاختبار</label>' +
        '<input type="number" id="exPrice" min="0" step="any" value="' +
        (exam && exam.price ? exam.price : "") + '" placeholder="0"></div>' +
        '<div class="field"><label>العملة</label>' +
        '<input id="exCurrency" value="' + U.esc(exam && exam.currency ? exam.currency : "ل.س") + '"></div>' +
        "</div>" +
        '<div class="field" id="exQrWrap"><label>📷 صورة رمز الدفع (QR)</label>' +
        '<div class="flex" style="gap:10px;align-items:center;flex-wrap:wrap">' +
        '<input type="file" id="exQrFile" accept="image/*" style="max-width:240px">' +
        '<button type="button" class="btn btn-sm btn-ghost" id="exQrClear">🗑 مسح الصورة</button>' +
        '<span id="exQrStatus" class="tiny muted"></span>' +
        "</div>" +
        '<div id="exQrPreview" class="mt" style="display:' + (qrImage ? "block" : "none") + '">' +
        '<img alt="QR" style="max-width:160px;border-radius:10px;border:1px solid var(--border)" src="' +
        U.esc(qrImage) + '"></div>' +
        "</div>" +

        '<div class="hr"></div>' +

        /* ===== 3. المجموعات المستهدفة ===== */
        '<h3 style="margin:0 0 10px">\uD83C\uDFAF \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u0647\u062f\u0641\u0629</h3>' +
        '<div id="groupsBox" class="mb"></div>' +

        '<div class="hr"></div>' +

        /* ===== 4. الفلاتر المنسدلة ===== */
        '<h3 style="margin:0 0 10px">\uD83D\uDD0D \u0627\u0644\u0641\u0644\u062a\u0631\u0629 \u0627\u0644\u0645\u062a\u0642\u062f\u0645\u0629</h3>' +

        '<div class="card filters-panel" style="background:var(--surface-2);padding:16px;border-radius:14px;margin-bottom:14px">' +

        '<div class="filter-hint" id="filterHint">\u2B06 \u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0627\u062f\u0629 \u0623\u0648\u0644\u0627\u064B \u0644\u0639\u0631\u0636 \u0627\u0644\u0648\u062d\u062f\u0627\u062a \u0648\u0627\u0644\u062f\u0631\u0648\u0633</div>' +

        /* الوحدات */
        '<div class="multi-filter" data-filter="units">' +
        '<div class="multi-filter-head">' +
        '<label>\uD83D\uDCD6 \u0627\u0644\u0648\u062d\u062f\u0627\u062a</label>' +
        '<div class="multi-filter-actions">' +
        '<button type="button" class="btn-mini" data-action="toggle-all" data-target="units">\u2713 \u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0643\u0644</button>' +
        '<button type="button" class="btn-mini" data-action="clear" data-target="units">\u2715 \u0645\u0633\u062d</button>' +
        "</div></div>" +

        '<div class="multi-filter-select">' +
        '<button type="button" class="dropdown-trigger" data-dropdown="units">' +
        '<span class="dropdown-placeholder">-- \u0627\u062e\u062a\u0631 \u0627\u0644\u0648\u062d\u062f\u0629 --</span>' +
        '<span class="dropdown-arrow">\u25BE</span>' +
        "</button>" +
        '<div class="dropdown-menu" data-menu="units">' +
        '<div class="dropdown-empty">\u0644\u0627 \u062a\u0648\u062c\u062f \u0648\u062d\u062f\u0627\u062a \u0645\u062a\u0627\u062d\u0629</div>' +
        "</div></div>" +

        '<div class="multi-filter-chips" id="chips-units">' +
        '<span class="chips-empty">\u0644\u0645 \u062a\u062e\u062a\u0631 \u0623\u064a \u0648\u062d\u062f\u0629</span>' +
        "</div></div>" +

        /* الدروس */
        '<div class="multi-filter" data-filter="lessons">' +
        '<div class="multi-filter-head">' +
        '<label>\uD83D\uDCDD \u0627\u0644\u062f\u0631\u0648\u0633</label>' +
        '<div class="multi-filter-actions">' +
        '<button type="button" class="btn-mini" data-action="toggle-all" data-target="lessons">\u2713 \u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0643\u0644</button>' +
        '<button type="button" class="btn-mini" data-action="clear" data-target="lessons">\u2715 \u0645\u0633\u062d</button>' +
        "</div></div>" +

        '<div class="multi-filter-select">' +
        '<button type="button" class="dropdown-trigger" data-dropdown="lessons">' +
        '<span class="dropdown-placeholder">-- \u0627\u062e\u062a\u0631 \u0627\u0644\u062f\u0631\u0633 --</span>' +
        '<span class="dropdown-arrow">\u25BE</span>' +
        "</button>" +
        '<div class="dropdown-menu" data-menu="lessons">' +
        '<div class="dropdown-empty">\u0644\u0627 \u062a\u0648\u062c\u062f \u062f\u0631\u0648\u0633 \u0645\u062a\u0627\u062d\u0629</div>' +
        "</div></div>" +

        '<div class="multi-filter-chips" id="chips-lessons">' +
        '<span class="chips-empty">\u0644\u0645 \u062a\u062e\u062a\u0631 \u0623\u064a \u062f\u0631\u0633</span>' +
        "</div></div>" +

        /* الأنواع */
        '<div class="multi-filter" data-filter="types">' +
        '<div class="multi-filter-head">' +
        '<label>\uD83D\uDCCB \u0646\u0648\u0639 \u0627\u0644\u0633\u0624\u0627\u0644</label>' +
        '<div class="multi-filter-actions">' +
        '<button type="button" class="btn-mini" data-action="toggle-all" data-target="types">\u2713 \u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0643\u0644</button>' +
        '<button type="button" class="btn-mini" data-action="clear" data-target="types">\u2715 \u0645\u0633\u062d</button>' +
        "</div></div>" +

        '<div class="multi-filter-select">' +
        '<button type="button" class="dropdown-trigger" data-dropdown="types">' +
        '<span class="dropdown-placeholder">-- \u0627\u062e\u062a\u0631 \u0627\u0644\u0646\u0648\u0639 --</span>' +
        '<span class="dropdown-arrow">\u25BE</span>' +
        "</button>" +
        '<div class="dropdown-menu" data-menu="types">' +
        '<div class="dropdown-empty">\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u0646\u0648\u0627\u0639</div>' +
        "</div></div>" +

        '<div class="multi-filter-chips" id="chips-types">' +
        '<span class="chips-empty">\u0644\u0645 \u062a\u062e\u062a\u0631 \u0623\u064a \u0646\u0648\u0639</span>' +
        "</div></div>" +

        "</div>" +

        /* ===== 5. التوزيع الذكي ===== */
        '<div class="card" style="background:var(--surface-2);padding:14px;border-radius:12px;margin-bottom:14px">' +
        '<div class="flex" style="justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<h4 style="margin:0">\uD83C\uDF9A\uFE0F \u0627\u0644\u062a\u0648\u0632\u064a\u0639 \u0627\u0644\u0630\u0643\u064a \u062d\u0633\u0628 \u0627\u0644\u0635\u0639\u0648\u0628\u0629</h4>' +
        '<label class="check" style="padding:0"><input type="checkbox" id="useDist" checked> \u062a\u0641\u0639\u064a\u0644</label>' +
        "</div>" +

        '<div id="distBox">' +

        '<div class="dist-row">' +
        '<span class="dist-label">\uD83D\uDFE2 \u0633\u0647\u0644</span>' +
        '<input type="number" id="distEasy" min="0" value="' + (prevFilter.distEasy || 0) + '">' +
        '<span class="dist-available" id="availEasy">-</span>' +
        "</div>" +

        '<div class="dist-row">' +
        '<span class="dist-label">\uD83D\uDFE1 \u0645\u062a\u0648\u0633\u0637</span>' +
        '<input type="number" id="distMedium" min="0" value="' + (prevFilter.distMedium || 0) + '">' +
        '<span class="dist-available" id="availMedium">-</span>' +
        "</div>" +

        '<div class="dist-row">' +
        '<span class="dist-label">\uD83D\uDD34 \u0635\u0639\u0628</span>' +
        '<input type="number" id="distHard" min="0" value="' + (prevFilter.distHard || 0) + '">' +
        '<span class="dist-available" id="availHard">-</span>' +
        "</div>" +

        '<div class="flex" style="margin-top:10px;justify-content:space-between;align-items:center">' +
        '<div><b>\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a:</b> <span id="distTotal">0</span> \u0633\u0624\u0627\u0644</div>' +
        '<div class="flex" style="gap:6px">' +
        '<button type="button" class="btn-mini" id="distEqual">\u2696\uFE0F \u0645\u062a\u0633\u0627\u0648\u064a</button>' +
        '<button type="button" class="btn-mini" id="distClear">\u2715 \u0635\u0641\u0631</button>' +
        "</div></div>" +

        '<div class="field mt-sm" style="margin-bottom:0">' +
        '<label class="tiny">\u0639\u062f\u062f \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0643\u0644\u064a (0 = \u0627\u0644\u0643\u0644)</label>' +
        '<input type="number" id="exMax" min="0" placeholder="0 = \u0643\u0644 \u0627\u0644\u0623\u0633\u0626\u0644\u0629" value="' + (prevFilter.max || 0) + '">' +
        "</div>" +
        "</div>" +

        '<div id="distOffMsg" class="hidden" style="text-align:center;color:var(--text-3);padding:10px">' +
        '\u0627\u0644\u062a\u0648\u0632\u064a\u0639 \u0627\u0644\u0630\u0643\u064a \u0645\u062a\u0648\u0642\u0641 \u2014 \u0633\u064a\u062a\u0645 \u0623\u062e\u0630 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0639\u0634\u0648\u0627\u0626\u064a\u0627\u064B' +
        "</div>" +
        "</div>" +

        /* ===== 5ب. تحديد عدد الأسئلة حسب النوع ===== */
        '<div class="card" style="background:var(--surface-2);padding:14px;border-radius:12px;margin-bottom:14px">' +
        '<div class="flex" style="justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<h4 style="margin:0">\uD83C\uDFAF \u062a\u062d\u062f\u064a\u062f \u0639\u062f\u062f \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u062d\u0633\u0628 \u0627\u0644\u0646\u0648\u0639</h4>' +
        '<div class="flex" style="gap:6px">' +
        '<button type="button" class="btn-mini" id="typeModelPreset" title="8 \u0627\u062e\u062a\u064a\u0627\u0631 + 13 \u0642\u0635\u064a\u0631\u0629 + 6 \u0641\u0631\u0627\u063a\u0627\u062a + 2 \u0645\u0642\u0627\u0644\u064a">\uD83D\uDCCB \u062a\u0648\u0632\u064a\u0639 \u0627\u0644\u0646\u0645\u0648\u0630\u062c</button>' +
        '<button type="button" class="btn-mini" id="typeCountAuto">\u2696\uFE0F \u062a\u0648\u0632\u064a\u0639 \u0645\u062a\u0648\u0627\u0632\u0646</button>' +
        "</div>" +
        "</div>" +
        '<div id="typeCountBox" class="mb"></div>' +
        '<button type="button" class="btn btn-primary" id="fetchByTypeBtn" style="width:100%">\u2795 \u062c\u0644\u0628 \u062d\u0633\u0628 \u0627\u0644\u0623\u0646\u0648\u0627\u0639</button>' +
        '<p class="tiny muted mb" id="typeCountHint" style="text-align:center;margin-top:8px">\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0627\u062f\u0629 \u0648\u0627\u0644\u0641\u0644\u0627\u062a\u0631 \u062b\u0645 \u0623\u062f\u062e\u0644 \u0627\u0644\u0639\u062f\u062f \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0645\u0646 \u0643\u0644 \u0646\u0648\u0639</p>' +
        "</div>" +

        /* ===== 6. أزرار الجلب ===== */
        '<div class="flex flex-wrap mb" style="gap:8px">' +
        '<button type="button" class="btn btn-primary" id="fetchBtn" style="flex:1">\uD83D\uDD0D \u062c\u0644\u0628 \u0627\u0644\u0623\u0633\u0626\u0644\u0629</button>' +
        '<button type="button" class="btn" id="selectAllBtn">\u2713 \u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0643\u0644</button>' +
        '<button type="button" class="btn" id="clearBtn">\u2715 \u0645\u0633\u062d \u0627\u0644\u062a\u062d\u062f\u064a\u062f</button>' +
        "</div>" +

        '<div id="fetchInfo" class="tiny muted mb" style="text-align:center"></div>' +

        /* ===== 7. قائمة الأسئلة ===== */
        '<div id="qList" class="auto-exam-list">' +
        '<p class="muted center" style="padding:30px">' +
        '\uD83D\uDC49 \u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0627\u062f\u0629 \u0648\u0627\u0644\u0641\u0644\u0627\u062a\u0631 \u062b\u0645 \u0627\u0636\u063a\u0637 "\u062c\u0644\u0628 \u0627\u0644\u0623\u0633\u0626\u0644\u0629"' +
        "</p></div>" +

        /* ===== 8. الأسئلة المختارة (الترتيب) ===== */
        '<div class="card" style="background:var(--surface-2);padding:14px;border-radius:12px;margin-top:6px">' +
        '<div class="flex" style="justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px">' +
        '<h4 style="margin:0">\uD83D\uDCCB \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0645\u062e\u062a\u0627\u0631\u0629</h4>' +
        '<span class="tiny muted">\u2191\u2193 \u064a\u0638\u0647\u0631 \u0644\u0644\u0637\u0644\u0627\u0628 \u0628\u0647\u0630\u0627 \u0627\u0644\u062a\u0631\u062a\u064a\u0628 \u0625\u0646 \u0644\u0645 \u064a\u064f\u0641\u0639\u0651\u0644 \u0627\u0644\u062a\u0631\u062a\u064a\u0628 \u0627\u0644\u0639\u0634\u0648\u0627\u0626\u064a</span>' +
        "</div>" +
        '<div id="chosenListBox"></div>' +
        '<div id="chosenSections" class="section-strip"></div>' +
        "</div>",

      footer:
        '<div class="flex" style="width:100%;gap:10px">' +
        '<span class="badge badge-primary" id="chosenCount">0 \u0633\u0624\u0627\u0644</span>' +
        '<span class="badge badge-muted" id="chosenPoints">0 \u062f\u0631\u062c\u0629</span>' +
        '<div class="spacer"></div>' +
        '<button class="btn btn-primary" data-save>' +
        (isEdit ? "\uD83D\uDCBE \u062d\u0641\u0638" : "\uD83D\uDCBE \u0625\u0646\u0634\u0627\u0621") +
        "</button>" +
        '<button class="btn btn-ghost" data-close>\u0625\u0644\u063a\u0627\u0621</button>' +
        "</div>",

      onMount: function (node, close) {
        const listBox = node.querySelector("#qList");
        const fetchInfo = node.querySelector("#fetchInfo");
        const filterHint = node.querySelector("#filterHint");
        let availableQuestions = [];

        /* ============================================================
         * بيانات الفلاتر
         * ============================================================ */
        const filterData = {
          units: [],
          lessons: [],
          types: []
        };

        /* ============================================================
         * تحديث الإحصائيات
         * ============================================================ */
        const updateStats = function () {
          const pts = chosen.reduce(function (s, q) {
            return s + (Number(q.points) || 1);
          }, 0);
          node.querySelector("#chosenCount").textContent = chosen.length + " \u0633\u0624\u0627\u0644";
          node.querySelector("#chosenPoints").textContent = pts + " \u062f\u0631\u062c\u0629";
          renderChosenSections();
        };

        /* ============================================================
         * ملخص الأسئلة المختارة حسب القسم (أقسام النموذج)
         * ============================================================ */
        const renderChosenSections = function () {
          const box = node.querySelector("#chosenSections");
          if (!box) return;
          const counts = {};
          chosen.forEach(function (q) {
            const s = U.sectionOf(q);
            if (s) counts[s] = (counts[s] || 0) + 1;
          });
          const keys = Object.keys(counts);
          if (!keys.length) { box.innerHTML = ""; return; }
          keys.sort(function (a, b) {
            return U.SECTION_ORDER.indexOf(a) - U.SECTION_ORDER.indexOf(b);
          });
          box.innerHTML = '<span class="section-strip-title">\u062d\u0633\u0628 \u0627\u0644\u0642\u0633\u0645:</span>' +
            keys.map(function (s) {
              const target = U.SECTION_TARGETS ? U.SECTION_TARGETS[s] : null;
              return '<span class="sec-chip" title="' +
                (target ? "\u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0641\u064a \u0627\u0644\u0646\u0645\u0648\u0630\u062c: " + target : U.esc(s)) +
                '">' + U.esc(s) + " <b>" + counts[s] + "</b>" +
                (target ? '<span class="sec-target">/' + target + "</span>" : "") +
                "</span>";
            }).join("");
        };

        /* ============================================================
         * تحديد عدد الأسئلة حسب النوع
         * ============================================================ */
        const TYPE_ORDER = ["mcq", "multi", "true_false", "fill_blank", "short_answer", "essay"];

        const typePoolForCounts = function () {
          return availableQuestions.filter(function (q) {
            if (selectedUnits.size > 0) {
              let m = false;
              if (q.unitNumber !== null && q.unitNumber !== undefined) {
                if (selectedUnits.has("u:" + q.unitNumber)) m = true;
              }
              if (q.unitTitle && selectedUnits.has("ut:" + q.unitTitle)) m = true;
              if (!m) return false;
            }
            if (selectedLessons.size > 0) {
              if (!q.lessonTitle || !selectedLessons.has(q.lessonTitle)) return false;
            }
            return true;
          });
        };

        const renderTypeCounts = function () {
          const box = node.querySelector("#typeCountBox");
          if (!box) return;
          const prev = {};
          box.querySelectorAll("[data-tcount]").forEach(function (inp) {
            prev[inp.dataset.tcount] = inp.value;
          });
          const pool = typePoolForCounts();
          const counts = {};
          pool.forEach(function (q) { counts[q.type] = (counts[q.type] || 0) + 1; });
          const keys = Object.keys(counts);
          if (!keys.length) {
            box.innerHTML = '<div class="drop-empty">\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u0633\u0626\u0644\u0629 \u0644\u0647\u0630\u0647 \u0627\u0644\u0641\u0644\u0627\u062a\u0631</div>';
            return;
          }
          keys.sort(function (a, b) {
            const ia = TYPE_ORDER.indexOf(a);
            const ib = TYPE_ORDER.indexOf(b);
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
          });
          box.innerHTML = keys.map(function (t) {
            const val = prev[t] !== undefined ? prev[t] : "0";
            return '<div class="dist-row">' +
              '<span class="dist-label">' + U.esc(U.TYPE_LABELS[t] || t) + "</span>" +
              '<input type="number" id="tcnt-' + t + '" data-tcount="' + t + '" min="0" value="' + val + '">' +
              '<span class="dist-available">\u0645\u062a\u0627\u062d: ' + counts[t] + "</span>" +
              "</div>";
          }).join("");
        };

        const syncCheckboxes = function () {
          node.querySelectorAll("[data-qid]").forEach(function (cb) {
            cb.checked = !!selectedIds[cb.dataset.qid];
          });
        };

        const renderChosenList = function () {
          const box = node.querySelector("#chosenListBox");
          if (!box) return;
          if (!chosen.length) {
            box.innerHTML = '<p class="tiny muted center" style="padding:6px">\u0644\u0645 \u064a\u062e\u062a\u0631 \u0623\u064a \u0633\u0624\u0627\u0644 \u0628\u0639\u062f</p>';
            syncCheckboxes();
            return;
          }
          box.innerHTML = chosen.map(function (q, i) {
            return '<div class="chosen-row" data-ri="' + i + '">' +
              '<span class="chosen-idx">' + (i + 1) + "</span>" +
              '<div class="chosen-body">' + U.badgeForType(q.type) +
              (U.sectionBadge(q) ? " " + U.sectionBadge(q) : "") +
              (q.passage ? ' <span class="badge badge-passage" title="\u0645\u0631\u0641\u0642 \u0628\u0646\u0635">\uD83D\uDCDC</span>' : "") +
              '<div class="chosen-text">' + U.esc(q.text) + "</div></div>" +
              '<div class="chosen-actions">' +
              '<button type="button" class="icon-btn sm" data-move="up" title="\u0623\u0639\u0644\u0649">\u2191</button>' +
              '<button type="button" class="icon-btn sm" data-move="down" title="\u0623\u0633\u0641\u0644">\u2193</button>' +
              '<button type="button" class="icon-btn sm danger" data-rm title="\u0625\u0632\u0627\u0644\u0629">\u2715</button>' +
              "</div></div>";
          }).join("");

          box.querySelectorAll("[data-move]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              const ri = Number(btn.closest(".chosen-row").dataset.ri);
              const dir = btn.dataset.move;
              const tgt = dir === "up" ? ri - 1 : ri + 1;
              if (tgt < 0 || tgt >= chosen.length) return;
              const tmp = chosen[ri];
              chosen[ri] = chosen[tgt];
              chosen[tgt] = tmp;
              renderChosenList();
              updateStats();
            });
          });

          box.querySelectorAll("[data-rm]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              const ri = Number(btn.closest(".chosen-row").dataset.ri);
              const q = chosen[ri];
              if (q && q._sourceId) delete selectedIds[q._sourceId];
              chosen.splice(ri, 1);
              renderChosenList();
              updateStats();
            });
          });

          syncCheckboxes();
        };

        const fetchByType = function () {
          const subjectId = node.querySelector("#exSubj").value;
          if (!subjectId) return U.toast("\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0627\u062f\u0629 \u0623\u0648\u0644\u0627\u064b", "warn");

          const pool = typePoolForCounts();
          const byType = {};
          pool.forEach(function (q) {
            (byType[q.type] = byType[q.type] || []).push(q);
          });

          const picked = [];
          let totalPicked = 0;

          TYPE_ORDER.forEach(function (type) {
            const el = node.querySelector('[data-tcount="' + type + '"]');
            const want = Number(el ? el.value : 0) || 0;
            const arr = byType[type] || [];
            if (!want) return;
            const shuffled = arr.slice().sort(function () { return Math.random() - 0.5; });
            let got = 0;
            shuffled.forEach(function (q) {
              if (got >= want) return;
              if (selectedIds[q.id]) return;
              selectedIds[q.id] = true;
              chosen.push({
                type: q.type,
                text: q.text,
                options: q.options || [],
                answer: q.answer,
                difficulty: q.difficulty,
                explanation: q.explanation || "",
                points: q.points || 1,
                passage: q.passage || null,
                tags: q.tags || [],
                _sourceId: q.id,
                unitNumber: q.unitNumber,
                unitTitle: q.unitTitle,
                lessonTitle: q.lessonTitle
              });
              picked.push(q);
              got++;
            });
            totalPicked += got;
          });

          if (totalPicked) {
            renderQuestionList(picked);
            fetchInfo.textContent = "\u2705 \u062a\u0645\u062a \u0625\u0636\u0627\u0641\u0629 " + totalPicked + " \u0633\u0624\u0627\u0644\u0627\u064b \u062d\u0633\u0628 \u0627\u0644\u0623\u0646\u0648\u0627\u0639";
          } else {
            U.toast("\u0623\u062f\u062e\u0644 \u0639\u062f\u062f\u0627\u064b \u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u0635\u0641\u0631 \u0648\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0627\u062f\u0629/\u0627\u0644\u0641\u0644\u0627\u062a\u0631", "warn");
          }
          renderChosenList();
          updateStats();
        };

        const typeAutoBalance = function () {
          const pool = typePoolForCounts();
          if (!pool.length) return U.toast("\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u0633\u0626\u0644\u0629 \u0645\u062a\u0627\u062d\u0629", "warn");
          const byType = {};
          pool.forEach(function (q) { (byType[q.type] = byType[q.type] || []).push(q); });
          const keys = Object.keys(byType).filter(function (t) { return byType[t].length > 0; });

          const exMax = Number(node.querySelector("#exMax").value) || 0;
          const wantTotal = exMax && exMax < pool.length ? exMax : pool.length;

          const counts = {};
          keys.forEach(function (t) { counts[t] = 0; });

          let remaining = wantTotal;
          let rounds = 0;
          while (remaining > 0 && rounds < keys.length * 3) {
            rounds++;
            for (let i = 0; i < keys.length; i++) {
              if (remaining <= 0) break;
              const t = keys[i];
              if (counts[t] < byType[t].length) {
                counts[t]++;
                remaining--;
              }
            }
          }
          if (remaining > 0) {
            for (let i = 0; i < keys.length && remaining > 0; i++) {
              const t = keys[i];
              const can = byType[t].length - counts[t];
              const add = Math.min(can, remaining);
              counts[t] += add;
              remaining -= add;
            }
          }

          keys.forEach(function (t) {
            const el = node.querySelector('[data-tcount="' + t + '"]');
            if (el) el.value = counts[t];
          });
          U.toast("\u2705 \u062a\u0648\u0632\u064a\u0639 " + wantTotal + " \u0633\u0624\u0627\u0644\u0627\u064b \u062d\u0633\u0628 \u0627\u0644\u062a\u0648\u0641\u0631 \u2014 \u0627\u0636\u063a\u0637 \u00ab\u062c\u0644\u0628 \u062d\u0633\u0628 \u0627\u0644\u0623\u0646\u0648\u0627\u0639\u00bb", "success", 4000);
        };

        /* ============================================================
         * المجموعات المستهدفة
         * ============================================================ */
        const renderGroupsBox = function () {
          const groups = state.groups || [];
          const target = (exam && exam.targetGroups) || [];
          const box = node.querySelector("#groupsBox");

          if (!groups.length) {
            box.innerHTML = '<p class="muted">\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u062c\u0645\u0648\u0639\u0627\u062a \u2014 \u0623\u0646\u0634\u0626\u0647\u0627 \u0645\u0646 \u0642\u0633\u0645 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a</p>';
            return;
          }

          let html = '<label class="check mb"><input type="checkbox" id="gAll"' +
            (target.indexOf("ALL") >= 0 ? " checked" : "") +
            '> <b>\uD83C\uDFAF \u062c\u0645\u064a\u0639 \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a</b></label>';

          html += '<div class="flex flex-wrap">';

          groups.forEach(function (g) {
            const checked = target.indexOf(g.id) >= 0;
            html += '<label class="check" style="padding:6px 10px;background:var(--surface-2);border-radius:8px;margin:3px">' +
              '<input type="checkbox" class="grp-check" value="' + g.id + '"' +
              (checked ? " checked" : "") + "> " +
              U.esc(g.name) +
              ' <span class="tiny muted">(' + (g.studentCount || 0) + ')</span>' +
              "</label>";
          });

          html += "</div>";
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
              cb.checked = true;
              cb.disabled = true;
            });
          }
        };
        renderGroupsBox();
        renderChosenList();

        /* ============================================================
         * renderChips - عرض الاختيارات المحددة كـ chips
         * ============================================================ */
        const renderChips = function (kind) {
          const chipsBox = node.querySelector("#chips-" + kind);
          if (!chipsBox) return;

          const selected = kind === "units" ? selectedUnits
            : kind === "lessons" ? selectedLessons
              : selectedTypes;
          const data = filterData[kind];

          if (selected.size === 0) {
            chipsBox.innerHTML = '<span class="chips-empty">\u0644\u0645 \u062a\u062e\u062a\u0631 \u0623\u064a ' +
              (kind === "units" ? "\u0648\u062d\u062f\u0629"
                : kind === "lessons" ? "\u062f\u0631\u0633"
                  : "\u0646\u0648\u0639") + '</span>';
            return;
          }

          chipsBox.innerHTML = Array.from(selected).map(function (key) {
            const item = data.find(function (x) { return x.key === key; });
            const label = item ? item.label : key;
            return '<span class="chip-selected" data-chip-kind="' + kind + '" data-chip-key="' + U.esc(key) + '">' +
              '<span>' + U.esc(label) + '</span>' +
              '<button type="button" class="chip-remove" aria-label="\u062d\u0630\u0641">\u2715</button>' +
              '</span>';
          }).join("");

          /* ربط أزرار الحذف */
          chipsBox.querySelectorAll(".chip-remove").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
              e.stopPropagation();
              const chip = btn.closest(".chip-selected");
              const key = chip.dataset.chipKey;

              if (kind === "units") selectedUnits.delete(key);
              else if (kind === "lessons") selectedLessons.delete(key);
              else selectedTypes.delete(key);

              /* حدّث checkbox في القائمة */
              const cb = node.querySelector('input[data-menu-kind="' + kind + '"][value="' +
                CSS.escape(key) + '"]');
              if (cb) cb.checked = false;

              renderChips(kind);
              updateAvailableCounts();
            });
          });
        };

        /* ============================================================
         * buildDropdown - بناء قائمة منسدلة
         * ============================================================ */
        const buildDropdown = function (kind) {
          const menu = node.querySelector('[data-menu="' + kind + '"]');
          if (!menu) return;

          const data = filterData[kind];
          const selected = kind === "units" ? selectedUnits
            : kind === "lessons" ? selectedLessons
              : selectedTypes;

          if (!data.length) {
            menu.innerHTML = '<div class="dropdown-empty">' +
              (kind === "units" ? "\u0644\u0627 \u062a\u0648\u062c\u062f \u0648\u062d\u062f\u0627\u062a"
                : kind === "lessons" ? "\u0644\u0627 \u062a\u0648\u062c\u062f \u062f\u0631\u0648\u0633"
                  : "\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u0646\u0648\u0627\u0639") +
              '</div>';
            return;
          }

          menu.innerHTML = data.map(function (item) {
            const checked = selected.has(item.key) ? " checked" : "";
            return '<label class="dropdown-item">' +
              '<input type="checkbox" data-menu-kind="' + kind + '" value="' + U.esc(item.key) + '"' + checked + '>' +
              '<span class="dropdown-item-label">' + U.esc(item.label) + '</span>' +
              (item.count !== undefined
                ? '<span class="dropdown-item-count">' + item.count + '</span>'
                : "") +
              '</label>';
          }).join("");

          /* ربط الـ checkboxes */
          menu.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
            cb.addEventListener("change", function () {
              const key = cb.value;
              if (cb.checked) {
                if (kind === "units") selectedUnits.add(key);
                else if (kind === "lessons") selectedLessons.add(key);
                else selectedTypes.add(key);
              } else {
                if (kind === "units") selectedUnits.delete(key);
                else if (kind === "lessons") selectedLessons.delete(key);
                else selectedTypes.delete(key);
              }
              renderChips(kind);
              updateAvailableCounts();
            });
          });
        };

        /* ============================================================
         * renderAllFilters - تحديث كل القوائم
         * ============================================================ */
        const renderAllFilters = function () {
          ["units", "lessons", "types"].forEach(function (kind) {
            buildDropdown(kind);
            renderChips(kind);
          });
        };

        /* ============================================================
         * closeAllDropdowns
         * ============================================================ */
        const closeAllDropdowns = function () {
          node.querySelectorAll(".dropdown-trigger").forEach(function (b) {
            b.classList.remove("open");
          });
          node.querySelectorAll(".dropdown-menu").forEach(function (m) {
            m.classList.remove("show");
          });
        };

        /* ============================================================
         * ربط dropdown triggers
         * ============================================================ */
        node.querySelectorAll(".dropdown-trigger").forEach(function (trigger) {
          trigger.addEventListener("click", function (e) {
            e.stopPropagation();
            const kind = trigger.dataset.dropdown;
            const menu = node.querySelector('[data-menu="' + kind + '"]');
            const isOpen = menu.classList.contains("show");
            closeAllDropdowns();
            if (!isOpen) {
              trigger.classList.add("open");
              menu.classList.add("show");
            }
          });
        });

        /* إغلاق عند الضغط خارج */
        node.addEventListener("click", function (e) {
          if (!e.target.closest(".multi-filter-select")) {
            closeAllDropdowns();
          }
        });

        /* ============================================================
         * أزرار تحديد الكل ومسح
         * ============================================================ */
        node.querySelectorAll('[data-action="toggle-all"]').forEach(function (btn) {
          btn.addEventListener("click", function () {
            const kind = btn.dataset.target;
            const data = filterData[kind];
            const selected = kind === "units" ? selectedUnits
              : kind === "lessons" ? selectedLessons
                : selectedTypes;
            data.forEach(function (item) { selected.add(item.key); });
            renderAllFilters();
            updateAvailableCounts();
          });
        });

        node.querySelectorAll('[data-action="clear"]').forEach(function (btn) {
          btn.addEventListener("click", function () {
            const kind = btn.dataset.target;
            const selected = kind === "units" ? selectedUnits
              : kind === "lessons" ? selectedLessons
                : selectedTypes;
            selected.clear();
            renderAllFilters();
            updateAvailableCounts();
          });
        });

        /* ============================================================
         * تحميل الفلاتر من بنك الأسئلة
         * ============================================================ */
        const loadFilters = async function () {
          const subjectId = node.querySelector("#exSubj").value;

          if (!subjectId) {
            filterHint.textContent = "\u2B06 \u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0627\u062f\u0629 \u0623\u0648\u0644\u0627\u064B \u0644\u0639\u0631\u0636 \u0627\u0644\u0648\u062d\u062f\u0627\u062a \u0648\u0627\u0644\u062f\u0631\u0648\u0633";
            filterHint.className = "filter-hint warning";
            filterData.units = [];
            filterData.lessons = [];
            filterData.types = [];
            renderAllFilters();
            return;
          }

          filterHint.textContent = "\u23F3 \u062c\u0627\u0631\u064D \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0641\u0644\u0627\u062a\u0631...";
          filterHint.className = "filter-hint loading";

          try {
            const qs = await S.listQuestions(subjectId);
            availableQuestions = qs;

            /* ===== الوحدات ===== */
            const unitsMap = {};
            qs.forEach(function (q) {
              if (q.unitNumber !== null && q.unitNumber !== undefined) {
                const key = "u:" + q.unitNumber;
                if (!unitsMap[key]) {
                  unitsMap[key] = {
                    key: key,
                    label: "\u0627\u0644\u0648\u062d\u062f\u0629 " + q.unitNumber +
                      (q.unitTitle ? " \u2014 " + q.unitTitle : ""),
                    count: 0,
                    sort: Number(q.unitNumber)
                  };
                }
                unitsMap[key].count++;
              }
              if (q.unitTitle && (q.unitNumber === null || q.unitNumber === undefined)) {
                const key = "ut:" + q.unitTitle;
                if (!unitsMap[key]) {
                  unitsMap[key] = {
                    key: key,
                    label: q.unitTitle,
                    count: 0,
                    sort: 999
                  };
                }
                unitsMap[key].count++;
              }
            });
            filterData.units = Object.values(unitsMap).sort(function (a, b) {
              return a.sort - b.sort;
            });

            /* ===== الدروس ===== */
            const lessonsMap = {};
            qs.forEach(function (q) {
              if (q.lessonTitle) {
                if (!lessonsMap[q.lessonTitle]) {
                  lessonsMap[q.lessonTitle] = {
                    key: q.lessonTitle,
                    label: q.lessonTitle,
                    count: 0,
                    sort: (q.lessonNumber || 999) * 1000 + (q.unitNumber || 0)
                  };
                }
                lessonsMap[q.lessonTitle].count++;
              }
            });
            filterData.lessons = Object.values(lessonsMap).sort(function (a, b) {
              return a.sort - b.sort;
            });

            /* ===== الأنواع ===== */
            const typesMap = {};
            qs.forEach(function (q) {
              if (!typesMap[q.type]) {
                typesMap[q.type] = {
                  key: q.type,
                  label: U.TYPE_LABELS[q.type] || q.type,
                  count: 0
                };
              }
              typesMap[q.type].count++;
            });
            filterData.types = Object.values(typesMap);

            const subj = state.subjects.find(function (s) { return s.id === subjectId; });
            filterHint.textContent = "\u2705 " + qs.length + " \u0633\u0624\u0627\u0644 \u0645\u062a\u0627\u062d \u0641\u064a " + (subj ? subj.name : "");
            filterHint.className = "filter-hint success";

            renderAllFilters();
            updateAvailableCounts();
          } catch (e) {
            filterHint.textContent = "\u274C \u062e\u0637\u0623: " + e.message;
            filterHint.className = "filter-hint error";
          }
        };

        /* ============================================================
         * إحصائيات المتاح
         * ============================================================ */
        const updateAvailableCounts = function () {
          const filtered = filterQuestions(availableQuestions);
          const easy = filtered.filter(function (q) { return q.difficulty === "easy"; }).length;
          const medium = filtered.filter(function (q) {
            return q.difficulty === "medium" || !q.difficulty;
          }).length;
          const hard = filtered.filter(function (q) { return q.difficulty === "hard"; }).length;

          const el1 = node.querySelector("#availEasy");
          const el2 = node.querySelector("#availMedium");
          const el3 = node.querySelector("#availHard");
          if (el1) el1.textContent = "\u0645\u062a\u0627\u062d: " + easy;
          if (el2) el2.textContent = "\u0645\u062a\u0627\u062d: " + medium;
          if (el3) el3.textContent = "\u0645\u062a\u0627\u062d: " + hard;
          renderTypeCounts();
        };

        /* ============================================================
         * filterQuestions - تطبيق الفلاتر
         * ============================================================ */
        const filterQuestions = function (qs) {
          return qs.filter(function (q) {
            if (selectedUnits.size > 0) {
              let unitMatch = false;
              if (q.unitNumber !== null && q.unitNumber !== undefined) {
                if (selectedUnits.has("u:" + q.unitNumber)) unitMatch = true;
              }
              if (q.unitTitle && selectedUnits.has("ut:" + q.unitTitle)) unitMatch = true;
              if (!unitMatch) return false;
            }

            if (selectedLessons.size > 0) {
              if (!q.lessonTitle || !selectedLessons.has(q.lessonTitle)) return false;
            }

            if (selectedTypes.size > 0) {
              if (!selectedTypes.has(q.type)) return false;
            }

            return true;
          });
        };

        /* ============================================================
         * fetchWithDistribution - التوزيع الذكي
         * ============================================================ */
        const fetchWithDistribution = function () {
          const useDist = node.querySelector("#useDist").checked;
          let pool = filterQuestions(availableQuestions);

          if (!useDist) {
            const max = Number(node.querySelector("#exMax").value) || 0;
            if (max && pool.length > max) {
              pool = pool.sort(function () { return Math.random() - 0.5; }).slice(0, max);
            }
            return pool;
          }

          const wantEasy = Number(node.querySelector("#distEasy").value) || 0;
          const wantMedium = Number(node.querySelector("#distMedium").value) || 0;
          const wantHard = Number(node.querySelector("#distHard").value) || 0;
          const wantMax = Number(node.querySelector("#exMax").value) || 0;

          const totalWanted = wantEasy + wantMedium + wantHard;

          const easyPool = pool.filter(function (q) { return q.difficulty === "easy"; })
            .sort(function () { return Math.random() - 0.5; });
          const mediumPool = pool.filter(function (q) {
            return q.difficulty === "medium" || !q.difficulty;
          }).sort(function () { return Math.random() - 0.5; });
          const hardPool = pool.filter(function (q) { return q.difficulty === "hard"; })
            .sort(function () { return Math.random() - 0.5; });

          if (totalWanted === 0) {
            if (!wantMax) return pool;
            const perCat = Math.ceil(wantMax / 3);
            const result = [];
            result.push.apply(result, easyPool.slice(0, perCat));
            result.push.apply(result, mediumPool.slice(0, perCat));
            result.push.apply(result, hardPool.slice(0, perCat));
            return result.slice(0, wantMax);
          }

          const result = [];
          const picked = { easy: 0, medium: 0, hard: 0 };

          const take = function (poolArr, key, want) {
            const got = poolArr.slice(0, want);
            got.forEach(function (q) { result.push(q); });
            picked[key] = got.length;
            return got.length;
          };

          const gotEasy = take(easyPool, "easy", wantEasy);
          const gotMedium = take(mediumPool, "medium", wantMedium);
          const gotHard = take(hardPool, "hard", wantHard);

          let deficit = totalWanted - result.length;
          if (deficit > 0) {
            const remainEasy = easyPool.slice(gotEasy);
            const remainMedium = mediumPool.slice(gotMedium);
            const remainHard = hardPool.slice(gotHard);
            const extra = []
              .concat(remainEasy)
              .concat(remainMedium)
              .concat(remainHard)
              .sort(function () { return Math.random() - 0.5; })
              .slice(0, deficit);
            extra.forEach(function (q) { result.push(q); });
          }

          return result.sort(function () { return Math.random() - 0.5; });
        };

        /* ============================================================
         * renderQuestionList - عرض قائمة الأسئلة
         * ============================================================ */
        const renderQuestionList = function (questions) {
          if (!questions.length) {
            listBox.innerHTML = '<p class="muted center" style="padding:20px">\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u0633\u0626\u0644\u0629 \u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0644\u0641\u0644\u0627\u062a\u0631</p>';
            return;
          }

          listBox.innerHTML = questions.map(function (q) {
            const isSelected = selectedIds[q.id];
            const dLabel = q.difficulty === "easy" ? "\uD83D\uDFE2"
              : q.difficulty === "hard" ? "\uD83D\uDD34" : "\uD83D\uDFE1";
            const unitTxt = (q.unitNumber !== null && q.unitNumber !== undefined)
              ? "W" + q.unitNumber
              : (q.unitTitle || "");

            return '<label class="auto-exam-item">' +
              '<input type="checkbox" data-qid="' + q.id + '"' + (isSelected ? " checked" : "") + '>' +
              '<div class="content">' +
              '<div class="flex flex-wrap" style="gap:6px;margin-bottom:4px">' +
              U.badgeForType(q.type) +
              (U.sectionBadge(q) ? U.sectionBadge(q) : "") +
              (q.passage ? '<span class="badge badge-passage" title="\u0645\u0631\u0641\u0642 \u0628\u0646\u0635">\uD83D\uDCDC \u0646\u0635</span>' : "") +
              '<span class="badge badge-muted">' + dLabel + '</span>' +
              (unitTxt ? '<span class="badge badge-muted">' + U.esc(unitTxt) + '</span>' : '') +
              (q.lessonTitle ? '<span class="badge badge-muted">' + U.esc(q.lessonTitle) + '</span>' : '') +
              '<span class="badge badge-primary">' + (q.points || 1) + ' \u062f\u0631\u062c\u0629</span>' +
              '</div>' +
              '<div class="text">' + U.esc(q.text) + '</div>' +
              '</div>' +
              '</label>';
          }).join("");

          listBox.querySelectorAll("[data-qid]").forEach(function (cb) {
            cb.addEventListener("change", function () {
              const q = questions.find(function (x) { return x.id === cb.dataset.qid; });
              if (!q) return;

              if (cb.checked) {
                selectedIds[q.id] = true;
                chosen.push({
                  type: q.type,
                  text: q.text,
                  options: q.options || [],
                  answer: q.answer,
                  difficulty: q.difficulty,
                  explanation: q.explanation || "",
                  points: q.points || 1,
                  passage: q.passage || null,
                  tags: q.tags || [],
                  _sourceId: q.id,
                  unitNumber: q.unitNumber,
                  unitTitle: q.unitTitle,
                  lessonTitle: q.lessonTitle
                });
              } else {
                delete selectedIds[q.id];
                const idx = chosen.findIndex(function (c) {
                  return c._sourceId === q.id;
                });
                if (idx >= 0) chosen.splice(idx, 1);
              }
              updateStats();
              renderChosenList();
            });
          });
        };

        /* ============================================================
         * ربط الأحداث الأساسية
         * ============================================================ */
        node.querySelector("#exSubj").addEventListener("change", loadFilters);

        /* ===== الإعداد المالي / الدفع ===== */
        const paidCb = node.querySelector("#exPaid");
        const qrFile = node.querySelector("#exQrFile");
        const qrPreview = node.querySelector("#exQrPreview");
        const qrStatus = node.querySelector("#exQrStatus");
        const qrWrap = node.querySelector("#exQrWrap");
        function syncPaidUI() {
          const on = !!(paidCb && paidCb.checked);
          if (qrWrap) qrWrap.style.display = on ? "" : "none";
        }
        if (paidCb) paidCb.addEventListener("change", syncPaidUI);
        syncPaidUI();

        if (qrFile) qrFile.addEventListener("change", async function () {
          const f = qrFile.files && qrFile.files[0];
          if (!f) return;
          try {
            qrImage = await U.fileToDataURL(f, 512);
            qrPreview.innerHTML = '<img alt="QR" style="max-width:160px;border-radius:10px;border:1px solid var(--border)" src="' + U.esc(qrImage) + '">';
            qrPreview.style.display = "block";
            qrStatus.textContent = "تم تحميل الصورة ✓";
          } catch (e) {
            qrStatus.textContent = "تعذّر التحميل: " + (e && e.message || e);
          }
        });
        const qrClear = node.querySelector("#exQrClear");
        if (qrClear) qrClear.addEventListener("click", function () {
          qrImage = "";
          if (qrFile) qrFile.value = "";
          qrPreview.innerHTML = "";
          qrPreview.style.display = "none";
          qrStatus.textContent = "تم مسح الصورة";
        });

        node.querySelector("#useDist").addEventListener("change", function (e) {
          node.querySelector("#distBox").style.display = e.target.checked ? "block" : "none";
          node.querySelector("#distOffMsg").classList.toggle("hidden", e.target.checked);
        });

        node.querySelector("#distEqual").addEventListener("click", function () {
          const total = Number(node.querySelector("#exMax").value) || 30;
          const per = Math.floor(total / 3);
          const rem = total - (per * 3);
          node.querySelector("#distEasy").value = per + (rem > 0 ? 1 : 0);
          node.querySelector("#distMedium").value = per + (rem > 1 ? 1 : 0);
          node.querySelector("#distHard").value = per;
          updateDistTotal();
        });

        node.querySelector("#distClear").addEventListener("click", function () {
          node.querySelector("#distEasy").value = 0;
          node.querySelector("#distMedium").value = 0;
          node.querySelector("#distHard").value = 0;
          updateDistTotal();
        });

        ["distEasy", "distMedium", "distHard"].forEach(function (id) {
          node.querySelector("#" + id).addEventListener("input", updateDistTotal);
        });

        function updateDistTotal() {
          const a = Number(node.querySelector("#distEasy").value) || 0;
          const b = Number(node.querySelector("#distMedium").value) || 0;
          const c = Number(node.querySelector("#distHard").value) || 0;
          node.querySelector("#distTotal").textContent = a + b + c;
        }

        /* ============================================================
         * زر "جلب الأسئلة"
         * ============================================================ */
        node.querySelector("#fetchBtn").addEventListener("click", function () {
          const subjectId = node.querySelector("#exSubj").value;
          if (!subjectId) {
            return U.toast("\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0627\u062f\u0629 \u0623\u0648\u0644\u0627\u064B", "warn");
          }

          listBox.innerHTML = U.loaderHTML();
          fetchInfo.textContent = "\u23F3 \u062c\u0627\u0631\u064D \u0627\u0644\u062c\u0644\u0628...";

          setTimeout(function () {
            const picked = fetchWithDistribution();
            updateAvailableCounts();

            const totalFiltered = filterQuestions(availableQuestions).length;
            const info = "\u062a\u0645 \u062c\u0644\u0628 " + picked.length +
              " \u0645\u0646 \u0623\u0635\u0644 " + totalFiltered + " \u0633\u0624\u0627\u0644 \u0645\u0637\u0627\u0628\u0642";
            fetchInfo.textContent = info;

            renderQuestionList(picked);
            updateStats();
          }, 100);
        });

        node.querySelector("#fetchByTypeBtn").addEventListener("click", fetchByType);
        node.querySelector("#typeCountAuto").addEventListener("click", typeAutoBalance);
        node.querySelector("#typeModelPreset").addEventListener("click", function () {
          const preset = { mcq: 8, short_answer: 13, fill_blank: 6, essay: 2 };
          let applied = 0;
          Object.keys(preset).forEach(function (t) {
            const el = node.querySelector('[data-tcount="' + t + '"]');
            if (el) { el.value = String(preset[t]); applied++; }
          });
          U.toast(applied
            ? "توزيع النموذج: 8 اختيار + 13 قصيرة + 6 فراغات + 2 مقالي — اضغط «جلب حسب الأنواع»"
            : "لا توجد صفوف أنواع مطابقة — اختر المادة أولاً", applied ? "success" : "warn", 4500);
        });

        /* ============================================================
         * تحديد الكل / مسح التحديد
         * ============================================================ */
        node.querySelector("#selectAllBtn").addEventListener("click", function () {
          listBox.querySelectorAll("[data-qid]").forEach(function (cb) {
            if (!cb.checked) {
              cb.checked = true;
              cb.dispatchEvent(new Event("change"));
            }
          });
        });

        node.querySelector("#clearBtn").addEventListener("click", function () {
          chosen.length = 0;
          Object.keys(selectedIds).forEach(function (k) { delete selectedIds[k]; });
          listBox.querySelectorAll("[data-qid]").forEach(function (cb) {
            cb.checked = false;
          });
          updateStats();
          renderChosenList();
        });

        /* ============================================================
         * حفظ الاختبار
         * ============================================================ */
        node.querySelector("[data-save]").addEventListener("click", async function () {
          const title = node.querySelector("#exTitle").value.trim();
          if (!title) return U.toast("\u0623\u062f\u062e\u0644 \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631", "warn");

          const subjectId = node.querySelector("#exSubj").value;
          if (!subjectId) return U.toast("\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0627\u062f\u0629", "warn");
          if (!chosen.length) return U.toast("\u0627\u062e\u062a\u0631 \u0633\u0624\u0627\u0644\u0627\u064B \u0648\u0627\u062d\u062f\u0627\u064B \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644", "warn");

          /* المجموعات المستهدفة */
          const targetGroups = [];
          const allCb = node.querySelector("#gAll");
          if (allCb && allCb.checked) {
            targetGroups.push("ALL");
          } else {
            node.querySelectorAll(".grp-check:checked").forEach(function (cb) {
              targetGroups.push(cb.value);
            });
          }
          if (!targetGroups.length) {
            return U.toast("\u0627\u062e\u062a\u0631 \u0645\u062c\u0645\u0648\u0639\u0629 \u0648\u0627\u062d\u062f\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644", "warn");
          }

          const openAt = node.querySelector("#exOpenAt").value;
          const closeAt = node.querySelector("#exCloseAt").value;

          const data = {
            title: title,
            subjectId: subjectId,
            subjectName: (state.subjects.find(function (s) {
              return s.id === subjectId;
            }) || {}).name || "",
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
              units: Array.from(selectedUnits),
              lessons: Array.from(selectedLessons),
              types: Array.from(selectedTypes),
              max: Number(node.querySelector("#exMax").value) || 0,
              distEasy: Number(node.querySelector("#distEasy").value) || 0,
              distMedium: Number(node.querySelector("#distMedium").value) || 0,
              distHard: Number(node.querySelector("#distHard").value) || 0
            },
            openAt: openAt ? new Date(openAt).toISOString() : null,
            closeAt: closeAt ? new Date(closeAt).toISOString() : null,
            isPaid: !!(node.querySelector("#exPaid") && node.querySelector("#exPaid").checked),
            price: Number((node.querySelector("#exPrice") || {}).value) || 0,
            currency: ((node.querySelector("#exCurrency") || {}).value || "ل.س"),
            qrImage: qrImage,
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

        /* تحميل الفلاتر مسبقاً عند التعديل */
        if (isEdit && exam.subjectId) {
          loadFilters();
        }

        updateStats();
      }
    });
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
        return '<option value="' + e.id + '">' +
          U.esc(e.title) + " (" + U.esc(e.code) + ")</option>";
      }).join("");

      shell("results",
        '<div class="card-head"><h2>\u0627\u0644\u0646\u062a\u0627\u0626\u062c</h2><div class="spacer"></div>' +
        '<select id="resExam" style="max-width:320px">' +
        '<option value="">- \u0627\u062e\u062a\u0631 -</option>' + opts +
        "</select></div>" +

        '<div id="resBody"><div class="empty-state"><div class="emoji">\uD83D\uDCC8</div>' +
        "<h3>\u0627\u062e\u062a\u0631 \u0627\u062e\u062a\u0628\u0627\u0631\u0627\u064B</h3></div></div>"
      );

      document.getElementById("resExam").addEventListener("change", function (e) {
        openExamResults(e.target.value);
      });

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
      body.innerHTML = '<div class="empty-state"><div class="emoji">\uD83D\uDCC8</div><h3>\u0627\u062e\u062a\u0631 \u0627\u062e\u062a\u0628\u0627\u0631\u0627\u064B</h3></div>';
      return;
    }

    body.innerHTML = U.loaderHTML();

    try {
      const subs = await S.listSubmissionsByExam(examId);
      const exam = state.exams.find(function (e) { return e.id === examId; });

      if (!subs.length) {
        body.innerHTML = '<div class="empty-state">' +
          '<div class="emoji">\uD83D\uDDC2</div>' +
          '<h3>\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0634\u0627\u0631\u0643\u0627\u062a</h3></div>';
        return;
      }

      const graded = subs.filter(function (s) {
        return s.status === "graded" && s.percent !== null;
      });
      const pending = subs.filter(function (s) {
        return s.status === "pending" || s.status === "in_review";
      });

      const scores = graded.map(function (s) { return s.percent || 0; });
      const avg = scores.length
        ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length)
        : 0;

      const rows = subs.map(function (s, i) {
        const scoreTxt = (s.score !== null && s.score !== undefined)
          ? s.score + " / " + s.total : "-";
        const pctTxt = (s.percent !== null && s.percent !== undefined)
          ? s.percent + "%" : "-";
        const pctColor = (s.percent !== null && s.percent !== undefined)
          ? U.pctColor(s.percent) : "var(--text-3)";

        return "<tr>" +
          '<td data-label="#">' + (i + 1) + "</td>" +
          '<td data-label="\u0627\u0644\u0637\u0627\u0644\u0628"><b>' + U.esc(s.studentName || "-") + "</b></td>" +
          '<td data-label="\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629" class="tiny">' + U.esc(s.groupName || "-") + "</td>" +
          '<td data-label="\u0627\u0644\u062f\u0631\u062c\u0629">' + scoreTxt + "</td>" +
          '<td data-label="\u0627\u0644\u0646\u0633\u0628\u0629" style="color:' + pctColor + '"><b>' + pctTxt + "</b></td>" +
          '<td data-label="\u0627\u0644\u062d\u0627\u0644\u0629">' + U.submissionStatusBadge(s.status) + "</td>" +
          '<td data-label="\u0627\u0644\u062a\u0627\u0631\u064a\u062e" class="tiny">' + U.formatDate(s.createdAt) + "</td>" +
          "</tr>";
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
   * ANALYTICS
   * ============================================================ */
  async function renderAnalytics() {
    shell("analytics", U.loaderHTML());
    try {
      const exams = await S.listExams();
      state.exams = exams;

      const opts = exams.map(function (e) {
        return '<option value="' + e.id + '">' + U.esc(e.title) + "</option>";
      }).join("");

      shell("analytics",
        '<div class="card-head"><h2>\uD83E\uDDEE \u062a\u062d\u0644\u064a\u0644\u0627\u062a</h2><div class="spacer"></div>' +
        '<select id="anExam" style="max-width:320px">' +
        '<option value="">- \u0627\u062e\u062a\u0631 -</option>' + opts + "</select></div>" +

        '<div id="anBody"><div class="empty-state"><div class="emoji">\uD83E\uDDEE</div>' +
        "<h3>\u0627\u062e\u062a\u0631 \u0627\u062e\u062a\u0628\u0627\u0631\u0627\u064B</h3></div></div>"
      );

      document.getElementById("anExam").addEventListener("change", function (e) {
        openAnalytics(e.target.value);
      });
    } catch (e) {
      shell("analytics", errorCard(e));
    }
  }

  async function openAnalytics(examId) {
    const body = document.getElementById("anBody");

    if (!examId) {
      body.innerHTML = '<div class="empty-state"><div class="emoji">\uD83E\uDDEE</div><h3>\u0627\u062e\u062a\u0631 \u0627\u062e\u062a\u0628\u0627\u0631\u0627\u064B</h3></div>';
      return;
    }

    body.innerHTML = U.loaderHTML();

    try {
      const exam = state.exams.find(function (e) { return e.id === examId; });
      const subs = await S.listSubmissionsByExamAndStatus(examId, "graded");

      if (!subs.length) {
        body.innerHTML = '<div class="empty-state"><div class="emoji">\uD83D\uDCCA</div><h3>\u0644\u0627 \u062a\u0648\u062c\u062f \u0646\u062a\u0627\u0626\u062c \u0645\u0635\u062d\u0651\u062d\u0629</h3></div>';
        return;
      }

      const analysis = QP.analytics.itemAnalysis(subs, exam);
      const dist = QP.analytics.scoreDistribution(subs);
      const problematic = QP.analytics.problematicQuestions(analysis);
      const avg = Math.round(subs.reduce(function (a, s) {
        return a + (s.percent || 0);
      }, 0) / subs.length);

      const rows = analysis.map(function (a) {
        return "<tr>" +
          '<td data-label="#">' + (a.index + 1) + "</td>" +
          '<td data-label="\u0627\u0644\u0633\u0624\u0627\u0644">' + U.esc((a.text || "").slice(0, 70)) + "</td>" +
          '<td data-label="\u0627\u0644\u0646\u0648\u0639">' + U.badgeForType(a.type) + "</td>" +
          '<td data-label="\u0646\u0633\u0628\u0629 \u0627\u0644\u0635\u0648\u0627\u0628">' + a.correctRate + "%</td>" +
          '<td data-label="\u0627\u0644\u062a\u0645\u064a\u064a\u0632">' + a.discrimination + "</td>" +
          '<td data-label="\u0627\u0644\u062d\u0627\u0644\u0629">' +
          (a.flagged
            ? '<span class="badge badge-warning">' + a.difficulty + "</span>"
            : '<span class="badge badge-success">\u062c\u064a\u062f</span>') +
          "</td></tr>";
      }).join("");

      body.innerHTML =
        '<div class="stat-grid mb">' +
        stat("\uD83D\uDC65", subs.length, "\u0639\u062f\u062f \u0627\u0644\u0645\u0635\u062d\u0651\u062d") +
        stat("\uD83D\uDCCA", avg + "%", "\u0627\u0644\u0645\u062a\u0648\u0633\u0637") +
        stat("\u26A0\uFE0F", problematic.length, "\u0623\u0633\u0626\u0644\u0629 \u062a\u062d\u062a\u0627\u062c \u0645\u0631\u0627\u062c\u0639\u0629") +
        stat("\u2753", (exam.questions || []).length, "\u0639\u062f\u062f \u0627\u0644\u0623\u0633\u0626\u0644\u0629") +
        "</div>" +

        '<div class="card"><div class="card-head"><h3>\u062a\u0648\u0632\u064a\u0639 \u0627\u0644\u062f\u0631\u062c\u0627\u062a</h3></div>' +
        '<div class="bars">' + dist.map(function (d) {
          return '<div class="bar-wrap"><div class="bar" style="height:' +
            Math.max(2, (d.count / Math.max(1, Math.max.apply(null, dist.map(function (x) { return x.count; })))) * 100) +
            '%"></div><div class="bar-lbl">' + d.label + "<br><b>" + d.count + "</b></div></div>";
        }).join("") + "</div></div>" +

        (problematic.length
          ? '<div class="info-banner warning mt"><span class="emoji">\u26A0\uFE0F</span>' +
            "<div><b>" + problematic.length + " \u0633\u0624\u0627\u0644 \u064a\u062d\u062a\u0627\u062c \u0645\u0631\u0627\u062c\u0639\u0629</b></div></div>"
          : "") +

        '<div class="card mt"><div class="card-head"><h3>\u062a\u062d\u0644\u064a\u0644 \u0627\u0644\u0623\u0633\u0626\u0644\u0629</h3></div>' +
        '<div class="table-wrap responsive"><table><thead><tr>' +
        '<th>#</th><th>\u0627\u0644\u0633\u0624\u0627\u0644</th><th>\u0627\u0644\u0646\u0648\u0639</th><th>\u0646\u0633\u0628\u0629 \u0627\u0644\u0635\u0648\u0627\u0628</th><th>\u0627\u0644\u062a\u0645\u064a\u064a\u0632</th><th>\u0627\u0644\u062d\u0627\u0644\u0629</th>' +
        "</tr></thead><tbody>" + rows + "</tbody></table></div></div>";
    } catch (e) {
      body.innerHTML = errorCard(e);
    }
  }

  /* ============================================================
   * AUDIT LOG
   * ============================================================ */
  async function renderAuditLog() {
    shell("audit", U.loaderHTML());
    try {
      const logs = await S.listAuditLog(200);

      shell("audit",
        '<div class="card-head"><h2>\uD83D\uDCDC \u0627\u0644\u0633\u062c\u0644</h2><div class="spacer"></div>' +
        '<span class="badge badge-muted">' + logs.length + " \u062d\u062f\u062b</span></div>" +

        '<div class="audit-log">' +
        (logs.length
          ? logs.map(function (l) {
            return '<div class="audit-row">' +
              '<span class="audit-time">' + U.formatDate(l.at) + "</span> - " +
              '<span class="audit-action">' + U.esc(l.action) + "</span> " +
              '<span class="muted">' + U.esc(l.details || "") + "</span></div>";
          }).join("")
          : '<div class="muted center" style="padding:30px">\u0644\u0627 \u064a\u0648\u062c\u062f</div>') +
        "</div>"
      );
    } catch (e) {
      shell("audit", errorCard(e));
    }
  }

  /* ============================================================
   * SETTINGS
   * ============================================================ */
  async function renderSettings() {
    shell("settings", U.loaderHTML());

    shell("settings",
      '<div class="card"><div class="card-head"><h3>\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0627\u0644\u0645\u062f\u064a\u0631</h3></div>' +
      '<div class="form-row">' +
      '<div class="field"><label>\u0627\u0644\u062c\u062f\u064a\u062f</label><input type="password" id="newPass"></div>' +
      '<div class="field"><label>\u062a\u0623\u0643\u064a\u062f</label><input type="password" id="newPass2"></div></div>' +
      '<button class="btn btn-primary" id="savePass">\u062d\u0641\u0638</button></div>' +

      '<div class="card"><div class="card-head"><h3>\u0627\u0644\u0646\u0633\u062e \u0627\u0644\u0627\u062d\u062a\u064a\u0627\u0637\u064a</h3></div>' +
      '<div class="flex flex-wrap">' +
      '<button class="btn" id="exportAll">\u2B07 \u062a\u0635\u062f\u064a\u0631</button>' +
      '<label class="btn">\u2B06 \u0627\u0633\u062a\u064a\u0631\u0627\u062f' +
      '<input type="file" id="importBank" accept=".json" class="hidden"></label></div></div>' +

      '<div class="card"><div class="card-head"><h3>\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0646\u0638\u0627\u0645</h3></div>' +
      '<div class="student-info-row">' +
      '<div class="item"><div class="lbl">\u0627\u0644\u0625\u0635\u062f\u0627\u0631</div><div class="val">v6.0</div></div>' +
      '<div class="item"><div class="lbl">Firebase</div><div class="val">Firestore</div></div>' +
      "</div></div>"
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

    document.getElementById("exportAll").addEventListener("click", async function () {
      try {
        const arr = await Promise.all([
          S.listSubjects(),
          S.listQuestions(),
          S.listExams(),
          S.listTeachers(),
          S.listRecentSubmissions(5000)
        ]);

        const teachers = arr[3].map(function (t) {
          const c = Object.assign({}, t);
          delete c.salt;
          delete c.passwordHash;
          return c;
        });

        U.download("backup_v6_" + Date.now() + ".json",
          JSON.stringify({
            subjects: arr[0],
            questions: arr[1],
            exams: arr[2],
            teachers: teachers,
            submissions: arr[4],
            exportedAt: new Date().toISOString()
          }, null, 2),
          "application/json");

        U.toast("OK", "success");
      } catch (e) {
        U.toast("Error: " + e.message, "error");
      }
    });

    document.getElementById("importBank").addEventListener("change", async function (e) {
      const f = e.target.files[0];
      if (!f) return;
      const text = await f.text();
      importModal(function () { renderQuestions(); });
      setTimeout(function () {
        const ta = document.querySelector("#impText");
        if (ta) {
          ta.value = text;
          U.toast("\u062a\u0645 \u0627\u0644\u062a\u062d\u0645\u064a\u0644", "success");
        }
      }, 80);
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
      if (!isLogged()) {
        renderLogin();
        return;
      }
      if (QP.seed && QP.seed.statusAll && !sessionStorage.getItem("qp_seed_checked")) {
        sessionStorage.setItem("qp_seed_checked", "1");
        QP.seed.statusAll().then(function (list) {
          const missing = list.filter(function (s) { return !s.installed; });
          if (missing.length) {
            U.toast("بنوك جاهزة للتثبيت: " + missing.map(function (s) { return s.subject; }).join("، ") + " (صفحة المواد)", "info", 5000);
          }
        }).catch(function () {});
      }
      const fn = renders[sub] || renderDashboard;
      try {
        await fn();
      } catch (e) {
        console.error("[admin]", e);
        shell(sub || "dashboard", errorCard(e));
      }
    }
  };

  console.log("[admin.js v6] QP.admin loaded \u2705");
})();

