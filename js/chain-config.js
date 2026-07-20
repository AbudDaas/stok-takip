// "Şubelerim" özelliği için Cloudflare Worker adresi. Bu adresin görünmesi
// güvenlik riski oluşturmaz — gerçek yetkilendirme, giriş yapan kişinin
// Firebase kimliğiyle doğrulanıyor.
//
// Kurulum adımları README.md'de anlatılıyor.

const chainConfig = {
  workerUrl: "bakkal-chain-api.abdulrazakdaas0.workers.dev"
};
