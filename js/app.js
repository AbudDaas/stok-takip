(function () {
  "use strict";

  // Service worker'ı mümkün olduğunca ERKEN kaydet (sayfa tam yüklenmeyi
  // beklemeden) — bazı PWA analiz araçları kaydı geç fark edebiliyor.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }

  const t = (key) => window.i18n.t(key);
  function locale() {
    const lang = window.i18n.getLang();
    if (lang === "en") return "en-US";
    if (lang === "ar") return "ar-SA";
    return "tr-TR";
  }

  const STORAGE_KEY = "bakkal_urunler_v2";
  let products = [];
  let sales = [];
  let customers = [];
  let payments = [];
  let breadLog = [];
  let dailyResetConfig = [];
  let breadWhatsAppNumber = "";
  let cart = []; // { productId, name, price, qty }
  let activeProductId = null;
  let activeCustomerId = null;
  let selectedPaymentType = "nakit";
  let currentSalesPeriod = "today";

  let html5QrCode = null;
  let scanning = false;
  let html5QrCodeKasa = null;
  let scanningKasa = false;
  let stokScanCooldown = false;
  let kasaScanCooldown = false;

  let db = null;
  let auth = null;
  let docRef = null;
  let cloudEnabled = false;
  let suppressNextSnapshot = false;
  let firestoreUnsubscribe = null;
  let currentUser = null;

  // ---------- Firebase setup ----------
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

  const ADMIN_UID = "NaVl26qq6kXas90Qm9e2kCZDaIp2";

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
        if (user.uid === ADMIN_UID) loadAdminBusinessList();
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
        }
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

  // ---------- Giriş / Kayıt ----------
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

  // ---------- Persistence ----------
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
      } catch (e) {
        products = seedData();
        sales = [];
        customers = [];
        payments = [];
        dailyResetConfig = [];
        breadWhatsAppNumber = "";
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
      docRef.set({ products, sales, customers, payments, dailyResetConfig, breadWhatsAppNumber }, { merge: true }).catch((e) => {
        console.error("Bulut kaydetme hatası", e);
        setSyncStatus("error");
        registerBackgroundSync();
      });
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ products, sales, customers, payments, dailyResetConfig, breadWhatsAppNumber }));
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

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "BAKKAL_SYNC_RECONNECTED") {
        showToast(t("syncReconnected"), "success");
      }
    });
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

  function mkProduct(name, category, qty, min, price, barcode, unit, costPrice) {
    return {
      id: genId(),
      name,
      category,
      qty: Number(qty) || 0,
      min: Number(min) || 0,
      price: Number(price) || 0,
      costPrice: Number(costPrice) || 0,
      barcode: (barcode || "").trim(),
      unit: unit === "kg" ? "kg" : "adet"
    };
  }

  function genId() {
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- Müşteri (Veresiye) ----------
  function mkCustomer(name, phone) {
    return { id: genId(), name, phone: phone || "" };
  }

  function addCustomer() {
    const nameInput = document.getElementById("newCustomerName");
    const phoneInput = document.getElementById("newCustomerPhone");
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }
    customers.push(mkCustomer(name, phoneInput.value.trim()));
    nameInput.value = "";
    phoneInput.value = "";
    save();
    renderCustomers();
  }

  function deleteCustomer(id) {
    const debt = getCustomerDebt(id);
    if (debt > 0 && !confirm(`${t("confirmDeleteCustomerWithDebt")} ${formatTL(debt)} ${t("confirmDeleteCustomerWithDebtSuffix")}`)) {
      return;
    }
    customers = customers.filter((c) => c.id !== id);
    closeCustomerModal();
    save();
    renderCustomers();
  }

  function saveCustomerEdit() {
    const c = customers.find((x) => x.id === activeCustomerId);
    if (!c) return;
    const name = document.getElementById("editCustomerName").value.trim();
    if (!name) return;
    c.name = name;
    c.phone = document.getElementById("editCustomerPhone").value.trim();
    save();
    renderCustomers();
    openCustomerModal(c.id);
  }

  function getCustomerDebt(customerId) {
    const debtFromSales = sales
      .filter((s) => s.paymentType === "veresiye" && s.customerId === customerId)
      .reduce((sum, s) => sum + s.total, 0);
    const paid = payments.filter((p) => p.customerId === customerId).reduce((sum, p) => sum + p.amount, 0);
    return Math.max(0, debtFromSales - paid);
  }

  function recordPayment() {
    const c = customers.find((x) => x.id === activeCustomerId);
    if (!c) return;
    const input = document.getElementById("paymentAmountInput");
    const amount = Number(input.value);
    if (!amount || amount <= 0) {
      input.focus();
      return;
    }
    payments.push({
      id: genId(),
      customerId: c.id,
      customerName: c.name,
      amount,
      timestamp: new Date().toISOString()
    });
    input.value = "";
    save();
    renderCustomers();
    openCustomerModal(c.id);
  }

  function customerRowHtml(c) {
    const debt = getCustomerDebt(c.id);
    const debtClass = debt > 0 ? "has-debt" : "no-debt";
    return `
      <div class="customer-row" data-id="${c.id}">
        <div class="customer-info">
          <p class="customer-name">${escapeHtml(c.name)}</p>
          <p class="customer-phone">${escapeHtml(c.phone || "—")}</p>
        </div>
        <span class="customer-debt ${debtClass}">${formatTL(debt)}</span>
      </div>`;
  }

  // ---------- Günlük Ürün Takibi (her işletme kendi ayarlayabilir) ----------

  function findProductByExactName(name) {
    const normalized = name.trim().toLowerCase();
    return products.find((p) => p.name.trim().toLowerCase() === normalized);
  }

  function addBreadConfig() {
    const nameInput = document.getElementById("breadConfigName");
    const qtyInput = document.getElementById("breadConfigQty");
    const staleInput = document.getElementById("breadConfigStaleName");
    const autoResetInput = document.getElementById("breadConfigAutoReset");

    const productName = nameInput.value.trim();
    if (!productName) {
      showToast(t("breadConfigNameRequired"), "error");
      return;
    }

    dailyResetConfig.push({
      productName,
      dailyQty: Number(qtyInput.value) || 0,
      autoReset: autoResetInput.checked,
      staleProductName: staleInput.value.trim()
    });

    nameInput.value = "";
    qtyInput.value = "";
    staleInput.value = "";
    autoResetInput.checked = true;

    save();
    renderBreadStatus();
    showToast(t("breadConfigAdded"), "success");
  }

  function removeBreadConfig(index) {
    dailyResetConfig.splice(index, 1);
    save();
    renderBreadStatus();
    showToast(t("breadConfigRemoved"), "success");
  }

  function renderBreadConfigList() {
    const listEl = document.getElementById("breadConfigList");
    if (!listEl) return;

    if (!dailyResetConfig.length) {
      listEl.innerHTML = `<p class="empty-state" style="display:block;">${t("breadConfigEmpty")}</p>`;
      return;
    }

    listEl.innerHTML = dailyResetConfig
      .map((cfg, i) => {
        const autoResetLabel = cfg.autoReset ? t("breadAutoResetYes") : t("breadAutoResetNo");
        const staleStr = cfg.staleProductName ? ` · ${escapeHtml(cfg.staleProductName)}` : "";
        return `
          <div class="bread-config-row">
            <div class="bread-config-info">
              <p class="bread-config-name">${escapeHtml(cfg.productName)}</p>
              <p class="bread-config-meta">${cfg.dailyQty} adet · ${autoResetLabel}${staleStr}</p>
            </div>
            <button class="bread-config-remove-btn" data-index="${i}" aria-label="Kaldır"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
          </div>`;
      })
      .join("");

    listEl.querySelectorAll(".bread-config-remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => removeBreadConfig(Number(btn.dataset.index)));
    });
  }

  function renderBreadStatus() {
    const currentEl = document.getElementById("breadCurrentList");
    const logListEl = document.getElementById("breadLogList");
    const logEmptyEl = document.getElementById("breadLogEmptyState");
    const numberInput = document.getElementById("breadWhatsAppNumber");
    if (!currentEl) return;

    if (numberInput && document.activeElement !== numberInput) {
      numberInput.value = breadWhatsAppNumber || "";
    }

    renderBreadConfigList();
    updateNotifButtonState();

    if (!dailyResetConfig.length) {
      currentEl.innerHTML = `<p class="empty-state" style="display:block;">${t("breadConfigEmpty")}</p>`;
    } else {
      currentEl.innerHTML = dailyResetConfig
        .map((cfg) => {
          const p = findProductByExactName(cfg.productName);
          return `
            <div class="bread-current-row">
              <span>${escapeHtml(cfg.productName)}</span>
              <span class="bread-current-qty">${p ? formatQty(p) : "—"}</span>
            </div>`;
        })
        .join("");
    }

    const sorted = [...breadLog].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 14);
    if (!sorted.length) {
      logListEl.innerHTML = "";
      logEmptyEl.style.display = "block";
    } else {
      logEmptyEl.style.display = "none";
      logListEl.innerHTML = sorted
        .map((entry) => {
          const d = new Date(entry.timestamp);
          const dateStr = d.toLocaleString(locale(), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
          const items = Array.isArray(entry.items) ? entry.items : [];
          const itemsStr = items.map((it) => `${escapeHtml(it.name)}: ${it.qty}`).join(" · ");
          return `
            <div class="bread-log-row">
              <span class="bread-log-date">${dateStr} · ${escapeHtml(entry.note || "")}</span>
              <span class="bread-log-qty">${itemsStr}</span>
            </div>`;
        })
        .join("");
    }
  }

  function sendBreadWhatsApp() {
    const number = (document.getElementById("breadWhatsAppNumber").value || "").trim();
    if (!number) {
      showToast(t("breadNoWhatsAppNumber"), "error");
      return;
    }
    breadWhatsAppNumber = number;
    save();

    const today = new Date().toLocaleDateString(locale());
    const lines = dailyResetConfig.map((cfg) => {
      const p = findProductByExactName(cfg.productName);
      return `${cfg.productName}: ${p ? formatQty(p) : "0 adet"}`;
    });
    const message = `🍞 ${t("breadStatusTitle").replace("🍞 ", "")} (${today})\n${lines.join("\n")}`;
    const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  // ---------- Bildirimler (Firebase Cloud Messaging) ----------
  function isPushConfigured() {
    return typeof pushConfig !== "undefined" && pushConfig.vapidKey && pushConfig.vapidKey.indexOf("BURAYA") !== 0;
  }

  function updateNotifButtonState() {
    const btn = document.getElementById("notifEnableBtn");
    if (!btn) return;
    const span = btn.querySelector("span");
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      span.textContent = t("notifDisableBtn");
      btn.disabled = true;
    } else {
      span.textContent = t("notifEnableBtn");
      btn.disabled = false;
    }
  }

  function enableNotifications() {
    if (!isPushConfigured()) {
      showToast(t("notifError"), "error");
      return;
    }
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !cloudEnabled || !currentUser) {
      showToast(t("notifError"), "error");
      return;
    }

    Notification.requestPermission()
      .then((permission) => {
        if (permission !== "granted") {
          showToast(t("notifPermissionDenied"), "error");
          return;
        }
        const messaging = firebase.messaging();
        return messaging.getToken({ vapidKey: pushConfig.vapidKey }).then((fcmToken) => {
          if (!fcmToken) {
            showToast(t("notifError"), "error");
            return;
          }
          return docRef
            .set({ fcmTokens: firebase.firestore.FieldValue.arrayUnion(fcmToken) }, { merge: true })
            .then(() => {
              showToast(t("notifEnabled"), "success");
              updateNotifButtonState();
            });
        });
      })
      .catch((e) => {
        console.error(e);
        showToast(t("notifError"), "error");
      });
  }
  function isAdminConfigured() {
    return typeof adminConfig !== "undefined" && adminConfig.workerUrl && adminConfig.workerUrl.indexOf("BURAYA") !== 0;
  }

  function loadAdminBusinessList() {
    if (!currentUser || currentUser.uid !== ADMIN_UID) return;
    db.collection("admin")
      .doc("businesses")
      .get()
      .then((snap) => {
        const list = snap.exists && snap.data().list ? snap.data().list : [];
        renderAdminBusinessList(list);
      })
      .catch((e) => {
        console.error("Yönetim listesi okunamadı", e);
        renderAdminBusinessList([]);
      });
  }

  function renderAdminBusinessList(list) {
    const listEl = document.getElementById("adminBusinessList");
    const emptyEl = document.getElementById("adminEmptyState");
    if (!listEl) return;

    if (!list.length) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      return;
    }
    emptyEl.style.display = "none";

    listEl.innerHTML = list
      .map((b) => {
        const statusClass = b.active ? "admin-status-active" : "admin-status-inactive";
        const statusLabel = b.active ? t("adminActiveLabel") : t("adminInactiveLabel");
        const toggleLabel = b.active ? t("adminInactiveLabel") : t("adminActiveLabel");
        const dateStr = new Date(b.createdAt).toLocaleDateString(locale());
        return `
          <div class="admin-business-row">
            <div class="admin-business-info">
              <p class="admin-business-name">${escapeHtml(b.businessName)}</p>
              <p class="admin-business-meta">${escapeHtml(b.email)} · ${dateStr}</p>
              <span class="admin-status-badge ${statusClass}">${statusLabel}</span>
            </div>
            <button class="admin-toggle-btn" data-uid="${b.uid}" data-active="${b.active}">${toggleLabel}</button>
          </div>`;
      })
      .join("");

    listEl.querySelectorAll(".admin-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const currentlyActive = btn.dataset.active === "true";
        toggleAdminBusiness(btn.dataset.uid, !currentlyActive);
      });
    });
  }

  function createAdminBusiness() {
    if (!isAdminConfigured()) {
      showToast(t("adminNotConfigured"), "error");
      return;
    }
    const businessName = document.getElementById("adminBusinessName").value.trim();
    const email = document.getElementById("adminBusinessEmail").value.trim();
    const password = document.getElementById("adminBusinessPassword").value;

    if (!businessName || !email || !password) {
      showToast(t("adminFieldsRequired"), "error");
      return;
    }

    currentUser
      .getIdToken()
      .then((idToken) =>
        fetch(`${adminConfig.workerUrl}/create-business`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, businessName, email, password })
        })
      )
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          showToast(data.error, "error");
          return;
        }
        showToast(t("adminCreateSuccess"), "success");
        document.getElementById("adminBusinessName").value = "";
        document.getElementById("adminBusinessEmail").value = "";
        document.getElementById("adminBusinessPassword").value = "";
        loadAdminBusinessList();
      })
      .catch((e) => {
        console.error(e);
        showToast(t("adminCreateError"), "error");
      });
  }

  function toggleAdminBusiness(targetUid, active) {
    currentUser
      .getIdToken()
      .then((idToken) =>
        fetch(`${adminConfig.workerUrl}/toggle-business`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, targetUid, active })
        })
      )
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          showToast(data.error, "error");
          return;
        }
        loadAdminBusinessList();
      })
      .catch((e) => {
        console.error(e);
        showToast(t("adminToggleError"), "error");
      });
  }



  function renderCustomers() {
    const list = document.getElementById("customerList");
    const empty = document.getElementById("customerEmptyState");
    if (!list) return;

    if (!customers.length) {
      list.innerHTML = "";
      empty.style.display = "block";
    } else {
      empty.style.display = "none";
      list.innerHTML = customers.map(customerRowHtml).join("");
    }
    list.querySelectorAll(".customer-row").forEach((row) => {
      row.addEventListener("click", () => openCustomerModal(row.dataset.id));
    });

    const totalDebt = customers.reduce((sum, c) => sum + getCustomerDebt(c.id), 0);
    document.getElementById("statTotalDebt").textContent = formatTL(totalDebt);
    document.getElementById("statCustomerCount").textContent = customers.length;

    populateVeresiyeCustomerSelect();
  }

  let selectedVeresiyeCustomerId = null;

  function populateVeresiyeCustomerSelect() {
    // Aktif seçim varsa ama müşteri artık listede yoksa (silinmişse) sıfırla
    if (selectedVeresiyeCustomerId && !customers.some((c) => c.id === selectedVeresiyeCustomerId)) {
      clearVeresiyeCustomerSelection();
    }
  }

  function renderVeresiyeCustomerResults(query) {
    const resultsEl = document.getElementById("veresiyeCustomerResults");
    if (!resultsEl) return;
    const q = (query || "").toLowerCase().trim();
    const matches = q ? customers.filter((c) => c.name.toLowerCase().includes(q)) : customers;

    if (!matches.length) {
      resultsEl.innerHTML = `<p class="searchable-result-empty">${t("noMatchingCustomers")}</p>`;
    } else {
      resultsEl.innerHTML = matches
        .slice(0, 8)
        .map((c) => `<div class="searchable-result-row" data-id="${c.id}">${escapeHtml(c.name)}</div>`)
        .join("");
      resultsEl.querySelectorAll(".searchable-result-row").forEach((row) => {
        row.addEventListener("click", () => selectVeresiyeCustomer(row.dataset.id));
      });
    }
    resultsEl.classList.add("show");
  }

  function selectVeresiyeCustomer(id) {
    const c = customers.find((x) => x.id === id);
    if (!c) return;
    selectedVeresiyeCustomerId = id;
    document.getElementById("veresiyeCustomerSelectedId").value = id;
    document.getElementById("veresiyeCustomerSearch").value = c.name;
    document.getElementById("veresiyeCustomerResults").classList.remove("show");
  }

  function clearVeresiyeCustomerSelection() {
    selectedVeresiyeCustomerId = null;
    const idInput = document.getElementById("veresiyeCustomerSelectedId");
    const searchInput = document.getElementById("veresiyeCustomerSearch");
    if (idInput) idInput.value = "";
    if (searchInput) searchInput.value = "";
  }

  function openCustomerModal(id) {
    const c = customers.find((x) => x.id === id);
    if (!c) return;
    activeCustomerId = id;
    document.getElementById("customerModalName").textContent = c.name;
    document.getElementById("customerModalDebt").textContent = formatTL(getCustomerDebt(id));
    document.getElementById("editCustomerName").value = c.name;
    document.getElementById("editCustomerPhone").value = c.phone || "";
    document.getElementById("paymentAmountInput").value = "";
    renderCustomerHistory(id);
    document.getElementById("customerModal").style.display = "flex";
  }

  function closeCustomerModal() {
    document.getElementById("customerModal").style.display = "none";
    activeCustomerId = null;
  }

  function renderCustomerHistory(customerId) {
    const list = document.getElementById("customerHistoryList");
    if (!list) return;
    const debtEntries = sales
      .filter((s) => s.paymentType === "veresiye" && s.customerId === customerId)
      .map((s) => ({ type: "debt", timestamp: s.timestamp, amount: s.total, label: s.items.map((i) => `${i.name} x${i.qty}`).join(", ") }));
    const paymentEntries = payments
      .filter((p) => p.customerId === customerId)
      .map((p) => ({ type: "payment", timestamp: p.timestamp, amount: p.amount, label: t("paymentReceivedLabel") }));
    const combined = [...debtEntries, ...paymentEntries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (!combined.length) {
      list.innerHTML = `<p class="empty-state" style="display:block;">${t("noTransactionsYet")}</p>`;
      return;
    }

    list.innerHTML = combined
      .map((e) => {
        const d = new Date(e.timestamp);
        const timeStr = d.toLocaleString(locale(), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        const amountClass = e.type === "debt" ? "history-amount-debt" : "history-amount-payment";
        const sign = e.type === "debt" ? "+" : "-";
        return `
          <div class="history-row">
            <span>${timeStr} · ${escapeHtml(e.label)}</span>
            <span class="${amountClass}">${sign}${formatTL(e.amount)}</span>
          </div>`;
      })
      .join("");
  }

  // ---------- Status helpers ----------
  function getStatus(p) {
    if (p.qty <= 0) return "tukendi";
    if (p.qty < p.min) return "kritik";
    return "yeterli";
  }

  function getStatusLabel(status) {
    if (status === "tukendi") return t("statusTukendi");
    if (status === "kritik") return t("statusKritik");
    return t("statusYeterli");
  }

  const STATUS_CLASS = { tukendi: "status-tukendi", kritik: "status-kritik", yeterli: "status-yeterli" };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------- Bildirimler (toast) ----------
  const TOAST_ICONS = {
    success: "fa-solid fa-circle-check",
    error: "fa-solid fa-circle-exclamation",
    info: "fa-solid fa-circle-info"
  };

  function showToast(message, type) {
    type = type || "info";
    const container = document.getElementById("toastContainer");
    if (!container) {
      // Toast container yoksa (beklenmedik durum), en azından bilgi kaybolmasın
      window.alert(message);
      return;
    }
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="${TOAST_ICONS[type] || TOAST_ICONS.info}" aria-hidden="true"></i>
      <span class="toast-message"></span>
      <button class="toast-close" aria-label="Kapat"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
    `;
    toast.querySelector(".toast-message").textContent = message;

    function removeToast() {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 250);
    }

    toast.querySelector(".toast-close").addEventListener("click", removeToast);
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(removeToast, 4000);
  }

  // ---------- Özel miktar/ağırlık sorma penceresi (native prompt() yerine) ----------
  function showPrompt(title, defaultValue) {
    return new Promise((resolve) => {
      const modal = document.getElementById("promptModal");
      const titleEl = document.getElementById("promptModalTitle");
      const input = document.getElementById("promptModalInput");
      const okBtn = document.getElementById("promptModalOkBtn");
      const cancelBtn = document.getElementById("promptModalCancelBtn");

      titleEl.textContent = title;
      input.value = defaultValue != null ? defaultValue : "";
      modal.style.display = "flex";
      setTimeout(() => {
        input.focus();
        input.select();
      }, 50);

      function cleanup(result) {
        modal.style.display = "none";
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        input.removeEventListener("keydown", onKeydown);
        modal.removeEventListener("click", onOverlayClick);
        resolve(result);
      }
      function onOk() {
        cleanup(input.value);
      }
      function onCancel() {
        cleanup(null);
      }
      function onKeydown(e) {
        if (e.key === "Enter") {
          e.preventDefault();
          onOk();
        } else if (e.key === "Escape") {
          onCancel();
        }
      }
      function onOverlayClick(e) {
        if (e.target === modal) onCancel();
      }

      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      input.addEventListener("keydown", onKeydown);
      modal.addEventListener("click", onOverlayClick);
    });
  }

  // ---------- Kg / Tutar seçerek miktar girme (tartılı ürün satışı için) ----------
  function showKgOrPricePrompt(productName, pricePerKg) {
    return new Promise((resolve) => {
      const modal = document.getElementById("kgPricePromptModal");
      const titleEl = document.getElementById("kgPricePromptTitle");
      const input = document.getElementById("kgPricePromptInput");
      const preview = document.getElementById("kgPricePromptPreview");
      const kgBtn = document.getElementById("kgPriceModeKgBtn");
      const priceBtn = document.getElementById("kgPriceModePriceBtn");
      const okBtn = document.getElementById("kgPricePromptOkBtn");
      const cancelBtn = document.getElementById("kgPricePromptCancelBtn");

      let mode = "kg";
      titleEl.textContent = `${productName} — ${t("promptKgAmount")}`;
      input.value = "";
      setMode("kg");

      function setMode(newMode) {
        mode = newMode;
        kgBtn.classList.toggle("active", mode === "kg");
        priceBtn.classList.toggle("active", mode === "price");
        updatePreview();
      }

      function updatePreview() {
        const value = parseFloat((input.value || "").replace(",", "."));
        if (!value || value <= 0 || !pricePerKg) {
          preview.textContent = "";
          return;
        }
        if (mode === "kg") {
          preview.textContent = t("kgPricePreviewKg").replace("{value}", formatTL(value * pricePerKg));
        } else {
          preview.textContent = t("kgPricePreviewPrice").replace(
            "{value}",
            (Math.round((value / pricePerKg) * 1000) / 1000).toLocaleString(locale(), { maximumFractionDigits: 3 })
          );
        }
      }

      modal.style.display = "flex";
      setTimeout(() => input.focus(), 50);

      function cleanup(result) {
        modal.style.display = "none";
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        input.removeEventListener("input", updatePreview);
        input.removeEventListener("keydown", onKeydown);
        kgBtn.removeEventListener("click", onKgBtnClick);
        priceBtn.removeEventListener("click", onPriceBtnClick);
        modal.removeEventListener("click", onOverlayClick);
        resolve(result);
      }

      function onOk() {
        const value = parseFloat((input.value || "").replace(",", "."));
        if (!value || value <= 0) {
          cleanup(null);
          return;
        }
        const weightInKg = mode === "kg" ? value : value / pricePerKg;
        cleanup(Math.round(weightInKg * 1000) / 1000);
      }
      function onCancel() {
        cleanup(null);
      }
      function onKeydown(e) {
        if (e.key === "Enter") {
          e.preventDefault();
          onOk();
        } else if (e.key === "Escape") {
          onCancel();
        }
      }
      function onOverlayClick(e) {
        if (e.target === modal) onCancel();
      }
      function onKgBtnClick() {
        setMode("kg");
      }
      function onPriceBtnClick() {
        setMode("price");
      }

      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      input.addEventListener("input", updatePreview);
      input.addEventListener("keydown", onKeydown);
      kgBtn.addEventListener("click", onKgBtnClick);
      priceBtn.addEventListener("click", onPriceBtnClick);
      modal.addEventListener("click", onOverlayClick);
    });
  }

  // ---------- Sesle ürün adı girme (Web Speech API, TR/AR) ----------
  let activeRecognition = null;

  function getSpeechRecognitionClass() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function getVoiceLangForTarget(targetInputId) {
    const container = document.querySelector(`.voice-lang-toggle[data-for="${targetInputId}"]`);
    const activeBtn = container ? container.querySelector(".voice-lang-btn.active") : null;
    return activeBtn ? activeBtn.dataset.lang : "tr-TR";
  }

  function startVoiceInput(targetInputId, micBtn) {
    const SpeechRecognitionClass = getSpeechRecognitionClass();
    if (!SpeechRecognitionClass) {
      showToast(t("voiceNotSupported"), "error");
      return;
    }

    if (activeRecognition) {
      activeRecognition.stop();
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = getVoiceLangForTarget(targetInputId);
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    micBtn.classList.add("listening");
    activeRecognition = recognition;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const input = document.getElementById(targetInputId);
      if (input) input.value = transcript.trim();
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") {
        showToast(t("voiceNoSpeech"), "info");
      } else if (event.error === "not-allowed" || event.error === "permission-denied") {
        showToast(t("voiceNoPermission"), "error");
      } else {
        showToast(t("voiceError"), "error");
      }
    };

    recognition.onend = () => {
      micBtn.classList.remove("listening");
      activeRecognition = null;
    };

    recognition.start();
  }

  function setVoiceLang(container, lang) {
    container.querySelectorAll(".voice-lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });
  }

  function formatQty(p) {
    if (p.unit === "kg") {
      return (Math.round(p.qty * 1000) / 1000).toLocaleString(locale(), { minimumFractionDigits: 0, maximumFractionDigits: 3 }) + " " + t("unitKgShort");
    }
    return p.qty + " " + t("unitAdetShort");
  }

  function formatTL(n) {
    return (Number(n) || 0).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
  }

  // ---------- CRUD ----------
  // ---------- Eski (giriş öncesi) yerel yedeği içe aktar ----------
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

  function addProduct() {
    const nameInput = document.getElementById("newName");
    const catInput = document.getElementById("newCategory");
    const minInput = document.getElementById("newMin");
    const qtyInput = document.getElementById("newQty");
    const priceInput = document.getElementById("newPrice");
    const costPriceInput = document.getElementById("newCostPrice");
    const barcodeInput = document.getElementById("newBarcode");
    const unitInput = document.getElementById("newUnit");

    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }
    const category = catInput.value.trim() || t("categoryOtherDefault");
    const min = Number(minInput.value) || 0;
    const qty = Number(qtyInput.value) || 0;
    const price = Number(priceInput.value) || 0;
    const costPrice = Number(costPriceInput.value) || 0;
    const barcode = barcodeInput.value.trim();
    const unit = unitInput.value;

    products.push(mkProduct(name, category, qty, min, price, barcode, unit, costPrice));
    nameInput.value = "";
    catInput.value = "";
    minInput.value = "5";
    qtyInput.value = "0";
    priceInput.value = "0";
    costPriceInput.value = "0";
    barcodeInput.value = "";
    unitInput.value = "adet";
    save();
    renderAll();
    nameInput.focus();
  }

  function deleteProduct(id) {
    products = products.filter((p) => p.id !== id);
    save();
    closeModal();
    renderAll();
  }

  function adjustQty(id, delta) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    p.qty = Math.max(0, Math.round((p.qty + delta) * 1000) / 1000);
    save();
    renderAll();
    if (activeProductId === id) updateModalContent(p);
  }

  function setQtyManually(id, newQty) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    if (isNaN(newQty) || newQty < 0) {
      showToast(t("alertInvalidAmount"), "error");
      updateModalContent(p);
      return;
    }
    p.qty = Math.round(newQty * 1000) / 1000;
    save();
    renderAll();
    if (activeProductId === id) updateModalContent(p);
  }

  function saveEdit() {
    const p = products.find((x) => x.id === activeProductId);
    if (!p) return;
    const name = document.getElementById("editName").value.trim();
    if (!name) return;
    p.name = name;
    p.category = document.getElementById("editCategory").value.trim() || t("categoryOtherDefault");
    p.min = Number(document.getElementById("editMin").value) || 0;
    p.price = Number(document.getElementById("editPrice").value) || 0;
    p.costPrice = Number(document.getElementById("editCostPrice").value) || 0;
    p.barcode = document.getElementById("editBarcode").value.trim();
    p.unit = document.getElementById("editUnit").value;
    save();
    renderAll();
    updateModalContent(p);
  }

  function resetAll() {
    products.forEach((p) => {
      p.qty = Math.max(p.min, 1);
    });
    save();
    renderAll();
  }

  // ---------- Rendering: Products ----------
  function productRowHtml(p) {
    const status = getStatus(p);
    const priceLabel = p.unit === "kg" ? formatTL(p.price) + t("perKgSuffix") : formatTL(p.price);
    return `
      <div class="product-row" data-id="${p.id}">
        <div class="product-info">
          <p class="product-name">${escapeHtml(p.name)}</p>
          <p class="product-meta">${escapeHtml(p.category)} · ${t("stockShortLabel")}: ${formatQty(p)} · ${priceLabel}</p>
        </div>
        <span class="status-badge ${STATUS_CLASS[status]}">${getStatusLabel(status)}</span>
      </div>`;
  }

  function renderAll() {
    const searchEl = document.getElementById("searchBox");
    const search = (searchEl ? searchEl.value : "").toLowerCase().trim();
    const list = document.getElementById("productList");
    const empty = document.getElementById("emptyState");

    const filtered = products.filter((p) => p.name.toLowerCase().includes(search) || p.category.toLowerCase().includes(search));

    if (!filtered.length) {
      list.innerHTML = "";
      empty.style.display = "block";
    } else {
      empty.style.display = "none";
      list.innerHTML = filtered.map(productRowHtml).join("");
    }

    list.querySelectorAll(".product-row").forEach((row) => {
      row.addEventListener("click", () => openModal(row.dataset.id));
    });

    // Order list
    const orderList = document.getElementById("orderList");
    const orderEmpty = document.getElementById("orderEmptyState");
    const needsOrder = products
      .filter((p) => getStatus(p) !== "yeterli")
      .sort((a, b) => (getStatus(a) === "tukendi" ? 0 : 1) - (getStatus(b) === "tukendi" ? 0 : 1));

    if (!needsOrder.length) {
      orderList.innerHTML = "";
      orderEmpty.style.display = "block";
    } else {
      orderEmpty.style.display = "none";
      orderList.innerHTML = needsOrder.map(productRowHtml).join("");
      orderList.querySelectorAll(".product-row").forEach((row) => {
        row.addEventListener("click", () => openModal(row.dataset.id));
      });
    }

    document.getElementById("statTotal").textContent = products.length;
    document.getElementById("statOrder").textContent = needsOrder.length;

    renderCart();
    renderSales();
    renderCustomers();
    renderBreadStatus();
  }

  // ---------- Modal ----------
  function openModal(id) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    activeProductId = id;
    document.getElementById("editName").value = p.name;
    document.getElementById("editCategory").value = p.category;
    document.getElementById("editMin").value = p.min;
    document.getElementById("editPrice").value = p.price;
    document.getElementById("editCostPrice").value = p.costPrice || 0;
    document.getElementById("editBarcode").value = p.barcode || "";
    document.getElementById("editUnit").value = p.unit || "adet";
    updateModalContent(p);
    document.getElementById("detailModal").style.display = "flex";
    renderQrCode(p.id);
  }

  function updateModalContent(p) {
    document.getElementById("modalProductName").textContent = p.name;
    const qtyInput = document.getElementById("modalQtyInput");
    if (document.activeElement !== qtyInput) {
      qtyInput.value = p.qty;
    }
    const status = getStatus(p);
    const pill = document.getElementById("modalStatus");
    pill.textContent = getStatusLabel(status);
    pill.className = "status-pill " + STATUS_CLASS[status];
  }

  function closeModal() {
    document.getElementById("detailModal").style.display = "none";
    activeProductId = null;
  }

  function renderQrCode(productId) {
    const box = document.getElementById("modalQrCode");
    box.innerHTML = "";
    if (typeof QRCode !== "undefined") {
      new QRCode(box, {
        text: productId,
        width: 160,
        height: 160,
        colorDark: "#1F3864",
        colorLight: "#ffffff"
      });
    } else {
      box.textContent = t("qrLibError");
    }
  }

  function printQr() {
    const box = document.getElementById("modalQrCode");
    const p = products.find((x) => x.id === activeProductId);
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>${t("printWindowTitle")}</title></head>
      <body style="text-align:center;font-family:sans-serif;padding:40px;">
        <h3>${escapeHtml(p ? p.name : "")}</h3>
        ${box.innerHTML}
        <script>window.onload = function(){ window.print(); }<\/script>
      </body></html>
    `);
    win.document.close();
  }

  function findProductByScan(code) {
    return products.find((p) => p.id === code || (p.barcode && p.barcode === code));
  }

  // ---------- QR Scanning: Stok giriş/çıkış ----------
  function startScan() {
    const readerEl = document.getElementById("qrReader");
    document.getElementById("startScanBtn").style.display = "none";
    document.getElementById("stopScanBtn").style.display = "flex";
    readerEl.innerHTML = "";
    html5QrCode = new Html5Qrcode("qrReader");
    scanning = true;

    html5QrCode
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          onScanSuccess(decodedText);
        },
        () => {}
      )
      .catch((err) => {
        showToast(t("cameraError"), "error");
        stopScan();
      });
  }

  function stopScan() {
    document.getElementById("startScanBtn").style.display = "flex";
    document.getElementById("stopScanBtn").style.display = "none";
    if (html5QrCode && scanning) {
      html5QrCode
        .stop()
        .then(() => html5QrCode.clear())
        .catch(() => {});
    }
    scanning = false;
  }

  function onScanSuccess(decodedText) {
    if (stokScanCooldown) return;
    const p = findProductByScan(decodedText);
    if (!p) {
      showToast(t("alertNotRegistered"), "error");
      return;
    }
    stopScan();
    if (p.unit === "kg") {
      const action = confirm(`${p.name}\n${t("currentStockLabel")}: ${formatQty(p)}\n\n${t("confirmStockDirection")}`);
      showPrompt(t("promptKgAmount"), "").then((input) => {
        if (input === null) return;
        const weight = parseFloat(input.replace(",", "."));
        if (!weight || weight <= 0) {
          showToast(t("alertInvalidWeight"), "error");
          return;
        }
        adjustQty(p.id, action ? weight : -weight);
      });
    } else {
      const action = confirm(`${p.name}\n${t("currentStockLabel")}: ${p.qty}\n\n${t("confirmStockDirection")}`);
      showPrompt(t("promptAdetAmount"), "1").then((input) => {
        if (input === null) return;
        const amount = parseFloat(input.replace(",", "."));
        if (!amount || amount <= 0) {
          showToast(t("alertInvalidAmount"), "error");
          return;
        }
        adjustQty(p.id, action ? amount : -amount);
      });
    }
  }

  // ---------- QR Scanning: Kasa (satış) ----------
  function startScanKasa() {
    const readerEl = document.getElementById("qrReaderKasa");
    document.getElementById("startKasaScanBtn").style.display = "none";
    document.getElementById("stopKasaScanBtn").style.display = "flex";
    readerEl.innerHTML = "";
    html5QrCodeKasa = new Html5Qrcode("qrReaderKasa");
    scanningKasa = true;

    html5QrCodeKasa
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          onScanSuccessKasa(decodedText);
        },
        () => {}
      )
      .catch((err) => {
        showToast(t("cameraError"), "error");
        stopScanKasa();
      });
  }

  function stopScanKasa() {
    document.getElementById("startKasaScanBtn").style.display = "flex";
    document.getElementById("stopKasaScanBtn").style.display = "none";
    if (html5QrCodeKasa && scanningKasa) {
      html5QrCodeKasa
        .stop()
        .then(() => html5QrCodeKasa.clear())
        .catch(() => {});
    }
    scanningKasa = false;
  }

  // ---------- Barkod okuma "düüt" sesi ----------
  let beepAudioCtx = null;

  function playBeepSound() {
    try {
      if (!beepAudioCtx) {
        beepAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = beepAudioCtx;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = "square";
      oscillator.frequency.value = 1500;
      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.12);
    } catch (e) {
      // ses çalınamazsa sessizce devam et
    }
  }

  function onScanSuccessKasa(decodedText) {
    if (kasaScanCooldown) return;
    const p = findProductByScan(decodedText);
    if (!p) {
      showToast(t("alertNotRegistered"), "error");
      return;
    }

    if (p.unit === "kg") {
      showKgOrPricePrompt(p.name, p.price).then((weight) => {
        if (weight === null) return;
        if (!weight || weight <= 0) {
          showToast(t("alertInvalidWeight"), "error");
          return;
        }
        playBeepSound();
        addToCart(p, weight);
        kasaScanCooldown = true;
        showKasaScanFeedback(`${p.name} (${weight} ${t("unitKgShort")})`);
        setTimeout(() => {
          kasaScanCooldown = false;
        }, 3000);
      });
    } else {
      playBeepSound();
      addToCart(p, 1);
      kasaScanCooldown = true;
      showKasaScanFeedback(p.name);
      setTimeout(() => {
        kasaScanCooldown = false;
      }, 3000);
    }
  }

  function showKasaScanFeedback(name) {
    const readerEl = document.getElementById("qrReaderKasa");
    if (!readerEl) return;
    let badge = document.getElementById("kasaScanFeedback");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "kasaScanFeedback";
      badge.className = "scan-feedback";
      readerEl.parentElement.insertBefore(badge, readerEl.nextSibling);
    }
    badge.innerHTML = `<i class="fa-solid fa-check" aria-hidden="true"></i> ${escapeHtml(name)} ${t("addedToCartSuffix")}`;
    badge.classList.add("show");
    clearTimeout(badge._hideTimer);
    badge._hideTimer = setTimeout(() => {
      badge.classList.remove("show");
    }, 3000);
  }

  function manualAddToCart(productId) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;

    if (p.unit === "kg") {
      showKgOrPricePrompt(p.name, p.price).then((weight) => {
        if (weight === null) return;
        if (!weight || weight <= 0) {
          showToast(t("alertInvalidAmount"), "error");
          return;
        }
        addToCart(p, weight);
        document.getElementById("manualAddSearch").value = "";
        renderManualAddResults();
      });
      return;
    }

    showPrompt(`${p.name} — ${t("promptAdetAmount")}`, "1").then((input) => {
      if (input === null) return;
      const amount = parseFloat(input.replace(",", "."));
      if (!amount || amount <= 0) {
        showToast(t("alertInvalidAmount"), "error");
        return;
      }
      addToCart(p, amount);
      document.getElementById("manualAddSearch").value = "";
      renderManualAddResults();
    });
  }

  function renderManualAddResults() {
    const searchEl = document.getElementById("manualAddSearch");
    const resultsEl = document.getElementById("manualAddResults");
    if (!searchEl || !resultsEl) return;
    const q = (searchEl.value || "").toLowerCase().trim();
    if (!q) {
      resultsEl.innerHTML = "";
      return;
    }
    const matches = products
      .filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      .slice(0, 8);

    if (!matches.length) {
      resultsEl.innerHTML = `<p class="empty-state" style="display:block;">${t("noMatchingProducts")}</p>`;
      return;
    }

    resultsEl.innerHTML = matches
      .map((p) => {
        const priceLabel = p.unit === "kg" ? formatTL(p.price) + t("perKgSuffix") : formatTL(p.price);
        return `
          <div class="product-row manual-add-row" data-id="${p.id}">
            <div class="product-info">
              <p class="product-name">${escapeHtml(p.name)}</p>
              <p class="product-meta">${escapeHtml(p.category)} · ${t("stockShortLabel")}: ${formatQty(p)} · ${priceLabel}</p>
            </div>
            <button class="btn btn-sm manual-add-btn" data-id="${p.id}">${t("addBtnShort")}</button>
          </div>`;
      })
      .join("");

    resultsEl.querySelectorAll(".manual-add-btn").forEach((btn) => {
      btn.addEventListener("click", () => manualAddToCart(btn.dataset.id));
    });
  }

  // ---------- Kasa: Sepet ----------
  function addToCart(p, amount) {
    amount = amount || 1;
    const existing = cart.find((c) => c.productId === p.id);
    if (existing) {
      existing.qty = Math.round((existing.qty + amount) * 1000) / 1000;
    } else {
      cart.push({ productId: p.id, name: p.name, price: p.price, qty: amount, unit: p.unit || "adet" });
    }
    renderCart();
  }

  function adjustCartQty(productId, delta) {
    const item = cart.find((c) => c.productId === productId);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter((c) => c.productId !== productId);
    }
    renderCart();
  }

  function editCartWeight(productId) {
    const item = cart.find((c) => c.productId === productId);
    if (!item) return;
    showKgOrPricePrompt(item.name, item.price).then((weight) => {
      if (weight === null) return;
      if (!weight || weight <= 0) {
        removeCartItem(productId);
        return;
      }
      item.qty = Math.round(weight * 1000) / 1000;
      renderCart();
    });
  }

  function removeCartItem(productId) {
    cart = cart.filter((c) => c.productId !== productId);
    renderCart();
  }

  function clearCart() {
    cart = [];
    renderCart();
  }

  function cartRowHtml(item) {
    const lineTotal = item.price * item.qty;
    const isKg = item.unit === "kg";
    const qtyDisplay = isKg
      ? (Math.round(item.qty * 1000) / 1000).toLocaleString(locale(), { maximumFractionDigits: 3 }) + " " + t("unitKgShort")
      : item.qty;
    const controlsHtml = isKg
      ? `
          <button class="cart-edit-weight-btn" data-id="${item.productId}" aria-label="${t('editWeightAria')}"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
          <span class="cart-qty-value">${qtyDisplay}</span>`
      : `
          <button class="cart-qty-btn cart-minus" data-id="${item.productId}" aria-label="${t('decreaseAria')}"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
          <span class="cart-qty-value">${item.qty}</span>
          <button class="cart-qty-btn cart-plus" data-id="${item.productId}" aria-label="${t('increaseAria')}"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>`;
    return `
      <div class="cart-row" data-id="${item.productId}">
        <div class="cart-info">
          <p class="cart-name">${escapeHtml(item.name)}</p>
          <p class="cart-meta">${formatTL(item.price)} / ${isKg ? t("unitKgShort") : t("unitAdetShort")}</p>
        </div>
        <div class="cart-controls">
          ${controlsHtml}
          <span class="cart-line-total">${formatTL(lineTotal)}</span>
          <button class="cart-remove-btn" data-id="${item.productId}" aria-label="${t('removeAria')}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>
      </div>`;
  }

  function renderCart() {
    const list = document.getElementById("cartList");
    const empty = document.getElementById("cartEmptyState");
    if (!list) return;

    if (!cart.length) {
      list.innerHTML = "";
      empty.style.display = "block";
    } else {
      empty.style.display = "none";
      list.innerHTML = cart.map(cartRowHtml).join("");
    }

    list.querySelectorAll(".cart-plus").forEach((btn) => {
      btn.addEventListener("click", () => adjustCartQty(btn.dataset.id, 1));
    });
    list.querySelectorAll(".cart-minus").forEach((btn) => {
      btn.addEventListener("click", () => adjustCartQty(btn.dataset.id, -1));
    });
    list.querySelectorAll(".cart-edit-weight-btn").forEach((btn) => {
      btn.addEventListener("click", () => editCartWeight(btn.dataset.id));
    });
    list.querySelectorAll(".cart-remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => removeCartItem(btn.dataset.id));
    });

    const subtotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
    const discountInput = document.getElementById("cartDiscount");
    const discount = Math.min(Number(discountInput.value) || 0, subtotal);
    const total = Math.max(0, subtotal - discount);

    document.getElementById("cartSubtotal").textContent = formatTL(subtotal);
    document.getElementById("cartTotal").textContent = formatTL(total);
  }

  function setPaymentType(type) {
    selectedPaymentType = type;
    document.getElementById("payNakitBtn").classList.toggle("active", type === "nakit");
    document.getElementById("payVeresiyeBtn").classList.toggle("active", type === "veresiye");
    document.getElementById("veresiyeCustomerRow").style.display = type === "veresiye" ? "block" : "none";
  }

  function completeSale() {
    if (!cart.length) {
      showToast(t("alertEmptyCart"), "error");
      return;
    }

    let customerId = null;
    let customerName = null;
    if (selectedPaymentType === "veresiye") {
      if (!customers.length) {
        showToast(t("alertNeedCustomer"), "error");
        return;
      }
      customerId = document.getElementById("veresiyeCustomerSelectedId").value;
      const c = customers.find((x) => x.id === customerId);
      if (!c) {
        showToast(t("alertSelectCustomer"), "error");
        return;
      }
      customerName = c.name;
    }

    const subtotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
    const discountInput = document.getElementById("cartDiscount");
    const discount = Math.min(Number(discountInput.value) || 0, subtotal);
    const total = Math.max(0, subtotal - discount);

    let totalCost = 0;
    const saleItems = cart.map((c) => {
      const p = products.find((x) => x.id === c.productId);
      const costPrice = p ? p.costPrice || 0 : 0;
      totalCost += costPrice * c.qty;
      return { name: c.name, qty: c.qty, price: c.price, unit: c.unit || "adet", costPrice };
    });
    const profit = total - totalCost;

    cart.forEach((item) => {
      const p = products.find((x) => x.id === item.productId);
      if (p) p.qty = Math.max(0, p.qty - item.qty);
    });

    sales.push({
      id: genId(),
      timestamp: new Date().toISOString(),
      items: saleItems,
      subtotal,
      discount,
      total,
      cost: totalCost,
      profit,
      paymentType: selectedPaymentType,
      customerId,
      customerName
    });

    cart = [];
    discountInput.value = "0";
    clearVeresiyeCustomerSelection();
    setPaymentType("nakit");
    save();
    renderAll();
    showToast(`${t("alertSaleComplete")} ${formatTL(total)}${customerName ? " (" + t("veresiyeLabel") + ": " + customerName + ")" : ""}`, "success");
  }

  function cancelSale(saleId) {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return;
    if (!confirm(`${t("confirmCancelSale")}\n${formatTL(sale.total)} ${t("confirmCancelSaleDetail")}`)) {
      return;
    }
    sale.items.forEach((item) => {
      const p = products.find((x) => x.name === item.name);
      if (p) p.qty += item.qty;
    });
    sales = sales.filter((s) => s.id !== saleId);
    save();
    renderAll();
  }

  // ---------- Satışlar (geçmiş + rapor) ----------
  function isInPeriod(isoString, period) {
    const d = new Date(isoString);
    const now = new Date();
    if (period === "today") {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    }
    if (period === "week") {
      const dayOfWeek = (now.getDay() + 6) % 7; // Pazartesi=0
      const monday = new Date(now);
      monday.setHours(0, 0, 0, 0);
      monday.setDate(now.getDate() - dayOfWeek);
      return d >= monday;
    }
    if (period === "month") {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    return true; // 'all'
  }

  function saleRowHtml(sale) {
    const d = new Date(sale.timestamp);
    const timeStr = d.toLocaleString(locale(), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    const itemsSummary = sale.items
      .map((i) => `${escapeHtml(i.name)} x${i.unit === "kg" ? i.qty + t("unitKgShort") : i.qty}`)
      .join(", ");
    const paymentBadge = sale.paymentType === "veresiye" ? `<span class="sale-payment-badge">${t("veresiyeLabel")}${sale.customerName ? ": " + escapeHtml(sale.customerName) : ""}</span>` : "";
    const profitValue = sale.profit != null ? sale.profit : sale.total;
    return `
      <div class="sale-row">
        <div class="sale-row-top">
          <span class="sale-time">${timeStr}</span>
          <span class="sale-amount">${formatTL(sale.total)}</span>
        </div>
        <p class="sale-items">${itemsSummary}</p>
        <p class="sale-profit">${t("profitLabel")}: ${formatTL(profitValue)}</p>
        <div class="sale-row-bottom">
          ${paymentBadge}
          <button class="sale-cancel-btn" data-id="${sale.id}">
            <i class="fa-solid fa-rotate-left" aria-hidden="true"></i> ${t("cancelSaleBtn")}
          </button>
        </div>
      </div>`;
  }

  function topProductRowHtml(item, rank) {
    return `
      <div class="product-row">
        <div class="product-info">
          <p class="product-name">${rank}. ${escapeHtml(item.name)}</p>
          <p class="product-meta">${item.qty} ${t("soldQtyLabel")}</p>
        </div>
        <span class="sale-amount">${formatTL(item.revenue)}</span>
      </div>`;
  }

  function renderSales() {
    const list = document.getElementById("salesList");
    const empty = document.getElementById("salesEmptyState");
    const topList = document.getElementById("topProductsList");
    const topEmpty = document.getElementById("topProductsEmptyState");
    if (!list) return;

    const periodSales = sales.filter((s) => isInPeriod(s.timestamp, currentSalesPeriod));
    const sorted = [...periodSales].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (!sorted.length) {
      list.innerHTML = "";
      empty.style.display = "block";
    } else {
      empty.style.display = "none";
      list.innerHTML = sorted.map(saleRowHtml).join("");
      list.querySelectorAll(".sale-cancel-btn").forEach((btn) => {
        btn.addEventListener("click", () => cancelSale(btn.dataset.id));
      });
    }

    // En çok satan ürünler
    const productTotals = {};
    periodSales.forEach((s) => {
      s.items.forEach((i) => {
        if (!productTotals[i.name]) productTotals[i.name] = { name: i.name, qty: 0, revenue: 0 };
        productTotals[i.name].qty += i.qty;
        productTotals[i.name].revenue += i.qty * i.price;
      });
    });
    const topProducts = Object.values(productTotals)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    if (!topProducts.length) {
      topList.innerHTML = "";
      topEmpty.style.display = "block";
    } else {
      topEmpty.style.display = "none";
      topList.innerHTML = topProducts.map((item, i) => topProductRowHtml(item, i + 1)).join("");
    }

    const periodTotal = periodSales.reduce((sum, s) => sum + s.total, 0);
    const periodProfit = periodSales.reduce((sum, s) => sum + (s.profit != null ? s.profit : s.total), 0);
    document.getElementById("statPeriodTotal").textContent = formatTL(periodTotal);
    document.getElementById("statPeriodCount").textContent = periodSales.length;
    const profitEl = document.getElementById("statNetProfit");
    if (profitEl) {
      profitEl.textContent = formatTL(periodProfit);
      const profitCard = profitEl.closest(".profit-highlight-card");
      if (profitCard) profitCard.classList.toggle("negative", periodProfit < 0);
    }
  }

  // ---------- Hızlı barkod tarama (ürün ekle/düzenle formları için) ----------
  let quickScanCode = null;
  let quickScanTargetInputId = null;

  function openQuickBarcodeScan(targetInputId) {
    quickScanTargetInputId = targetInputId;
    document.getElementById("barcodeScanModal").style.display = "flex";
    const readerEl = document.getElementById("quickScanReader");
    readerEl.innerHTML = "";
    quickScanCode = new Html5Qrcode("quickScanReader");
    quickScanCode
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          const input = document.getElementById(quickScanTargetInputId);
          if (input) input.value = decodedText;
          closeQuickBarcodeScan();
          lookupBarcodeAndFill(decodedText, quickScanTargetInputId);
        },
        () => {}
      )
      .catch((err) => {
        showToast(t("cameraError"), "error");
        closeQuickBarcodeScan();
      });
  }

  function closeQuickBarcodeScan() {
    document.getElementById("barcodeScanModal").style.display = "none";
    if (quickScanCode) {
      quickScanCode
        .stop()
        .then(() => quickScanCode.clear())
        .catch(() => {});
      quickScanCode = null;
    }
  }

  // ---------- Open Food Facts: barkoddan otomatik ürün bilgisi ----------
  function lookupBarcodeAndFill(barcode, targetInputId) {
    const isNewForm = targetInputId === "newBarcode";
    const nameInput = document.getElementById(isNewForm ? "newName" : "editName");
    const categoryInput = document.getElementById(isNewForm ? "newCategory" : "editCategory");

    fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,categories_tags`)
      .then((r) => r.json())
      .then((data) => {
        if (!data || data.status !== 1 || !data.product) return;
        const p = data.product;
        const brand = (p.brands || "").split(",")[0].trim();
        const productName = p.product_name || "";
        const fullName = [brand, productName].filter(Boolean).join(" ").trim();
        if (fullName && !nameInput.value.trim()) {
          nameInput.value = fullName;
        }
        if (p.categories_tags && p.categories_tags.length && !categoryInput.value.trim()) {
          const rawCat = p.categories_tags[p.categories_tags.length - 1] || "";
          categoryInput.value = rawCat.replace(/^\w\w:/, "").replace(/-/g, " ");
        }
      })
      .catch(() => {});
  }

  // ---------- Toplu fotoğraf tarama (Google Gemini ücretsiz API ile raf tanıma) ----------
  let bulkScanCandidates = [];

  function isBulkScanConfigured() {
    return typeof bulkScanConfig !== "undefined" && bulkScanConfig.workerUrl && bulkScanConfig.workerUrl.indexOf("BURAYA") !== 0;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function productAlreadyExists(name) {
    const normalized = name.trim().toLowerCase();
    return products.some((p) => p.name.trim().toLowerCase() === normalized);
  }

  function sleep_(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function callGeminiWithRetry(base64, prompt, maxRetries) {
    maxRetries = maxRetries || 3;
    let attempt = 0;

    if (!currentUser) {
      return Promise.resolve({ error: { message: "Giriş yapmadan bu özellik kullanılamaz." } });
    }

    return currentUser.getIdToken().then((idToken) => {
      function attemptCall() {
        attempt++;
        return fetch(bulkScanConfig.workerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ prompt, image: base64, idToken })
        }).then((r) => {
          if ((r.status === 503 || r.status === 429) && attempt < maxRetries) {
            const delay = attempt * 3000;
            console.log(`Gemini ${r.status}, ${delay}ms sonra tekrar denenecek (deneme ${attempt}/${maxRetries})`);
            return sleep_(delay).then(attemptCall);
          }
          return r.json();
        });
      }

      return attemptCall();
    });
  }

  function analyzeOnePhoto(file) {
    const prompt = [
      "Bu bir market/bakkal rafının fotoğrafı.",
      "Fotoğrafta görünen HER FARKLI ürünü tek tek tespit et.",
      "Her ürün için şu alanları çıkar:",
      '- name: ürün adı ve varsa hacmi/boyutu (örn. "Pepsi 1 Lt")',
      "- brand: marka adı",
      "- category: genel kategori (örn. içecekler, atıştırmalık, temizlik)",
      "- price: fiyat etiketinde açıkça görünüyorsa sayı olarak, görünmüyorsa null",
      "- qty: RAFTA GÖRÜNEN bu üründen kaç adet olduğunu dikkatlice SAY (üst üste/yan yana duran aynı ürünleri tek tek say). Kısmen görünen ya da arkada gizlenmiş olabilecekleri de makul şekilde tahmin et. Sayamıyorsan 1 yaz, ASLA 0 yazma.",
      "",
      "SADECE geçerli bir JSON dizisi döndür, başka hiçbir açıklama veya metin ekleme.",
      'Format: [{"name":"...","brand":"...","category":"...","price":12.5,"qty":5}]',
      "Aynı üründen birden fazla varsa listede BİR KEZ yaz, gördüğün toplam adedi qty alanına yaz (ayrı ayrı satırlar olarak tekrarlama)."
    ].join("\n");

    return fileToBase64(file)
      .then((base64) => callGeminiWithRetry(base64, prompt))
      .then((data) => {
        const rawText = data && data.candidates && data.candidates[0] && data.candidates[0].content.parts[0].text;
        if (!rawText) {
          console.error("Gemini yanıtı beklenmedik formatta:", data);
          return [];
        }
        try {
          const cleaned = rawText.replace(/```json|```/g, "").trim();
          return JSON.parse(cleaned);
        } catch (e) {
          console.error("JSON ayrıştırma hatası:", e, rawText);
          return [];
        }
      })
      .catch((e) => {
        console.error(e);
        return [];
      });
  }

  // ---------- Dosya İşleyici (File Handling API) - CSV toplu ürün içe aktarma ----------
  function checkForLaunchedFile() {
    if (!("launchQueue" in window)) return;
    window.launchQueue.setConsumer((launchParams) => {
      if (!launchParams.files || !launchParams.files.length) return;
      launchParams.files[0].getFile().then((file) => {
        file.text().then((text) => importProductsFromCsv(text));
      });
    });
  }

  function importProductsFromRows(rows) {
    if (!rows.length) return;

    const firstCells = rows[0].map((c) => String(c || "").trim().toLowerCase());
    const hasHeader = firstCells.includes("name") || firstCells.includes("ürün adı") || firstCells.includes("urun adi");
    const dataRows = hasHeader ? rows.slice(1) : rows;

    let addedCount = 0;
    dataRows.forEach((cols) => {
      const name = String(cols[0] || "").trim();
      if (!name) return;
      const category = String(cols[1] || "").trim() || t("categoryOtherDefault");
      const qty = Number(cols[2]) || 0;
      const price = Number(cols[3]) || 0;
      if (productAlreadyExists(name)) return;
      products.push(mkProduct(name, category, qty, 5, price, "", "adet", 0));
      addedCount++;
    });

    if (addedCount > 0) {
      save();
      renderAll();
      showToast(t("bulkAddedAlert").replace("{n}", addedCount), "success");
    } else {
      showToast(t("invoiceScanNoItems"), "info");
    }
  }

  function importProductsFromCsv(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const rows = lines.map((line) => line.split(",").map((c) => c.trim()));
    importProductsFromRows(rows);
  }

  function handleCsvImportFile(file) {
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        importProductsFromRows(rows);
      };
      reader.readAsArrayBuffer(file);
    } else {
      file.text().then((text) => importProductsFromCsv(text));
    }
  }

  // ---------- Not Alma (Note Taking capability) - hızlı ürün ekleme formuna yönlendir ----------
  function checkForNoteTakingLaunch() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("newnote") !== "1") return;
    window.history.replaceState({}, "", window.location.pathname);
    switchTab("tab-products");
    setTimeout(() => {
      const input = document.getElementById("newName");
      if (input) input.focus();
    }, 200);
  }

  // ---------- Protokol İşleyici (web+bakkal://) ----------
  function checkForProtocolLaunch() {
    const params = new URLSearchParams(window.location.search);
    const weblink = params.get("weblink");
    if (!weblink) return;
    window.history.replaceState({}, "", window.location.pathname);

    try {
      const decoded = decodeURIComponent(weblink);
      const afterScheme = decoded.split("://")[1] || "";
      const tabMap = {
        kasa: "tab-kasa",
        urunler: "tab-products",
        satislar: "tab-sales",
        veresiye: "tab-veresiye",
        siparis: "tab-orders",
        tara: "tab-scan"
      };
      const targetTab = tabMap[afterScheme.toLowerCase()];
      if (targetTab) switchTab(targetTab);
    } catch (e) {
      // yoksay
    }
  }

  // ---------- Paylaşılan fotoğrafı işleme (Share Target) ----------
  function checkForSharedPhoto() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("shared") !== "1") return;

    // URL'yi temizle, tekrar tekrar tetiklenmesin
    window.history.replaceState({}, "", window.location.pathname);

    if (!("caches" in window)) return;
    caches
      .open("shared-photo-cache")
      .then((cache) => cache.match("/shared-photo"))
      .then((response) => {
        if (!response) return;
        return response.blob().then((blob) => {
          const file = new File([blob], "paylasilan-fotograf.jpg", { type: blob.type || "image/jpeg" });
          caches.open("shared-photo-cache").then((cache) => cache.delete("/shared-photo"));
          askSharedPhotoDestination(file);
        });
      })
      .catch(() => {});
  }

  function askSharedPhotoDestination(file) {
    if (confirm(t("sharedPhotoPrompt"))) {
      handleShelfPhotos([file]);
    } else {
      handleInvoicePhotos([file]);
    }
  }

  function handleShelfPhotos(files) {
    if (!isBulkScanConfigured()) {
      showToast(t("bulkScanNotConfigured"), "error");
      return;
    }
    const loadingEl = document.getElementById("bulkScanLoading");
    const loadingText = loadingEl.querySelector("span");
    loadingEl.style.display = "flex";

    let allDetected = [];
    let index = 0;

    function processNext() {
      if (index >= files.length) {
        loadingEl.style.display = "none";
        if (loadingText) loadingText.textContent = t("bulkScanAnalyzing");

        // Aynı isimli ürünleri (farklı fotoğraflarda tekrar görünenleri) tekilleştir
        const seen = new Set();
        const deduped = [];
        allDetected.forEach((p) => {
          const key = (p.name || "").trim().toLowerCase();
          if (key && !seen.has(key)) {
            seen.add(key);
            deduped.push(p);
          }
        });

        bulkScanCandidates = deduped.filter((p) => p.name && !productAlreadyExists(p.name));

        if (!bulkScanCandidates.length) {
          showToast(t("bulkScanNoNew"), "info");
          return;
        }
        renderBulkScanModal();
        return;
      }

      if (loadingText && files.length > 1) {
        loadingText.textContent = `${t("bulkScanAnalyzing")} (${index + 1}/${files.length})`;
      }

      analyzeOnePhoto(files[index]).then((detected) => {
        if (Array.isArray(detected)) allDetected = allDetected.concat(detected);
        index++;
        processNext();
      });
    }

    processNext();
  }

  function renderBulkScanModal() {
    const titleEl = document.getElementById("bulkScanModalTitle");
    titleEl.textContent = t("bulkScanFoundTitle").replace("{n}", bulkScanCandidates.length);

    const listEl = document.getElementById("bulkScanResultsList");
    listEl.innerHTML = bulkScanCandidates
      .map((p, i) => {
        const metaParts = [p.brand, p.category].filter(Boolean).join(" · ");
        const priceStr = p.price ? formatTL(p.price) : "";
        const qtyStr = `${p.qty || 1} ${t("unitAdetShort")}`;
        return `
          <label class="bulk-result-row">
            <input type="checkbox" class="bulk-result-check" data-index="${i}" checked />
            <div class="bulk-result-info">
              <p class="bulk-result-name">${escapeHtml(p.name)}</p>
              <p class="bulk-result-meta">${escapeHtml(metaParts)}${priceStr ? " · " + priceStr : ""} · ${qtyStr}</p>
            </div>
          </label>`;
      })
      .join("");

    document.getElementById("bulkScanModal").style.display = "flex";
  }

  function closeBulkScanModal() {
    document.getElementById("bulkScanModal").style.display = "none";
    bulkScanCandidates = [];
  }

  function addAllBulkScanProducts() {
    const checks = document.querySelectorAll(".bulk-result-check");
    let addedCount = 0;
    checks.forEach((chk) => {
      if (!chk.checked) return;
      const candidate = bulkScanCandidates[Number(chk.dataset.index)];
      if (!candidate) return;
      products.push(
        mkProduct(
          candidate.name,
          candidate.category || t("categoryOtherDefault"),
          candidate.qty || 1,
          5,
          candidate.price || 0,
          "",
          "adet"
        )
      );
      addedCount++;
    });
    save();
    renderAll();
    closeBulkScanModal();
    showToast(t("bulkAddedAlert").replace("{n}", addedCount), "success");
  }

  // ---------- Fatura ile toplu stok girişi (Google Gemini ücretsiz API ile) ----------
  let invoiceScanCandidates = [];

  function findExistingProductByName(name) {
    const normalized = (name || "").trim().toLowerCase();
    if (!normalized) return null;
    let match = products.find((p) => p.name.trim().toLowerCase() === normalized);
    if (match) return match;
    // Tam eşleşme yoksa, birbirini içeren isimlerle gevşek eşleştirme dene
    match = products.find(
      (p) => p.name.trim().toLowerCase().includes(normalized) || normalized.includes(p.name.trim().toLowerCase())
    );
    return match || null;
  }

  function analyzeOneInvoicePhoto(file) {
    const prompt = [
      "Bu bir tedarikçi/toptancı faturasının fotoğrafı. Faturadaki HER ÜRÜN SATIRINI tek tek çıkar.",
      "",
      "ÇOK ÖNEMLİ - GERÇEK ADET HESABI:",
      "Faturalarda miktar sütunu genellikle 'Kutu', 'Koli', 'Paket' gibi bir toplu satış birimiyle yazılır,",
      "ama kutunun/kolinin İÇİNDE birden fazla tekil ürün (adet) olabilir. Senin görevin, GERÇEKTE kaç",
      "TEKİL ADET satın alındığını bulmak, sadece faturadaki ham sayıyı kopyalamak değil. Bunun için:",
      "1. Ürün adı/açıklamasında geçen paket bilgisini oku (örn. '24'lü', '(4*6)', '1*12', 'x24', '12 Adet/Koli' gibi ifadeler kutu başına kaç tekil ürün olduğunu gösterir).",
      "2. Eğer ürün adında/açıklamasında böyle bir bilgi YOKSA ama marka ve ürün tipini tanıyorsan (örn. Eti, Ülker, Dimes gibi bilinen Türk gıda markalarının standart koli/kutu içerikleri), kendi bilgine dayanarak o markanın o tür ürünü için YAYGIN OLARAK bilinen koli/kutu içeriğini tahmin et.",
      "3. Birim 'Adet' olarak yazılmışsa ve tekil bir ürün olduğu açıksa (paket/koli değilse), olduğu gibi bırak.",
      "4. Hiçbir şekilde emin olamıyorsan, faturadaki ham sayıyı olduğu gibi kullan ama unitNote alanında 'kutu miktarı belirsiz, kontrol et' gibi bir uyarı ekle.",
      "Sakın kör bir formülle (sadece parantez içindeki sayıları çarparak) hareket etme — gerçekten faturayı ve ürünü anlamaya çalış, mantıklı bir sonuca var.",
      "",
      "Her satır için şu alanları çıkar:",
      '- name: ürün adı (faturada yazdığı gibi, örn. "Pepsi 1 Lt")',
      "- qty: yukarıdaki mantığa göre hesapladığın GERÇEK TEKİL ADET sayısı (sayı olarak)",
      "- unitCost: TEKİL ADET başına alış fiyatı (sayı olarak). Faturada kutu/koli fiyatı yazıyorsa, bunu senin hesapladığın gerçek adet sayısına bölerek adet başı fiyatı bul.",
      "- unitNote: emin olamadığın durumlar için kısa bir not (varsa), yoksa boş bırak",
      "",
      "SADECE geçerli bir JSON dizisi döndür, başka hiçbir açıklama veya metin ekleme.",
      'Format: [{"name":"...","qty":24,"unitCost":16.5,"unitNote":""}]',
      "Ürün satırı olmayan (toplam, KDV, tarih gibi) satırları dahil etme."
    ].join("\n");

    return fileToBase64(file)
      .then((base64) => callGeminiWithRetry(base64, prompt))
      .then((data) => {
        const rawText = data && data.candidates && data.candidates[0] && data.candidates[0].content.parts[0].text;
        if (!rawText) {
          console.error("Gemini yanıtı beklenmedik formatta:", data);
          return [];
        }
        try {
          const cleaned = rawText.replace(/```json|```/g, "").trim();
          return JSON.parse(cleaned);
        } catch (e) {
          console.error("JSON ayrıştırma hatası:", e, rawText);
          return [];
        }
      })
      .catch((e) => {
        console.error(e);
        return [];
      });
  }

  function findBoxMultiplier(name) {
    const str = (name || "").trim();
    const starIndex = str.indexOf("*");

    if (starIndex === -1) {
      // "(4 x 6)" gibi parantezli ama "*" yerine "x"/"×" kullanan nadir biçim
      const parenMatch = str.match(/\((\d+)\s*[x×]\s*(\d+)\)/i);
      if (parenMatch) {
        const total = Number(parenMatch[1]) * Number(parenMatch[2]);
        return total > 0 ? total : 1;
      }
      return 1;
    }

    const before = str.slice(0, starIndex);
    const after = str.slice(starIndex + 1);

    // "*" sonrasındaki ilk sayı (örn. "*12" -> 12)
    const afterMatch = after.match(/^\s*(\d+)/);
    const afterNum = afterMatch ? Number(afterMatch[1]) : null;

    // "*" öncesindeki son sayı — ama hemen önünde "/" varsa (örn. "1/2 *12"
    // içindeki "2" gibi bir ölçü/oran ifadesiyse) bunu kutu çarpanı sayma
    const beforeMatch = before.match(/(\d+)\s*$/);
    let beforeNum = null;
    if (beforeMatch) {
      const idx = before.lastIndexOf(beforeMatch[1]);
      const charBeforeNumber = before.slice(0, idx).trim().slice(-1);
      if (charBeforeNumber !== "/") {
        beforeNum = Number(beforeMatch[1]);
      }
    }

    if (afterNum && beforeNum) {
      const total = beforeNum * afterNum;
      return total > 0 ? total : 1;
    }
    if (afterNum) {
      return afterNum > 0 ? afterNum : 1;
    }
    return 1;
  }

  function handleInvoicePhotos(files) {
    if (!isBulkScanConfigured()) {
      showToast(t("invoiceScanNotConfigured"), "error");
      return;
    }
    const loadingEl = document.getElementById("invoiceScanLoading");
    const loadingText = loadingEl.querySelector("span");
    loadingEl.style.display = "flex";

    let allLines = [];
    let index = 0;

    function processNext() {
      if (index >= files.length) {
        loadingEl.style.display = "none";
        if (loadingText) loadingText.textContent = t("invoiceScanAnalyzing");

        // Aynı isimli satırları birleştir (miktarları topla, son okunan birim fiyatı al)
        const merged = {};
        allLines.forEach((line) => {
          if (!line.name) return;
          const key = line.name.trim().toLowerCase();
          if (!merged[key]) {
            merged[key] = { name: line.name, qty: 0, unitCost: line.unitCost || 0, unitNote: line.unitNote || "" };
          }
          merged[key].qty += Number(line.qty) || 0;
          if (line.unitCost) merged[key].unitCost = line.unitCost;
          if (line.unitNote) merged[key].unitNote = line.unitNote;
        });

        // Not: Gerçek adet hesabı artık yapay zekanın kendisi tarafından
        // (fatura görselini yorumlayarak) yapılıyor — burada ayrıca sabit bir
        // formülle çarpma işlemi YAPILMIYOR, AI'ın kendi hesapladığı adet
        // sayısına güveniliyor.
        invoiceScanCandidates = Object.values(merged).map((line) => {
          const existing = findExistingProductByName(line.name);
          return {
            name: line.name,
            qty: line.qty,
            unitCost: line.unitCost,
            unitNote: line.unitNote,
            matchedProductId: existing ? existing.id : null,
            matchedProductName: existing ? existing.name : null,
            markupPercent: 20
          };
        });

        if (!invoiceScanCandidates.length) {
          showToast(t("invoiceScanNoItems"), "info");
          return;
        }
        renderInvoiceScanModal();
        return;
      }

      if (loadingText && files.length > 1) {
        loadingText.textContent = `${t("invoiceScanAnalyzing")} (${index + 1}/${files.length})`;
      }

      analyzeOneInvoicePhoto(files[index]).then((lines) => {
        if (Array.isArray(lines)) allLines = allLines.concat(lines);
        index++;
        processNext();
      });
    }

    processNext();
  }

  function renderInvoiceScanModal() {
    const titleEl = document.getElementById("invoiceScanModalTitle");
    titleEl.textContent = t("invoiceScanFoundTitle").replace("{n}", invoiceScanCandidates.length);

    const listEl = document.getElementById("invoiceScanResultsList");
    listEl.innerHTML = invoiceScanCandidates
      .map((item, i) => {
        const statusHtml = item.matchedProductId
          ? `<span class="invoice-status-badge invoice-status-existing">${t("invoiceExistingLabel").replace("{qty}", item.qty)}</span>`
          : `<span class="invoice-status-badge invoice-status-new">${t("invoiceNewLabel")}</span>`;
        const costStr = item.unitCost ? formatTL(item.unitCost) : "";
        const priceStr = item.unitCost ? formatTL(calcSellingPrice(item.unitCost, item.markupPercent)) : "";
        const markupHtml = item.unitCost
          ? `
            <div class="invoice-markup-inline">
              <label data-i18n="invoiceMarkupLabel">Kâr oranı (%)</label>
              <input type="number" min="0" step="1" class="invoice-markup-input" data-index="${i}" value="${item.markupPercent}" />
            </div>`
          : "";
        const noteHtml = item.unitNote ? `<p class="invoice-uncertainty-note">⚠️ ${escapeHtml(item.unitNote)}</p>` : "";
        return `
          <label class="bulk-result-row">
            <input type="checkbox" class="invoice-result-check" data-index="${i}" checked />
            <div class="bulk-result-info">
              <p class="bulk-result-name">${escapeHtml(item.name)}</p>
              <p class="bulk-result-meta">${item.qty} adet${costStr ? " · Geliş: " + costStr : ""}${priceStr ? " · Satış: <span class=\"invoice-price-preview\" data-index=\"" + i + "\">" + priceStr + "</span>" : ""}</p>
              ${noteHtml}
              ${markupHtml}
              ${statusHtml}
            </div>
          </label>`;
      })
      .join("");

    listEl.querySelectorAll(".invoice-markup-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        e.stopPropagation();
        const index = Number(input.dataset.index);
        const item = invoiceScanCandidates[index];
        if (!item) return;
        const percent = Number(input.value);
        item.markupPercent = isNaN(percent) || percent < 0 ? 0 : percent;
        const priceEl = listEl.querySelector(`.invoice-price-preview[data-index="${index}"]`);
        if (priceEl) priceEl.textContent = formatTL(calcSellingPrice(item.unitCost, item.markupPercent));
      });
      input.addEventListener("click", (e) => e.stopPropagation());
    });

    document.getElementById("invoiceScanModal").style.display = "flex";
  }

  function closeInvoiceScanModal() {
    document.getElementById("invoiceScanModal").style.display = "none";
    invoiceScanCandidates = [];
  }

  function calcSellingPrice(costPrice, percent) {
    const p = percent != null ? percent : 20;
    return Math.round(costPrice * (1 + p / 100) * 100) / 100;
  }

  function applyInvoiceScan() {
    const checks = document.querySelectorAll(".invoice-result-check");
    let appliedCount = 0;
    checks.forEach((chk) => {
      if (!chk.checked) return;
      const item = invoiceScanCandidates[Number(chk.dataset.index)];
      if (!item) return;

      if (item.matchedProductId) {
        const p = products.find((x) => x.id === item.matchedProductId);
        if (p) {
          p.qty = Math.round((p.qty + item.qty) * 1000) / 1000;
          if (item.unitCost) {
            p.costPrice = item.unitCost;
            p.price = calcSellingPrice(item.unitCost, item.markupPercent);
          }
        }
      } else {
        const costPrice = item.unitCost || 0;
        const price = costPrice ? calcSellingPrice(costPrice, item.markupPercent) : 0;
        products.push(mkProduct(item.name, t("categoryOtherDefault"), item.qty, 5, price, "", "adet", costPrice));
      }
      appliedCount++;
    });
    save();
    renderAll();
    closeInvoiceScanModal();
    showToast(t("invoiceAppliedAlert").replace("{n}", appliedCount), "success");
  }

  // ---------- Tabs ----------
  function switchTab(tabId) {
    document.querySelectorAll(".tab-panel").forEach((el) => el.classList.remove("active"));
    document.getElementById(tabId).classList.add("active");
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });
    if (tabId !== "tab-scan" && scanning) stopScan();
    if (tabId !== "tab-kasa" && scanningKasa) stopScanKasa();
  }

  // ---------- Event wiring ----------
  document.getElementById("addBtn").addEventListener("click", addProduct);

  document.querySelectorAll(".voice-mic-btn").forEach((btn) => {
    btn.addEventListener("click", () => startVoiceInput(btn.dataset.target, btn));
  });
  document.querySelectorAll(".voice-lang-toggle").forEach((container) => {
    container.querySelectorAll(".voice-lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => setVoiceLang(container, btn.dataset.lang));
    });
  });
  document.getElementById("newQty").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addProduct();
  });
  document.getElementById("searchBox").addEventListener("input", renderAll);
  document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm(t("confirmResetAll"))) resetAll();
  });
  document.getElementById("breadWhatsAppBtn").addEventListener("click", sendBreadWhatsApp);
  document.getElementById("notifEnableBtn").addEventListener("click", enableNotifications);
  document.getElementById("breadConfigAddBtn").addEventListener("click", addBreadConfig);
  document.getElementById("breadWhatsAppNumber").addEventListener("change", (e) => {
    breadWhatsAppNumber = e.target.value.trim();
    save();
  });

  document.getElementById("closeModalBtn").addEventListener("click", closeModal);
  document.getElementById("detailModal").addEventListener("click", (e) => {
    if (e.target.id === "detailModal") closeModal();
  });
  document.getElementById("qtyPlusBtn").addEventListener("click", () => {
    const p = products.find((x) => x.id === activeProductId);
    adjustQty(activeProductId, p && p.unit === "kg" ? 0.1 : 1);
  });
  document.getElementById("qtyMinusBtn").addEventListener("click", () => {
    const p = products.find((x) => x.id === activeProductId);
    adjustQty(activeProductId, p && p.unit === "kg" ? -0.1 : -1);
  });
  document.getElementById("modalQtyInput").addEventListener("change", (e) => {
    const newQty = parseFloat(String(e.target.value).replace(",", "."));
    setQtyManually(activeProductId, newQty);
  });
  document.getElementById("saveEditBtn").addEventListener("click", saveEdit);
  document.getElementById("deleteProductBtn").addEventListener("click", () => {
    if (confirm(t("confirmDeleteProduct"))) deleteProduct(activeProductId);
  });
  document.getElementById("printQrBtn").addEventListener("click", printQr);

  document.getElementById("scanNewBarcodeBtn").addEventListener("click", () => openQuickBarcodeScan("newBarcode"));
  document.getElementById("scanEditBarcodeBtn").addEventListener("click", () => openQuickBarcodeScan("editBarcode"));
  document.getElementById("closeBarcodeModalBtn").addEventListener("click", closeQuickBarcodeScan);

  document.getElementById("shelfPhotoBtn").addEventListener("click", () => {
    document.getElementById("shelfPhotoInput").click();
  });
  document.getElementById("shelfPhotoInput").addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) handleShelfPhotos(files);
    e.target.value = "";
  });
  document.getElementById("closeBulkScanModalBtn").addEventListener("click", closeBulkScanModal);
  document.getElementById("bulkScanModal").addEventListener("click", (e) => {
    if (e.target.id === "bulkScanModal") closeBulkScanModal();
  });
  document.getElementById("bulkAddAllBtn").addEventListener("click", addAllBulkScanProducts);

  document.getElementById("invoicePhotoBtn").addEventListener("click", () => {
    document.getElementById("invoicePhotoInput").click();
  });
  document.getElementById("csvImportBtn").addEventListener("click", () => {
    document.getElementById("csvImportInput").click();
  });
  document.getElementById("csvImportInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleCsvImportFile(file);
    e.target.value = "";
  });
  document.getElementById("invoicePhotoInput").addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) handleInvoicePhotos(files);
    e.target.value = "";
  });
  document.getElementById("closeInvoiceScanModalBtn").addEventListener("click", closeInvoiceScanModal);
  document.getElementById("invoiceScanModal").addEventListener("click", (e) => {
    if (e.target.id === "invoiceScanModal") closeInvoiceScanModal();
  });
  document.getElementById("invoiceApplyBtn").addEventListener("click", applyInvoiceScan);
  document.getElementById("barcodeScanModal").addEventListener("click", (e) => {
    if (e.target.id === "barcodeScanModal") closeQuickBarcodeScan();
  });

  document.getElementById("startScanBtn").addEventListener("click", startScan);
  document.getElementById("stopScanBtn").addEventListener("click", stopScan);

  document.getElementById("manualAddSearch").addEventListener("input", renderManualAddResults);
  document.getElementById("startKasaScanBtn").addEventListener("click", startScanKasa);
  document.getElementById("stopKasaScanBtn").addEventListener("click", stopScanKasa);
  document.getElementById("clearCartBtn").addEventListener("click", () => {
    if (!cart.length || confirm(t("confirmClearCart"))) clearCart();
  });
  document.getElementById("completeSaleBtn").addEventListener("click", completeSale);
  document.getElementById("cartDiscount").addEventListener("input", renderCart);
  document.getElementById("payNakitBtn").addEventListener("click", () => setPaymentType("nakit"));
  document.getElementById("payVeresiyeBtn").addEventListener("click", () => setPaymentType("veresiye"));

  document.getElementById("veresiyeCustomerSearch").addEventListener("input", (e) => {
    selectedVeresiyeCustomerId = null;
    document.getElementById("veresiyeCustomerSelectedId").value = "";
    renderVeresiyeCustomerResults(e.target.value);
  });
  document.getElementById("veresiyeCustomerSearch").addEventListener("focus", (e) => {
    renderVeresiyeCustomerResults(e.target.value);
  });
  document.addEventListener("click", (e) => {
    const wrapper = document.getElementById("veresiyeCustomerRow");
    if (wrapper && !wrapper.contains(e.target)) {
      document.getElementById("veresiyeCustomerResults").classList.remove("show");
    }
  });

  document.querySelectorAll(".period-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentSalesPeriod = btn.dataset.period;
      document.querySelectorAll(".period-btn").forEach((b) => b.classList.toggle("active", b === btn));
      renderSales();
    });
  });

  document.getElementById("addCustomerBtn").addEventListener("click", addCustomer);
  document.getElementById("closeCustomerModalBtn").addEventListener("click", closeCustomerModal);
  document.getElementById("customerModal").addEventListener("click", (e) => {
    if (e.target.id === "customerModal") closeCustomerModal();
  });
  document.getElementById("recordPaymentBtn").addEventListener("click", recordPayment);
  document.getElementById("saveCustomerEditBtn").addEventListener("click", saveCustomerEdit);
  document.getElementById("deleteCustomerBtn").addEventListener("click", () => {
    if (confirm(t("confirmDeleteCustomer"))) deleteCustomer(activeCustomerId);
  });

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.getElementById("authSubmitBtn").addEventListener("click", submitAuth);
  document.getElementById("authPassword").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitAuth();
  });
  document.getElementById("forgotPasswordBtn").addEventListener("click", forgotPassword);
  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("adminCreateBtn").addEventListener("click", createAdminBusiness);
  document.getElementById("importBackupBtn").addEventListener("click", importLocalBackup);

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => window.i18n.setLang(btn.dataset.lang));
  });

  window.onLangChanged = function () {
    renderAll();
  };

  window.i18n.applyLang(window.i18n.getLang());

  // Ana ekran kısayollarından (manifest.json "shortcuts") gelen ?tab= parametresini işle
  const requestedTab = new URLSearchParams(window.location.search).get("tab");
  if (requestedTab && document.getElementById(requestedTab)) {
    switchTab(requestedTab);
  }

  checkForSharedPhoto();
  checkForLaunchedFile();
  checkForProtocolLaunch();
  checkForNoteTakingLaunch();
  registerPeriodicSync();

  load();
})();
