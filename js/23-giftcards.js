import { state } from './00-state.js';
import { save } from './01-firebase-core.js';
import { escapeHtml, formatTL, genId, showToast } from './02-utils.js';
import { logAudit } from './03-staff-roles.js';

function generateGiftCardCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // karışması kolay 0/O, 1/I gibi karakterler çıkarıldı
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
    if (i === 3) code += "-";
  }
  return code;
}

export function createGiftCard() {
  const amountInput = document.getElementById("giftCardAmount");
  const amount = Number(amountInput.value);
  if (!amount || amount <= 0) {
    showToast(state.t("alertInvalidAmount"), "error");
    return;
  }

  const code = generateGiftCardCode();
  state.giftCards.push({
    id: genId(),
    code,
    initialAmount: amount,
    remainingBalance: amount,
    createdAt: new Date().toISOString()
  });

  logAudit("Hediye kartı oluşturuldu", `${code}: ${formatTL(amount)}`);
  save();
  renderGiftCards();
  amountInput.value = "";
  showToast(`${state.t("giftCardCreated")}: ${code}`, "success");
}

export function findGiftCardByCode(code) {
  const normalized = (code || "").trim().toUpperCase();
  return state.giftCards.find((g) => g.code === normalized);
}

/**
 * Bir hediye kartından, kartın bakiyesini AŞMAYACAK şekilde bir tutar
 * düşer. Gerçekten düşülen tutarı döndürür (istenen tutardan az olabilir,
 * bakiye yetmiyorsa).
 */
export function redeemGiftCard(code, amount) {
  const card = findGiftCardByCode(code);
  if (!card || card.remainingBalance <= 0) return 0;
  const actualAmount = Math.min(amount, card.remainingBalance);
  card.remainingBalance = Math.round((card.remainingBalance - actualAmount) * 100) / 100;
  return actualAmount;
}

export function deleteGiftCard(id) {
  state.giftCards = state.giftCards.filter((g) => g.id !== id);
  save();
  renderGiftCards();
}

export function renderGiftCards() {
  const listEl = document.getElementById("giftCardList");
  const emptyEl = document.getElementById("giftCardEmptyState");
  if (!listEl) return;

  if (!state.giftCards.length) {
    listEl.innerHTML = "";
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  const sorted = [...state.giftCards].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  listEl.innerHTML = sorted
    .map((g) => {
      const isEmpty = g.remainingBalance <= 0;
      return `
        <div class="reminder-row">
          <div>
            <p class="reminder-name" style="font-family:monospace;">${escapeHtml(g.code)}</p>
            <p class="reminder-meta">${state.t("giftCardInitial")}: ${formatTL(g.initialAmount)}</p>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-weight:700;color:${isEmpty ? "var(--text-muted)" : "var(--green-text)"};">${formatTL(g.remainingBalance)}</span>
            <button class="gift-card-delete-btn" data-id="${g.id}" aria-label="Sil"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
          </div>
        </div>`;
    })
    .join("");

  listEl.querySelectorAll(".gift-card-delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteGiftCard(btn.dataset.id));
  });
}