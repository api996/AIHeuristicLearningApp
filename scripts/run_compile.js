/**
 * 脚本编译工具
 * 使用tsup编译ESM模块
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// 颜色日志
function colorLog(message, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',     // 青色
    success: '\x1b[32m%s\x1b[0m',   // 绿色
    warning: '\x1b[33m%s\x1b[0m',   // 黄色
    error: '\x1b[31m%s\x1b[0m',     // 红色
    header: '\x1b[35m%s\x1b[0m',    // 紫色
  };
  
  console.log(colors[type], message);
}

// 创建临时tsconfig.json文件，用于tsup编译
function createTempTsConfig() {
  const tsConfig = {
    "compilerOptions": {
      "module": "ESNext",
      "moduleResolution": "node",
      "target": "ESNext",
      "esModuleInterop": true,
      "allowSyntheticDefaultImports": true,
      "resolveJsonModule": true,
      "strict": false,
      "baseUrl": ".",
      "paths": {
        "@server/*": ["./server/*"],
        "@shared/*": ["./shared/*"]
      }
    }
  };
  
  fs.writeFileSync('scripts/tsconfig.json', JSON.stringify(tsConfig, null, 2));
  colorLog('已创建临时tsconfig.json文件', 'info');
}

// 编译脚本
function compileScript(scriptPath) {
  const outputDir = 'scripts/dist';
  
  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 编译命令
  const command = `npx tsup ${scriptPath} --format esm --outDir ${outputDir} --tsconfig scripts/tsconfig.json`;
  
  colorLog(`执行编译: ${command}`, 'header');
  
  return new Promise((resolve, reject) => {
    const process = spawn(command, { shell: true });
    
    process.stdout.on('data', (data) => {
      console.log(data.toString());
    });
    
    process.stderr.on('data', (data) => {
      console.error(data.toString());
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        const basename = path.basename(scriptPath);
        const outputPath = path.join(outputDir, basename);
        colorLog(`编译成功: ${outputPath}`, 'success');
        resolve(outputPath);
      } else {
        colorLog(`编译失败，退出码: ${code}`, 'error');
        reject(new Error(`编译失败，退出码: ${code}`));
      }
    });
  });
}

// 获取要编译的脚本列表
const scripts = [
  'scripts/generate_diverse_test_data.js',
  'scripts/test_flask_clustering_flow.js'
];

// 主函数
async function main() {
  colorLog('开始编译脚本...', 'header');
  
  try {
    // 创建临时tsconfig.json
    createTempTsConfig();
    
    // 编译所有脚本
    for (const script of scripts) {
      colorLog(`编译脚本: ${script}`, 'info');
      await compileScript(script);
    }
    
    colorLog('所有脚本编译完成', 'success');
  } catch (error) {
    colorLog(`编译过程出错: ${error.message}`, 'error');
    process.exit(1);
  }
}

// 运行主函数
main();