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
    engConfig: db.collection("engConfig"),
    examTemplates: db.collection("examTemplates"),
    /* نسخة احتياطية من إعدادات التواصل (قد تكون مجموعة settings محجوبة) */
    config: db.collection("config")
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
          /* النماذج الجديدة لا تظهر إلا بعد اعتمادها ونشرها؛ الاختبارات القديمة تبقى كما هي */
          if (e.modelFamily === "philosophy-official-models" && (e.status !== "published" || e.isApproved !== true)) return false;
          if (e.modelFamily !== "philosophy-official-models" && e.status === "draft") return false;
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
      const exam = await store.getExam(mapDoc.data().examId);
      if (!exam) return null;
      if (exam.modelFamily === "philosophy-official-models" && (exam.status !== "published" || exam.isApproved !== true)) return null;
      return exam;
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
        modelFamily: data.modelFamily || "",
        isApproved: data.isApproved === true,
        createdBy: data.createdBy || "",
        seriesNo: Number(data.seriesNo) || 0,
        templateKey: data.templateKey || "",
        templateName: data.templateName || "",
        baseExamId: data.baseExamId || "",
        versionNo: Number(data.versionNo) || 1,
        versionStatus: data.versionStatus || "published",
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
      const existingSubs = await store.listSubmissionsByExam(id);
      if (existingSubs.length) throw new Error("لا يمكن تعديل اختبار بدأ الطلاب بحله؛ أنشئ إصدارًا جديدًا بدلًا منه");
      const totalPoints = (data.questions || []).reduce(function (s, q) { return s + (q.points === undefined || q.points === null || q.points === "" ? 1 : Number(q.points) || 0); }, 0);
      await col.exams.doc(id).update(sanitize(Object.assign({}, data, { totalPoints: totalPoints })));
    },
    countSubmissionsByExam: async function (examId) {
      return (await store.listSubmissionsByExam(examId)).length;
    },
    /* تحديث جزئي لبيانات الاختبار دون المساس بالأسئلة/النقاط */
    updateExamMeta: async function (id, patch) {
      const allowed = ["isPaid", "price", "currency", "qrImage", "title", "description", "durationMin", "status", "isApproved", "targetGroups", "openAt", "closeAt"];
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
    listPublicGroups: async function () {
      const snap = await col.groups.where("private", "==", false).get();
      return QP.utils.sortBy(snapDocs(snap), "createdAt", "desc");
    },
    getGroup: async function (id) {
      const d = await col.groups.doc(id).get();
      return d.exists ? docData(d) : null;
    },
    getGroupBySecretCode: async function (code) {
      code = String(code || "").trim().toUpperCase();
      if (!code) return null;
      const snap = await col.groups.get();
      const groups = snapDocs(snap);
      return groups.find(function (g) { return g.private === true && String(g.secretCode || "").toUpperCase() === code; }) || null;
    },
    addGroup: async function (data) {
      // data: { name, description, teacherAssignments: [{teacherId, subjectId}], active }
      const secret = data.private === true;
      const secretCode = secret ? String(data.secretCode || QP.utils.code(8)).trim().toUpperCase() : "";
      if (secret) {
        const existing = await col.groups.where("secretCode", "==", secretCode).get();
        if (!existing.empty) throw new Error("رمز المجموعة مستخدم، اختر رمزًا آخر");
      }
      const ref = await col.groups.add({
        name: data.name || "",
        description: data.description || "",
        teacherAssignments: data.teacherAssignments || [],
        studentCount: 0,
        active: data.active !== false,
        private: secret,
        secretCode: secretCode,
        createdAt: FV.serverTimestamp()
      });
      return ref.id;
    },
    updateGroup: async function (id, data) {
      const patch = Object.assign({}, data);
      if (patch.private === true && patch.secretCode) {
        patch.secretCode = String(patch.secretCode).trim().toUpperCase();
        const existing = await col.groups.where("secretCode", "==", patch.secretCode).get();
        if (existing.docs.some(function (d) { return d.id !== id; })) throw new Error("رمز المجموعة مستخدم، اختر رمزًا آخر");
      }
      if (patch.private === false) patch.secretCode = "";
      await col.groups.doc(id).update(patch);
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
    listEnrollmentsByGroup: async function (groupId) {
      if (!groupId) return [];
      const snap = await col.enrollments.where("groupId", "==", groupId).get();
      return snapDocs(snap);
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
        teacherId: data.teacherId || "",
        recipientType: data.recipientType || (data.studentId ? "student" : data.teacherId ? "teacher" : "admin"),
        recipientId: data.recipientId || data.studentId || data.teacherId || "admin",
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
    listNotificationsForUser: async function (recipientType, recipientId, limit) {
      if (!recipientType || !recipientId) return [];
      const snap = await col.notifications.where("recipientType", "==", recipientType).get();
      let list = snapDocs(snap).filter(function (n) { return n.recipientId === recipientId; });
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
    countUnreadNotificationsForUser: async function (recipientType, recipientId) {
      if (!recipientType || !recipientId) return 0;
      const snap = await col.notifications.where("recipientType", "==", recipientType).where("read", "==", false).get();
      return snapDocs(snap).filter(function (n) { return n.recipientId === recipientId; }).length;
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
    markAllNotificationsReadForUser: async function (recipientType, recipientId) {
      if (!recipientType || !recipientId) return;
      const snap = await col.notifications.where("recipientType", "==", recipientType).where("read", "==", false).get();
      const batch = db.batch();
      snap.docs.filter(function (d) { return d.data().recipientId === recipientId; }).forEach(function (d) { batch.update(col.notifications.doc(d.id), { read: true }); });
      if (snap.docs.some(function (d) { return d.data().recipientId === recipientId; })) await batch.commit();
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

    /* ============================================================
     * EXAM TEMPLATES - قوالب نماذج الامتحانات العامة
     * ============================================================ */
    saveExamTemplate: async function (data) {
      const ref = await col.examTemplates.add(sanitize({
        subjectId: data.subjectId || "",
        subjectName: data.subjectName || "",
        name: data.name || "قالب نموذج امتحاني",
        active: data.active !== false,
        sections: data.sections || [],
        rules: data.rules || { avoidDuplicates: true, randomizeSections: false },
        questions: data.questions || [],
        publishedExamId: data.publishedExamId || "",
        sourceModel: data.sourceModel || null,
        templateKey: data.templateKey || "",
        createdAt: FV.serverTimestamp(),
        updatedAt: FV.serverTimestamp()
      }));
      return ref.id;
    },
    listExamTemplates: async function (subjectId) {
      try {
        let snap;
        if (subjectId) {
          try {
            snap = await col.examTemplates.where("subjectId", "==", subjectId).get();
          } catch (e) {
            snap = await col.examTemplates.get();
          }
        } else {
          snap = await col.examTemplates.get();
        }
        let list = snapDocs(snap);
        if (subjectId) list = list.filter(function (t) { return t.subjectId === subjectId; });
        return QP.utils.sortBy(list, "createdAt", "desc");
      } catch (e) {
        return [];
      }
    },
    getExamTemplate: async function (id) {
      try {
        const d = await col.examTemplates.doc(id).get();
        return d.exists ? docData(d) : null;
      } catch (e) {
        return null;
      }
    },
    updateExamTemplate: async function (id, data) {
      try {
        const current = await store.getExamTemplate(id);
        const versioned = data && data._skipVersion !== true && current && (data.questions || data.name || data.sections || data.rules);
        const patch = Object.assign({}, data);
        delete patch._skipVersion;
        if (versioned) {
          const versions = Array.isArray(current.versions) ? current.versions.slice(-19) : [];
          versions.push({ versionNo: versions.length + 1, at: new Date().toISOString(), snapshot: { name: current.name || "", questions: current.questions || [], sections: current.sections || [], rules: current.rules || {} } });
          patch.versions = versions;
          patch.versionNo = versions.length;
        }
        await col.examTemplates.doc(id).update(sanitize(Object.assign({}, patch, { updatedAt: FV.serverTimestamp() })));
      } catch (e) { throw e; }
    },
    listTemplateVersions: async function (id) {
      const t = await store.getExamTemplate(id);
      return t && Array.isArray(t.versions) ? t.versions : [];
    },
    restoreTemplateVersion: async function (id, version) {
      if (!version || !version.snapshot) throw new Error("الإصدار غير صالح");
      await store.updateExamTemplate(id, Object.assign({}, version.snapshot, { _skipVersion: true }));
    },
    deleteExamTemplate: async function (id) {
      try {
        await col.examTemplates.doc(id).delete();
      } catch (e) { }
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
    /* ============================================================
     * كلمة مرور المدير — لا تُخزَّن نصّاً صريحاً إطلاقاً
     * تُخزَّن: hash (تجزئة) + salt (ملح) + iter (التكرارات) + algo
     * ============================================================ */
    ADMIN_PASS_ITER: 120000,
    ADMIN_PASS_FALLBACK_ITER: 20000,
    ADMIN_DEFAULT_PASS: "admin123",

    /* يقرأ سجل كلمة مرور المدير (مع带回 legacy للترحيل فقط) */
    getAdminPassRecord: async function () {
      try {
        const d = await col.settings.doc("admin").get();
        if (d.exists && d.data()) {
          const data = d.data();
          return {
            hash: typeof data.hash === "string" && data.hash ? data.hash : null,
            salt: typeof data.salt === "string" && data.salt ? data.salt : null,
            iter: data.iter || null,
            algo: typeof data.algo === "string" && data.algo ? data.algo : null,
            /* كلمة المرور القديمة النصّية — تُستخدم للترحيل ثم تُحذف */
            legacy: (typeof data.pass === "string" && data.pass !== "") ? data.pass : null
          };
        }
      } catch (e) { /* المستند غير موجود أو محجوب */ }
      return { hash: null, salt: null, iter: null, algo: null, legacy: null, missing: true };
    },

    /* واجهة عامة آمنة — لا تعيد كلمة المرور أبداً */
    getAdminPass: async function () {
      const rec = await store.getAdminPassRecord();
      return {
        hashed: !!(rec.hash && rec.salt),
        algo: rec.algo,
        created: !!rec.missing
      };
    },

    /* تسجيل دخول المدير: يقارن بالتجزئة، ويترحّل تلقائياً من النص الصريح */
    verifyAdminPass: async function (input) {
      const pass = String(input === undefined || input === null ? "" : input);
      const rec = await store.getAdminPassRecord();
      const cr = QP.crypto;

      /* 1) سجل مُجزّأ */
      if (rec.hash && rec.salt) {
        const ok = await cr.verifySecret(pass, rec.salt, rec.iter, rec.algo, rec.hash);
        return { ok: !!ok, migrated: false };
      }

      /* 2) كلمة مرور قديمة نصّية => نقارن ثم نرحّلها إلى تجزئة */
      if (rec.legacy) {
        if (pass !== rec.legacy) return { ok: false, migrated: false };
        await store.setAdminPass(rec.legacy);
        return { ok: true, migrated: true };
      }

      /* 3) لا يوجد سجل => كلمة المرور الافتراضية (وننشئ سجلاً مُجزّأً) */
      if (pass === store.ADMIN_DEFAULT_PASS) {
        await store.setAdminPass(store.ADMIN_DEFAULT_PASS);
        return { ok: true, migrated: true, created: true };
      }

      return { ok: false, migrated: false };
    },

    /* يحفظ كلمة المرور مُجزّأة ويحذف النسخة النصّية القديمة */
    setAdminPass: async function (pass) {
      const cr = QP.crypto;
      const salt = cr.genSalt(24);
      const useSubtle = cr.hasSubtle();
      const iter = useSubtle ? store.ADMIN_PASS_ITER : store.ADMIN_PASS_FALLBACK_ITER;
      const algo = useSubtle ? "pbkdf2" : "sha256x";
      const hash = await cr.hashSecret(pass, salt, iter, algo);
      const patch = {
        hash: hash,
        salt: salt,
        iter: iter,
        algo: algo,
        updatedAt: FV.serverTimestamp()
      };
      /* حذف النسخة النصّية القديمة إن وُجدت (منع تسريبها) */
      try { patch.pass = FV.delete(); } catch (e) { /* delete غير متاح */ }
      await col.settings.doc("admin").set(patch, { merge: true });
    },

    /* بيانات التواصل (تُحرّر من إعدادات المدير وتظهر في صفحة الطالب) */
    DEFAULT_CONTACT: {
      text: "",
      phone: "",
      bg: "#f7fbff",
      marquee: "للتواصل مع مشرف التطبيق عبر واتساب"
    },
    /* يميّز بين الحقل غير المُرسَل (undefined) والقيمة الفارغة عمداً ("") */
    _pick: function (val, def) {
      if (val === undefined || val === null) return def;
      return String(val).trim();
    },
    /* يقرأ رسالة التواصل من أول مصدر متاح (يُقرأ من Firestore ثم من النسخة المحلية) */
    getContactInfo: async function () {
      const sources = [
        function () { return col.settings.doc("contact").get(); },
        function () { return col.config.doc("contact").get(); }
      ];
      for (let i = 0; i < sources.length; i++) {
        try {
          const d = await sources[i]();
          if (d && d.exists && d.data()) {
            const data = d.data();
            const remote = {
              text: store._pick(data.text, store.DEFAULT_CONTACT.text),
              phone: store._pick(data.phone, store.DEFAULT_CONTACT.phone),
              bg: store._pick(data.bg, store.DEFAULT_CONTACT.bg),
              marquee: store._pick(data.marquee, store.DEFAULT_CONTACT.marquee)
            };
            try { localStorage.setItem("qp_contact", JSON.stringify(remote)); } catch (e2) {}
            return remote;
          }
        } catch (e) { /* المصدر غير متاح — نجرّب التالي */ }
      }
      /* احتياطي: آخر نسخة محفوظة محلياً، وإلا الافتراضي */
      try {
        const cached = localStorage.getItem("qp_contact");
        if (cached) {
          const c = JSON.parse(cached);
          if (c && typeof c.text === "string") {
            return {
              text: typeof c.text === "string" ? c.text : store.DEFAULT_CONTACT.text,
              phone: typeof c.phone === "string" ? c.phone : store.DEFAULT_CONTACT.phone,
              bg: typeof c.bg === "string" ? c.bg : store.DEFAULT_CONTACT.bg,
              marquee: typeof c.marquee === "string" ? c.marquee : store.DEFAULT_CONTACT.marquee
            };
          }
        }
      } catch (e3) {}
      return Object.assign({}, store.DEFAULT_CONTACT);
    },
    setContactInfo: async function (info) {
      const clean = {
        /* النص: يُملأ والقيمة الفارغة تُعتمد كما هي */
        text: (info && info.text !== undefined && info.text !== null)
          ? String(info.text)
          : store.DEFAULT_CONTACT.text,
        /* الرقم: فارغ = لا رابط إطلاقاً (لا يُستبدل بالافتراضي) */
        phone: (info && info.phone !== undefined && info.phone !== null)
          ? String(info.phone).trim()
          : store.DEFAULT_CONTACT.phone,
        bg: (info && info.bg !== undefined && info.bg !== null)
          ? String(info.bg).trim()
          : store.DEFAULT_CONTACT.bg,
        marquee: (info && info.marquee !== undefined && info.marquee !== null)
          ? String(info.marquee).trim()
          : store.DEFAULT_CONTACT.marquee
      };
      /* نسخة محلية فورية حتى لو تعذّرت الكتابة/القراءة السحابية */
      try { localStorage.setItem("qp_contact", JSON.stringify(clean)); } catch (e) {}

      /* نكتب في مصدرين لزيادة احتمال توفّر القراءة للطالب */
      const targets = [
        function () { return col.settings.doc("contact").set(Object.assign({}, clean, { updatedAt: FV.serverTimestamp() }), { merge: true }); },
        function () { return col.config.doc("contact").set(Object.assign({}, clean, { updatedAt: FV.serverTimestamp() }), { merge: true }); }
      ];
      let lastErr = null;
      let ok = false;
      for (let i = 0; i < targets.length; i++) {
        try { await targets[i](); ok = true; }
        catch (e) { lastErr = e; }
      }
      if (!ok && lastErr) throw lastErr;
    }
  };

  QP.store = store;
  console.log("[store.js] تم التحميل ✅");
})();
