# Mimari (Architecture)

## Genel Yapı

```
bakkal-app/
├── index.html                  ← <script type="module" src="js/main.js"> ile gerçek modülleri yükler
├── css/style.css
├── manifest.json
├── service-worker.js
├── js/
│   ├── main.js                 ← Giriş noktası: olay bağlama (event wiring), başlatma
│   ├── 00-state.js             ← Paylaşılan durum (state) — export const state = {...}
│   ├── 01-firebase-core.js     ← Firebase/auth/kaydetme-yükleme
│   ├── 02-utils.js             ← Genel yardımcı fonksiyonlar
│   ├── 03-staff-roles.js       ← Personel/rol yönetimi
│   ├── 04-fiscal.js            ← Resmi mali kayıt entegrasyonu
│   ├── 05-products.js          ← Ürün CRUD
│   ├── 06-veresiye.js          ← Müşteri/veresiye
│   ├── 07-kasa-checkout.js     ← Kasa/sepet
│   ├── 08-sales-returns.js     ← Satış geçmişi/iade
│   ├── 09-suppliers.js         ← Tedarikçi yönetimi
│   ├── 10-reminders.js         ← Müşteri hatırlatma
│   ├── 11-bread-orders.js      ← Günlük ürün takibi/sipariş
│   ├── 12-push-notifications.js
│   ├── 13-branches-chain.js    ← Çok şubeli yönetim
│   ├── 14-admin-panel.js       ← SaaS yönetim paneli
│   ├── 15-voice-commands.js    ← Sesli komut
│   ├── 16-bulk-scan-ai.js      ← AI destekli toplu ürün girişi
│   ├── 17-ai-panel.js          ← AI Panel (rapor, öneri, danışman)
│   ├── 18-settings-backup.js   ← Ayarlar/yedekleme
│   ├── 19-onboarding.js        ← İlk kullanım rehberi
│   ├── 20-navigation.js        ← Ana render/sekme geçişi
│   ├── i18n.js                 ← Çeviri metinleri (ayrı, modül değil)
│   └── *-config.js              ← Firebase/worker adresleri (ayrı, modül değil)
├── tests/
│   ├── setup-globals.mjs        ← Testler için sahte tarayıcı ortamı
│   └── logic.test.mjs           ← GERÇEK js/ dosyalarını import edip test eder
├── verify-esm-imports.js        ← Hiçbir dosyada eksik import kalmadığını kontrol eder
├── eslint.config.js
└── migration-history/           ← Eski tek-parça yapıdan buraya nasıl geldiğimizin kaydı
```

## Bu Artık GERÇEK ES Modülleri — Derleme (Build) Adımı YOK

Önceki yaklaşımda `src/` klasöründe organize dosyalar tutup, bunları TEK bir
`js/app.js` dosyasında birleştiriyorduk. Bu YETERSİZDİ — çünkü tarayıcıya giden
dosya hâlâ 6000+ satırlık tek bir dosyaydı, sadece kaynak kod düzenliydi.

Şimdi durum farklı: **modern tarayıcılar gerçek ES modüllerini
(`import`/`export`) doğrudan çalıştırabiliyor**, hiçbir birleştirme/paketleme
aracına ihtiyaç olmadan. Bu yüzden:

- `js/` klasöründeki her dosya **gerçekten ayrı, gerçekten çalışan** bir dosya
- `index.html` bunları `<script type="module" src="js/main.js">` ile yükler,
  tarayıcı geri kalan tüm dosyaları `import` ifadelerini takip ederek otomatik indirir
- **`npm run build` diye bir komut YOK artık** — çünkü buna gerek yok

## Paylaşılan Durum (`state`)

~69 paylaşılan değişken (`products`, `sales`, `cart` gibi), ayrı dosyalarda
`let`/`const` olarak var olamaz (ES modülleri arasında canlı, yeniden
atanabilir değişken paylaşımı güvenli değildir). Bunun yerine hepsi **tek bir
paylaşılan nesnenin özellikleri**:

```js
// 00-state.js
export const state = {};
state.products = [];
state.sales = [];
// ...

// başka bir dosyada:
import { state } from './00-state.js';
state.products.push(yeniUrun); // güvenle okuma/yazma
```

## Bir Değişiklik Yaparken

1. İlgili özelliğin dosyasını `js/` içinde bul ve düzenle
   (örn. kasa ile ilgili bir şey için `js/07-kasa-checkout.js`).
2. Yeni bir fonksiyon eklediysen ve BAŞKA bir dosyadan çağrılacaksa, o
   fonksiyonun başına `export` yazmayı unutma, ve çağıran dosyada
   `import { fonksiyonAdı } from './XX-dosya.js';` ekle.
3. Hiçbir import'un eksik olmadığını kontrol et:
   ```
   npm run verify-imports
   ```
4. Testleri çalıştır:
   ```
   npm test
   ```
5. Kod kalitesini kontrol et:
   ```
   npm run lint
   ```
6. Her şey yeşilse, değiştirdiğin `js/*.js` dosyalarını (ve varsa
   `index.html`/`css/style.css`'i) GitHub'a yükle — **başka hiçbir dosyayı
   (derlenmiş bir çıktı) yüklemene gerek yok, çünkü artık öyle bir şey yok.**

## Testler

`tests/logic.test.mjs`, **gerçek `js/` dosyalarını doğrudan import ederek**
(kopyalanmış mantık değil) kritik iş mantığını (fiyat/indirim/borç
hesaplamaları gibi) test eder. `tests/setup-globals.mjs`, Node.js'te
(tarayıcı olmadan) test çalıştırabilmek için gereken birkaç sahte tarayıcı
global'ini (`window.i18n` gibi) tanımlar.

## Bilinçli Olarak Değiştirilmeyenler

- **Veri modeli** (her işletmenin tüm verisinin tek bir Firestore belgesinde
  tutulması) kasıtlı olarak değiştirilmedi — bu, canlı veriyi etkileyecek
  ayrı ve dikkatli bir göç (migration) gerektirir.
- **Cloudflare Worker'lar** ve **Google Apps Script** dosyaları bu
  yeniden yapılandırmanın dışında tutuldu, olduğu gibi kopyalandı.
- **`i18n.js`** ve **`*-config.js`** dosyaları kasıtlı olarak modül
  yapılmadı — bunlar basit, bağımsız global tanımlar olarak kalmaya devam
  ediyor, dönüştürmenin bir faydası olmazdı.
