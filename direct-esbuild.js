#!/usr/bin/env node
/**
 * 简化的直接构建脚本
 * 专注于解决ESM/CJS混合模块的问题
 */

import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

// 终端颜色工具
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
    log('开始构建...');
    const result = await esbuild.build(buildConfig);
    
    // 复制前端资源
    fs.copyFileSync('./dist/public/index.html', './dist/public/index.html');
    log('已复制前端静态资源', 'success');
    
    // 处理潜在的命名冲突
    const indexPath = path.join(outDir, 'index.js');
    let content = fs.readFileSync(indexPath, 'utf8');
    
    // 简单的标识冲突处理
    content = content.replace(
      /import { (createRequire|fileURLToPath|dirname|resolve) } from ["'](?:node:)?(module|url|path)["'];/g,
      '/* 已预加载模块，略过重复导入 */'
    );
    
    fs.writeFileSync(indexPath, content);
    log('构建完成，已优化模块导入', 'success');
    
    log('可通过以下命令启动应用:', 'info');
    log('NODE_ENV=production node direct-esm-run.js', 'info');
  } catch (error) {
    log('构建失败: ' + error.message, 'error');
    console.error(error);
    process.exit(1);
  }
}

build();