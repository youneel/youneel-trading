import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const I18N_PATH = path.join(ROOT, 'src', 'lib', 'i18n.ts');
const SRC_DIR = path.join(ROOT, 'src');

const INTENTIONAL_SAME_KEYS = new Set([
  'brand',
  'hfmName',
  'tmgmName',
  'contactInstagramHandle',
  'contactEmailValue',
  'emailPlaceholder',
  'chartEngineTradingView',
  'notAvailableShort',
  'themeToggle',
  'langToggle',
]);

const PROHIBITED_PATTERNS = [
  { label: 'Google OAuth button copy', regex: /Continue with Google/i },
  { label: 'signInWithGoogle identifier', regex: /\bsignInWithGoogle\b/ },
  { label: 'loginWithGoogle identifier', regex: /\bloginWithGoogle\b/ },
  { label: 'Legacy giveaways naming', regex: /Custom Giveaways/i },
  { label: 'Legacy giveaways JSON file', regex: /custom-giveaways\.json/i },
  { label: 'Internal SQL migration path', regex: /001_giveaways_and_security\.sql/i },
];

function walkFiles(dir, exts) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

async function loadTranslations() {
  const result = esbuild.buildSync({
    entryPoints: [I18N_PATH],
    bundle: false,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
  });
  const code = result.outputFiles[0].text;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code, 'utf8').toString('base64')}`;
  const mod = await import(dataUrl);
  if (!mod?.translations?.en || !mod?.translations?.ar) {
    throw new Error('Failed to load translations.en / translations.ar from src/lib/i18n.ts');
  }
  return mod.translations;
}

function hasArabicScript(str) {
  return /[\u0600-\u06FF]/.test(str);
}

async function main() {
  const translations = await loadTranslations();
  const en = translations.en;
  const ar = translations.ar;

  const enKeys = Object.keys(en);
  const arKeys = Object.keys(ar);
  const enSet = new Set(enKeys);
  const arSet = new Set(arKeys);

  const errors = [];
  const warnings = [];

  for (const k of enKeys) {
    if (!arSet.has(k)) {
      errors.push(`Missing Arabic key: "${k}"`);
    }
  }
  for (const k of arKeys) {
    if (!enSet.has(k)) {
      errors.push(`Extra Arabic key missing from English: "${k}"`);
    }
  }

  for (const k of enKeys) {
    if (!arSet.has(k)) continue;
    const ev = en[k];
    const av = ar[k];

    if (typeof ev !== typeof av || Array.isArray(ev) !== Array.isArray(av)) {
      errors.push(`Type mismatch for key "${k}": en=${typeof ev}, ar=${typeof av}`);
      continue;
    }

    if (Array.isArray(ev)) {
      if (ev.length !== av.length) {
        errors.push(`Array length mismatch for key "${k}": en=${ev.length}, ar=${av.length}`);
      }
      ev.forEach((item, idx) => {
        if (typeof item !== 'string' || !item.trim()) {
          errors.push(`Empty English array item at ${k}[${idx}]`);
        }
      });
      av.forEach((item, idx) => {
        if (typeof item !== 'string' || !item.trim()) {
          errors.push(`Empty Arabic array item at ${k}[${idx}]`);
        } else if (!hasArabicScript(item)) {
          errors.push(`Arabic array item lacks Arabic script at ${k}[${idx}]: "${item}"`);
        }
      });
      continue;
    }

    if (typeof ev !== 'string' || !ev.trim()) {
      errors.push(`Empty English string for key "${k}"`);
    }
    if (typeof av !== 'string' || !av.trim()) {
      errors.push(`Empty Arabic string for key "${k}"`);
      continue;
    }

    if (!INTENTIONAL_SAME_KEYS.has(k)) {
      if (av === ev) {
        errors.push(`Untranslated Arabic key (matches English) "${k}": "${av}"`);
      } else if (!hasArabicScript(av)) {
        warnings.push(`Arabic key "${k}" contains no Arabic script characters: "${av}"`);
      }
    }
  }

  // Scan src/ files for referenced translation keys & prohibited strings
  const srcFiles = walkFiles(SRC_DIR, ['.ts', '.tsx']);
  const referencedKeys = new Set();

  for (const file of srcFiles) {
    const rel = path.relative(ROOT, file);
    const content = fs.readFileSync(file, 'utf8');

    for (const rule of PROHIBITED_PATTERNS) {
      if (rule.regex.test(content)) {
        errors.push(`Prohibited pattern (${rule.label}) found in ${rel}`);
      }
    }

    if (rel === path.join('src', 'lib', 'i18n.ts')) continue;

    const usesTranslationBinding = /\bconst\s+t\s*=\s*translations\[/.test(content);
    if (usesTranslationBinding) {
      const dotRegex = /\bt\.([a-zA-Z0-9_]+)\b/g;
      let m;
      while ((m = dotRegex.exec(content)) !== null) {
        const key = m[1];
        referencedKeys.add(key);
        if (!enSet.has(key)) {
          errors.push(`Unknown translation key "t.${key}" referenced in ${rel}`);
        }
      }
    }

    const directRegex = /\btranslations\[[^\]]+\]\.([a-zA-Z0-9_]+)\b/g;
    let m;
    while ((m = directRegex.exec(content)) !== null) {
      const key = m[1];
      referencedKeys.add(key);
      if (!enSet.has(key)) {
        errors.push(`Unknown translation key "translations[...].${key}" referenced in ${rel}`);
      }
    }

    const trRegex = /\btr\(\s*[a-zA-Z0-9_]+\s*,\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g;
    while ((m = trRegex.exec(content)) !== null) {
      const key = m[1];
      referencedKeys.add(key);
      if (!enSet.has(key)) {
        errors.push(`Unknown translation key tr(..., "${key}") referenced in ${rel}`);
      }
    }
  }

  console.log(`[audit:i18n] English keys: ${enKeys.length} | Arabic keys: ${arKeys.length} | Scanned files: ${srcFiles.length} | Verified referenced keys: ${referencedKeys.size}`);
  if (warnings.length > 0) {
    console.log(`[audit:i18n] Warnings (${warnings.length}):`);
    for (const w of warnings) console.log(`  - WARN: ${w}`);
  }
  if (errors.length > 0) {
    console.error(`[audit:i18n] FAILED with ${errors.length} error(s):`);
    for (const e of errors) console.error(`  - ERROR: ${e}`);
    process.exit(1);
  }
  console.log('[audit:i18n] PASS: 100% EN/AR key parity, valid Arabic localization, and zero legacy/leaked strings.');
}

main().catch((err) => {
  console.error('[audit:i18n] Unexpected failure:', err);
  process.exit(1);
});
