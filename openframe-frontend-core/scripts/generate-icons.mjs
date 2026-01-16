#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const ICONS_V2_DIR = join(rootDir, 'src/components/icons-v2');
const OUTPUT_DIR = join(rootDir, 'src/components/icons-v2-generated');

// Convert kebab-case or space-separated to PascalCase
function toPascalCase(str) {
  return str
    .split(/[-\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// Normalize filename to kebab-case
function toKebabCase(str) {
  return str.replace(/\s+/g, '-').toLowerCase();
}

// Get all category directories
function getCategories() {
  return readdirSync(ICONS_V2_DIR).filter((item) => {
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
        `Please rename the file to start with a letter (e.g., "point-100" instead of "100-point").`
      );
    }
  }

  return svgFiles;
}

// Process generated files in a category
function processGeneratedCategory(categoryPath, originalNames) {
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
  const indexContent = exports
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
console.log('Generating icons from icons-v2...\n');

// Clean output directory
if (existsSync(OUTPUT_DIR)) {
  execSync(`rm -rf "${OUTPUT_DIR}"`, { cwd: rootDir });
}
mkdirSync(OUTPUT_DIR, { recursive: true });

const categories = getCategories();
let totalIcons = 0;

for (const category of categories) {
  const inputPath = join(ICONS_V2_DIR, category);
  const outputPath = join(OUTPUT_DIR, category);

  console.log(`Processing ${category}...`);

  // Get original SVG names before SVGR transforms them
  const originalNames = getOriginalSvgNames(inputPath);

  // Run SVGR for entire category at once
  try {
    execSync(
      `npx @svgr/cli --config-file svgr.config.cjs --out-dir "${outputPath}" -- "${inputPath}"`,
      { cwd: rootDir, stdio: 'pipe' }
    );

    // Post-process generated files
    const count = processGeneratedCategory(outputPath, originalNames);
    console.log(`  Generated ${count} icons`);
    totalIcons += count;
  } catch (error) {
    console.error(`  Error: ${error.message}`);
  }
}

// Generate root index.ts
const categoryExports = categories
  .filter((cat) => existsSync(join(OUTPUT_DIR, cat, 'index.ts')))
  .map((cat) => `export * from './${cat}';`)
  .join('\n');

writeFileSync(join(OUTPUT_DIR, 'index.ts'), categoryExports + '\n');

console.log(`\nDone! Generated ${totalIcons} icon components.`);
