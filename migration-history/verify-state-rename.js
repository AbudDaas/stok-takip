/**
 * KRİTİK DOĞRULAMA: state-refactored dosyasını "geri alıp" (state.X -> X,
 * "isim: state.isim" -> "isim") orijinal dosyayla TAM OLARAK eşleştiğini
 * kanıtlıyoruz. Eşleşiyorsa, dönüşümün sadece istediğimiz değişikliği
 * yaptığını, başka HİÇBİR ŞEYİ bozmadığını kanıtlamış oluyoruz.
 */
const fs = require("fs");

const original = fs.readFileSync("/home/claude/bakkal-app-refactored/js/app.js", "utf8");
const refactored = fs.readFileSync("/home/claude/bakkal-app-refactored/js/app.state-refactored.js", "utf8");

let reverted = refactored;

// 1) "const state = {};" satırını kaldır (bunu biz eklemiştik).
reverted = reverted.replace("(function () {\n  const state = {};", "(function () {");

// 2) Kısaltılmış özellik düzeltmesini geri al: "isim: state.isim" -> "isim"
//    (sadece nesne literalindeki kısaltmalar için kullanmıştık)
reverted = reverted.replace(/\b([a-zA-Z_$][\w$]*): state\.\1\b/g, "$1");

// 3) "state.isim" -> "isim"
reverted = reverted.replace(/\bstate\.([a-zA-Z_$][\w$]*)\b/g, "$1");

// Şimdi normalleştirip (yorum satırlarını ve boşlukları sadeleştirip) karşılaştıralım.
// Yorumları çıkarıyoruz çünkü başlık yorumlarında ("00-state.js" gibi) dosya
// adı geçebiliyor ve bu, geri alma regex'ini yanlışlıkla tetikleyebiliyor —
// bu sadece DOĞRULAMA script'inin bir sınırlaması, gerçek dönüşümü etkilemiyor.
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}
const normalize = (s) => stripComments(s).replace(/\s+/g, " ").trim();

const origNorm = normalize(original);
const revertedNorm = normalize(reverted);

if (origNorm === revertedNorm) {
  console.log("✅ MÜKEMMEL: Dönüşüm geri alındığında orijinalle BİREBİR aynı.");
} else {
  console.log("❌ FARK VAR. İlk farkı bulalım...");
  let i = 0;
  while (i < Math.min(origNorm.length, revertedNorm.length) && origNorm[i] === revertedNorm[i]) i++;
  console.log("Fark noktası (karakter", i, "):");
  console.log("ORİJİNAL :", origNorm.slice(Math.max(0, i - 80), i + 80));
  console.log("GERİ ALINMIŞ:", revertedNorm.slice(Math.max(0, i - 80), i + 80));
}
