# Bakkal Stok Takip Uygulaması

Ürün ekleme/çıkarma, stok giriş-çıkış takibi ve QR kod ile tarama içeren, telefona
"gerçek uygulama" gibi yüklenebilen bir web uygulaması (PWA).

## Özellikler
- Ürün ekle, düzenle, sil
- Her ürün için otomatik durum: **Yeterli / Kritik / Tükendi**
- Her ürüne özel QR kod oluşturma ve yazdırma (rafa yapıştırmak için)
- Kamera ile QR okutup stok girişi / çıkışı yapma
- Otomatik "Acil Sipariş Listesi"
- Tek tuşla sıfırlama
- İnternet olmadan da çalışır (offline destek)
- Telefonda ana ekrana eklenip gerçek uygulama gibi açılır

## GitHub Pages'e yükleme (ücretsiz, 5 dakika)

1. [github.com](https://github.com) üzerinde ücretsiz bir hesap oluştur (varsa atla).
2. Sağ üstteki **+** işaretine tıkla → **New repository**.
3. Bir isim ver (örnek: `bakkal-stok-takip`) → **Public** seçili olsun → **Create repository**.
4. Açılan sayfada **"uploading an existing file"** linkine tıkla.
5. Bu klasördeki **tüm dosya ve klasörleri** (index.html, manifest.json, service-worker.js,
   css/, js/, icons/, README.md) sürükleyip bırak.
   - Önemli: klasör yapısını bozma, `css`, `js`, `icons` klasörleri aynı isimle kalmalı.
6. Altta **Commit changes** butonuna bas.
7. Üst menüden **Settings → Pages** sekmesine git.
8. **Branch** kısmından `main` seç, klasör olarak `/ (root)` seç → **Save**.
9. Birkaç dakika bekle, sayfa sana bir adres verecek:
   `https://kullanici-adin.github.io/bakkal-stok-takip/`

## Telefona yükleme (gerçek uygulama gibi)

1. Yukarıdaki adresi telefonunun tarayıcısında (Chrome / Safari) aç.
2. Chrome'da: sağ üstteki üç nokta → **"Ana ekrana ekle"**
   Safari'de (iPhone): paylaş simgesi → **"Ana Ekrana Ekle"**
3. Artık ana ekranında bir uygulama ikonu göreceksin, dokununca tam ekran açılır.

## QR taramanın çalışması için önemli not

Kamera erişimi, tarayıcıların güvenlik kuralı gereği yalnızca **https://** ile başlayan
adreslerde çalışır. GitHub Pages otomatik olarak https sağladığı için bu adımları takip
ettiğinde QR tarama sorunsuz çalışacaktır. Dosyayı bilgisayarından çift tıklayıp açarsan
(`file://...`) kamera çalışmaz.

## Verilerin nerede saklanıyor

Varsayılan olarak tüm ürün verileri telefonunun/tarayıcının kendi hafızasında
(localStorage) saklanır — yani **telefon ve bilgisayar birbirinden bağımsız, farklı
veri gösterir**. Cihazlar arası aynı veriyi görmek istiyorsan aşağıdaki "Bulut
senkronizasyonu kurulumu" bölümünü takip et.

## Bulut senkronizasyonu kurulumu (isteğe bağlı, ücretsiz)

Bunu kurarsan telefonunda eklediğin/değiştirdiğin her ürün, bilgisayarında da anında
görünür (ve tam tersi). Google'ın ücretsiz **Firebase** servisini kullanıyoruz.

### 1) Firebase projesi oluştur
1. [console.firebase.google.com](https://console.firebase.google.com) adresine git, Google hesabınla giriş yap.
2. **Add project / Proje ekle** → bir isim ver (örn. `bakkal-stok`) → İleri.
3. Google Analytics sorulursa kapatabilirsin (gerekli değil) → **Create project**.

### 2) Firestore veritabanını aç
1. Sol menüden **Build → Firestore Database**.
2. **Create database** butonuna bas.
3. **Start in test mode** seçeneğini seç → İleri.
4. Sunucu konumu (region) sorulursa sana en yakın olanı seç → **Enable**.

### 3) Web uygulaması kaydet ve config bilgilerini al
1. Sol üstteki proje adının yanındaki **⚙️ (dişli) → Project settings**.
2. Aşağı in, **"Your apps"** bölümünde **`</>`** (Web) simgesine tıkla.
3. Bir takma isim yaz (örn. `bakkal-app`) → **Register app**.
4. Karşına çıkan `firebaseConfig = {...}` bloğunu **tamamen kopyala**.

### 4) Bilgileri GitHub'a yapıştır
1. GitHub reponda `js/firebase-config.js` dosyasını aç.
2. Sağ üstteki kalem (✏️ Edit) ikonuna tıkla.
3. İçindeki `BURAYA_...` yazan tüm değerleri, Firebase'den kopyaladığın gerçek
   değerlerle değiştir (apiKey, authDomain, projectId, storageBucket,
   messagingSenderId, appId).
4. **Commit changes** ile kaydet.

### 5) E-posta/Şifre ile girişi etkinleştir
1. Firebase Console → sol menü **Build → Authentication → Get started**.
2. **Sign-in method** sekmesi → **Email/Password** → etkinleştir → **Save**.

### 6) Firestore güvenlik kuralını her işletmenin verisini birbirinden ayıracak şekilde ayarla
1. Firebase Console → **Firestore Database → Rules** sekmesi.
2. İçeriği şununla değiştir:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /isletmeler/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
3. **Publish** ile yayınla.

   Bu kural sayesinde her işletme yalnızca kendi hesabıyla giriş yaptığında kendi
   verisini görür/değiştirir — farklı işletmelerin verileri birbirinden tamamen izole
   olur.

### 7) Yeni bir işletmeye hesap açma (yalnızca sen yapabilirsin)
Uygulamada "Kayıt Ol" seçeneği yok — hesaplar sadece senin onayınla, Firebase
Console üzerinden açılıyor. Yeni bir işletmeye erişim vermek için:
1. Firebase Console → **Authentication → Users** sekmesi.
2. **"Add user"** butonuna tıkla.
3. İşletmenin e-postasını ve senin belirlediğin bir şifreyi gir → **Add user**.
4. Bu e-posta/şifreyi işletmeyle paylaş — artık sadece o bilgilerle giriş yapabilirler,
   kendi başlarına yeni hesap açamazlar.
5. İşletme dilerse **"Şifremi unuttum"** ile kendi şifresini değiştirebilir, ama yeni
   hesap açamaz.

### 8) Kontrol et
Siteyi yenile. Karşına bir **Giriş Yap** ekranı çıkmalı. Yukarıdaki adımla oluşturduğun
e-posta/şifre ile giriş yap — üst çubukta **"Senkron"** yazısını görmen lazım. Aynı
hesapla telefonunda da giriş yaparsan, aynı ürünleri göreceksin. Farklı bir işletmeye
farklı bir hesap açarsan, o işletmenin verisi seninkinden tamamen ayrı ve boş olur.

## Ürün QR kodu nasıl kullanılır

1. Ürünler sekmesinde bir ürüne dokun.
2. Açılan pencerede **"QR kodu yazdır"** butonuna bas.
3. Çıkan QR kodu yazdırıp ürünün rafına/kutusuna yapıştır.
4. Stok değiştiğinde **QR Tara** sekmesinden kamerayı aç, ilgili QR kodu okut.
5. Çıkan pencerede stok **girişi** mi **çıkışı** mı olduğunu seç.

## Toplu ürün tarama (AI ile raf fotoğrafından) kurulumu

Bu özellik, bir raf fotoğrafı çekip yapay zekanın ürünleri tanımasını ve sistemde
olmayanları toplu eklemeni sağlar. Kurulumu biraz teknik ama tek seferlik ve tamamen
tarayıcı üzerinden (terminal/kod yazmadan) yapılabiliyor.

**Maliyet:** Fotoğraf başına yaklaşık 0,1-1 kuruş (1000 fotoğraf ≈ 1-3 dolar).
Firebase'in "Blaze" (kullandıkça öde) planına geçmen gerekiyor, ama bu plan da
belirli bir ücretsiz kotaya kadar bedava — sadece kredi kartı bilgisi istiyor.

### 1) Firebase'i Blaze planına yükselt
1. [console.firebase.google.com](https://console.firebase.google.com) → projen (`bakkal-stok`).
2. Sol altta **"Spark" → "Upgrade"** (Yükselt) butonuna tıkla.
3. **Blaze (Pay as you go)** planını seç, kredi kartı bilgisini gir.
4. Endişelenme: küçük kullanım ücretsiz kotanın içinde kalır, otomatik yüksek fatura
   çıkmaz — istersen Firebase Console'dan bütçe uyarısı da kurabilirsin.

### 2) Anthropic (Claude) API anahtarı al
1. [console.anthropic.com](https://console.anthropic.com) adresine git, hesap oluştur.
2. **API Keys** bölümünden yeni bir anahtar oluştur, kopyala (bir daha gösterilmez,
   kaybedersen yenisini oluşturman gerekir).
3. Hesabına birkaç dolarlık bakiye ekle (kredi kartıyla, dakikalar sürer).

### 3) Cloud Function'ı tarayıcıdan oluştur (kod yazmadan)
1. [console.cloud.google.com](https://console.cloud.google.com) → üstten **aynı
   `bakkal-stok` projesini** seç (Firebase ile aynı Google Cloud projesidir).
2. Arama kutusuna **"Cloud Functions"** yaz, aç → **"Create Function"**.
3. **Environment:** "2nd gen" seç.
4. **Function name:** `recognizeShelf` yaz.
5. **Region:** sana yakın bir bölge seç (örn. `europe-west1`).
6. **Trigger type:** HTTPS. **Authentication:** "Allow unauthenticated invocations"
   seçili olsun → **Next/Save**.
7. Aşağıda **"Runtime, build, connections and security settings"** başlığını aç →
   **Runtime environment variables** bölümüne 2 değişken ekle:
   - `ANTHROPIC_API_KEY` → az önce aldığın Claude API anahtarı
   - `APP_SECRET` → kendi belirlediğin rastgele bir metin (örn. `bakkal2026gizli`,
     kimseyle paylaşma)
8. **Runtime:** Node.js 20 seç → **Next**.
9. **Source code:** "Inline editor" seçili olsun. Bu depodaki `cloud-function/index.js`
   dosyasının içeriğini kopyalayıp editördeki `index.js`'in üzerine yapıştır.
10. Sol taraftaki `package.json` dosyasına da bu depodaki `cloud-function/package.json`
    içeriğini yapıştır.
11. **Entry point** kutusuna `recognizeShelf` yaz.
12. **Deploy** butonuna bas, 1-2 dakika bekle (yeşil onay işareti çıkacak).

### 4) Fonksiyonun adresini (URL) kopyala
1. Fonksiyon listesinde `recognizeShelf`'e tıkla.
2. Üstteki **"Trigger"** sekmesinde bir URL göreceksin, örn:
   `https://europe-west1-bakkal-stok.cloudfunctions.net/recognizeShelf`
3. Bu adresi kopyala.

### 5) Uygulamaya bağla
1. GitHub reponda `js/bulk-scan-config.js` dosyasını aç, düzenle (kalem ikonu).
2. İçeriği şu şekilde doldur:
   ```javascript
   const bulkScanConfig = {
     endpoint: "BURAYA_KOPYALADIĞIN_URL",
     secret: "BURAYA_APP_SECRET_DEĞERİN"
   };
   ```
   (`secret` değeri, Cloud Function'a eklediğin `APP_SECRET` ile birebir aynı olmalı.)
3. Commit changes.

### 6) Test et
Siteyi yenile, **Ürünler** sekmesinde **"Fotoğraf çek / seç"** butonuna bas, bir raf
fotoğrafı çek. Birkaç saniye içinde "Sistemde olmayan N ürün bulundu" ekranı çıkmalı.
İstediğin ürünlerin işaretini bırak/kaldır, **"Hepsini ekle"** ile toplu ekle.

### Önemli notlar
- `APP_SECRET` değerini ve fonksiyon adresini kimseyle paylaşma — bu, faturana
  yansıyacak API çağrılarını yapabilmenin tek koruması.
- Google Cloud Console'da **Billing → Budgets & alerts** kısmından örn. "10$'ı
  geçerse e-posta at" gibi bir bütçe uyarısı kurmanı öneririm, gönül rahatlığı için.
- Bu özellik kurulmadan da uygulamanın geri kalanı sorunsuz çalışmaya devam eder;
  `bulk-scan-config.js` boş/varsayılan kalırsa sadece bu buton "henüz kurulmadı"
  uyarısı verir.
