/**
 * 02-utils.js
 * Genel amaçlı, tekrar kullanılan yardımcı fonksiyonlar: biçimlendirme, HTML kaçışı, bildirimler, temel yapılandırma kontrolleri.
 */

function mkProduct(name, category, qty, min, price, barcode, unit, costPrice) {
    return {
      id: genId(),
      name,
      category,
      qty: Number(qty) || 0,
      min: Number(min) || 0,
      price: Number(price) || 0,
      costPrice: Number(costPrice) || 0,
      barcode: (barcode || "").trim(),
      unit: unit === "kg" ? "kg" : "adet"
    };
  }

function genId() {
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

function isPushConfigured() {
    return typeof pushConfig !== "undefined" && pushConfig.vapidKey && pushConfig.vapidKey.indexOf("BURAYA") !== 0;
  }

function isAdminConfigured() {
    return typeof adminConfig !== "undefined" && adminConfig.workerUrl && adminConfig.workerUrl.indexOf("BURAYA") !== 0;
  }

function isChainConfigured() {
    return typeof chainConfig !== "undefined" && chainConfig.workerUrl && chainConfig.workerUrl.indexOf("BURAYA") !== 0;
  }

function getStatus(p) {
    if (p.qty <= 0) return "tukendi";
    if (p.qty < p.min) return "kritik";
    return "yeterli";
  }

function getStatusLabel(status) {
    if (status === "tukendi") return t("statusTukendi");
    if (status === "kritik") return t("statusKritik");
    return t("statusYeterli");
  }

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

function showToast(message, type) {
    type = type || "info";
    const container = document.getElementById("toastContainer");
    if (!container) {
      // Toast container yoksa (beklenmedik durum), en azından bilgi kaybolmasın
      window.alert(message);
      return;
    }
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="${TOAST_ICONS[type] || TOAST_ICONS.info}" aria-hidden="true"></i>
      <span class="toast-message"></span>
      <button class="toast-close" aria-label="Kapat"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
    `;
    toast.querySelector(".toast-message").textContent = message;

    function removeToast() {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 250);
    }

    toast.querySelector(".toast-close").addEventListener("click", removeToast);
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(removeToast, 4000);
  }

function showPrompt(title, defaultValue, isPassword) {
    return new Promise((resolve) => {
      const modal = document.getElementById("promptModal");
      const titleEl = document.getElementById("promptModalTitle");
      const input = document.getElementById("promptModalInput");
      const okBtn = document.getElementById("promptModalOkBtn");
      const cancelBtn = document.getElementById("promptModalCancelBtn");

      input.type = isPassword ? "password" : "text";
      input.inputMode = isPassword ? "numeric" : "decimal";
      titleEl.textContent = title;
      input.value = defaultValue != null ? defaultValue : "";
      modal.style.display = "flex";
      setTimeout(() => {
        input.focus();
        input.select();
      }, 50);

      function cleanup(result) {
        modal.style.display = "none";
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        input.removeEventListener("keydown", onKeydown);
        modal.removeEventListener("click", onOverlayClick);
        resolve(result);
      }
      function onOk() {
        cleanup(input.value);
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

      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      input.addEventListener("keydown", onKeydown);
      modal.addEventListener("click", onOverlayClick);
    });
  }

function formatQty(p) {
    if (p.unit === "kg") {
      return (Math.round(p.qty * 1000) / 1000).toLocaleString(locale(), { minimumFractionDigits: 0, maximumFractionDigits: 3 }) + " " + t("unitKgShort");
    }
    return p.qty + " " + t("unitAdetShort");
  }

function formatTL(n) {
    return (Number(n) || 0).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
  }

function isBulkScanConfigured() {
    return typeof bulkScanConfig !== "undefined" && bulkScanConfig.workerUrl && bulkScanConfig.workerUrl.indexOf("BURAYA") !== 0;
  }

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

function sleep_(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

function calcSellingPrice(costPrice, percent) {
    const p = percent != null ? percent : 20;
    return Math.round(costPrice * (1 + p / 100) * 100) / 100;
  }
