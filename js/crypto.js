(function () {
  const QP = window.QP;

  async function sha256(str) {
    const enc = new TextEncoder();
    const data = enc.encode(str);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function genSalt(len) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const n = len || 16;
    let s = "";
    /* مصدر عشوائي آمن إن توفّر (crypto.getRandomValues) */
    if (window.crypto && window.crypto.getRandomValues) {
      const buf = new Uint32Array(n);
      window.crypto.getRandomValues(buf);
      for (let i = 0; i < n; i++) s += chars[buf[i] % chars.length];
    } else {
      for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
    }
    return s;
  }

  async function hashPassword(password, salt) {
    return await sha256(salt + "::" + password + "::" + salt);
  }

  async function verifyPassword(password, salt, hash) {
    if (!password || !salt || !hash) return false;
    const h = await hashPassword(password, salt);
    return h === hash;
  }

  function deviceFingerprint() {
    const parts = [
      navigator.userAgent || "",
      navigator.language || "",
      screen.width + "x" + screen.height,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0
    ];
    return sha256(parts.join("|"));
  }

  /* ============================================================
   * تشفير قابل للفكّ لكلمات المرور (لعرضها في لوحة الإدارة)
   * AES-GCM بمفتاح مشتق عبر PBKDF2 من سرّ داخل التطبيق.
   * الناتج نصّ بصيغة:  v1.<iv-b64>.<cipher-b64>
   * ============================================================ */
  const ENC_SECRET = "QuizPlateform::pass-secret::2026";
  const ENC_SALT = "QuizPlateform::salt::v1";
  let _encKeyPromise = null;

  function _b64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function _unb64(s) {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function _encKey() {
    if (_encKeyPromise) return _encKeyPromise;
    _encKeyPromise = (async function () {
      const enc = new TextEncoder();
      const base = await crypto.subtle.importKey(
        "raw", enc.encode(ENC_SECRET), "PBKDF2", false, ["deriveKey"]
      );
      return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: enc.encode(ENC_SALT), iterations: 100000, hash: "SHA-256" },
        base,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
    })();
    return _encKeyPromise;
  }

  /* تشفير كلمة المرور — يعيد "" عند الفشل أو فراغ المدخل */
  async function encryptPassword(plain) {
    if (plain === null || plain === undefined || plain === "") return "";
    try {
      const key = await _encKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(String(plain))
      );
      return "v1." + _b64(iv) + "." + _b64(ct);
    } catch (e) {
      console.warn("[crypto] encryptPassword:", e);
      return "";
    }
  }

  /* فكّ تشفير كلمة المرور — يعيد "" إذا تعذّر ذلك */
  async function decryptPassword(encStr) {
    try {
      if (!encStr || String(encStr).indexOf("v1.") !== 0) return "";
      const parts = String(encStr).split(".");
      if (parts.length !== 3) return "";
      const key = await _encKey();
      const iv = _unb64(parts[1]);
      const ct = _unb64(parts[2]);
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct);
      return new TextDecoder().decode(pt);
    } catch (e) {
      return "";
    }
  }

  /* ============================================================
   * تجزئة أسرار حسّاسة (كلمة مرور المدير)
   * - الخيار المفضّل: PBKDF2-HMAC-SHA256 (120000 تكرار) عبر crypto.subtle
   * - البديل: SHA-256 نقي بلغة JS × تكرارات (يعمل في كل البيئات
   *   بما فيها file:// والبيئات غير الآمنة) — يُستخدم عند غياب
   *   crypto.subtle فقط، ويُسجَّل نوع الخوارزمية في المستند.
   * ============================================================ */

  function _hex(buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  function hasSubtle() {
    return !!(window.crypto && window.crypto.subtle && window.crypto.subtle.deriveBits && window.crypto.subtle.importKey);
  }

  /* ---------- SHA-256 نقي (بديل آمن في كل البيئات) ---------- */
  var _K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function _rotr(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }

  function sha256HexSync(str) {
    const msg = new TextEncoder().encode(String(str));
    const bitLen = msg.length * 8;
    const total = ((msg.length + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(total);
    buf.set(msg);
    buf[msg.length] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 8, Math.floor(bitLen / 4294967296), false);
    dv.setUint32(total - 4, bitLen >>> 0, false);
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const w = new Uint32Array(64);
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
      for (let i = 16; i < 64; i++) {
        const x = w[i - 15], y = w[i - 2];
        const s0 = (_rotr(x, 7) ^ _rotr(x, 18) ^ (x >>> 3)) >>> 0;
        const s1 = (_rotr(y, 17) ^ _rotr(y, 19) ^ (y >>> 10)) >>> 0;
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const S1 = (_rotr(e, 6) ^ _rotr(e, 11) ^ _rotr(e, 25)) >>> 0;
        const ch = ((e & f) ^ (~e & g)) >>> 0;
        const t1 = (h + S1 + ch + _K[i] + w[i]) >>> 0;
        const S0 = (_rotr(a, 2) ^ _rotr(a, 13) ^ _rotr(a, 22)) >>> 0;
        const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    let out = "";
    for (let i = 0; i < 8; i++) out += ("00000000" + H[i].toString(16)).slice(-8);
    return out;
  }

  /* ---------- PBKDF2-HMAC-SHA256 ---------- */
  async function pbkdf2Hex(password, salt, iterations) {
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey("raw", enc.encode(String(password)), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: enc.encode(String(salt)), iterations: iterations || 120000, hash: "SHA-256" },
      base, 256
    );
    return _hex(bits);
  }

  /* ---------- البديل: SHA-256 × تكرارات ---------- */
  function sha256xHex(password, salt, iterations) {
    const n = iterations || 30000;
    let h = sha256HexSync(salt + "::" + password + "::" + salt);
    for (let i = 1; i < n; i++) h = sha256HexSync(h + "::" + salt);
    return h;
  }

  /* مقارنة بزمن ثابت (منع تسريب المعلومات) */
  function timingSafeEqual(a, b) {
    if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  /* اختيار الخوارزمية حسب قدرات المتصفّح */
  function pickAlgo() { return hasSubtle() ? "pbkdf2" : "sha256x"; }

  /* تجزئة سرّ (كلمة مرور) */
  async function hashSecret(password, salt, iterations, algo) {
    const a = algo || pickAlgo();
    if (a === "pbkdf2") return await pbkdf2Hex(password, salt, iterations || 120000);
    return sha256xHex(password, salt, iterations || 30000);
  }

  /* التحقق من سرّ مقابل التجزئة المخزّنة */
  async function verifySecret(password, salt, iterations, algo, expected) {
    if (!password || !salt || !expected) return false;
    try {
      const h = await hashSecret(password, salt, iterations, algo);
      return timingSafeEqual(h, expected);
    } catch (e) {
      console.warn("[crypto] verifySecret:", e);
      return false;
    }
  }

  QP.crypto = {
    sha256: sha256,
    genSalt: genSalt,
    hashPassword: hashPassword,
    verifyPassword: verifyPassword,
    deviceFingerprint: deviceFingerprint,
    encryptPassword: encryptPassword,
    decryptPassword: decryptPassword,
    /* أدوات تجزئة الأسرار */
    hasSubtle: hasSubtle,
    pickAlgo: pickAlgo,
    hashSecret: hashSecret,
    verifySecret: verifySecret,
    timingSafeEqual: timingSafeEqual,
    sha256HexSync: sha256HexSync,
    pbkdf2Hex: pbkdf2Hex,
    sha256xHex: sha256xHex
  };
})();