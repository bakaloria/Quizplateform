(function () {
  const QP = window.QP;
  const U = QP.utils;

  function itemAnalysis(submissions, exam) {
    const total = submissions.length;
    if (!total) return [];
    const questions = exam.questions || [];
    const results = [];

    const sorted = submissions.slice().sort((a, b) => (b.percent || 0) - (a.percent || 0));
    const top27 = sorted.slice(0, Math.max(1, Math.floor(total * 0.27)));
    const bottom27 = sorted.slice(-Math.max(1, Math.floor(total * 0.27)));

    questions.forEach((q, idx) => {
      let correctCount = 0;
      let totalAttempted = 0;

      submissions.forEach((sub) => {
        const a = (sub.answers || [])[idx];
        if (!a) return;
        totalAttempted++;
        if (a.finalCorrect === true) correctCount++;
      });

      const p = totalAttempted > 0 ? correctCount / totalAttempted : 0;

      let topCorrect = 0, bottomCorrect = 0;
      top27.forEach((sub) => {
        const a = (sub.answers || [])[idx];
        if (a && a.finalCorrect === true) topCorrect++;
      });
      bottom27.forEach((sub) => {
        const a = (sub.answers || [])[idx];
        if (a && a.finalCorrect === true) bottomCorrect++;
      });
      const d = top27.length && bottom27.length
        ? (topCorrect / top27.length) - (bottomCorrect / bottom27.length)
        : 0;

      results.push({
        index: idx,
        text: q.text,
        type: q.type,
        points: q.points || 1,
        correctRate: Math.round(p * 100),
        discrimination: Math.round(d * 100) / 100,
        difficulty: p > 0.85 ? "سهل جداً" : p < 0.3 ? "صعب جداً" : "مناسب",
        flagged: p > 0.9 || p < 0.2 || d < 0.1
      });
    });

    return results;
  }

  function scoreDistribution(submissions) {
    const buckets = [0, 20, 40, 60, 80, 100];
    const counts = [0, 0, 0, 0, 0];
    submissions.forEach((s) => {
      if (s.percent == null) return;
      const i = Math.min(4, Math.floor(s.percent / 20));
      counts[i]++;
    });
    return buckets.map((b, i) => ({ label: b + "-" + buckets[i + 1], count: counts[i] }));
  }

  function averageTimePerQuestion(submissions) {
    const durations = {};
    submissions.forEach((sub) => {
      const dur = sub.durationSec || 0;
      const count = (sub.answers || []).length || 1;
      const perQ = dur / count;
      (sub.answers || []).forEach((a) => {
        const key = a.qIndex;
        if (!durations[key]) durations[key] = { sum: 0, count: 0 };
        durations[key].sum += perQ;
        durations[key].count++;
      });
    });
    return durations;
  }

  async function studentCumulative(studentName) {
    const subs = await QP.store.listSubmissionsByStudent(studentName);
    const graded = subs.filter((s) => s.status === "graded" && s.percent !== null);
    if (!graded.length) return { subs: subs.length, avg: 0, best: 0, worst: 0, trend: [] };

    const percents = graded.map((s) => s.percent);
    const avg = Math.round(percents.reduce((a, b) => a + b, 0) / percents.length);
    const trend = graded.slice(0, 10).reverse().map((s, i) => ({
      label: "#" + (i + 1),
      value: s.percent,
      exam: s.examTitle
    }));
    return {
      subs: subs.length,
      gradedCount: graded.length,
      avg: avg,
      best: Math.max.apply(null, percents),
      worst: Math.min.apply(null, percents),
      trend: trend
    };
  }

  function compareBySubject(allSubmissions, subjects) {
    const map = {};
    subjects.forEach((s) => { map[s.id] = { name: s.name, percents: [] }; });
    allSubmissions.forEach((sub) => {
      if (sub.subjectId && map[sub.subjectId] && sub.percent != null) {
        map[sub.subjectId].percents.push(sub.percent);
      }
    });
    return Object.values(map).map((s) => ({
      name: s.name,
      count: s.percents.length,
      avg: s.percents.length ? Math.round(s.percents.reduce((a, b) => a + b, 0) / s.percents.length) : 0
    })).filter((s) => s.count > 0);
  }

  function problematicQuestions(analysis) {
    return analysis.filter((a) => a.flagged);
  }

  QP.analytics = {
    itemAnalysis,
    scoreDistribution,
    averageTimePerQuestion,
    studentCumulative,
    compareBySubject,
    problematicQuestions
  };
})();