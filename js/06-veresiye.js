import { state } from './00-state.js';
import { locale, save } from './01-firebase-core.js';
import { escapeHtml, formatTL, genId } from './02-utils.js';

export function mkCustomer(name, phone) {
    return { id: genId(), name, phone: phone || "" };
  }

export function addCustomer() {
    const nameInput = document.getElementById("newCustomerName");
    const phoneInput = document.getElementById("newCustomerPhone");
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }
    state.customers.push(mkCustomer(name, phoneInput.value.trim()));
    nameInput.value = "";
    phoneInput.value = "";
    save();
    renderCustomers();
  }

export function deleteCustomer(id) {
    const debt = getCustomerDebt(id);
    if (debt > 0 && !confirm(`${state.t("confirmDeleteCustomerWithDebt")} ${formatTL(debt)} ${state.t("confirmDeleteCustomerWithDebtSuffix")}`)) {
      return;
    }
    state.customers = state.customers.filter((c) => c.id !== id);
    closeCustomerModal();
    save();
    renderCustomers();
  }

export function saveCustomerEdit() {
    const c = state.customers.find((x) => x.id === state.activeCustomerId);
    if (!c) return;
    const name = document.getElementById("editCustomerName").value.trim();
    if (!name) return;
    c.name = name;
    c.phone = document.getElementById("editCustomerPhone").value.trim();
    save();
    renderCustomers();
    openCustomerModal(c.id);
  }

export function getCustomerDebt(customerId) {
    const debtFromSales = state.sales
      .filter((s) => s.paymentType === "veresiye" && s.customerId === customerId)
      .reduce((sum, s) => sum + s.total, 0);
    const paid = state.payments.filter((p) => p.customerId === customerId).reduce((sum, p) => sum + p.amount, 0);
    return Math.max(0, debtFromSales - paid);
  }

export function recordPayment() {
    const c = state.customers.find((x) => x.id === state.activeCustomerId);
    if (!c) return;
    const input = document.getElementById("paymentAmountInput");
    const amount = Number(input.value);
    if (!amount || amount <= 0) {
      input.focus();
      return;
    }
    state.payments.push({
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

export function customerRowHtml(c) {
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

export function renderCustomers() {
    const list = document.getElementById("customerList");
    const empty = document.getElementById("customerEmptyState");
    if (!list) return;

    if (!state.customers.length) {
      list.innerHTML = "";
      empty.style.display = "block";
    } else {
      empty.style.display = "none";
      list.innerHTML = state.customers.map(customerRowHtml).join("");
    }
    list.querySelectorAll(".customer-row").forEach((row) => {
      row.addEventListener("click", () => openCustomerModal(row.dataset.id));
    });

    const totalDebt = state.customers.reduce((sum, c) => sum + getCustomerDebt(c.id), 0);
    document.getElementById("statTotalDebt").textContent = formatTL(totalDebt);
    document.getElementById("statCustomerCount").textContent = state.customers.length;

    populateVeresiyeCustomerSelect();
  }

export function populateVeresiyeCustomerSelect() {
    // Aktif seçim varsa ama müşteri artık listede yoksa (silinmişse) sıfırla
    if (state.selectedVeresiyeCustomerId && !state.customers.some((c) => c.id === state.selectedVeresiyeCustomerId)) {
      clearVeresiyeCustomerSelection();
    }
  }

export function renderVeresiyeCustomerResults(query) {
    const resultsEl = document.getElementById("veresiyeCustomerResults");
    if (!resultsEl) return;
    const q = (query || "").toLowerCase().trim();
    const matches = q ? state.customers.filter((c) => c.name.toLowerCase().includes(q)) : state.customers;

    if (!matches.length) {
      resultsEl.innerHTML = `<p class="searchable-result-empty">${state.t("noMatchingCustomers")}</p>`;
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

export function selectVeresiyeCustomer(id) {
    const c = state.customers.find((x) => x.id === id);
    if (!c) return;
    state.selectedVeresiyeCustomerId = id;
    document.getElementById("veresiyeCustomerSelectedId").value = id;
    document.getElementById("veresiyeCustomerSearch").value = c.name;
    document.getElementById("veresiyeCustomerResults").classList.remove("show");
  }

export function clearVeresiyeCustomerSelection() {
    state.selectedVeresiyeCustomerId = null;
    const idInput = document.getElementById("veresiyeCustomerSelectedId");
    const searchInput = document.getElementById("veresiyeCustomerSearch");
    if (idInput) idInput.value = "";
    if (searchInput) searchInput.value = "";
  }

export function openCustomerModal(id) {
    const c = state.customers.find((x) => x.id === id);
    if (!c) return;
    state.activeCustomerId = id;
    document.getElementById("customerModalName").textContent = c.name;
    document.getElementById("customerModalDebt").textContent = formatTL(getCustomerDebt(id));
    document.getElementById("editCustomerName").value = c.name;
    document.getElementById("editCustomerPhone").value = c.phone || "";
    document.getElementById("paymentAmountInput").value = "";
    renderCustomerHistory(id);
    document.getElementById("customerModal").style.display = "flex";
  }

export function closeCustomerModal() {
    document.getElementById("customerModal").style.display = "none";
    state.activeCustomerId = null;
  }

export function renderCustomerHistory(customerId) {
    const list = document.getElementById("customerHistoryList");
    if (!list) return;
    const debtEntries = state.sales
      .filter((s) => s.paymentType === "veresiye" && s.customerId === customerId)
      .map((s) => ({ type: "debt", timestamp: s.timestamp, amount: s.total, label: s.items.map((i) => `${i.name} x${i.qty}`).join(", ") }));
    const paymentEntries = state.payments
      .filter((p) => p.customerId === customerId)
      .map((p) => ({ type: "payment", timestamp: p.timestamp, amount: p.amount, label: state.t("paymentReceivedLabel") }));
    const combined = [...debtEntries, ...paymentEntries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (!combined.length) {
      list.innerHTML = `<p class="empty-state" style="display:block;">${state.t("noTransactionsYet")}</p>`;
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
