const fs = require("fs");
const path = require("path");
const acorn = require("acorn");
const moduleMap = require("./module-map.js");

const SRC_PATH = "/home/claude/bakkal-app/js/app.js";
const OUT_DIR = "/home/claude/bakkal-app-refactored/src";

const src = fs.readFileSync(SRC_PATH, "utf8");
const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: "script" });

const outer = ast.body[0];
const callExpr = outer.expression;
const fn = callExpr.callee;
const body = fn.body.body;

// Fonksiyon adı -> hedef dosya haritasını tersine çevir (hızlı arama için)
const funcToFile = {};
Object.keys(moduleMap).forEach((file) => {
  moduleMap[file].forEach((name) => {
    funcToFile[name] = file;
  });
});

// Her dosya için toplanan metin parçaları
const fileBuckets = {};
Object.keys(moduleMap).forEach((file) => (fileBuckets[file] = []));
fileBuckets["00-state.js"] = [];
fileBuckets["99-main.js"] = [];
fileBuckets["00-header.js"] = []; // "use strict" ve erken servis çalışanı kaydı — MUTLAKA en başta kalmalı

const unmapped = [];
const seenFunctionNames = new Set();

function needsSemicolon(text) {
  const trimmed = text.trim();
  return !trimmed.endsWith(";") && !trimmed.endsWith("}");
}

body.forEach((node, idx) => {
  const text = src.slice(node.start, node.end);

  // İlk iki ifade ("use strict" ve erken SW kaydı) özel: en başta kalmalı, main.js'e değil.
  if (idx <= 1) {
    fileBuckets["00-header.js"].push(needsSemicolon(text) ? text + ";" : text);
    return;
  }

  if (node.type === "FunctionDeclaration") {
    const name = node.id.name;
    const target = funcToFile[name];
    if (!target) {
      unmapped.push(name);
      fileBuckets["99-main.js"].push(text); // eşleşmeyenleri kaybetmemek için main'e koy
      return;
    }
    if (seenFunctionNames.has(name)) {
      // Aynı isim tekrar tanımlanmışsa (örn. mkCustomer iki listede), sadece BİR yere koy,
      // ikinci kez tanımını yine ORİJİNAL dosyaya (ilk göründüğü yere) ekle.
    }
    seenFunctionNames.add(name);
    fileBuckets[target].push(text);
    return;
  }

  if (node.type === "VariableDeclaration") {
    fileBuckets["00-state.js"].push(needsSemicolon(text) ? text + ";" : text);
    return;
  }

  // Geri kalan her şey (IfStatement, ExpressionStatement/addEventListener, vs.)
  // orijinal sırasıyla main.js'e gider.
  fileBuckets["99-main.js"].push(needsSemicolon(text) ? text + ";" : text);
});

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

Object.keys(fileBuckets).forEach((file) => {
  const content = fileBuckets[file].join("\n\n");
  fs.writeFileSync(path.join(OUT_DIR, file), content + "\n");
});

console.log("Eşleşmeyen (haritada olmayan) fonksiyonlar:", unmapped.length ? unmapped : "YOK — hepsi eşleşti ✅");
console.log("Toplam dosya sayısı:", Object.keys(fileBuckets).length);
Object.keys(fileBuckets).forEach((f) => {
  console.log(" -", f, ":", fileBuckets[f].length, "blok");
});
