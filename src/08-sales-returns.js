/**
 * 08-sales-returns.js
 * Satış geçmişi, satış iptali ve iade (kısmi ürün iadesi) yönetimi.
 */

function getReturnedQtyForItem(saleId, itemName) {
    return returns
      .filter((r) => r.saleId === saleId)
      .reduce((sum, r) => {
        const item = r.items.find((i) => i.name === itemName);
        return sum + (item ? item.qty : 0);
      }, 0);
  }

function openReturnModal(saleId) {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return;
    activeReturnSaleId = saleId;

    const listEl = document.getElementById("returnItemsList");
    listEl.innerHTML = sale.items
      .map((item, i) => {
        const alreadyReturned = getReturnedQtyForItem(saleId, item.name);
        const maxQty = Math.max(0, item.qty - alreadyReturned);
        return `
          <div class="return-item-row">
            <div class="return-item-info">
              <p class="return-item-name">${escapeHtml(item.name)}</p>
              <p class="return-item-meta">${t("returnMaxLabel")}: ${maxQty} ${item.unit === "kg" ? t("unitKgShort") : t("unitAdetShort")}</p>
            </div>
            <input type="number" class="return-qty-input" data-index="${i}" min="0" max="${maxQty}" step="${item.unit === "kg" ? "0.001" : "1"}" value="0" ${maxQty <= 0 ? "disabled" : ""} />
          </div>`;
      })
      .join("");

    document.getElementById("returnModal").style.display = "flex";
  }

function closeReturnModal() {
    document.getElementById("returnModal").style.display = "none";
    activeReturnSaleId = null;
  }

function confirmReturn() {
    const sale = sales.find((s) => s.id === activeReturnSaleId);
    if (!sale) return;

    const inputs = document.querySelectorAll(".return-qty-input");
    const returnItems = [];
    let totalRefund = 0;

    inputs.forEach((input) => {
      const qty = Number(input.value) || 0;
      if (qty <= 0) return;
      const item = sale.items[Number(input.dataset.index)];
      if (!item) return;
      returnItems.push({ name: item.name, qty, price: item.price });
      totalRefund += qty * item.price;

      const p = products.find((x) => x.name === item.name);
      if (p) p.qty = Math.round((p.qty + qty) * 1000) / 1000;
    });

    if (!returnItems.length) {
      showToast(t("returnNoneSelected"), "error");
      return;
    }

    returns.push({
      id: genId(),
      saleId: sale.id,
      timestamp: new Date().toISOString(),
      items: returnItems,
      totalRefund
    });

    logAudit("İade alındı", `${formatTL(totalRefund)} (${returnItems.length} ürün)`);
    save();
    renderAll();
    closeReturnModal();
    showToast(t("returnSuccess"), "success");
  }

function cancelSale(saleId) {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return;
    if (!confirm(`${t("confirmCancelSale")}\n${formatTL(sale.total)} ${t("confirmCancelSaleDetail")}`)) {
      return;
    }
    sale.items.forEach((item) => {
      const p = products.find((x) => x.name === item.name);
      if (p) p.qty += item.qty;
    });
    sales = sales.filter((s) => s.id !== saleId);
    logAudit("Satış iptal edildi", formatTL(sale.total));
    save();
    renderAll();
  }

function isInPeriod(isoString, period) {
    const d = new Date(isoString);
    const now = new Date();
    if (period === "today") {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    }
    if (period === "week") {
      const dayOfWeek = (now.getDay() + 6) % 7; // Pazartesi=0
      const monday = new Date(now);
      monday.setHours(0, 0, 0, 0);
      monday.setDate(now.getDate() - dayOfWeek);
      return d >= monday;
    }
    if (period === "month") {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    return true; // 'all'
  }

function saleRowHtml(sale) {
    const d = new Date(sale.timestamp);
    const timeStr = d.toLocaleString(locale(), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    const itemsSummary = sale.items
      .map((i) => `${escapeHtml(i.name)} x${i.unit === "kg" ? i.qty + t("unitKgShort") : i.qty}`)
      .join(", ");
    const saleReturns = returns.filter((r) => r.saleId === sale.id);
    const totalReturned = saleReturns.reduce((sum, r) => sum + r.totalRefund, 0);
    const returnedNote = totalReturned > 0 ? `<p class="sale-returned-note">${t("returnedLabel")}: -${formatTL(totalReturned)}</p>` : "";
    const paymentBadge =
      sale.paymentType === "veresiye"
        ? `<span class="sale-payment-badge sale-payment-veresiye">${t("veresiyeLabel")}${sale.customerName ? ": " + escapeHtml(sale.customerName) : ""}</span>`
        : sale.paymentType === "kart"
        ? `<span class="sale-payment-badge sale-payment-kart">${t("payKart")}</span>`
        : "";
    const profitValue = sale.profit != null ? sale.profit : sale.total;
    return `
      <div class="sale-row">
        <div class="sale-row-top">
          <span class="sale-time">${timeStr}</span>
          <span class="sale-amount">${formatTL(sale.total)}</span>
        </div>
        <p class="sale-items">${itemsSummary}</p>
        <p class="sale-profit">${t("profitLabel")}: ${formatTL(profitValue)}</p>
        ${returnedNote}
        <div class="sale-row-bottom">
          ${paymentBadge}
          <button class="sale-return-btn" data-id="${sale.id}">
            <i class="fa-solid fa-rotate-left" aria-hidden="true"></i> ${t("returnBtn")}
          </button>
          <button class="sale-cancel-btn" data-id="${sale.id}">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i> ${t("cancelSaleBtn")}
          </button>
        </div>
      </div>`;
  }

function topProductRowHtml(item, rank) {
    return `
      <div class="product-row">
        <div class="product-info">
          <p class="product-name">${rank}. ${escapeHtml(item.name)}</p>
          <p class="product-meta">${item.qty} ${t("soldQtyLabel")}</p>
        </div>
        <span class="sale-amount">${formatTL(item.revenue)}</span>
      </div>`;
  }

function renderSales() {
    const list = document.getElementById("salesList");
    const empty = document.getElementById("salesEmptyState");
    const topList = document.getElementById("topProductsList");
    const topEmpty = document.getElementById("topProductsEmptyState");
    if (!list) return;

    const periodSales = sales.filter((s) => isInPeriod(s.timestamp, currentSalesPeriod));
    const sorted = [...periodSales].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (!sorted.length) {
      list.innerHTML = "";
      empty.style.display = "block";
    } else {
      empty.style.display = "none";
      list.innerHTML = sorted.map(saleRowHtml).join("");
      list.querySelectorAll(".sale-cancel-btn").forEach((btn) => {
        btn.addEventListener("click", () => cancelSale(btn.dataset.id));
      });
      list.querySelectorAll(".sale-return-btn").forEach((btn) => {
        btn.addEventListener("click", () => openReturnModal(btn.dataset.id));
      });
    }

    // En çok satan ürünler
    const productTotals = {};
    periodSales.forEach((s) => {
      s.items.forEach((i) => {
        if (!productTotals[i.name]) productTotals[i.name] = { name: i.name, qty: 0, revenue: 0 };
        productTotals[i.name].qty += i.qty;
        productTotals[i.name].revenue += i.qty * i.price;
      });
    });
    const topProducts = Object.values(productTotals)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    if (!topProducts.length) {
      topList.innerHTML = "";
      topEmpty.style.display = "block";
    } else {
      topEmpty.style.display = "none";
      topList.innerHTML = topProducts.map((item, i) => topProductRowHtml(item, i + 1)).join("");
    }

    const periodTotal = periodSales.reduce((sum, s) => sum + s.total, 0);
    const periodProfit = periodSales.reduce((sum, s) => sum + (s.profit != null ? s.profit : s.total), 0);
    document.getElementById("statPeriodTotal").textContent = formatTL(periodTotal);
    document.getElementById("statPeriodCount").textContent = periodSales.length;
    const profitEl = document.getElementById("statNetProfit");
    if (profitEl) {
      profitEl.textContent = formatTL(periodProfit);
      const profitCard = profitEl.closest(".profit-highlight-card");
      if (profitCard) profitCard.classList.toggle("negative", periodProfit < 0);
    }

    const nakitTotal = periodSales.filter((s) => s.paymentType === "nakit" || !s.paymentType).reduce((sum, s) => sum + s.total, 0);
    const kartTotal = periodSales.filter((s) => s.paymentType === "kart").reduce((sum, s) => sum + s.total, 0);
    const veresiyeTotal = periodSales.filter((s) => s.paymentType === "veresiye").reduce((sum, s) => sum + s.total, 0);
    const breakdownNakitEl = document.getElementById("breakdownNakit");
    const breakdownKartEl = document.getElementById("breakdownKart");
    const breakdownVeresiyeEl = document.getElementById("breakdownVeresiye");
    if (breakdownNakitEl) breakdownNakitEl.textContent = formatTL(nakitTotal);
    if (breakdownKartEl) breakdownKartEl.textContent = formatTL(kartTotal);
    if (breakdownVeresiyeEl) breakdownVeresiyeEl.textContent = formatTL(veresiyeTotal);
  }
