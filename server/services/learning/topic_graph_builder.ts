/**
 * TopicGraphBuilder服务
 * 使用Gemini 2.0 Flash模型分析记忆聚类，生成主题图谱
 */

import { log } from "../../vite";
import { db } from "../../db";
import { memories, memoryKeywords, knowledgeGraphCache } from "@shared/schema";
import { eq, sql, desc } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { storage } from "../../storage";
import { memoryService } from "./memory_service";
import { analyzeLearningPath } from "../learning";

// 初始化Gemini API客户端
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * 使用Gemini模型生成内容
 * @param prompt 提示词
 * @param options 选项
 * @returns 生成的文本内容
 */
async function callGeminiModel(prompt: string, options: { model: string }): Promise<string> {
  try {
    const modelName = options.model === 'gemini-2.0-flash' ? 'gemini-1.5-flash' : options.model;
    const model = genAI.getGenerativeModel({ model: modelName });
    
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 500
      }
    });
    
    return result.response.text().trim();
  } catch (error) {
    log(`[TopicGraphBuilder] Gemini API调用失败: ${error}`);
    return `调用失败: ${error}`;
  }
}

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
  strength?: number;         // 关系强度（1-10）
  learningOrder?: string;    // 学习顺序建议
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
    strength?: number;
    learningOrder?: string;
    color?: string;
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
给定以下同一主题的若干文本片段，请提炼出一句精准的中文主题名称（不超过20字）。
这个主题名称应该能准确概括文本片段的核心内容，是一个有意义的、专业的主题。
请分析文本的共同点，提取关键概念，确保名称既简洁又有表达力。

文本片段:
${textsToUse.map((t, i) => `${i+1}. ${t}`).join('\n')}

只输出主题名称，不要其它说明。`;

    const resp = await callGeminiModel(prompt, { model: 'gemini-2.0-flash' });
    const cleanResp = resp.trim();
    
    // 验证响应是否有意义，如果看起来像默认值或错误信息，使用备用方案
    if (cleanResp.startsWith('调用失败') || 
        cleanResp.length < 2 || 
        cleanResp.length > 50 ||
        cleanResp.includes('无法') ||
        cleanResp.includes('错误')) {
        
      // 使用更简单但仍有意义的方式分析文本
      // 从文本中提取关键词，并将它们组合成主题
      const keywords = extractKeywordsFromTexts(textsToUse);
      if (keywords.length > 0) {
        return keywords.slice(0, 3).join('与') + '研究';
      }
      
      // 如果仍然失败，返回更有意义的默认名称
      const clusterNum = center.id.replace('cluster_', '');
      const defaultNames = [
        '知识探索', '学习概念', '关键理论', 
        '重要原理', '核心思想', '基础知识',
        '应用技术', '实践方法', '系统架构'
      ];
      return defaultNames[parseInt(clusterNum) % defaultNames.length];
    }
    
    return cleanResp;
  } catch (error) {
    log(`[TopicGraphBuilder] 提取主题名称出错: ${error}`);
    
    // 失败时返回有意义的默认名称
    const clusterNum = center.id.replace('cluster_', '');
    const defaultNames = [
      '知识探索', '学习概念', '关键理论', 
      '重要原理', '核心思想', '基础知识',
      '应用技术', '实践方法', '系统架构'
    ];
    return defaultNames[parseInt(clusterNum) % defaultNames.length];
  }
}

/**
 * 从文本中提取关键词
 * @param texts 文本列表
 * @returns 关键词列表
 */
function extractKeywordsFromTexts(texts: string[]): string[] {
  // 这是一个简单版本，实际中可以使用更复杂的NLP方法
  const allText = texts.join(' ');
  
  // 常见的停用词
  const stopwords = ['的', '和', '与', '在', '是', '了', '有', '这', '那', '这些', '那些', 
                      '我', '你', '他', '她', '它', '我们', '你们', '他们', '如何', '如果',
                      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'of', 'for'];
  
  // 将文本分割成词并计数
  const wordCounts: Record<string, number> = {};
  
  // 使用正则表达式分割中英文词汇
  const words = allText.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+/g) || [];
  
  words.forEach(word => {
    // 过滤掉停用词和太短的词
    if (!stopwords.includes(word.toLowerCase()) && word.length > 1) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
  });
  
  // 转换为数组并按出现频率排序
  const sortedWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);
  
  return sortedWords.slice(0, 5); // 返回前5个关键词
}

/**
 * 提取两两主题间的关系
 * @param topics 主题列表
 * @param centerTexts 聚类中心的文本内容，用于深度分析
 * @param topicMetadata 主题的元数据，包括聚类ID等额外信息
 * @returns 主题间的关系列表
 */
async function extractRelations(
  topics: string[], 
  centerTexts?: Record<string, string[]>,
  topicMetadata?: Record<string, any>
): Promise<Relation[]> {
  const rels: Relation[] = [];
  
  try {
    // 如果主题超过5个，随机选择一些对，避免组合爆炸
    const maxPairs = topics.length <= 5 ? topics.length * (topics.length - 1) / 2 : 10;
    let pairCount = 0;
    
    // 创建主题对，确保覆盖所有主题
    const pairs: [string, string][] = [];
    for (let i = 0; i < topics.length; i++) {
      for (let j = i + 1; j < topics.length; j++) {
        pairs.push([topics[i], topics[j]]);
      }
    }
    
    // 如果对太多，智能选择而不是随机选择
    // 优先分析相邻主题，以确保图谱连通性
    if (pairs.length > maxPairs) {
      const selectedPairs: [string, string][] = [];
      
      // 确保每个主题至少有一个连接
      const coveredTopics = new Set<string>();
      
      // 首先添加所有相邻主题对
      for (let i = 0; i < topics.length - 1; i++) {
        selectedPairs.push([topics[i], topics[i + 1]]);
        coveredTopics.add(topics[i]);
        coveredTopics.add(topics[i + 1]);
      }
      
      // 如果还有空间，添加其他主题对
      const remainingPairs = pairs.filter(
        pair => !selectedPairs.some(selected => 
          (selected[0] === pair[0] && selected[1] === pair[1]) || 
          (selected[0] === pair[1] && selected[1] === pair[0])
        )
      );
      
      // 根据剩余的maxPairs槽位，按优先级添加其余对
      const slotsLeft = maxPairs - selectedPairs.length;
      if (slotsLeft > 0 && remainingPairs.length > 0) {
        selectedPairs.push(...remainingPairs.slice(0, slotsLeft));
      }
      
      // 使用选定的对替换原始对列表
      pairs.length = 0;
      pairs.push(...selectedPairs);
    }
    
    // 处理每一对主题
    for (const [A, B] of pairs) {
      // 准备文本摘要和元数据，增强上下文
      let textSummaryA = "";
      let textSummaryB = "";
      let metadataA = "";
      let metadataB = "";
      
      // 提取文本数据
      if (centerTexts) {
        const textsA = centerTexts[A] || [];
        const textsB = centerTexts[B] || [];
        
        if (textsA.length > 0) {
          // 增加到最多3段文本，提供更丰富的上下文
          textSummaryA = `主题A的相关文本摘要:\n${textsA.slice(0, 3).join('\n\n---\n\n')}\n`;
        }
        
        if (textsB.length > 0) {
          textSummaryB = `主题B的相关文本摘要:\n${textsB.slice(0, 3).join('\n\n---\n\n')}\n`;
        }
      }
      
      // 添加元数据，如果有的话
      if (topicMetadata) {
        const metaA = topicMetadata[A];
        const metaB = topicMetadata[B];
        
        if (metaA) {
          metadataA = `主题A元数据: 聚类ID=${metaA.clusterId || 'unknown'}, 文本数量=${metaA.textCount || 0}\n`;
        }
        
        if (metaB) {
          metadataB = `主题B元数据: 聚类ID=${metaB.clusterId || 'unknown'}, 文本数量=${metaB.textCount || 0}\n`;
        }
      }
      
      const prompt = `
作为知识关系分析专家，请分析以下两个学习主题之间的关系，提供详尽的知识图谱连接分析:

主题A: ${A}
${metadataA}
主题B: ${B}
${metadataB}

${textSummaryA}
${textSummaryB}

请深入分析这两个主题之间的知识关系，特别关注以下几个方面:

1. 关系类型(必选一项):
   - 前置知识: 一个主题是另一个的基础，学习顺序明确
   - 包含关系: 一个主题是另一个的子集或超集
   - 应用关系: 一个主题的知识应用于另一个主题
   - 相似概念: 两个主题有显著相似之处
   - 互补知识: 两个主题相互补充，共同构成更完整的知识体系
   - 无直接关系: 主题间没有明显联系

2. 关系强度: 从1(非常弱)到10(非常强)评分

3. 学习顺序建议:
   - 应该先学习哪个主题，再学习哪个？
   - 如果可以同时学习，请明确说明

4. 关系描述:
   - 用1-2句话简明扼要地解释这两个主题之间的具体关系

请按以下JSON格式输出结果，不要包含额外的说明或文本:
{
  "relationType": "关系类型",
  "strength": 数字(1-10),
  "learningOrder": "先学A后学B" 或 "先学B后学A" 或 "可同时学习",
  "explanation": "关系说明",
  "bidirectional": true或false  // 关系是否双向
}

仅返回JSON格式数据，无需任何其他解释或前缀。`;

        try {
          const resp = await callGeminiModel(prompt, { model: 'gemini-1.5-flash' });
          log(`[TopicGraphBuilder] 主题关系分析原始响应: ${resp}`);
          
          // 尝试解析JSON响应
          let relationData;
          try {
            // 查找JSON对象
            const jsonMatch = resp.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              relationData = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error("未找到有效的JSON数据");
            }
          } catch (jsonError) {
            log(`[TopicGraphBuilder] JSON解析错误: ${jsonError}, 尝试结构化提取`);
            
            // 使用正则表达式提取信息
            const typeMatch = resp.match(/"relationType":\s*"([^"]*)"/);
            const strengthMatch = resp.match(/"strength":\s*(\d+)/);
            const orderMatch = resp.match(/"learningOrder":\s*"([^"]*)"/);
            const explanationMatch = resp.match(/"explanation":\s*"([^"]*)"/);
            
            relationData = {
              relationType: typeMatch ? typeMatch[1] : "相关概念",
              strength: strengthMatch ? parseInt(strengthMatch[1]) : 5,
              learningOrder: orderMatch ? orderMatch[1] : "可同时学习",
              explanation: explanationMatch ? explanationMatch[1] : "主题间存在知识关联"
            };
          }
          
          // 规范化关系类型
          const validRelationTypes = [
            "前置知识", "包含关系", "应用关系", "相似概念", "互补知识", "无直接关系"
          ];
          
          if (!validRelationTypes.includes(relationData.relationType)) {
            relationData.relationType = "相关概念";
          }
          
          // 确保强度在1-10范围内
          relationData.strength = Math.max(1, Math.min(10, relationData.strength));
          
          rels.push({
            source: A,
            target: B,
            type: relationData.relationType,
            strength: relationData.strength,
            learningOrder: relationData.learningOrder,
            reason: relationData.explanation || "主题间存在知识关联"
          });
          
          log(`[TopicGraphBuilder] 成功分析主题关系: ${A} - ${B}, 类型: ${relationData.relationType}, 强度: ${relationData.strength}`);
        } catch (apiError) {
          log(`[TopicGraphBuilder] API调用失败: ${apiError}, 使用默认关系`);
          
          // 如果API调用失败，添加默认关系
          rels.push({
            source: A,
            target: B,
            type: "相关概念",
            strength: 5,
            learningOrder: "可同时学习",
            reason: "主题间可能存在知识关联"
          });
        }
      
      pairCount++;
    }
  } catch (error) {
    log(`[TopicGraphBuilder] 提取主题关系出错: ${error}`);
  }
  
  return rels;
}

/**
 * 将关系类型转换为前端图谱可用的关系类型
 * @param relationType 关系类型（前置知识、包含关系、应用关系、相似概念、互补知识、无直接关系）
 * @returns 标准化的关系类型
 */
function normalizeRelationType(relationType: string): {type: string, value: number} {
  switch (relationType) {
    case '前置知识':
      return { type: 'prerequisite', value: 0.9 };
    case '包含关系':
      return { type: 'contains', value: 0.8 };
    case '应用关系':
      return { type: 'applies', value: 0.7 };
    case '相似概念':
      return { type: 'similar', value: 0.6 };
    case '互补知识':
      return { type: 'complements', value: 0.5 };
    case '无直接关系':
      return { type: 'unrelated', value: 0.2 };
      
    // 兼容旧版关系类型
    case '包含':
      return { type: 'contains', value: 0.8 };
    case '引用':
      return { type: 'references', value: 0.7 };
    case '应用':
      return { type: 'applies', value: 0.7 };
    case '相似':
      return { type: 'similar', value: 0.6 };
    case '相关概念':
      return { type: 'related', value: 0.4 };
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
    
    // 为深度分析准备文本内容映射，增强上下文信息
    const topicTextsMap: Record<string, string[]> = {};
    const topicMetadataMap: Record<string, any> = {};
    
    topics.forEach((topic, index) => {
      // 每个主题最多取5段文本，增加上下文内容
      topicTextsMap[topic] = centers[index].texts.slice(0, 5);
      
      // 保存每个主题的元数据，包括聚类ID、中心向量等可用信息
      topicMetadataMap[topic] = {
        clusterId: centers[index].id,
        textCount: centers[index].texts.length,
        // 如果有其他元数据，可以在这里添加
      };
    });
    
    log(`[TopicGraphBuilder] 为关系分析准备了 ${Object.keys(topicTextsMap).length} 个主题的上下文数据，每个主题包含最多5段文本`);
    
    // 2. 提取主题间的关系，提供增强的文本内容和元数据以便更深入的分析
    const relations = await extractRelations(topics, topicTextsMap, topicMetadataMap);
    
    log(`[TopicGraphBuilder] 提取了 ${relations.length} 个主题关系`);
    
    // 预定义主题节点颜色，确保不同主题有不同颜色
    const themeColors = [
      '#6366f1', // 靛蓝色
      '#10b981', // 翠绿色
      '#f59e0b', // 琥珀色
      '#ec4899', // 玫红色
      '#8b5cf6', // 紫色
      '#14b8a6', // 青色
      '#f97316', // 橙色
      '#06b6d4', // 天蓝色
      '#a855f7', // 紫罗兰色
    ];
    
    // 3. 构建图谱数据
    const nodes = topics.map((topic, index) => {
      // 为节点分配不同的颜色
      const category = 'cluster';
      const size = 15 + Math.floor(Math.random() * 5); // 15-20之间的随机大小
      const color = themeColors[index % themeColors.length]; // 循环使用颜色
      
      return {
        id: topic,
        label: topic,
        category,
        size,
        color
      };
    });
    
    const links = relations.map(rel => {
      const { type, value } = normalizeRelationType(rel.type);
      
      // 根据关系类型设置连接线颜色
      let linkColor: string;
      switch(type) {
        case 'prerequisite':
          linkColor = 'rgba(220, 38, 38, 0.7)'; // 深红色，表示前置知识
          break;
        case 'contains':
          linkColor = 'rgba(99, 102, 241, 0.7)'; // 靛蓝色
          break;
        case 'references':
          linkColor = 'rgba(139, 92, 246, 0.7)'; // 紫色
          break;
        case 'applies':
          linkColor = 'rgba(14, 165, 233, 0.7)'; // 天蓝色
          break;
        case 'similar':
          linkColor = 'rgba(16, 185, 129, 0.7)'; // 绿色
          break;
        case 'complements':
          linkColor = 'rgba(245, 158, 11, 0.7)'; // 琥珀色，表示互补关系
          break;
        default:
          linkColor = 'rgba(156, 163, 175, 0.7)'; // 灰色
      }
      
      // 根据关系强度调整连接线的宽度/值
      // 如果有明确的强度，使用它，否则使用默认值
      const strengthValue = rel.strength 
        ? (rel.strength / 10) * 2 // 将1-10的强度转换为0.2-2.0的值
        : value;
      
      // 获取学习顺序信息
      const learningOrderLabel = rel.learningOrder 
        ? ` (${rel.learningOrder})` 
        : '';
      
      // 构建更详细的标签，包含关系类型和学习顺序
      const detailedLabel = `${rel.type}${learningOrderLabel}`;
      
      return {
        source: rel.source,
        target: rel.target,
        type,
        value: strengthValue,
        label: detailedLabel,
        reason: rel.reason,
        color: linkColor,
        strength: rel.strength,
        learningOrder: rel.learningOrder
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
 * 图谱接口定义
 */
export interface KnowledgeNode {
  id: string;          // 节点ID
  label: string;       // 节点标签
  size?: number;       // 节点大小
  category?: string;   // 节点类别
  clusterId?: string;  // 聚类ID
  color?: string;      // 节点颜色
}

/**
 * 知识图谱连接
 */
export interface KnowledgeLink {
  source: string;         // 源节点ID
  target: string;         // 目标节点ID
  value?: number;         // 连接强度（0-1之间）
  type?: string;          // 连接类型
  label?: string;         // 连接标签
  reason?: string;        // 关系说明
  strength?: number;      // 关系强度（1-10）
  learningOrder?: string; // 学习顺序建议
  color?: string;         // 连接颜色
}

/**
 * 知识图谱接口
 */
export interface KnowledgeGraph {
  nodes: KnowledgeNode[];  // 图谱节点
  links: KnowledgeLink[];  // 图谱连接
}

/**
 * 从用户记忆数据中构建聚类中心并生成图谱
 * 使用记忆服务提供的聚类结果生成更有意义的主题图谱
 * @param userId 用户ID
 * @param forceRefresh 是否强制刷新，不使用缓存
 * @returns 图谱数据
 */
export async function buildUserKnowledgeGraph(userId: number, forceRefresh: boolean = false): Promise<GraphData> {
  try {
    // 检查缓存，如果不是强制刷新，优先使用缓存
    if (!forceRefresh) {
      // 从数据库获取缓存
      const cachedGraph = await db.select()
        .from(knowledgeGraphCache)
        .where(eq(knowledgeGraphCache.userId, userId))
        .orderBy(desc(knowledgeGraphCache.version))
        .limit(1);
      
      if (cachedGraph.length > 0 && cachedGraph[0].nodes && cachedGraph[0].links) {
        log(`[TopicGraphBuilder] 使用缓存的知识图谱，用户ID=${userId}，版本=${cachedGraph[0].version}`);
        return {
          nodes: cachedGraph[0].nodes as any[],
          links: cachedGraph[0].links as any[]
        };
      }
      
      log(`[TopicGraphBuilder] 未找到用户${userId}的知识图谱缓存或缓存已过期，将重新生成`);
    } else {
      log(`[TopicGraphBuilder] 强制刷新用户${userId}的知识图谱，跳过缓存`);
    }
    
    // 1. 直接从内存服务获取用户数据，不通过API调用
    log(`[TopicGraphBuilder] ====== 为用户 ${userId} 从记忆服务获取聚类数据 ======`);
    
    // 通过学习分析服务获取数据，而不是通过HTTP API
    const learningPathData = await analyzeLearningPath(userId);
    log(`[TopicGraphBuilder] 获取到用户 ${userId} 的学习路径数据，包含 ${learningPathData.nodes?.length || 0} 个节点和 ${learningPathData.links?.length || 0} 个连接`);
    
    // 记录部分节点示例
    if (learningPathData.nodes?.length > 0) {
      const nodeExamples = learningPathData.nodes.slice(0, 3);
      log(`[TopicGraphBuilder] 节点示例: ${JSON.stringify(nodeExamples)}`);
    }
    
    // 2. 提取聚类主题数据
    // 检查每个节点的类别和类型
    learningPathData.nodes.forEach((node: any, index: number) => {
      log(`[TopicGraphBuilder] 节点 ${index}: id=${node.id}, category=${node.category}, type=${node.type || 'undefined'}`);
    });
    
    // 从学习路径中提取主题节点，识别所有可能的聚类类型
    const clusterNodes = learningPathData.nodes.filter((node: any) => 
      node.category === 'cluster' || 
      node.category === '记忆主题' || 
      node.category === 'memory_topic' ||
      node.label?.includes('聚类') ||
      node.label?.includes('主题')
    );
    
    log(`[TopicGraphBuilder] 原始节点数据: ${JSON.stringify(learningPathData.nodes)}`); // 调试用
    
    log(`[TopicGraphBuilder] 过滤出 ${clusterNodes.length} 个聚类节点`);
    if (clusterNodes.length > 0) {
      log(`[TopicGraphBuilder] 聚类节点示例: ${JSON.stringify(clusterNodes[0])}`);
    }
    
    if (clusterNodes.length === 0) {
      log(`[TopicGraphBuilder] 用户 ${userId} 没有有效的聚类数据`);
      return { nodes: [], links: [] };
    }
    
    log(`[TopicGraphBuilder] 从学习路径数据中找到 ${clusterNodes.length} 个聚类`);
    
    // 3. 获取每个聚类的记忆内容，以便进行主题提取
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
    
    // 4. 根据聚类ID找到对应的记忆，创建聚类中心数据
    const clusters: ClusterCenter[] = [];
    
    // 遍历每个聚类节点
    for (const clusterNode of clusterNodes) {
      const clusterId = clusterNode.clusterId || clusterNode.id.replace('cluster_', '');
      
      // 获取该聚类中所有记忆的ID (从学习路径中的记忆节点)
      const clusterMemoryIds = new Set<string>();
      learningPathData.links
        .filter((link: any) => 
          (link.source === clusterNode.id && link.target.startsWith('memory_')) ||
          (link.target === clusterNode.id && link.source.startsWith('memory_'))
        )
        .forEach((link: any) => {
          const memoryNode = link.source.startsWith('memory_') ? link.source : link.target;
          clusterMemoryIds.add(memoryNode.replace('memory_', ''));
        });
      
      // 查找聚类对应的记忆内容
      const clusterMemories = userMemories.filter(memory => 
        clusterMemoryIds.has(memory.id)
      );
      
      // 如果没有找到记忆，使用随机抽样
      const memoriesToUse = clusterMemories.length > 0 
        ? clusterMemories 
        : userMemories
            .sort(() => 0.5 - Math.random()) // 随机排序
            .slice(0, Math.min(5, userMemories.length)); // 取前5个
      
      clusters.push({
        id: `cluster_${clusterId}`,
        texts: memoriesToUse.map(m => m.summary || m.content)
      });
    }
    
    log(`[TopicGraphBuilder] 创建了 ${clusters.length} 个聚类中心`);
    
    // 5. 根据聚类构建图谱
    const graphData = await buildGraph(clusters);
    
    // 记录生成的图谱数据
    log(`[TopicGraphBuilder] 生成的图谱数据: ${graphData.nodes.length} 个节点, ${graphData.links.length} 个连接`);
    if (graphData.nodes.length > 0) {
      log(`[TopicGraphBuilder] 节点示例: ${JSON.stringify(graphData.nodes[0])}`);
    }
    if (graphData.links.length > 0) {
      log(`[TopicGraphBuilder] 连接示例: ${JSON.stringify(graphData.links[0])}`);
    }
    
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
    
    log(`[TopicGraphBuilder] ====== 用户 ${userId} 主题图谱构建完成 ======`);
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