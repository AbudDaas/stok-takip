/**
 * Her src/ dosyasını gerçek bir ES modülüne (export/import ile) çevirir.
 *
 * Yöntem (her dosya için):
 * 1. Dosya içeriğini geçici bir fonksiyon kabuğuna sarıp AST'ye çeviriyoruz
 *    (fragman tek başına geçerli bir program olmadığı için).
 * 2. eslint-scope ile, bu dosyanın İÇİNDE tanımlı OLMAYAN ama kullanılan
 *    tüm isimleri ("through" referanslar) buluyoruz.
 * 3. Bu isimlerden state değişkeni olanları "state.isim" yapıp
 *    `import { state } from './00-state.js'` ekliyoruz.
 * 4. Başka bir dosyada tanımlı bir FONKSİYONA aitse, o dosyadan
 *    `import { fonksiyon } from './XX-dosya.js'` ekliyoruz.
 * 5. Bu dosyadaki her fonksiyon tanımının başına `export` ekliyoruz.
 */

const fs = require("fs");
const path = require("path");
const acorn = require("acorn");
const walk = require("acorn-walk");
const escope = require("eslint-scope");
const moduleMap = require("./module-map.js");

const SRC_DIR = path.join(__dirname, "src");
const STATE_FILE = "00-state.js";

// isim -> dosya haritasını tersine çevir (fonksiyon adından dosya bulmak için)
const funcToFile = {};
Object.keys(moduleMap).forEach((file) => {
  moduleMap[file].forEach((name) => (funcToFile[name] = file));
});

// Tüm state değişkeni isimlerini al (00-state.js dosyasındaki değişkenler).
const stateFileRaw = fs.readFileSync(path.join(SRC_DIR, STATE_FILE), "utf8");
const stateAst = acorn.parse(stateFileRaw, { ecmaVersion: 2022, sourceType: "script" });
const stateVarNames = new Set();
stateAst.body.forEach((n) => {
  if (n.type === "VariableDeclaration") {
    n.declarations.forEach((d) => {
      if (d.id && d.id.name) stateVarNames.add(d.id.name);
    });
  }
});
console.log("State değişkeni sayısı:", stateVarNames.size);

function convertFile(fileName) {
  const filePath = path.join(SRC_DIR, fileName);
  const raw = fs.readFileSync(filePath, "utf8");

  // Geçici kabuk: içeriği bir fonksiyona sarıp ayrıştırıyoruz.
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

  // Bu dosyanın kendi içinde tanımladığı fonksiyon isimleri (bunlar için import gerekmez).
  const ownFunctionNames = new Set((moduleMap[fileName] || []));

  const edits = [];
  const neededStateImport = { needed: false };
  const neededFunctionImports = new Set(); // "fonksiyonAdı::dosyaAdı" şeklinde

  // "through" referanslar: bu dosyanın kendi kapsamında ÇÖZÜLEMEYEN, dışarıdan
  // gelmesi gereken tüm isimler. Bunlar arasından state değişkenlerini ve
  // başka dosyalardaki fonksiyonları tespit edip düzenliyoruz.
  iifeScope.through.forEach((ref) => {
    const name = ref.identifier.name;

    if (stateVarNames.has(name)) {
      neededStateImport.needed = true;
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

    if (funcToFile[name] && funcToFile[name] !== fileName && !ownFunctionNames.has(name)) {
      neededFunctionImports.add(name + "::" + funcToFile[name]);
    }
    // Diğer durumda (tarayıcı API'si, window.i18n, harici config nesnesi vb.)
    // hiçbir şey yapmıyoruz — global olarak kalmaya devam eder.
  });

  // Düzenlemeleri uygula (kabuk pozisyonlarına göre; kabuk "(function () {\n" ile
  // başladığı için raw metindeki pozisyonlardan kabuk uzunluğu kadar KAYMIŞ durumda,
  // bunu telafi ediyoruz).
  const wrapperPrefixLen = "(function () {\n".length;
  edits.sort((a, b) => b.start - a.start);
  let result = raw;
  edits.forEach((edit) => {
    const start = edit.start - wrapperPrefixLen;
    const end = edit.end - wrapperPrefixLen;
    result = result.slice(0, start) + edit.newText + result.slice(end);
  });

  // Bu dosyadaki her "function İsim(" tanımının başına "export " ekle.
  // (Sadece ÜST DÜZEY fonksiyon tanımları — iç içe olanlara dokunmuyoruz.)
  result = result.replace(/^function (\w+)\(/gm, "export function $1(");

  // İçe aktarma (import) satırlarını oluştur.
  const importLines = [];
  if (neededStateImport.needed) {
    importLines.push(`import { state } from './${STATE_FILE}';`);
  }
  // Aynı dosyadan gelen importları grupla.
  const importsByFile = {};
  neededFunctionImports.forEach((entry) => {
    const [fnName, fromFile] = entry.split("::");
    if (!importsByFile[fromFile]) importsByFile[fromFile] = [];
    importsByFile[fromFile].push(fnName);
  });
  Object.keys(importsByFile)
    .sort()
    .forEach((fromFile) => {
      const names = importsByFile[fromFile].sort().join(", ");
      importLines.push(`import { ${names} } from './${fromFile}';`);
    });

  const header = importLines.length ? importLines.join("\n") + "\n\n" : "";
  return header + result;
}

// Tüm dosyaları (state ve header hariç) dönüştür.
const allFiles = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith(".js"));
const toConvert = allFiles.filter((f) => f !== STATE_FILE && f !== "00-header.js" && f !== "99-main.js");

toConvert.forEach((fileName) => {
  const converted = convertFile(fileName);
  fs.writeFileSync(path.join(SRC_DIR, fileName), converted);
  console.log("Dönüştürüldü:", fileName);
});

console.log("\nToplam dönüştürülen dosya:", toConvert.length);
