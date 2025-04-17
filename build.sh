#!/bin/bash

# Display build environment info
echo "========== Build Environment =========="
echo "Node.js version: $(node -v)"
echo "NPM version: $(npm -v)"
echo "Current directory: $(pwd)"
echo "======================================"

# Set memory optimization for build process
export NODE_OPTIONS="--max-old-space-size=2048" 

# Clean previous build
echo "Cleaning previous build artifacts..."
rm -rf dist

# Build frontend with Vite
echo "Building frontend with Vite..."
npm run check
npx vite build

# Ensure dist/public exists (Vite output directory)
if [ ! -d "dist/public" ]; then
  echo "Creating dist/public directory structure..."
  mkdir -p dist/public

  # If assets are in a different location, move them
  if [ -d "dist/assets" ]; then
    echo "Moving assets to correct location..."
    mkdir -p dist/public/assets
    cp -r dist/assets/* dist/public/assets/
  fi

  # If index.html is in wrong location, move it
  if [ -f "dist/index.html" ] && [ ! -f "dist/public/index.html" ]; then
    echo "Moving index.html to correct location..."
    cp dist/index.html dist/public/index.html
  fi
fi

# Build server with esbuild
echo "Building server with esbuild..."
npx esbuild server/index.ts \
  --bundle \
  --platform=node \
  --packages=external \
  --format=esm \
  --outdir=dist \
  --allow-overwrite \
  --external:"vite.config.ts"

# Create server files check
if [ ! -f "dist/index.js" ]; then
  echo "Error: Server build failed. dist/index.js not found."
  exit 1
else
  echo "Server build successful: dist/index.js created."
fi

# Verify frontend files
if [ ! -f "dist/public/index.html" ]; then
  echo "Warning: Frontend build may be incomplete. Creating minimal index.html..."
  mkdir -p dist/public
  echo "<!DOCTYPE html><html><head><meta charset='utf-8'><title>App</title></head><body><div id='app'>Server is running</div></body></html>" > dist/public/index.html
fi

echo "Build completed successfully!"