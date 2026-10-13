(function () {
  const QP = window.QP;
  const S = QP.store;
  const FV = QP.FieldValue;

  /* قائمة بنوك الأسئلة الجاهزة (يُثبَّت كل منها كمادة مستقلة) */
  const DATASETS = [
    {
      subject: "الفلسفة",
      flag: "philosophy_v1",
      version: "3",
      url: "data/philosophy.json",
      desc: "بنك أسئلة الفلسفة — الصف الثالث الثانوي الأدبي (جميع الوحدات)"
    },
    {
      subject: "علم الأحياء",
      flag: "biology_v1",
      version: "1",
      url: "data/biology.json",
      desc: "بنك أسئلة علم الأحياء — الصف الثالث الثانوي العلمي (جميع الوحدات)"
    }
  ];

  /* توافقية رجعية: المادة الأولى */
  const SUBJECT_NAME = DATASETS[0].subject;
  const SEED_FLAG = DATASETS[0].flag;
  const SEED_VERSION = DATASETS[0].version;
  const DATA_URL = DATASETS[0].url;
  const DEFAULT_DESC = DATASETS[0].desc;

  function seedsRef() { return QP.db.collection("settings").doc("seeds"); }

  async function getFlags() {
    const snap = await seedsRef().get();
    return snap.exists ? snap.data() : {};
  }

  async function setFlag(flagKey, value) {
    const payload = {};
    payload[flag] = value;
    await seedsRef().set(payload, { merge: true });
  }

  async function loadBank(url) {
    const u = url || DATASETS[0].url;
    const res = await fetch(u, { cache: "no-store" });
    if (!res.ok) throw new Error("تعذّر تحميل ملف البنك (" + res.status + ")");
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
            answer_index: q.answer_index,
            explanation: q.explanation || "",
            points: q.points || 10,
            difficulty: q.difficulty || "medium",
            tags: q.tags || [],
            /* الحقول البنيوية للأنماط الجديدة */
            image: q.image || "",
            pairs: q.pairs || [],
            items: q.items || [],
            categories: q.categories || [],
            columns: q.columns || [],
            rows: q.rows || [],
            blanks: q.blanks || [],
            labels: q.labels || [],
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

  function statusFor(ds) {
    return getFlags().then(function (flags) {
      return S.listSubjects().then(function (subjects) {
        const subject = subjects.find(function (s) { return s.name === ds.subject; }) || null;
        let count = 0;
        const p = subject
          ? S.listQuestions(subject.id).then(function (l) { count = l.length; })
          : Promise.resolve();
        return p.then(function () {
          return {
            subject: ds.subject,
            flag: ds.flag,
            url: ds.url,
            installed: !!flags[ds.flag],
            flagValue: flags[ds.flag] || null,
            subjectRecord: subject,
            count: count
          };
        });
      });
    });
  }

  function statusAll() {
    return Promise.all(DATASETS.map(function (ds) { return statusFor(ds); }));
  }

  /* توافق خلفي: حالة المادة الأولى */
  function status() { return statusFor(DATASETS[0]); }

  async function installDataset(ds, opts) {
    opts = opts || {};
    const flags = await getFlags();
    const current = flags[ds.flag] || null;
    const currentVersion = current ? String(current.version || "1") : null;
    const upToDate = currentVersion !== null && currentVersion >= ds.version;
    if (upToDate && !opts.force) {
      return { skipped: true, reason: "up-to-date", subject: ds.subject, version: currentVersion };
    }

    const bank = await loadBank(ds.url);
    const list = flatten(bank);
    if (!list.length) throw new Error("البنك فارغ: " + ds.subject);

    const subjects = await S.listSubjects();
    let subject = subjects.find(function (s) { return s.name === ds.subject; }) || null;

    if (subject && (opts.reset || current)) {
      await S.deleteSubject(subject.id);
      subject = null;
    }

    if (!subject) {
      const id = await S.addSubject({ name: ds.subject, description: bank.description || ds.desc });
      subject = { id: id, name: ds.subject };
    }

    const count = await S.addQuestionsBulk(list, subject.id, ds.subject);
    const flagValue = {
      installedAt: new Date().toISOString(),
      count: count,
      subjectId: subject.id,
      version: ds.version
    };
    const payload = {};
    payload[ds.flag] = flagValue;
    await QP.db.collection("settings").doc("seeds").set(payload, { merge: true });

    return {
      skipped: false,
      upgraded: currentVersion !== null,
      subject: ds.subject,
      count: count,
      subjectId: subject.id,
      subjectName: ds.subject
    };
  }

  /* تثبيت كل البنوك */
  async function install(opts) {
    opts = opts || {};
    const results = [];
    for (let i = 0; i < DATASETS.length; i++) {
      results.push(await installDataset(DATASETS[i], opts));
    }
    const total = results.reduce(function (s, r) { return s + (r.count || 0); }, 0);
    return { results: results, count: total, subjectName: DATASETS.map(function (d) { return d.subject; }).join(" + ") };
  }

  QP.seed = {
    DATASETS: DATASETS,
    /* توافق خلفي */
    SUBJECT_NAME: DATASETS[0].subject,
    SEED_FLAG: DATASETS[0].flag,
    SEED_VERSION: DATASETS[0].version,
    DATA_URL: DATASETS[0].url,
    /* واجهات */
    loadBank: loadBank,
    flatten: flatten,
    status: status,
    statusAll: statusAll,
    statusFor: statusFor,
    install: install,
    installDataset: installDataset,
    datasetByName: function (name) { return DATASETS.find(function (d) { return d.subject === name; }) || null; }
  };

  console.log("[seed.js] جاهز — QP.seed (بنوك: " + DATASETS.map(function (d) { return d.subject; }).join(", ") + ")");
})();
