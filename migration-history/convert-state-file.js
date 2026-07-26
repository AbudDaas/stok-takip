const fs = require("fs");
const acorn = require("acorn");

const filePath = "/home/claude/bakkal-app-refactored/src/00-state.js";
const raw = fs.readFileSync(filePath, "utf8");

const wrapped = "(function () {\n" + raw + "\n})();";
const ast = acorn.parse(wrapped, { ecmaVersion: 2022, sourceType: "script", ranges: true });
const body = ast.body[0].expression.callee.body.body;

const wrapperPrefixLen = "(function () {\n".length;

const lines = ["export const state = {};", ""];
body.forEach((n) => {
  if (n.type !== "VariableDeclaration") return;
  n.declarations.forEach((d) => {
    if (!d.id || !d.id.name) return;
    const initText = d.init ? raw.slice(d.init.start - wrapperPrefixLen, d.init.end - wrapperPrefixLen) : "undefined";
    lines.push(`state.${d.id.name} = ${initText};`);
  });
});

fs.writeFileSync(filePath, lines.join("\n") + "\n");
console.log("00-state.js dönüştürüldü, satır sayısı:", lines.length);
