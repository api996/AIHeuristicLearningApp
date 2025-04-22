/**
 * TopicGraphBuilder服务
 * 使用Gemini 2.0 Flash模型分析记忆聚类，生成主题图谱
 */

import { log } from "../../vite";
import { callGemini } from '../genai/genai_service';
import { db } from "../../db";
import { memories, memoryKeywords, knowledgeGraphCache } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

// 聚类中心类型定义
interface ClusterCenter {
  id: string;            // e.g. "cluster_0"
  texts: string[];       // 聚类后属于此中心的原始文本段落列表
}

// 主题关系类型
interface Relation {
  source: string;
  target: string; 
  type: string;
  reason: string;
}

// 图谱数据结构
interface GraphData {
  nodes: { 
    id: string;
    label?: string;
    category?: string;
    size?: number;
    color?: string;
  }[];
  links: { 
    source: string;
    target: string;
    label?: string;
    type?: string;
    reason?: string;
    value?: number;
  }[];
}

/**
 * 从聚类中心提取主题名称
 * @param center 聚类中心
 * @returns 提取的主题名称
 */
async function extractTopicName(center: ClusterCenter): Promise<string> {
  try {
    // 如果文本片段过多，只取前5个，避免模型输入太长
    const textsToUse = center.texts.slice(0, 5);
    
    const prompt = `
给定以下同一主题的若干文本片段，请提炼出一句精准的中文主题名称（不超过20字）：
${textsToUse.map((t, i) => `${i+1}. ${t}`).join('\n')}
只输出主题名称，不要其它说明。`;

    const resp = await callGemini(prompt, { model: 'gemini-2.0-flash' });
    return resp.trim();
  } catch (error) {
    log(`[TopicGraphBuilder] 提取主题名称出错: ${error}`);
    // 失败时返回默认名称
    return `主题${center.id.replace('cluster_', '')}`;
  }
}

/**
 * 提取两两主题间的关系
 * @param topics 主题列表
 * @returns 主题间的关系列表
 */
async function extractRelations(topics: string[]): Promise<Relation[]> {
  const rels: Relation[] = [];
  
  try {
    // 如果主题超过5个，随机选择一些对，避免组合爆炸
    const maxPairs = topics.length <= 5 ? topics.length * (topics.length - 1) / 2 : 10;
    let pairCount = 0;
    
    for (let i = 0; i < topics.length && pairCount < maxPairs; i++) {
      for (let j = i + 1; j < topics.length && pairCount < maxPairs; j++) {
        // 每次概率性跳过一些对，如果主题太多的话
        if (topics.length > 5 && Math.random() > 0.6) continue;
        
        const A = topics[i], B = topics[j];
        const prompt = `
判断下面两个中文主题之间的语义关系，只能在【包含/引用/应用/相似/无明显关系】中选择，并给出一句原因：
A: ${A}
B: ${B}
输出格式：A → B（关系类型）：原因说明`;

        const resp = await callGemini(prompt, { model: 'gemini-2.0-flash' });
        const m = resp.match(/(.+?) → (.+?)（(.+?)）：(.+)/);
        
        if (m) {
          rels.push({
            source: m[1].trim(), 
            target: m[2].trim(),
            type: m[3].trim(), 
            reason: m[4].trim()
          });
        } else {
          // 如果没有匹配到预期格式，添加默认关系类型为"相关"
          rels.push({
            source: A,
            target: B,
            type: "相关",
            reason: "主题间存在语义联系"
          });
        }
        
        pairCount++;
      }
    }
  } catch (error) {
    log(`[TopicGraphBuilder] 提取主题关系出错: ${error}`);
  }
  
  return rels;
}

/**
 * 将关系类型转换为前端图谱可用的关系类型
 * @param relationType 关系类型（包含/引用/应用/相似/无明显关系）
 * @returns 标准化的关系类型
 */
function normalizeRelationType(relationType: string): {type: string, value: number} {
  switch (relationType) {
    case '包含':
      return { type: 'contains', value: 0.8 };
    case '引用':
      return { type: 'references', value: 0.7 };
    case '应用':
      return { type: 'applies', value: 0.6 };
    case '相似':
      return { type: 'similar', value: 0.5 };
    case '无明显关系':
      return { type: 'unrelated', value: 0.2 };
    default:
      return { type: 'related', value: 0.4 };
  }
}

/**
 * 构建知识图谱数据
 * @param centers 聚类中心数据
 * @returns 图谱数据
 */
export async function buildGraph(centers: ClusterCenter[]): Promise<GraphData> {
  try {
    log(`[TopicGraphBuilder] 开始构建图谱，共有 ${centers.length} 个聚类中心`);
    
    // 1. 提取主题名称
    const topicPromises = centers.map(c => extractTopicName(c));
    const topics = await Promise.all(topicPromises);
    
    log(`[TopicGraphBuilder] 提取的主题: ${topics.join(', ')}`);
    
    // 2. 提取主题间的关系
    const relations = await extractRelations(topics);
    
    log(`[TopicGraphBuilder] 提取了 ${relations.length} 个主题关系`);
    
    // 3. 构建图谱数据
    const nodes = topics.map((topic, index) => {
      // 为节点分配不同的颜色
      const category = 'cluster';
      const size = 10 + Math.floor(Math.random() * 10); // 10-20之间的随机大小
      
      return {
        id: topic,
        label: topic,
        category,
        size
      };
    });
    
    const links = relations.map(rel => {
      const { type, value } = normalizeRelationType(rel.type);
      
      return {
        source: rel.source,
        target: rel.target,
        type,
        value,
        label: rel.type,
        reason: rel.reason
      };
    });
    
    log(`[TopicGraphBuilder] 图谱构建完成: ${nodes.length} 个节点, ${links.length} 个连接`);
    
    return { nodes, links };
  } catch (error) {
    log(`[TopicGraphBuilder] 构建图谱失败: ${error}`);
    throw error;
  }
}

/**
 * 从用户记忆数据中构建聚类中心并生成图谱
 * @param userId 用户ID
 * @returns 图谱数据
 */
export async function buildUserKnowledgeGraph(userId: number): Promise<GraphData> {
  try {
    // 1. 获取用户的记忆数据
    const userMemories = await db.select({
      id: memories.id,
      content: memories.content,
      summary: memories.summary
    })
    .from(memories)
    .where(eq(memories.userId, userId));
    
    if (userMemories.length === 0) {
      log(`[TopicGraphBuilder] 用户 ${userId} 没有记忆数据`);
      return { nodes: [], links: [] };
    }
    
    log(`[TopicGraphBuilder] 为用户 ${userId} 加载了 ${userMemories.length} 条记忆`);
    
    // 2. 简单地按ID分组，每5个记忆形成一个聚类
    // 在实际实现中，应该使用更复杂的聚类算法
    const clusterSize = 5;
    const clusters: ClusterCenter[] = [];
    
    for (let i = 0; i < userMemories.length; i += clusterSize) {
      const clusterMemories = userMemories.slice(i, i + clusterSize);
      clusters.push({
        id: `cluster_${Math.floor(i / clusterSize)}`,
        texts: clusterMemories.map(m => m.summary || m.content)
      });
    }
    
    log(`[TopicGraphBuilder] 创建了 ${clusters.length} 个聚类中心`);
    
    // 3. 根据聚类构建图谱
    const graphData = await buildGraph(clusters);
    
    // 4. 保存图谱到缓存
    await db.insert(knowledgeGraphCache)
      .values({
        userId,
        nodes: graphData.nodes,
        links: graphData.links,
        version: 1,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 1天后过期
      })
      .onConflictDoUpdate({
        target: [knowledgeGraphCache.userId],
        set: {
          nodes: graphData.nodes,
          links: graphData.links,
          version: sql`${knowledgeGraphCache.version} + 1`,
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
    
    return graphData;
  } catch (error) {
    log(`[TopicGraphBuilder] 为用户 ${userId} 构建知识图谱失败: ${error}`);
    throw error;
  }
}

/**
 * 测试模块功能
 */
export async function testTopicGraphBuilder() {
  try {
    // 创建测试数据
    const testClusters: ClusterCenter[] = [
      {
        id: "cluster_0",
        texts: [
          "前端开发中的响应式布局设计原则",
          "使用CSS媒体查询实现不同设备适配",
          "移动优先设计方法和最佳实践"
        ]
      },
      {
        id: "cluster_1",
        texts: [
          "React生命周期方法详解",
          "React Hooks的使用和优势",
          "React状态管理解决方案比较"
        ]
      },
      {
        id: "cluster_2",
        texts: [
          "RESTful API设计原则和最佳实践",
          "如何设计高性能的API接口",
          "API版本控制策略与演进"
        ]
      }
    ];
    
    // 测试生成图谱
    const graph = await buildGraph(testClusters);
    log(`[TopicGraphBuilder] 测试成功: 生成了 ${graph.nodes.length} 个节点和 ${graph.links.length} 个连接`);
    
    return graph;
  } catch (error) {
    log(`[TopicGraphBuilder] 测试失败: ${error}`);
    throw error;
  }
}

// SQL函数已在顶部导入