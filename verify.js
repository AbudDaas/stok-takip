const fs = require("fs");
const acorn = require("acorn");

function extractFunctionSet(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: "script" });
  const outer = ast.body[0];
  const body = outer.expression.callee.body.body;

  const functions = {};
  let variableDecls = [];
  let otherStatementsCount = 0;

  function walk(nodes) {
    nodes.forEach((node) => {
      if (node.type === "FunctionDeclaration") {
        // Normalleştir: sadece boşlukları sadeleştirip karşılaştır (satır no farkı önemsiz)
        const text = src.slice(node.start, node.end).replace(/\s+/g, " ").trim();
        functions[node.id.name] = text;
      } else if (node.type === "VariableDeclaration") {
        node.declarations.forEach((d) => {
          if (d.id && d.id.name) variableDecls.push(d.id.name);
        });
      } else {
        otherStatementsCount++;
      }
    });
  }
  walk(body);

  return { functions, variableDecls, otherStatementsCount, totalTopLevel: body.length };
}

const original = extractFunctionSet("/home/claude/bakkal-app/js/app.js");
const rebuilt = extractFunctionSet("/home/claude/bakkal-app-refactored/js/app.js");

// Bilinçli olarak kaldırılan ölü kod (ESLint tarafından tespit edildi,
// hiçbir yerde çağrılmadığı doğrulandı): findBoxMultiplier.
// Bu YEGÂNE beklenen fark budur — başka hiçbir fonksiyon değişmemeli.
const KNOWN_INTENTIONAL_REMOVALS = ["findBoxMultiplier"];

const origNames = Object.keys(original.functions).sort();
const rebuiltNames = Object.keys(rebuilt.functions).sort();

console.log("Orijinal fonksiyon sayısı:", origNames.length);
console.log("Yeniden birleştirilmiş fonksiyon sayısı:", rebuiltNames.length);

const missing = origNames.filter((n) => !rebuiltNames.includes(n) && !KNOWN_INTENTIONAL_REMOVALS.includes(n));
const extra = rebuiltNames.filter((n) => !origNames.includes(n));
console.log("Beklenmeyen eksik fonksiyonlar:", missing.length ? missing : "YOK ✅");
console.log("Fazladan fonksiyonlar:", extra.length ? extra : "YOK ✅");
console.log("Bilinçli kaldırılan (ölü kod):", KNOWN_INTENTIONAL_REMOVALS.join(", "));

let mismatchedBodies = [];
origNames.forEach((name) => {
  if (rebuilt.functions[name] && rebuilt.functions[name] !== original.functions[name]) {
    mismatchedBodies.push(name);
  }
});
console.log("İçeriği FARKLI olan fonksiyonlar:", mismatchedBodies.length ? mismatchedBodies : "YOK ✅ (hepsi birebir aynı)");

console.log("\nOrijinal değişken sayısı:", original.variableDecls.length);
console.log("Yeniden birleştirilmiş değişken sayısı:", rebuilt.variableDecls.length);
const missingVars = original.variableDecls.filter((v) => !rebuilt.variableDecls.includes(v));
console.log("Eksik değişkenler:", missingVars.length ? missingVars : "YOK ✅");

console.log("\nOrijinal diğer ifade sayısı (event wiring vb.):", original.otherStatementsCount);
console.log("Yeniden birleştirilmiş diğer ifade sayısı:", rebuilt.otherStatementsCount);
