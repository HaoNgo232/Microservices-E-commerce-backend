#!/usr/bin/env tsx
/**
 * RSA Key Pair Generation Script
 *
 * Generates RSA-2048 key pair for JWT signing and verification.
 * Keys are saved as PEM files in the keys/ directory.
 *
 * Usage:
 *   pnpm run generate:keys
 *
 * Output:
 *   - keys/private-key.pem (private key - KEEP SECRET!)
 *   - keys/public-key.pem (public key - can be shared)
 */

import * as jose from 'jose';
import * as fs from 'fs/promises';
import * as path from 'path';

async function main(): Promise<void> {
  console.log('🔑 Generating RSA key pair for JWT...\n');

  try {
    // Generate RSA-2048 key pair for RS256 algorithm
    const { publicKey, privateKey } = await jose.generateKeyPair('RS256', {
      modulusLength: 2048,
      extractable: true,
    });

    console.log(' Key pair generated successfully!\n');

    // Export keys to PEM format
    console.log('📝 Exporting keys to PEM format...\n');
    const publicKeyPEM = await jose.exportSPKI(publicKey);
    const privateKeyPEM = await jose.exportPKCS8(privateKey);

    // Create keys directory
    const keysDir = path.join(process.cwd(), 'keys');
    await fs.mkdir(keysDir, { recursive: true });
    console.log('📁 Created keys/ directory\n');

    // Save keys to files
    const publicKeyPath = path.join(keysDir, 'public-key.pem');
    const privateKeyPath = path.join(keysDir, 'private-key.pem');

    await fs.writeFile(publicKeyPath, publicKeyPEM, 'utf-8');
    await fs.writeFile(privateKeyPath, privateKeyPEM, 'utf-8');

    console.log('💾 Keys saved successfully!\n');
    console.log('='.repeat(80));
    console.log(' KEY FILES GENERATED:');
    console.log('='.repeat(80));
    console.log('');
    console.log(` Public Key:  ${publicKeyPath}`);
    console.log(`🔒 Private Key: ${privateKeyPath}`);
    console.log('');
    console.log('='.repeat(80));
    console.log('');
    console.log('⚠️  IMPORTANT SECURITY NOTES:');
    console.log('  - Private key is ONLY for user-app (JWT signing)');
    console.log('  - Public key is for ALL services (JWT verification)');
    console.log('  - Make sure keys/ directory is in .gitignore');
    console.log('  - For production, use secure secrets management (AWS KMS, etc.)');
    console.log('  - Rotate keys periodically for enhanced security');
    console.log('');
    console.log('📝 Next steps:');
    console.log('  1. Verify keys/ is in .gitignore');
    console.log('  2. Services will auto-load keys from keys/ directory');
    console.log('  3. For Docker: mount keys/ as read-only volume');
    console.log('');
    console.log(' Key generation complete!');
  } catch (error) {
    console.error(' Error generating keys:', error);
    process.exit(1);
  }
}

void main();
