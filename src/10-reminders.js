/**
 * 10-reminders.js
 * Müşteri hatırlatma: WhatsApp üzerinden veresiye/uzun süredir gelmeyen müşteri mesajları.
 */

function renderReminders() {
    const debtListEl = document.getElementById("reminderDebtList");
    const debtEmptyEl = document.getElementById("reminderDebtEmptyState");
    const inactiveListEl = document.getElementById("reminderInactiveList");
    const inactiveEmptyEl = document.getElementById("reminderInactiveEmptyState");
    if (!debtListEl) return;

    // Borcu olan müşteriler
    const withDebt = customers
      .map((c) => ({ customer: c, debt: getCustomerDebt(c.id) }))
      .filter((x) => x.debt > 0 && x.customer.phone)
      .sort((a, b) => b.debt - a.debt);

    if (!withDebt.length) {
      debtListEl.innerHTML = "";
      debtEmptyEl.style.display = "block";
    } else {
      debtEmptyEl.style.display = "none";
      debtListEl.innerHTML = withDebt
        .map(
          (x) => `
          <div class="reminder-row">
            <div>
              <p class="reminder-name">${escapeHtml(x.customer.name)}</p>
              <p class="reminder-meta">${formatTL(x.debt)}</p>
            </div>
            <button class="reminder-send-btn" data-type="debt" data-id="${x.customer.id}">
              <i class="fa-brands fa-whatsapp" aria-hidden="true"></i> ${t("reminderSendBtn")}
            </button>
          </div>`
        )
        .join("");
    }

    // Uzun süredir (30+ gün) alışveriş yapmamış müşteriler
    const cutoff = Date.now() - 30 * 86400000;
    const inactive = customers
      .filter((c) => c.phone)
      .map((c) => {
        const customerSales = sales.filter((s) => s.customerId === c.id);
        const lastSale = customerSales.length ? new Date(Math.max(...customerSales.map((s) => new Date(s.timestamp)))) : null;
        return { customer: c, lastSale };
      })
      .filter((x) => x.lastSale && x.lastSale.getTime() < cutoff);

    if (!inactive.length) {
      inactiveListEl.innerHTML = "";
      inactiveEmptyEl.style.display = "block";
    } else {
      inactiveEmptyEl.style.display = "none";
      inactiveListEl.innerHTML = inactive
        .map((x) => {
          const daysAgo = Math.round((Date.now() - x.lastSale.getTime()) / 86400000);
          return `
          <div class="reminder-row">
            <div>
              <p class="reminder-name">${escapeHtml(x.customer.name)}</p>
              <p class="reminder-meta">${daysAgo} ${t("reminderDaysAgo")}</p>
            </div>
            <button class="reminder-send-btn" data-type="inactive" data-id="${x.customer.id}">
              <i class="fa-brands fa-whatsapp" aria-hidden="true"></i> ${t("reminderSendBtn")}
            </button>
          </div>`;
        })
        .join("");
    }

    document.querySelectorAll(".reminder-send-btn").forEach((btn) => {
      btn.addEventListener("click", () => sendReminderWhatsApp(btn.dataset.type, btn.dataset.id));
    });
  }

function sendReminderWhatsApp(type, customerId) {
    const c = customers.find((x) => x.id === customerId);
    if (!c || !c.phone) return;

    let message;
    if (type === "debt") {
      const debt = getCustomerDebt(customerId);
      message = `${t("reminderDebtMsgPrefix")} ${c.name}, ${t("reminderDebtMsgBody")} ${formatTL(debt)}. ${t("reminderDebtMsgSuffix")}`;
    } else {
      message = `${t("reminderInactiveMsgPrefix")} ${c.name}! ${t("reminderInactiveMsgBody")}`;
    }

    const cleanPhone = c.phone.replace(/[^\d]/g, "");
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
    logAudit("Hatırlatma gönderildi", `${c.name} (${type === "debt" ? "borç" : "özledik"})`);
  }
