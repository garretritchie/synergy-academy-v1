import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) throw new Error("Pass a SQL file path.");
const sql = readFileSync(file, "utf8");
let state = "normal";
let dollarTag = "";
let depth = 0;
let statements = 0;
let hasContent = false;

for (let index = 0; index < sql.length; index += 1) {
  const char = sql[index];
  const next = sql[index + 1] || "";

  if (state === "line-comment") {
    if (char === "\n") state = "normal";
    continue;
  }
  if (state === "block-comment") {
    if (char === "*" && next === "/") {
      state = "normal";
      index += 1;
    }
    continue;
  }
  if (state === "single-quote") {
    if (char === "'" && next === "'") index += 1;
    else if (char === "'") state = "normal";
    continue;
  }
  if (state === "double-quote") {
    if (char === '"' && next === '"') index += 1;
    else if (char === '"') state = "normal";
    continue;
  }
  if (state === "dollar-quote") {
    if (sql.startsWith(dollarTag, index)) {
      state = "normal";
      index += dollarTag.length - 1;
    }
    continue;
  }

  if (char === "-" && next === "-") {
    state = "line-comment";
    index += 1;
    continue;
  }
  if (char === "/" && next === "*") {
    state = "block-comment";
    index += 1;
    continue;
  }
  if (char === "'") {
    state = "single-quote";
    hasContent = true;
    continue;
  }
  if (char === '"') {
    state = "double-quote";
    hasContent = true;
    continue;
  }
  if (char === "$") {
    const match = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
    if (match) {
      dollarTag = match[0];
      state = "dollar-quote";
      hasContent = true;
      index += dollarTag.length - 1;
      continue;
    }
  }
  if (char === "(") depth += 1;
  if (char === ")") depth -= 1;
  if (depth < 0) throw new Error(`Unexpected closing parenthesis at offset ${index}.`);
  if (!/\s/.test(char)) hasContent = true;
  if (char === ";" && depth === 0 && hasContent) {
    statements += 1;
    hasContent = false;
  }
}

if (state !== "normal" && state !== "line-comment") {
  throw new Error(`Unclosed SQL construct: ${state}.`);
}
if (depth !== 0) throw new Error(`Unbalanced parentheses: depth ${depth}.`);
if (hasContent) throw new Error("Final SQL statement is missing a semicolon.");
console.log(`SQL structure OK: ${statements} terminated statements, balanced quotes and parentheses.`);
