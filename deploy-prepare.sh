#!/bin/bash
# 优化部署前的准备脚本

echo "开始部署准备工作..."

# 1. 清理旧的构建文件
echo "清理旧的构建文件..."
rm -rf dist
rm -rf node_modules/.cache

# 2. 清理不必要的缓存
echo "清理npm缓存..."
npm cache clean --force

# 3. 确保依赖都已安装
echo "检查并安装所有依赖..."
npm install --production=false

# 4. 设置内存优化的环境变量
export NODE_OPTIONS="--max-old-space-size=3072 --experimental-vm-modules"

# 5. 执行优化后的构建命令
echo "开始构建项目..."
NODE_ENV=production npm run build

echo "项目构建完成，可以部署了。"
echo "部署时，请确保在.replit设置中使用这些命令:"
echo "build: ['sh', '-c', 'NODE_ENV=production node dist/index.js']"
echo "run: ['sh', '-c', 'node dist/index.js']"