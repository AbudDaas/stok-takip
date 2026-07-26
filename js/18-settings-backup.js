import { state } from './00-state.js';
import { save } from './01-firebase-core.js';
import { escapeHtml, isChainConfigured, showToast } from './02-utils.js';
import { logAudit } from './03-staff-roles.js';
import { renderAll } from './20-navigation.js';

export function sendFeedback() {
    const textEl = document.getElementById("feedbackText");
    const message = textEl.value.trim();
    if (!message) {
      showToast(state.t("feedbackEmptyError"), "error");
      return;
    }
    if (!isChainConfigured()) {
      showToast(state.t("feedbackNotConfigured"), "error");
      return;
    }
    state.currentUser
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
        showToast(state.t("feedbackSentSuccess"), "success");
      })
      .catch((e) => {
        console.error(e);
        showToast(state.t("feedbackSendError"), "error");
      });
  }

export function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const lightBtn = document.getElementById("themeLightBtn");
    const darkBtn = document.getElementById("themeDarkBtn");
    if (lightBtn) lightBtn.classList.toggle("active", theme === "light");
    if (darkBtn) darkBtn.classList.toggle("active", theme === "dark");
    try {
      localStorage.setItem("bakkal_theme", theme);
    } catch (e) {}
  }

export function applyNavPosition(position) {
    document.body.classList.toggle("nav-side", position === "side");
    const bottomBtn = document.getElementById("navBottomBtn");
    const sideBtn = document.getElementById("navSideBtn");
    if (bottomBtn) bottomBtn.classList.toggle("active", position === "bottom");
    if (sideBtn) sideBtn.classList.toggle("active", position === "side");
    try {
      localStorage.setItem("bakkal_nav_position", position);
    } catch (e) {}
  }

export function applyFontSize(size) {
    document.body.classList.toggle("font-large", size === "large");
    const normalBtn = document.getElementById("fontNormalBtn");
    const largeBtn = document.getElementById("fontLargeBtn");
    if (normalBtn) normalBtn.classList.toggle("active", size === "normal");
    if (largeBtn) largeBtn.classList.toggle("active", size === "large");
    try {
      localStorage.setItem("bakkal_font_size", size);
    } catch (e) {}
  }

export function applySimpleMode(mode) {
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

export function reapplySimpleModeIfSet() {
    let mode = "advanced";
    try {
      mode = localStorage.getItem("bakkal_simple_mode") || "advanced";
    } catch (e) {}
    applySimpleMode(mode);
  }

export function renderDataSize() {
    const fillEl = document.getElementById("dataSizeBarFill");
    const labelEl = document.getElementById("dataSizeLabel");
    if (!fillEl) return;

    const dataObj = {
      products: state.products,
      sales: state.sales,
      customers: state.customers,
      payments: state.payments,
      dailyResetConfig: state.dailyResetConfig,
      breadLog: state.breadLog,
      priceChangeLog: state.priceChangeLog,
      auditLog: state.auditLog,
      staffMembers: state.staffMembers,
      suppliers: state.suppliers,
      supplierTransactions: state.supplierTransactions,
      returns: state.returns
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

export function maybeCreateDailyBackup() {
    if (state.viewingBranchUid) return; // bir şubeyi görüntülerken yedek almıyoruz, sadece kendi hesabında
    if (!state.products.length && !state.sales.length) return; // gerçekten veri yoksa boş bir yedek almaya gerek yok
    if (!state.docRef) return;

    const todayKey = new Date().toISOString().slice(0, 10);
    let lastBackupDate = null;
    const storageKey = "bakkal_last_auto_backup_" + (state.currentUser ? state.currentUser.uid : "");
    try {
      lastBackupDate = localStorage.getItem(storageKey);
    } catch (e) {}
    if (lastBackupDate === todayKey) return; // bu cihazda bugün zaten yedek alındı

    const backupData = {
      products: state.products,
      sales: state.sales,
      customers: state.customers,
      payments: state.payments,
      dailyResetConfig: state.dailyResetConfig,
      breadLog: state.breadLog,
      priceChangeLog: state.priceChangeLog,
      auditLog: state.auditLog,
      staffMembers: state.staffMembers,
      suppliers: state.suppliers,
      supplierTransactions: state.supplierTransactions,
      returns: state.returns,
      savedAt: new Date().toISOString()
    };

    state.docRef
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

export function loadAutoBackups() {
    if (!state.docRef) return;
    state.docRef
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

export function renderAutoBackups(backups) {
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
            <button class="branch-view-btn" data-id="${b.id}">${state.t("autoBackupRestoreBtn")}</button>
          </div>`;
      })
      .join("");

    listEl.querySelectorAll(".branch-view-btn").forEach((btn) => {
      btn.addEventListener("click", () => restoreFromAutoBackup(btn.dataset.id, backups));
    });
  }

export function restoreFromAutoBackup(backupId, backups) {
    const backup = backups.find((b) => b.id === backupId);
    if (!backup) return;
    if (!confirm(`${state.t("autoBackupConfirmRestore")} (${backupId})`)) return;

    state.products = backup.products || [];
    state.sales = backup.sales || [];
    state.customers = backup.customers || [];
    state.payments = backup.payments || [];
    state.dailyResetConfig = backup.dailyResetConfig || [];
    state.breadLog = backup.breadLog || [];
    state.priceChangeLog = backup.priceChangeLog || [];
    state.auditLog = backup.auditLog || [];
    state.staffMembers = backup.staffMembers || [];
    state.suppliers = backup.suppliers || [];
    state.supplierTransactions = backup.supplierTransactions || [];
    state.returns = backup.returns || [];

    logAudit("Yedekten geri yüklendi", backupId);
    save();
    renderAll();
    showToast(state.t("autoBackupRestoreSuccess"), "success");
  }

export function downloadBackup() {
    const backup = {
      exportedAt: new Date().toISOString(),
      products: state.products,
      sales: state.sales,
      customers: state.customers,
      payments: state.payments,
      dailyResetConfig: state.dailyResetConfig,
      breadLog: state.breadLog,
      priceChangeLog: state.priceChangeLog
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
    showToast(state.t("settingsBackupSuccess"), "success");
  }

export function initSettings() {
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
