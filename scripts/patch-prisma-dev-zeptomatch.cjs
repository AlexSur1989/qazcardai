/**
 * Prisma CLI 7.8 bundles @prisma/dev, whose state.cjs does require('zeptomatch').
 * zeptomatch>=2 is ESM-only → Node ERR_REQUIRE_ESM breaks every prisma command.
 *
 * Replace the zeptomatch default export with picomatch (CJS), matching the filter
 * used in directory scans: `(glob, dirname) => boolean` and arrays of globs.
 */
const fs = require("fs");
const path = require("path");

const MARKER = "// patched-zeptomatch-picomatch-qazcard";

function main() {
  const root = path.join(__dirname, "..");
  const statePath = path.join(root, "node_modules", "@prisma", "dev", "dist", "state.cjs");

  if (!fs.existsSync(statePath)) {
    console.info("[patch-prisma-dev] skip: @prisma/dev not installed");
    return;
  }

  let s = fs.readFileSync(statePath, "utf8");
  if (s.includes(MARKER)) {
    console.info("[patch-prisma-dev] already patched");
    return;
  }

  const needle = `var ne=T(require("zeptomatch"),1),`;
  if (!s.includes(needle)) {
    console.warn('[patch-prisma-dev] needle not found ("zeptomatch" require) — skipping');
    return;
  }

  const replacement = `${MARKER}
var picomatch=require("picomatch");
var ne=T({default:function(e,t){if(!e)return true;var n=String(t);function m(g){try{return picomatch(String(g),{dot:!0})(n);}catch{return !1}}return Array.isArray(e)?e.some(m):m(e);}},1),`;

  s = s.replace(needle, replacement);
  fs.writeFileSync(statePath, s, "utf8");
  console.info("[patch-prisma-dev] patched @prisma/dev/dist/state.cjs (zeptomatch → picomatch)");
}

main();
