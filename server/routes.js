
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory for ESM modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create router
const router = express.Router();

/**
 * Register all routes from the routes directory
 * @param {express.Application} app - Express application
 * @returns {Promise<express.Application>} - The app instance with routes registered
 */
export async function registerRoutes(app) {
  console.log('Registering routes...');
  
  // Import routes dynamically
  const routesPath = path.join(__dirname, 'routes');
  
  if (fs.existsSync(routesPath)) {
    console.log(`Routes directory found: ${routesPath}`);
    
    // Get all JS files in the routes directory
    const routeFiles = fs.readdirSync(routesPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));
    console.log(`Found ${routeFiles.length} route files: ${routeFiles.join(', ')}`);
    
    // Import each route file and use its router
    for (const file of routeFiles) {
      try {
        const routePath = path.join(routesPath, file);
        const routePathUrl = `file://${routePath}`;
        console.log(`Loading route: ${routePath}`);
        
        const routeModule = await import(routePathUrl);
        if (routeModule.default) {
          console.log(`Registering router from ${file}`);
          app.use(routeModule.default);
        } else {
          console.warn(`No default export found in ${file}`);
        }
      } catch (err) {
        console.error(`Error loading route ${file}:`, err);
      }
    }
  } else {
    console.warn(`Routes directory not found: ${routesPath}`);
  }
  
  return app;
}

export default router;
