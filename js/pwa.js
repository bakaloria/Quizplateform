/* ============================================================
 * pwa.js - منطق PWA (تسجيل SW + زر التثبيت + تحديثات)
 * ============================================================ */
(function () {
  const QP = window.QP;

  // الصفحة الحالية: "teacher" في لوحة المعلم، وإلا تطبيق الطالب
  const APP = (document.body && document.body.getAttribute("data-app")) || "student";
  const IS_TEACHER = APP === "teacher";

  let deferredPrompt = null;
  let newWorker = null;
  let updateAvailable = false;

  /* ============================================================
   * تسجيل Service Worker
   * ============================================================ */
  function registerSW() {
    if (!("serviceWorker" in navigator)) {
      console.log("[PWA] Service Worker غير مدعوم");
      return;
    }

    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js", { scope: "./" })
        .then(function (reg) {
          console.log("[PWA] SW مسجّل:", reg.scope);

          // فحص التحديثات كل 60 دقيقة
          setInterval(function () { reg.update(); }, 60 * 60 * 1000);

          // إذا كان هناك worker في الانتظار
          if (reg.waiting) {
            showUpdateBanner(reg.waiting);
          }

          // مراقبة التحديثات الجديدة
          reg.addEventListener("updatefound", function () {
            const installingWorker = reg.installing;
            if (!installingWorker) return;
            installingWorker.addEventListener("statechange", function () {
              if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                // تحديث جديد متوفر
                showUpdateBanner(installingWorker);
              }
            });
          });
        })
        .catch(function (err) {
          console.warn("[PWA] فشل تسجيل SW:", err);
        });
    });

    // عند تبديل الـ controller (يعني تم التحديث)
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }

  /* ============================================================
   * عرض شريط التحديث
   * ============================================================ */
  function showUpdateBanner(worker) {
    if (updateAvailable) return;
    updateAvailable = true;
    newWorker = worker;

    const banner = document.createElement("div");
    banner.className = "pwa-update-banner";
    banner.innerHTML =
      '<div class="pwa-update-content">' +
      '<div class="pwa-update-icon">🔄</div>' +
      '<div class="pwa-update-text">' +
      '<b>يتوفر تحديث جديد للتطبيق</b>' +
      '<div class="tiny">اضغط "تحديث الآن" للانتقال إلى آخر إصدار</div>' +
      '</div>' +
      '<button class="btn btn-sm btn-primary" id="pwaUpdateBtn">تحديث الآن</button>' +
      '<button class="btn btn-sm btn-ghost" id="pwaDismissBtn">✕</button>' +
      '</div>';
    document.body.appendChild(banner);

    document.getElementById("pwaUpdateBtn").addEventListener("click", function () {
      if (newWorker) {
        newWorker.postMessage({ type: "SKIP_WAITING" });
      }
      banner.remove();
    });
    document.getElementById("pwaDismissBtn").addEventListener("click", function () {
      banner.remove();
      updateAvailable = false;
    });
  }

  /* ============================================================
   * زر التثبيت
   * ============================================================ */
  function setupInstallButton() {
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      refreshInstall();
    });

    window.addEventListener("appinstalled", function () {
      console.log("[PWA] تم تثبيت التطبيق ✅");
      deferredPrompt = null;
      hideInstallButton();
      hideIosHint();
      if (QP.utils && QP.utils.toast) {
        QP.utils.toast(IS_TEACHER ? "تم تثبيت تطبيق المعلم على جهازك" : "تم تثبيت التطبيق على جهازك", "success", 4000);
      }
    });

    // إذا كان التطبيق مثبتاً بالفعل
    if (isStandalone()) {
      console.log("[PWA] التطبيق مثبّت ويعمل في وضع standalone");
    }
  }

  /* يُسمح بإظهار زر التثبيت عندما:
     - يكون المتصفح قد أتاح التثبيت (deferredPrompt)
     - وفي لوحة المعلم: بعد تسجيل دخول المعلم فقط */
  function canInstall() {
    if (!deferredPrompt) return false;
    if (IS_TEACHER) {
      return !!(QP.teacher && QP.teacher.isLogged && QP.teacher.isLogged());
    }
    return true;
  }

  function refreshInstall() {
    if (canInstall()) {
      showInstallButton();
    } else {
      hideInstallButton();
    }

    // تلميح التثبيت على iOS (لا يدعم beforeinstallprompt) للمعلم فقط
    if (IS_TEACHER && isIos() && !isStandalone() &&
      QP.teacher && QP.teacher.isLogged && QP.teacher.isLogged()) {
      showIosHint();
    } else {
      hideIosHint();
    }
  }

  function showInstallButton() {
    if (document.getElementById("pwaInstallBtn")) return;

    const btn = document.createElement("button");
    btn.id = "pwaInstallBtn";
    btn.className = "pwa-install-btn";
    btn.innerHTML = IS_TEACHER
      ? '<span>📲</span> تثبيت تطبيق المعلم'
      : '<span>📲</span> تثبيت التطبيق';
    btn.title = IS_TEACHER
      ? "ثبّت تطبيق المعلم على جهازك للوصول السريع"
      : "ثبّت المنصة على جهازك للوصول السريع";
    document.body.appendChild(btn);

    btn.addEventListener("click", async function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try {
        const choiceResult = await deferredPrompt.userChoice;
        console.log("[PWA] اختيار المستخدم:", choiceResult.outcome);
        if (choiceResult.outcome === "accepted") {
          hideInstallButton();
        }
      } catch (e) {
        console.warn("[PWA] خطأ في prompt:", e);
      }
      deferredPrompt = null;
    });
  }

  function hideInstallButton() {
    const btn = document.getElementById("pwaInstallBtn");
    if (btn) btn.remove();
  }

  /* ============================================================
   * كشف النظام / وضع التطبيق
   * ============================================================ */
  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  /* تلميح "إضافة إلى الشاشة الرئيسية" على iOS */
  function showIosHint() {
    if (document.getElementById("pwaIosHint")) return;
    if (localStorage.getItem("qp_ios_hint_dismissed") === "1") return;

    const el = document.createElement("div");
    el.id = "pwaIosHint";
    el.className = "pwa-ios-hint";
    el.innerHTML =
      '<div class="pwa-ios-hint-text">لتثبيت تطبيق المعلم: اضغط <b>مشاركة</b> ⬆️ ثم <b>إضافة إلى الشاشة الرئيسية</b></div>' +
      '<button class="pwa-ios-hint-close" aria-label="إغلاق">✕</button>';
    document.body.appendChild(el);
    el.querySelector(".pwa-ios-hint-close").addEventListener("click", function () {
      localStorage.setItem("qp_ios_hint_dismissed", "1");
      hideIosHint();
    });
  }

  function hideIosHint() {
    const el = document.getElementById("pwaIosHint");
    if (el) el.remove();
  }

  /* ============================================================
   * مؤشر الاتصال
   * ============================================================ */
  function setupConnectionIndicator() {
    // شريط أزرق/أحمر أعلى الصفحة
    let bar = document.getElementById("pwaConnectionBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "pwaConnectionBar";
      bar.className = "pwa-connection-bar";
      document.body.appendChild(bar);
    }

    const update = function () {
      if (navigator.onLine) {
        bar.classList.remove("offline");
        bar.classList.add("online");
        bar.innerHTML = "✅ متصل";
        setTimeout(function () {
          bar.classList.remove("online");
        }, 2000);
      } else {
        bar.classList.remove("online");
        bar.classList.add("offline");
        bar.innerHTML = "⚠️ لا يوجد اتصال بالإنترنت — بعض الميزات معطّلة";
      }
    };

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    // ابدأ مخفياً
    bar.classList.add("hidden");
    setTimeout(function () { bar.classList.remove("hidden"); update(); }, 100);
    setTimeout(function () {
      if (navigator.onLine) bar.classList.add("hidden");
    }, 2500);
  }

  /* ============================================================
   * كشف وضع التطبيق
   * ============================================================ */
  function detectDisplayMode() {
    if (isStandalone()) {
      document.documentElement.setAttribute("data-pwa", "standalone");
    }
    // مراقبة تغييرات الوضع
    window.matchMedia("(display-mode: standalone)").addEventListener("change", function (e) {
      if (e.matches) {
        document.documentElement.setAttribute("data-pwa", "standalone");
      } else {
        document.documentElement.removeAttribute("data-pwa");
      }
    });
  }

  /* ============================================================
   * التهيئة
   * ============================================================ */
  function init() {
    registerSW();
    setupInstallButton();
    setupConnectionIndicator();
    detectDisplayMode();
    refreshInstall();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // تصدير API
  QP.pwa = {
    canInstall: function () { return !!deferredPrompt; },
    isTeacher: IS_TEACHER,
    showInstall: function () { if (deferredPrompt) showInstallButton(); },
    hideInstall: hideInstallButton,
    refreshInstall: refreshInstall,
    update: function () {
      if (newWorker) newWorker.postMessage({ type: "SKIP_WAITING" });
    },
    clearCache: function () {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "CLEAR_CACHE" });
      }
    }
  };

  console.log("[pwa.js] loaded ✅");
})();

