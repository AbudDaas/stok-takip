/**
 * 18-settings-backup.js
 * Ayarlar: tema, menü konumu, yazı boyutu, basit mod, otomatik/manuel veri yedekleme, geri bildirim gönderme.
 */

function sendFeedback() {
    const textEl = document.getElementById("feedbackText");
    const message = textEl.value.trim();
    if (!message) {
      showToast(t("feedbackEmptyError"), "error");
      return;
    }
    if (!isChainConfigured()) {
      showToast(t("feedbackNotConfigured"), "error");
      return;
    }
    currentUser
      .getIdToken()
      .then((idToken) =>
        fetch(`${chainConfig.workerUrl}/submit-feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, message })
        })
      )
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          showToast(data.error, "error");
          return;
        }
        textEl.value = "";
        showToast(t("feedbackSentSuccess"), "success");
      })
      .catch((e) => {
        console.error(e);
        showToast(t("feedbackSendError"), "error");
      });
  }

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const lightBtn = document.getElementById("themeLightBtn");
    const darkBtn = document.getElementById("themeDarkBtn");
    if (lightBtn) lightBtn.classList.toggle("active", theme === "light");
    if (darkBtn) darkBtn.classList.toggle("active", theme === "dark");
    try {
      localStorage.setItem("bakkal_theme", theme);
    } catch (e) {}
  }

function applyNavPosition(position) {
    document.body.classList.toggle("nav-side", position === "side");
    const bottomBtn = document.getElementById("navBottomBtn");
    const sideBtn = document.getElementById("navSideBtn");
    if (bottomBtn) bottomBtn.classList.toggle("active", position === "bottom");
    if (sideBtn) sideBtn.classList.toggle("active", position === "side");
    try {
      localStorage.setItem("bakkal_nav_position", position);
    } catch (e) {}
  }

function applyFontSize(size) {
    document.body.classList.toggle("font-large", size === "large");
    const normalBtn = document.getElementById("fontNormalBtn");
    const largeBtn = document.getElementById("fontLargeBtn");
    if (normalBtn) normalBtn.classList.toggle("active", size === "normal");
    if (largeBtn) largeBtn.classList.toggle("active", size === "large");
    try {
      localStorage.setItem("bakkal_font_size", size);
    } catch (e) {}
  }

function applySimpleMode(mode) {
    const simpleBtn = document.getElementById("simpleModeBtn");
    const advancedBtn = document.getElementById("advancedModeBtn");
    if (simpleBtn) simpleBtn.classList.toggle("active", mode === "simple");
    if (advancedBtn) advancedBtn.classList.toggle("active", mode === "advanced");
    try {
      localStorage.setItem("bakkal_simple_mode", mode);
    } catch (e) {}

    const advancedOnlyTabs = ["tab-scan", "tab-orders", "tab-pricechanges", "tab-ai", "tab-suppliers"];
    advancedOnlyTabs.forEach((tabId) => {
      const btn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
      if (btn) btn.style.display = mode === "simple" ? "none" : "flex";
    });
  }

function reapplySimpleModeIfSet() {
    let mode = "advanced";
    try {
      mode = localStorage.getItem("bakkal_simple_mode") || "advanced";
    } catch (e) {}
    applySimpleMode(mode);
  }

function renderDataSize() {
    const fillEl = document.getElementById("dataSizeBarFill");
    const labelEl = document.getElementById("dataSizeLabel");
    if (!fillEl) return;

    const dataObj = {
      products,
      sales,
      customers,
      payments,
      dailyResetConfig,
      breadLog,
      priceChangeLog,
      auditLog,
      staffMembers,
      suppliers,
      supplierTransactions,
      returns
    };
    const sizeBytes = new Blob([JSON.stringify(dataObj)]).size;
    const sizeKB = Math.round(sizeBytes / 1024);
    const limitKB = 1024;
    const percent = Math.min(100, Math.round((sizeKB / limitKB) * 100));

    fillEl.style.width = percent + "%";
    fillEl.classList.toggle("data-size-warn", percent >= 60 && percent < 85);
    fillEl.classList.toggle("data-size-danger", percent >= 85);

    labelEl.textContent = `${sizeKB} KB / ${limitKB} KB (%${percent})`;
  }

function maybeCreateDailyBackup() {
    if (viewingBranchUid) return; // bir şubeyi görüntülerken yedek almıyoruz, sadece kendi hesabında
    if (!products.length && !sales.length) return; // gerçekten veri yoksa boş bir yedek almaya gerek yok
    if (!docRef) return;

    const todayKey = new Date().toISOString().slice(0, 10);
    let lastBackupDate = null;
    const storageKey = "bakkal_last_auto_backup_" + (currentUser ? currentUser.uid : "");
    try {
      lastBackupDate = localStorage.getItem(storageKey);
    } catch (e) {}
    if (lastBackupDate === todayKey) return; // bu cihazda bugün zaten yedek alındı

    const backupData = {
      products,
      sales,
      customers,
      payments,
      dailyResetConfig,
      breadLog,
      priceChangeLog,
      auditLog,
      staffMembers,
      suppliers,
      supplierTransactions,
      returns,
      savedAt: new Date().toISOString()
    };

    docRef
      .collection("backups")
      .doc(todayKey)
      .set(backupData)
      .then(() => {
        try {
          localStorage.setItem(storageKey, todayKey);
        } catch (e) {}
      })
      .catch((e) => console.error("Otomatik yedek oluşturulamadı", e));
  }

function loadAutoBackups() {
    if (!docRef) return;
    docRef
      .collection("backups")
      .get()
      .then((snap) => {
        const backups = [];
        snap.forEach((doc) => backups.push({ id: doc.id, ...doc.data() }));
        renderAutoBackups(backups);
      })
      .catch((e) => {
        console.error("Yedekler okunamadı", e);
        renderAutoBackups([]);
      });
  }

function renderAutoBackups(backups) {
    const listEl = document.getElementById("autoBackupList");
    const emptyEl = document.getElementById("autoBackupEmptyState");
    if (!listEl) return;

    if (!backups.length) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      return;
    }
    emptyEl.style.display = "none";

    const sorted = backups.sort((a, b) => (a.id < b.id ? 1 : -1));
    listEl.innerHTML = sorted
      .map((b) => {
        const productCount = (b.products || []).length;
        return `
          <div class="branch-row">
            <div class="branch-info">
              <p class="branch-name">${escapeHtml(b.id)}</p>
              <p class="branch-meta">${productCount} ürün</p>
            </div>
            <button class="branch-view-btn" data-id="${b.id}">${t("autoBackupRestoreBtn")}</button>
          </div>`;
      })
      .join("");

    listEl.querySelectorAll(".branch-view-btn").forEach((btn) => {
      btn.addEventListener("click", () => restoreFromAutoBackup(btn.dataset.id, backups));
    });
  }

function restoreFromAutoBackup(backupId, backups) {
    const backup = backups.find((b) => b.id === backupId);
    if (!backup) return;
    if (!confirm(`${t("autoBackupConfirmRestore")} (${backupId})`)) return;

    products = backup.products || [];
    sales = backup.sales || [];
    customers = backup.customers || [];
    payments = backup.payments || [];
    dailyResetConfig = backup.dailyResetConfig || [];
    breadLog = backup.breadLog || [];
    priceChangeLog = backup.priceChangeLog || [];
    auditLog = backup.auditLog || [];
    staffMembers = backup.staffMembers || [];
    suppliers = backup.suppliers || [];
    supplierTransactions = backup.supplierTransactions || [];
    returns = backup.returns || [];

    logAudit("Yedekten geri yüklendi", backupId);
    save();
    renderAll();
    showToast(t("autoBackupRestoreSuccess"), "success");
  }

function downloadBackup() {
    const backup = {
      exportedAt: new Date().toISOString(),
      products,
      sales,
      customers,
      payments,
      dailyResetConfig,
      breadLog,
      priceChangeLog
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `bakkal-yedek-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t("settingsBackupSuccess"), "success");
  }

function initSettings() {
    let theme = "light";
    let navPosition = "bottom";
    let fontSize = "normal";
    let simpleMode = "advanced";
    try {
      theme = localStorage.getItem("bakkal_theme") || "light";
      navPosition = localStorage.getItem("bakkal_nav_position") || "bottom";
      fontSize = localStorage.getItem("bakkal_font_size") || "normal";
      simpleMode = localStorage.getItem("bakkal_simple_mode") || "advanced";
    } catch (e) {}
    applyTheme(theme);
    applyNavPosition(navPosition);
    applyFontSize(fontSize);
    applySimpleMode(simpleMode);
  }
