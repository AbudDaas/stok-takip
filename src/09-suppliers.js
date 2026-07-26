/**
 * 09-suppliers.js
 * Tedarikçi borç/ödeme takibi, önerilen marka ekleme, tedarikçiye özel sipariş listesi ve ürün atama.
 */

function getSupplierBalance(supplierId) {
    return supplierTransactions
      .filter((t) => t.supplierId === supplierId)
      .reduce((sum, t) => sum + (t.type === "debt" ? t.amount : -t.amount), 0);
  }

function renderSuppliers() {
    const listEl = document.getElementById("supplierList");
    const emptyEl = document.getElementById("supplierEmptyState");
    if (!listEl) return;

    if (!suppliers.length) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      return;
    }
    emptyEl.style.display = "none";

    listEl.innerHTML = suppliers
      .map((s) => {
        const balance = getSupplierBalance(s.id);
        const balanceClass = balance > 0 ? "has-debt" : "no-debt";
        return `
          <div class="customer-row" data-id="${s.id}">
            <div class="customer-info">
              <p class="customer-name">${escapeHtml(s.name)}</p>
              <p class="customer-phone">${escapeHtml(s.phone || "—")}</p>
            </div>
            <span class="customer-debt ${balanceClass}">${formatTL(balance)}</span>
          </div>`;
      })
      .join("");

    listEl.querySelectorAll(".customer-row").forEach((row) => {
      row.addEventListener("click", () => openSupplierModal(row.dataset.id));
    });
  }

function addSuggestedSuppliers() {
    const existingNames = suppliers.map((s) => s.name.trim().toLowerCase());
    const toAdd = SUGGESTED_SUPPLIERS.filter((name) => !existingNames.includes(name.toLowerCase()));
    if (!toAdd.length) {
      showToast(t("suggestedSuppliersAllAdded"), "info");
      return;
    }
    toAdd.forEach((name) => {
      suppliers.push({ id: genId(), name, phone: "" });
    });
    save();
    renderSuppliers();
    showToast(t("suggestedSuppliersAdded").replace("{n}", toAdd.length), "success");
  }

function addSupplier() {
    const name = document.getElementById("supplierName").value.trim();
    const phone = document.getElementById("supplierPhone").value.trim();
    if (!name) {
      showToast(t("supplierNameRequired"), "error");
      return;
    }
    suppliers.push({ id: genId(), name, phone });
    save();
    renderSuppliers();
    document.getElementById("supplierName").value = "";
    document.getElementById("supplierPhone").value = "";
    showToast(t("supplierAdded"), "success");
  }

function openSupplierModal(supplierId) {
    const s = suppliers.find((x) => x.id === supplierId);
    if (!s) return;
    activeSupplierId = supplierId;
    document.getElementById("supplierModalName").textContent = s.name;
    document.getElementById("supplierModalDebt").textContent = formatTL(getSupplierBalance(supplierId));
    renderSupplierHistory(supplierId);
    renderSupplierOrderList(supplierId);
    document.getElementById("supplierProductSearch").value = "";
    renderSupplierProductPicker();
    document.getElementById("supplierModal").style.display = "flex";
  }

function closeSupplierModal() {
    document.getElementById("supplierModal").style.display = "none";
    activeSupplierId = null;
  }

function renderSupplierOrderList(supplierId) {
    const listEl = document.getElementById("supplierOrderList");
    const emptyEl = document.getElementById("supplierOrderListEmptyState");
    const sendBtn = document.getElementById("supplierOrderSendBtn");
    if (!listEl) return;

    const suggestions = calcOrderSuggestions((p) => p.supplierId === supplierId);
    supplierOrderSuggestionsCache = suggestions;

    if (!suggestions.length) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      sendBtn.style.display = "none";
      return;
    }
    emptyEl.style.display = "none";
    sendBtn.style.display = "block";

    listEl.innerHTML = suggestions
      .map((s) => {
        const daysLabel = s.daysLeft <= 0 ? t("orderEngineToday") : `${Math.ceil(s.daysLeft)} ${t("orderEngineDaysLeft")}`;
        return `
          <div class="order-engine-row">
            <div class="order-engine-info">
              <p class="order-engine-name">${escapeHtml(s.name)}</p>
              <p class="order-engine-meta">${t("orderEngineRunsOut")}: ${daysLabel}</p>
            </div>
            <div class="order-engine-suggestion">
              <span class="order-engine-qty">${s.suggestedOrder}</span>
              <span class="order-engine-unit">${s.unit === "kg" ? t("unitKgShort") : t("unitAdetShort")}</span>
            </div>
          </div>`;
      })
      .join("");
  }

function sendSupplierOrderWhatsApp() {
    const s = suppliers.find((x) => x.id === activeSupplierId);
    if (!s || !supplierOrderSuggestionsCache.length) return;

    const lines = supplierOrderSuggestionsCache.map(
      (item) => `- ${item.name}: ${item.suggestedOrder} ${item.unit === "kg" ? t("unitKgShort") : t("unitAdetShort")}`
    );
    const message = `${t("orderEngineMessageTitle")} (${s.name})\n\n${lines.join("\n")}`;

    if (s.phone) {
      const cleanPhone = s.phone.replace(/[^\d]/g, "");
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
    } else {
      navigator.clipboard
        .writeText(message)
        .then(() => showToast(t("orderEngineCopied"), "success"))
        .catch(() => showToast(message, "info"));
    }
    logAudit("Tedarikçiye sipariş listesi gönderildi", s.name);
  }

function renderSupplierProductPicker() {
    const pickerEl = document.getElementById("supplierProductPicker");
    if (!pickerEl || !activeSupplierId) return;
    const search = document.getElementById("supplierProductSearch").value.toLowerCase().trim();

    const filtered = products.filter((p) => !search || p.name.toLowerCase().includes(search));

    pickerEl.innerHTML = filtered
      .map((p) => {
        const isAssignedHere = p.supplierId === activeSupplierId;
        const assignedElsewhereNote =
          p.supplierId && !isAssignedHere
            ? `<p class="supplier-picker-note">${t("supplierProductAssignedElsewhere")}: ${escapeHtml(getSupplierNameById(p.supplierId))}</p>`
            : "";
        return `
          <label class="supplier-picker-row">
            <input type="checkbox" class="supplier-picker-check" data-id="${p.id}" ${isAssignedHere ? "checked" : ""} />
            <div>
              <p class="supplier-picker-name">${escapeHtml(p.name)}</p>
              ${assignedElsewhereNote}
            </div>
          </label>`;
      })
      .join("");
  }

function getSupplierNameById(supplierId) {
    const s = suppliers.find((x) => x.id === supplierId);
    return s ? s.name : "";
  }

function assignSelectedProductsToSupplier() {
    if (!activeSupplierId) return;
    const checks = document.querySelectorAll(".supplier-picker-check");
    let assignedCount = 0;
    let unassignedCount = 0;
    checks.forEach((chk) => {
      const p = products.find((x) => x.id === chk.dataset.id);
      if (!p) return;
      if (chk.checked && p.supplierId !== activeSupplierId) {
        p.supplierId = activeSupplierId;
        assignedCount++;
      } else if (!chk.checked && p.supplierId === activeSupplierId) {
        p.supplierId = null;
        unassignedCount++;
      }
    });
    save();
    renderSupplierOrderList(activeSupplierId);
    renderSupplierProductPicker();
    let msg = t("supplierProductsAssigned").replace("{n}", assignedCount);
    if (unassignedCount > 0) {
      msg += " " + t("supplierProductsUnassigned").replace("{n}", unassignedCount);
    }
    showToast(msg, "success");
  }

function renderSupplierHistory(supplierId) {
    const listEl = document.getElementById("supplierHistoryList");
    const history = supplierTransactions
      .filter((t) => t.supplierId === supplierId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (!history.length) {
      listEl.innerHTML = `<p class="empty-state">${t("supplierNoHistory")}</p>`;
      return;
    }

    listEl.innerHTML = history
      .map((tx) => {
        const d = new Date(tx.timestamp);
        const dateStr = d.toLocaleDateString(locale());
        const isDebt = tx.type === "debt";
        return `
          <div class="supplier-history-row">
            <div>
              <p class="supplier-history-note">${escapeHtml(tx.note || (isDebt ? t("supplierDebtEntry") : t("supplierPaymentEntry")))}</p>
              <p class="supplier-history-date">${dateStr}</p>
            </div>
            <span class="${isDebt ? "price-change-up" : "price-change-down"}">${isDebt ? "+" : "-"}${formatTL(tx.amount)}</span>
          </div>`;
      })
      .join("");
  }

function addSupplierDebt() {
    if (!activeSupplierId) return;
    showPrompt(t("supplierDebtPrompt"), "").then((amountStr) => {
      if (amountStr === null) return;
      const amount = Number(amountStr);
      if (!amount || amount <= 0) {
        showToast(t("alertInvalidAmount"), "error");
        return;
      }
      showPrompt(t("supplierNotePrompt"), "").then((note) => {
        supplierTransactions.push({
          id: genId(),
          supplierId: activeSupplierId,
          type: "debt",
          amount,
          note: note || "",
          timestamp: new Date().toISOString()
        });
        save();
        openSupplierModal(activeSupplierId);
        renderSuppliers();
      });
    });
  }

function addSupplierPayment() {
    if (!activeSupplierId) return;
    showPrompt(t("supplierPaymentPrompt"), "").then((amountStr) => {
      if (amountStr === null) return;
      const amount = Number(amountStr);
      if (!amount || amount <= 0) {
        showToast(t("alertInvalidAmount"), "error");
        return;
      }
      supplierTransactions.push({
        id: genId(),
        supplierId: activeSupplierId,
        type: "payment",
        amount,
        note: "",
        timestamp: new Date().toISOString()
      });
      save();
      openSupplierModal(activeSupplierId);
      renderSuppliers();
      showToast(t("supplierPaymentRecorded"), "success");
    });
  }

function deleteSupplier() {
    if (!activeSupplierId) return;
    if (!confirm(t("confirmDeleteSupplier"))) return;
    suppliers = suppliers.filter((s) => s.id !== activeSupplierId);
    supplierTransactions = supplierTransactions.filter((t) => t.supplierId !== activeSupplierId);
    save();
    renderSuppliers();
    closeSupplierModal();
  }
