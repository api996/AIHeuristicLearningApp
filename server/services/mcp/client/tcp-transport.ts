/**
 * MCP 客户端 TCP 传输实现
 * 提供比标准 I/O 更可靠的进程间通信方式
 */

import * as net from 'net';
import { EventEmitter } from 'events';

// 默认端口和主机
const DEFAULT_PORT = 9123;
const DEFAULT_HOST = '127.0.0.1';

/**
 * TCP 客户端传输实现
 */
export class TcpClientTransport extends EventEmitter {
  private client: net.Socket | null = null;
  private port: number;
  private host: string;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // 1秒
  
  constructor(options: { port?: number; host?: string } = {}) {
    super();
    this.port = options.port || DEFAULT_PORT;
    this.host = options.host || DEFAULT_HOST;
  }
  
  /**
   * 连接到 TCP 服务器
   */
  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        if (this.connected && this.client) {
          resolve();
          return;
        }
        
        // 创建 TCP 客户端
        this.client = new net.Socket();
        
        // 连接超时处理
        const connectionTimeout = setTimeout(() => {
          if (!this.connected) {
            reject(new Error('连接超时'));
            this.client?.destroy();
            this.client = null;
          }
        }, 5000); // 5秒超时
        
        // 连接事件处理
        this.client.on('connect', () => {
          clearTimeout(connectionTimeout);
          this.connected = true;
          this.reconnectAttempts = 0;
          console.log(`[TCP-CLIENT] 已连接到 MCP TCP 服务器 ${this.host}:${this.port}`);
          resolve();
        });
        
        // 数据接收处理
        this.client.on('data', (data) => {
          this.emit('message', data.toString());
        });
        
        // 连接关闭处理
        this.client.on('close', () => {
          this.connected = false;
          console.log('[TCP-CLIENT] 与 MCP TCP 服务器连接已关闭');
          this.attemptReconnect();
        });
        
        // 错误处理
        this.client.on('error', (error) => {
          console.error(`[TCP-CLIENT] 连接错误: ${error.message}`);
          if (!this.connected) {
            clearTimeout(connectionTimeout);
            reject(error);
          }
        });
        
        // 连接到服务器
        this.client.connect(this.port, this.host);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * 尝试重新连接
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[TCP-CLIENT] 达到最大重连次数 ${this.maxReconnectAttempts}，停止重连`);
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`[TCP-CLIENT] 将在 ${delay}ms 后尝试重连 (尝试 ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.connected) {
        console.log(`[TCP-CLIENT] 尝试重连...`);
        this.connect().catch(error => {
          console.error(`[TCP-CLIENT] 重连失败: ${error.message}`);
        });
      }
    }, delay);
  }
  
  /**
   * 发送消息到服务器
   */
  async send(message: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.connected || !this.client) {
        reject(new Error('未连接到服务器'));
        return;
      }
      
      this.client.write(message, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.client || !this.connected) {
        this.connected = false;
        this.client = null;
        resolve();
        return;
      }
      
      // 添加超时以避免挂起
      const timeout = setTimeout(() => {
        console.log('[TCP-CLIENT] 关闭连接超时，强制销毁');
        if (this.client) {
          this.client.destroy();
          this.client = null;
        }
        this.connected = false;
        resolve();
      }, 1000); // 1秒超时
      
      try {
        this.client.end(() => {
          clearTimeout(timeout);
          if (this.client) {
            this.client.destroy();
            this.client = null;
          }
          this.connected = false;
          console.log('[TCP-CLIENT] 已正常断开连接');
          resolve();
        });
      } catch (error) {
        clearTimeout(timeout);
        console.error(`[TCP-CLIENT] 关闭连接出错: ${error instanceof Error ? error.message : String(error)}`);
        if (this.client) {
          try { this.client.destroy(); } catch (e) { /* 忽略 */ }
          this.client = null;
        }
        this.connected = false;
        resolve();
      }
    });
  }
  
  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.connected;
  }
}
