const fs = require("fs");
const path = require("path");
const acorn = require("acorn");
const walk = require("acorn-walk");
const escope = require("eslint-scope");
const moduleMap = require("./module-map.js");

const SRC_DIR = "/home/claude/bakkal-app-refactored/src";
const STATE_FILE = "00-state.js";

const funcToFile = {};
Object.keys(moduleMap).forEach((file) => {
  moduleMap[file].forEach((name) => (funcToFile[name] = file));
});

const stateAst = acorn.parse(fs.readFileSync(path.join(SRC_DIR, STATE_FILE), "utf8"), {
  ecmaVersion: 2022,
  sourceType: "module"
});
const stateVarNames = new Set();
stateAst.body.forEach((n) => {
  // export const state = {}; state.X = ...;  -> "state" ismi hariç, X'leri toplamamıza gerek yok,
  // burada sadece "state" ismini dışarıdan kullanan dosyaları tespit edeceğiz zaten.
});
// 99-main.js'de zaten HER ZAMAN state kullanılıyor olabilir, bunu genel mantıkla tespit edeceğiz.

const raw = fs.readFileSync(path.join(SRC_DIR, "99-main.js"), "utf8");
const headerRaw = fs
  .readFileSync(path.join(SRC_DIR, "00-header.js"), "utf8")
  .replace('"use strict";\n\n', ""); // ES modülleri zaten strict mode'da çalışır, gerek yok.

const wrapped = "(function () {\n" + raw + "\n})();";
const ast = acorn.parse(wrapped, { ecmaVersion: 2022, sourceType: "script", ranges: true, locations: true });

const parentMap = new Map();
walk.ancestor(ast, {
  Identifier(node, ancestors) {
    if (ancestors.length >= 2) parentMap.set(node, ancestors[ancestors.length - 2]);
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

// Gerçek state değişkeni isimlerini (00-state.js'in KENDİ ham halinden değil,
// ana module-map.js + bilinen liste üzerinden) almamız lazım. En güvenlisi:
// module-map.js'de yer ALMAYAN ama 00-state.js'de tanımlı isimleri kullanmaktı,
// ama artık 00-state.js zaten dönüştürüldüğü için orijinal listeyi tekrar okuyalım.
const originalAppSrc = fs.readFileSync("/home/claude/bakkal-app-refactored/js/app.js", "utf8");
const origAst = acorn.parse(originalAppSrc, { ecmaVersion: 2022, sourceType: "script" });
const origBody = origAst.body[0].expression.callee.body.body;
const realStateVarNames = new Set();
origBody.forEach((n) => {
  if (n.type === "VariableDeclaration") {
    n.declarations.forEach((d) => {
      if (d.id && d.id.name) realStateVarNames.add(d.id.name);
    });
  }
});

const edits = [];
let neededStateImport = false;
const neededFunctionImports = new Set();

iifeScope.through.forEach((ref) => {
  const name = ref.identifier.name;

  if (realStateVarNames.has(name)) {
    neededStateImport = true;
    const id = ref.identifier;
    const parent = parentMap.get(id);
    const isShorthandProp = parent && parent.type === "Property" && parent.shorthand && parent.value === id;
    if (isShorthandProp) {
      edits.push({ start: id.start, end: id.end, newText: name + ": state." + name });
    } else {
      edits.push({ start: id.start, end: id.end, newText: "state." + name });
    }
    return;
  }

  if (funcToFile[name]) {
    neededFunctionImports.add(name + "::" + funcToFile[name]);
  }
});

const wrapperPrefixLen = "(function () {\n".length;
edits.sort((a, b) => b.start - a.start);
let result = raw;
edits.forEach((edit) => {
  const start = edit.start - wrapperPrefixLen;
  const end = edit.end - wrapperPrefixLen;
  result = result.slice(0, start) + edit.newText + result.slice(end);
});

const importLines = [];
if (neededStateImport) importLines.push(`import { state } from './${STATE_FILE}';`);
const importsByFile = {};
neededFunctionImports.forEach((entry) => {
  const [fnName, fromFile] = entry.split("::");
  if (!importsByFile[fromFile]) importsByFile[fromFile] = [];
  importsByFile[fromFile].push(fnName);
});
Object.keys(importsByFile)
  .sort()
  .forEach((fromFile) => {
    importLines.push(`import { ${importsByFile[fromFile].sort().join(", ")} } from './${fromFile}';`);
  });

const finalContent = importLines.join("\n") + "\n\n" + headerRaw + "\n" + result;

fs.writeFileSync(path.join(SRC_DIR, "main.js"), finalContent);
fs.unlinkSync(path.join(SRC_DIR, "99-main.js"));
fs.unlinkSync(path.join(SRC_DIR, "00-header.js"));

console.log("main.js oluşturuldu. Toplam import satırı:", importLines.length);
