#!/bin/bash
# 简化的构建脚本，避免 esbuild 错误

echo "开始简化构建流程..."

# 清理旧的构建文件
rm -rf dist
mkdir -p dist

# 构建前端
echo "构建前端..."
NODE_ENV=production npx vite build

# 构建后端 (避免使用可能导致错误的参数)
echo "构建后端..."
NODE_ENV=production npx esbuild server/index.ts \
  --platform=node \
  --bundle \
  --outfile=dist/index.js \
  --format=esm \
  --external:express \
  --external:pg \
  --external:@neondatabase/serverless \
  --external:drizzle-orm \
  --external:fs \
  --external:path

# 验证构建
if [ -f "dist/index.js" ]; then
  echo "✓ 构建成功!"
else
  echo "× 构建失败，请检查错误信息"
  exit 1
fi