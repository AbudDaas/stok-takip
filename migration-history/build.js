// Bu script, src/ klasöründeki tüm modül dosyalarını doğru sırada birleştirip
// tek bir çalıştırılabilir app.js üretir. Kaynak kodu ORGANİZE dosyalarda
// tutuyoruz, ama tarayıcıya giden dosya hâlâ tek parça (mevcut deploy şeklimiz
// değişmiyor — index.html'de tek <script src="js/app.js"> kalmaya devam eder).

const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "src");
const OUT_PATH = path.join(__dirname, "js", "app.js");

// Sıra ÖNEMLİ: header en başta, state ikinci, main (event wiring) en sonda olmalı.
// Aradaki özellik dosyalarının sırası fonksiyon "hoisting" sayesinde önemli değil.
const ORDER = [
  "00-header.js",
  "00-state.js",
  "01-firebase-core.js",
  "02-utils.js",
  "03-staff-roles.js",
  "04-fiscal.js",
  "05-products.js",
  "06-veresiye.js",
  "07-kasa-checkout.js",
  "08-sales-returns.js",
  "09-suppliers.js",
  "10-reminders.js",
  "11-bread-orders.js",
  "12-push-notifications.js",
  "13-branches-chain.js",
  "14-admin-panel.js",
  "15-voice-commands.js",
  "16-bulk-scan-ai.js",
  "17-ai-panel.js",
  "18-settings-backup.js",
  "19-onboarding.js",
  "20-navigation.js",
  "99-main.js"
];

let combined = "(function () {\n\n";

ORDER.forEach((file) => {
  const filePath = path.join(SRC_DIR, file);
  if (!fs.existsSync(filePath)) {
    throw new Error("Eksik dosya: " + file);
  }
  const content = fs.readFileSync(filePath, "utf8");
  combined += `  // ==================== ${file} ====================\n`;
  combined += content;
  combined += "\n";
});

combined += "})();\n";

if (!fs.existsSync(path.join(__dirname, "dist"))) {
  fs.mkdirSync(path.join(__dirname, "dist"));
}
fs.writeFileSync(OUT_PATH, combined);

console.log("Yazıldı:", OUT_PATH);
console.log("Toplam satır:", combined.split("\n").length);
