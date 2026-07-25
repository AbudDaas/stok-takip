/**
 * 09-suppliers.js
 * Tedarikçi borç/ödeme takibi.
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
    document.getElementById("supplierModal").style.display = "flex";
  }

function closeSupplierModal() {
    document.getElementById("supplierModal").style.display = "none";
    activeSupplierId = null;
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
