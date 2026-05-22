/**
 * Генерирует лёгкие абстрактные SVG-превью для концепций Product Card.
 * Запуск: node scripts/gen-product-card-concept-svgs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "public", "product-card", "concepts");

const SPECS = [
  ["apparel", "on_model"],
  ["apparel", "studio_catalog"],
  ["apparel", "flat_lay"],
  ["apparel", "lifestyle_hands"],
  ["apparel", "fabric_closeup"],
  ["apparel", "full_look"],
  ["accessories", "studio_catalog"],
  ["accessories", "on_model"],
  ["accessories", "premium_lifestyle"],
  ["accessories", "detail_closeup"],
  ["accessories", "in_composition"],
  ["accessories", "ad_poster"],
  ["food-and-drinks", "studio_catalog"],
  ["food-and-drinks", "serving"],
  ["food-and-drinks", "ingredients"],
  ["food-and-drinks", "closeup_texture"],
  ["food-and-drinks", "lifestyle_hands"],
  ["food-and-drinks", "ad_banner"],
  ["beauty-and-care", "studio_catalog"],
  ["beauty-and-care", "beauty_premium"],
  ["beauty-and-care", "ingredients"],
  ["beauty-and-care", "shelf_bathroom"],
  ["beauty-and-care", "texture"],
  ["beauty-and-care", "hands_model"],
  ["gadgets-and-tech", "studio_catalog"],
  ["gadgets-and-tech", "tech_ads"],
  ["gadgets-and-tech", "in_use"],
  ["gadgets-and-tech", "detail_closeup"],
  ["gadgets-and-tech", "desk_setup"],
  ["gadgets-and-tech", "hero_poster"],
  ["home-and-furniture", "studio_catalog"],
  ["home-and-furniture", "in_interior"],
  ["home-and-furniture", "minimal"],
  ["home-and-furniture", "cozy"],
  ["home-and-furniture", "material_closeup"],
  ["home-and-furniture", "premium_poster"],
  ["other", "studio_catalog"],
  ["other", "lifestyle"],
  ["other", "in_use"],
];

/** Уникальный «рисунок» под смысл концепции — только простые фигуры, без фото */
function shapesFor(conceptId) {
  switch (conceptId) {
    case "on_model":
      return `<ellipse cx="160" cy="96" rx="44" ry="58" fill="#9ebecf" opacity=".45"/><circle cx="160" cy="52" r="26" fill="#b8dce6" opacity=".55"/>`;
    case "studio_catalog":
      return `<rect x="108" y="56" width="104" height="108" rx="10" fill="#7eb8d4" opacity=".4"/><rect x="124" y="72" width="72" height="76" rx="6" fill="#00afca" opacity=".22"/>`;
    case "flat_lay":
      return `<rect x="72" y="88" width="176" height="56" rx="8" transform="rotate(-8 160 116)" fill="#b8dce6" opacity=".65"/><circle cx="118" cy="98" r="18" fill="#00afca" opacity=".25"/><rect x="178" y="102" width="64" height="28" rx="4" fill="#7eb8d4" opacity=".45"/>`;
    case "lifestyle_hands":
      return `<path d="M56 140 Q110 72 160 88 Q210 72 264 140" stroke="#00afca" stroke-width="14" fill="none" opacity=".35" stroke-linecap="round"/><circle cx="160" cy="118" r="36" fill="#b8dce6" opacity=".4"/>`;
    case "fabric_closeup":
      return `<path d="M40 120 Q80 88 120 120 T200 120 T280 120 L280 140 Q200 100 120 140 T40 140 Z" fill="#8ebfd4" opacity=".55"/><path d="M48 132 Q120 96 200 132" stroke="#00afca" stroke-width="4" fill="none" opacity=".35"/>`;
    case "full_look":
      return `<rect x="118" y="52" width="84" height="112" rx="12" fill="#9ebecf" opacity=".4"/><rect x="134" y="68" width="52" height="48" rx="6" fill="#00afca" opacity=".22"/><rect x="142" y="128" width="36" height="28" rx="4" fill="#7eb8d4" opacity=".45"/>`;
    case "premium_lifestyle":
      return `<circle cx="200" cy="88" r="56" fill="#c9b8e0" opacity=".35"/><rect x="92" y="96" width="96" height="72" rx="10" fill="#b8dce6" opacity=".5"/>`;
    case "detail_closeup":
      return `<circle cx="160" cy="100" r="58" fill="none" stroke="#00afca" stroke-width="10" opacity=".35"/><circle cx="160" cy="100" r="28" fill="#7eb8d4" opacity=".5"/>`;
    case "in_composition":
      return `<circle cx="118" cy="92" r="24" fill="#b8dce6" opacity=".55"/><rect x="154" y="88" width="68" height="44" rx="6" fill="#00afca" opacity=".28"/><polygon points="96,148 160,118 224,148" fill="#9ebecf" opacity=".4"/>`;
    case "ad_poster":
      return `<rect x="56" y="48" width="208" height="112" rx="6" fill="#1a5f73" opacity=".25"/><rect x="96" y="72" width="128" height="64" rx="4" fill="#00afca" opacity=".35"/>`;
    case "serving":
      return `<ellipse cx="160" cy="112" rx="88" ry="28" fill="#e8d5c4" opacity=".55"/><ellipse cx="160" cy="104" rx="72" ry="18" fill="#f0ebe4" opacity=".75"/><circle cx="160" cy="96" r="32" fill="#c49a6c" opacity=".35"/>`;
    case "ingredients":
      return `<circle cx="108" cy="108" r="22" fill="#7cbf7a" opacity=".45"/><circle cx="160" cy="92" r="26" fill="#f4c430" opacity=".4"/><circle cx="212" cy="108" r="20" fill="#e07050" opacity=".38"/><rect x="138" y="124" width="44" height="36" rx="6" fill="#b8dce6" opacity=".45"/>`;
    case "closeup_texture":
      return `<circle cx="160" cy="100" r="70" fill="#deb887" opacity=".35"/><ellipse cx="145" cy="96" rx="22" ry="14" fill="#c49a6c" opacity=".45"/><ellipse cx="178" cy="108" rx="18" ry="12" fill="#a67c52" opacity=".4"/>`;
    case "ad_banner":
      return `<rect x="32" y="72" width="256" height="68" rx="8" fill="#00afca" opacity=".38"/><rect x="56" y="88" width="208" height="36" rx="4" fill="#ffffff" opacity=".25"/>`;
    case "beauty_premium":
      return `<path d="M120 140 L160 56 L200 140 Z" fill="#f0d4e8" opacity=".55"/><circle cx="160" cy="112" r="32" fill="#e8b8d8" opacity=".45"/>`;
    case "shelf_bathroom":
      return `<rect x="48" y="112" width="224" height="12" rx="2" fill="#b8dce6" opacity=".65"/><rect x="92" y="60" width="56" height="56" rx="6" fill="#c5dde8" opacity=".55"/><rect x="172" y="68" width="48" height="48" rx="6" fill="#9ebecf" opacity=".5"/>`;
    case "texture":
      return `<ellipse cx="160" cy="108" rx="72" ry="48" fill="#f5e6ef" opacity=".65"/><path d="M112 108 Q160 72 208 108" stroke="#d8a8c8" stroke-width="8" fill="none" opacity=".5"/>`;
    case "hands_model":
      return `<ellipse cx="130" cy="124" rx="28" ry="18" fill="#e8c4a8" opacity=".45"/><rect x="148" y="88" width="64" height="72" rx="10" fill="#b8dce6" opacity=".45"/>`;
    case "tech_ads":
      return `<path d="M40 140 L160 44 L280 140 Z" fill="#1e3a5f" opacity=".3"/><rect x="118" y="88" width="84" height="52" rx="6" fill="#00afca" opacity=".4"/>`;
    case "in_use":
      return `<rect x="124" y="72" width="72" height="96" rx="10" fill="#b8dce6" opacity=".45"/><path d="M56 124 Q92 96 124 112" stroke="#7eb8d4" stroke-width="12" fill="none" opacity=".45" stroke-linecap="round"/>`;
    case "desk_setup":
      return `<rect x="48" y="124" width="224" height="16" rx="2" fill="#a67c52" opacity=".35"/><rect x="92" y="72" width="136" height="56" rx="4" fill="#c5dde8" opacity=".55"/><rect x="118" y="88" width="84" height="32" rx="2" fill="#00afca" opacity=".22"/>`;
    case "hero_poster":
      return `<rect x="72" y="56" width="176" height="96" rx="8" fill="#2a4a5c" opacity=".35"/><circle cx="160" cy="104" r="40" fill="#00afca" opacity=".35"/>`;
    case "in_interior":
      return `<rect x="56" y="88" width="208" height="84" rx="4" fill="#d4c4b0" opacity=".4"/><rect x="124" y="64" width="72" height="72" rx="4" fill="#8ebfd4" opacity=".45"/><circle cx="248" cy="72" r="16" fill="#f4e8c8" opacity=".55"/>`;
    case "minimal":
      return `<rect x="132" y="72" width="56" height="72" rx="4" fill="#e8f2f5" opacity=".85"/><line x1="72" y1="152" x2="248" y2="152" stroke="#b8dce6" stroke-width="2" opacity=".7"/>`;
    case "cozy":
      return `<path d="M72 140 Q160 72 248 140" fill="#e8c896" opacity=".35"/><circle cx="118" cy="124" r="16" fill="#f4a460" opacity=".4"/><circle cx="202" cy="124" r="16" fill="#daa520" opacity=".35"/>`;
    case "material_closeup":
      return `<rect x="72" y="72" width="176" height="72" rx="2" fill="#a0522d" opacity=".35"/><path d="M72 96 H288 M72 120 H288 M72 144 H288" stroke="#6b3a1e" stroke-width="3" opacity=".25"/>`;
    case "premium_poster":
      return `<rect x="64" y="56" width="192" height="104" rx="4" fill="#2c3e50" opacity=".28"/><rect x="108" y="80" width="104" height="56" rx="2" fill="#b8dce6" opacity=".4"/>`;
    case "lifestyle":
      return `<circle cx="96" cy="108" r="40" fill="#f4d58d" opacity=".4"/><rect x="148" y="84" width="88" height="64" rx="8" fill="#9ebecf" opacity=".45"/>`;
    case "closeup":
      return `<rect x="108" y="76" width="104" height="72" rx="8" fill="#c5dde8" opacity=".55"/><circle cx="160" cy="112" r="22" fill="#00afca" opacity=".28"/>`;
    case "hero":
      return `<rect x="108" y="64" width="104" height="88" rx="10" fill="#7eb8d4" opacity=".45"/><polygon points="160,52 176,84 144,84" fill="#00afca" opacity=".45"/>`;
    case "clean_studio":
      return `<rect x="96" y="80" width="128" height="56" rx="4" fill="#eef6f8" opacity=".95"/><rect x="112" y="96" width="96" height="24" rx="2" fill="#d8e8ee" opacity=".85"/>`;
    default:
      return `<rect x="112" y="80" width="96" height="56" rx="8" fill="#b8dce6" opacity=".5"/>`;
  }
}

function svgInner(folder, conceptId) {
  const hue =
    {
      apparel: 210,
      accessories: 275,
      "food-and-drinks": 32,
      "beauty-and-care": 310,
      "gadgets-and-tech": 195,
      "home-and-furniture": 42,
      other: 200,
    }[folder] ?? 200;

  const shapes = shapesFor(conceptId);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" width="320" height="200"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="hsl(${hue},42%,94%)"/><stop offset="100%" stop-color="hsl(${hue},35%,82%)"/></linearGradient></defs><rect width="320" height="200" fill="url(#bg)"/>${shapes}</svg>`;
}

function placeholderSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" width="320" height="200"><rect width="320" height="200" fill="#eef6f8"/><rect x="52" y="44" width="216" height="120" rx="16" fill="#ddeef3" stroke="#b8dce6" stroke-width="3" stroke-dasharray="10 8"/><rect x="132" y="84" width="56" height="40" rx="6" fill="#c5dde8" opacity=".65"/></svg>`;
}

fs.mkdirSync(ROOT, { recursive: true });
fs.writeFileSync(path.join(ROOT, "placeholder.svg"), placeholderSvg(), "utf8");

for (const [folder, id] of SPECS) {
  const dir = path.join(ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.svg`), svgInner(folder, id), "utf8");
}

console.log(`OK: placeholder + ${SPECS.length} concept SVGs → ${ROOT}`);
