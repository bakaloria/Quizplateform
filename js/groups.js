/* groups.js - منطق المجموعات وربطها بالمعلمين والاختبارات */
(function () {
  const QP = window.QP;
  const U = QP.utils;
  const S = QP.store;

  /* ============================================================
   * التحقق من تعيين معلم لمادة
   * ============================================================ */
  function teacherHasSubject(teacher, subjectId) {
    return (teacher.subjectIds || []).indexOf(subjectId) >= 0;
  }

  /* ============================================================
   * تعيين معلم لمادة في مجموعة
   * ============================================================ */
  async function assignTeacherToGroup(groupId, teacherId, subjectId) {
    const group = await S.getGroup(groupId);
    if (!group) throw new Error("المجموعة غير موجودة");
    const teacher = await S.getTeacher(teacherId);
    if (!teacher) throw new Error("المعلم غير موجود");
    if (!teacherHasSubject(teacher, subjectId)) {
      throw new Error("المعلم غير مؤهل لهذه المادة");
    }

    const assignments = (group.teacherAssignments || []).slice();
    // احذف أي تعيين سابق لنفس المادة في هذه المجموعة
    const filtered = assignments.filter(function (a) { return a.subjectId !== subjectId; });
    filtered.push({
      teacherId: teacherId,
      teacherName: teacher.name,
      subjectId: subjectId
    });

    await S.updateGroup(groupId, { teacherAssignments: filtered });
    return filtered;
  }

  /* ============================================================
   * إزالة معلم من مجموعة
   * ============================================================ */
  async function removeTeacherFromGroup(groupId, teacherId, subjectId) {
    const group = await S.getGroup(groupId);
    if (!group) throw new Error("المجموعة غير موجودة");
    const assignments = (group.teacherAssignments || []).filter(function (a) {
      if (subjectId) {
        return !(a.teacherId === teacherId && a.subjectId === subjectId);
      }
      return a.teacherId !== teacherId;
    });
    await S.updateGroup(groupId, { teacherAssignments: assignments });
    return assignments;
  }

  /* ============================================================
   * الحصول على معلمي مجموعة معينة
   * ============================================================ */
  async function getGroupTeachers(groupId) {
    const group = await S.getGroup(groupId);
    if (!group) return [];
    const ids = {};
    (group.teacherAssignments || []).forEach(function (a) { ids[a.teacherId] = true; });
    const teachers = await S.listTeachers();
    return teachers.filter(function (t) { return ids[t.id]; });
  }

  /* ============================================================
   * الحصول على مواد مجموعة معينة
   * ============================================================ */
  async function getGroupSubjects(groupId) {
    const group = await S.getGroup(groupId);
    if (!group) return [];
    const ids = {};
    (group.teacherAssignments || []).forEach(function (a) { ids[a.subjectId] = true; });
    const subjects = await S.listSubjects();
    return subjects.filter(function (s) { return ids[s.id]; });
  }

  /* ============================================================
   * المعلم: هل يستطيع رؤية تسليم معين؟
   * ============================================================ */
  async function teacherCanSeeSubmission(teacherId, submission) {
    if (!submission || !submission.groupId) return false;
    const group = await S.getGroup(submission.groupId);
    if (!group) return false;
    return (group.teacherAssignments || []).some(function (a) {
      return a.teacherId === teacherId && a.subjectId === submission.subjectId;
    });
  }

  /* ============================================================
   * إحصائيات المجموعة
   * ============================================================ */
  async function getGroupStats(groupId) {
    const enrollments = await S.listEnrollmentsByGroup(groupId);
    const submissions = await S.listSubmissionsByExam;
    // اجلب كل تسليمات المجموعة
    const snap = await QP.db.collection("submissions").where("groupId", "==", groupId).get();
    const subs = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    const pending = subs.filter(function (s) { return s.status === "pending" || s.status === "in_review"; });
    const graded = subs.filter(function (s) { return s.status === "graded"; });
    return {
      studentCount: enrollments.length,
      totalSubmissions: subs.length,
      pendingCount: pending.length,
      gradedCount: graded.length
    };
  }

  /* ============================================================
   * عرض بطاقة مجموعة
   * ============================================================ */
  function renderGroupCard(group, options) {
    options = options || {};
    const teachers = (group.teacherAssignments || [])
      .map(function (a) { return a.teacherName + " (" + (a.subjectName || "مادة") + ")"; })
      .join(" • ") || "لم يُعيَّن معلم بعد";

    const showJoin = options.showJoin;
    const actionBtn = showJoin
      ? '<button class="btn btn-primary btn-block" data-join="' + U.esc(group.id) + '">انضمام للمجموعة</button>'
      : "";

    return '<div class="group-card">' +
      '<div class="group-card-head">' +
      '<div class="group-emoji">👥</div>' +
      '<div class="group-info">' +
      '<h3>' + U.esc(group.name) + '</h3>' +
      (group.description ? '<p class="muted tiny">' + U.esc(group.description) + '</p>' : "") +
      '</div>' +
      '</div>' +
      '<div class="group-meta">' +
      '<span class="badge badge-primary">👤 ' + (group.studentCount || 0) + ' طالب</span>' +
      '<span class="badge badge-muted">👨‍🏫 ' + U.esc(teachers) + '</span>' +
      '</div>' +
      (actionBtn ? '<div class="mt-sm">' + actionBtn + '</div>' : "") +
      '</div>';
  }

  QP.groups = {
    teacherHasSubject: teacherHasSubject,
    assignTeacherToGroup: assignTeacherToGroup,
    removeTeacherFromGroup: removeTeacherFromGroup,
    getGroupTeachers: getGroupTeachers,
    getGroupSubjects: getGroupSubjects,
    teacherCanSeeSubmission: teacherCanSeeSubmission,
    getGroupStats: getGroupStats,
    renderGroupCard: renderGroupCard
  };

  console.log("[groups.js] تم التحميل ✅");
})();

