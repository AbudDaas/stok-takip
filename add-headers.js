const fs = require("fs");
const path = require("path");

const descriptions = {
  "00-header.js": "Sıkı mod (strict mode) direktifi ve mümkün olduğunca erken servis çalışanı kaydı. Bu dosya HER ZAMAN derlenen çıktının en başında olmalıdır.",
  "00-state.js": "Uygulamanın tüm paylaşılan durumu (state). Tüm modüller bu değişkenleri okuyup yazabilir çünkü hepsi aynı IIFE kapsamı içinde derleniyor.",
  "01-firebase-core.js": "Firebase başlatma, kimlik doğrulama (giriş/çıkış), Firestore dinleyicisi ve temel kaydetme/yükleme mantığı.",
  "02-utils.js": "Genel amaçlı, tekrar kullanılan yardımcı fonksiyonlar: biçimlendirme, HTML kaçışı, bildirimler, temel yapılandırma kontrolleri.",
  "03-staff-roles.js": "Personel yönetimi: kasiyer/müdür rolleri, PIN girişi, sahip PIN'i, işlem geçmişi (audit log).",
  "04-fiscal.js": "Resmi mali kayıt (e-Fatura/Yazar Kasa) entegrasyonu ayarları — varsayılan olarak pasif, istenince aktif edilebilir altyapı.",
  "05-products.js": "Ürün CRUD işlemleri, barkod/QR kodu, stok takibi, ürün detay modalı, tedarikçi ataması.",
  "06-veresiye.js": "Müşteri yönetimi ve veresiye (borç) takibi.",
  "07-kasa-checkout.js": "Kasa: sepet yönetimi, barkod/QR tarama, ödeme türleri, toplu alım indirimi, satış tamamlama.",
  "08-sales-returns.js": "Satış geçmişi, satış iptali ve iade (kısmi ürün iadesi) yönetimi.",
  "09-suppliers.js": "Tedarikçi borç/ödeme takibi, önerilen marka ekleme, tedarikçiye özel sipariş listesi ve ürün atama.",
  "10-reminders.js": "Müşteri hatırlatma: WhatsApp üzerinden veresiye/uzun süredir gelmeyen müşteri mesajları.",
  "11-bread-orders.js": "Günlük ürün takibi (ekmek vb.), acil sipariş listesi ve fiyat değişimi geçmişi.",
  "12-push-notifications.js": "Push bildirimleri (Firebase Cloud Messaging) ve raf kontrol uyarısı.",
  "13-branches-chain.js": "Çok şubeli yönetim (patron/zincir sahibi hesapları): şube oluşturma/düzenleme/silme, ortak ürün kataloğu senkronizasyonu.",
  "14-admin-panel.js": "Yönetim paneli (sadece SaaS admin hesabı): işletme oluşturma, aktif/pasif yapma, şube limiti, gelen geri bildirimler.",
  "15-voice-commands.js": "Sesli komut sistemi: konuşmayı metne çevirme, basit komutları anında (yerel) işleme, karmaşık komutları yapay zekaya yönlendirme.",
  "16-bulk-scan-ai.js": "Yapay zeka destekli toplu ürün girişi: raf/fatura fotoğrafı tarama, dosya/CSV içe aktarma, paylaşım hedefi (share target).",
  "17-ai-panel.js": "AI Panel: günlük rapor, market sağlık skoru, akıllı sipariş motoru (tedarikçi filtresi dahil), kayıp satış hesaplayıcısı, akıllı fiyat önerisi, AI danışman.",
  "18-settings-backup.js": "Ayarlar: tema, menü konumu, yazı boyutu, basit mod, otomatik/manuel veri yedekleme, geri bildirim gönderme.",
  "19-onboarding.js": "İlk kullanım rehberi (tanıtım turu).",
  "20-navigation.js": "Ana render döngüsü ve sekme (tab) geçiş mantığı.",
  "99-main.js": "Olay bağlama (event wiring) ve uygulamanın başlatma sırası. Bu dosya HER ZAMAN derlenen çıktının sonunda olmalıdır — çünkü burada çağrılan tüm fonksiyonlar diğer modüllerde tanımlıdır (JavaScript'in fonksiyon 'hoisting' özelliği sayesinde bu güvenlidir)."
};

const SRC_DIR = path.join(__dirname, "src");
Object.keys(descriptions).forEach((file) => {
  const filePath = path.join(SRC_DIR, file);
  if (!fs.existsSync(filePath)) { console.log("UYARI: dosya bulunamadı:", file); return; }
  const content = fs.readFileSync(filePath, "utf8");
  const header = `/**\n * ${file}\n * ${descriptions[file]}\n */\n\n`;
  fs.writeFileSync(filePath, header + content);
});
console.log("Tüm modül dosyalarına açıklama başlıkları eklendi.");
