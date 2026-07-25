// Yönetim paneli için Cloudflare Worker adresi. Bu adresin görünmesi
// güvenlik riski oluşturmaz — gerçek yetkilendirme, giriş yapan kişinin
// Firebase kimliğiyle (yönetici UID'i) doğrulanıyor, sabit bir "gizli
// anahtar" burada YOK.
//
// Kurulum adımları README.md'de anlatılıyor.

const adminConfig = {
  workerUrl: "BURAYA_ADMIN_WORKER_URL"
};
