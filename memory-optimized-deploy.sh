#!/bin/bash
# 内存优化的部署准备脚本，专门解决错误143（内存不足）问题

echo "======== 内存优化部署准备 ========"

# 设置严格错误处理
set -e

# 显示当前内存使用情况
echo "当前内存使用情况:"
free -h

# 1. 停止所有后台进程释放内存
echo "停止后台进程以释放内存..."
pkill -f "tsx server/index.ts" || true
kill $(lsof -t -i:5000) 2>/dev/null || true
kill $(lsof -t -i:5001) 2>/dev/null || true

# 2. 清理旧构建文件
echo "清理旧构建文件..."
rm -rf dist
rm -rf node_modules/.cache
npm cache clean --force

# 3. 为Node分配足够内存
export NODE_OPTIONS="--max-old-space-size=3072 --experimental-vm-modules --no-warnings"

# 4. 阶段性构建以防止内存溢出
echo "执行阶段性构建..."

# 4.1 首先只构建前端
echo "第1阶段: 构建前端..."
NODE_ENV=production npx vite build

# 显示内存使用情况
echo "前端构建后内存使用情况:"
free -h

# 4.2 构建后端
echo "第2阶段: 构建后端..."
NODE_ENV=production npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --allow-top-level-await

# 确认构建完成
if [ -f "dist/index.js" ]; then
  echo "✅ 构建成功完成!"
  echo "可以进行部署了。"
  
  # 验证构建文件
  echo "验证构建文件大小..."
  ls -lh dist/
  
  echo "======== 部署准备完成 ========"
  echo "请使用以下命令启动生产环境:"
  echo "NODE_ENV=production node dist/index.js"
else
  echo "❌ 构建失败，请检查错误信息。"
  exit 1
fi