#!/bin/bash

# 这个脚本专门用于调试文件复制问题

# 显示当前环境
echo "当前用户: $(whoami)"
echo "工作目录: $(pwd)"
echo "文件列表:"
ls -la

# 检查dist目录
echo "检查dist目录..."
if [ -d "dist" ]; then
  echo "dist目录存在"
  echo "dist目录内容:"
  ls -la dist
else
  echo "dist目录不存在，创建中..."
  mkdir -p dist
  echo "dist目录已创建"
fi

# 检查server目录
echo "检查server目录..."
if [ -d "server" ]; then
  echo "server目录存在"
  echo "server目录内容:"
  ls -la server
else
  echo "⚠️ server目录不存在，这是个严重问题!"
fi

# 创建所需的目录
echo "创建目标目录..."
mkdir -p dist/public
mkdir -p server/public

# 验证目录创建
echo "验证目录创建结果:"
echo "dist/public存在: $([ -d dist/public ] && echo '是' || echo '否')"
echo "server/public存在: $([ -d server/public ] && echo '是' || echo '否')"

# 创建测试文件
echo "创建测试文件..."
echo "这是一个测试文件" > test.txt

# 尝试复制到不同目录
echo "尝试复制测试文件..."
cp test.txt dist/ 2>&1 || echo "复制到dist失败: $?"
cp test.txt server/ 2>&1 || echo "复制到server失败: $?"
cp test.txt dist/public/ 2>&1 || echo "复制到dist/public失败: $?"
cp test.txt server/public/ 2>&1 || echo "复制到server/public失败: $?"

# 验证复制结果
echo "验证复制结果:"
echo "dist/test.txt存在: $([ -f dist/test.txt ] && echo '是' || echo '否')"
echo "server/test.txt存在: $([ -f server/test.txt ] && echo '是' || echo '否')"
echo "dist/public/test.txt存在: $([ -f dist/public/test.txt ] && echo '是' || echo '否')"
echo "server/public/test.txt存在: $([ -f server/public/test.txt ] && echo '是' || echo '否')"

# 检查vite构建
echo "检查vite构建结果..."
if [ -d "dist/assets" ]; then
  echo "dist/assets目录存在，内容:"
  ls -la dist/assets
  
  echo "尝试复制前端资源..."
  cp -r dist/assets dist/public/ 2>&1 || echo "复制assets到dist/public失败: $?"
  cp -r dist/assets server/public/ 2>&1 || echo "复制assets到server/public失败: $?"
  
  # 验证复制结果
  echo "验证assets复制结果:"
  echo "dist/public/assets存在: $([ -d dist/public/assets ] && echo '是' || echo '否')"
  echo "server/public/assets存在: $([ -d server/public/assets ] && echo '是' || echo '否')"
else
  echo "dist/assets目录不存在，前端可能未正确构建"
fi

# 查找index.html
echo "查找index.html..."
find . -name "index.html" -type f | grep -v "node_modules"

# 尝试复制index.html到需要的位置
INDEX_HTML=$(find . -name "index.html" -type f | grep -v "node_modules" | head -1)
if [ -n "$INDEX_HTML" ]; then
  echo "找到index.html: $INDEX_HTML"
  
  echo "尝试复制index.html到目标位置..."
  cp "$INDEX_HTML" dist/public/ 2>&1 || echo "复制index.html到dist/public失败: $?"
  cp "$INDEX_HTML" server/public/ 2>&1 || echo "复制index.html到server/public失败: $?"
  
  # 验证复制结果
  echo "验证index.html复制结果:"
  echo "dist/public/index.html存在: $([ -f dist/public/index.html ] && echo '是' || echo '否')"
  echo "server/public/index.html存在: $([ -f server/public/index.html ] && echo '是' || echo '否')"
else
  echo "未找到index.html，前端可能未正确构建"
fi

echo "调试完成"