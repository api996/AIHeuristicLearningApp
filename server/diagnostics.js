
// Module loading diagnostic script
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('=== Module Loading Diagnostics ===');
console.log(`Current directory: ${process.cwd()}`);
console.log(`Script directory: ${__dirname}`);

// Check critical files
const criticalFiles = [
  '../vite.config.ts',
  './index.ts',
  './vite.ts',
  './routes.ts',
  './routes.js'
];

console.log('\nChecking critical files:');
criticalFiles.forEach(file => {
  const filePath = join(__dirname, file);
  console.log(`${file}: ${fs.existsSync(filePath) ? '✅ Exists' : '❌ Missing'}`);
});

// Check for ESM compatibility issues
console.log('\nChecking for ESM compatibility issues in routes.js...');
try {
  const routesPath = join(__dirname, 'routes.js');
  if (fs.existsSync(routesPath)) {
    const content = fs.readFileSync(routesPath, 'utf-8');
    console.log('routes.js content analysis:');
    
    // Check for dirname usage without proper ESM handling
    if (content.includes('__dirname') && !content.includes('import { dirname }')) {
      console.log('❌ __dirname used without proper ESM imports');
    } else {
      console.log('✅ __dirname properly handled');
    }
    
    // Check for module.exports (CommonJS) vs export (ESM)
    if (content.includes('module.exports')) {
      console.log('❌ Using CommonJS exports in ESM file');
    } else if (content.includes('export ')) {
      console.log('✅ Using ESM exports');
    }
  }
} catch (error) {
  console.error('Error analyzing routes.js:', error);
}

console.log('\nDiagnostics complete.');
