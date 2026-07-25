// "Rafı fotoğrafla" ve "Fatura ile stok girişi" özellikleri için Cloudflare
// Worker adresi. Artık gerçek Gemini API anahtarı burada YOK — anahtar
// Cloudflare Worker'ın sunucu tarafında (gizli) duruyor, bu dosyada sadece
// worker'ın herkese açık adresi var. Bu adresin görünmesi güvenlik riski
// oluşturmaz.
//
// Kurulum adımları README.md'de anlatılıyor.
//
// Doldurmadan bırakırsan bu özellikler sessizce çalışmaz, uygulamanın geri
// kalanı sorunsuz çalışmaya devam eder.

const bulkScanConfig = {
  workerUrl: "BURAYA_CLOUDFLARE_WORKER_URL"
};
