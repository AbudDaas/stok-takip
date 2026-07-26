import { state } from './00-state.js';
import { locale, save } from './01-firebase-core.js';
import { escapeHtml, formatTL, genId, showPrompt, showToast } from './02-utils.js';
import { logAudit } from './03-staff-roles.js';
import { calcOrderSuggestions } from './17-ai-panel.js';

export function getSupplierBalance(supplierId) {
    return state.supplierTransactions
      .filter((t) => t.supplierId === supplierId)
      .reduce((sum, t) => sum + (t.type === "debt" ? t.amount : -t.amount), 0);
  }

export function renderSuppliers() {
    const listEl = document.getElementById("supplierList");
    const emptyEl = document.getElementById("supplierEmptyState");
    if (!listEl) return;

    if (!state.suppliers.length) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      return;
    }
    emptyEl.style.display = "none";

    listEl.innerHTML = state.suppliers
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

export function addSuggestedSuppliers() {
    const existingNames = state.suppliers.map((s) => s.name.trim().toLowerCase());
    const toAdd = state.SUGGESTED_SUPPLIERS.filter((name) => !existingNames.includes(name.toLowerCase()));
    if (!toAdd.length) {
      showToast(state.t("suggestedSuppliersAllAdded"), "info");
      return;
    }
    toAdd.forEach((name) => {
      state.suppliers.push({ id: genId(), name, phone: "" });
    });
    save();
    renderSuppliers();
    showToast(state.t("suggestedSuppliersAdded").replace("{n}", toAdd.length), "success");
  }

export function addSupplier() {
    const name = document.getElementById("supplierName").value.trim();
    const phone = document.getElementById("supplierPhone").value.trim();
    if (!name) {
      showToast(state.t("supplierNameRequired"), "error");
      return;
    }
    state.suppliers.push({ id: genId(), name, phone });
    save();
    renderSuppliers();
    document.getElementById("supplierName").value = "";
    document.getElementById("supplierPhone").value = "";
    showToast(state.t("supplierAdded"), "success");
  }

export function openSupplierModal(supplierId) {
    const s = state.suppliers.find((x) => x.id === supplierId);
    if (!s) return;
    state.activeSupplierId = supplierId;
    document.getElementById("supplierModalName").textContent = s.name;
    document.getElementById("supplierModalDebt").textContent = formatTL(getSupplierBalance(supplierId));
    renderSupplierHistory(supplierId);
    renderSupplierOrderList(supplierId);
    document.getElementById("supplierProductSearch").value = "";
    renderSupplierProductPicker();
    document.getElementById("supplierModal").style.display = "flex";
  }

export function closeSupplierModal() {
    document.getElementById("supplierModal").style.display = "none";
    state.activeSupplierId = null;
  }

export function renderSupplierOrderList(supplierId) {
    const listEl = document.getElementById("supplierOrderList");
    const emptyEl = document.getElementById("supplierOrderListEmptyState");
    const sendBtn = document.getElementById("supplierOrderSendBtn");
    if (!listEl) return;

    const suggestions = calcOrderSuggestions((p) => p.supplierId === supplierId);
    state.supplierOrderSuggestionsCache = suggestions;

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
        const daysLabel = s.daysLeft <= 0 ? state.t("orderEngineToday") : `${Math.ceil(s.daysLeft)} ${state.t("orderEngineDaysLeft")}`;
        return `
          <div class="order-engine-row">
            <div class="order-engine-info">
              <p class="order-engine-name">${escapeHtml(s.name)}</p>
              <p class="order-engine-meta">${state.t("orderEngineRunsOut")}: ${daysLabel}</p>
            </div>
            <div class="order-engine-suggestion">
              <span class="order-engine-qty">${s.suggestedOrder}</span>
              <span class="order-engine-unit">${s.unit === "kg" ? state.t("unitKgShort") : state.t("unitAdetShort")}</span>
            </div>
          </div>`;
      })
      .join("");
  }

export function sendSupplierOrderWhatsApp() {
    const s = state.suppliers.find((x) => x.id === state.activeSupplierId);
    if (!s || !state.supplierOrderSuggestionsCache.length) return;

    const lines = state.supplierOrderSuggestionsCache.map(
      (item) => `- ${item.name}: ${item.suggestedOrder} ${item.unit === "kg" ? state.t("unitKgShort") : state.t("unitAdetShort")}`
    );
    const message = `${state.t("orderEngineMessageTitle")} (${s.name})\n\n${lines.join("\n")}`;

    if (s.phone) {
      const cleanPhone = s.phone.replace(/[^\d]/g, "");
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
    } else {
      navigator.clipboard
        .writeText(message)
        .then(() => showToast(state.t("orderEngineCopied"), "success"))
        .catch(() => showToast(message, "info"));
    }
    logAudit("Tedarikçiye sipariş listesi gönderildi", s.name);
  }

export function renderSupplierProductPicker() {
    const pickerEl = document.getElementById("supplierProductPicker");
    if (!pickerEl || !state.activeSupplierId) return;
    const search = document.getElementById("supplierProductSearch").value.toLowerCase().trim();

    const filtered = state.products.filter((p) => !search || p.name.toLowerCase().includes(search));

    pickerEl.innerHTML = filtered
      .map((p) => {
        const isAssignedHere = p.supplierId === state.activeSupplierId;
        const assignedElsewhereNote =
          p.supplierId && !isAssignedHere
            ? `<p class="supplier-picker-note">${state.t("supplierProductAssignedElsewhere")}: ${escapeHtml(getSupplierNameById(p.supplierId))}</p>`
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

export function getSupplierNameById(supplierId) {
    const s = state.suppliers.find((x) => x.id === supplierId);
    return s ? s.name : "";
  }

export function assignSelectedProductsToSupplier() {
    if (!state.activeSupplierId) return;
    const checks = document.querySelectorAll(".supplier-picker-check");
    let assignedCount = 0;
    let unassignedCount = 0;
    checks.forEach((chk) => {
      const p = state.products.find((x) => x.id === chk.dataset.id);
      if (!p) return;
      if (chk.checked && p.supplierId !== state.activeSupplierId) {
        p.supplierId = state.activeSupplierId;
        assignedCount++;
      } else if (!chk.checked && p.supplierId === state.activeSupplierId) {
        p.supplierId = null;
        unassignedCount++;
      }
    });
    save();
    renderSupplierOrderList(state.activeSupplierId);
    renderSupplierProductPicker();
    let msg = state.t("supplierProductsAssigned").replace("{n}", assignedCount);
    if (unassignedCount > 0) {
      msg += " " + state.t("supplierProductsUnassigned").replace("{n}", unassignedCount);
    }
    showToast(msg, "success");
  }

export function renderSupplierHistory(supplierId) {
    const listEl = document.getElementById("supplierHistoryList");
    const history = state.supplierTransactions
      .filter((t) => t.supplierId === supplierId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (!history.length) {
      listEl.innerHTML = `<p class="empty-state">${state.t("supplierNoHistory")}</p>`;
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
              <p class="supplier-history-note">${escapeHtml(tx.note || (isDebt ? state.t("supplierDebtEntry") : state.t("supplierPaymentEntry")))}</p>
              <p class="supplier-history-date">${dateStr}</p>
            </div>
            <span class="${isDebt ? "price-change-up" : "price-change-down"}">${isDebt ? "+" : "-"}${formatTL(tx.amount)}</span>
          </div>`;
      })
      .join("");
  }

export function addSupplierDebt() {
    if (!state.activeSupplierId) return;
    showPrompt(state.t("supplierDebtPrompt"), "").then((amountStr) => {
      if (amountStr === null) return;
      const amount = Number(amountStr);
      if (!amount || amount <= 0) {
        showToast(state.t("alertInvalidAmount"), "error");
        return;
      }
      showPrompt(state.t("supplierNotePrompt"), "").then((note) => {
        state.supplierTransactions.push({
          id: genId(),
          supplierId: state.activeSupplierId,
          type: "debt",
          amount,
          note: note || "",
          timestamp: new Date().toISOString()
        });
        save();
        openSupplierModal(state.activeSupplierId);
        renderSuppliers();
      });
    });
  }

export function addSupplierPayment() {
    if (!state.activeSupplierId) return;
    showPrompt(state.t("supplierPaymentPrompt"), "").then((amountStr) => {
      if (amountStr === null) return;
      const amount = Number(amountStr);
      if (!amount || amount <= 0) {
        showToast(state.t("alertInvalidAmount"), "error");
        return;
      }
      state.supplierTransactions.push({
        id: genId(),
        supplierId: state.activeSupplierId,
        type: "payment",
        amount,
        note: "",
        timestamp: new Date().toISOString()
      });
      save();
      openSupplierModal(state.activeSupplierId);
      renderSuppliers();
      showToast(state.t("supplierPaymentRecorded"), "success");
    });
  }

export function deleteSupplier() {
    if (!state.activeSupplierId) return;
    if (!confirm(state.t("confirmDeleteSupplier"))) return;
    state.suppliers = state.suppliers.filter((s) => s.id !== state.activeSupplierId);
    state.supplierTransactions = state.supplierTransactions.filter((t) => t.supplierId !== state.activeSupplierId);
    save();
    renderSuppliers();
    closeSupplierModal();
  }
