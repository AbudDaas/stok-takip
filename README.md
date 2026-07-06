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

### 7) Kontrol et
Siteyi yenile. Karşına bir **Giriş Yap / Kayıt Ol** ekranı çıkmalı. "Kayıt Ol"
sekmesinden bir e-posta ve şifre ile hesap oluştur, ardından telefonunda da aynı
hesapla giriş yap — üst çubukta **"Senkron"** yazısını ve az önce eklediğin ürünleri
görmen lazım. Farklı bir e-posta ile kayıt olursan, tamamen boş/ayrı bir işletme
verisiyle karşılaşırsın — bu, çoklu işletme desteğinin çalıştığının kanıtıdır.

## Ürün QR kodu nasıl kullanılır

1. Ürünler sekmesinde bir ürüne dokun.
2. Açılan pencerede **"QR kodu yazdır"** butonuna bas.
3. Çıkan QR kodu yazdırıp ürünün rafına/kutusuna yapıştır.
4. Stok değiştiğinde **QR Tara** sekmesinden kamerayı aç, ilgili QR kodu okut.
5. Çıkan pencerede stok **girişi** mi **çıkışı** mı olduğunu seç.
