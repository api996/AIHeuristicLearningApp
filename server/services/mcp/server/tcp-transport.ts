/**
 * MCP 服务器 TCP 传输实现
 * 提供比标准 I/O 更可靠的进程间通信方式
 */

import * as net from 'net';
import { EventEmitter } from 'events';
import { safeLog } from './safe-logger';

// 默认端口和主机
const DEFAULT_PORT = 9123;
const DEFAULT_HOST = '127.0.0.1';

/**
 * TCP 服务器传输实现，替代 StdioServerTransport
 */
export class TcpServerTransport extends EventEmitter {
  private server: net.Server | null = null;
  private clients: net.Socket[] = [];
  private port: number;
  private host: string;
  private ready: boolean = false;
  
  constructor(options: { port?: number; host?: string } = {}) {
    super();
    this.port = options.port || DEFAULT_PORT;
    this.host = options.host || DEFAULT_HOST;
  }
  
  /**
   * 启动 TCP 服务器
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 创建 TCP 服务器
        this.server = net.createServer((socket) => {
          // 新客户端连接
          safeLog(`[TCP-SERVER] 新客户端连接: ${socket.remoteAddress}:${socket.remotePort}`, 'info');
          
          // 存储客户端连接
          this.clients.push(socket);
          
          // 客户端数据处理
          socket.on('data', (data) => {
            try {
              // 将收到的数据发送到 MCP 服务器
              safeLog(`[TCP-SERVER] 收到客户端消息: ${data.length} 字节`, 'info');
              this.emit('message', data.toString());
            } catch (error) {
              safeLog(`[TCP-SERVER] 处理消息错误: ${error instanceof Error ? error.message : String(error)}`, 'error');
            }
          });
          
          // 客户端断开连接
          socket.on('close', () => {
            safeLog(`[TCP-SERVER] 客户端断开连接: ${socket.remoteAddress}:${socket.remotePort}`, 'info');
            this.clients = this.clients.filter(c => c !== socket);
          });
          
          // 客户端错误处理
          socket.on('error', (error) => {
            safeLog(`[TCP-SERVER] 客户端连接错误: ${error.message}`, 'error');
            this.clients = this.clients.filter(c => c !== socket);
          });
        });
        
        // 服务器错误处理
        this.server.on('error', (error) => {
          safeLog(`[TCP-SERVER] 服务器错误: ${error.message}`, 'error');
          reject(error);
        });
        
        // 启动服务器
        this.server.listen(this.port, this.host, () => {
          this.ready = true;
          safeLog(`[TCP-SERVER] MCP TCP 服务器已启动，监听 ${this.host}:${this.port}`, 'info');
          resolve();
        });
      } catch (error) {
        safeLog(`[TCP-SERVER] 启动服务器失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
        reject(error);
      }
    });
  }
  
  /**
   * 发送消息给所有客户端
   */
  async send(message: string): Promise<void> {
    if (!this.ready || this.clients.length === 0) {
      safeLog('[TCP-SERVER] 没有可用客户端，消息无法发送', 'warn');
      return;
    }
    
    // 发送消息给所有连接的客户端
    for (const client of this.clients) {
      try {
        client.write(message, (err) => {
          if (err) {
            safeLog(`[TCP-SERVER] 发送消息错误: ${err.message}`, 'error');
          }
        });
      } catch (error) {
        safeLog(`[TCP-SERVER] 发送消息异常: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    }
  }
  
  /**
   * 关闭服务器
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      
      // 关闭所有客户端连接
      for (const client of this.clients) {
        try {
          client.end();
          client.destroy();
        } catch (e) {
          // 忽略错误
        }
      }
      
      // 关闭服务器
      this.server.close(() => {
        this.server = null;
        this.clients = [];
        this.ready = false;
        safeLog('[TCP-SERVER] MCP TCP 服务器已关闭', 'info');
        resolve();
      });
    });
  }
}
