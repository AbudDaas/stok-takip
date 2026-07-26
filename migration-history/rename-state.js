/**
 * Bu script, uygulamanın ~69 paylaşılan durum (state) değişkenini
 * (products, sales, cart, docRef gibi) GERÇEK ES modüllerine taşıyabilmek için
 * tek bir paylaşılan `state` nesnesinin özelliklerine dönüştürür.
 *
 * GÜVENLİK: Bunu elle metin arama/değiştirme (regex) ile YAPMIYORUZ — bir
 * fonksiyonun kendi içindeki yerel bir değişken aynı ismi taşıyorsa (örn.
 * bir fonksiyonun parametresi de "products" olsaydı), yanlışlıkla onu da
 * değiştirebilirdi. Bunun yerine `eslint-scope` (ESLint'in kendisinin
 * kullandığı gerçek kapsam analizcisi) ile HANGİ "products" kelimesinin
 * GERÇEKTEN en dıştaki paylaşılan değişkene ait olduğunu tespit ediyoruz.
 */

const fs = require("fs");
const acorn = require("acorn");
const walk = require("acorn-walk");
const escope = require("eslint-scope");

const SRC_PATH = "/home/claude/bakkal-app-refactored/js/app.js";
const OUT_PATH = "/home/claude/bakkal-app-refactored/js/app.state-refactored.js";

const src = fs.readFileSync(SRC_PATH, "utf8");
const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: "script", ranges: true, locations: true });

// Her Identifier düğümünün "ebeveynini" (parent node) bulabilmek için bir harita kuruyoruz —
// böylece bir referansın KISALTILMIŞ (shorthand) bir nesne özelliği ({ products } gibi)
// olup olmadığını tespit edebiliyoruz.
const parentMap = new Map();
walk.ancestor(ast, {
  Identifier(node, ancestors) {
    if (ancestors.length >= 2) {
      parentMap.set(node, ancestors[ancestors.length - 2]);
    }
  }
});

const scopeManager = escope.analyze(ast, {
  ecmaVersion: 2022,
  sourceType: "script",
  optimistic: false,
  ignoreEval: true,
  nodejsScope: false
});

function findIifeScope(scope) {
  if (scope.type === "function" && scope.block.type === "FunctionExpression") return scope;
  for (const child of scope.childScopes) {
    const found = findIifeScope(child);
    if (found) return found;
  }
  return null;
}

const iifeScope = findIifeScope(scopeManager.globalScope);
if (!iifeScope) throw new Error("IIFE kapsamı bulunamadı!");

const outer = ast.body[0];
const body = outer.expression.callee.body.body;
const topLevelVarNames = new Set();
body.filter((n) => n.type === "VariableDeclaration").forEach((n) => {
  n.declarations.forEach((d) => {
    if (d.id && d.id.name) topLevelVarNames.add(d.id.name);
  });
});

console.log("Üst düzey (state) değişken sayısı:", topLevelVarNames.size);

const edits = [];

topLevelVarNames.forEach((name) => {
  const variable = iifeScope.variables.find((v) => v.name === name);
  if (!variable) {
    console.log("UYARI: kapsamda bulunamadı:", name);
    return;
  }

  variable.references.forEach((ref) => {
    const id = ref.identifier;
    const parent = parentMap.get(id);

    // Kısaltılmış nesne özelliği mi? ({ products } → { products: state.products })
    const isShorthandProp = parent && parent.type === "Property" && parent.shorthand && parent.value === id;

    if (isShorthandProp) {
      edits.push({ start: id.start, end: id.end, newText: name + ": state." + name });
    } else {
      edits.push({ start: id.start, end: id.end, newText: "state." + name });
    }
  });
});

body.filter((n) => n.type === "VariableDeclaration").forEach((n) => {
  n.declarations.forEach((d) => {
    if (!d.id || !d.id.name) return;
    const name = d.id.name;
    const alreadyCovered = edits.some((e) => e.start === d.id.start && e.end === d.id.end);
    if (!alreadyCovered) {
      edits.push({ start: d.id.start, end: d.id.end, newText: "state." + name });
    }
  });
  edits.push({ start: n.start, end: n.start + (n.kind + " ").length, newText: "" });
});

// Düzenlemeleri SONDAN BAŞA doğru uygula (yoksa pozisyonlar kayar).
edits.sort((a, b) => b.start - a.start);

// ---- KRİTİK ÖZ-DOĞRULAMA: her düzenlemenin ORİJİNAL METNİNİN tam olarak
// beklediğimiz gibi olduğunu kontrol ediyoruz. Bu, dönüşümün SADECE bilinen
// state değişkeni isimlerine ve "let "/"const " anahtar kelimelerine
// dokunduğunu, BAŞKA HİÇBİR ŞEYİ değiştirmediğini kanıtlar. ----
let selfCheckOk = true;
edits.forEach((edit) => {
  const originalText = src.slice(edit.start, edit.end);
  const isKnownVarName = topLevelVarNames.has(originalText);
  const isDeclarationKeyword = originalText === "let " || originalText === "const ";
  if (!isKnownVarName && !isDeclarationKeyword) {
    selfCheckOk = false;
    console.log("❌ ÖZ-DOĞRULAMA HATASI: beklenmeyen orijinal metin düzenlendi:", JSON.stringify(originalText), "pozisyon:", edit.start);
  }
});
console.log(selfCheckOk ? "✅ ÖZ-DOĞRULAMA: Tüm düzenlemeler sadece bilinen state isimlerine/anahtar kelimelere dokundu." : "❌ ÖZ-DOĞRULAMA BAŞARISIZ — yukarıya bak.");
if (!selfCheckOk) {
  throw new Error("Öz-doğrulama başarısız, dönüşüm GÜVENSİZ kabul edildi. Dosya yazılmadı.");
}

// Çakışan (overlap) düzenleme var mı kontrol et — olursa dosya bozulur.
const sortedByStart = [...edits].sort((a, b) => a.start - b.start);
let overlapFound = false;
for (let i = 1; i < sortedByStart.length; i++) {
  if (sortedByStart[i].start < sortedByStart[i - 1].end) {
    overlapFound = true;
    console.log("❌ ÇAKIŞMA:", sortedByStart[i - 1], sortedByStart[i]);
  }
}
console.log(overlapFound ? "❌ ÇAKIŞAN DÜZENLEMELER VAR." : "✅ Çakışan düzenleme yok.");
if (overlapFound) {
  throw new Error("Çakışan düzenlemeler bulundu, dosya yazılmadı.");
}

let result = src;
edits.forEach((edit) => {
  result = result.slice(0, edit.start) + edit.newText + result.slice(edit.end);
});

// En başa, tüm state değişkenlerini barındıracak boş "const state = {};" ekle.
// (Zaten "state.products = [];" gibi ifadeler onu dolduracak.)
result = result.replace("(function () {", "(function () {\n  const state = {};");

fs.writeFileSync(OUT_PATH, result);
console.log("Toplam düzenleme sayısı:", edits.length);
console.log("Yazıldı:", OUT_PATH);
