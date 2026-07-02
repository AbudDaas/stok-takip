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

Tüm ürün verileri telefonunun/tarayıcının kendi hafızasında (localStorage) saklanır.
İnternet olmadan da uygulamayı açıp kullanabilirsin. Tarayıcı geçmişini/verilerini
tamamen temizlersen ürün listesi de silinir — bu yüzden önemli bir envanterin varsa
ara sıra ekran görüntüsü almanı öneririm.

## Ürün QR kodu nasıl kullanılır

1. Ürünler sekmesinde bir ürüne dokun.
2. Açılan pencerede **"QR kodu yazdır"** butonuna bas.
3. Çıkan QR kodu yazdırıp ürünün rafına/kutusuna yapıştır.
4. Stok değiştiğinde **QR Tara** sekmesinden kamerayı aç, ilgili QR kodu okut.
5. Çıkan pencerede stok **girişi** mi **çıkışı** mı olduğunu seç.
6. 
