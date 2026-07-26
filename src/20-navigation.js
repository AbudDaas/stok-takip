/**
 * 20-navigation.js
 * Ana render döngüsü ve sekme (tab) geçiş mantığı.
 */

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
    const supplierFilterEl = document.getElementById("orderListSupplierFilter");
    if (supplierFilterEl) {
      const currentFilterValue = supplierFilterEl.value;
      supplierFilterEl.innerHTML =
        `<option value="">${t("orderFilterAll")}</option>` +
        suppliers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
      supplierFilterEl.value = currentFilterValue;
    }
    const selectedSupplierFilter = supplierFilterEl ? supplierFilterEl.value : "";

    const needsOrder = products
      .filter((p) => getStatus(p) !== "yeterli")
      .filter((p) => !selectedSupplierFilter || p.supplierId === selectedSupplierFilter)
      .sort((a, b) => (getStatus(a) === "tukendi" ? 0 : 1) - (getStatus(b) === "tukendi" ? 0 : 1));

    if (!needsOrder.length) {
      orderList.innerHTML = "";
      orderEmpty.style.display = "block";
    } else {
      orderEmpty.style.display = "none";
      orderList.innerHTML = needsOrder.map(orderListRowHtml).join("");
      orderList.querySelectorAll(".product-row").forEach((row) => {
        row.addEventListener("click", () => openModal(row.dataset.id));
      });
      orderList.querySelectorAll(".alt-source-toggle-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleNeedsAlternativeSource(btn.dataset.id);
        });
      });
    }

    document.getElementById("statTotal").textContent = products.length;
    document.getElementById("statOrder").textContent = needsOrder.length;

    renderCart();
    renderSales();
    renderCustomers();
    renderReminders();
    renderSuppliers();
    renderBreadStatus();
    renderPriceChanges();
    renderAuditLog();
    renderStaffList();
    renderOwnerPinStatus();
    renderDataSize();
    renderFiscalSettings();
    renderAiPanel();
    translateMissingProductNames();
  }

function switchTab(tabId) {
    document.querySelectorAll(".tab-panel").forEach((el) => el.classList.remove("active"));
    document.getElementById(tabId).classList.add("active");
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });
    if (tabId !== "tab-scan" && scanning) stopScan();
    if (tabId !== "tab-kasa" && scanningKasa) stopScanKasa();
    if (tabId === "tab-branches" && !viewingBranchUid) {
      loadBranches();
      renderCatalogList();
    }
    if (tabId === "tab-settings") {
      loadAutoBackups();
    }
  }
