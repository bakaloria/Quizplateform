(function () {
  const QP = window.QP;

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

  function showError(message) {
    document.getElementById("view").innerHTML =
      '<div class="container container-narrow">' +
      '<div class="card mt center" style="padding:36px 20px">' +
      '<div class="emoji" style="font-size:56px">⛔</div>' +
      "<h2>خطأ في تحميل التطبيق</h2>" +
      '<p class="muted">' + message + "</p>" +
      '<p class="help">تأكد من وجود js/admin.js في المسار الصحيح.</p>' +
      "</div></div>";
  }

  function route() {
    const parts = parseHash();
    const base = parts[0] || "dashboard";

    if (!QP || !QP.admin || typeof QP.admin.render !== "function") {
      showError("لم يتم تحميل ملف admin.js بشكل صحيح.");
      console.error("[app-admin] QP.admin:", QP && QP.admin);
      return;
    }

    try {
      QP.admin.render(base);
    } catch (e) {
      console.error("[app-admin] خطأ:", e);
      showError(e.message || "حدث خطأ غير متوقع");
    }

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
    if (!location.hash) location.hash = "#/dashboard";
    route();
  });
})();