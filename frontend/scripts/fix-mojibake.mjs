import fs from "fs";
import path from "path";

const ROOTS = ["src"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md"]);

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (EXTENSIONS.has(ext)) results.push(fullPath);
    }
  }
  return results;
}

function looksBroken(text) {
  return /Ã|Ä|Å|â€™|â€œ|â€\u009d|Â|�/.test(text);
}

function fixText(text) {
  return Buffer.from(text, "latin1").toString("utf8");
}

for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;

  for (const file of walk(root)) {
    const original = fs.readFileSync(file, "utf8");

    if (!looksBroken(original)) continue;

    const fixed = fixText(original);

    if (fixed !== original) {
      fs.writeFileSync(file, fixed, "utf8");
      console.log("Duzeltildi:", file);
    }
  }
}

console.log("Tamamlandi.");