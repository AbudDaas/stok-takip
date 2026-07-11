// "Rafı fotoğrafla (toplu ekle)" özelliği için Cloud Function bağlantı ayarları.
// README.md içindeki "Toplu ürün tarama (AI) kurulumu" bölümünde adım adım anlatılıyor.
//
// Doldurmadan bırakırsan bu özellik sessizce çalışmaz, uygulamanın geri kalanı
// sorunsuz çalışmaya devam eder.

const bulkScanConfig = {
  endpoint: "BURAYA_CLOUD_FUNCTION_URL",
  secret: "BURAYA_PAYLAŞILAN_ANAHTAR"
};
