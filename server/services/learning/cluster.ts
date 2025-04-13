/**
 * 记忆聚类服务模块
 * 负责主题发现和相关性分析
 */

import { spawn } from 'child_process';
import { Cluster, ClusterOptions, Memory } from './types';
import { log } from '../../vite';
import { summarizeText } from './summarizer';

/**
 * 将记忆聚类为主题组
 * 
 * @param memories 记忆列表
 * @param options 聚类选项
 * @returns 聚类结果
 */
export async function clusterMemories(
  memories: Memory[],
  options: ClusterOptions = {}
): Promise<Cluster[]> {
  // 设置默认选项
  const maxClusters = options.maxClusters || 10;
  const minSimilarity = options.minSimilarity || 0.5;
  
  try {
    if (!memories || memories.length === 0) {
      log(`[cluster] 没有记忆可聚类`);
      return [];
    }
    
    if (memories.length === 1) {
      // 只有一个记忆，创建单个聚类
      const memory = memories[0];
      return [{
        id: `cluster_single_${Date.now()}`,
        label: memory.summary || memory.content.substring(0, 50),
        centroid: memory.embedding || [],
        memoryIds: [memory.id],
        keywords: memory.keywords || [],
        summary: memory.summary
      }];
    }
    
    log(`[cluster] 尝试对 ${memories.length} 个记忆进行聚类`);
    
    // 检查记忆是否有嵌入向量
    const hasEmbeddings = memories.every(m => Array.isArray(m.embedding) && m.embedding.length > 0);
    if (!hasEmbeddings) {
      log(`[cluster] 警告: 部分记忆没有嵌入向量，聚类可能不准确`);
    }
    
    // 准备记忆数据以传递给Python
    const memoriesData = memories.map(m => ({
      id: m.id,
      content: m.content,
      embedding: m.embedding,
      summary: m.summary,
      keywords: m.keywords
    }));
    
    const userId = memories[0].userId; // 假设所有记忆属于同一用户
    
    // 调用Python服务进行聚类
    const pythonProcess = spawn('python3', ['-c', `
import asyncio
import sys
import json
sys.path.append('server')
from services.learning_memory import learning_memory_service

async def cluster_memories():
    # 准备记忆数据
    memories_data = ${JSON.stringify(memoriesData)}
    
    # 调用聚类方法
    clusters = await learning_memory_service.cluster_memories(memories_data, ${userId})
    
    # 转换为JSON输出
    print(json.dumps(clusters, ensure_ascii=False))

asyncio.run(cluster_memories())
    `]);
    
    let output = '';
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    return new Promise((resolve, reject) => {
      pythonProcess.on('close', async (code) => {
        if (code !== 0) {
          log(`[cluster] 聚类失败，Python进程退出码: ${code}`);
          // 使用备用方法进行简单聚类
          const fallbackClusters = await performSimpleClustering(memories, options);
          resolve(fallbackClusters);
        } else {
          try {
            const clusters = JSON.parse(output.trim());
            log(`[cluster] 成功创建 ${Object.keys(clusters).length} 个聚类`);
            
            // 转换Python返回的聚类格式为我们的Cluster接口
            const formattedClusters: Cluster[] = [];
            
            for (const [topicId, topicData] of Object.entries(clusters)) {
              // 创建聚类对象
              const cluster: Cluster = {
                id: topicId,
                label: (topicData as any).topic || `主题 ${formattedClusters.length + 1}`,
                centroid: (topicData as any).centroid || [],
                memoryIds: (topicData as any).memory_ids || [],
                keywords: (topicData as any).keywords || [],
                summary: (topicData as any).summary || ''
              };
              
              formattedClusters.push(cluster);
            }
            
            // 为没有摘要的聚类生成摘要
            for (const cluster of formattedClusters) {
              if (!cluster.summary && cluster.memoryIds.length > 0) {
                // 收集该聚类中所有记忆的内容
                const clusterMemories = memories.filter(m => cluster.memoryIds.includes(m.id));
                const combinedContent = clusterMemories
                  .map(m => m.summary || m.content.substring(0, 200))
                  .join(' ');
                
                if (combinedContent) {
                  // 生成聚类摘要
                  const summaryResult = await summarizeText(combinedContent);
                  cluster.summary = summaryResult.summary;
                  if (!cluster.keywords || cluster.keywords.length === 0) {
                    cluster.keywords = summaryResult.keywords || [];
                  }
                }
              }
            }
            
            resolve(formattedClusters);
          } catch (error) {
            log(`[cluster] 解析聚类结果失败: ${error}`);
            // 使用备用方法进行简单聚类
            const fallbackClusters = await performSimpleClustering(memories, options);
            resolve(fallbackClusters);
          }
        }
      });
      
      pythonProcess.stderr.on('data', (data) => {
        log(`[cluster] Python错误: ${data}`);
      });
      
      pythonProcess.on('error', async (error) => {
        log(`[cluster] 启动Python进程失败: ${error}`);
        // 使用备用方法进行简单聚类
        const fallbackClusters = await performSimpleClustering(memories, options);
        resolve(fallbackClusters);
      });
    });
  } catch (error) {
    log(`[cluster] 聚类时遇到错误: ${error}`);
    return performSimpleClustering(memories, options);
  }
}

/**
 * 计算主题之间的关系强度
 * 
 * @param clusters 聚类列表
 * @returns 主题关系列表，包含源、目标和强度
 */
export function calculateTopicRelations(
  clusters: Cluster[]
): { source: string; target: string; strength: number }[] {
  const relations: { source: string; target: string; strength: number }[] = [];
  
  if (clusters.length <= 1) {
    return relations;
  }
  
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const cluster1 = clusters[i];
      const cluster2 = clusters[j];
      
      // 有效性检查
      if (!cluster1.centroid || !cluster2.centroid || 
          cluster1.centroid.length === 0 || 
          cluster2.centroid.length === 0 || 
          cluster1.centroid.length !== cluster2.centroid.length) {
        continue;
      }
      
      // 计算余弦相似度
      const similarity = cosineSimilarity(cluster1.centroid, cluster2.centroid);
      
      // 关键词相似度增强
      let keywordSimilarity = 0;
      if (cluster1.keywords && cluster2.keywords && 
          cluster1.keywords.length > 0 && cluster2.keywords.length > 0) {
        
        const sharedKeywords = cluster1.keywords.filter(k => 
          cluster2.keywords.includes(k)
        );
        
        keywordSimilarity = sharedKeywords.length / 
          Math.max(cluster1.keywords.length, cluster2.keywords.length);
      }
      
      // 组合相似度，加权平均
      const strength = 0.7 * similarity + 0.3 * keywordSimilarity;
      
      // 只添加强度超过阈值的关系
      if (strength > 0.3) {
        relations.push({
          source: cluster1.id,
          target: cluster2.id,
          strength
        });
      }
    }
  }
  
  return relations;
}

/**
 * 简单聚类方法（后备方法）
 * 
 * @param memories 记忆列表
 * @param options 聚类选项
 * @returns 聚类结果
 */
async function performSimpleClustering(
  memories: Memory[],
  options: ClusterOptions = {}
): Promise<Cluster[]> {
  const clusters: Cluster[] = [];
  const maxClusters = Math.min(options.maxClusters || 5, memories.length);
  
  // 按时间线分组，创建时间桶
  const timeChunks: Memory[][] = [];
  const sortedMemories = [...memories].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  // 简单地将记忆划分为几个时间段
  const chunkSize = Math.ceil(sortedMemories.length / maxClusters);
  for (let i = 0; i < sortedMemories.length; i += chunkSize) {
    timeChunks.push(sortedMemories.slice(i, i + chunkSize));
  }
  
  // 为每个时间桶创建一个聚类
  for (let i = 0; i < timeChunks.length; i++) {
    const chunk = timeChunks[i];
    if (chunk.length === 0) continue;
    
    // 收集该时间段内所有记忆的内容
    const combinedContent = chunk
      .map(m => m.summary || m.content.substring(0, 200))
      .join(' ');
    
    // 生成聚类摘要和关键词
    const summaryResult = await summarizeText(combinedContent);
    
    // 如果有嵌入向量，计算平均向量作为中心向量
    let centroid: number[] = [];
    if (chunk[0].embedding && chunk[0].embedding.length > 0) {
      const dimension = chunk[0].embedding.length;
      centroid = new Array(dimension).fill(0);
      
      let validEmbeddings = 0;
      for (const memory of chunk) {
        if (memory.embedding && memory.embedding.length === dimension) {
          for (let j = 0; j < dimension; j++) {
            centroid[j] += memory.embedding[j];
          }
          validEmbeddings++;
        }
      }
      
      // 计算平均值
      if (validEmbeddings > 0) {
        for (let j = 0; j < dimension; j++) {
          centroid[j] /= validEmbeddings;
        }
      }
    }
    
    // 创建聚类
    clusters.push({
      id: `cluster_time_${i}_${Date.now()}`,
      label: summaryResult.summary.substring(0, 50),
      centroid,
      memoryIds: chunk.map(m => m.id),
      keywords: summaryResult.keywords || [],
      summary: summaryResult.summary
    });
  }
  
  return clusters;
}

/**
 * 计算两个向量的余弦相似度
 * 
 * @param vec1 第一个向量
 * @param vec2 第二个向量
 * @returns 相似度值 (0-1)
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (!vec1 || !vec2 || vec1.length === 0 || vec2.length === 0 || vec1.length !== vec2.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    normA += vec1[i] * vec1[i];
    normB += vec2[i] * vec2[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}