/**
 * 嵌入向量缓存工具
 * 用于缓存文本内容与其向量嵌入的映射关系，减少重复API调用
 */

// 使用LRU缓存策略，有固定大小上限
export class EmbeddingCache {
  private cache: Map<string, number[]> = new Map();
  private maxSize: number;
  private hashFunction: (text: string) => string;
  
  /**
   * 构造函数
   * @param maxSize 最大缓存项数量，默认1000
   */
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    
    // 使用简单的哈希函数生成缓存键
    this.hashFunction = (text: string): string => {
      // 截取文本并生成哈希键
      const normalizedText = text.trim().toLowerCase();
      
      // 对于短文本，直接使用内容作为键
      if (normalizedText.length < 100) {
        return normalizedText;
      }
      
      // 对于长文本，使用简化的哈希算法
      let hash = 0;
      for (let i = 0; i < normalizedText.length; i++) {
        const char = normalizedText.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
      }
      
      // 添加前缀区分哈希值和短文本
      return 'h_' + hash.toString(16) + '_' + normalizedText.substring(0, 50);
    };
  }
  
  /**
   * 获取缓存中的嵌入向量
   * @param text 文本内容
   * @returns 缓存的向量嵌入或null
   */
  public get(text: string): number[] | null {
    const key = this.hashFunction(text);
    const embedding = this.cache.get(key);
    
    if (embedding) {
      // 移动到"最近使用"位置
      this.cache.delete(key);
      this.cache.set(key, embedding);
      return embedding;
    }
    
    return null;
  }
  
  /**
   * 将嵌入向量添加到缓存
   * @param text 文本内容
   * @param embedding 向量嵌入
   */
  public set(text: string, embedding: number[]): void {
    const key = this.hashFunction(text);
    
    // 如果缓存已满，删除最旧的项
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    // 添加新缓存项
    this.cache.set(key, embedding);
  }
  
  /**
   * 清除缓存
   */
  public clear(): void {
    this.cache.clear();
  }
  
  /**
   * 获取当前缓存大小
   */
  public size(): number {
    return this.cache.size;
  }
}