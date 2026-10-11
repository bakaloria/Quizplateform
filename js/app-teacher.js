(function () {
  const QP = window.QP;

  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "dark");
    const btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = t === "light" ? "☀️" : "🌙";
    localStorage.setItem("qp_theme", t);
  }

  function updateTeacherBadge() {
    const el = document.getElementById("teacherBadge");
    if (!el) return;
    const raw = sessionStorage.getItem("qp_teacher");
    if (!raw) { el.classList.add("hidden"); return; }
    try {
      const t = JSON.parse(raw);
      el.textContent = "👤 " + (t.name || t.username);
      el.classList.remove("hidden");
    } catch (e) { el.classList.add("hidden"); }
  }

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "");
    return h.split("/").filter(Boolean);
  }

  function route() {
    const parts = parseHash();
    const base = parts[0] || "pending";

    if (!QP.teacher) {
      document.getElementById("view").innerHTML =
        '<div class="container container-narrow"><div class="card mt center">' +
        '<div class="emoji" style="font-size:48px">⛔</div>' +
        "<h2>خطأ في تحميل التطبيق</h2>" +
        "<p class='muted'>لم يتم تحميل ملف teacher.js بشكل صحيح.</p>" +
        "</div></div>";
      return;
    }

    QP.teacher.render(base);
    setTimeout(updateTeacherBadge, 60);
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyTheme(localStorage.getItem("qp_theme") ||
      (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));

    const themeBtn = document.getElementById("themeToggle");
    if (themeBtn) themeBtn.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme");
      applyTheme(cur === "light" ? "dark" : "light");
    });

    window.addEventListener("hashchange", route);
    if (!location.hash) location.hash = "#/pending";
    route();
  });
})();