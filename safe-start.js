
// Safe application starter with improved error handling
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Starting application in safe mode...');

// Function to check if a file exists
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    console.error(`Error checking if file exists: ${filePath}`, error);
    return false;
  }
}

// First, run the diagnostics script
console.log('Running diagnostics...');
const diagnosticsProcess = spawn('node', ['server/diagnostics.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

diagnosticsProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(`Diagnostics failed with code ${code}`);
  }
  
  // Continue with starting the application
  console.log('\nAttempting to start the application...');
  
  // Determine the best way to start the application
  const serverIndexTs = path.join(__dirname, 'server', 'index.ts');
  
  if (fileExists(serverIndexTs)) {
    console.log('Starting with tsx...');
    
    const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'development',
        // Add a flag to indicate we're in safe mode
        SAFE_MODE: 'true'
      }
    });
    
    serverProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Server process exited with code ${code}`);
        console.log('Falling back to Node.js for JavaScript files...');
        
        // If tsx fails, try to find a compiled JS version
        const serverIndexJs = path.join(__dirname, 'dist', 'index.js');
        
        if (fileExists(serverIndexJs)) {
          console.log('Starting with compiled JS version...');
          
          const nodeProcess = spawn('node', ['dist/index.js'], {
            stdio: 'inherit',
            env: {
              ...process.env,
              NODE_ENV: 'production',
              SAFE_MODE: 'true'
            }
          });
          
          nodeProcess.on('exit', (nodeCode) => {
            console.log(`Node.js process exited with code ${nodeCode}`);
          });
        } else {
          console.error('Could not find compiled JavaScript version in dist/index.js');
        }
      }
    });
  } else {
    console.error('Could not find server/index.ts');
  }
});
