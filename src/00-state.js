/**
 * 00-state.js
 * Uygulamanın tüm paylaşılan durumu (state). Tüm modüller bu değişkenleri okuyup yazabilir çünkü hepsi aynı IIFE kapsamı içinde derleniyor.
 */

const t = (key) => window.i18n.t(key);

const STORAGE_KEY = "bakkal_urunler_v2";

let products = [];

let sales = [];

let customers = [];

let payments = [];

let breadLog = [];

let dailyResetConfig = [];

let breadWhatsAppNumber = "";

let priceChangeLog = [];

let fiscalEnabled = false;

let fiscalProvider = "foriba";

let fiscalApiKey = "";

let fiscalEndpoint = "";

let fiscalVkn = "";

let suppliers = [];

let supplierTransactions = [];

let returns = [];

let activeReturnSaleId = null;

let activeSupplierId = null;

let accountType = "standalone";

let auditLog = [];

let staffMembers = [];

let currentStaff = null;

let ownerPin = "";

let masterCatalog = [];

let cart = [];

let activeProductId = null;

let activeCustomerId = null;

let selectedPaymentType = "nakit";

let currentSalesPeriod = "today";

let html5QrCode = null;

let scanning = false;

let html5QrCodeKasa = null;

let scanningKasa = false;

let stokScanCooldown = false;

let kasaScanCooldown = false;

let db = null;

let auth = null;

let docRef = null;

let cloudEnabled = false;

let suppressNextSnapshot = false;

let firestoreUnsubscribe = null;

let currentUser = null;

const ADMIN_UID = "NaVl26qq6kXas90Qm9e2kCZDaIp2";

let staffPickerPendingSelection = null;

let selectedVeresiyeCustomerId = null;

let originalDocRef = null;

let viewingBranchUid = null;

let loadedBranches = [];

let editingBranchUid = null;

const STATUS_CLASS = { tukendi: "status-tukendi", kritik: "status-kritik", yeterli: "status-yeterli" };

const TOAST_ICONS = {
    success: "fa-solid fa-circle-check",
    error: "fa-solid fa-circle-exclamation",
    info: "fa-solid fa-circle-info"
  };

let activeRecognition = null;

let pendingVoiceAction = null;

const TURKISH_NUMBER_WORDS = {
    bir: 1, iki: 2, üç: 3, uc: 3, dört: 4, dort: 4, beş: 5, bes: 5,
    altı: 6, alti: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10
  };

const VOICE_STOPWORDS = [
    "sat", "satıyorum", "satiyorum", "sattım", "sattim", "ekle", "ekliyorum", "ekledim",
    "al", "alıyorum", "aliyorum", "tane", "adet", "lütfen", "lutfen"
  ];

let translationInFlight = false;

let beepAudioCtx = null;

let quickScanCode = null;

let quickScanTargetInputId = null;

let bulkScanCandidates = [];

let invoiceScanCandidates = [];

let orderEngineSuggestionsCache = [];

let onboardingSlideIndex = 0;

const ONBOARDING_SLIDE_COUNT = 4;

const requestedTab = new URLSearchParams(window.location.search).get("tab");
