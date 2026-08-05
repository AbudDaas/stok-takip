import { state } from './00-state.js';
import { locale, save } from './01-firebase-core.js';
import { escapeHtml, formatTL } from './02-utils.js';
import { logAudit } from './03-staff-roles.js';

export function renderIncomingOrders() {
  const listEl = document.getElementById("incomingOrdersList");
  const emptyEl = document.getElementById("incomingOrdersEmptyState");
  if (!listEl) return;

  const orders = state.incomingOrders || [];
  if (!orders.length) {
    listEl.innerHTML = "";
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  const sorted = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  listEl.innerHTML = sorted
    .map((order) => {
      const dateStr = new Date(order.createdAt).toLocaleString(locale());
      const itemsStr = (order.items || []).map((it) => `${escapeHtml(it.name)} — ${it.qty} ${it.unit === "kg" ? "kg" : "adet"}`).join("<br>");
      const grandTotal = (order.productTotal || 0) + (order.deliveryFee || 0);
      const deliveryHtml =
        order.deliveryMode === "courier"
          ? `<p class="reminder-meta">🚚 ${state.t("incomingOrderCourier")}${order.distanceKm != null ? ` (~${order.distanceKm.toFixed(1)} km)` : ""} · ${formatTL(order.deliveryFee)}</p>` +
            (order.mapLink ? `<p class="reminder-meta"><a href="${escapeHtml(order.mapLink)}" target="_blank" rel="noopener">${state.t("incomingOrderMapLink")}</a></p>` : "") +
            (order.address ? `<p class="reminder-meta">${escapeHtml(order.address)}</p>` : "")
          : `<p class="reminder-meta">🏪 ${state.t("incomingOrderPickup")}</p>`;
      const statusBadgeClass = order.status === "tamamlandi" ? "status-yeterli" : "status-kritik";
      const statusLabel = order.status === "tamamlandi" ? state.t("incomingOrderDone") : state.t("incomingOrderNew");

      return `
        <div class="reminder-row" style="align-items:flex-start;flex-direction:column;gap:8px;">
          <div style="display:flex;justify-content:space-between;width:100%;">
            <div>
              <p class="reminder-name">${escapeHtml(order.customerName)} · ${escapeHtml(order.customerPhone)}</p>
              <p class="reminder-meta">${dateStr}</p>
            </div>
            <span class="status-badge ${statusBadgeClass}">${statusLabel}</span>
          </div>
          <p class="reminder-meta">${itemsStr}</p>
          ${deliveryHtml}
          <p class="reminder-name" style="margin-top:4px;">${state.t("incomingOrderTotal")}: ${formatTL(grandTotal)}</p>
          <div style="display:flex;gap:8px;width:100%;">
            <button class="btn btn-sm order-whatsapp-btn" data-phone="${escapeHtml(order.customerPhone)}" style="flex:1;">
              <i class="fa-brands fa-whatsapp" aria-hidden="true"></i> WhatsApp
            </button>
            ${
              order.status !== "tamamlandi"
                ? `<button class="btn btn-sm btn-primary order-complete-btn" data-id="${order.id}" style="flex:1;">${state.t("incomingOrderMarkDone")}</button>`
                : ""
            }
            <button class="btn btn-sm btn-danger order-delete-btn" data-id="${order.id}"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
          </div>
        </div>`;
    })
    .join("");

  listEl.querySelectorAll(".order-whatsapp-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cleanPhone = btn.dataset.phone.replace(/[^\d]/g, "");
      window.open(`https://wa.me/${cleanPhone}`, "_blank");
    });
  });
  listEl.querySelectorAll(".order-complete-btn").forEach((btn) => {
    btn.addEventListener("click", () => markOrderComplete(btn.dataset.id));
  });
  listEl.querySelectorAll(".order-delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteIncomingOrder(btn.dataset.id));
  });
}

export function markOrderComplete(orderId) {
  const order = (state.incomingOrders || []).find((o) => o.id === orderId);
  if (!order) return;
  order.status = "tamamlandi";
  logAudit("Sipariş tamamlandı olarak işaretlendi", order.customerName);
  save();
  renderIncomingOrders();
}

export function deleteIncomingOrder(orderId) {
  state.incomingOrders = (state.incomingOrders || []).filter((o) => o.id !== orderId);
  save();
  renderIncomingOrders();
}