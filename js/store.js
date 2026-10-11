(function () {
  const QP = window.QP;
  const db = QP.db;
  const FV = QP.FieldValue;

  const col = {
    subjects: db.collection("subjects"),
    questions: db.collection("questions"),
    exams: db.collection("exams"),
    examCodes: db.collection("examCodes"),
    submissions: db.collection("submissions"),
    settings: db.collection("settings"),
    teachers: db.collection("teachers"),
    auditLog: db.collection("auditLog"),
    groups: db.collection("groups"),
    students: db.collection("students"),
    enrollments: db.collection("enrollments")
  };

  function snapDocs(snap) { return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); }
  function tsOf(v) {
    if (!v) return 0;
    if (typeof v === "object" && v.toDate) return v.toDate().getTime();
    if (typeof v === "number") return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  const store = {
    /* ============================================================
     * SUBJECTS
     * ============================================================ */
    listSubjects: async function () {
      const snap = await col.subjects.get();
      return QP.utils.sortBy(snapDocs(snap), "createdAt", "asc");
    },
    getSubject: async function (id) {
      const d = await col.subjects.doc(id).get();
      return d.exists ? Object.assign({ id: d.id }, d.data()) : null;
    },
    addSubject: async function (data) {
      const ref = await col.subjects.add({
        name: data.name || "",
        description: data.description || "",
        createdAt: FV.serverTimestamp()
      });
      return ref.id;
    },
    updateSubject: async function (id, data) {
      await col.subjects.doc(id).update({ name: data.name, description: data.description || "" });
    },
    deleteSubject: async function (id) {
      const qs = await col.questions.where("subjectId", "==", id).get();
      let batch = db.batch();
      let n = 0;
      for (const doc of qs.docs) {
        batch.delete(doc.ref);
        n++;
        if (n % 400 === 0) { await batch.commit(); batch = db.batch(); }
      }
      if (n % 400 !== 0) await batch.commit();
      await col.subjects.doc(id).delete();
    },

    /* ============================================================
     * QUESTIONS
     * ============================================================ */
    listQuestions: async function (subjectId) {
      let snap;
      if (subjectId) snap = await col.questions.where("subjectId", "==", subjectId).get();
      else snap = await col.questions.get();
      return QP.utils.sortBy(snapDocs(snap), "createdAt", "desc");
    },
    countQuestions: async function () {
      const snap = await col.questions.get();
      return snap.size;
    },
    addQuestion: async function (q, subjectId, subjectName) {
      const ref = await col.questions.add({
        subjectId: subjectId || "",
        subjectName: subjectName || "",
        type: q.type,
        text: q.text,
        options: q.options || [],
        answer: q.answer,
        difficulty: q.difficulty || "medium",
        tags: q.tags || [],
        explanation: q.explanation || "",
        points: q.points || 1,
        unitNumber: q.unitNumber !== undefined ? q.unitNumber : null,
        unitTitle: q.unitTitle || "",
        lessonTitle: q.lessonTitle || "",
        createdAt: FV.serverTimestamp()
      });
      return ref.id;
    },
    addQuestionsBulk: async function (list, subjectId, subjectName) {
      let batch = db.batch();
      let count = 0, committed = 0;
      for (const q of list) {
        const ref = col.questions.doc();
        batch.set(ref, {
          subjectId: subjectId || "",
          subjectName: subjectName || "",
          type: q.type,
          text: q.text,
          options: q.options || [],
          answer: q.answer,
          difficulty: q.difficulty || "medium",
          tags: q.tags || [],
          explanation: q.explanation || "",
          points: q.points || 1,
          unitNumber: q.unitNumber !== undefined ? q.unitNumber : null,
          unitTitle: q.unitTitle || "",
          lessonTitle: q.lessonTitle || "",
          createdAt: FV.serverTimestamp()
        });
        count++;
        if (count % 400 === 0) { await batch.commit(); committed += 400; batch = db.batch(); }
      }
      if (count % 400 !== 0 || count === 0) await batch.commit();
      committed += count % 400;
      return committed || count;
    },
    updateQuestion: async function (id, q) {
      await col.questions.doc(id).update({
        type: q.type, text: q.text, options: q.options || [], answer: q.answer,
        difficulty: q.difficulty || "medium", tags: q.tags || [],
        explanation: q.explanation || "", points: q.points || 1,
        unitNumber: q.unitNumber !== undefined ? q.unitNumber : null,
        unitTitle: q.unitTitle || "",
        lessonTitle: q.lessonTitle || ""
      });
    },
    deleteQuestion: async function (id) {
      await col.questions.doc(id).delete();
    },
    /* فلترة الأسئلة لبناء اختبار تلقائي */
    filterQuestions: async function (criteria) {
      criteria = criteria || {};
      const snap = await col.questions.get();
      return snapDocs(snap).filter(function (q) {
        if (criteria.subjectId && q.subjectId !== criteria.subjectId) return false;
        if (criteria.unitNumber !== undefined && criteria.unitNumber !== null && criteria.unitNumber !== "") {
          if (String(q.unitNumber) !== String(criteria.unitNumber)) return false;
        }
        if (criteria.unitTitle && q.unitTitle !== criteria.unitTitle) return false;
        if (criteria.lessonTitle && q.lessonTitle !== criteria.lessonTitle) return false;
        if (criteria.type && q.type !== criteria.type) return false;
        if (criteria.difficulty && q.difficulty !== criteria.difficulty) return false;
        return true;
      });
    },

    /* ============================================================
     * EXAMS
     * ============================================================ */
    listExams: async function () {
      const snap = await col.exams.get();
      return QP.utils.sortBy(snapDocs(snap), "createdAt", "desc");
    },
    listExamsBySubjectIds: async function (subjectIds) {
      if (!subjectIds || !subjectIds.length) return [];
      const snap = await col.exams.get();
      return snapDocs(snap).filter(function (e) { return subjectIds.indexOf(e.subjectId) >= 0; })
        .sort(function (a, b) { return tsOf(b.createdAt) - tsOf(a.createdAt); });
    },
    listExamsForGroup: async function (groupId) {
      if (!groupId) return [];
      const snap = await col.exams.get();
      return snapDocs(snap)
        .filter(function (e) {
          if (!e.targetGroups || !e.targetGroups.length) return false;
          return e.targetGroups.indexOf(groupId) >= 0 || e.targetGroups.indexOf("ALL") >= 0;
        })
        .sort(function (a, b) { return tsOf(b.createdAt) - tsOf(a.createdAt); });
    },
    getExam: async function (id) {
      const d = await col.exams.doc(id).get();
      return d.exists ? Object.assign({ id: d.id }, d.data()) : null;
    },
    getExamByCode: async function (code) {
      code = String(code || "").trim().toUpperCase();
      if (!code) return null;
      const mapDoc = await col.examCodes.doc(code).get();
      if (!mapDoc.exists) return null;
      return store.getExam(mapDoc.data().examId);
    },
    codeExists: async function (code) {
      const d = await col.examCodes.doc(code).get();
      return d.exists;
    },
    createExam: async function (data) {
      let code = String(data.code || "").trim().toUpperCase();
      if (!code) { do { code = QP.utils.code(6); } while (await store.codeExists(code)); }
      const totalPoints = (data.questions || []).reduce(function (s, q) { return s + (Number(q.points) || 1); }, 0);
      const ref = await col.exams.add({
        title: data.title || "",
        subjectId: data.subjectId || "",
        subjectName: data.subjectName || "",
        description: data.description || "",
        code: code,
        durationMin: Number(data.durationMin) || 0,
        settings: data.settings || {},
        questions: data.questions || [],
        totalPoints: totalPoints,
        status: data.status || "published",
        targetGroups: data.targetGroups || [],
        autoGenerated: !!data.autoGenerated,
        filterCriteria: data.filterCriteria || null,
        openAt: data.openAt || null,
        closeAt: data.closeAt || null,
        createdAt: FV.serverTimestamp()
      });
      await col.examCodes.doc(code).set({ examId: ref.id, code: code, createdAt: FV.serverTimestamp() });
      return { id: ref.id, code: code };
    },
    updateExam: async function (id, data) {
      const totalPoints = (data.questions || []).reduce(function (s, q) { return s + (Number(q.points) || 1); }, 0);
      await col.exams.doc(id).update(Object.assign({}, data, { totalPoints: totalPoints }));
    },
    setExamStatus: async function (id, status) {
      await col.exams.doc(id).update({ status: status });
    },
    deleteExam: async function (id) {
      const exam = await store.getExam(id);
      if (exam && exam.code) {
        try { await col.examCodes.doc(exam.code).delete(); } catch (e) { }
      }
      await col.exams.doc(id).delete();
    },

    /* ============================================================
     * GROUPS
     * ============================================================ */
    listGroups: async function () {
      const snap = await col.groups.get();
      return QP.utils.sortBy(snapDocs(snap), "createdAt", "desc");
    },
    getGroup: async function (id) {
      const d = await col.groups.doc(id).get();
      return d.exists ? Object.assign({ id: d.id }, d.data()) : null;
    },
    addGroup: async function (data) {
      // data: { name, description, teacherAssignments: [{teacherId, subjectId}], active }
      const ref = await col.groups.add({
        name: data.name || "",
        description: data.description || "",
        teacherAssignments: data.teacherAssignments || [],
        studentCount: 0,
        active: data.active !== false,
        createdAt: FV.serverTimestamp()
      });
      return ref.id;
    },
    updateGroup: async function (id, data) {
      await col.groups.doc(id).update(data);
    },
    deleteGroup: async function (id) {
      // احذف الانضمامات
      const enr = await col.enrollments.where("groupId", "==", id).get();
      let batch = db.batch();
      let n = 0;
      for (const doc of enr.docs) {
        batch.delete(doc.ref);
        n++;
        if (n % 400 === 0) { await batch.commit(); batch = db.batch(); }
      }
      if (n % 400 !== 0) await batch.commit();
      await col.groups.doc(id).delete();
    },
    updateGroupStudentCount: async function (groupId) {
      const snap = await col.enrollments.where("groupId", "==", groupId).get();
      await col.groups.doc(groupId).update({ studentCount: snap.size });
      return snap.size;
    },
    /* مجموعات المعلم (التي عُيّن فيها لتصحيح مادة) */
    listGroupsByTeacher: async function (teacherId) {
      const snap = await col.groups.get();
      return snapDocs(snap).filter(function (g) {
        return (g.teacherAssignments || []).some(function (a) { return a.teacherId === teacherId; });
      });
    },
    /* الحصول على مواد المعلم في مجموعة معينة */
    getTeacherSubjectsInGroup: async function (teacherId, groupId) {
      const g = await store.getGroup(groupId);
      if (!g) return [];
      return (g.teacherAssignments || [])
        .filter(function (a) { return a.teacherId === teacherId; })
        .map(function (a) { return a.subjectId; });
    },

    /* ============================================================
     * STUDENTS (حسابات الطلاب)
     * ============================================================ */
    /* اسم المستخدم هو الاسم المُطبَّع */
    makeUsername: function (name) {
      return QP.utils.normalizeArabic(name).replace(/\s+/g, "_").slice(0, 40);
    },
    getStudentByUsername: async function (username) {
      if (!username) return null;
      const snap = await col.students.where("username", "==", username).limit(1).get();
      if (snap.empty) return null;
      return Object.assign({ id: snap.docs[0].id }, snap.docs[0].data());
    },
    getStudent: async function (id) {
      const d = await col.students.doc(id).get();
      return d.exists ? Object.assign({ id: d.id }, d.data()) : null;
    },
    addStudent: async function (data) {
      const salt = QP.crypto.genSalt(16);
      const hash = await QP.crypto.hashPassword(data.password, salt);
      const username = data.username || store.makeUsername(data.name);
      const ref = await col.students.add({
        name: data.name || "",
        username: username,
        salt: salt,
        passwordHash: hash,
        groupId: data.groupId || null,
        active: true,
        lastLoginAt: null,
        createdAt: FV.serverTimestamp()
      });
      // إن كان له مجموعة، سجّل الانضمام
      if (data.groupId) {
        await store.enrollStudent(ref.id, data.groupId, data.name);
      }
      return ref.id;
    },
    updateStudent: async function (id, data) {
      const patch = Object.assign({}, data);
      if (patch.password) {
        const salt = QP.crypto.genSalt(16);
        patch.salt = salt;
        patch.passwordHash = await QP.crypto.hashPassword(patch.password, salt);
        delete patch.password;
      }
      if (patch.name && !patch.username) {
        patch.username = store.makeUsername(patch.name);
      }
      await col.students.doc(id).update(patch);
    },
    deleteStudent: async function (id) {
      // احذف انضماماته
      const enr = await col.enrollments.where("studentId", "==", id).get();
      let batch = db.batch();
      let n = 0;
      for (const doc of enr.docs) {
        batch.delete(doc.ref);
        n++;
      }
      if (n > 0) await batch.commit();
      await col.students.doc(id).delete();
    },
    recordStudentLogin: async function (id) {
      await col.students.doc(id).update({ lastLoginAt: FV.serverTimestamp() });
    },

    /* ============================================================
     * ENROLLMENTS (انضمام الطالب لمجموعة)
     * ============================================================ */
    enrollStudent: async function (studentId, groupId, studentName) {
      // احذف أي انضمام سابق
      const prev = await col.enrollments.where("studentId", "==", studentId).get();
      let batch = db.batch();
      for (const doc of prev.docs) batch.delete(doc.ref);
      if (prev.size > 0) await batch.commit();

      // أضف الانضمام الجديد
      const ref = await col.enrollments.add({
        studentId: studentId,
        groupId: groupId,
        studentName: studentName || "",
        joinedAt: FV.serverTimestamp()
      });

      // حدّث الطالب + المجموعة
      await col.students.doc(studentId).update({ groupId: groupId });
      await store.updateGroupStudentCount(groupId);

      return ref.id;
    },
    getEnrollment: async function (studentId) {
      const snap = await col.enrollments.where("studentId", "==", studentId).limit(1).get();
      if (snap.empty) return null;
      return Object.assign({ id: snap.docs[0].id }, snap.docs[0].data());
    },
    listEnrollmentsByGroup: async function (groupId) {
      const snap = await col.enrollments.where("groupId", "==", groupId).get();
      return snapDocs(snap);
    },

    /* ============================================================
     * SUBMISSIONS
     * ============================================================ */
    addSubmission: async function (data) {
      const ref = await col.submissions.add(Object.assign({ createdAt: FV.serverTimestamp() }, data));
      return ref.id;
    },
    getSubmissionById: async function (id) {
      const d = await col.submissions.doc(id).get();
      return d.exists ? Object.assign({ id: d.id }, d.data()) : null;
    },
    listSubmissionsByExam: async function (examId) {
      const snap = await col.submissions.where("examId", "==", examId).get();
      return QP.utils.sortBy(snapDocs(snap), "score", "desc");
    },
    listSubmissionsByExamAndStatus: async function (examId, status) {
      const snap = await col.submissions.where("examId", "==", examId).get();
      let list = snapDocs(snap);
      if (status) list = list.filter(function (s) { return s.status === status; });
      return list.sort(function (a, b) { return tsOf(b.createdAt) - tsOf(a.createdAt); });
    },
    /* تسليمات المجموعة لمعلم - حسب المواد التي يصحّحها */
    listSubmissionsForTeacherInGroup: async function (teacherId, groupId) {
      const subjectIds = await store.getTeacherSubjectsInGroup(teacherId, groupId);
      if (!subjectIds.length) return [];
      const snap = await col.submissions
        .where("groupId", "==", groupId).get();
      return snapDocs(snap)
        .filter(function (s) { return subjectIds.indexOf(s.subjectId) >= 0; })
        .sort(function (a, b) { return tsOf(b.createdAt) - tsOf(a.createdAt); });
    },
    listSubmissionsByStudent: async function (studentId) {
      const snap = await col.submissions.where("studentId", "==", studentId).get();
      return snapDocs(snap).sort(function (a, b) { return tsOf(b.createdAt) - tsOf(a.createdAt); });
    },
    findSubmission: async function (examId, studentId) {
      const snap = await col.submissions
        .where("examId", "==", examId)
        .where("studentId", "==", studentId).get();
      if (snap.empty) return null;
      return snapDocs(snap).sort(function (a, b) { return tsOf(b.createdAt) - tsOf(a.createdAt); })[0];
    },
    gradeSubmission: async function (id, gradeData) {
      await col.submissions.doc(id).update(Object.assign({ gradedAt: FV.serverTimestamp() }, gradeData));
    },
    deleteSubmission: async function (id) {
      await col.submissions.doc(id).delete();
    },
    listRecentSubmissions: async function (limit) {
      const snap = await col.submissions.get();
      return QP.utils.sortBy(snapDocs(snap), "createdAt", "desc").slice(0, limit || 20);
    },
    countSubmissions: async function () {
      const snap = await col.submissions.get();
      return snap.size;
    },
    countPendingSubmissions: async function () {
      const snap = await col.submissions.get();
      return snapDocs(snap).filter(function (s) { return s.status === "pending" || s.status === "in_review"; }).length;
    },

    /* ============================================================
     * TEACHERS
     * ============================================================ */
    listTeachers: async function () {
      const snap = await col.teachers.get();
      return QP.utils.sortBy(snapDocs(snap), "createdAt", "desc");
    },
    getTeacher: async function (id) {
      const d = await col.teachers.doc(id).get();
      return d.exists ? Object.assign({ id: d.id }, d.data()) : null;
    },
    getTeacherByUsername: async function (username) {
      const uname = String(username || "").trim().toLowerCase();
      if (!uname) return null;
      const snap = await col.teachers.where("username", "==", uname).limit(1).get();
      if (snap.empty) return null;
      return Object.assign({ id: snap.docs[0].id }, snap.docs[0].data());
    },
    addTeacher: async function (data) {
      const salt = QP.crypto.genSalt(16);
      const hash = await QP.crypto.hashPassword(data.password, salt);
      const ref = await col.teachers.add({
        name: data.name || "",
        username: String(data.username || "").trim().toLowerCase(),
        salt: salt,
        passwordHash: hash,
        subjectIds: data.subjectIds || [],
        active: data.active !== false,
        failedAttempts: 0,
        lockedUntil: 0,
        lastLoginAt: null,
        createdAt: FV.serverTimestamp()
      });
      return ref.id;
    },
    updateTeacher: async function (id, data) {
      const patch = Object.assign({}, data);
      if (patch.username) patch.username = String(patch.username).trim().toLowerCase();
      if (patch.password) {
        const salt = QP.crypto.genSalt(16);
        patch.salt = salt;
        patch.passwordHash = await QP.crypto.hashPassword(patch.password, salt);
        delete patch.password;
      }
      await col.teachers.doc(id).update(patch);
    },
    deleteTeacher: async function (id) {
      // احذف تعييناته من كل المجموعات
      const groups = await col.groups.get();
      for (const g of groups.docs) {
        const data = g.data();
        const assignments = data.teacherAssignments || [];
        const filtered = assignments.filter(function (a) { return a.teacherId !== id; });
        if (filtered.length !== assignments.length) {
          await col.groups.doc(g.id).update({ teacherAssignments: filtered });
        }
      }
      await col.teachers.doc(id).delete();
    },
    recordLoginAttempt: async function (id, success) {
      const t = await store.getTeacher(id);
      if (!t) return;
      if (success) {
        await col.teachers.doc(id).update({
          failedAttempts: 0, lockedUntil: 0, lastLoginAt: FV.serverTimestamp()
        });
      } else {
        const attempts = (t.failedAttempts || 0) + 1;
        const lockedUntil = attempts >= 5 ? Date.now() + 15 * 60 * 1000 : 0;
        await col.teachers.doc(id).update({ failedAttempts: attempts, lockedUntil: lockedUntil });
      }
    },

    /* ============================================================
     * AUDIT
     * ============================================================ */
    addAuditLog: async function (entry) {
      try { await col.auditLog.add(entry); } catch (e) { }
    },
    listAuditLog: async function (limit) {
      try {
        const snap = await col.auditLog.get();
        return QP.utils.sortBy(snapDocs(snap), "at", "desc").slice(0, limit || 100);
      } catch (e) { return []; }
    },

    /* ============================================================
     * SETTINGS
     * ============================================================ */
    getAdminPass: async function () {
      const d = await col.settings.doc("admin").get();
      if (d.exists && d.data().pass) return { pass: d.data().pass, created: false };
      const def = "admin123";
      await col.settings.doc("admin").set({ pass: def, createdAt: FV.serverTimestamp() }, { merge: true });
      return { pass: def, created: true };
    },
    setAdminPass: async function (pass) {
      await col.settings.doc("admin").set({ pass: pass, updatedAt: FV.serverTimestamp() }, { merge: true });
    }
  };

  QP.store = store;
  console.log("[store.js] تم التحميل ✅");
})();