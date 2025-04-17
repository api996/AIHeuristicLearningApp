
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get current directory for ESM modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Fix for ESM modules
import { dirname } from 'path';

// Create router
const router = express.Router();

/**
 * Register all routes from the routes directory
 * @param {express.Application} app - Express application
 * @returns {express.Router} - The router instance
 */
export function registerRoutes(app) {
  // Import routes dynamically
  const routesPath = path.join(__dirname, 'routes');
  
  if (fs.existsSync(routesPath)) {
    fs.readdirSync(routesPath).forEach(file => {
      if (file.endsWith('.js')) {
        const routePath = path.join(routesPath, file);
        import(routePath).then(routeModule => {
          if (routeModule.default) {
            app.use(routeModule.default);
          }
        }).catch(err => {
          console.error(`Error loading route ${file}:`, err);
        });
      }
    });
  } else {
    console.warn(`Routes directory not found: ${routesPath}`);
  }
  
  return app;
}
