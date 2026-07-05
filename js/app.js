(function () {
  "use strict";

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
  let docRef = null;
  let cloudEnabled = false;
  let suppressNextSnapshot = false;

  // ---------- Firebase setup ----------
  function initCloud() {
    try {
      if (typeof firebaseConfig === "undefined") return;
      if (!firebaseConfig.apiKey || firebaseConfig.apiKey.indexOf("BURAYA") === 0) {
        setSyncStatus("local");
        return;
      }
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      docRef = db.collection("bakkal").doc("veri");
      cloudEnabled = true;
      setSyncStatus("connecting");

      docRef.onSnapshot(
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
            const initial = {
              products: products.length ? products : seedData(),
              sales: sales || [],
              customers: customers || [],
              payments: payments || []
            };
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
    } catch (e) {
      console.error("Firebase başlatma hatası", e);
      setSyncStatus("local");
    }
  }

  function setSyncStatus(state) {
    const icon = document.getElementById("syncIcon");
    const text = document.getElementById("syncText");
    if (!icon || !text) return;
    if (state === "connected") {
      icon.className = "ti ti-cloud-check";
      text.textContent = "Senkron";
    } else if (state === "connecting") {
      icon.className = "ti ti-cloud-up";
      text.textContent = "Bağlanıyor";
    } else if (state === "error") {
      icon.className = "ti ti-cloud-x";
      text.textContent = "Hata";
    } else {
      icon.className = "ti ti-cloud-off";
      text.textContent = "Yerel";
    }
  }

  // ---------- Persistence ----------
  function load() {
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
    initCloud();

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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ products, sales, customers, payments }));
    } catch (e) {
      console.error("Yerel kaydetme hatası", e);
    }
    if (cloudEnabled && docRef) {
      suppressNextSnapshot = true;
      docRef.set({ products, sales, customers, payments }).catch((e) => {
        console.error("Bulut kaydetme hatası", e);
        setSyncStatus("error");
      });
    }
  }

  function seedData() {
    return [
      mkProduct("pepsi 1 lt", "içecekler", 12, 10, 22),
      mkProduct("pepsi 2.5 lt", "içecekler", 3, 5, 45),
      mkProduct("cocacola 1 lt", "içecekler", 0, 8, 24),
      mkProduct("ekmek", "fırın", 15, 10, 8)
    ];
  }

  function mkProduct(name, category, qty, min, price, barcode) {
    return {
      id: genId(),
      name,
      category,
      qty: Number(qty) || 0,
      min: Number(min) || 0,
      price: Number(price) || 0,
      barcode: (barcode || "").trim()
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
    if (debt > 0 && !confirm(`Bu müşterinin ${formatTL(debt)} bakiyesi var. Yine de silmek istediğine emin misin?`)) {
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

  function populateVeresiyeCustomerSelect() {
    const select = document.getElementById("veresiyeCustomerSelect");
    if (!select) return;
    const prevValue = select.value;
    select.innerHTML = customers.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    if (prevValue) select.value = prevValue;
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
      .map((p) => ({ type: "payment", timestamp: p.timestamp, amount: p.amount, label: "Ödeme alındı" }));
    const combined = [...debtEntries, ...paymentEntries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (!combined.length) {
      list.innerHTML = `<p class="empty-state" style="display:block;">Henüz işlem yok.</p>`;
      return;
    }

    list.innerHTML = combined
      .map((e) => {
        const d = new Date(e.timestamp);
        const timeStr = d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
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

  const STATUS_LABEL = { tukendi: "Tükendi", kritik: "Kritik", yeterli: "Yeterli" };
  const STATUS_CLASS = { tukendi: "status-tukendi", kritik: "status-kritik", yeterli: "status-yeterli" };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function formatTL(n) {
    return (Number(n) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
  }

  // ---------- CRUD ----------
  function addProduct() {
    const nameInput = document.getElementById("newName");
    const catInput = document.getElementById("newCategory");
    const minInput = document.getElementById("newMin");
    const qtyInput = document.getElementById("newQty");
    const priceInput = document.getElementById("newPrice");
    const barcodeInput = document.getElementById("newBarcode");

    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }
    const category = catInput.value.trim() || "diğer";
    const min = Number(minInput.value) || 0;
    const qty = Number(qtyInput.value) || 0;
    const price = Number(priceInput.value) || 0;
    const barcode = barcodeInput.value.trim();

    products.push(mkProduct(name, category, qty, min, price, barcode));
    nameInput.value = "";
    catInput.value = "";
    minInput.value = "5";
    qtyInput.value = "0";
    priceInput.value = "0";
    barcodeInput.value = "";
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
    p.qty = Math.max(0, p.qty + delta);
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
    p.category = document.getElementById("editCategory").value.trim() || "diğer";
    p.min = Number(document.getElementById("editMin").value) || 0;
    p.price = Number(document.getElementById("editPrice").value) || 0;
    p.barcode = document.getElementById("editBarcode").value.trim();
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
    return `
      <div class="product-row" data-id="${p.id}">
        <div class="product-info">
          <p class="product-name">${escapeHtml(p.name)}</p>
          <p class="product-meta">${escapeHtml(p.category)} · Stok: ${p.qty} · ${formatTL(p.price)}</p>
        </div>
        <span class="status-badge ${STATUS_CLASS[status]}">${STATUS_LABEL[status]}</span>
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
    updateModalContent(p);
    document.getElementById("detailModal").style.display = "flex";
    renderQrCode(p.id);
  }

  function updateModalContent(p) {
    document.getElementById("modalProductName").textContent = p.name;
    document.getElementById("modalQty").textContent = p.qty;
    const status = getStatus(p);
    const pill = document.getElementById("modalStatus");
    pill.textContent = STATUS_LABEL[status];
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
      box.textContent = "QR kütüphanesi yüklenemedi (internet bağlantısını kontrol et).";
    }
  }

  function printQr() {
    const box = document.getElementById("modalQrCode");
    const p = products.find((x) => x.id === activeProductId);
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>QR Yazdır</title></head>
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
        alert("Kamera başlatılamadı. Tarayıcı izinlerini kontrol et.\n" + err);
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
      alert("Bu kod kayıtlı bir ürüne ait değil.");
      return;
    }
    stopScan();
    const action = confirm(`${p.name}\nMevcut stok: ${p.qty}\n\nStok GİRİŞİ için Tamam, ÇIKIŞI için İptal'e bas.`);
    if (action) {
      adjustQty(p.id, 1);
    } else {
      adjustQty(p.id, -1);
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
        alert("Kamera başlatılamadı. Tarayıcı izinlerini kontrol et.\n" + err);
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
      alert("Bu kod kayıtlı bir ürüne ait değil.");
      return;
    }
    addToCart(p);
    kasaScanCooldown = true;
    showKasaScanFeedback(p.name);
    setTimeout(() => {
      kasaScanCooldown = false;
    }, 3000);
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
    badge.innerHTML = `<i class="ti ti-check" aria-hidden="true"></i> ${escapeHtml(name)} eklendi`;
    badge.classList.add("show");
    clearTimeout(badge._hideTimer);
    badge._hideTimer = setTimeout(() => {
      badge.classList.remove("show");
    }, 3000);
  }

  // ---------- Kasa: Sepet ----------
  function addToCart(p) {
    const existing = cart.find((c) => c.productId === p.id);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ productId: p.id, name: p.name, price: p.price, qty: 1 });
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
    return `
      <div class="cart-row" data-id="${item.productId}">
        <div class="cart-info">
          <p class="cart-name">${escapeHtml(item.name)}</p>
          <p class="cart-meta">${formatTL(item.price)} / adet</p>
        </div>
        <div class="cart-controls">
          <button class="cart-qty-btn cart-minus" data-id="${item.productId}" aria-label="Azalt"><i class="ti ti-minus" aria-hidden="true"></i></button>
          <span class="cart-qty-value">${item.qty}</span>
          <button class="cart-qty-btn cart-plus" data-id="${item.productId}" aria-label="Arttır"><i class="ti ti-plus" aria-hidden="true"></i></button>
          <span class="cart-line-total">${formatTL(lineTotal)}</span>
          <button class="cart-remove-btn" data-id="${item.productId}" aria-label="Kaldır"><i class="ti ti-x" aria-hidden="true"></i></button>
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
      alert("Sepet boş.");
      return;
    }

    let customerId = null;
    let customerName = null;
    if (selectedPaymentType === "veresiye") {
      const select = document.getElementById("veresiyeCustomerSelect");
      if (!customers.length) {
        alert("Önce Veresiye sekmesinden bir müşteri eklemen gerekiyor.");
        return;
      }
      customerId = select.value;
      const c = customers.find((x) => x.id === customerId);
      if (!c) {
        alert("Lütfen bir müşteri seç.");
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
      items: cart.map((c) => ({ name: c.name, qty: c.qty, price: c.price })),
      subtotal,
      discount,
      total,
      paymentType: selectedPaymentType,
      customerId,
      customerName
    });

    cart = [];
    discountInput.value = "0";
    setPaymentType("nakit");
    save();
    renderAll();
    alert(`Satış tamamlandı: ${formatTL(total)}${customerName ? " (Veresiye: " + customerName + ")" : ""}`);
  }

  function cancelSale(saleId) {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return;
    if (!confirm(`Bu satış iptal edilsin mi?\n${formatTL(sale.total)} tutarındaki satış silinecek ve ürünler stoğa geri eklenecek.`)) {
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
    const timeStr = d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    const itemsSummary = sale.items.map((i) => `${escapeHtml(i.name)} x${i.qty}`).join(", ");
    const paymentBadge = sale.paymentType === "veresiye" ? `<span class="sale-payment-badge">Veresiye${sale.customerName ? ": " + escapeHtml(sale.customerName) : ""}</span>` : "";
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
            <i class="ti ti-arrow-back-up" aria-hidden="true"></i> İptal et
          </button>
        </div>
      </div>`;
  }

  function topProductRowHtml(item, rank) {
    return `
      <div class="product-row">
        <div class="product-info">
          <p class="product-name">${rank}. ${escapeHtml(item.name)}</p>
          <p class="product-meta">${item.qty} adet satıldı</p>
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
        },
        () => {}
      )
      .catch((err) => {
        alert("Kamera başlatılamadı. Tarayıcı izinlerini kontrol et.\n" + err);
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
    if (confirm("Tüm ürünlerin stoğu minimum seviyeye sıfırlansın mı?")) resetAll();
  });

  document.getElementById("closeModalBtn").addEventListener("click", closeModal);
  document.getElementById("detailModal").addEventListener("click", (e) => {
    if (e.target.id === "detailModal") closeModal();
  });
  document.getElementById("qtyPlusBtn").addEventListener("click", () => adjustQty(activeProductId, 1));
  document.getElementById("qtyMinusBtn").addEventListener("click", () => adjustQty(activeProductId, -1));
  document.getElementById("saveEditBtn").addEventListener("click", saveEdit);
  document.getElementById("deleteProductBtn").addEventListener("click", () => {
    if (confirm("Bu ürünü silmek istediğine emin misin?")) deleteProduct(activeProductId);
  });
  document.getElementById("printQrBtn").addEventListener("click", printQr);

  document.getElementById("scanNewBarcodeBtn").addEventListener("click", () => openQuickBarcodeScan("newBarcode"));
  document.getElementById("scanEditBarcodeBtn").addEventListener("click", () => openQuickBarcodeScan("editBarcode"));
  document.getElementById("closeBarcodeModalBtn").addEventListener("click", closeQuickBarcodeScan);
  document.getElementById("barcodeScanModal").addEventListener("click", (e) => {
    if (e.target.id === "barcodeScanModal") closeQuickBarcodeScan();
  });

  document.getElementById("startScanBtn").addEventListener("click", startScan);
  document.getElementById("stopScanBtn").addEventListener("click", stopScan);

  document.getElementById("startKasaScanBtn").addEventListener("click", startScanKasa);
  document.getElementById("stopKasaScanBtn").addEventListener("click", stopScanKasa);
  document.getElementById("clearCartBtn").addEventListener("click", () => {
    if (!cart.length || confirm("Sepeti boşaltmak istediğine emin misin?")) clearCart();
  });
  document.getElementById("completeSaleBtn").addEventListener("click", completeSale);
  document.getElementById("cartDiscount").addEventListener("input", renderCart);
  document.getElementById("payNakitBtn").addEventListener("click", () => setPaymentType("nakit"));
  document.getElementById("payVeresiyeBtn").addEventListener("click", () => setPaymentType("veresiye"));

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
    if (confirm("Bu müşteriyi silmek istediğine emin misin?")) deleteCustomer(activeCustomerId);
  });

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  load();
})();
