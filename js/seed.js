(function () {
  const QP = window.QP;
  const S = QP.store;
  const FV = QP.FieldValue;

  const SUBJECT_NAME = "الفلسفة";
  const SEED_FLAG = "philosophy_v1";
  const SEED_VERSION = "2";
  const DATA_URL = "data/philosophy.json";
  const DEFAULT_DESC = "بنك أسئلة الفلسفة — الصف الثالث الثانوي الأدبي (جميع الوحدات)";

  function seedsRef() { return QP.db.collection("settings").doc("seeds"); }

  async function getFlags() {
    const snap = await seedsRef().get();
    return snap.exists ? snap.data() : {};
  }

  async function setFlag(value) {
    const payload = {};
    payload[SEED_FLAG] = value;
    await seedsRef().set(payload, { merge: true });
  }

  async function loadBank() {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("تعذّر تحميل ملف بنك الفلسفة (" + res.status + ")");
    return res.json();
  }

  function pick(obj, camel, snake) {
    if (obj[camel] !== undefined) return obj[camel];
    if (obj[snake] !== undefined) return obj[snake];
    return undefined;
  }

  function flatten(bank) {
    const out = [];
    (bank.units || []).forEach(function (unit) {
      const unitNumber = pick(unit, "unitNumber", "unit_number");
      const unitTitle = pick(unit, "unitTitle", "unit_title") || "";
      (unit.lessons || []).forEach(function (lesson) {
        const lessonNumber = pick(lesson, "lessonNumber", "lesson_number");
        const lessonTitle = pick(lesson, "lessonTitle", "lesson_title") || "";
        const passage = lesson.passage || unit.passage || null;
        (lesson.questions || []).forEach(function (q) {
          out.push({
            type: q.type,
            text: q.text,
            options: q.options || [],
            answer: q.answer,
            explanation: q.explanation || "",
            points: q.points || 10,
            difficulty: q.difficulty || "medium",
            tags: q.tags || [],
            unitNumber: unitNumber !== undefined ? unitNumber : null,
            unitTitle: unitTitle,
            lessonNumber: lessonNumber !== undefined ? lessonNumber : null,
            lessonTitle: lessonTitle,
            passage: q.passage || passage
          });
        });
      });
    });
    return out;
  }

  async function status() {
    const flags = await getFlags();
    const subjects = await S.listSubjects();
    const subject = subjects.find(function (s) { return s.name === SUBJECT_NAME; }) || null;
    let count = 0;
    if (subject) count = await S.listQuestions(subject.id).then(function (l) { return l.length; });
    return {
      installed: !!flags[SEED_FLAG],
      flag: flags[SEED_FLAG] || null,
      subject: subject,
      count: count
    };
  }

  async function install(opts) {
    opts = opts || {};
    const flags = await getFlags();
    const current = flags[SEED_FLAG] || null;
    const currentVersion = current ? String(current.version || "1") : null;
    const upToDate = currentVersion !== null && currentVersion >= SEED_VERSION;
    if (upToDate && !opts.force) {
      return { skipped: true, reason: "up-to-date", version: currentVersion };
    }

    const bank = await loadBank();
    const list = flatten(bank);
    if (!list.length) throw new Error("البنك فارغ");

    const subjects = await S.listSubjects();
    let subject = subjects.find(function (s) { return s.name === SUBJECT_NAME; }) || null;

    if (subject && (opts.reset || current)) {
      await S.deleteSubject(subject.id);
      subject = null;
    }

    if (!subject) {
      const id = await S.addSubject({ name: SUBJECT_NAME, description: bank.description || DEFAULT_DESC });
      subject = { id: id, name: SUBJECT_NAME };
    }

    const count = await S.addQuestionsBulk(list, subject.id, SUBJECT_NAME);
    await setFlag({
      installedAt: new Date().toISOString(),
      count: count,
      subjectId: subject.id,
      version: SEED_VERSION
    });
    return { skipped: false, upgraded: currentVersion !== null, count: count, subjectId: subject.id, subjectName: SUBJECT_NAME };
  }

  QP.seed = {
    SUBJECT_NAME: SUBJECT_NAME,
    SEED_FLAG: SEED_FLAG,
    SEED_VERSION: SEED_VERSION,
    DATA_URL: DATA_URL,
    loadBank: loadBank,
    flatten: flatten,
    status: status,
    install: install
  };

  console.log("[seed.js] جاهز — QP.seed");
})();
