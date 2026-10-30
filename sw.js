/* ============================================================
 * Service Worker v4.0 - PWA كامل مع offline + تحديث تلقائي
 * ============================================================ */

  const CACHE_VERSION = "qp-v5.24.0";
const CACHE_STATIC = CACHE_VERSION + "-static";
const CACHE_RUNTIME = CACHE_VERSION + "-runtime";

// الملفات الثابتة التي تُخزَّن مؤقتاً عند التثبيت
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./teacher.html",
  "./admin.html",
  "./models.html",
  "./engbuilder.html",
  "./offline.html",
  "./manifest.json",
  "./manifest-teacher.json",
  "./icons/icon-teacher-192.png",
  "./icons/icon-teacher-512.png",
  "./icons/icon-teacher-maskable-192.png",
  "./icons/icon-teacher-maskable-512.png",
  "./icons/apple-touch-icon-teacher.png",
  "./css/styles.css",
  "./js/firebase.js",
  "./js/utils.js",
  "./js/crypto.js",
  "./js/store.js",
  "./js/groups.js",
  "./js/importer.js",
  "./js/analytics.js",
  "./js/certificate.js",
  "./js/seed.js",
  "./data/philosophy.json",
  "./data/biology.json",
  "./data/chemistry.json",
  "./data/english.json",
  "./data/physics.json",
  "./js/student.js",
  "./js/teacher.js",
  "./js/admin.js",
  "./js/engbuilder.js",
  "./js/app-student.js",
  "./js/app-teacher.js",
  "./js/models-admin.js",
  "./js/pwa.js"
];

// النطاقات المسموح بتخزينها مؤقتاً (Firebase CDN)
const RUNTIME_HOSTS = [
  "www.gstatic.com",
  "firebaseio.com"
];

/* ============================================================
 * INSTALL - تخزين الملفات الثابتة
 * ============================================================ */
self.addEventListener("install", function (event) {
  console.log("[SW] تثبيت...");
  event.waitUntil(
    caches.open(CACHE_STATIC).then(function (cache) {
      // نستخدم addAll مع معالجة الأخطاء الفردية
      return Promise.all(
        STATIC_ASSETS.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn("[SW] فشل تخزين:", url, err);
          });
        })
      );
    }).then(function () {
      console.log("[SW] تم التثبيت ✅");
      return self.skipWaiting(); // تفعيل فوري
    })
  );
});

/* ============================================================
 * ACTIVATE - حذف الكاشات القديمة
 * ============================================================ */
self.addEventListener("activate", function (event) {
  console.log("[SW] تفعيل...");
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_STATIC && key !== CACHE_RUNTIME) {
            console.log("[SW] حذف كاش قديم:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(function () {
      console.log("[SW] تم التفعيل ✅");
      return self.clients.claim(); // السيطرة على كل الصفحات المفتوحة
    })
  );
});

/* ============================================================
 * FETCH - استراتيجية العرض
 * ============================================================ */
self.addEventListener("fetch", function (event) {
  const request = event.request;

  // تجاهل الطلبات غير GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // تجاهل طلبات Firestore (يجب أن تصل للخادم مباشرة)
  if (url.hostname.indexOf("firestore.googleapis.com") >= 0 ||
    url.hostname.indexOf("firebaseio.com") >= 0 ||
    url.pathname.indexOf("/firestore/") >= 0) {
    return;
  }

  // استراتيجية خاصة لـ CDN (Cache First)
  if (RUNTIME_HOSTS.some(function (h) { return url.hostname.indexOf(h) >= 0; })) {
    event.respondWith(cacheFirst(request, CACHE_RUNTIME));
    return;
  }

  // استراتيجية للملفات المحلية (Network First مع fallback)
  if (url.origin === self.location.origin) {
    // HTML/JS/CSS → Network First
    if (request.destination === "document" ||
      request.destination === "script" ||
      request.destination === "style" ||
      url.pathname.endsWith(".html") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".css")) {
      event.respondWith(networkFirst(request, CACHE_STATIC));
      return;
    }
    // الصور والأيقونات → Cache First
    if (request.destination === "image" || url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".jpg") || url.pathname.endsWith(".svg") ||
      url.pathname.endsWith(".ico")) {
      event.respondWith(cacheFirst(request, CACHE_STATIC));
      return;
    }
    // الباقي → Stale While Revalidate
    event.respondWith(staleWhileRevalidate(request, CACHE_STATIC));
  }
});

/* ============================================================
 * استراتيجيات التخزين المؤقت
 * ============================================================ */

// Cache First: من الكاش أولاً، ثم الشبكة
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // عند الفشل، حاول من الكاش
    return caches.match(request);
  }
}

// Network First: من الشبكة أولاً، ثم الكاش (مع صفحة offline)
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // فشل الاتصال — حاول من الكاش
    const cached = await caches.match(request);
    if (cached) return cached;

    // إذا كان طلب صفحة HTML، اعرض offline.html
    if (request.destination === "document" || request.mode === "navigate") {
      const offlinePage = await caches.match("./offline.html");
      if (offlinePage) return offlinePage;
    }
    throw err;
  }
}

// Stale While Revalidate: اعرض من الكاش فوراً + حدّث في الخلفية
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(function (response) {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(function () {
    return cached;
  });

  return cached || fetchPromise;
}

/* ============================================================
 * MESSAGES - التواصل مع الصفحات
 * ============================================================ */
self.addEventListener("message", function (event) {
  const data = event.data;
  if (!data) return;

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (data.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      }).then(function () {
        return self.clients.matchAll().then(function (clients) {
          clients.forEach(function (client) {
            client.postMessage({ type: "CACHE_CLEARED" });
          });
        });
      })
    );
  }
});

/* ============================================================
 * PUSH NOTIFICATIONS (اختياري - للمستقبل)
 * ============================================================ */
self.addEventListener("push", function (event) {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { title: "إشعار", body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(data.title || "منصة الاختبارات", {
      body: data.body || "",
      icon: "icons/icon-192.png",
      badge: "icons/icon-96.png",
      dir: "rtl",
      lang: "ar",
      tag: data.tag || "qp-notification",
      data: data.url ? { url: data.url } : null
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ?
    event.notification.data.url : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then(function (clients) {
      for (const client of clients) {
        if (client.url.indexOf(url) >= 0 && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

console.log("[SW] v4.0 loaded ✅");
