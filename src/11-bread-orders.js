/**
 * 11-bread-orders.js
 * Günlük ürün takibi (ekmek vb.), acil sipariş listesi ve fiyat değişimi geçmişi.
 */

function addBreadConfig() {
    const nameInput = document.getElementById("breadConfigName");
    const qtyInput = document.getElementById("breadConfigQty");
    const staleInput = document.getElementById("breadConfigStaleName");
    const autoResetInput = document.getElementById("breadConfigAutoReset");

    const productName = nameInput.value.trim();
    if (!productName) {
      showToast(t("breadConfigNameRequired"), "error");
      return;
    }

    dailyResetConfig.push({
      productName,
      dailyQty: Number(qtyInput.value) || 0,
      autoReset: autoResetInput.checked,
      staleProductName: staleInput.value.trim()
    });

    nameInput.value = "";
    qtyInput.value = "";
    staleInput.value = "";
    autoResetInput.checked = true;

    save();
    renderBreadStatus();
    showToast(t("breadConfigAdded"), "success");
  }

function removeBreadConfig(index) {
    dailyResetConfig.splice(index, 1);
    save();
    renderBreadStatus();
    showToast(t("breadConfigRemoved"), "success");
  }

function renderBreadConfigList() {
    const listEl = document.getElementById("breadConfigList");
    if (!listEl) return;

    if (!dailyResetConfig.length) {
      listEl.innerHTML = `<p class="empty-state" style="display:block;">${t("breadConfigEmpty")}</p>`;
      return;
    }

    listEl.innerHTML = dailyResetConfig
      .map((cfg, i) => {
        const autoResetLabel = cfg.autoReset ? t("breadAutoResetYes") : t("breadAutoResetNo");
        const staleStr = cfg.staleProductName ? ` · ${escapeHtml(cfg.staleProductName)}` : "";
        return `
          <div class="bread-config-row">
            <div class="bread-config-info">
              <p class="bread-config-name">${escapeHtml(cfg.productName)}</p>
              <p class="bread-config-meta">${cfg.dailyQty} adet · ${autoResetLabel}${staleStr}</p>
            </div>
            <button class="bread-config-remove-btn" data-index="${i}" aria-label="Kaldır"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
          </div>`;
      })
      .join("");

    listEl.querySelectorAll(".bread-config-remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => removeBreadConfig(Number(btn.dataset.index)));
    });
  }

function renderBreadStatus() {
    const currentEl = document.getElementById("breadCurrentList");
    const logListEl = document.getElementById("breadLogList");
    const logEmptyEl = document.getElementById("breadLogEmptyState");
    const numberInput = document.getElementById("breadWhatsAppNumber");
    if (!currentEl) return;

    if (numberInput && document.activeElement !== numberInput) {
      numberInput.value = breadWhatsAppNumber || "";
    }

    renderBreadConfigList();
    updateNotifButtonState();

    if (!dailyResetConfig.length) {
      currentEl.innerHTML = `<p class="empty-state" style="display:block;">${t("breadConfigEmpty")}</p>`;
    } else {
      currentEl.innerHTML = dailyResetConfig
        .map((cfg) => {
          const p = findProductByExactName(cfg.productName);
          return `
            <div class="bread-current-row">
              <span>${escapeHtml(cfg.productName)}</span>
              <span class="bread-current-qty">${p ? formatQty(p) : "—"}</span>
            </div>`;
        })
        .join("");
    }

    const sorted = [...breadLog].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 14);
    if (!sorted.length) {
      logListEl.innerHTML = "";
      logEmptyEl.style.display = "block";
    } else {
      logEmptyEl.style.display = "none";
      logListEl.innerHTML = sorted
        .map((entry) => {
          const d = new Date(entry.timestamp);
          const dateStr = d.toLocaleString(locale(), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
          const items = Array.isArray(entry.items) ? entry.items : [];
          const itemsStr = items.map((it) => `${escapeHtml(it.name)}: ${it.qty}`).join(" · ");
          return `
            <div class="bread-log-row">
              <span class="bread-log-date">${dateStr} · ${escapeHtml(entry.note || "")}</span>
              <span class="bread-log-qty">${itemsStr}</span>
            </div>`;
        })
        .join("");
    }
  }

function sendBreadWhatsApp() {
    const number = (document.getElementById("breadWhatsAppNumber").value || "").trim();
    if (!number) {
      showToast(t("breadNoWhatsAppNumber"), "error");
      return;
    }
    breadWhatsAppNumber = number;
    save();

    const today = new Date().toLocaleDateString(locale());
    const lines = dailyResetConfig.map((cfg) => {
      const p = findProductByExactName(cfg.productName);
      return `${cfg.productName}: ${p ? formatQty(p) : "0 adet"}`;
    });
    const message = `🍞 ${t("breadStatusTitle").replace("🍞 ", "")} (${today})\n${lines.join("\n")}`;
    const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

function cleanOldPriceChanges() {
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - twoDaysMs;
    priceChangeLog = priceChangeLog.filter((entry) => new Date(entry.timestamp).getTime() >= cutoff);
  }

function renderPriceChanges() {
    const listEl = document.getElementById("priceChangesList");
    const emptyEl = document.getElementById("priceChangesEmptyState");
    if (!listEl) return;

    cleanOldPriceChanges();

    const sorted = [...priceChangeLog].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (!sorted.length) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      return;
    }
    emptyEl.style.display = "none";

    listEl.innerHTML = sorted
      .map((entry) => {
        const d = new Date(entry.timestamp);
        const dateStr = d.toLocaleString(locale(), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        const directionClass = entry.direction === "up" ? "price-change-up" : "price-change-down";
        const directionIcon = entry.direction === "up" ? "fa-arrow-up" : "fa-arrow-down";
        const directionLabel = entry.direction === "up" ? t("priceIncreasedLabel") : t("priceDecreasedLabel");
        return `
          <div class="price-change-row">
            <div class="price-change-info">
              <p class="price-change-name">${escapeHtml(entry.productName)}</p>
              <p class="price-change-date">${dateStr} · ${directionLabel}</p>
            </div>
            <div class="price-change-values">
              <span class="price-change-old">${formatTL(entry.oldPrice)}</span>
              <i class="fa-solid ${directionIcon} ${directionClass}" aria-hidden="true"></i>
              <span class="${directionClass}">${formatTL(entry.newPrice)}</span>
            </div>
          </div>`;
      })
      .join("");
  }
