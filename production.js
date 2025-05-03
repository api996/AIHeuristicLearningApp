/**
 * Standard production environment startup script
 */

import { spawn } from 'child_process';

// Set environment to production
const env = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: process.env.PORT || '5000'
};

console.log('Starting production server...');
console.log('Time:', new Date().toISOString());

// Use standard Node.js to run the server
const server = spawn('node', ['./dist/index.js'], { 
  stdio: 'inherit',
  env: env
});

// Handle server process termination
server.on('close', (code) => {
  console.log(`Server process exited with code: ${code}`);
  process.exit(code);
});

// Handle termination signals
process.on('SIGINT', () => {
  console.log('Received SIGINT signal, closing server...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal, closing server...');
  server.kill('SIGTERM');
});