
#!/bin/bash
# Deployment build script

# Set error handling
set -e

echo "Starting deployment build process..."

# Clean dist directory
rm -rf dist
mkdir -p dist

# Install esbuild if needed
if ! command -v npx esbuild &> /dev/null; then
  echo "Installing esbuild..."
  npm install -D esbuild
fi

# First build the frontend
echo "Building frontend with Vite..."
NODE_ENV=production npx vite build

# Then build the backend
echo "Building backend with esbuild..."
NODE_ENV=production npx esbuild server/index.ts \
  --bundle \
  --platform=node \
  --format=esm \
  --outfile=dist/index.js \
  --external:express \
  --external:pg \
  --external:ws \
  --external:@neondatabase/serverless \
  --external:drizzle-orm

echo "Build completed successfully!"
