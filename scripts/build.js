/**
 * Build Script for Bouncer Extension
 * Packages extension for Chrome Web Store submission
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUILD_DIR = path.join(__dirname, '../build');
const ROOT_DIR = path.join(__dirname, '..');

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

// Step 3: Create ZIP for Chrome Web Store
console.log('\nCreating ZIP archive...');
try {
  execSync(`cd build && zip -r ../bouncer-extension.zip .`, {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  });
  console.log('  ✓ bouncer-extension.zip created');
} catch (error) {
  console.error('Failed to create ZIP. Make sure zip is installed.');
  console.log('On Windows, you can use 7-Zip or install zip via WSL.');
}

console.log('\n✅ Build complete!');
console.log(`📦 Output: ${path.join(ROOT_DIR, 'bouncer-extension.zip')}`);
console.log('\nNext steps:');
console.log('1. Test the build by loading from build/ directory');
console.log('2. Upload bouncer-extension.zip to Chrome Web Store Developer Dashboard');
