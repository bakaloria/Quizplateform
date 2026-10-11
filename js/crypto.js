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

  QP.crypto = { sha256, genSalt, hashPassword, verifyPassword, deviceFingerprint };
})();