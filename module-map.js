// Her fonksiyonun hangi özellik dosyasına ait olduğunu belirleyen harita.
// Burada YER ALMAYAN fonksiyonlar otomatik olarak "99-main.js" içine,
// orijinal sırasıyla (event wiring / başlatma kodu) yerleştirilir.

module.exports = {
  "01-firebase-core.js": [
    "locale", "initFirebaseIfConfigured", "showApp", "handleAuthChange",
    "attachFirestoreListener", "setSyncStatus", "showAuthError", "mapAuthError",
    "submitAuth", "forgotPassword", "logout", "load", "save",
    "registerBackgroundSync", "registerPeriodicSync", "seedData",
    "hasImportableLocalBackup", "importLocalBackup"
  ],

  "02-utils.js": [
    "genId", "mkProduct", "mkCustomer", "escapeHtml", "showToast", "showPrompt",
    "formatQty", "formatTL", "getStatus", "getStatusLabel", "calcSellingPrice",
    "isBulkScanConfigured", "isPushConfigured", "isAdminConfigured", "isChainConfigured",
    "fileToBase64", "sleep_"
  ],

  "03-staff-roles.js": [
    "logAudit", "renderAuditLog", "saveOwnerPin", "renderOwnerPinStatus",
    "renderStaffList", "addStaffMember", "checkStaffSelection", "showStaffPicker",
    "openStaffPinView", "staffPickerGoBack", "submitStaffPickerPin", "enterAsOwner",
    "grantOwnerAccess", "applyRoleRestrictionsUI", "updateSwitchUserButtonVisibility",
    "switchUser", "applyAccountTypeUI"
  ],

  "04-fiscal.js": [
    "toggleFiscalEnabled", "saveFiscalSettings", "renderFiscalSettings",
    "attemptSendToFiscalProvider"
  ],

  "05-products.js": [
    "findProductByExactName", "addProduct", "deleteProduct", "updateOutOfStockTracking",
    "adjustQty", "setQtyManually", "saveEdit", "resetAll", "getDisplayName",
    "translateMissingProductNames", "productRowHtml", "productAlreadyExists",
    "findExistingProductByName", "findProductByFuzzyName", "openModal",
    "updateModalContent", "closeModal", "renderQrCode", "printQr", "printAllQrCodes",
    "findProductByScan", "importProductsFromRows", "importProductsFromCsv",
    "handleCsvImportFile"
  ],

  "06-veresiye.js": [
    "mkCustomer", "addCustomer", "deleteCustomer", "saveCustomerEdit",
    "getCustomerDebt", "recordPayment", "customerRowHtml", "renderCustomers",
    "populateVeresiyeCustomerSelect", "renderVeresiyeCustomerResults",
    "selectVeresiyeCustomer", "clearVeresiyeCustomerSelection", "openCustomerModal",
    "closeCustomerModal", "renderCustomerHistory"
  ],

  "07-kasa-checkout.js": [
    "startScan", "stopScan", "onScanSuccess", "startScanKasa", "stopScanKasa",
    "playBeepSound", "onScanSuccessKasa", "showKasaScanFeedback", "manualAddToCart",
    "renderManualAddResults", "getBulkDiscountForItem", "calcLineTotal", "addToCart",
    "adjustCartQty", "editCartWeight", "removeCartItem", "clearCart", "cartRowHtml",
    "renderCart", "setPaymentType", "completeSale", "showKgOrPricePrompt",
    "openQuickBarcodeScan", "closeQuickBarcodeScan", "lookupBarcodeAndFill",
    "searchBarcodeByName", "findBarcodesOnlineForCandidates"
  ],

  "08-sales-returns.js": [
    "getReturnedQtyForItem", "openReturnModal", "closeReturnModal", "confirmReturn",
    "cancelSale", "isInPeriod", "saleRowHtml", "topProductRowHtml", "renderSales"
  ],

  "09-suppliers.js": [
    "getSupplierBalance", "renderSuppliers", "addSupplier", "openSupplierModal",
    "closeSupplierModal", "renderSupplierHistory", "addSupplierDebt",
    "addSupplierPayment", "deleteSupplier"
  ],

  "10-reminders.js": [
    "renderReminders", "sendReminderWhatsApp"
  ],

  "11-bread-orders.js": [
    "addBreadConfig", "removeBreadConfig", "renderBreadConfigList",
    "renderBreadStatus", "sendBreadWhatsApp", "cleanOldPriceChanges", "renderPriceChanges"
  ],

  "12-push-notifications.js": [
    "updateNotifButtonState", "enableNotifications", "renderShelfCheckAlert",
    "notifyShelfCheckOnce", "sendShelfCheckPush"
  ],

  "13-branches-chain.js": [
    "calcTodaySalesTotal", "loadBranches", "renderCatalogList", "saveMasterCatalog",
    "addCatalogItem", "pushCatalogToAllBranches", "renderBranchList",
    "renderBranchSummary", "createBranch", "viewBranch", "exitBranchView",
    "openBranchEditModal", "closeBranchEditModal", "saveBranchEdit",
    "confirmDeleteBranch"
  ],

  "14-admin-panel.js": [
    "loadAdminFeedback", "renderAdminFeedback", "loadAdminBusinessList",
    "renderAdminBusinessList", "loadBranchesForAdmin", "createAdminBusiness",
    "toggleAdminBusiness", "setAdminBranchLimit"
  ],

  "15-voice-commands.js": [
    "getSpeechRecognitionClass", "getVoiceLangForTarget", "getVoiceCommandLang",
    "startVoiceCommand", "speakFeedback", "tryLocalVoiceParse", "processVoiceCommand",
    "handleVoiceCommandAction", "showVoiceCommandConfirm", "hideVoiceCommandConfirm",
    "confirmVoiceAction", "startVoiceInput", "setVoiceLang"
  ],

  "16-bulk-scan-ai.js": [
    "callGeminiWithRetry", "analyzeOnePhoto", "checkForLaunchedFile",
    "checkForNoteTakingLaunch", "checkForProtocolLaunch", "checkForSharedPhoto",
    "askSharedPhotoDestination", "handleShelfPhotos", "renderBulkScanModal",
    "closeBulkScanModal", "addAllBulkScanProducts", "analyzeOneInvoicePhoto",
    "handleInvoicePhotos", "renderInvoiceScanModal",
    "closeInvoiceScanModal", "applyInvoiceScan"
  ],

  "17-ai-panel.js": [
    "renderDailyReportAndHealth", "daysUntil", "renderLostSales", "renderOrderEngine",
    "renderOrderEngineSupplierSelect", "createOrderFromEngine", "renderPriceSuggestions",
    "renderExpiryTracking", "renderAnomalyDetection", "askAiAdvisor", "renderAiPanel"
  ],

  "18-settings-backup.js": [
    "applyTheme", "applyNavPosition", "applyFontSize", "applySimpleMode",
    "reapplySimpleModeIfSet", "renderDataSize", "maybeCreateDailyBackup",
    "loadAutoBackups", "renderAutoBackups", "restoreFromAutoBackup",
    "downloadBackup", "initSettings", "sendFeedback"
  ],

  "19-onboarding.js": [
    "checkOnboarding", "showOnboardingSlide", "onboardingNext", "finishOnboarding"
  ],

  "20-navigation.js": [
    "renderAll", "switchTab"
  ]
};
