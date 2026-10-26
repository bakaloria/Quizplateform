(function () {
  const QP = window.QP;
  const U = QP.utils;

  /* ---------- theme ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "dark");
    const btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = t === "light" ? "☀️" : "🌙";
    localStorage.setItem("qp_theme", t);
  }

  /* ---------- home ---------- */
  function renderHome() {
    document.getElementById("view").innerHTML =
      '<section class="hero">' +
      "<h1>منصة <span class=\"grad\">الاختبارات التفاعلية</span></h1>" +
      "<p>أنشئ اختبارات إلكترونية احترافية، أضف أسئلتك بسهولة وبصيغ متعددة، وشاركها مع طلابك بكود دخول بسيط.</p>" +
      "</section>" +
      '<div class="entry-grid">' +
      '<a class="entry-card" href="#/join"><div class="emoji">🎓</div><h3>دخول الطالب</h3><p>أدخل كود الاختبار وابدأ الحل مباشرة.</p><span class="btn btn-primary">ابدأ الآن</span></a>' +
      '<a class="entry-card" href="#/admin"><div class="emoji">🛠️</div><h3>لوحة المدير</h3><p>أنشئ المواد، أضف الأسئلة، وأنشئ الاختبارات وتابع النتائج.</p><span class="btn">دخول المدير</span></a>' +
      "</div>" +
      '<div class="features">' +
      feature("📚", "المواد وبنك الأسئلة", "نظّم الأسئلة في مواد ووسوم مع بحث وتصفية متقدمة.") +
      feature("⚡", "استيراد دفعات", "استورد مئات الأسئلة دفعة واحدة عبر JSON أو CSV أو قالب نصي.") +
      feature("🧩", "أنواع متعددة", "اختيار من متعدد، متعدد الإجابات، صح/خطأ، أكمل الفراغ، وإجابة قصيرة.") +
      feature("🔑", "كود لكل اختبار", "كل اختبار يحصل على كود فريد يدخل به الطلاب.") +
      feature("⏱️", "مؤقّت وترتيب عشوائي", "تحكّم بالمدة وترتيب الأسئلة والخيارات ونسبة النجاح.") +
      feature("📈", "تحليلات ونتائج", "لوحة نتائج مع متوسطات ونِسَب نجاح وتصدير CSV.") +
      "</div>";
  }
  function feature(ico, t, d) {
    return '<div class="feature"><div class="emoji">' + ico + "</div><h4>" + t + "</h4><p>" + d + "</p></div>";
  }

  /* ---------- router ---------- */
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "");
    const parts = h.split("/").filter(Boolean);
    return parts;
  }

  function setActiveNav(route) {
    document.querySelectorAll("#topnav a").forEach((a) => {
      a.classList.toggle("active", a.dataset.route === route);
    });
  }

  function route() {
    const parts = parseHash();
    const base = parts[0] || "home";

    if (base === "join") {
      setActiveNav("join");
      QP.student.render(parts[1] ? parts[1].toUpperCase() : "");
    } else if (base === "admin") {
      setActiveNav("admin");
      QP.admin.render(parts[1] || "dashboard");
    } else {
      setActiveNav("home");
      renderHome();
    }
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyTheme(localStorage.getItem("qp_theme") || "dark");
    document.getElementById("themeToggle").addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme");
      applyTheme(cur === "light" ? "dark" : "light");
    });
    window.addEventListener("hashchange", route);
    if (!location.hash) location.hash = "#/";
    route();
  });
})();
