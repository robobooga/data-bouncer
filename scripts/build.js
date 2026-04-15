/**
 * Build Script for Bouncer Extension
 * Packages extension for Chrome Web Store submission
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUILD_DIR = path.join(__dirname, '../build');
const ROOT_DIR = path.join(__dirname, '..');

// Helper function to get directory size
function getDirSize(dirPath) {
  let size = 0;
  if (!fs.existsSync(dirPath)) return 0;

  const files = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const file of files) {
    const filePath = path.join(dirPath, file.name);
    if (file.isDirectory()) {
      size += getDirSize(filePath);
    } else {
      size += fs.statSync(filePath).size;
    }
  }
  return size;
}

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

console.log('🏗️  Building Bouncer extension...\n');

// Step 1: Clean build directory
if (fs.existsSync(BUILD_DIR)) {
  console.log('Cleaning build directory...');
  fs.rmSync(BUILD_DIR, { recursive: true });
}
fs.mkdirSync(BUILD_DIR);

// Step 2: Copy necessary files
console.log('Copying files...');

const filesToCopy = [
  'manifest.json',
  'src',
  'vendor',
  'assets'
];

filesToCopy.forEach(file => {
  const source = path.join(ROOT_DIR, file);
  const dest = path.join(BUILD_DIR, file);

  if (fs.existsSync(source)) {
    if (fs.statSync(source).isDirectory()) {
      fs.cpSync(source, dest, { recursive: true });
    } else {
      fs.copyFileSync(source, dest);
    }
    console.log(`  ✓ ${file}`);
  } else {
    console.warn(`  ⚠️  ${file} not found, skipping`);
  }
});

// Remove source files not needed in distribution
const svgPath = path.join(BUILD_DIR, 'assets/icons/icon.svg');
if (fs.existsSync(svgPath)) {
  fs.unlinkSync(svgPath);
  console.log('  ℹ️  Removed source icon.svg from build');
}

// Step 3: Create ZIP for Chrome Web Store
console.log('\nCreating ZIP archive...');
const zipPath = path.join(ROOT_DIR, 'bouncer-extension.zip');

// Remove existing ZIP if present
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

try {
  // Use PowerShell Compress-Archive on Windows, zip on Unix
  if (process.platform === 'win32') {
    execSync(
      `powershell -Command "Compress-Archive -Path '.\\build\\*' -DestinationPath 'bouncer-extension.zip' -Force"`,
      { cwd: ROOT_DIR, stdio: 'inherit' }
    );
  } else {
    execSync(`cd build && zip -r ../bouncer-extension.zip .`, {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });
  }
  console.log('  ✓ bouncer-extension.zip created');
} catch (error) {
  console.error('Failed to create ZIP:', error.message);
}

// Report size breakdown
console.log('\n📊 Package Size Analysis:');
const srcSize = getDirSize(path.join(BUILD_DIR, 'src'));
const vendorSize = getDirSize(path.join(BUILD_DIR, 'vendor'));
const assetsSize = getDirSize(path.join(BUILD_DIR, 'assets'));
const manifestSize = fs.existsSync(path.join(BUILD_DIR, 'manifest.json'))
  ? fs.statSync(path.join(BUILD_DIR, 'manifest.json')).size
  : 0;
const totalSize = getDirSize(BUILD_DIR);

console.log(`  src/        ${formatBytes(srcSize)}`);
console.log(`  vendor/     ${formatBytes(vendorSize)}`);
console.log(`  assets/     ${formatBytes(assetsSize)}`);
console.log(`  manifest    ${formatBytes(manifestSize)}`);
console.log(`  ─────────────────────`);
console.log(`  Total       ${formatBytes(totalSize)} (uncompressed)`);

const finalZipPath = path.join(ROOT_DIR, 'bouncer-extension.zip');
if (fs.existsSync(finalZipPath)) {
  const zipSize = fs.statSync(finalZipPath).size;
  console.log(`  ZIP size    ${formatBytes(zipSize)} (compressed)`);
  const ratio = ((zipSize / totalSize) * 100).toFixed(1);
  console.log(`  Compression ${ratio}%`);
}

console.log('\n✅ Build complete!');
console.log(`📦 Output: ${finalZipPath}`);
console.log('\nNext steps:');
console.log('1. Test the build by loading from build/ directory');
console.log('2. Upload bouncer-extension.zip to Chrome Web Store Developer Dashboard');
