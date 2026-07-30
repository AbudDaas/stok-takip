import { state } from './00-state.js';
import { locale, save } from './01-firebase-core.js';
import { escapeHtml, formatQty, formatTL, genId, showPrompt, showToast } from './02-utils.js';
import { logAudit } from './03-staff-roles.js';
import { attemptSendToFiscalProvider } from './04-fiscal.js';
import { adjustQty, findProductByCaseScan, findProductByScan, getDisplayName, updateOutOfStockTracking } from './05-products.js';
import { measurePerf } from './22-perf-logger.js';
import { clearVeresiyeCustomerSelection } from './06-veresiye.js';
import { renderAll } from './20-navigation.js';

export function showKgOrPricePrompt(productName, pricePerKg) {
    return new Promise((resolve) => {
      const modal = document.getElementById("kgPricePromptModal");
      const titleEl = document.getElementById("kgPricePromptTitle");
      const input = document.getElementById("kgPricePromptInput");
      const preview = document.getElementById("kgPricePromptPreview");
      const kgBtn = document.getElementById("kgPriceModeKgBtn");
      const priceBtn = document.getElementById("kgPriceModePriceBtn");
      const okBtn = document.getElementById("kgPricePromptOkBtn");
      const cancelBtn = document.getElementById("kgPricePromptCancelBtn");

      let mode = "kg";
      titleEl.textContent = `${productName} — ${state.t("promptKgAmount")}`;
      input.value = "";
      setMode("kg");

      function setMode(newMode) {
        mode = newMode;
        kgBtn.classList.toggle("active", mode === "kg");
        priceBtn.classList.toggle("active", mode === "price");
        updatePreview();
      }

      function updatePreview() {
        const value = parseFloat((input.value || "").replace(",", "."));
        if (!value || value <= 0 || !pricePerKg) {
          preview.textContent = "";
          return;
        }
        if (mode === "kg") {
          preview.textContent = state.t("kgPricePreviewKg").replace("{value}", formatTL(value * pricePerKg));
        } else {
          preview.textContent = state.t("kgPricePreviewPrice").replace(
            "{value}",
            (Math.round((value / pricePerKg) * 1000) / 1000).toLocaleString(locale(), { maximumFractionDigits: 3 })
          );
        }
      }

      modal.style.display = "flex";
      setTimeout(() => input.focus(), 50);

      function cleanup(result) {
        modal.style.display = "none";
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        input.removeEventListener("input", updatePreview);
        input.removeEventListener("keydown", onKeydown);
        kgBtn.removeEventListener("click", onKgBtnClick);
        priceBtn.removeEventListener("click", onPriceBtnClick);
        modal.removeEventListener("click", onOverlayClick);
        resolve(result);
      }

      function onOk() {
        const value = parseFloat((input.value || "").replace(",", "."));
        if (!value || value <= 0) {
          cleanup(null);
          return;
        }
        const weightInKg = mode === "kg" ? value : value / pricePerKg;
        cleanup(Math.round(weightInKg * 1000) / 1000);
      }
      function onCancel() {
        cleanup(null);
      }
      function onKeydown(e) {
        if (e.key === "Enter") {
          e.preventDefault();
          onOk();
        } else if (e.key === "Escape") {
          onCancel();
        }
      }
      function onOverlayClick(e) {
        if (e.target === modal) onCancel();
      }
      function onKgBtnClick() {
        setMode("kg");
      }
      function onPriceBtnClick() {
        setMode("price");
      }

      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      input.addEventListener("input", updatePreview);
      input.addEventListener("keydown", onKeydown);
      kgBtn.addEventListener("click", onKgBtnClick);
      priceBtn.addEventListener("click", onPriceBtnClick);
      modal.addEventListener("click", onOverlayClick);
    });
  }

export function startScan() {
    const readerEl = document.getElementById("qrReader");
    document.getElementById("startScanBtn").style.display = "none";
    document.getElementById("stopScanBtn").style.display = "flex";
    readerEl.innerHTML = "";
    state.html5QrCode = new Html5Qrcode("qrReader");
    state.scanning = true;

    state.html5QrCode
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          onScanSuccess(decodedText);
        },
        () => {}
      )
      .catch((err) => {
        showToast(state.t("cameraError"), "error");
        stopScan();
      });
  }

export function stopScan() {
    document.getElementById("startScanBtn").style.display = "flex";
    document.getElementById("stopScanBtn").style.display = "none";
    if (state.html5QrCode && state.scanning) {
      state.html5QrCode
        .stop()
        .then(() => state.html5QrCode.clear())
        .catch(() => {});
    }
    state.scanning = false;
  }

export function onScanSuccess(decodedText) {
    if (state.stokScanCooldown) return;

    // Önce KOLİ barkodu mu diye bak — eşleşirse, kaç adet olduğunu sormadan
    // direkt koli içindeki adet kadarını ekle/çıkar (sadece yön sorulur).
    const caseProduct = findProductByCaseScan(decodedText);
    if (caseProduct) {
      stopScan();
      const action = confirm(
        `${caseProduct.name}\n${state.t("caseBarcodeDetected")}: ${caseProduct.caseQty} ${state.t("unitAdetShort")}\n\n${state.t("confirmStockDirection")}`
      );
      adjustQty(caseProduct.id, action ? caseProduct.caseQty : -caseProduct.caseQty);
      return;
    }

    const p = findProductByScan(decodedText);
    if (!p) {
      showToast(state.t("alertNotRegistered"), "error");
      return;
    }
    stopScan();
    if (p.unit === "kg") {
      const action = confirm(`${p.name}\n${state.t("currentStockLabel")}: ${formatQty(p)}\n\n${state.t("confirmStockDirection")}`);
      showPrompt(state.t("promptKgAmount"), "").then((input) => {
        if (input === null) return;
        const weight = parseFloat(input.replace(",", "."));
        if (!weight || weight <= 0) {
          showToast(state.t("alertInvalidWeight"), "error");
          return;
        }
        adjustQty(p.id, action ? weight : -weight);
      });
    } else {
      const action = confirm(`${p.name}\n${state.t("currentStockLabel")}: ${p.qty}\n\n${state.t("confirmStockDirection")}`);
      showPrompt(state.t("promptAdetAmount"), "1").then((input) => {
        if (input === null) return;
        const amount = parseFloat(input.replace(",", "."));
        if (!amount || amount <= 0) {
          showToast(state.t("alertInvalidAmount"), "error");
          return;
        }
        adjustQty(p.id, action ? amount : -amount);
      });
    }
  }

export function startScanKasa() {
    const readerEl = document.getElementById("qrReaderKasa");
    document.getElementById("startKasaScanBtn").style.display = "none";
    document.getElementById("stopKasaScanBtn").style.display = "flex";
    readerEl.innerHTML = "";
    state.html5QrCodeKasa = new Html5Qrcode("qrReaderKasa");
    state.scanningKasa = true;

    state.html5QrCodeKasa
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          onScanSuccessKasa(decodedText);
        },
        () => {}
      )
      .catch((err) => {
        showToast(state.t("cameraError"), "error");
        stopScanKasa();
      });
  }

export function stopScanKasa() {
    document.getElementById("startKasaScanBtn").style.display = "flex";
    document.getElementById("stopKasaScanBtn").style.display = "none";
    if (state.html5QrCodeKasa && state.scanningKasa) {
      state.html5QrCodeKasa
        .stop()
        .then(() => state.html5QrCodeKasa.clear())
        .catch(() => {});
    }
    state.scanningKasa = false;
  }

export function playBeepSound() {
    try {
      if (!state.beepAudioCtx) {
        state.beepAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = state.beepAudioCtx;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = "square";
      oscillator.frequency.value = 1500;
      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.12);
    } catch (e) {
      // ses çalınamazsa sessizce devam et
    }
  }

export function onScanSuccessKasa(decodedText) {
    if (state.kasaScanCooldown) return;

    const caseProduct = findProductByCaseScan(decodedText);
    if (caseProduct) {
      playBeepSound();
      addToCart(caseProduct, caseProduct.caseQty);
      state.kasaScanCooldown = true;
      showKasaScanFeedback(`${caseProduct.name} (${caseProduct.caseQty} ${state.t("unitAdetShort")})`);
      setTimeout(() => {
        state.kasaScanCooldown = false;
      }, 3000);
      return;
    }

    const p = findProductByScan(decodedText);
    if (!p) {
      showToast(state.t("alertNotRegistered"), "error");
      return;
    }

    if (p.unit === "kg") {
      showKgOrPricePrompt(p.name, p.price).then((weight) => {
        if (weight === null) return;
        if (!weight || weight <= 0) {
          showToast(state.t("alertInvalidWeight"), "error");
          return;
        }
        playBeepSound();
        addToCart(p, weight);
        state.kasaScanCooldown = true;
        showKasaScanFeedback(`${p.name} (${weight} ${state.t("unitKgShort")})`);
        setTimeout(() => {
          state.kasaScanCooldown = false;
        }, 3000);
      });
    } else {
      playBeepSound();
      addToCart(p, 1);
      state.kasaScanCooldown = true;
      showKasaScanFeedback(p.name);
      setTimeout(() => {
        state.kasaScanCooldown = false;
      }, 3000);
    }
  }

export function showKasaScanFeedback(name) {
    const readerEl = document.getElementById("qrReaderKasa");
    if (!readerEl) return;
    let badge = document.getElementById("kasaScanFeedback");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "kasaScanFeedback";
      badge.className = "scan-feedback";
      readerEl.parentElement.insertBefore(badge, readerEl.nextSibling);
    }
    badge.innerHTML = `<i class="fa-solid fa-check" aria-hidden="true"></i> ${escapeHtml(name)} ${state.t("addedToCartSuffix")}`;
    badge.classList.add("show");
    clearTimeout(badge._hideTimer);
    badge._hideTimer = setTimeout(() => {
      badge.classList.remove("show");
    }, 3000);
  }

export function manualAddToCart(productId) {
    const p = state.products.find((x) => x.id === productId);
    if (!p) return;

    if (p.unit === "kg") {
      showKgOrPricePrompt(p.name, p.price).then((weight) => {
        if (weight === null) return;
        if (!weight || weight <= 0) {
          showToast(state.t("alertInvalidAmount"), "error");
          return;
        }
        addToCart(p, weight);
        document.getElementById("manualAddSearch").value = "";
        renderManualAddResults();
      });
      return;
    }

    showPrompt(`${p.name} — ${state.t("promptAdetAmount")}`, "1").then((input) => {
      if (input === null) return;
      const amount = parseFloat(input.replace(",", "."));
      if (!amount || amount <= 0) {
        showToast(state.t("alertInvalidAmount"), "error");
        return;
      }
      addToCart(p, amount);
      document.getElementById("manualAddSearch").value = "";
      renderManualAddResults();
    });
  }

export function renderManualAddResults() {
    const searchEl = document.getElementById("manualAddSearch");
    const resultsEl = document.getElementById("manualAddResults");
    if (!searchEl || !resultsEl) return;
    const q = (searchEl.value || "").toLowerCase().trim();
    if (!q) {
      resultsEl.innerHTML = "";
      return;
    }
    const matches = state.products
      .filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      .slice(0, 8);

    if (!matches.length) {
      resultsEl.innerHTML = `<p class="empty-state" style="display:block;">${state.t("noMatchingProducts")}</p>`;
      return;
    }

    resultsEl.innerHTML = matches
      .map((p) => {
        const priceLabel = p.unit === "kg" ? formatTL(p.price) + state.t("perKgSuffix") : formatTL(p.price);
        return `
          <div class="product-row manual-add-row" data-id="${p.id}">
            <div class="product-info">
              <p class="product-name">${escapeHtml(getDisplayName(p))}</p>
              <p class="product-meta">${escapeHtml(p.category)} · ${state.t("stockShortLabel")}: ${formatQty(p)} · ${priceLabel}</p>
            </div>
            <button class="btn btn-sm manual-add-btn" data-id="${p.id}">${state.t("addBtnShort")}</button>
          </div>`;
      })
      .join("");

    resultsEl.querySelectorAll(".manual-add-btn").forEach((btn) => {
      btn.addEventListener("click", () => manualAddToCart(btn.dataset.id));
    });
  }

export function getBulkDiscountForItem(item) {
    const p = state.products.find((x) => x.id === item.productId);
    if (!p || !p.bulkDiscountQty || !p.bulkDiscountValue) return null;
    if (item.qty < p.bulkDiscountQty) return null;

    let perUnitDiscount;
    if (p.bulkDiscountType === "amount") {
      perUnitDiscount = p.bulkDiscountValue;
    } else {
      perUnitDiscount = item.price * (p.bulkDiscountValue / 100);
    }
    perUnitDiscount = Math.min(perUnitDiscount, item.price);
    return { perUnitDiscount, totalDiscount: perUnitDiscount * item.qty };
  }

export function calcLineTotal(item) {
    const base = item.price * item.qty;
    const bulkDiscount = getBulkDiscountForItem(item);
    return bulkDiscount ? base - bulkDiscount.totalDiscount : base;
  }

export function addToCart(p, amount) {
    amount = amount || 1;
    const existing = state.cart.find((c) => c.productId === p.id);
    if (existing) {
      existing.qty = Math.round((existing.qty + amount) * 1000) / 1000;
    } else {
      state.cart.push({ productId: p.id, name: p.name, price: p.price, qty: amount, unit: p.unit || "adet" });
    }
    renderCart();
  }

export function adjustCartQty(productId, delta) {
    const item = state.cart.find((c) => c.productId === productId);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      state.cart = state.cart.filter((c) => c.productId !== productId);
    }
    renderCart();
  }

export function editCartWeight(productId) {
    const item = state.cart.find((c) => c.productId === productId);
    if (!item) return;
    showKgOrPricePrompt(item.name, item.price).then((weight) => {
      if (weight === null) return;
      if (!weight || weight <= 0) {
        removeCartItem(productId);
        return;
      }
      item.qty = Math.round(weight * 1000) / 1000;
      renderCart();
    });
  }

export function removeCartItem(productId) {
    state.cart = state.cart.filter((c) => c.productId !== productId);
    renderCart();
  }

export function clearCart() {
    state.cart = [];
    renderCart();
  }

export function cartRowHtml(item) {
    const lineTotal = calcLineTotal(item);
    const bulkDiscount = getBulkDiscountForItem(item);
    const isKg = item.unit === "kg";
    const qtyDisplay = isKg
      ? (Math.round(item.qty * 1000) / 1000).toLocaleString(locale(), { maximumFractionDigits: 3 }) + " " + state.t("unitKgShort")
      : item.qty;
    const controlsHtml = isKg
      ? `
          <button class="cart-edit-weight-btn" data-id="${item.productId}" aria-label="${state.t('editWeightAria')}"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
          <span class="cart-qty-value">${qtyDisplay}</span>`
      : `
          <button class="cart-qty-btn cart-minus" data-id="${item.productId}" aria-label="${state.t('decreaseAria')}"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
          <span class="cart-qty-value">${item.qty}</span>
          <button class="cart-qty-btn cart-plus" data-id="${item.productId}" aria-label="${state.t('increaseAria')}"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>`;
    const p = state.products.find((x) => x.id === item.productId);
    const displayName = p ? getDisplayName(p) : item.name;
    const bulkBadgeHtml = bulkDiscount
      ? `<p class="cart-bulk-badge">🎉 ${state.t("bulkDiscountApplied")}: -${formatTL(bulkDiscount.totalDiscount)}</p>`
      : "";
    return `
      <div class="cart-row" data-id="${item.productId}">
        <div class="cart-info">
          <p class="cart-name">${escapeHtml(displayName)}</p>
          <p class="cart-meta">${formatTL(item.price)} / ${isKg ? state.t("unitKgShort") : state.t("unitAdetShort")}</p>
          ${bulkBadgeHtml}
        </div>
        <div class="cart-controls">
          ${controlsHtml}
          <span class="cart-line-total">${formatTL(lineTotal)}</span>
          <button class="cart-remove-btn" data-id="${item.productId}" aria-label="${state.t('removeAria')}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>
      </div>`;
  }

export function renderCart() {
    const list = document.getElementById("cartList");
    const empty = document.getElementById("cartEmptyState");
    if (!list) return;

    if (!state.cart.length) {
      list.innerHTML = "";
      empty.style.display = "block";
    } else {
      empty.style.display = "none";
      list.innerHTML = state.cart.map(cartRowHtml).join("");
    }

    list.querySelectorAll(".cart-plus").forEach((btn) => {
      btn.addEventListener("click", () => adjustCartQty(btn.dataset.id, 1));
    });
    list.querySelectorAll(".cart-minus").forEach((btn) => {
      btn.addEventListener("click", () => adjustCartQty(btn.dataset.id, -1));
    });
    list.querySelectorAll(".cart-edit-weight-btn").forEach((btn) => {
      btn.addEventListener("click", () => editCartWeight(btn.dataset.id));
    });
    list.querySelectorAll(".cart-remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => removeCartItem(btn.dataset.id));
    });

    const subtotal = state.cart.reduce((sum, c) => sum + calcLineTotal(c), 0);
    const discountInput = document.getElementById("cartDiscount");
    const discount = Math.min(Number(discountInput.value) || 0, subtotal);
    const total = Math.max(0, subtotal - discount);

    document.getElementById("cartSubtotal").textContent = formatTL(subtotal);
    document.getElementById("cartTotal").textContent = formatTL(total);
  }

export function setPaymentType(type) {
    state.selectedPaymentType = type;
    document.getElementById("payNakitBtn").classList.toggle("active", type === "nakit");
    document.getElementById("payKartBtn").classList.toggle("active", type === "kart");
    document.getElementById("payVeresiyeBtn").classList.toggle("active", type === "veresiye");
    document.getElementById("veresiyeCustomerRow").style.display = type === "veresiye" ? "block" : "none";
  }

function completeSaleImpl() {
    if (!state.cart.length) {
      showToast(state.t("alertEmptyCart"), "error");
      return;
    }

    let customerId = null;
    let customerName = null;
    if (state.selectedPaymentType === "veresiye") {
      if (!state.customers.length) {
        showToast(state.t("alertNeedCustomer"), "error");
        return;
      }
      customerId = document.getElementById("veresiyeCustomerSelectedId").value;
      const c = state.customers.find((x) => x.id === customerId);
      if (!c) {
        showToast(state.t("alertSelectCustomer"), "error");
        return;
      }
      customerName = c.name;
    }

    const subtotal = state.cart.reduce((sum, c) => sum + calcLineTotal(c), 0);
    const discountInput = document.getElementById("cartDiscount");
    const discount = Math.min(Number(discountInput.value) || 0, subtotal);
    const total = Math.max(0, subtotal - discount);

    let totalCost = 0;
    const saleItems = state.cart.map((c) => {
      const p = state.products.find((x) => x.id === c.productId);
      const costPrice = p ? p.costPrice || 0 : 0;
      totalCost += costPrice * c.qty;
      const effectivePrice = c.qty > 0 ? calcLineTotal(c) / c.qty : c.price;
      return { name: c.name, qty: c.qty, price: effectivePrice, unit: c.unit || "adet", costPrice };
    });
    const profit = total - totalCost;

    state.cart.forEach((item) => {
      const p = state.products.find((x) => x.id === item.productId);
      if (p) {
        p.qty = Math.max(0, p.qty - item.qty);
        updateOutOfStockTracking(p);
      }
    });

    const newSale = {
      id: genId(),
      timestamp: new Date().toISOString(),
      items: saleItems,
      subtotal,
      discount,
      total,
      cost: totalCost,
      profit,
      paymentType: state.selectedPaymentType,
      customerId,
      customerName
    };
    state.sales.push(newSale);
    attemptSendToFiscalProvider(newSale);
    logAudit("Satış tamamlandı", `${formatTL(total)} (${saleItems.length} ürün)`);

    state.cart = [];
    discountInput.value = "0";
    clearVeresiyeCustomerSelection();
    setPaymentType("nakit");
    save();
    renderAll();
    showToast(`${state.t("alertSaleComplete")} ${formatTL(total)}${customerName ? " (" + state.t("veresiyeLabel") + ": " + customerName + ")" : ""}`, "success");
  }

export function completeSale() {
    measurePerf("completeSale", completeSaleImpl);
  }

export function openQuickBarcodeScan(targetInputId) {
    state.quickScanTargetInputId = targetInputId;
    document.getElementById("barcodeScanModal").style.display = "flex";
    const readerEl = document.getElementById("quickScanReader");
    readerEl.innerHTML = "";
    state.quickScanCode = new Html5Qrcode("quickScanReader");
    state.quickScanCode
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          const input = document.getElementById(state.quickScanTargetInputId);
          if (input) input.value = decodedText;
          closeQuickBarcodeScan();
          lookupBarcodeAndFill(decodedText, state.quickScanTargetInputId);
        },
        () => {}
      )
      .catch((err) => {
        showToast(state.t("cameraError"), "error");
        closeQuickBarcodeScan();
      });
  }

export function closeQuickBarcodeScan() {
    document.getElementById("barcodeScanModal").style.display = "none";
    if (state.quickScanCode) {
      state.quickScanCode
        .stop()
        .then(() => state.quickScanCode.clear())
        .catch(() => {});
      state.quickScanCode = null;
    }
  }

export function lookupBarcodeAndFill(barcode, targetInputId) {
    const isNewForm = targetInputId === "newBarcode";
    const nameInput = document.getElementById(isNewForm ? "newName" : "editName");
    const categoryInput = document.getElementById(isNewForm ? "newCategory" : "editCategory");

    fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,categories_tags`)
      .then((r) => r.json())
      .then((data) => {
        if (!data || data.status !== 1 || !data.product) return;
        const p = data.product;
        const brand = (p.brands || "").split(",")[0].trim();
        const productName = p.product_name || "";
        const fullName = [brand, productName].filter(Boolean).join(" ").trim();
        if (fullName && !nameInput.value.trim()) {
          nameInput.value = fullName;
        }
        if (p.categories_tags && p.categories_tags.length && !categoryInput.value.trim()) {
          const rawCat = p.categories_tags[p.categories_tags.length - 1] || "";
          categoryInput.value = rawCat.replace(/^\w\w:/, "").replace(/-/g, " ");
        }
      })
      .catch(() => {});
  }

export function searchBarcodeByName(productName) {
    if (!productName || !productName.trim()) return Promise.resolve(null);
    const query = encodeURIComponent(productName.trim());
    return fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&json=true&page_size=5`)
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.products || !data.products.length) return null;
        const normalized = productName.trim().toLowerCase();
        // İsmi en yakın eşleşen sonucu bul (tam ya da kısmi eşleşme)
        const match =
          data.products.find((p) => (p.product_name || "").toLowerCase().trim() === normalized) ||
          data.products.find((p) => (p.product_name || "").toLowerCase().includes(normalized) || normalized.includes((p.product_name || "").toLowerCase()));
        return match && match.code ? match.code : null;
      })
      .catch(() => null);
  }

export function findBarcodesOnlineForCandidates(candidates, onUpdate) {
    // Dakikada 10 istek sınırı olduğu için sırayla, aralıklarla deniyoruz.
    let index = 0;
    function next() {
      if (index >= candidates.length) return;
      const candidate = candidates[index];
      index++;
      if (candidate.barcode) {
        setTimeout(next, 300);
        return;
      }
      searchBarcodeByName(candidate.name).then((code) => {
        if (code) {
          candidate.barcode = code;
          candidate.barcodeFromWeb = true;
          onUpdate();
        }
        setTimeout(next, 700);
      });
    }
    next();
  }