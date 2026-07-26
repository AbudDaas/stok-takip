# Geçmiş Dönüşüm Araçları (Migration History)

Bu klasördeki script'ler, orijinal **tek parça `app.js`** dosyasını (5769+ satır)
bugünkü **gerçek ES modülleri** yapısına dönüştürmek için **bir kereye mahsus**
kullanıldı. Artık günlük geliştirme akışının bir parçası değiller — sadece
"buraya nasıl geldik" sorusuna cevap vermesi ve ileride benzer bir dönüşüm
gerekirse referans olması için saklanıyor.

## Dönüşümün aşamaları (sırasıyla)

1. **`split.js`** + **`module-map.js`** — orijinal tek dosyayı, her fonksiyonu
   doğru dosyaya yerleştirerek 20+ dosyaya böldü (henüz `import`/`export` yok,
   sadece organize edilmiş parçalar).
2. **`add-headers.js`** — her dosyanın başına açıklayıcı yorum ekledi.
3. **`build.js`** — (artık kullanılmıyor) bölünmüş dosyaları eskisi gibi TEK
   bir `app.js`'e geri birleştiriyordu. Bu YETERSİZ bir çözümdü çünkü tarayıcıya
   giden dosya hâlâ tek parçaydı — bu yüzden bir sonraki adıma geçildi.
4. **`rename-state.js`** — `eslint-scope` (ESLint'in kendi kullandığı kapsam
   analiz kütüphanesi) ile, ~69 paylaşılan durum değişkenini (`products`,
   `sales`, `cart` gibi) güvenli şekilde tek bir `state` nesnesinin
   özelliklerine dönüştürdü. Bu, kör metin değişimi DEĞİL — hangi "products"
   kelimesinin gerçekten paylaşılan değişkene ait olduğunu (yerel bir
   değişkenle gölgelenmemiş olanı) tespit ederek yaptı.
5. **`convert-to-esm.js`** — her özellik dosyasını gerçek bir ES moldülüne
   çevirdi: hangi dosyanın hangi fonksiyona/duruma ihtiyacı olduğunu otomatik
   hesaplayıp `import`/`export` ifadelerini ekledi.
6. **`convert-state-file.js`** ve **`convert-main-file.js`** — özel iki dosyayı
   (paylaşılan durumu tutan dosya ve ana giriş noktası) elle işledi.

## Doğrulama script'leri

- **`verify.js`**, **`verify-order.js`**, **`verify-state-rename.js`** — dönüşümün
  HER adımda hiçbir fonksiyonu bozmadığını, kaybetmediğini kanıtlamak için
  kullanıldı (bkz. ana `ARCHITECTURE.md`'deki doğrulama felsefesi).

## Hâlâ kullanılan araç

`../verify-esm-imports.js` bu klasörde DEĞİL, ana klasörde duruyor — çünkü bu,
gelecekte yeni bir dosya/fonksiyon eklendiğinde "hiçbir import eksik mi?" diye
kontrol etmek için hâlâ faydalı, tekrar tekrar kullanılabilir bir araç.
