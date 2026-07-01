(function () {
  "use strict";

  const STORAGE_KEY = "bakkal_urunler_v1";
  let products = [];
  let activeProductId = null;
  let html5QrCode = null;
  let scanning = false;

  // ---------- Persistence ----------
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      products = raw ? JSON.parse(raw) : seedData();
    } catch (e) {
      products = seedData();
    }
    if (!Array.isArray(products) || !products.length) products = seedData();
    renderAll();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    } catch (e) {
      console.error("Kaydetme hatası", e);
    }
  }

  function seedData() {
    return [
      mkProduct("pepsi 1 lt", "içecekler", 12, 10),
      mkProduct("pepsi 2.5 lt", "içecekler", 3, 5),
      mkProduct("cocacola 1 lt", "içecekler", 0, 8),
      mkProduct("ekmek", "fırın", 15, 10)
    ];
  }

  function mkProduct(name, category, qty, min) {
    return {
      id: genId(),
      name,
      category,
      qty: Number(qty) || 0,
      min: Number(min) || 0
    };
  }

  function genId() {
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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

  // ---------- CRUD ----------
  function addProduct() {
    const nameInput = document.getElementById("newName");
    const catInput = document.getElementById("newCategory");
    const minInput = document.getElementById("newMin");
    const qtyInput = document.getElementById("newQty");

    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }
    const category = catInput.value.trim() || "diğer";
    const min = Number(minInput.value) || 0;
    const qty = Number(qtyInput.value) || 0;

    products.push(mkProduct(name, category, qty, min));
    nameInput.value = "";
    catInput.value = "";
    minInput.value = "5";
    qtyInput.value = "0";
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

  // ---------- Rendering ----------
  function productRowHtml(p) {
    const status = getStatus(p);
    return `
      <div class="product-row" data-id="${p.id}">
        <div class="product-info">
          <p class="product-name">${escapeHtml(p.name)}</p>
          <p class="product-meta">${escapeHtml(p.category)} · Stok: ${p.qty}</p>
        </div>
        <span class="status-badge ${STATUS_CLASS[status]}">${STATUS_LABEL[status]}</span>
      </div>`;
  }

  function renderAll() {
    const search = (document.getElementById("searchBox").value || "").toLowerCase().trim();
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
  }

  // ---------- Modal ----------
  function openModal(id) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    activeProductId = id;
    document.getElementById("editName").value = p.name;
    document.getElementById("editCategory").value = p.category;
    document.getElementById("editMin").value = p.min;
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

  // ---------- QR Scanning ----------
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
    const p = products.find((x) => x.id === decodedText);
    if (!p) {
      alert("Bu QR kod kayıtlı bir ürüne ait değil.");
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

  // ---------- Tabs ----------
  function switchTab(tabId) {
    document.querySelectorAll(".tab-panel").forEach((el) => el.classList.remove("active"));
    document.getElementById(tabId).classList.add("active");
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });
    if (tabId !== "tab-scan" && scanning) stopScan();
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

  document.getElementById("startScanBtn").addEventListener("click", startScan);
  document.getElementById("stopScanBtn").addEventListener("click", stopScan);

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // ---------- Service worker ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }

  load();
})();
