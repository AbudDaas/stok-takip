/**
 * 05-products.js
 * Ürün CRUD işlemleri, barkod/QR kodu, stok takibi, ürün detay modalı.
 */

function findProductByExactName(name) {
    const normalized = name.trim().toLowerCase();
    return products.find((p) => p.name.trim().toLowerCase() === normalized);
  }

function findProductByFuzzyName(name) {
    if (!name) return null;
    const normalized = name.trim().toLowerCase();
    let match = products.find((p) => p.name.trim().toLowerCase() === normalized);
    if (match) return match;
    match = products.find((p) => p.name.toLowerCase().includes(normalized) || normalized.includes(p.name.toLowerCase()));
    return match || null;
  }

function addProduct() {
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
    const category = catInput.value.trim() || t("categoryOtherDefault");
    const min = Number(minInput.value) || 0;
    const qty = Number(qtyInput.value) || 0;
    const price = Number(priceInput.value) || 0;
    const costPrice = Number(costPriceInput.value) || 0;
    const barcode = barcodeInput.value.trim();
    const unit = unitInput.value;

    products.push(mkProduct(name, category, qty, min, price, barcode, unit, costPrice));
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

function deleteProduct(id) {
    const p = products.find((x) => x.id === id);
    products = products.filter((x) => x.id !== id);
    if (p) logAudit("Ürün silindi", p.name);
    save();
    closeModal();
    renderAll();
  }

function updateOutOfStockTracking(p) {
    if (p.qty <= 0) {
      if (!p.wentOutOfStockAt) p.wentOutOfStockAt = new Date().toISOString();
    } else {
      p.wentOutOfStockAt = null;
    }
  }

function adjustQty(id, delta) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    p.qty = Math.max(0, Math.round((p.qty + delta) * 1000) / 1000);
    updateOutOfStockTracking(p);
    logAudit("Stok güncellendi", `${p.name}: ${delta > 0 ? "+" : ""}${delta} → ${p.qty}`);
    save();
    renderAll();
    if (activeProductId === id) updateModalContent(p);
  }

function setQtyManually(id, newQty) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    if (isNaN(newQty) || newQty < 0) {
      showToast(t("alertInvalidAmount"), "error");
      updateModalContent(p);
      return;
    }
    const oldQty = p.qty;
    p.qty = Math.round(newQty * 1000) / 1000;
    updateOutOfStockTracking(p);
    logAudit("Stok elle güncellendi", `${p.name}: ${oldQty} → ${p.qty}`);
    save();
    renderAll();
    if (activeProductId === id) updateModalContent(p);
  }

function saveEdit() {
    const p = products.find((x) => x.id === activeProductId);
    if (!p) return;
    const name = document.getElementById("editName").value.trim();
    if (!name) return;
    p.name = name;
    p.category = document.getElementById("editCategory").value.trim() || t("categoryOtherDefault");
    p.min = Number(document.getElementById("editMin").value) || 0;
    p.price = Number(document.getElementById("editPrice").value) || 0;
    p.costPrice = Number(document.getElementById("editCostPrice").value) || 0;
    p.barcode = document.getElementById("editBarcode").value.trim();
    p.unit = document.getElementById("editUnit").value;
    p.expiryDate = document.getElementById("editExpiryDate").value || null;
    p.bulkDiscountQty = Number(document.getElementById("editBulkQty").value) || 0;
    p.bulkDiscountType = document.getElementById("editBulkType").value;
    p.bulkDiscountValue = Number(document.getElementById("editBulkValue").value) || 0;
    logAudit("Ürün düzenlendi", `${name} (${formatTL(p.price)})`);
    save();
    renderAll();
    updateModalContent(p);
  }

function resetAll() {
    products.forEach((p) => {
      p.qty = Math.max(p.min, 1);
    });
    save();
    renderAll();
  }

function getDisplayName(p) {
    const lang = window.i18n.getLang();
    if ((lang === "en" || lang === "ar") && p.nameTranslations && p.nameTranslations[lang]) {
      return p.nameTranslations[lang];
    }
    return p.name;
  }

function translateMissingProductNames() {
    const lang = window.i18n.getLang();
    if (lang !== "en" && lang !== "ar") return;
    if (translationInFlight) return;

    const missing = products.filter((p) => !p.nameTranslations || !p.nameTranslations[lang]).slice(0, 60);
    if (!missing.length) return;

    translationInFlight = true;

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
        translationInFlight = false;
      });
  }

function productRowHtml(p) {
    const status = getStatus(p);
    const priceLabel = p.unit === "kg" ? formatTL(p.price) + t("perKgSuffix") : formatTL(p.price);
    return `
      <div class="product-row" data-id="${p.id}">
        <div class="product-info">
          <p class="product-name">${escapeHtml(getDisplayName(p))}</p>
          <p class="product-meta">${escapeHtml(p.category)} · ${t("stockShortLabel")}: ${formatQty(p)} · ${priceLabel}</p>
        </div>
        <span class="status-badge ${STATUS_CLASS[status]}">${getStatusLabel(status)}</span>
      </div>`;
  }

function openModal(id) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    activeProductId = id;
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
    updateModalContent(p);
    document.getElementById("detailModal").style.display = "flex";
    renderQrCode(p.id);
  }

function updateModalContent(p) {
    document.getElementById("modalProductName").textContent = p.name;
    const qtyInput = document.getElementById("modalQtyInput");
    if (document.activeElement !== qtyInput) {
      qtyInput.value = p.qty;
    }
    const status = getStatus(p);
    const pill = document.getElementById("modalStatus");
    pill.textContent = getStatusLabel(status);
    pill.className = "status-pill " + STATUS_CLASS[status];
  }

function closeModal() {
    document.getElementById("detailModal").style.display = "none";
    activeProductId = null;
  }

function renderQrCode(productId) {
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
      box.textContent = t("qrLibError");
    }
  }

function printQr() {
    const box = document.getElementById("modalQrCode");
    const p = products.find((x) => x.id === activeProductId);
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>${t("printWindowTitle")}</title></head>
      <body style="text-align:center;font-family:sans-serif;padding:40px;">
        <h3>${escapeHtml(p ? p.name : "")}</h3>
        ${box.innerHTML}
        <script>window.onload = function(){ window.print(); }<\/script>
      </body></html>
    `);
    win.document.close();
  }

function printAllQrCodes() {
    if (!products.length) {
      showToast(t("emptyProducts"), "info");
      return;
    }

    // Her ürün için geçici, ekranda görünmeyen bir QR kodu üret
    const tempContainer = document.createElement("div");
    tempContainer.style.display = "none";
    document.body.appendChild(tempContainer);

    const blocksHtml = products
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
        const unitSuffix = p.unit === "kg" ? `<span class="price-tag-unit">/${t("unitKgShort")}</span>` : "";

        return `
          <div class="price-tag">
            <p class="price-tag-header">${escapeHtml(t("appName"))}</p>
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
          <title>${t("printAllQrBtn")}</title>
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

function findProductByScan(code) {
    return products.find((p) => p.id === code || (p.barcode && p.barcode === code));
  }

function productAlreadyExists(name) {
    const normalized = name.trim().toLowerCase();
    return products.some((p) => p.name.trim().toLowerCase() === normalized);
  }

function importProductsFromRows(rows) {
    if (!rows.length) return;

    const firstCells = rows[0].map((c) => String(c || "").trim().toLowerCase());
    const hasHeader = firstCells.includes("name") || firstCells.includes("ürün adı") || firstCells.includes("urun adi");
    const dataRows = hasHeader ? rows.slice(1) : rows;

    let addedCount = 0;
    dataRows.forEach((cols) => {
      const name = String(cols[0] || "").trim();
      if (!name) return;
      const category = String(cols[1] || "").trim() || t("categoryOtherDefault");
      const qty = Number(cols[2]) || 0;
      const price = Number(cols[3]) || 0;
      if (productAlreadyExists(name)) return;
      products.push(mkProduct(name, category, qty, 5, price, "", "adet", 0));
      addedCount++;
    });

    if (addedCount > 0) {
      save();
      renderAll();
      showToast(t("bulkAddedAlert").replace("{n}", addedCount), "success");
    } else {
      showToast(t("invoiceScanNoItems"), "info");
    }
  }

function importProductsFromCsv(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const rows = lines.map((line) => line.split(",").map((c) => c.trim()));
    importProductsFromRows(rows);
  }

function handleCsvImportFile(file) {
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

function findExistingProductByName(name) {
    const normalized = (name || "").trim().toLowerCase();
    if (!normalized) return null;
    let match = products.find((p) => p.name.trim().toLowerCase() === normalized);
    if (match) return match;
    // Tam eşleşme yoksa, birbirini içeren isimlerle gevşek eşleştirme dene
    match = products.find(
      (p) => p.name.trim().toLowerCase().includes(normalized) || normalized.includes(p.name.trim().toLowerCase())
    );
    return match || null;
  }
