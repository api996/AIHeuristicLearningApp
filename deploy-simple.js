#!/usr/bin/env node
/**
 * 简化的一键部署脚本
 * 一站式构建与部署，减少配置复杂度
 */

import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// 简单日志工具
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, type = 'info') {
  const typeColors = {
    info: colors.blue,
    success: colors.green,
    error: colors.red,
    warn: colors.yellow,
  };
  
  const color = typeColors[type] || colors.reset;
  console.log(`${color}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

// 构建配置
const outDir = './dist';
const entryPoint = './server/index.ts';

// 清理输出目录
log('清理构建目录...');
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir);
fs.mkdirSync(path.join(outDir, 'public'));

// 前端构建 - 更复杂的构建处理
log('构建前端...');
try {
  // 在根目录执行原有的构建命令，这样路径解析会更准确
  execSync('npx vite build', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });
  
  // 如果前端在dist/public路径下，不需要额外复制
  if (fs.existsSync('./dist/public/index.html')) {
    log('前端已构建在正确位置', 'success');
  } 
  // 如果前端在dist目录下，复制到public子目录
  else if (fs.existsSync('./dist/index.html')) {
    log('正在复制前端文件到public子目录...', 'info');
    
    // 创建public目录（如果不存在）
    if (!fs.existsSync('./dist/public')) {
      fs.mkdirSync('./dist/public', { recursive: true });
    }
    
    // 复制所有文件
    const files = fs.readdirSync('./dist');
    files.forEach(file => {
      if (file !== 'public' && file !== 'index.js' && file !== 'index.js.map') {
        const src = path.join('./dist', file);
        const dest = path.join('./dist/public', file);
        
        // 如果是目录，则递归复制
        if (fs.statSync(src).isDirectory()) {
          fs.cpSync(src, dest, { recursive: true });
        } else {
          fs.copyFileSync(src, dest);
        }
        
        log(`复制: ${file}`, 'info');
      }
    });
  } else {
    log('未找到前端构建文件，跳过前端构建', 'warn');
  }
  
  log('前端处理完成', 'success');
} catch (error) {
  log('前端构建失败: ' + error.message, 'error');
  console.error(error);
  log('继续执行后端构建...', 'warn');
}

// 创建构建配置
const buildConfig = {
  entryPoints: [entryPoint],
  bundle: true,
  platform: 'node',
  outfile: path.join(outDir, 'index.js'),
  sourcemap: true,
  minify: false,
  format: 'esm',
  target: 'node16',
  banner: {
    js: `
// ===== ESM/CJS 兼容层 =====
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// 在 ESM 中模拟 CommonJS 变量
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// 导出以防止多次导入
export { createRequire, fileURLToPath, dirname, resolve };

// ===== 预加载关键模块 =====
import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';

// 设置全局变量，方便后续引用
globalThis.__path = path;
globalThis.__fs = fs;
globalThis.__url = url;
globalThis.__dirname = __dirname;
globalThis.__filename = __filename;
globalThis.__require = require;

// ===== 预加载会话存储模块 =====
import expressSession from 'express-session';
import pgSessionInit from 'connect-pg-simple';
// 使用不同的变量名，避免冲突
const __PgSessionStore = pgSessionInit(expressSession);
const __MemoryStore = expressSession.MemoryStore;

// 将它们放入全局缓存
globalThis.__PgSessionStore = __PgSessionStore;
globalThis.__MemoryStore = __MemoryStore;
`
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  external: [
    // 标准库
    'fsevents',
    'node:*',
    // 本地模块使用ESM导入的CJS模块
    'esbuild',
    'express',
    'body-parser',
    'connect-pg-simple',
    'express-session',
    'memorystore',
    'pg',
    '@neondatabase/serverless',
    'ws',
    'lightningcss',
    'pg-native',
    '@neondatabase/drivers',
  ],
};

// 执行构建
async function build() {
  try {
    log('开始后端构建...');
    const result = await esbuild.build(buildConfig);
    
    // 处理潜在的命名冲突
    const indexPath = path.join(outDir, 'index.js');
    let content = fs.readFileSync(indexPath, 'utf8');
    
    // 合并模块导入修复
    let fixes = 0;
    
    // 修复 createRequire 导入
    const fixedContent1 = content.replace(
      /import\s*{\s*createRequire\s*}\s*from\s*["'](?:node:)?module["'];/g,
      '/* 已预加载模块，跳过重复导入 */'
    );
    if (fixedContent1 !== content) {
      fixes++;
      content = fixedContent1;
    }
    
    // 修复 path 相关导入
    const fixedContent2 = content.replace(
      /import\s*{\s*(?:dirname|resolve|join|basename|extname)[^}]*}\s*from\s*["'](?:node:)?path["'];/g,
      '/* 已预加载 path 模块，使用全局 __path */'
    );
    if (fixedContent2 !== content) {
      fixes++;
      content = fixedContent2;
    }
    
    // 修复 fileURLToPath 导入
    const fixedContent3 = content.replace(
      /import\s*{\s*fileURLToPath[^}]*}\s*from\s*["'](?:node:)?url["'];/g,
      '/* 已预加载 url 模块，使用全局 __url */'
    );
    if (fixedContent3 !== content) {
      fixes++;
      content = fixedContent3;
    }
    
    // 修复 PgSession 相关冲突
    if (content.includes('var PgPreparedQuery, PgSession, PgTransaction;')) {
      log('发现 PgSession 变量声明冲突，正在修复...', 'info');
      const fixedContent4 = content.replace(
        'var PgPreparedQuery, PgSession, PgTransaction;',
        'var PgPreparedQuery, /* 使用全局 __PgSessionStore */ PgTransaction;'
      );
      
      if (fixedContent4 !== content) {
        fixes++;
        content = fixedContent4;
        log('已修复 PgSession 变量声明', 'info');
      }
    }
    
    // 修复 path 导入冲突
    if (content.includes('import path, { resolve as resolve2 } from "node:path";')) {
      log('发现 path 命名导入冲突，正在修复...', 'info');
      const fixedContent5 = content.replace(
        'import path, { resolve as resolve2 } from "node:path";',
        '/* 使用全局 path */\nconst path2 = globalThis.__path;\nconst { resolve: resolve2 } = path2;'
      );
      
      if (fixedContent5 !== content) {
        fixes++;
        content = fixedContent5;
        log('已修复 path 命名导入冲突', 'info');
      }
    }
    
    // 修复 __filename 冲突
    if (content.includes('var __filename,')) {
      log('发现 __filename 变量声明冲突，正在修复...', 'info');
      const fixedContent6 = content.replace(
        'var __filename,',
        'var __filename2,'
      ).replace(
        /__filename([ ,;\.=\(\)\[\]\{\}])/g, 
        '__filename2$1'
      );
      
      if (fixedContent6 !== content) {
        fixes++;
        content = fixedContent6;
        log('已修复 __filename 变量声明冲突', 'info');
      }
    }
    
    // 保存修改后的文件
    fs.writeFileSync(indexPath, content);
    log(`构建完成，修复了 ${fixes} 处模块导入冲突`, 'success');
    
    // 创建启动脚本
    const startScript = `#!/usr/bin/env node
/**
 * 生产环境启动入口
 * 包含兼容性修复和环境初始化
 */
console.log('[INFO] 启动生产环境应用...');
console.log('[INFO] 时间:', new Date().toISOString());

// 预加载关键模块
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as fs from 'fs';
import expressSession from 'express-session';
import pgSessionInit from 'connect-pg-simple';

// 设置全局变量
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
globalThis.__filename = __filename;
globalThis.__dirname = __dirname;
globalThis.__path = path;
globalThis.__fs = fs;

// 初始化会话存储
const PgSession = pgSessionInit(expressSession);
globalThis.PgSession = PgSession; 
globalThis.MemoryStore = expressSession.MemoryStore;

console.log('[INFO] 环境初始化完成，加载应用...');

// ESM 导入应用
import './dist/index.js';
`;
    
    fs.writeFileSync('start-prod.js', startScript);
    fs.chmodSync('start-prod.js', '755');
    log('已创建启动脚本: start-prod.js', 'success');
    
    log(`部署完成! 使用以下命令启动:`, 'success');
    log('NODE_ENV=production node start-prod.js', 'info');
  } catch (error) {
    log('构建失败: ' + error.message, 'error');
    console.error(error);
    process.exit(1);
  }
}

build();