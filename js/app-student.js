/* app-student.js v4.0 - Router للطالب */
(function () {
  const QP = window.QP;
  const U = QP.utils;

  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "dark");
    const btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = t === "light" ? "☀️" : "🌙";
    localStorage.setItem("qp_theme", t);
  }

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "");
    return h.split("/").filter(Boolean);
  }

  function route() {
    const parts = parseHash();
    const base = parts[0] || "home";

    document.querySelectorAll("#topnav a").forEach(function (a) {
      a.classList.toggle("active", a.dataset.route === base);
    });

    if (!QP.student) {
      document.getElementById("view").innerHTML =
        '<div class="container container-narrow"><div class="card mt center">' +
        '<div class="emoji" style="font-size:48px">⛔</div>' +
        "<h2>خطأ في تحميل التطبيق</h2>" +
        "<p class='muted'>لم يتم تحميل student.js</p>" +
        "</div></div>";
      return;
    }

    // الطالب دائماً يبدأ بشاشة الدخول
    QP.student.render();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyTheme(localStorage.getItem("qp_theme") ||
      (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));

    const themeBtn = document.getElementById("themeToggle");
    if (themeBtn) themeBtn.addEventListener("click", function () {
      const cur = document.documentElement.getAttribute("data-theme");
      applyTheme(cur === "light" ? "dark" : "light");
    });

    window.addEventListener("hashchange", route);
    if (!location.hash) location.hash = "#/home";
    route();
  });
})();