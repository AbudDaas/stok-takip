const fs = require("fs");
const acorn = require("acorn");

function extractOtherStatementsInOrder(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: "script" });
  const body = ast.body[0].expression.callee.body.body;
  return body
    .filter((n) => n.type !== "FunctionDeclaration" && n.type !== "VariableDeclaration")
    .map((n) => src.slice(n.start, n.end).replace(/\s+/g, " ").trim());
}

const orig = extractOtherStatementsInOrder("/home/claude/bakkal-app/js/app.js");
const rebuilt = extractOtherStatementsInOrder("/home/claude/bakkal-app-refactored/js/app.js");

let allMatch = true;
for (let i = 0; i < orig.length; i++) {
  if (orig[i] !== rebuilt[i]) {
    console.log(`FARK bulundu (index ${i}):`);
    console.log("ORİJİNAL :", orig[i].slice(0, 100));
    console.log("YENİDEN  :", (rebuilt[i] || "(yok)").slice(0, 100));
    allMatch = false;
  }
}
console.log(allMatch ? "✅ Sıralama VE içerik birebir aynı, tüm " + orig.length + " ifade." : "❌ Farklar bulundu, yukarıya bakın.");
