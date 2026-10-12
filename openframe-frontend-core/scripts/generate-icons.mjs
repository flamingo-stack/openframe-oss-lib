#!/usr/bin/env node

import { execSync } from 'child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { writeIconLoaders } from './generate-icon-loaders.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const ICONS_V2_DIR = join(rootDir, 'src/components/icons-v2');
const OUTPUT_DIR = join(rootDir, 'src/components/icons-v2-generated');

// An icon's own colours, by `<category>/<file name>`: the default of its
// `color` prop when that is not the text colour of its slot (a brand's orange, a
// mark that is the theme's text colour wherever it sits), and, for a mark drawn
// in more than one colour, the defaults of `secondaryColor` / `tertiaryColor`
// (the parts its SVG paints `#fe0001` / `#fe0002`). ODS tokens only.
const ICON_COLORS = JSON.parse(readFileSync(join(ICONS_V2_DIR, 'icon-colors.json'), 'utf8'));

// Convert kebab-case or space-separated to PascalCase
function toPascalCase(str) {
  return str
    .split(/[-\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// Normalize filename to kebab-case
function toKebabCase(str) {
  return str.replace(/\s+/g, '-').toLowerCase();
}

// SVGO's prefixIds (run by SVGR) prefixes `id` attributes but does NOT
// update the SMIL timing references in `begin`/`end` that point at them
// (e.g. `begin="0;a.end-0.25s"` while the id became `prefix__a`). That
// silently breaks looping animations after the first cycle. Re-sync the
// references to the actual prefixed ids.
function fixSmilReferences(content) {
  const ids = [...content.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  if (ids.length === 0) return content;

  // Map the "bare" id (token after the last `__`, i.e. the form SVGO
  // leaves behind inside begin/end) to the actual prefixed id.
  const bareToFull = new Map();
  for (const id of ids) {
    const bare = id.includes('__') ? id.slice(id.lastIndexOf('__') + 2) : id;
    if (bare !== id) bareToFull.set(bare, id);
  }
  if (bareToFull.size === 0) return content;

  return content.replace(/\b(begin|end)="([^"]+)"/g, (_m, attr, value) => {
    const fixed = value.replace(/(?<![\w-])([\w-]+)\.(begin|end)/g, (ref, token, evt) =>
      bareToFull.has(token) ? `${bareToFull.get(token)}.${evt}` : ref,
    );
    return `${attr}="${fixed}"`;
  });
}

// Get all category directories
function getCategories() {
  return readdirSync(ICONS_V2_DIR).filter(item => {
    const itemPath = join(ICONS_V2_DIR, item);
    return statSync(itemPath).isDirectory() && !item.startsWith('.');
  });
}

// Get original SVG file names for a category (kebab-case base names)
function getOriginalSvgNames(categoryPath) {
  const svgFiles = readdirSync(categoryPath)
    .filter(f => f.endsWith('.svg'))
    .map(f => basename(f, '.svg'));

  // Validate that no file names start with a number
  for (const name of svgFiles) {
    if (/^\d/.test(name)) {
      throw new Error(
        `Invalid icon name: "${name}" starts with a number. ` +
          `Icon names cannot start with numbers as they would generate invalid JavaScript/TypeScript identifiers. ` +
          `Please rename the file to start with a letter (e.g., "point-100" instead of "100-point").`,
      );
    }
  }

  return svgFiles;
}

// Process generated files in a category
function processGeneratedCategory(categoryPath, originalNames, category = basename(categoryPath)) {
  const files = readdirSync(categoryPath).filter(f => f.endsWith('.tsx') && f !== 'index.tsx');
  const exports = [];

  // Create mapping from SVGR generated file name (PascalCase, lowercase) to original kebab name
  const nameMap = new Map();
  for (const origName of originalNames) {
    // SVGR converts kebab-case "alphabet-a-circle" to PascalCase "AlphabetACircle" for filename
    // Use lowercase for comparison to handle edge cases like "3d" -> "3D"
    const svgrFileName = toPascalCase(origName).toLowerCase();
    nameMap.set(svgrFileName, origName);
  }

  for (const file of files) {
    const filePath = join(categoryPath, file);
    const svgrBaseName = basename(file, '.tsx'); // e.g., "AlphabetA" or "Standard3D"

    // Find original kebab name (case-insensitive comparison)
    const kebabName = nameMap.get(svgrBaseName.toLowerCase());
    if (!kebabName) {
      console.warn(`    Warning: Could not find original name for ${svgrBaseName}`);
      continue;
    }

    // Normalize to kebab-case (handles spaces in original filename)
    const normalizedKebabName = toKebabCase(kebabName);
    const componentName = toPascalCase(kebabName) + 'Icon';
    const propsName = componentName + 'Props';
    const newFileName = `${normalizedKebabName}-icon.tsx`;
    const newFilePath = join(categoryPath, newFileName);

    // Read and fix component content
    let content = readFileSync(filePath, 'utf8');

    // SVGR adds "Svg" prefix to function and props names
    const svgrFuncName = 'Svg' + svgrBaseName;
    const svgrPropsName = svgrFuncName + 'Props';

    content = content
      .replace(new RegExp(`interface ${svgrPropsName}`, 'g'), `interface ${propsName}`)
      .replace(new RegExp(`}: ${svgrPropsName}`, 'g'), `}: ${propsName}`)
      .replace(new RegExp(`function ${svgrFuncName}\\(`, 'g'), `function ${componentName}(`);

    content = fixSmilReferences(content);

    const colors = ICON_COLORS[`${category}/${normalizedKebabName}`] ?? {};
    if (colors.color) {
      content = content.replace(/color = (['"])currentColor\1/, `color = ${JSON.stringify(colors.color)}`);
    }
    // A mark with more colours than one takes each as a prop of its own.
    for (const extra of ['secondaryColor', 'tertiaryColor']) {
      if (!content.includes(`{${extra}}`)) continue;
      if (!colors[extra]) throw new Error(`${normalizedKebabName}: icon-colors.json names no ${extra}`);
      content = content
        .replace(/(\n\s*)color\?: string;/, `$1color?: string;$1${extra}?: string;`)
        .replace(/(\n\s*)(color = (?:'[^']*'|"[^"]*"),)/, `$1$2$1${extra} = ${JSON.stringify(colors[extra])},`);
    }

    writeFileSync(newFilePath, content);

    // Remove old file
    if (file !== newFileName) {
      unlinkSync(filePath);
    }

    exports.push({ componentName, kebabName: normalizedKebabName });
  }

  // Sort exports alphabetically
  exports.sort((a, b) => a.componentName.localeCompare(b.componentName));

  // Generate index.ts
  const indexContent =
    exports
      .map(({ componentName, kebabName }) => `export { ${componentName} } from './${kebabName}-icon';`)
      .join('\n') + '\n';

  writeFileSync(join(categoryPath, 'index.ts'), indexContent);

  // Remove index.tsx if exists
  const indexTsx = join(categoryPath, 'index.tsx');
  if (existsSync(indexTsx)) {
    unlinkSync(indexTsx);
  }

  return exports.length;
}

// Main execution
//
// CLI:
//   node scripts/generate-icons.mjs                # regenerate every category
//   node scripts/generate-icons.mjs <category>     # regenerate one category only
//   node scripts/generate-icons.mjs <category> <icon> [<icon> ...]
//                                                  # add or regenerate the named icons only
//
// `<category>` is the subfolder name under `src/components/icons-v2/`
// (e.g. `brand-logos`, `arrows`). The single-category form is a scoped
// rebuild — it does NOT wipe the whole output dir, only the matching
// subfolder, so unrelated categories on disk survive. The root
// `index.ts` is rebuilt from what's actually present in OUTPUT_DIR
// after the run (not from the source listing), so missing categories
// stay missing and added categories get picked up automatically.
const targetCategory = process.argv[2];
const targetIcons = process.argv.slice(3);

/**
 * The named icons of one category, and nothing else: every other icon of the
 * category is left exactly as it is on disk. An icon is named by its SVG's file
 * name without the extension.
 */
function generateNamedIcons(category, icons) {
  const inputPath = join(ICONS_V2_DIR, category);
  const outputPath = join(OUTPUT_DIR, category);
  const work = mkdtempSync(join(tmpdir(), 'icons-'));
  const workIn = join(work, 'in');
  const workOut = join(work, 'out');
  mkdirSync(workIn);
  for (const icon of icons) {
    if (!existsSync(join(inputPath, `${icon}.svg`))) throw new Error(`No ${category}/${icon}.svg`);
    copyFileSync(join(inputPath, `${icon}.svg`), join(workIn, `${icon}.svg`));
  }
  execSync(`npx @svgr/cli --config-file svgr.config.cjs --out-dir "${workOut}" -- "${workIn}"`, {
    cwd: rootDir,
    stdio: 'pipe',
  });
  processGeneratedCategory(workOut, icons, category);
  mkdirSync(outputPath, { recursive: true });
  const written = readdirSync(workOut).filter(file => file.endsWith('-icon.tsx'));
  for (const file of written) renameSync(join(workOut, file), join(outputPath, file));
  rmSync(work, { recursive: true, force: true });

  // The category's index names every icon now in it.
  const exports = readdirSync(outputPath)
    .filter(file => file.endsWith('-icon.tsx'))
    .map(file => ({
      file: basename(file, '.tsx'),
      name: /export function (\w+)/.exec(readFileSync(join(outputPath, file), 'utf8'))?.[1],
    }))
    .filter(entry => entry.name)
    .sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(
    join(outputPath, 'index.ts'),
    exports.map(({ name, file }) => `export { ${name} } from './${file}';`).join('\n') + '\n',
  );
  const files = [...written.map(file => join(outputPath, file)), join(outputPath, 'index.ts')];
  execSync(`npx prettier --write ${files.map(file => `"${file}"`).join(' ')}`, { cwd: rootDir, stdio: 'pipe' });
  return written.length;
}

const allCategories = getCategories();
let categoriesToProcess;
if (targetCategory && !allCategories.includes(targetCategory)) {
  console.error(`Unknown category: "${targetCategory}".\n` + `Available: ${allCategories.join(', ')}`);
  process.exit(1);
}
let namedIconCount = 0;
if (targetCategory && targetIcons.length > 0) {
  categoriesToProcess = [];
  console.log(`Generating ${targetIcons.length} icon(s) of "${targetCategory}"...\n`);
  namedIconCount = generateNamedIcons(targetCategory, targetIcons);
} else if (targetCategory) {
  categoriesToProcess = [targetCategory];
  console.log(`Generating icons for category "${targetCategory}"...\n`);

  // Scoped wipe — only the matching output subfolder, so other
  // categories on disk are preserved across single-category runs.
  const targetOutputPath = join(OUTPUT_DIR, targetCategory);
  if (existsSync(targetOutputPath)) {
    execSync(`rm -rf "${targetOutputPath}"`, { cwd: rootDir });
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });
} else {
  categoriesToProcess = allCategories;
  console.log('Generating icons from icons-v2...\n');

  // Full rebuild — wipe everything so removed source categories don't
  // leave stale output behind.
  if (existsSync(OUTPUT_DIR)) {
    execSync(`rm -rf "${OUTPUT_DIR}"`, { cwd: rootDir });
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

let totalIcons = namedIconCount;

for (const category of categoriesToProcess) {
  const inputPath = join(ICONS_V2_DIR, category);
  const outputPath = join(OUTPUT_DIR, category);

  console.log(`Processing ${category}...`);

  // Get original SVG names before SVGR transforms them
  const originalNames = getOriginalSvgNames(inputPath);

  // Run SVGR for entire category at once
  try {
    execSync(`npx @svgr/cli --config-file svgr.config.cjs --out-dir "${outputPath}" -- "${inputPath}"`, {
      cwd: rootDir,
      stdio: 'pipe',
    });

    // Post-process generated files
    const count = processGeneratedCategory(outputPath, originalNames);
    console.log(`  Generated ${count} icons`);
    totalIcons += count;
  } catch (error) {
    console.error(`  Error: ${error.message}`);
  }
}

// Regenerate root index.ts from what's actually on disk in OUTPUT_DIR
// (not from the source listing) so single-category runs preserve any
// categories that already exist in OUTPUT_DIR but weren't touched.
const presentCategories = readdirSync(OUTPUT_DIR).filter(
  item => statSync(join(OUTPUT_DIR, item)).isDirectory() && existsSync(join(OUTPUT_DIR, item, 'index.ts')),
);
presentCategories.sort();

const categoryExports = presentCategories.map(cat => `export * from './${cat}';`).join('\n');

writeFileSync(join(OUTPUT_DIR, 'index.ts'), categoryExports + '\n');

// The per-icon loader table follows the set (see generate-icon-loaders.mjs).
console.log(`Wrote loaders for ${writeIconLoaders()} icons.`);

console.log(`\nDone! Generated ${totalIcons} icon components.`);
