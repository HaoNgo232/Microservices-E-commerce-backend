/**
 * Convert GLTF to GLB Script
 * 
 * Chạy script này TRƯỚC khi seed để convert GLTF → GLB
 * 
 * Usage:
 *   pnpm tsx scripts/convert-gltf-to-glb.ts
 * 
 * Requirements:
 *   npm install -g gltf-pipeline
 *   hoặc
 *   pnpm add -D gltf-pipeline
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const MODELS_DIR = path.join(__dirname, 'seed-data', '3dmodel');
const OUTPUT_DIR = path.join(__dirname, 'seed-data', '3dmodel-glb');

// Check if gltf-pipeline is available (using npx for local package)
function checkGltfPipeline(): boolean {
  try {
    // Try npx first (for local package)
    execSync('npx gltf-pipeline --version', { stdio: 'ignore' });
    return true;
  } catch {
    try {
      // Fallback to global
      execSync('gltf-pipeline --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

async function convertGltfToGlb() {
  console.log('=== GLTF → GLB Conversion ===\n');

  // Check if gltf-pipeline is installed
  if (!checkGltfPipeline()) {
    console.error('❌ gltf-pipeline not found!');
    console.error('\nPlease install it:');
    console.error('  pnpm add -D gltf-pipeline  (recommended - local package)');
    console.error('  or');
    console.error('  npm install -g gltf-pipeline  (global)');
    console.error('\nAfter installing, run this script again.');
    process.exit(1);
  }

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Read all glasses folders
  const modelFolders = fs
    .readdirSync(MODELS_DIR)
    .filter(f => {
      const fullPath = path.join(MODELS_DIR, f);
      return fs.statSync(fullPath).isDirectory() && f.startsWith('glasses-');
    })
    .sort();

  let successCount = 0;
  let failCount = 0;

  for (const folder of modelFolders) {
    try {
      const folderPath = path.join(MODELS_DIR, folder);
      const files = fs.readdirSync(folderPath);

      // Find GLTF file
      const gltfFile = files.find(f => f.endsWith('.gltf'));
      if (!gltfFile) {
        console.warn(`⚠️  Skipping ${folder}: No GLTF file found`);
        continue;
      }

      const gltfPath = path.join(folderPath, gltfFile);
      const outputFolder = path.join(OUTPUT_DIR, folder);
      const glbPath = path.join(outputFolder, `${folder}.glb`);

      // Create output folder
      if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
      }

      // Convert GLTF → GLB using gltf-pipeline (via npx for local package)
      console.log(`→ Converting ${folder}...`);
      
      // Use npx to run local package, fallback to global if needed
      let converted = false;
      try {
        execSync(`npx gltf-pipeline -i "${gltfPath}" -o "${glbPath}" --binary`, {
          stdio: 'inherit',
          cwd: folderPath,
        });
        converted = true;
      } catch (npxError) {
        try {
          // Fallback to global command
          execSync(`gltf-pipeline -i "${gltfPath}" -o "${glbPath}" --binary`, {
            stdio: 'inherit',
            cwd: folderPath,
          });
          converted = true;
        } catch (globalError) {
          throw new Error(`Both npx and global gltf-pipeline failed. Npx error: ${npxError}, Global error: ${globalError}`);
        }
      }

      if (!converted) {
        throw new Error('Conversion failed');
      }

      // Copy thumbnail if exists
      const thumbnailFile = files.find(f => f.endsWith('.png') && !f.includes('textures'));
      if (thumbnailFile) {
        const thumbnailPath = path.join(folderPath, thumbnailFile);
        const outputThumbnailPath = path.join(outputFolder, thumbnailFile);
        fs.copyFileSync(thumbnailPath, outputThumbnailPath);
      }

      successCount++;
      console.log(`  ✓ Converted: ${glbPath}\n`);
    } catch (error) {
      failCount++;
      console.error(`  ✗ Failed to convert ${folder}:`, error);
      console.error('');
    }
  }

  console.log('=== Conversion Summary ===');
  console.log(`✓ Success: ${successCount}`);
  console.log(`✗ Failed: ${failCount}`);
  console.log(`\nGLB files saved to: ${OUTPUT_DIR}`);
  console.log('\nNext step: Update seed script to use GLB files from 3dmodel-glb/');
}

void convertGltfToGlb();

