(function () {
  "use strict";

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
        } else {
          const initial = { products: seedData(), sales: [], customers: [], payments: [] };
          docRef.set(initial);
          products = initial.products;
          sales = initial.sales;
          customers = initial.customers;
          payments = initial.payments;
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
      .then(() => alert(t("authResetSent")))
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
      } catch (e) {
        products = seedData();
        sales = [];
        customers = [];
        payments = [];
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

    // Service worker tamamen kaldırıldı (eski önbellek sorunlarına neden oluyordu).
    // Varsa önceden kayıtlı service worker'ları ve önbellekleri temizle.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
    }
    if ("caches" in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }
  }

  function save() {
    if (cloudEnabled) {
      if (!docRef) return;
      suppressNextSnapshot = true;
      docRef.set({ products, sales, customers, payments }).catch((e) => {
        console.error("Bulut kaydetme hatası", e);
        setSyncStatus("error");
      });
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ products, sales, customers, payments }));
      } catch (e) {
        console.error("Yerel kaydetme hatası", e);
      }
    }
  }

  function seedData() {
    return [
      mkProduct("pepsi 1 lt", "içecekler", 12, 10, 22, "", "adet"),
      mkProduct("pepsi 2.5 lt", "içecekler", 3, 5, 45, "", "adet"),
      mkProduct("cocacola 1 lt", "içecekler", 0, 8, 24, "", "adet"),
      mkProduct("ekmek", "fırın", 15, 10, 8, "", "adet"),
      mkProduct("beyaz peynir", "süt ürünleri", 5, 2, 180, "", "kg")
    ];
  }

  function mkProduct(name, category, qty, min, price, barcode, unit) {
    return {
      id: genId(),
      name,
      category,
      qty: Number(qty) || 0,
      min: Number(min) || 0,
      price: Number(price) || 0,
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
      alert(t("importParseError"));
      return;
    }
    const localProducts = (parsed && parsed.products) || [];
    if (!localProducts.length) {
      alert(t("importNoLocalBackup"));
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
    alert(t("importSuccess").replace("{n}", addedCount));
  }

  function addProduct() {
    const nameInput = document.getElementById("newName");
    const catInput = document.getElementById("newCategory");
    const minInput = document.getElementById("newMin");
    const qtyInput = document.getElementById("newQty");
    const priceInput = document.getElementById("newPrice");
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
    const barcode = barcodeInput.value.trim();
    const unit = unitInput.value;

    products.push(mkProduct(name, category, qty, min, price, barcode, unit));
    nameInput.value = "";
    catInput.value = "";
    minInput.value = "5";
    qtyInput.value = "0";
    priceInput.value = "0";
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

  function saveEdit() {
    const p = products.find((x) => x.id === activeProductId);
    if (!p) return;
    const name = document.getElementById("editName").value.trim();
    if (!name) return;
    p.name = name;
    p.category = document.getElementById("editCategory").value.trim() || t("categoryOtherDefault");
    p.min = Number(document.getElementById("editMin").value) || 0;
    p.price = Number(document.getElementById("editPrice").value) || 0;
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
    document.getElementById("editBarcode").value = p.barcode || "";
    document.getElementById("editUnit").value = p.unit || "adet";
    updateModalContent(p);
    document.getElementById("detailModal").style.display = "flex";
    renderQrCode(p.id);
  }

  function updateModalContent(p) {
    document.getElementById("modalProductName").textContent = p.name;
    document.getElementById("modalQty").textContent = formatQty(p);
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
        alert(t("cameraError") + "\n" + err);
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
      alert(t("alertNotRegistered"));
      return;
    }
    stopScan();
    if (p.unit === "kg") {
      const action = confirm(`${p.name}\n${t("currentStockLabel")}: ${formatQty(p)}\n\n${t("confirmStockDirection")}`);
      const input = prompt(t("promptKgAmount"), "");
      if (input === null) return;
      const weight = parseFloat(input.replace(",", "."));
      if (!weight || weight <= 0) {
        alert(t("alertInvalidWeight"));
        return;
      }
      adjustQty(p.id, action ? weight : -weight);
    } else {
      const action = confirm(`${p.name}\n${t("currentStockLabel")}: ${p.qty}\n\n${t("confirmStockDirection")}`);
      if (action) {
        adjustQty(p.id, 1);
      } else {
        adjustQty(p.id, -1);
      }
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
        alert(t("cameraError") + "\n" + err);
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

  function onScanSuccessKasa(decodedText) {
    if (kasaScanCooldown) return;
    const p = findProductByScan(decodedText);
    if (!p) {
      alert(t("alertNotRegistered"));
      return;
    }

    if (p.unit === "kg") {
      const input = prompt(`${p.name} — ${t("promptKgAmount")}`, "");
      if (input === null) return;
      const weight = parseFloat(input.replace(",", "."));
      if (!weight || weight <= 0) {
        alert(t("alertInvalidWeight"));
        return;
      }
      addToCart(p, weight);
      kasaScanCooldown = true;
      showKasaScanFeedback(`${p.name} (${weight} ${t("unitKgShort")})`);
      setTimeout(() => {
        kasaScanCooldown = false;
      }, 3000);
    } else {
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
    let amount;
    if (p.unit === "kg") {
      const input = prompt(`${p.name} — ${t("promptKgAmount")}`, "");
      if (input === null) return;
      amount = parseFloat(input.replace(",", "."));
    } else {
      const input = prompt(`${p.name} — ${t("promptAdetAmount")}`, "1");
      if (input === null) return;
      amount = parseFloat(input.replace(",", "."));
    }
    if (!amount || amount <= 0) {
      alert(t("alertInvalidAmount"));
      return;
    }
    addToCart(p, amount);
    document.getElementById("manualAddSearch").value = "";
    renderManualAddResults();
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
    const input = prompt(`${item.name} — ${t("promptNewWeight")}`, item.qty);
    if (input === null) return;
    const weight = parseFloat(input.replace(",", "."));
    if (!weight || weight <= 0) {
      removeCartItem(productId);
      return;
    }
    item.qty = Math.round(weight * 1000) / 1000;
    renderCart();
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
      alert(t("alertEmptyCart"));
      return;
    }

    let customerId = null;
    let customerName = null;
    if (selectedPaymentType === "veresiye") {
      if (!customers.length) {
        alert(t("alertNeedCustomer"));
        return;
      }
      customerId = document.getElementById("veresiyeCustomerSelectedId").value;
      const c = customers.find((x) => x.id === customerId);
      if (!c) {
        alert(t("alertSelectCustomer"));
        return;
      }
      customerName = c.name;
    }

    const subtotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
    const discountInput = document.getElementById("cartDiscount");
    const discount = Math.min(Number(discountInput.value) || 0, subtotal);
    const total = Math.max(0, subtotal - discount);

    cart.forEach((item) => {
      const p = products.find((x) => x.id === item.productId);
      if (p) p.qty = Math.max(0, p.qty - item.qty);
    });

    sales.push({
      id: genId(),
      timestamp: new Date().toISOString(),
      items: cart.map((c) => ({ name: c.name, qty: c.qty, price: c.price, unit: c.unit || "adet" })),
      subtotal,
      discount,
      total,
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
    alert(`${t("alertSaleComplete")} ${formatTL(total)}${customerName ? " (" + t("veresiyeLabel") + ": " + customerName + ")" : ""}`);
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
    return `
      <div class="sale-row">
        <div class="sale-row-top">
          <span class="sale-time">${timeStr}</span>
          <span class="sale-amount">${formatTL(sale.total)}</span>
        </div>
        <p class="sale-items">${itemsSummary}</p>
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
    document.getElementById("statPeriodTotal").textContent = formatTL(periodTotal);
    document.getElementById("statPeriodCount").textContent = periodSales.length;
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
        alert(t("cameraError") + "\n" + err);
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
    return typeof bulkScanConfig !== "undefined" && bulkScanConfig.apiKey && bulkScanConfig.apiKey.indexOf("BURAYA") !== 0;
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

  function handleShelfPhoto(file) {
    if (!isBulkScanConfigured()) {
      alert(t("bulkScanNotConfigured"));
      return;
    }
    const loadingEl = document.getElementById("bulkScanLoading");
    loadingEl.style.display = "flex";

    const prompt = [
      "Bu bir market/bakkal rafının fotoğrafı.",
      "Fotoğrafta görünen HER FARKLI ürünü tek tek tespit et.",
      "Her ürün için şu alanları çıkar:",
      '- name: ürün adı ve varsa hacmi/boyutu (örn. "Pepsi 1 Lt")',
      "- brand: marka adı",
      "- category: genel kategori (örn. içecekler, atıştırmalık, temizlik)",
      "- price: fiyat etiketinde açıkça görünüyorsa sayı olarak, görünmüyorsa null",
      "",
      "SADECE geçerli bir JSON dizisi döndür, başka hiçbir açıklama veya metin ekleme.",
      'Format: [{"name":"...","brand":"...","category":"...","price":12.5}]',
      "Aynı üründen birden fazla varsa yalnızca bir kez listele."
    ].join("\n");

    fileToBase64(file)
      .then((base64) =>
        fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": bulkScanConfig.apiKey
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64 } }]
              }
            ]
          })
        })
      )
      .then((r) => r.json())
      .then((data) => {
        loadingEl.style.display = "none";
        const rawText = data && data.candidates && data.candidates[0] && data.candidates[0].content.parts[0].text;
        if (!rawText) {
          console.error("Gemini yanıtı beklenmedik formatta:", data);
          alert(t("bulkScanError"));
          return;
        }
        let detected = [];
        try {
          const cleaned = rawText.replace(/```json|```/g, "").trim();
          detected = JSON.parse(cleaned);
        } catch (e) {
          console.error("JSON ayrıştırma hatası:", e, rawText);
          alert(t("bulkScanError"));
          return;
        }

        bulkScanCandidates = detected.filter((p) => p.name && !productAlreadyExists(p.name));

        if (!bulkScanCandidates.length) {
          alert(t("bulkScanNoNew"));
          return;
        }
        renderBulkScanModal();
      })
      .catch((e) => {
        console.error(e);
        loadingEl.style.display = "none";
        alert(t("bulkScanError"));
      });
  }

  function renderBulkScanModal() {
    const titleEl = document.getElementById("bulkScanModalTitle");
    titleEl.textContent = t("bulkScanFoundTitle").replace("{n}", bulkScanCandidates.length);

    const listEl = document.getElementById("bulkScanResultsList");
    listEl.innerHTML = bulkScanCandidates
      .map((p, i) => {
        const metaParts = [p.brand, p.category].filter(Boolean).join(" · ");
        const priceStr = p.price ? formatTL(p.price) : "";
        return `
          <label class="bulk-result-row">
            <input type="checkbox" class="bulk-result-check" data-index="${i}" checked />
            <div class="bulk-result-info">
              <p class="bulk-result-name">${escapeHtml(p.name)}</p>
              <p class="bulk-result-meta">${escapeHtml(metaParts)}${priceStr ? " · " + priceStr : ""}</p>
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
          0,
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
    alert(t("bulkAddedAlert").replace("{n}", addedCount));
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
  document.getElementById("newQty").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addProduct();
  });
  document.getElementById("searchBox").addEventListener("input", renderAll);
  document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm(t("confirmResetAll"))) resetAll();
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
    const file = e.target.files[0];
    if (file) handleShelfPhoto(file);
    e.target.value = "";
  });
  document.getElementById("closeBulkScanModalBtn").addEventListener("click", closeBulkScanModal);
  document.getElementById("bulkScanModal").addEventListener("click", (e) => {
    if (e.target.id === "bulkScanModal") closeBulkScanModal();
  });
  document.getElementById("bulkAddAllBtn").addEventListener("click", addAllBulkScanProducts);
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
  document.getElementById("importBackupBtn").addEventListener("click", importLocalBackup);

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => window.i18n.setLang(btn.dataset.lang));
  });

  window.onLangChanged = function () {
    renderAll();
  };

  window.i18n.applyLang(window.i18n.getLang());

  load();
})();
