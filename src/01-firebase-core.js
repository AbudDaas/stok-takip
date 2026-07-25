/**
 * 01-firebase-core.js
 * Firebase başlatma, kimlik doğrulama (giriş/çıkış), Firestore dinleyicisi ve temel kaydetme/yükleme mantığı.
 */

function locale() {
    const lang = window.i18n.getLang();
    if (lang === "en") return "en-US";
    if (lang === "ar") return "ar-SA";
    return "tr-TR";
  }

function initFirebaseIfConfigured() {
    try {
      if (typeof firebaseConfig === "undefined") return false;
      if (!firebaseConfig.apiKey || firebaseConfig.apiKey.indexOf("BURAYA") === 0) return false;
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      auth = firebase.auth();
      cloudEnabled = true;
      return true;
    } catch (e) {
      console.error("Firebase başlatma hatası", e);
      return false;
    }
  }

function showApp(show) {
    document.getElementById("app").style.display = show ? "block" : "none";
    document.querySelector(".bottom-nav").style.display = show ? "flex" : "none";
  }

function handleAuthChange(user) {
    if (firestoreUnsubscribe) {
      firestoreUnsubscribe();
      firestoreUnsubscribe = null;
    }
    if (user) {
      currentUser = user;
      document.getElementById("authScreen").style.display = "none";
      document.getElementById("logoutBtn").style.display = "flex";
      showApp(true);
      docRef = db.collection("isletmeler").doc(user.uid);
      setSyncStatus("connecting");
      attachFirestoreListener();
      const importBtn = document.getElementById("importBackupBtn");
      if (importBtn) importBtn.style.display = hasImportableLocalBackup() ? "flex" : "none";

      const adminNavBtn = document.getElementById("adminNavBtn");
      if (adminNavBtn) {
        adminNavBtn.style.display = user.uid === ADMIN_UID ? "flex" : "none";
        if (user.uid === ADMIN_UID) {
          loadAdminBusinessList();
          loadAdminFeedback();
        }
      }
    } else {
      currentUser = null;
      docRef = null;
      products = [];
      sales = [];
      customers = [];
      payments = [];
      cart = [];
      document.getElementById("authScreen").style.display = "flex";
      document.getElementById("logoutBtn").style.display = "none";
      showApp(false);
      setSyncStatus("local");
      const adminNavBtn = document.getElementById("adminNavBtn");
      if (adminNavBtn) adminNavBtn.style.display = "none";
    }
  }

function attachFirestoreListener() {
    firestoreUnsubscribe = docRef.onSnapshot(
      (snap) => {
        if (suppressNextSnapshot) {
          suppressNextSnapshot = false;
          return;
        }
        if (snap.exists && snap.data().products) {
          const data = snap.data();
          products = data.products;
          sales = data.sales || [];
          customers = data.customers || [];
          payments = data.payments || [];
          breadLog = data.breadLog || [];
          dailyResetConfig = data.dailyResetConfig || [];
          breadWhatsAppNumber = data.breadWhatsAppNumber || "";
          priceChangeLog = data.priceChangeLog || [];
          fiscalEnabled = data.fiscalEnabled || false;
          fiscalProvider = data.fiscalProvider || "foriba";
          fiscalApiKey = data.fiscalApiKey || "";
          fiscalEndpoint = data.fiscalEndpoint || "";
          fiscalVkn = data.fiscalVkn || "";
          suppliers = data.suppliers || [];
          supplierTransactions = data.supplierTransactions || [];
          returns = data.returns || [];
          accountType = data.accountType || "standalone";
          auditLog = data.auditLog || [];
          staffMembers = data.staffMembers || [];
          ownerPin = data.ownerPin || "";
          masterCatalog = data.masterCatalog || [];
        } else if (snap.metadata.fromCache) {
          // KRİTİK GÜVENLİK KONTROLÜ: Bu anlık görüntü henüz sunucudan değil,
          // cihazın YEREL ÖNBELLEĞİNDEN geliyor (örn. telefon ilk kez açıldığında,
          // internet henüz tam bağlanmadan). Belge "yok" gibi görünse bile bu
          // GERÇEK olmayabilir — sunucudan gelecek asıl veriyi bekle, ASLA bu
          // durumda örnek veriyle üzerine yazma (gerçek veriyi silme riski var).
          console.warn("Önbellekten boş/eksik anlık görüntü geldi, sunucu onayı bekleniyor — üzerine yazılmadı.");
          return;
        } else {
          const initial = { products: seedData(), sales: [], customers: [], payments: [] };
          docRef.set(initial);
          products = initial.products;
          sales = initial.sales;
          customers = initial.customers;
          payments = initial.payments;
          breadLog = [];
          dailyResetConfig = [];
          breadWhatsAppNumber = "";
          priceChangeLog = [];
        }
        applyAccountTypeUI();
        checkStaffSelection();
        reapplySimpleModeIfSet();
        checkOnboarding();
        maybeCreateDailyBackup();
        setSyncStatus("connected");
        renderAll();
      },
      (err) => {
        console.error("Firestore hata", err);
        setSyncStatus("error");
      }
    );
  }

function setSyncStatus(state) {
    const icon = document.getElementById("syncIcon");
    const text = document.getElementById("syncText");
    if (!icon || !text) return;
    if (state === "connected") {
      icon.className = "fa-solid fa-circle-check";
      text.textContent = t("syncConnected");
    } else if (state === "connecting") {
      icon.className = "fa-solid fa-arrows-rotate";
      text.textContent = t("syncConnecting");
    } else if (state === "error") {
      icon.className = "fa-solid fa-triangle-exclamation";
      text.textContent = t("syncError");
    } else {
      icon.className = "fa-solid fa-cloud";
      text.textContent = t("syncLocal");
    }
  }

function showAuthError(message) {
    const el = document.getElementById("authError");
    el.textContent = message;
    el.style.display = "block";
  }

function mapAuthError(code) {
    const messages = {
      "auth/invalid-email": t("authErrInvalidEmail"),
      "auth/user-not-found": t("authErrUserNotFound"),
      "auth/wrong-password": t("authErrWrongPassword"),
      "auth/invalid-credential": t("authErrInvalidCredential"),
      "auth/too-many-requests": t("authErrTooMany")
    };
    return messages[code] || t("authErrGeneric");
  }

function submitAuth() {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    if (!email || !password) {
      showAuthError(t("authErrRequired"));
      return;
    }
    document.getElementById("authError").style.display = "none";
    auth.signInWithEmailAndPassword(email, password).catch((e) => showAuthError(mapAuthError(e.code)));
  }

function forgotPassword() {
    const email = document.getElementById("authEmail").value.trim();
    if (!email) {
      showAuthError(t("authErrForgotNeedsEmail"));
      return;
    }
    document.getElementById("authError").style.display = "none";
    auth
      .sendPasswordResetEmail(email)
      .then(() => showToast(t("authResetSent"), "success"))
      .catch((e) => showAuthError(mapAuthError(e.code)));
  }

function logout() {
    if (confirm(t("confirmLogout"))) {
      auth.signOut();
    }
  }

function load() {
    const cloudReady = initFirebaseIfConfigured();

    if (!cloudReady) {
      // Yerel mod: Firebase ayarlanmamış, tek cihazlık kullanım
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        products = (parsed && parsed.products) || seedData();
        sales = (parsed && parsed.sales) || [];
        customers = (parsed && parsed.customers) || [];
        payments = (parsed && parsed.payments) || [];
        dailyResetConfig = (parsed && parsed.dailyResetConfig) || [];
        breadWhatsAppNumber = (parsed && parsed.breadWhatsAppNumber) || "";
        priceChangeLog = (parsed && parsed.priceChangeLog) || [];
      } catch (e) {
        products = seedData();
        sales = [];
        customers = [];
        payments = [];
        dailyResetConfig = [];
        breadWhatsAppNumber = "";
        priceChangeLog = [];
      }
      if (!Array.isArray(products) || !products.length) products = seedData();
      if (!Array.isArray(sales)) sales = [];
      if (!Array.isArray(customers)) customers = [];
      if (!Array.isArray(payments)) payments = [];
      renderAll();
    } else {
      // Bulut modu: giriş yapılana kadar uygulama gizli
      showApp(false);
      auth.onAuthStateChanged(handleAuthChange);
    }
  }

function save() {
    if (cloudEnabled) {
      if (!docRef) return;
      suppressNextSnapshot = true;
      docRef.set({ products, sales, customers, payments, dailyResetConfig, breadWhatsAppNumber, priceChangeLog, auditLog, staffMembers, suppliers, supplierTransactions, returns }, { merge: true }).catch((e) => {
        console.error("Bulut kaydetme hatası", e);
        setSyncStatus("error");
        registerBackgroundSync();
      });
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ products, sales, customers, payments, dailyResetConfig, breadWhatsAppNumber, priceChangeLog, auditLog, staffMembers, suppliers, supplierTransactions, returns }));
      } catch (e) {
        console.error("Yerel kaydetme hatası", e);
      }
    }
  }

function registerBackgroundSync() {
    if (!("serviceWorker" in navigator) || !("SyncManager" in window)) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.sync.register("bakkal-sync"))
      .catch(() => {});
  }

function registerPeriodicSync() {
    if (!("serviceWorker" in navigator) || !("permissions" in navigator)) return;
    navigator.permissions
      .query({ name: "periodic-background-sync" })
      .then((status) => {
        if (status.state !== "granted") return;
        navigator.serviceWorker.ready.then((reg) => {
          if ("periodicSync" in reg) {
            reg.periodicSync.register("bakkal-refresh", { minInterval: 12 * 60 * 60 * 1000 }).catch(() => {});
          }
        });
      })
      .catch(() => {});
  }

function seedData() {
    return [
      mkProduct("pepsi 1 lt", "içecekler", 12, 10, 22, "", "adet", 16),
      mkProduct("pepsi 2.5 lt", "içecekler", 3, 5, 45, "", "adet", 34),
      mkProduct("cocacola 1 lt", "içecekler", 0, 8, 24, "", "adet", 17),
      mkProduct("ekmek", "fırın", 15, 10, 8, "", "adet", 5),
      mkProduct("beyaz peynir", "süt ürünleri", 5, 2, 180, "", "kg", 140)
    ];
  }

function hasImportableLocalBackup() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.products) && parsed.products.length > 0;
    } catch (e) {
      return false;
    }
  }

function importLocalBackup() {
    let parsed;
    try {
      parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      showToast(t("importParseError"), "error");
      return;
    }
    const localProducts = (parsed && parsed.products) || [];
    if (!localProducts.length) {
      showToast(t("importNoLocalBackup"), "info");
      return;
    }
    if (!confirm(t("importConfirm").replace("{n}", localProducts.length))) return;

    let addedCount = 0;
    localProducts.forEach((lp) => {
      if (!productAlreadyExists(lp.name)) {
        products.push(lp);
        addedCount++;
      }
    });
    if (Array.isArray(parsed.sales)) {
      const existingSaleIds = new Set(sales.map((s) => s.id));
      parsed.sales.forEach((s) => {
        if (!existingSaleIds.has(s.id)) sales.push(s);
      });
    }
    if (Array.isArray(parsed.customers)) {
      const existingCustomerIds = new Set(customers.map((c) => c.id));
      parsed.customers.forEach((c) => {
        if (!existingCustomerIds.has(c.id)) customers.push(c);
      });
    }
    if (Array.isArray(parsed.payments)) {
      const existingPaymentIds = new Set(payments.map((p) => p.id));
      parsed.payments.forEach((p) => {
        if (!existingPaymentIds.has(p.id)) payments.push(p);
      });
    }

    save();
    renderAll();
    document.getElementById("importBackupBtn").style.display = "none";
    showToast(t("importSuccess").replace("{n}", addedCount), "success");
  }
