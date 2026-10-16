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
    let s = "";
    for (let i = 0; i < (len || 16); i++) s += chars[Math.floor(Math.random() * chars.length)];
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

  QP.crypto = {
    sha256: sha256,
    genSalt: genSalt,
    hashPassword: hashPassword,
    verifyPassword: verifyPassword,
    deviceFingerprint: deviceFingerprint,
    encryptPassword: encryptPassword,
    decryptPassword: decryptPassword
  };
})();