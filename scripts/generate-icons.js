#!/usr/bin/env node

/**
 * Generate PNG icons from SVG source
 *
 * Install dependencies first:
 *   npm install --save-dev sharp
 *
 * Then run:
 *   node scripts/generate-icons.js
 */

import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const sizes = [16, 32, 48, 128];
const svgPath = join(projectRoot, 'assets/icons/icon.svg');
const svgBuffer = readFileSync(svgPath);

console.log('Generating PNG icons from SVG...\n');

for (const size of sizes) {
  const outputPath = join(projectRoot, `assets/icons/icon-${size}.png`);

  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outputPath);

  console.log(`✓ Generated icon-${size}.png`);
}

console.log('\nAll icons generated successfully!');
