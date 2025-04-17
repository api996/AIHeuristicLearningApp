#!/bin/bash

# 删除旧的构建文件
echo "清理旧的构建文件..."
rm -rf dist

# 安装依赖
echo "安装依赖..."
npm ci

# 为调试添加更多信息
echo "Node.js 版本: $(node -v)"
echo "NPM 版本: $(npm -v)"

# 第一步：构建前端
echo "构建前端..."
NODE_ENV=production npx vite build

# 第二步：添加.js扩展名到导入语句
echo "修正TypeScript导入路径..."
mkdir -p temp_fix
find server -name "*.ts" -type f | xargs cat | grep -o "import.*from.*['\"].*['\"]" | grep -v "\.js['\"]" > temp_fix/imports.txt

if [ -s temp_fix/imports.txt ]; then
  echo "发现需要修复的导入语句:"
  cat temp_fix/imports.txt
  
  # 创建修复脚本
  echo "创建修复脚本..."
  cat > temp_fix/fix_imports.js << 'EOF'
const fs = require('fs');
const path = require('path');

// 读取所有.ts文件
function getAllTsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllTsFiles(filePath));
    } else if (path.extname(file) === '.ts') {
      results.push(filePath);
    }
  });
  
  return results;
}

// 修复导入语句
function fixImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // 查找相对路径导入但没有.js扩展名的语句
  const importRegex = /import\s+(?:(?:\{[^}]*\})|(?:[^{}\s,]+))?\s*(?:,\s*(?:\{[^}]*\}))?\s*from\s+['"]([^'"]*)['"]/g;
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    
    // 只处理相对路径导入且没有文件扩展名的情况
    if ((importPath.startsWith('./') || importPath.startsWith('../')) && 
        !importPath.endsWith('.js') && 
        !importPath.includes('*') && 
        !importPath.endsWith('/')) {
        
      const newImportPath = `${importPath}.js`;
      const newImportStatement = match[0].replace(`'${importPath}'`, `'${newImportPath}'`).replace(`"${importPath}"`, `"${newImportPath}"`);
      content = content.replace(match[0], newImportStatement);
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  
  return false;
}

// 主函数
function main() {
  const serverDir = path.join(__dirname, '..', 'server');
  const tsFiles = getAllTsFiles(serverDir);
  let fixedCount = 0;
  
  tsFiles.forEach(file => {
    if (fixImports(file)) {
      console.log(`已修复: ${file}`);
      fixedCount++;
    }
  });
  
  console.log(`总共修复了 ${fixedCount} 个文件的导入语句`);
}

main();
EOF
  
  # 执行修复脚本
  echo "执行修复脚本..."
  node temp_fix/fix_imports.js
fi

# 第三步：使用修改后的esbuild配置
echo "构建后端..."
NODE_ENV=production npx esbuild server/index.ts \
  --bundle \
  --platform=node \
  --format=esm \
  --target=node20 \
  --outdir=dist \
  --packages=external \
  --external:vite.config.ts \
  --external:"*.{css,scss,sass}" \
  --metafile=dist/meta.json

# 检查构建元数据
echo "检查构建元数据..."
if [ -f dist/meta.json ]; then
  echo "构建成功，打印引入的模块:"
  node -e "const meta = require('./dist/meta.json'); const inputs = Object.keys(meta.inputs); console.log(inputs.slice(0, 10).join('\n')); console.log(\`...及其他 \${inputs.length - 10} 个模块\`);"
fi

# 清理临时文件
echo "清理临时文件..."
rm -rf temp_fix

echo "构建完成！"

# 创建运行脚本
echo "创建运行脚本..."
cat > dist/run.js << 'EOF'
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// 设置环境变量
process.env.NODE_ENV = 'production';

// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 检查编译后的文件是否存在
const indexPath = join(__dirname, 'index.js');

try {
  console.log('正在启动服务...');
  console.log(`Node.js版本: ${process.version}`);
  
  if (fs.existsSync(indexPath)) {
    // 方法1: 使用编译后的文件
    console.log('使用编译后的文件启动服务器...');
    
    // 运行编译后的文件
    import('./index.js').catch(err => {
      console.error('加载编译文件失败:', err);
      console.log('尝试使用备用方法...');
      
      // 方法2: 使用tsx运行原始文件
      const tsxProcess = spawn('npx', ['tsx', '../server/index.ts'], {
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: 'production'
        }
      });
      
      tsxProcess.on('exit', (code) => {
        process.exit(code);
      });
    });
  } else {
    console.error('编译后的文件不存在，将使用tsx运行');
    
    // 使用tsx运行原始文件
    const tsxProcess = spawn('npx', ['tsx', '../server/index.ts'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    });
    
    tsxProcess.on('exit', (code) => {
      process.exit(code);
    });
  }
} catch (err) {
  console.error('启动失败:', err);
  process.exit(1);
}
EOF

echo "部署修复脚本执行完成，现在可以尝试部署了！"