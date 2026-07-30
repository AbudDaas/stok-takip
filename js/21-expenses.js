import { state } from './00-state.js';
import { locale, save } from './01-firebase-core.js';
import { escapeHtml, formatTL, genId, showToast } from './02-utils.js';
import { logAudit } from './03-staff-roles.js';
import { isInPeriod } from './08-sales-returns.js';

const EXPENSE_CATEGORY_ICONS = {
  kira: "🏠",
  elektrik: "⚡",
  su: "💧",
  dogalgaz: "🔥",
  personel: "👤",
  nakliye: "🚚",
  diger: "📦"
};

export function addExpense() {
  const categoryEl = document.getElementById("expenseCategory");
  const descEl = document.getElementById("expenseDescription");
  const amountEl = document.getElementById("expenseAmount");
  const dateEl = document.getElementById("expenseDate");

  const amount = Number(amountEl.value);
  if (!amount || amount <= 0) {
    showToast(state.t("alertInvalidAmount"), "error");
    return;
  }

  const dateValue = dateEl.value ? new Date(dateEl.value).toISOString() : new Date().toISOString();

  state.expenses.push({
    id: genId(),
    category: categoryEl.value,
    description: descEl.value.trim(),
    amount,
    timestamp: dateValue
  });

  logAudit("Gider eklendi", `${categoryEl.options[categoryEl.selectedIndex].text}: ${formatTL(amount)}`);
  save();
  renderExpenses();

  descEl.value = "";
  amountEl.value = "";
  dateEl.value = "";
  showToast(state.t("expenseAdded"), "success");
}

export function deleteExpense(id) {
  state.expenses = state.expenses.filter((e) => e.id !== id);
  save();
  renderExpenses();
}

export function getMonthlyExpenseTotal() {
  const now = new Date();
  return state.expenses
    .filter((e) => {
      const d = new Date(e.timestamp);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, e) => sum + e.amount, 0);
}

function getMonthlyProductProfit() {
  return state.sales.filter((s) => isInPeriod(s.timestamp, "month")).reduce((sum, s) => sum + (s.profit || 0), 0);
}

export function renderExpenses() {
  const listEl = document.getElementById("expenseList");
  const emptyEl = document.getElementById("expenseEmptyState");
  const monthTotalEl = document.getElementById("expenseMonthTotal");
  const realProfitEl = document.getElementById("realNetProfitValue");
  const breakdownEl = document.getElementById("realNetProfitBreakdown");
  if (!listEl) return;

  const expenseTotal = getMonthlyExpenseTotal();
  if (monthTotalEl) monthTotalEl.textContent = formatTL(expenseTotal);

  if (realProfitEl) {
    const productProfit = getMonthlyProductProfit();
    const realProfit = productProfit - expenseTotal;
    realProfitEl.textContent = formatTL(realProfit);
    realProfitEl.style.color = realProfit >= 0 ? "var(--green-text)" : "var(--red-text)";
    if (breakdownEl) {
      breakdownEl.textContent = `${state.t("realNetProfitProductProfit")}: ${formatTL(productProfit)} − ${state.t("realNetProfitExpenses")}: ${formatTL(expenseTotal)}`;
    }
  }

  if (!state.expenses.length) {
    listEl.innerHTML = "";
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  const sorted = [...state.expenses].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  listEl.innerHTML = sorted
    .map((e) => {
      const dateStr = new Date(e.timestamp).toLocaleDateString(locale());
      const icon = EXPENSE_CATEGORY_ICONS[e.category] || "📦";
      const categoryLabel =
        e.category === "diger" ? state.t("categoryDiger") : state.t("expenseCategory" + e.category.charAt(0).toUpperCase() + e.category.slice(1));
      const descStr = e.description ? ` · ${escapeHtml(e.description)}` : "";
      return `
        <div class="reminder-row">
          <div>
            <p class="reminder-name">${icon} ${escapeHtml(categoryLabel)}${descStr}</p>
            <p class="reminder-meta">${dateStr}</p>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-weight:700;color:var(--amber-text);">${formatTL(e.amount)}</span>
            <button class="expense-delete-btn" data-id="${e.id}" aria-label="Sil"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
          </div>
        </div>`;
    })
    .join("");

  listEl.querySelectorAll(".expense-delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteExpense(btn.dataset.id));
  });
}
