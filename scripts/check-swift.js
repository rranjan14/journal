#!/usr/bin/env node

const { execSync } = require('child_process');
const os = require('os');

function checkSwiftAvailability() {
  console.log('🔍 Checking Swift availability...\n');

  // Check if we're on macOS
  if (os.platform() !== 'darwin') {
    console.log('❌ Swift audio implementation requires macOS');
    console.log(`   Current platform: ${os.platform()}`);
    console.log('   Use the cross-platform Electron version instead.\n');
    return false;
  }

  console.log('✅ Running on macOS');

  // Check if Swift is installed
  try {
    const swiftVersion = execSync('swift --version', { encoding: 'utf8' });
    console.log('✅ Swift compiler found');
    console.log(`   ${swiftVersion.trim()}\n`);
  } catch (error) {
    console.log('❌ Swift compiler not found');
    console.log('   Install Xcode Command Line Tools:');
    console.log('   xcode-select --install\n');
    return false;
  }

  // Check if Xcode Command Line Tools are installed
  try {
    execSync('xcode-select -p', { encoding: 'utf8' });
    console.log('✅ Xcode Command Line Tools installed');
  } catch (error) {
    console.log('⚠️  Xcode Command Line Tools may not be properly installed');
    console.log('   Run: xcode-select --install\n');
  }

  // Check Swift package
  const fs = require('fs');
  const path = require('path');
  const packageSwiftPath = path.join(__dirname, '..', 'swift-audio', 'Package.swift');
  
  if (fs.existsSync(packageSwiftPath)) {
    console.log('✅ Swift package found');
  } else {
    console.log('❌ Swift package not found');
    console.log('   Expected: swift-audio/Package.swift\n');
    return false;
  }

  console.log('🎉 Swift environment is ready!\n');
  console.log('Available commands:');
  console.log('  npm run build:swift     - Build Swift audio service');
  console.log('  npm run dev:swift       - Run with Swift backend');
  console.log('  npm run electron:swift  - Run Electron with Swift\n');
  
  return true;
}

function showAlternatives() {
  console.log('🔄 Alternative options:\n');
  console.log('1. Cross-platform Electron version:');
  console.log('   npm run dev              # Standard Electron with electron-audio-loopback');
  console.log('   npm run build            # Build cross-platform version\n');
  
  console.log('2. Web-only version:');
  console.log('   npm run dev:vite         # Frontend only (no audio capture)\n');
  
  console.log('3. Switch to cross-platform branch:');
  console.log('   git checkout migrate-tauri-to-electron\n');
}

if (require.main === module) {
  const isAvailable = checkSwiftAvailability();
  
  if (!isAvailable) {
    showAlternatives();
    process.exit(1);
  }
}

module.exports = { checkSwiftAvailability };