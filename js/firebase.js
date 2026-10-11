(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyBfsSesYqniyBituMfbQ6S-7PQgsxx_ETc",
    authDomain: "tasks-for-quran.firebaseapp.com",
    projectId: "tasks-for-quran",
    storageBucket: "tasks-for-quran.firebasestorage.app",
    messagingSenderId: "708158011088",
    appId: "1:708158011088:web:987cca8cd8c02219d350d5"
  };

  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  db.settings({ ignoreUndefinedProperties: true });

  window.QP = window.QP || {};
  QP.fb = firebase;
  QP.db = db;
  QP.FieldValue = firebase.firestore.FieldValue;
  QP.fs = firebase.firestore;

  console.log("[firebase.js] تم التهيئة ✅");
})();