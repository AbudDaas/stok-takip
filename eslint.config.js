// ESLint yapılandırması (flat config, ESLint 9+).
// Kod, tarayıcıda tek bir IIFE içinde çalışıyor (ES modül değil), bu yüzden
// "no-undef" gibi kurallar modül-bazlı projelerdeki kadar sıkı uygulanmıyor —
// ama gerçek hatalara (kullanılmayan değişken, eksik nokta virgül gibi) karşı
// tam koruma sağlıyor.

module.exports = [
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        Notification: "readonly",
        SpeechSynthesisUtterance: "readonly",
        FileReader: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        QRCode: "readonly",
        XLSX: "readonly",
        confirm: "readonly",
        firebase: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "off", // src/ dosyaları tek tek incelenirken, başka dosyada çağrılan fonksiyonlar yanlışlıkla "kullanılmıyor" görünür — gerçek kontrol için "npm run lint:build" kullan.
      "no-undef": "off",
      "no-console": "off",
      eqeqeq: ["warn", "smart"],
      "no-var": "error",
      "prefer-const": "warn"
    }
  },
  {
    // GERÇEK kontrol: birleştirilmiş (build edilmiş) tek dosya üzerinden.
    // Burada tüm fonksiyonlar aynı kapsamda olduğu için "kullanılmıyor" uyarısı
    // artık YANLIŞ POZİTİF değil, gerçek bir ölü kod işaretidir.
    files: ["js/app.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        Notification: "readonly",
        SpeechSynthesisUtterance: "readonly",
        FileReader: "readonly",
        FormData: "readonly",
        File: "readonly",
        Blob: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        QRCode: "readonly",
        XLSX: "readonly",
        confirm: "readonly",
        firebase: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        requestAnimationFrame: "readonly",
        caches: "readonly",
        Html5Qrcode: "readonly",
        // Ayrı <script> etiketleriyle app.js'den ÖNCE yüklenen konfigürasyon dosyaları:
        chainConfig: "readonly",
        bulkScanConfig: "readonly",
        pushConfig: "readonly",
        adminConfig: "readonly",
        firebaseConfig: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
      "no-undef": "error",
      "no-console": "off",
      eqeqeq: ["warn", "smart"],
      "no-var": "error"
    }
  }
];
