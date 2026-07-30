import { state } from './00-state.js';
import { forgotPassword, importLocalBackup, load, logout, registerPeriodicSync, save, submitAuth } from './01-firebase-core.js';
import { showToast } from './02-utils.js';
import { addStaffMember, enterAsOwner, saveOwnerPin, staffPickerGoBack, submitStaffPickerPin, switchUser } from './03-staff-roles.js';
import { saveFiscalSettings, toggleFiscalEnabled } from './04-fiscal.js';
import { addExtraBarcode, addProduct, adjustQty, closeModal, deleteProduct, handleCsvImportFile, printAllQrCodes, printQr, printSelfSourceList, resetAll, saveEdit, setQtyManually, translateMissingProductNames } from './05-products.js';
import { addCustomer, closeCustomerModal, deleteCustomer, recordPayment, renderVeresiyeCustomerResults, saveCustomerEdit } from './06-veresiye.js';
import { clearCart, closeQuickBarcodeScan, completeSale, openQuickBarcodeScan, renderCart, renderManualAddResults, setPaymentType, startScan, startScanKasa, stopScan, stopScanKasa } from './07-kasa-checkout.js';
import { closeReturnModal, confirmReturn, renderSales } from './08-sales-returns.js';
import { addSuggestedSuppliers, addSupplier, addSupplierDebt, addSupplierPayment, assignSelectedProductsToSupplier, closeSupplierModal, deleteSupplier, printSupplierOrderList, renderSupplierProductPicker, sendSupplierOrderWhatsApp } from './09-suppliers.js';
import { addExpense } from './21-expenses.js';
import { addBreadConfig, sendBreadWhatsApp } from './11-bread-orders.js';
import { enableNotifications } from './12-push-notifications.js';
import { addCatalogItem, closeBranchEditModal, createBranch, exitBranchView, saveBranchEdit } from './13-branches-chain.js';
import { createAdminBusiness } from './14-admin-panel.js';
import { confirmVoiceAction, hideVoiceCommandConfirm, setVoiceLang, startVoiceCommand, startVoiceInput } from './15-voice-commands.js';
import { addAllBulkScanProducts, applyInvoiceScan, checkForLaunchedFile, checkForNoteTakingLaunch, checkForProtocolLaunch, checkForSharedPhoto, closeBulkScanModal, closeInvoiceScanModal, handleInvoicePhotos, handleShelfPhotos } from './16-bulk-scan-ai.js';
import { askAiAdvisor, createOrderFromEngine, printOrderEngineList, renderOrderEngine } from './17-ai-panel.js';
import { applyFontSize, applyNavPosition, applySimpleMode, applyTheme, downloadBackup, initSettings, sendFeedback } from './18-settings-backup.js';
import { finishOnboarding, onboardingNext } from './19-onboarding.js';
import { renderAll, switchTab } from './20-navigation.js';

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "BAKKAL_SYNC_RECONNECTED") {
        showToast(state.t("syncReconnected"), "success");
      }
    });
  }

document.getElementById("addBtn").addEventListener("click", addProduct);

document.querySelectorAll(".voice-mic-btn").forEach((btn) => {
    btn.addEventListener("click", () => startVoiceInput(btn.dataset.target, btn));
  });

document.querySelectorAll(".voice-lang-toggle").forEach((container) => {
    container.querySelectorAll(".voice-lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => setVoiceLang(container, btn.dataset.lang));
    });
  });

document.getElementById("newQty").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addProduct();
  });

document.getElementById("searchBox").addEventListener("input", renderAll);

document.getElementById("orderListSupplierFilter").addEventListener("change", renderAll);
document.getElementById("selfSourcePrintBtn").addEventListener("click", printSelfSourceList);

document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm(state.t("confirmResetAll"))) resetAll();
  });

document.getElementById("breadWhatsAppBtn").addEventListener("click", sendBreadWhatsApp);

document.getElementById("notifEnableBtn").addEventListener("click", enableNotifications);

document.getElementById("breadConfigAddBtn").addEventListener("click", addBreadConfig);

document.getElementById("breadWhatsAppNumber").addEventListener("change", (e) => {
    state.breadWhatsAppNumber = e.target.value.trim();
    save();
  });

document.getElementById("closeModalBtn").addEventListener("click", closeModal);

document.getElementById("detailModal").addEventListener("click", (e) => {
    if (e.target.id === "detailModal") closeModal();
  });

document.getElementById("qtyPlusBtn").addEventListener("click", () => {
    const p = state.products.find((x) => x.id === state.activeProductId);
    adjustQty(state.activeProductId, p && p.unit === "kg" ? 0.1 : 1);
  });

document.getElementById("qtyMinusBtn").addEventListener("click", () => {
    const p = state.products.find((x) => x.id === state.activeProductId);
    adjustQty(state.activeProductId, p && p.unit === "kg" ? -0.1 : -1);
  });

document.getElementById("modalQtyInput").addEventListener("change", (e) => {
    const newQty = parseFloat(String(e.target.value).replace(",", "."));
    setQtyManually(state.activeProductId, newQty);
  });

document.getElementById("saveEditBtn").addEventListener("click", saveEdit);

document.getElementById("deleteProductBtn").addEventListener("click", () => {
    if (confirm(state.t("confirmDeleteProduct"))) deleteProduct(state.activeProductId);
  });

document.getElementById("printQrBtn").addEventListener("click", printQr);

document.getElementById("printAllQrBtn").addEventListener("click", printAllQrCodes);

document.getElementById("scanNewBarcodeBtn").addEventListener("click", () => openQuickBarcodeScan("newBarcode"));
document.getElementById("scanNewExtraBarcodeBtn").addEventListener("click", () => openQuickBarcodeScan("newExtraBarcodeSingle"));
document.getElementById("scanNewCaseBarcodeBtn").addEventListener("click", () => openQuickBarcodeScan("newCaseBarcode"));

document.getElementById("scanEditBarcodeBtn").addEventListener("click", () => openQuickBarcodeScan("editBarcode"));
document.getElementById("scanExtraBarcodeBtn").addEventListener("click", () => openQuickBarcodeScan("newExtraBarcode"));
document.getElementById("scanCaseBarcodeBtn").addEventListener("click", () => openQuickBarcodeScan("editCaseBarcode"));
document.getElementById("addExtraBarcodeBtn").addEventListener("click", addExtraBarcode);
document.getElementById("newExtraBarcode").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addExtraBarcode();
});

document.getElementById("closeBarcodeModalBtn").addEventListener("click", closeQuickBarcodeScan);

document.getElementById("shelfPhotoBtn").addEventListener("click", () => {
    document.getElementById("shelfPhotoInput").click();
  });

document.getElementById("shelfPhotoInput").addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) handleShelfPhotos(files);
    e.target.value = "";
  });

document.getElementById("closeBulkScanModalBtn").addEventListener("click", closeBulkScanModal);

document.getElementById("bulkScanModal").addEventListener("click", (e) => {
    if (e.target.id === "bulkScanModal") closeBulkScanModal();
  });

document.getElementById("bulkAddAllBtn").addEventListener("click", addAllBulkScanProducts);

document.getElementById("invoicePhotoBtn").addEventListener("click", () => {
    document.getElementById("invoicePhotoInput").click();
  });

document.getElementById("csvImportBtn").addEventListener("click", () => {
    document.getElementById("csvImportInput").click();
  });

document.getElementById("csvImportInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleCsvImportFile(file);
    e.target.value = "";
  });

document.getElementById("invoicePhotoInput").addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) handleInvoicePhotos(files);
    e.target.value = "";
  });

document.getElementById("closeInvoiceScanModalBtn").addEventListener("click", closeInvoiceScanModal);

document.getElementById("invoiceScanModal").addEventListener("click", (e) => {
    if (e.target.id === "invoiceScanModal") closeInvoiceScanModal();
  });

document.getElementById("invoiceApplyBtn").addEventListener("click", applyInvoiceScan);

document.getElementById("barcodeScanModal").addEventListener("click", (e) => {
    if (e.target.id === "barcodeScanModal") closeQuickBarcodeScan();
  });

document.getElementById("startScanBtn").addEventListener("click", startScan);

document.getElementById("stopScanBtn").addEventListener("click", stopScan);

document.getElementById("manualAddSearch").addEventListener("input", renderManualAddResults);

document.getElementById("startKasaScanBtn").addEventListener("click", startScanKasa);

document.getElementById("stopKasaScanBtn").addEventListener("click", stopScanKasa);

document.getElementById("clearCartBtn").addEventListener("click", () => {
    if (!state.cart.length || confirm(state.t("confirmClearCart"))) clearCart();
  });

document.getElementById("completeSaleBtn").addEventListener("click", completeSale);

document.getElementById("cartDiscount").addEventListener("input", renderCart);

document.getElementById("payNakitBtn").addEventListener("click", () => setPaymentType("nakit"));

document.getElementById("payKartBtn").addEventListener("click", () => setPaymentType("kart"));

document.getElementById("payVeresiyeBtn").addEventListener("click", () => setPaymentType("veresiye"));

document.getElementById("veresiyeCustomerSearch").addEventListener("input", (e) => {
    state.selectedVeresiyeCustomerId = null;
    document.getElementById("veresiyeCustomerSelectedId").value = "";
    renderVeresiyeCustomerResults(e.target.value);
  });

document.getElementById("veresiyeCustomerSearch").addEventListener("focus", (e) => {
    renderVeresiyeCustomerResults(e.target.value);
  });

document.addEventListener("click", (e) => {
    const wrapper = document.getElementById("veresiyeCustomerRow");
    if (wrapper && !wrapper.contains(e.target)) {
      document.getElementById("veresiyeCustomerResults").classList.remove("show");
    }
  });

document.querySelectorAll(".period-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currentSalesPeriod = btn.dataset.period;
      document.querySelectorAll(".period-btn").forEach((b) => b.classList.toggle("active", b === btn));
      renderSales();
    });
  });

document.getElementById("addCustomerBtn").addEventListener("click", addCustomer);

document.getElementById("closeCustomerModalBtn").addEventListener("click", closeCustomerModal);

document.getElementById("customerModal").addEventListener("click", (e) => {
    if (e.target.id === "customerModal") closeCustomerModal();
  });

document.getElementById("recordPaymentBtn").addEventListener("click", recordPayment);

document.getElementById("saveCustomerEditBtn").addEventListener("click", saveCustomerEdit);

document.getElementById("deleteCustomerBtn").addEventListener("click", () => {
    if (confirm(state.t("confirmDeleteCustomer"))) deleteCustomer(state.activeCustomerId);
  });

document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

document.getElementById("authSubmitBtn").addEventListener("click", submitAuth);

document.getElementById("authPassword").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitAuth();
  });

document.getElementById("forgotPasswordBtn").addEventListener("click", forgotPassword);

document.getElementById("logoutBtn").addEventListener("click", logout);

document.getElementById("switchUserBtn").addEventListener("click", switchUser);

document.getElementById("adminCreateBtn").addEventListener("click", createAdminBusiness);

document.getElementById("importBackupBtn").addEventListener("click", importLocalBackup);

document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => window.i18n.setLang(btn.dataset.lang));
  });

window.onLangChanged = function () {
    renderAll();
    translateMissingProductNames();
  };

window.i18n.applyLang(window.i18n.getLang());

document.getElementById("themeLightBtn").addEventListener("click", () => applyTheme("light"));

document.getElementById("themeDarkBtn").addEventListener("click", () => applyTheme("dark"));

document.getElementById("navBottomBtn").addEventListener("click", () => applyNavPosition("bottom"));

document.getElementById("navSideBtn").addEventListener("click", () => applyNavPosition("side"));

document.getElementById("fontNormalBtn").addEventListener("click", () => applyFontSize("normal"));

document.getElementById("fontLargeBtn").addEventListener("click", () => applyFontSize("large"));

document.getElementById("simpleModeBtn").addEventListener("click", () => applySimpleMode("simple"));

document.getElementById("advancedModeBtn").addEventListener("click", () => applySimpleMode("advanced"));

document.getElementById("onboardingNextBtn").addEventListener("click", onboardingNext);

document.getElementById("onboardingSkipBtn").addEventListener("click", finishOnboarding);

document.getElementById("downloadBackupBtn").addEventListener("click", downloadBackup);

document.getElementById("staffAddBtn").addEventListener("click", addStaffMember);

document.getElementById("ownerPinSaveBtn").addEventListener("click", saveOwnerPin);

document.getElementById("fiscalEnabledToggle").addEventListener("change", (e) => toggleFiscalEnabled(e.target.checked));

document.getElementById("fiscalSaveBtn").addEventListener("click", saveFiscalSettings);

document.getElementById("feedbackSendBtn").addEventListener("click", sendFeedback);

document.getElementById("staffOwnerBtn").addEventListener("click", enterAsOwner);

document.getElementById("staffPickerBackBtn").addEventListener("click", staffPickerGoBack);

document.getElementById("staffPickerPinSubmitBtn").addEventListener("click", submitStaffPickerPin);

document.getElementById("staffPickerPinInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitStaffPickerPin();
  });

document.getElementById("advisorAskBtn").addEventListener("click", askAiAdvisor);

document.getElementById("branchCreateBtn").addEventListener("click", createBranch);

document.getElementById("catalogAddBtn").addEventListener("click", addCatalogItem);

document.getElementById("exitBranchViewBtn").addEventListener("click", exitBranchView);

document.getElementById("closeBranchEditModalBtn").addEventListener("click", closeBranchEditModal);

document.getElementById("supplierAddBtn").addEventListener("click", addSupplier);
document.getElementById("expenseAddBtn").addEventListener("click", addExpense);

document.getElementById("addSuggestedSuppliersBtn").addEventListener("click", addSuggestedSuppliers);

document.getElementById("closeSupplierModalBtn").addEventListener("click", closeSupplierModal);

document.getElementById("supplierModal").addEventListener("click", (e) => {
    if (e.target.id === "supplierModal") closeSupplierModal();
  });

document.getElementById("supplierAddDebtBtn").addEventListener("click", addSupplierDebt);

document.getElementById("supplierAddPaymentBtn").addEventListener("click", addSupplierPayment);

document.getElementById("supplierOrderSendBtn").addEventListener("click", sendSupplierOrderWhatsApp);
document.getElementById("supplierOrderPrintBtn").addEventListener("click", printSupplierOrderList);

document.getElementById("supplierProductSearch").addEventListener("input", renderSupplierProductPicker);

document.getElementById("supplierAssignProductsBtn").addEventListener("click", assignSelectedProductsToSupplier);

document.getElementById("deleteSupplierBtn").addEventListener("click", deleteSupplier);

document.getElementById("closeReturnModalBtn").addEventListener("click", closeReturnModal);

document.getElementById("returnModal").addEventListener("click", (e) => {
    if (e.target.id === "returnModal") closeReturnModal();
  });

document.getElementById("confirmReturnBtn").addEventListener("click", confirmReturn);

document.getElementById("voiceCommandBtn").addEventListener("click", startVoiceCommand);

document.getElementById("voiceCommandConfirmYes").addEventListener("click", confirmVoiceAction);

document.getElementById("voiceCommandConfirmNo").addEventListener("click", hideVoiceCommandConfirm);

document.getElementById("orderEngineCreateBtn").addEventListener("click", createOrderFromEngine);
document.getElementById("orderEnginePrintBtn").addEventListener("click", printOrderEngineList);

document.getElementById("orderEngineFilterSelect").addEventListener("change", renderOrderEngine);

document.getElementById("branchEditModal").addEventListener("click", (e) => {
    if (e.target.id === "branchEditModal") closeBranchEditModal();
  });

document.getElementById("branchEditSaveBtn").addEventListener("click", saveBranchEdit);

initSettings();

if (state.requestedTab && document.getElementById(state.requestedTab)) {
    switchTab(state.requestedTab);
  }

checkForSharedPhoto();

checkForLaunchedFile();

checkForProtocolLaunch();

checkForNoteTakingLaunch();

registerPeriodicSync();

load();