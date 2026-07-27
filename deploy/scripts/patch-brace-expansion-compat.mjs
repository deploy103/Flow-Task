import { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dependencyRoot = new URL("../../node_modules", import.meta.url).pathname;
const legacyImport = "var expand = require('brace-expansion')";
const compatibleImport = [
  "var braceExpansion = require('brace-expansion')",
  "var expand = typeof braceExpansion === 'function' ? braceExpansion : braceExpansion.expand",
].join("\n");

function patchLegacyMinimatch(directory) {
  if (!existsSync(directory)) return 0;

  let patchedFiles = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      patchedFiles += patchLegacyMinimatch(entryPath);
      continue;
    }
    if (entry.name !== "minimatch.js" || lstatSync(entryPath).size > 200_000) continue;

    const source = readFileSync(entryPath, "utf8");
    if (!source.includes(legacyImport)) continue;
    writeFileSync(entryPath, source.replace(legacyImport, compatibleImport));
    patchedFiles += 1;
  }
  return patchedFiles;
}

const patchedFiles = patchLegacyMinimatch(dependencyRoot);
process.stdout.write(`brace-expansion compatibility applied to ${patchedFiles} file(s)\n`);
