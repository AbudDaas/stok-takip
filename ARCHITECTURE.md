# Mimari (Architecture)

Bu döküman, kodun nasıl organize edildiğini ve bir geliştiricinin bu projede
nasıl çalışması gerektiğini açıklar.

## Genel Yapı

```
bakkal-app/
├── index.html              ← Ana HTML dosyası (değişmedi)
├── css/style.css           ← Stiller (değişmedi)
├── manifest.json           ← PWA manifest (değişmedi)
├── service-worker.js       ← Servis çalışanı (değişmedi)
├── js/
│   ├── app.js              ← ⚠️ OTOMATİK ÜRETİLİR, elle düzenlenmez!
│   ├── i18n.js              ← Çeviri metinleri (değişmedi)
│   └── *.js                 ← Konfigürasyon dosyaları (değişmedi)
├── src/                     ← ✅ ASIL KAYNAK KOD BURADA, buray düzenle
│   ├── 00-header.js
│   ├── 00-state.js
│   ├── 01-firebase-core.js
│   ├── 02-utils.js
│   ├── 03-staff-roles.js
│   ├── 04-fiscal.js
│   ├── 05-products.js
│   ├── 06-veresiye.js
│   ├── 07-kasa-checkout.js
│   ├── 08-sales-returns.js
│   ├── 09-suppliers.js
│   ├── 10-reminders.js
│   ├── 11-bread-orders.js
│   ├── 12-push-notifications.js
│   ├── 13-branches-chain.js
│   ├── 14-admin-panel.js
│   ├── 15-voice-commands.js
│   ├── 16-bulk-scan-ai.js
│   ├── 17-ai-panel.js
│   ├── 18-settings-backup.js
│   ├── 19-onboarding.js
│   ├── 20-navigation.js
│   └── 99-main.js
├── tests/
│   └── logic.test.js         ← Saf mantık fonksiyonları için otomatik testler
├── build.js                  ← src/ dosyalarını js/app.js'e birleştirir
├── verify.js                 ← Birleştirmenin doğruluğunu kontrol eder
└── module-map.js             ← Hangi fonksiyonun hangi dosyaya ait olduğu
```

## Neden Bu Yapı?

Uygulama, TEK bir kapsam (closure) içinde çalışan ~70 paylaşılan durum
değişkeni (`products`, `sales`, `cart` gibi) kullanıyor. Bunu gerçek ES
modüllerine (`import`/`export`) çevirmek, binlerce referansı değiştirmek
anlamına gelirdi — bu, canlıdaki gerçek işletme verisi için gereksiz bir risk.

Bunun yerine: kod, okunabilir/organize kaynak dosyalarında (`src/`) tutuluyor,
ama tarayıcıya giden **çalışan dosya hâlâ tek parça** (`js/app.js`) —
JavaScript'in "hoisting" (fonksiyonların önceden tanınması) özelliği sayesinde
bu güvenli ve doğru çalışıyor.

## Bir Değişiklik Yaparken

1. **`js/app.js`'i ASLA elle düzenleme** — bir sonraki derlemede kaybolur.
2. İlgili özelliğin dosyasını `src/` içinde bul ve düzenle
   (örn. kasa ile ilgili bir şey için `src/07-kasa-checkout.js`).
3. Yeni bir fonksiyon eklediysen, `module-map.js`'e hangi dosyaya ait
   olduğunu ekle.
4. Değişikliği derle:
   ```
   npm run build
   ```
5. Derlemenin bir şeyi bozmadığını doğrula:
   ```
   npm run verify
   npm test
   npm run lint
   ```
6. Her şey yeşilse, `js/app.js`'i (ve değiştirdiğin diğer dosyaları) GitHub'a yükle.

## Testler

`tests/logic.test.js`, gerçek kaynak dosyalarını okuyup izole bir ortamda
çalıştırarak (kopyalanmış mantık DEĞİL, gerçek kod) fiyat/indirim
hesaplamaları gibi kritik iş mantığını test eder. Yeni saf (dış bağımlılığı
az olan) bir fonksiyon eklediğinde, buraya da bir test eklemen önerilir.

## Bilinçli Olarak Değiştirilmeyenler

- **Veri modeli** (her işletmenin tüm verisinin tek bir Firestore belgesinde
  tutulması) kasıtlı olarak değiştirilmedi — bu, canlı veriyi etkileyecek
  ayrı ve dikkatli bir göç (migration) gerektirir.
- **Cloudflare Worker'lar** ve **Google Apps Script** dosyaları da bu
  yeniden yapılandırmanın dışında tutuldu, olduğu gibi kopyalandı.
