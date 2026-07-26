import { state } from './00-state.js';
import { save } from './01-firebase-core.js';
import { escapeHtml, formatQty, formatTL, getStatus, getStatusLabel, mkProduct, showToast } from './02-utils.js';
import { logAudit } from './03-staff-roles.js';
import { callGeminiWithRetry } from './16-bulk-scan-ai.js';
import { renderAll } from './20-navigation.js';

export function findProductByExactName(name) {
    const normalized = name.trim().toLowerCase();
    return state.products.find((p) => p.name.trim().toLowerCase() === normalized);
  }

export function findProductByFuzzyName(name) {
    if (!name) return null;
    const normalized = name.trim().toLowerCase();
    let match = state.products.find((p) => p.name.trim().toLowerCase() === normalized);
    if (match) return match;
    match = state.products.find((p) => p.name.toLowerCase().includes(normalized) || normalized.includes(p.name.toLowerCase()));
    return match || null;
  }

export function addProduct() {
    const nameInput = document.getElementById("newName");
    const catInput = document.getElementById("newCategory");
    const minInput = document.getElementById("newMin");
    const qtyInput = document.getElementById("newQty");
    const priceInput = document.getElementById("newPrice");
    const costPriceInput = document.getElementById("newCostPrice");
    const barcodeInput = document.getElementById("newBarcode");
    const unitInput = document.getElementById("newUnit");

    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }
    const category = catInput.value.trim() || state.t("categoryOtherDefault");
    const min = Number(minInput.value) || 0;
    const qty = Number(qtyInput.value) || 0;
    const price = Number(priceInput.value) || 0;
    const costPrice = Number(costPriceInput.value) || 0;
    const barcode = barcodeInput.value.trim();
    const unit = unitInput.value;

    state.products.push(mkProduct(name, category, qty, min, price, barcode, unit, costPrice));
    logAudit("Ürün eklendi", `${name} (${qty} adet, ${formatTL(price)})`);
    nameInput.value = "";
    catInput.value = "";
    minInput.value = "5";
    qtyInput.value = "0";
    priceInput.value = "0";
    costPriceInput.value = "0";
    barcodeInput.value = "";
    unitInput.value = "adet";
    save();
    renderAll();
    nameInput.focus();
  }

export function deleteProduct(id) {
    const p = state.products.find((x) => x.id === id);
    state.products = state.products.filter((x) => x.id !== id);
    if (p) logAudit("Ürün silindi", p.name);
    save();
    closeModal();
    renderAll();
  }

export function updateOutOfStockTracking(p) {
    if (p.qty <= 0) {
      if (!p.wentOutOfStockAt) p.wentOutOfStockAt = new Date().toISOString();
    } else {
      p.wentOutOfStockAt = null;
    }
  }

export function adjustQty(id, delta) {
    const p = state.products.find((x) => x.id === id);
    if (!p) return;
    p.qty = Math.max(0, Math.round((p.qty + delta) * 1000) / 1000);
    updateOutOfStockTracking(p);
    logAudit("Stok güncellendi", `${p.name}: ${delta > 0 ? "+" : ""}${delta} → ${p.qty}`);
    save();
    renderAll();
    if (state.activeProductId === id) updateModalContent(p);
  }

export function setQtyManually(id, newQty) {
    const p = state.products.find((x) => x.id === id);
    if (!p) return;
    if (isNaN(newQty) || newQty < 0) {
      showToast(state.t("alertInvalidAmount"), "error");
      updateModalContent(p);
      return;
    }
    const oldQty = p.qty;
    p.qty = Math.round(newQty * 1000) / 1000;
    updateOutOfStockTracking(p);
    logAudit("Stok elle güncellendi", `${p.name}: ${oldQty} → ${p.qty}`);
    save();
    renderAll();
    if (state.activeProductId === id) updateModalContent(p);
  }

export function populateEditSupplierSelect(currentSupplierId) {
    const selectEl = document.getElementById("editSupplierId");
    selectEl.innerHTML =
      `<option value="">${state.t("editSupplierNone")}</option>` +
      state.suppliers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
    selectEl.value = currentSupplierId || "";
  }

export function saveEdit() {
    const p = state.products.find((x) => x.id === state.activeProductId);
    if (!p) return;
    const name = document.getElementById("editName").value.trim();
    if (!name) return;
    p.name = name;
    p.category = document.getElementById("editCategory").value.trim() || state.t("categoryOtherDefault");
    p.min = Number(document.getElementById("editMin").value) || 0;
    p.price = Number(document.getElementById("editPrice").value) || 0;
    p.costPrice = Number(document.getElementById("editCostPrice").value) || 0;
    p.barcode = document.getElementById("editBarcode").value.trim();
    p.unit = document.getElementById("editUnit").value;
    p.expiryDate = document.getElementById("editExpiryDate").value || null;
    p.bulkDiscountQty = Number(document.getElementById("editBulkQty").value) || 0;
    p.bulkDiscountType = document.getElementById("editBulkType").value;
    p.bulkDiscountValue = Number(document.getElementById("editBulkValue").value) || 0;
    p.supplierId = document.getElementById("editSupplierId").value || null;
    logAudit("Ürün düzenlendi", `${name} (${formatTL(p.price)})`);
    save();
    renderAll();
    updateModalContent(p);
  }

export function resetAll() {
    state.products.forEach((p) => {
      p.qty = Math.max(p.min, 1);
    });
    save();
    renderAll();
  }

export function getDisplayName(p) {
    const lang = window.i18n.getLang();
    if ((lang === "en" || lang === "ar") && p.nameTranslations && p.nameTranslations[lang]) {
      return p.nameTranslations[lang];
    }
    return p.name;
  }

export function translateMissingProductNames() {
    const lang = window.i18n.getLang();
    if (lang !== "en" && lang !== "ar") return;
    if (state.translationInFlight) return;

    const missing = state.products.filter((p) => !p.nameTranslations || !p.nameTranslations[lang]).slice(0, 60);
    if (!missing.length) return;

    state.translationInFlight = true;

    const langLabel = lang === "en" ? "İngilizce" : "Arapça";
    const prompt = [
      `Aşağıdaki market/bakkal ürün adlarının her birini ${langLabel}'ye çevir.`,
      "Ürün adındaki marka isimlerini olduğu gibi bırak, sadece genel kelimeleri çevir (örn. 'kepekli ekmek' -> 'whole wheat bread').",
      "SADECE geçerli bir JSON nesnesi döndür, başka hiçbir açıklama ekleme.",
      'Format: {"orijinal ad 1":"çeviri 1","orijinal ad 2":"çeviri 2"}',
      "",
      "Ürün adları:",
      JSON.stringify(missing.map((p) => p.name))
    ].join("\n");

    callGeminiWithRetry(null, prompt)
      .then((data) => {
        const rawText = data && data.candidates && data.candidates[0] && data.candidates[0].content.parts[0].text;
        if (!rawText) return;
        const cleaned = rawText.replace(/```json|```/g, "").trim();
        const translations = JSON.parse(cleaned);
        let changed = false;
        missing.forEach((p) => {
          const translated = translations[p.name];
          if (translated) {
            p.nameTranslations = p.nameTranslations || {};
            p.nameTranslations[lang] = translated;
            changed = true;
          }
        });
        if (changed) {
          save();
          renderAll();
        }
      })
      .catch((e) => console.error("Ürün adı çevirisi başarısız:", e))
      .finally(() => {
        state.translationInFlight = false;
      });
  }

export function orderListRowHtml(p) {
    const status = getStatus(p);
    const priceLabel = p.unit === "kg" ? formatTL(p.price) + state.t("perKgSuffix") : formatTL(p.price);
    const altBadge = p.needsAlternativeSource
      ? `<p class="alt-source-note">⚠️ ${state.t("altSourceBadge")}</p>`
      : "";
    const altBtnLabel = p.needsAlternativeSource ? state.t("altSourceUndoBtn") : state.t("altSourceBtn");
    return `
      <div class="product-row" data-id="${p.id}">
        <div class="product-info">
          <p class="product-name">${escapeHtml(getDisplayName(p))}</p>
          <p class="product-meta">${escapeHtml(p.category)} · ${state.t("stockShortLabel")}: ${formatQty(p)} · ${priceLabel}</p>
          ${altBadge}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
          <span class="status-badge ${state.STATUS_CLASS[status]}">${getStatusLabel(status)}</span>
          <button class="alt-source-toggle-btn" data-id="${p.id}">${altBtnLabel}</button>
        </div>
      </div>`;
  }

export function toggleNeedsAlternativeSource(productId) {
    const p = state.products.find((x) => x.id === productId);
    if (!p) return;
    p.needsAlternativeSource = !p.needsAlternativeSource;
    save();
    renderAll();
  }

export function productRowHtml(p) {
    const status = getStatus(p);
    const priceLabel = p.unit === "kg" ? formatTL(p.price) + state.t("perKgSuffix") : formatTL(p.price);
    return `
      <div class="product-row" data-id="${p.id}">
        <div class="product-info">
          <p class="product-name">${escapeHtml(getDisplayName(p))}</p>
          <p class="product-meta">${escapeHtml(p.category)} · ${state.t("stockShortLabel")}: ${formatQty(p)} · ${priceLabel}</p>
        </div>
        <span class="status-badge ${state.STATUS_CLASS[status]}">${getStatusLabel(status)}</span>
      </div>`;
  }

export function openModal(id) {
    const p = state.products.find((x) => x.id === id);
    if (!p) return;
    state.activeProductId = id;
    document.getElementById("editName").value = p.name;
    document.getElementById("editCategory").value = p.category;
    document.getElementById("editMin").value = p.min;
    document.getElementById("editPrice").value = p.price;
    document.getElementById("editCostPrice").value = p.costPrice || 0;
    document.getElementById("editBarcode").value = p.barcode || "";
    document.getElementById("editUnit").value = p.unit || "adet";
    document.getElementById("editExpiryDate").value = p.expiryDate || "";
    document.getElementById("editBulkQty").value = p.bulkDiscountQty || "";
    document.getElementById("editBulkType").value = p.bulkDiscountType || "percent";
    document.getElementById("editBulkValue").value = p.bulkDiscountValue || "";
    populateEditSupplierSelect(p.supplierId);
    renderExtraBarcodesList();
    updateModalContent(p);
    document.getElementById("detailModal").style.display = "flex";
    renderQrCode(p.id);
  }

export function renderExtraBarcodesList() {
    const listEl = document.getElementById("extraBarcodesList");
    if (!listEl) return;
    const p = state.products.find((x) => x.id === state.activeProductId);
    const codes = (p && p.extraBarcodes) || [];
    if (!codes.length) {
      listEl.innerHTML = "";
      return;
    }
    listEl.innerHTML = codes
      .map(
        (code, i) => `
        <div class="extra-barcode-row">
          <span class="extra-barcode-value">${escapeHtml(code)}</span>
          <button class="extra-barcode-remove-btn" data-index="${i}" aria-label="Sil"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>`
      )
      .join("");
    listEl.querySelectorAll(".extra-barcode-remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => removeExtraBarcode(Number(btn.dataset.index)));
    });
  }

export function addExtraBarcode() {
    const input = document.getElementById("newExtraBarcode");
    const code = input.value.trim();
    if (!code) return;
    const p = state.products.find((x) => x.id === state.activeProductId);
    if (!p) return;
    if (!Array.isArray(p.extraBarcodes)) p.extraBarcodes = [];
    if (p.extraBarcodes.includes(code) || p.barcode === code) {
      showToast(state.t("extraBarcodeDuplicate"), "error");
      return;
    }
    p.extraBarcodes.push(code);
    input.value = "";
    renderExtraBarcodesList();
  }

export function removeExtraBarcode(index) {
    const p = state.products.find((x) => x.id === state.activeProductId);
    if (!p || !Array.isArray(p.extraBarcodes)) return;
    p.extraBarcodes.splice(index, 1);
    renderExtraBarcodesList();
  }

export function updateModalContent(p) {
    document.getElementById("modalProductName").textContent = p.name;
    const qtyInput = document.getElementById("modalQtyInput");
    if (document.activeElement !== qtyInput) {
      qtyInput.value = p.qty;
    }
    const status = getStatus(p);
    const pill = document.getElementById("modalStatus");
    pill.textContent = getStatusLabel(status);
    pill.className = "status-pill " + state.STATUS_CLASS[status];
  }

export function closeModal() {
    document.getElementById("detailModal").style.display = "none";
    state.activeProductId = null;
  }

export function renderQrCode(productId) {
    const box = document.getElementById("modalQrCode");
    box.innerHTML = "";
    if (typeof QRCode !== "undefined") {
      new QRCode(box, {
        text: productId,
        width: 160,
        height: 160,
        colorDark: "#1F3864",
        colorLight: "#ffffff"
      });
    } else {
      box.textContent = state.t("qrLibError");
    }
  }

export function printQr() {
    const box = document.getElementById("modalQrCode");
    const p = state.products.find((x) => x.id === state.activeProductId);
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>${state.t("printWindowTitle")}</title></head>
      <body style="text-align:center;font-family:sans-serif;padding:40px;">
        <h3>${escapeHtml(p ? p.name : "")}</h3>
        ${box.innerHTML}
        <script>window.onload = function(){ window.print(); }<\/script>
      </body></html>
    `);
    win.document.close();
  }

export function printAllQrCodes() {
    if (!state.products.length) {
      showToast(state.t("emptyProducts"), "info");
      return;
    }

    // Her ürün için geçici, ekranda görünmeyen bir QR kodu üret
    const tempContainer = document.createElement("div");
    tempContainer.style.display = "none";
    document.body.appendChild(tempContainer);

    const blocksHtml = state.products
      .map((p) => {
        const box = document.createElement("div");
        tempContainer.appendChild(box);
        new QRCode(box, {
          text: p.id,
          width: 56,
          height: 56,
          colorDark: "#1F3864",
          colorLight: "#ffffff"
        });

        const priceValue = Number(p.price) || 0;
        const [wholePart, decimalPart] = priceValue.toFixed(2).split(".");
        const unitSuffix = p.unit === "kg" ? `<span class="price-tag-unit">/${state.t("unitKgShort")}</span>` : "";

        return `
          <div class="price-tag">
            <p class="price-tag-header">${escapeHtml(state.t("appName"))}</p>
            <p class="price-tag-name">${escapeHtml(p.name)}</p>
            <div class="price-tag-price">
              <span class="price-tag-currency">₺</span><span class="price-tag-amount">${wholePart}</span><span class="price-tag-decimals">,${decimalPart}</span>${unitSuffix}
            </div>
            <div class="price-tag-qr">${box.innerHTML}</div>
          </div>`;
      })
      .join("");

    document.body.removeChild(tempContainer);

    const win = window.open("", "_blank");
    win.document.write(`
      <html>
        <head>
          <title>${state.t("printAllQrBtn")}</title>
          <style>
            @page { margin: 12mm; }
            body{font-family:'Segoe UI',Arial,sans-serif;padding:16px;background:#fff;}
            .price-tag-grid{display:flex;flex-wrap:wrap;gap:14px;}
            .price-tag{
              width:190px;
              text-align:center;
              border:1.5px solid #1F3864;
              border-radius:12px;
              padding:12px 10px 10px;
              page-break-inside:avoid;
              position:relative;
              background:#fff;
            }
            .price-tag-header{
              font-size:8px;
              letter-spacing:1.5px;
              text-transform:uppercase;
              color:#8B96A8;
              font-weight:700;
              margin:0 0 8px;
            }
            .price-tag-name{
              font-size:14px;
              font-weight:700;
              color:#1F3864;
              margin:0 0 10px;
              min-height:36px;
              line-height:1.25;
              display:flex;
              align-items:center;
              justify-content:center;
              word-break:break-word;
            }
            .price-tag-price{
              display:flex;
              align-items:baseline;
              justify-content:center;
              gap:1px;
              margin-bottom:6px;
            }
            .price-tag-currency{font-size:20px;font-weight:700;color:#C0872E;}
            .price-tag-amount{font-size:36px;font-weight:800;color:#C0872E;line-height:1;}
            .price-tag-decimals{font-size:17px;font-weight:700;color:#C0872E;}
            .price-tag-unit{font-size:12px;font-weight:600;color:#8B96A8;margin-left:3px;}
            .price-tag-qr{
              position:absolute;
              bottom:8px;
              right:8px;
              width:42px;
              height:42px;
              opacity:0.9;
            }
            .price-tag-qr img,.price-tag-qr canvas,.price-tag-qr table{width:100% !important;height:100% !important;}
          </style>
        </head>
        <body>
          <div class="price-tag-grid">${blocksHtml}</div>
          <script>window.onload = function(){ window.print(); }<\/script>
        </body>
      </html>
    `);
    win.document.close();
  }

export function findProductByScan(code) {
    return state.products.find(
      (p) => p.id === code || (p.barcode && p.barcode === code) || (Array.isArray(p.extraBarcodes) && p.extraBarcodes.includes(code))
    );
  }

export function productAlreadyExists(name) {
    const normalized = name.trim().toLowerCase();
    return state.products.some((p) => p.name.trim().toLowerCase() === normalized);
  }

export function importProductsFromRows(rows) {
    if (!rows.length) return;

    const firstCells = rows[0].map((c) => String(c || "").trim().toLowerCase());
    const hasHeader = firstCells.includes("name") || firstCells.includes("ürün adı") || firstCells.includes("urun adi");
    const dataRows = hasHeader ? rows.slice(1) : rows;

    let addedCount = 0;
    dataRows.forEach((cols) => {
      const name = String(cols[0] || "").trim();
      if (!name) return;
      const category = String(cols[1] || "").trim() || state.t("categoryOtherDefault");
      const qty = Number(cols[2]) || 0;
      const price = Number(cols[3]) || 0;
      if (productAlreadyExists(name)) return;
      state.products.push(mkProduct(name, category, qty, 5, price, "", "adet", 0));
      addedCount++;
    });

    if (addedCount > 0) {
      save();
      renderAll();
      showToast(state.t("bulkAddedAlert").replace("{n}", addedCount), "success");
    } else {
      showToast(state.t("invoiceScanNoItems"), "info");
    }
  }

export function importProductsFromCsv(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const rows = lines.map((line) => line.split(",").map((c) => c.trim()));
    importProductsFromRows(rows);
  }

export function handleCsvImportFile(file) {
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        importProductsFromRows(rows);
      };
      reader.readAsArrayBuffer(file);
    } else {
      file.text().then((text) => importProductsFromCsv(text));
    }
  }

export function findExistingProductByName(name) {
    const normalized = (name || "").trim().toLowerCase();
    if (!normalized) return null;
    let match = state.products.find((p) => p.name.trim().toLowerCase() === normalized);
    if (match) return match;
    // Tam eşleşme yoksa, birbirini içeren isimlerle gevşek eşleştirme dene
    match = state.products.find(
      (p) => p.name.trim().toLowerCase().includes(normalized) || normalized.includes(p.name.trim().toLowerCase())
    );
    return match || null;
  }