(function () {
  const QP = window.QP;
  const U = QP.utils;

  function generateCertificate({ studentName, examTitle, score, percent, date, teacherName, code }) {
    const win = window.open("", "_blank", "width=900,height=650");
    if (!win) {
      U.toast("يرجى السماح بالنوافذ المنبثقة", "warn");
      return;
    }

    win.document.write(
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">' +
      '<title>شهادة - ' + U.esc(studentName) + '</title>' +
      '<style>' +
      'body { font-family: "Segoe UI", Tahoma, sans-serif; background: #f5f7fa; margin: 0; padding: 30px; }' +
      '.cert { max-width: 800px; margin: 0 auto; background: #fff; border: 14px double #4f7cff;' +
      '  border-radius: 20px; padding: 50px 60px; text-align: center; position: relative;' +
      '  box-shadow: 0 20px 60px rgba(0,0,0,.15); }' +
      '.cert::before { content: ""; position: absolute; inset: 20px; border: 2px dashed #c7d2fe;' +
      '  border-radius: 12px; pointer-events: none; }' +
      '.logo { font-size: 56px; margin-bottom: 10px; }' +
      'h1 { color: #4f7cff; margin: 0 0 6px; font-size: 32px; }' +
      'h2 { color: #6a5cf0; margin: 8px 0 20px; font-size: 22px; font-weight: 600; }' +
      '.name { font-size: 42px; font-weight: 900; color: #1a2240; margin: 24px 0;' +
      '  border-bottom: 3px solid #4f7cff; display: inline-block; padding: 0 30px 8px; }' +
      '.text { font-size: 18px; color: #4a5570; margin: 20px 0; line-height: 1.8; }' +
      '.score { font-size: 40px; font-weight: 900; color: #2fbf71; margin: 16px 0; }' +
      '.footer { display: flex; justify-content: space-between; margin-top: 50px; padding-top: 20px;' +
      '  border-top: 1px solid #e2e8f0; font-size: 14px; color: #64748b; }' +
      '.sig { text-align: center; }' +
      '.sig .line { width: 180px; border-bottom: 2px solid #94a3b8; margin: 30px auto 6px; }' +
      '.code { font-family: monospace; font-size: 12px; color: #94a3b8; margin-top: 20px; }' +
      '@media print { body { background: #fff; padding: 0; } .no-print { display: none; } }' +
      '</style></head><body>' +
      '<div class="cert">' +
      '<div class="logo">🏆</div>' +
      '<h1>شهادة إتمام</h1>' +
      '<h2>Certificate of Achievement</h2>' +
      '<div class="text">تشهد منصة الاختبارات التفاعلية بأن</div>' +
      '<div class="name">' + U.esc(studentName) + '</div>' +
      '<div class="text">قد أتم بنجاح اختبار</div>' +
      '<h2 style="font-size:26px">' + U.esc(examTitle) + '</h2>' +
      '<div class="score">' + percent + '%</div>' +
      '<div class="text">الدرجة: ' + score + ' — بتاريخ ' + U.esc(date) + '</div>' +
      '<div class="footer">' +
      '<div class="sig"><div class="line"></div>' + U.esc(teacherName || "المعلم") + '</div>' +
      '<div class="sig"><div class="line"></div>المدير</div>' +
      '</div>' +
      '<div class="code">رمز التحقق: ' + U.esc(code || "—") + '</div>' +
      '</div>' +
      '<div class="no-print" style="text-align:center;margin-top:30px">' +
      '<button onclick="window.print()" style="padding:14px 32px;font-size:16px;background:#4f7cff;color:#fff;border:0;border-radius:10px;cursor:pointer;font-family:inherit">🖨 طباعة / حفظ PDF</button>' +
      '</div>' +
      '</body></html>'
    );
    win.document.close();
  }

  function verifyCode() {
    return QP.utils.uid().toUpperCase().slice(0, 12);
  }

  QP.certificate = { generateCertificate, verifyCode };
})();