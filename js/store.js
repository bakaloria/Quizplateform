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
    enrollments: db.collection("enrollments"),
    payments: db.collection("payments"),
    notifications: db.collection("notifications"),
    engPassages: db.collection("engPassages"),
    engItems: db.collection("engItems"),
    engConfig: db.collection("engConfig")
  };

  /* ============================================================
   * Firestore لا يدعم المصفوفات المتداخلة (array داخل array).
   * نحوّل أي مصفوفة تحتوي عنصراً من نوع مصفوفة إلى كائن بمفاتيح
   * رقمية عند الكتابة، ونعيد تحويلها إلى مصفوفة عند القراءة،
   * للحفاظ على البنية الأصلية في الواجهة (مثل blanks و rows).
   * ============================================================ */
  function isPlainObject(o) {
    if (o === null || typeof o !== "object" || Array.isArray(o)) return false;
    /* استثناء قيم Firestore الخاصة (Timestamp / FieldValue) */
    if (typeof o.toDate === "function" || typeof o.toMillis === "function") return false;
    const p = Object.getPrototypeOf(o);
    if (p === Object.prototype || p === null) return true;
    /* دعم الكائنات من نطاق (realm) آخر: تُطابق بـ constructor.name */
    const ctor = o.constructor;
    return !!ctor && ctor.name === "Object";
  }
  /* هل يحتوي هذا العنصر مصفوفةً في أي عمق (تبعاً لقواعد Firestore)? */
  function containsArrayDeep(value) {
    if (Array.isArray(value)) return true;
    if (isPlainObject(value)) {
      return Object.keys(value).some(function (k) { return containsArrayDeep(value[k]); });
    }
    return false;
  }
  function sanitize(value) {
    if (Array.isArray(value)) {
      /* إذا احتوى أي عنصر مصفوفةً (مباشرةً أو داخل كائن) نحوّل المصفوفة
         كلها إلى كائن بمفاتيح رقمية، لأن Firestore يرفض التعشيش. */
      if (value.some(containsArrayDeep)) {
        const obj = {};
        value.forEach(function (v, i) { obj[String(i)] = sanitize(v); });
        return obj;
      }
      return value.map(sanitize);
    }
    if (isPlainObject(value)) {
      const obj = {};
      Object.keys(value).forEach(function (k) { obj[k] = sanitize(value[k]); });
      return obj;
    }
    return value; /* يحافظ على قيم FieldValue وTimestamp كما هي */
  }
  function restore(value) {
    if (Array.isArray(value)) return value.map(restore);
    if (isPlainObject(value)) {
      const keys = Object.keys(value);
      if (keys.length && keys.every(function (k, i) { return String(i) === k; })) {
        return keys.map(function (k) { return restore(value[k]); });
      }
      const obj = {};
      keys.forEach(function (k) { obj[k] = restore(value[k]); });
      return obj;
    }
    return value;
  }

  function snapDocs(snap) { return snap.docs.map(function (d) { return Object.assign({ id: d.id }, restore(d.data())); }); }
  function docData(d) { return Object.assign({ id: d.id }, restore(d.data())); }
  function tsOf(v) {
    if (!v) return 0;
    if (typeof v === "object" && v.toDate) return v.toDate().getTime();
    if (typeof v === "number") return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  /* توليد كود اختبار فريد غير مستخدم مسبقاً */
  async function uniqueExamCode() {
    let code;
    let tries = 0;
    do {
      code = QP.utils.code(6);
      tries++;
      if (tries > 25) throw new Error("تعذّر توليد كود فريد، حاول مرة أخرى");
    } while (await store.codeExists(code));
    return code;
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
      return d.exists ? docData(d) : null;
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
    /* عدّ خفيف عبر count() (لا يجلب الوثائق) مع تراجع آمن لأحدث إصدار compat */
    countQuestions: async function (subjectId) {
      const q = subjectId
        ? col.questions.where("subjectId", "==", subjectId)
        : col.questions;
      try {
        if (typeof q.count === "function") {
          const snap = await q.count().get();
          return snap.data().count;
        }
      } catch (e) { /* نسقط للطريقة القديمة */ }
      const snap = await q.get();
      return snap.size;
    },
    addQuestion: async function (q, subjectId, subjectName) {
      const ref = await col.questions.add(sanitize({
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
        passage: q.passage || null,
        lessonNumber: q.lessonNumber !== undefined ? q.lessonNumber : null,
        image: q.image || "",
        pairs: q.pairs || [],
        items: q.items || [],
        categories: q.categories || [],
        columns: q.columns || [],
        rows: q.rows || [],
        blanks: q.blanks || [],
        labels: q.labels || [],
        createdAt: FV.serverTimestamp()
      }));
      return ref.id;
    },
    addQuestionsBulk: async function (list, subjectId, subjectName) {
      let batch = db.batch();
      let count = 0, committed = 0;
      for (const q of list) {
        const ref = col.questions.doc();
        batch.set(ref, sanitize({
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
          passage: q.passage || null,
          lessonNumber: q.lessonNumber !== undefined ? q.lessonNumber : null,
          image: q.image || "",
          pairs: q.pairs || [],
          items: q.items || [],
          categories: q.categories || [],
          columns: q.columns || [],
          rows: q.rows || [],
          blanks: q.blanks || [],
          labels: q.labels || [],
          createdAt: FV.serverTimestamp()
        }));
        count++;
        if (count % 400 === 0) { await batch.commit(); committed += 400; batch = db.batch(); }
      }
      if (count % 400 !== 0 || count === 0) await batch.commit();
      committed += count % 400;
      return committed || count;
    },
    updateQuestion: async function (id, q) {
      await col.questions.doc(id).update(sanitize({
        type: q.type, text: q.text, options: q.options || [], answer: q.answer,
        difficulty: q.difficulty || "medium", tags: q.tags || [],
        explanation: q.explanation || "", points: q.points || 1,
        unitNumber: q.unitNumber !== undefined ? q.unitNumber : null,
        unitTitle: q.unitTitle || "",
        lessonTitle: q.lessonTitle || "",
        passage: q.passage || null,
        lessonNumber: q.lessonNumber !== undefined ? q.lessonNumber : null,
        image: q.image || "",
        pairs: q.pairs || [],
        items: q.items || [],
        categories: q.categories || [],
        columns: q.columns || [],
        rows: q.rows || [],
        blanks: q.blanks || [],
        labels: q.labels || []
      }));
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
      return d.exists ? docData(d) : null;
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
    /* تغيير كود الاختبار يدوياً مع نقل ربط الكود في سجل examCodes */
    setExamCode: async function (examId, newCode) {
      newCode = String(newCode || "").trim().toUpperCase();
      if (!newCode) throw new Error("الكود مطلوب");
      if (!/^[A-Z0-9]{4,12}$/.test(newCode)) throw new Error("الكود يجب أن يكون 4-12 حرفاً أو رقماً إنجليزياً");
      const exam = await store.getExam(examId);
      if (!exam) throw new Error("الاختبار غير موجود");
      const oldCode = String(exam.code || "").trim().toUpperCase();
      if (oldCode === newCode) return { code: newCode, changed: false };
      const mapDoc = await col.examCodes.doc(newCode).get();
      if (mapDoc.exists && mapDoc.data().examId !== examId) throw new Error("هذا الكود مستخدم بالفعل، اختر كوداً آخر");
      if (oldCode) { try { await col.examCodes.doc(oldCode).delete(); } catch (e) {} }
      await col.examCodes.doc(newCode).set({ examId: examId, code: newCode, createdAt: FV.serverTimestamp() });
      await col.exams.doc(examId).update({ code: newCode });
      return { code: newCode, changed: true };
    },
    /* تجديد (تدوير) كود الاختبار: يولّد كوداً جديداً ويحدّث وقت آخر تدوير */
    rotateExamCode: async function (examId) {
      const code = await uniqueExamCode();
      await store.setExamCode(examId, code);
      await col.exams.doc(examId).update({ codeRotatedAt: FV.serverTimestamp() });
      return code;
    },
    /* إنشاء تجديد الأكواد المستحقة حسب الفترة التي حدّدها المدير (يُنفَّذ عند فتح لوحة المدير) */
    runScheduledCodeRotation: async function () {
      let rotated = 0;
      const exams = await store.listExams();
      const now = Date.now();
      for (let i = 0; i < exams.length; i++) {
        const e = exams[i];
        if (!e.codeRotateEnabled) continue;
        const mins = Number(e.codeRotateMinutes) || 0;
        if (mins <= 0) continue;
        const last = tsOf(e.codeRotatedAt) || tsOf(e.createdAt) || now;
        if (now - last >= mins * 60000) {
          try { await store.rotateExamCode(e.id); rotated++; }
          catch (err) { console.warn("rotate exam code", e.id, err); }
        }
      }
      return rotated;
    },
    createExam: async function (data) {
      let code = String(data.code || "").trim().toUpperCase();
      if (code) {
        if (await store.codeExists(code)) throw new Error("هذا الكود مستخدم بالفعل، اختر كوداً آخر");
      } else {
        code = await uniqueExamCode();
      }
      const totalPoints = (data.questions || []).reduce(function (s, q) { return s + (q.points === undefined || q.points === null || q.points === "" ? 1 : Number(q.points) || 0); }, 0);
      const ref = await col.exams.add(sanitize({
        title: data.title || "",
        subjectId: data.subjectId || "",
        subjectName: data.subjectName || "",
        description: data.description || "",
        code: code,
        codeRotateEnabled: !!data.codeRotateEnabled,
        codeRotateMinutes: Number(data.codeRotateMinutes) || 0,
        codeRotatedAt: FV.serverTimestamp(),
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
        /* الإعداد المالي: اختبار مجاني أو مدفوع مع السعر وصورة رمز الدفع QR */
        isPaid: !!data.isPaid,
        price: Number(data.price) || 0,
        currency: data.currency || "ل.س",
        qrImage: data.qrImage || "",
        createdAt: FV.serverTimestamp()
      }));
      await col.examCodes.doc(code).set({ examId: ref.id, code: code, createdAt: FV.serverTimestamp() });
      return { id: ref.id, code: code };
    },
    updateExam: async function (id, data) {
      const totalPoints = (data.questions || []).reduce(function (s, q) { return s + (q.points === undefined || q.points === null || q.points === "" ? 1 : Number(q.points) || 0); }, 0);
      await col.exams.doc(id).update(sanitize(Object.assign({}, data, { totalPoints: totalPoints })));
    },
    /* تحديث جزئي لبيانات الاختبار دون المساس بالأسئلة/النقاط */
    updateExamMeta: async function (id, patch) {
      const allowed = ["isPaid", "price", "currency", "qrImage", "title", "description", "durationMin", "status", "targetGroups", "openAt", "closeAt"];
      const clean = {};
      Object.keys(patch || {}).forEach(function (k) {
        if (allowed.indexOf(k) >= 0) clean[k] = patch[k];
      });
      if (!Object.keys(clean).length) return;
      await col.exams.doc(id).update(clean);
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
      return d.exists ? docData(d) : null;
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
      return docData(snap.docs[0]);
    },
    getStudent: async function (id) {
      const d = await col.students.doc(id).get();
      return d.exists ? docData(d) : null;
    },
    addStudent: async function (data) {
      const salt = QP.crypto.genSalt(16);
      const hash = await QP.crypto.hashPassword(data.password, salt);
      const enc = QP.crypto.encryptPassword
        ? await QP.crypto.encryptPassword(data.password)
        : "";
      const username = data.username || store.makeUsername(data.name);
      const ref = await col.students.add({
        name: data.name || "",
        username: username,
        salt: salt,
        passwordHash: hash,
        passwordEnc: enc,
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
        if (QP.crypto.encryptPassword) {
          patch.passwordEnc = await QP.crypto.encryptPassword(patch.password);
        }
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
      return docData(snap.docs[0]);
    },
    removeEnrollment: async function (studentId) {
      const snap = await col.enrollments.where("studentId", "==", studentId).get();
      const groupIds = {};
      const batch = db.batch();
      for (const doc of snap.docs) {
        if (doc.data().groupId) groupIds[doc.data().groupId] = true;
        batch.delete(doc.ref);
      }
      if (snap.size > 0) await batch.commit();
      await col.students.doc(studentId).update({ groupId: null });
      const ids = Object.keys(groupIds);
      for (let i = 0; i < ids.length; i++) {
        await store.updateGroupStudentCount(ids[i]);
      }
    },
    listEnrollmentsByGroup: async function (groupId) {
      const snap = await col.enrollments.where("groupId", "==", groupId).get();
      return snapDocs(snap);
    },

    /* ============================================================
     * SUBMISSIONS
     * ============================================================ */
    addSubmission: async function (data) {
      const ref = await col.submissions.add(sanitize(Object.assign({ createdAt: FV.serverTimestamp() }, data)));
      return ref.id;
    },
    getSubmissionById: async function (id) {
      const d = await col.submissions.doc(id).get();
      return d.exists ? docData(d) : null;
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
    /* تسليمات الضيوف (دخول بالاسم + كود الاختبار) — تظهر لكل معلم يصحّح مادة الاختبار */
    listGuestSubmissionsForTeacher: async function (teacherId) {
      const snap = await col.submissions.where("isGuest", "==", true).get();
      const subs = snapDocs(snap);
      if (!subs.length) return [];
      const groups = await store.listGroupsByTeacher(teacherId);
      const subjectIds = [];
      groups.forEach(function (g) {
        (g.teacherAssignments || []).forEach(function (a) {
          if (a.teacherId === teacherId && subjectIds.indexOf(a.subjectId) < 0) subjectIds.push(a.subjectId);
        });
      });
      if (!subjectIds.length) return [];
      return subs
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
      await col.submissions.doc(id).update(sanitize(Object.assign({ gradedAt: FV.serverTimestamp() }, gradeData)));
    },
    deleteSubmission: async function (id) {
      await col.submissions.doc(id).delete();
    },
    listRecentSubmissions: async function (limit) {
      const snap = await col.submissions.get();
      return QP.utils.sortBy(snapDocs(snap), "createdAt", "desc").slice(0, limit || 20);
    },
    /* كل التسليمات (للمدير: تصحيح أي تسليم مهما كانت المادة/المجموعة) */
    listAllSubmissions: async function () {
      const snap = await col.submissions.get();
      return snapDocs(snap).sort(function (a, b) { return tsOf(b.createdAt) - tsOf(a.createdAt); });
    },
    countSubmissions: async function () {
      try {
        if (typeof col.submissions.count === "function") {
          const snap = await col.submissions.count().get();
          return snap.data().count;
        }
      } catch (e) { /* تراجع */ }
      const snap = await col.submissions.get();
      return snap.size;
    },
    countPendingSubmissions: async function () {
      try {
        if (typeof col.submissions.where("status", "==", "pending").count === "function") {
          const a = await col.submissions.where("status", "==", "pending").count().get();
          const b = await col.submissions.where("status", "==", "in_review").count().get();
          return a.data().count + b.data().count;
        }
      } catch (e) { /* تراجع */ }
      const snap = await col.submissions.get();
      return snapDocs(snap).filter(function (s) { return s.status === "pending" || s.status === "in_review"; }).length;
    },

    /* ============================================================
     * PAYMENTS - طلبات دفع الاختبارات المدفوعة
     * ============================================================ */
    createPaymentRequest: async function (data) {
      const ref = await col.payments.add(sanitize({
        examId: data.examId || "",
        examTitle: data.examTitle || "",
        subjectId: data.subjectId || "",
        subjectName: data.subjectName || "",
        studentId: data.studentId || "",
        studentName: data.studentName || "",
        groupId: data.groupId || "",
        price: Number(data.price) || 0,
        currency: data.currency || "ل.س",
        method: data.method || "sham_cash",
        txnRef: data.txnRef || "",
        note: data.note || "",
        receiptImage: data.receiptImage || "",
        status: "pending",
        decidedAt: null,
        decidedBy: "",
        createdAt: FV.serverTimestamp()
      }));
      return ref.id;
    },
    listPaymentRequests: async function () {
      const snap = await col.payments.get();
      return QP.utils.sortBy(snapDocs(snap), "createdAt", "desc");
    },
    /* طلبات الطالب (استعلام بحقل واحد لتجنّب الحاجة إلى فهرس مركّب) */
    listPaymentRequestsByStudent: async function (studentId) {
      const snap = await col.payments.where("studentId", "==", studentId).get();
      return snapDocs(snap).sort(function (a, b) { return tsOf(b.createdAt) - tsOf(a.createdAt); });
    },
    getPaymentRequest: async function (id) {
      const d = await col.payments.doc(id).get();
      return d.exists ? docData(d) : null;
    },
    /* آخر طلب لطالب على اختبار معيّن (أو المعتمد إن وُجد) */
    findPaymentRequest: async function (examId, studentId) {
      const list = await store.listPaymentRequestsByStudent(studentId);
      return (function () {
        let latest = null;
        list.forEach(function (p) {
          if (p.examId !== examId) return;
          if (!latest) latest = p;
          if (p.status === "approved") latest = p;
        });
        return latest;
      })();
    },
    /* خريطة examId -> lastStatus للطالب */
    approvalMapForStudent: async function (studentId) {
      const list = await store.listPaymentRequestsByStudent(studentId);
      const map = {};
      list.forEach(function (p) {
        if (p.status === "approved") map[p.examId] = "approved";
        else if (!map[p.examId]) map[p.examId] = p.status;
      });
      return map;
    },
    isExamPaidForStudent: async function (examId, studentId) {
      const snap = await col.payments.where("studentId", "==", studentId).get();
      return snapDocs(snap).some(function (p) { return p.examId === examId && p.status === "approved"; });
    },
    decidePaymentRequest: async function (id, status, decidedBy) {
      await col.payments.doc(id).update({
        status: status,
        decidedAt: FV.serverTimestamp(),
        decidedBy: decidedBy || ""
      });
    },
    deletePaymentRequest: async function (id) {
      await col.payments.doc(id).delete();
    },
    countPendingPayments: async function () {
      const snap = await col.payments.where("status", "==", "pending").get();
      return snapDocs(snap).filter(function (p) { return p.status === "pending"; }).length;
    },

    /* ============================================================
     * NOTIFICATIONS - إشعارات الطلاب
     * ============================================================ */
    addNotification: async function (data) {
      const ref = await col.notifications.add(sanitize(Object.assign({
        type: data.type || "general",
        title: data.title || "",
        body: data.body || "",
        studentId: data.studentId || "",
        groupId: data.groupId || "",
        examId: data.examId || "",
        read: false,
        createdAt: FV.serverTimestamp()
      }, data)));
      return ref.id;
    },
    listNotifications: async function (studentId, limit) {
      if (!studentId) return [];
      let snap = await col.notifications.where("studentId", "==", studentId).get();
      let list = snapDocs(snap);
      list.sort(function (a, b) { return tsOf(b.createdAt) - tsOf(a.createdAt); });
      if (limit) list = list.slice(0, limit);
      return list;
    },
    listNotificationsByGroup: async function (groupId, limit) {
      if (!groupId) return [];
      let snap = await col.notifications.where("groupId", "==", groupId).get();
      let list = snapDocs(snap);
      list.sort(function (a, b) { return tsOf(b.createdAt) - tsOf(a.createdAt); });
      if (limit) list = list.slice(0, limit);
      return list;
    },
    countUnreadNotifications: async function (studentId) {
      if (!studentId) return 0;
      const snap = await col.notifications.where("studentId", "==", studentId).where("read", "==", false).get();
      return snap.size;
    },
    markNotificationRead: async function (id) {
      if (!id) return;
      await col.notifications.doc(id).update({ read: true });
    },
    markAllNotificationsRead: async function (studentId) {
      if (!studentId) return;
      const snap = await col.notifications.where("studentId", "==", studentId).where("read", "==", false).get();
      const batch = db.batch();
      snap.docs.forEach(function (d) {
        batch.update(col.notifications.doc(d.id), { read: true });
      });
      if (snap.size > 0) await batch.commit();
    },
    deleteNotification: async function (id) {
      if (!id) return;
      await col.notifications.doc(id).delete();
    },

    /* ============================================================
     * ENGLISH EXAM BUILDER - مقاطع اللغة الإنكليزية وأسئلة النموذج
     * ============================================================ */
    listEngPassages: async function () {
      const snap = await col.engPassages.get();
      return QP.utils.sortBy(snapDocs(snap), "createdAt", "desc");
    },
    addEngPassage: async function (data) {
      data = data || {};
      const ref = await col.engPassages.add(sanitize({
        title: data.title || "",
        text: data.text || "",
        notes: data.notes || "",
        unitNumber: (data.unitNumber !== undefined && data.unitNumber !== null && data.unitNumber !== "") ? Number(data.unitNumber) : null,
        unitTitle: data.unitTitle || "",
        createdAt: FV.serverTimestamp()
      }));
      return ref.id;
    },
    updateEngPassage: async function (id, data) {
      data = data || {};
      await col.engPassages.doc(id).update(sanitize({
        title: data.title || "",
        text: data.text || "",
        notes: data.notes || "",
        unitNumber: (data.unitNumber !== undefined && data.unitNumber !== null && data.unitNumber !== "") ? Number(data.unitNumber) : null,
        unitTitle: data.unitTitle || ""
      }));
    },
    deleteEngPassage: async function (id) {
      const qs = await col.engItems.where("passageId", "==", id).get();
      const batch = db.batch();
      qs.docs.forEach(function (d) { batch.delete(d.ref); });
      if (qs.size) await batch.commit();
      await col.engPassages.doc(id).delete();
    },
    listEngItems: async function (filter) {
      filter = filter || {};
      let snap;
      if (filter.passageId) snap = await col.engItems.where("passageId", "==", filter.passageId).get();
      else if (filter.typeKey) snap = await col.engItems.where("typeKey", "==", filter.typeKey).get();
      else snap = await col.engItems.get();
      let list = snapDocs(snap);
      list = list.filter(function (it) {
        if (filter.typeKey && it.typeKey !== filter.typeKey) return false;
        if (filter.subtypeKey && it.subtypeKey !== filter.subtypeKey) return false;
        if (filter.passageId && it.passageId !== filter.passageId) return false;
        return true;
      });
      return QP.utils.sortBy(list, "createdAt", "asc");
    },
    addEngItem: async function (data) {
      data = data || {};
      const ref = await col.engItems.add(sanitize({
        typeKey: data.typeKey || "",
        subtypeKey: data.subtypeKey || "",
        passageId: data.passageId || "",
        unitNumber: (data.unitNumber !== undefined && data.unitNumber !== null && data.unitNumber !== "") ? Number(data.unitNumber) : null,
        unitTitle: data.unitTitle || "",
        title: data.title || "",
        text: data.text || "",
        options: data.options || [],
        answer: data.answer || "",
        format: data.format || "",
        points: Number(data.points) || 1,
        createdAt: FV.serverTimestamp()
      }));
      return ref.id;
    },
    addEngItemsBulk: async function (list) {
      let batch = db.batch();
      let count = 0;
      for (const data of (list || [])) {
        const ref = col.engItems.doc();
        batch.set(ref, sanitize({
          typeKey: data.typeKey || "",
          subtypeKey: data.subtypeKey || "",
          passageId: data.passageId || "",
          unitNumber: (data.unitNumber !== undefined && data.unitNumber !== null && data.unitNumber !== "") ? Number(data.unitNumber) : null,
          unitTitle: data.unitTitle || "",
          title: data.title || "",
          text: data.text || "",
          options: data.options || [],
          answer: data.answer || "",
          format: data.format || "",
          points: Number(data.points) || 1,
          createdAt: FV.serverTimestamp()
        }));
        count++;
        if (count % 400 === 0) { await batch.commit(); batch = db.batch(); }
      }
      if (count % 400 !== 0 || count === 0) await batch.commit();
      return count;
    },
    updateEngItem: async function (id, data) {
      data = data || {};
      await col.engItems.doc(id).update(sanitize({
        typeKey: data.typeKey || "",
        subtypeKey: data.subtypeKey || "",
        passageId: data.passageId || "",
        unitNumber: (data.unitNumber !== undefined && data.unitNumber !== null && data.unitNumber !== "") ? Number(data.unitNumber) : null,
        unitTitle: data.unitTitle || "",
        title: data.title || "",
        text: data.text || "",
        options: data.options || [],
        answer: data.answer || "",
        format: data.format || "",
        points: Number(data.points) || 1
      }));
    },
    deleteEngItem: async function (id) {
      await col.engItems.doc(id).delete();
    },
    getEngModel: async function () {
      const d = await col.engConfig.doc("model").get();
      return d.exists ? docData(d) : null;
    },
    saveEngModel: async function (model) {
      await col.engConfig.doc("model").set(sanitize({
        types: (model && model.types) || [],
        updatedAt: FV.serverTimestamp()
      }), { merge: true });
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
      return d.exists ? docData(d) : null;
    },
    getTeacherByUsername: async function (username) {
      const uname = String(username || "").trim().toLowerCase();
      if (!uname) return null;
      const snap = await col.teachers.where("username", "==", uname).limit(1).get();
      if (snap.empty) return null;
      return docData(snap.docs[0]);
    },
    addTeacher: async function (data) {
      const salt = QP.crypto.genSalt(16);
      const hash = await QP.crypto.hashPassword(data.password, salt);
      const enc = QP.crypto.encryptPassword
        ? await QP.crypto.encryptPassword(data.password)
        : "";
      const ref = await col.teachers.add({
        name: data.name || "",
        username: String(data.username || "").trim().toLowerCase(),
        salt: salt,
        passwordHash: hash,
        passwordEnc: enc,
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
        if (QP.crypto.encryptPassword) {
          patch.passwordEnc = await QP.crypto.encryptPassword(patch.password);
        }
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
    },

    /* بيانات التواصل (تُحرّر من إعدادات المدير وتظهر في صفحة الطالب) */
    DEFAULT_CONTACT: {
      text: "للتواصل مع مشرف التطبيق",
      phone: "+963957360935"
    },
    getContactInfo: async function () {
      let remote = null;
      try {
        const d = await col.settings.doc("contact").get();
        if (d.exists && d.data()) {
          remote = {
            text: (d.data().text || store.DEFAULT_CONTACT.text),
            phone: (d.data().phone || store.DEFAULT_CONTACT.phone)
          };
          try { localStorage.setItem("qp_contact", JSON.stringify(remote)); } catch (e2) {}
          return remote;
        }
      } catch (e) { /* قد تُحجب القراءة — نستخدم النسخة المحلية */ }
      /* احتياطي: آخر نسخة محفوظة محلياً، وإلا الافتراضي */
      try {
        const cached = localStorage.getItem("qp_contact");
        if (cached) { const c = JSON.parse(cached); if (c && c.text) return c; }
      } catch (e3) {}
      return Object.assign({}, store.DEFAULT_CONTACT);
    },
    setContactInfo: async function (info) {
      const clean = {
        text: (info && info.text) || store.DEFAULT_CONTACT.text,
        phone: (info && info.phone) || store.DEFAULT_CONTACT.phone
      };
      /* نسخة محلية فورية حتى لو تعذّرت الكتابة/القراءة السحابية */
      try { localStorage.setItem("qp_contact", JSON.stringify(clean)); } catch (e) {}
      await col.settings.doc("contact").set(Object.assign({}, clean, {
        updatedAt: FV.serverTimestamp()
      }), { merge: true });
    }
  };

  QP.store = store;
  console.log("[store.js] تم التحميل ✅");
})();