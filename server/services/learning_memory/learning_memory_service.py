"""
学习记忆分析服务
负责聚类分析与轨迹生成
"""

import asyncio
import json
import logging
import re
import numpy as np
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid

# 配置日志格式
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('learning_memory_service')

async def analyze_learning_path(user_id):
    """
    分析用户的学习轨迹
    
    参数:
        user_id: 用户ID
    
    返回:
        dict: 包含学习轨迹分析结果的字典
    """
    try:
        logger.info(f"开始分析用户 {user_id} 的学习轨迹")
        
        # 简单的后备实现，实际上轨迹分析会回退到JS实现
        # 这个文件仅用于确保import不会失败
        return {
            "topics": [],
            "progress": [],
            "suggestions": [
                "继续添加更多学习内容以生成个性化学习轨迹",
                "需要至少5条记忆数据才能进行有效的主题聚类分析"
            ],
            "knowledge_graph": {
                "nodes": [],
                "links": []
            }
        }
    except Exception as e:
        logger.error(f"分析学习轨迹时出错: {e}")
        raise

async def generate_content_summary(content):
    """
    为内容生成摘要
    
    参数:
        content: 需要总结的文本内容
    
    返回:
        str: 生成的摘要文本
    """
    try:
        logger.info(f"生成内容摘要，文本长度: {len(content)}")
        
        # 如果内容太短，直接返回原文
        if len(content) < 50:
            return content
        
        # 简单的摘要生成方法：取第一句话，如果它足够短的话
        # 否则截取前50个字符
        first_sentence_match = re.search(r'^([^.!?。！？]+[.!?。！？])', content)
        if first_sentence_match:
            first_sentence = first_sentence_match.group(1)
            if len(first_sentence) <= 100:
                return first_sentence
        
        # 如果没有找到第一句话或者第一句话太长，截取开头
        return content[:50] + ('...' if len(content) > 50 else '')
    except Exception as e:
        logger.error(f"生成内容摘要时出错: {e}")
        return content[:50] + ('...' if len(content) > 50 else '')

async def extract_keywords(content):
    """
    从内容中提取关键词
    
    参数:
        content: 需要提取关键词的文本内容
    
    返回:
        list: 关键词列表
    """
    try:
        logger.info(f"提取关键词，文本长度: {len(content)}")
        
        # 这里只是一个简单示例实现，实际应用中应该使用NLP库
        common_words = {'的', '是', '在', '了', '和', '有', '与', '又', '也', 
                        'the', 'is', 'a', 'an', 'of', 'to', 'in', 'for', 'with'}
        
        # 分词 - 中文按字符，英文按空格
        chinese_words = re.findall(r'[\u4e00-\u9fa5]{2,6}', content)
        english_words = re.findall(r'[a-zA-Z]{3,15}', content)
        
        # 过滤常用词和短单词
        filtered_words = [word for word in chinese_words + english_words 
                         if word.lower() not in common_words and len(word) >= 2]
        
        # 计算频率
        word_freq = {}
        for word in filtered_words:
            word_freq[word] = word_freq.get(word, 0) + 1
        
        # 取频率最高的8个关键词
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        keywords = [word for word, freq in sorted_words[:8]]
        
        return keywords if keywords else ["未知主题"]
    except Exception as e:
        logger.error(f"提取关键词时出错: {e}")
        return ["未知主题"]

# 为了兼容性添加此别名函数
async def extract_keywords_from_text(content):
    """
    从文本中提取关键词（extract_keywords的别名函数）
    
    参数:
        content: 需要提取关键词的文本内容
    
    返回:
        list: 关键词列表
    """
    return await extract_keywords(content)


async def cluster_memories(memories_data: List[Dict[str, Any]], user_id: int) -> Dict[str, Any]:
    """
    对记忆数据进行聚类分析，发现主题组
    
    参数:
        memories_data: 记忆数据列表，每个记忆包含id、content、embedding等
        user_id: 用户ID
    
    返回:
        dict: 聚类结果，键为聚类ID，值为聚类信息(包含主题、记忆ID等)
    """
    try:
        logger.info(f"开始对用户 {user_id} 的 {len(memories_data)} 条记忆进行聚类分析")
        
        # 检查记忆数量
        if len(memories_data) < 2:
            logger.info("记忆数量不足，无法进行聚类")
            
            # 只有一个记忆时，创建单个聚类
            if len(memories_data) == 1:
                memory = memories_data[0]
                memory_id = memory.get('id')
                content = memory.get('content', '')
                
                # 生成摘要和关键词
                summary = memory.get('summary')
                if not summary:
                    summary = await generate_content_summary(content)
                
                keywords = memory.get('keywords')
                if not keywords:
                    keywords = await extract_keywords(content)
                
                cluster_id = f"cluster_single_{int(datetime.now().timestamp() * 1000)}"
                return {
                    cluster_id: {
                        "topic": summary[:50],
                        "memory_ids": [memory_id],
                        "keywords": keywords,
                        "summary": summary,
                        "centroid": memory.get('embedding', [])
                    }
                }
            
            return {}
        
        # 收集有效的记忆数据（必须有内容或摘要）
        valid_memories = []
        for memory in memories_data:
            if 'content' in memory or 'summary' in memory:
                valid_memories.append(memory)
        
        if len(valid_memories) < 2:
            logger.info("有效记忆数量不足，无法进行聚类")
            return {}
        
        # 检查是否有足够的记忆带有向量嵌入
        memories_with_embeddings = [m for m in valid_memories if 'embedding' in m and m['embedding']]
        
        if len(memories_with_embeddings) < 2:
            logger.info("带有向量嵌入的记忆数量不足，进行时间线聚类")
            return await time_based_clustering(valid_memories)
        
        # 使用K-means算法进行聚类
        return await vector_based_clustering(memories_with_embeddings)
    
    except Exception as e:
        logger.error(f"聚类记忆数据时出错: {e}")
        # 发生错误时回退到基于时间的聚类
        try:
            return await time_based_clustering(memories_data)
        except Exception as e2:
            logger.error(f"回退到时间聚类也失败: {e2}")
            return {}


async def vector_based_clustering(memories_with_embeddings: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    基于向量嵌入的聚类
    
    参数:
        memories_with_embeddings: 带有嵌入向量的记忆列表
    
    返回:
        dict: 聚类结果
    """
    try:
        from sklearn.cluster import KMeans
        
        # 提取向量数据
        vectors = np.array([m['embedding'] for m in memories_with_embeddings])
        
        # 确定聚类数量
        n_clusters = min(5, len(vectors) - 1)  # 最多5个聚类，至少2个样本
        
        # 执行K-means聚类
        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        cluster_labels = kmeans.fit_predict(vectors)
        
        # 整理聚类结果
        clusters = {}
        for i, label in enumerate(cluster_labels):
            memory = memories_with_embeddings[i]
            cluster_id = f"cluster_{label}_{int(datetime.now().timestamp() * 1000)}"
            
            if cluster_id not in clusters:
                # 创建新聚类
                clusters[cluster_id] = {
                    "memory_ids": [],
                    "keywords": [],
                    "topic": "",
                    "summary": "",
                    "centroid": kmeans.cluster_centers_[label].tolist()
                }
            
            # 添加记忆到聚类
            clusters[cluster_id]["memory_ids"].append(memory['id'])
            
            # 收集关键词
            if 'keywords' in memory and memory['keywords']:
                clusters[cluster_id]["keywords"].extend(memory['keywords'])
        
        # 为每个聚类生成主题和摘要
        for cluster_id, cluster_data in clusters.items():
            # 去重关键词
            cluster_data["keywords"] = list(set(cluster_data["keywords"]))[:8]
            
            # 收集该聚类中所有记忆的摘要或内容
            cluster_memory_ids = cluster_data["memory_ids"]
            cluster_memories = [m for m in memories_with_embeddings if m['id'] in cluster_memory_ids]
            
            contents = []
            for m in cluster_memories:
                if 'summary' in m and m['summary']:
                    contents.append(m['summary'])
                elif 'content' in m and m['content']:
                    contents.append(m['content'][:200])  # 限制长度
            
            combined_content = " ".join(contents)
            
            # 生成摘要
            if combined_content:
                summary = await generate_content_summary(combined_content)
                cluster_data["summary"] = summary
                cluster_data["topic"] = summary[:50]  # 主题使用摘要的前50个字符
            
            # 如果没有关键词，生成关键词
            if not cluster_data["keywords"] and combined_content:
                keywords = await extract_keywords(combined_content)
                cluster_data["keywords"] = keywords
        
        return clusters
    
    except ImportError:
        logger.warning("sklearn未安装，回退到时间线聚类")
        return await time_based_clustering(memories_with_embeddings)
    except Exception as e:
        logger.error(f"向量聚类失败: {e}")
        return await time_based_clustering(memories_with_embeddings)


async def time_based_clustering(memories: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    基于时间线的聚类（后备方法）
    
    参数:
        memories: 记忆列表
    
    返回:
        dict: 聚类结果
    """
    try:
        logger.info(f"执行基于时间的聚类，记忆数量: {len(memories)}")
        
        # 根据时间戳排序记忆
        sorted_memories = sorted(
            memories, 
            key=lambda m: m.get('timestamp', '2020-01-01T00:00:00Z')
        )
        
        # 确定时间桶的数量
        n_buckets = min(5, len(sorted_memories))
        
        # 将记忆划分为几个时间段
        bucket_size = max(1, len(sorted_memories) // n_buckets)
        time_buckets = []
        
        for i in range(0, len(sorted_memories), bucket_size):
            time_buckets.append(sorted_memories[i:i + bucket_size])
        
        # 为每个时间桶创建一个聚类
        clusters = {}
        for i, bucket in enumerate(time_buckets):
            if not bucket:
                continue
                
            cluster_id = f"cluster_time_{i}_{int(datetime.now().timestamp() * 1000)}"
            
            # 收集该时间段内所有记忆的内容
            contents = []
            memory_ids = []
            all_keywords = []
            
            for memory in bucket:
                memory_ids.append(memory['id'])
                
                if 'summary' in memory and memory['summary']:
                    contents.append(memory['summary'])
                elif 'content' in memory and memory['content']:
                    contents.append(memory['content'][:200])  # 限制长度
                
                if 'keywords' in memory and memory['keywords']:
                    all_keywords.extend(memory['keywords'])
            
            combined_content = " ".join(contents)
            
            # 生成聚类摘要
            summary = ""
            if combined_content:
                summary = await generate_content_summary(combined_content)
            
            # 去重关键词
            keywords = list(set(all_keywords))[:8]
            
            # 如果没有足够的关键词，从内容中提取
            if len(keywords) < 3 and combined_content:
                extracted_keywords = await extract_keywords(combined_content)
                keywords.extend(extracted_keywords)
                keywords = list(set(keywords))[:8]  # 去重并限制数量
            
            # 计算中心向量（如果有）
            centroid = []
            valid_embeddings = [m.get('embedding') for m in bucket if 'embedding' in m and m['embedding']]
            
            if valid_embeddings:
                # 确保所有向量维度相同
                dim_check = len(valid_embeddings[0])
                valid_embeddings = [v for v in valid_embeddings if len(v) == dim_check]
                
                if valid_embeddings:
                    centroid = np.mean(valid_embeddings, axis=0).tolist()
            
            # 创建聚类
            clusters[cluster_id] = {
                "topic": summary[:50] if summary else f"时间段 {i+1}",
                "memory_ids": memory_ids,
                "keywords": keywords,
                "summary": summary,
                "centroid": centroid
            }
        
        return clusters
    
    except Exception as e:
        logger.error(f"基于时间的聚类失败: {e}")
        
        # 最后的后备方法：简单地创建一个包含所有记忆的聚类
        try:
            fallback_id = f"cluster_all_{int(datetime.now().timestamp() * 1000)}"
            return {
                fallback_id: {
                    "topic": "所有记忆",
                    "memory_ids": [m['id'] for m in memories],
                    "keywords": ["综合", "全部", "记忆"],
                    "summary": "包含所有记忆的综合集合",
                    "centroid": []
                }
            }
        except:
            return {}