/* ============================================================
 * pwa.js - منطق PWA (تسجيل SW + زر التثبيت + تحديثات)
 * ============================================================ */
(function () {
  const QP = window.QP;

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
      showInstallButton();
    });

    window.addEventListener("appinstalled", function () {
      console.log("[PWA] تم تثبيت التطبيق ✅");
      deferredPrompt = null;
      hideInstallButton();
      if (QP.utils && QP.utils.toast) {
        QP.utils.toast("تم تثبيت التطبيق على جهازك", "success", 4000);
      }
    });

    // إذا كان التطبيق مثبتاً بالفعل
    if (window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true) {
      console.log("[PWA] التطبيق مثبّت ويعمل في وضع standalone");
    }
  }

  function showInstallButton() {
    if (document.getElementById("pwaInstallBtn")) return;

    const btn = document.createElement("button");
    btn.id = "pwaInstallBtn";
    btn.className = "pwa-install-btn";
    btn.innerHTML = '<span>📲</span> تثبيت التطبيق';
    btn.title = "ثبّت المنصة على جهازك للوصول السريع";
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
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (isStandalone) {
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // تصدير API
  QP.pwa = {
    canInstall: function () { return !!deferredPrompt; },
    showInstall: function () { if (deferredPrompt) showInstallButton(); },
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

