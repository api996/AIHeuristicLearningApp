/**
 * EPIPE错误模拟测试
 * 这个脚本会创建一个子进程，然后突然结束父进程来模拟EPIPE错误
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取MCP搜索服务器脚本路径
const serverScriptPath = path.join(__dirname, 'services', 'mcp', 'server', 'search-server.ts');

console.log(`启动MCP服务器脚本: ${serverScriptPath}`);

// 使用tsx启动脚本
const child = spawn('tsx', [serverScriptPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    TEST_MODE: 'true' // 设置测试模式
  }
});

// 监听子进程输出
child.stdout.on('data', (data) => {
  console.log(`[子进程输出] ${data}`);
  
  // 如果看到服务器已启动的消息，立即发送一个查询然后终止父进程
  if (data.toString().includes('MCP 搜索服务已启动')) {
    console.log('检测到服务已启动，发送测试查询');
    
    // 发送一些数据到子进程的stdin
    try {
      child.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        method: 'callTool',
        params: {
          name: 'webSearch',
          arguments: { query: '测试EPIPE错误处理' }
        },
        id: 1
      }) + '\n');
      
      console.log('数据已发送到子进程');
      
      // 等待100ms后终止输入流，模拟EPIPE错误
      setTimeout(() => {
        console.log('正在关闭stdin流来模拟EPIPE错误...');
        try {
          child.stdin.end();
          console.log('stdin流已关闭');
        } catch (e) {
          console.error('关闭stdin时出错:', e);
        }
        
        // 等待1秒钟观察子进程反应
        setTimeout(() => {
          console.log('检查子进程状态...');
          if (child.killed) {
            console.log('子进程已终止');
          } else {
            console.log('子进程仍在运行，这是修复后的预期行为');
            
            // 现在正常终止子进程
            console.log('正常终止子进程');
            child.kill('SIGTERM');
          }
        }, 1000);
      }, 100);
    } catch (err) {
      console.error('向子进程发送数据时出错:', err);
    }
  }
});

child.stderr.on('data', (data) => {
  console.error(`[子进程错误] ${data}`);
});

child.on('close', (code) => {
  console.log(`子进程已退出，退出码 ${code}`);
});

// 设置超时以防测试卡住
setTimeout(() => {
  console.log('测试超时，强制终止子进程');
  child.kill('SIGKILL');
  process.exit(1);
}, 10000);
