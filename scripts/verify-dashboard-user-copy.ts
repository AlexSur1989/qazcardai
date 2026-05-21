/**
 * Запрещённые технические формулировки в клиентском кабинете (/dashboard UI).
 * npm run verify:dashboard-user-copy
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "src");
const SCAN_DIRS = [
  path.join(ROOT, "app", "dashboard"),
  path.join(ROOT, "components", "dashboard"),
];

/** Файлы, где допустимы админские подписи (общий компонент с showTechnicalDetails). */
const ALLOW_PROMPT_LABEL_FILES = new Set([
  "generation-detail-view.tsx",
]);

type Rule = {
  id: string;
  pattern: RegExp;
  /** Если задан — правило не применяется к этим basename файлов. */
  skipBasenames?: Set<string>;
};

const RULES: Rule[] = [
  { id: "kie-url", pattern: /kie\.ai/i },
  { id: "kie-word", pattern: /\bKie\b/i },
  { id: "apiModelId", pattern: /apiModelId/i },
  { id: "payloadMapping", pattern: /payloadMapping/i },
  { id: "worker-ru", pattern: /воркер/i },
  {
    id: "prompt-ru",
    pattern: /промпт/i,
    skipBasenames: ALLOW_PROMPT_LABEL_FILES,
  },
  {
    id: "queue-phrase",
    pattern: /поставлен в очередь|постановка в очередь|в очереди/i,
    skipBasenames: undefined,
  },
  {
    id: "settingsSchema-kie",
    pattern: /settingsSchema[^;\n]{0,80}Kie/i,
  },
];

function collectFiles(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      collectFiles(full, out);
      continue;
    }
    if (/\.(tsx|ts)$/.test(name)) {
      out.push(full);
    }
  }
}

function isSkippableLine(line: string): boolean {
  const t = line.trim();
  if (t.startsWith("import ")) return true;
  if (t.startsWith("} from ")) return true;
  if (/\bKIE_SETTINGS_URL_LIST_FROM_COMPUTER\b/.test(line)) return true;
  if (/\bkie-computer-upload-fields\b/.test(line)) return true;
  if (/\bCardBuilderBlockPayload\b/.test(line)) return true;
  if (/\bplanPayload\b/.test(line)) return true;
  if (/\bsource:\s*["']payload["']/.test(line)) return true;
  if (/\bsettingsSchema:\s*true\b/.test(line)) return true;
  if (/\bsettingsSchema:\s*row/.test(line)) return true;
  return false;
}

function main(): void {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) {
    collectFiles(dir, files);
  }
  assert.ok(files.length > 20, `Ожидались файлы dashboard, найдено ${files.length}`);

  const violations: string[] = [];

  for (const file of files.sort()) {
    const basename = path.basename(file);
    const rel = path.relative(process.cwd(), file);
    const lines = fs.readFileSync(file, "utf8").split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isSkippableLine(line)) continue;

      for (const rule of RULES) {
        if (rule.skipBasenames?.has(basename)) continue;
        if (rule.pattern.test(line)) {
          violations.push(`${rel}:${i + 1} [${rule.id}] ${line.trim().slice(0, 120)}`);
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error("Найдены запрещённые формулировки в dashboard UI:\n");
    for (const v of violations) {
      console.error(`  ${v}`);
    }
    process.exit(1);
  }

  console.log(`verify:dashboard-user-copy OK (${files.length} files)`);
}

main();
