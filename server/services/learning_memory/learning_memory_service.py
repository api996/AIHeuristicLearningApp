"""
学习记忆分析服务
负责聚类分析与轨迹生成、记忆存储
"""

import asyncio
import json
import logging
import re
import numpy as np
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from sklearn.metrics import silhouette_score
from sklearn.cluster import KMeans

# 配置日志格式
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('learning_memory_service')

# 获取数据库连接
def get_db_connection():
    """获取数据库连接"""
    try:
        conn = psycopg2.connect(
            os.environ.get('DATABASE_URL'),
            cursor_factory=RealDictCursor
        )
        return conn
    except Exception as e:
        logger.error(f"数据库连接失败: {e}")
        raise

async def save_memory(user_id, content, memory_type='chat'):
    """
    保存一条新记忆
    
    参数:
        user_id: 用户ID
        content: 记忆内容
        memory_type: 记忆类型，默认为'chat'
    
    返回:
        dict: 包含新记忆ID的字典
    """
    try:
        # 验证参数
        user_id = int(user_id)
        if not content or len(content.strip()) == 0:
            logger.error("记忆内容不能为空")
            return {"error": "记忆内容不能为空"}
            
        logger.info(f"为用户{user_id}保存一条新记忆，类型：{memory_type}")
        
        # 生成时间戳格式的ID (yyyyMMddHHmmssffffff)
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")[:20]
        memory_id = timestamp
        
        # 获取摘要和关键词
        summary = await generate_content_summary(content)
        keywords = await extract_keywords(content)
        
        # 保存记忆到数据库
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 插入记忆记录
        try:
            cur.execute("""
                INSERT INTO memories (id, user_id, content, summary, memory_type, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                RETURNING id;
            """, (memory_id, user_id, content, summary, memory_type))
            
            # 插入关键词
            if keywords and len(keywords) > 0:
                for keyword in keywords:
                    if keyword and len(keyword.strip()) > 0:
                        cur.execute("""
                            INSERT INTO memory_keywords (memory_id, keyword)
                            VALUES (%s, %s);
                        """, (memory_id, keyword.strip()))
            
            conn.commit()
            logger.info(f"记忆保存成功，ID：{memory_id}")
            return {"id": memory_id, "summary": summary, "keywords": keywords}
        except Exception as e:
            conn.rollback()
            logger.error(f"保存记忆到数据库时出错: {e}")
            raise
        finally:
            cur.close()
            conn.close()
    except Exception as e:
        logger.error(f"保存记忆时出错: {e}")
        return {"error": f"保存记忆失败: {str(e)}"}

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
        
        # 预处理：移除系统标记和特殊格式
        content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL)  # 移除思考标记
        content = re.sub(r'<.*?>', '', content)  # 移除其他HTML标记
        content = re.sub(r'\s+', ' ', content).strip()  # 规范化空白字符
        
        # 如果内容太短，直接返回处理后的原文
        if len(content) < 50:
            return content
        
        # 尝试提取有意义的首个句子
        # 匹配中英文的句子结束标志
        sentence_pattern = r'([^.!?。！？\n]+[.!?。！？\n])'
        sentences = re.findall(sentence_pattern, content)
        
        if sentences:
            # 过滤掉太短或无意义的句子
            meaningful_sentences = [s for s in sentences if len(s) > 10 and not re.match(r'^[0-9\s,.]+$', s.strip())]
            
            if meaningful_sentences:
                first_sentence = meaningful_sentences[0].strip()
                # 如果首句足够短，则直接使用
                if len(first_sentence) <= 100:
                    return first_sentence
                
                # 否则裁剪并添加省略号
                return first_sentence[:100] + '...'
        
        # 如果无法提取有意义的句子，则尝试寻找内容中的关键信息段落
        paragraphs = content.split('\n')
        for para in paragraphs:
            # 跳过空段落和只有数字的段落
            if len(para.strip()) > 20 and not re.match(r'^[0-9\s,.]+$', para.strip()):
                # 返回有意义段落的开头
                meaningful_para = para.strip()
                return meaningful_para[:100] + ('...' if len(meaningful_para) > 100 else '')
        
        # 最后的后备策略：清理并返回前100个字符
        cleaned_content = re.sub(r'^\s*[0-9]+\s*', '', content)  # 移除开头的纯数字
        if len(cleaned_content.strip()) > 0:
            return cleaned_content.strip()[:100] + ('...' if len(cleaned_content) > 100 else '')
        else:
            return "未分类主题"  # 完全无法提取有意义内容时的兜底文本
    except Exception as e:
        logger.error(f"生成内容摘要时出错: {e}")
        # 错误情况的兜底策略
        try:
            # 尝试清理并返回前50个字符
            cleaned_content = re.sub(r'^\s*[0-9]+\s*', '', content)
            if len(cleaned_content.strip()) > 0:
                return cleaned_content.strip()[:50] + '...'
            else:
                return "未分类主题"
        except:
            return "未分类主题"

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
        
        # 预处理文本：清理标记和噪音
        content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL)  # 移除思考标记
        content = re.sub(r'<.*?>', '', content)  # 移除其他HTML标记
        content = re.sub(r'\s+', ' ', content).strip()  # 规范化空白字符
        
        # 如果内容太短或只有数字，使用默认关键词
        if len(content) < 10 or re.match(r'^[0-9\s,.]+$', content.strip()):
            return ["未分类", "主题"]
        
        # 扩展停用词列表 - 常见但不带有特定含义的词汇
        stop_words = {
            # 中文常见停用词
            '的', '是', '在', '了', '和', '有', '与', '又', '也', '这', '那', '都', '要', '就', 
            '我', '你', '他', '她', '它', '们', '对', '以', '及', '很', '但', '如果', '因为',
            # 英文常见停用词
            'the', 'is', 'a', 'an', 'of', 'to', 'in', 'for', 'with', 'on', 'at', 'from', 'by',
            'about', 'as', 'into', 'like', 'through', 'after', 'over', 'between', 'out', 'up',
            'down', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your',
            'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
            'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
            'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'are', 'was',
            'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did',
            'doing', 'can', 'will', 'would', 'should', 'could', 'ought', 'not', 'and', 'but',
            'if', 'or', 'because', 'as', 'until', 'while', 'of', 'when', 'where', 'why', 'how',
            'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such'
        }
        
        # 提取潜在的关键词短语 - 捕获可能的专业术语或多词组合
        phrases = []
        
        # 中文2-4词组合
        cn_phrases = re.findall(r'[\u4e00-\u9fa5]{2,8}', content)
        phrases.extend(cn_phrases)
        
        # 英文词组 (2-3个词)
        en_content = content
        # 先提取可能的英文短语
        en_phrase_pattern = r'\b[A-Za-z][A-Za-z\s]{2,20}[A-Za-z]\b'
        en_phrases = re.findall(en_phrase_pattern, en_content)
        meaningful_phrases = []
        for phrase in en_phrases:
            if 3 <= len(phrase) <= 25 and ' ' in phrase:  # 确保是多词短语
                words = phrase.split()
                if len(words) <= 3 and all(len(w) > 1 for w in words):  # 最多3个词，每个词至少2个字符
                    meaningful_phrases.append(phrase)
        phrases.extend(meaningful_phrases)
        
        # 提取单个词
        # 中文单词
        chinese_words = re.findall(r'[\u4e00-\u9fa5]{2,6}', content)
        # 英文单词 (更关注专业术语，通常更长)
        english_words = re.findall(r'\b[A-Za-z][a-z]{2,14}\b', content)
        
        # 过滤停用词和无意义词
        filtered_words = []
        # 首先添加短语，它们通常更有意义
        for phrase in phrases:
            phrase = phrase.strip()
            if len(phrase) >= 4 and not any(phrase.lower() == w.lower() for w in filtered_words):
                filtered_words.append(phrase)
                
        # 再添加单词
        for word in chinese_words + english_words:
            word = word.strip()
            word_lower = word.lower()
            if (word_lower not in stop_words and 
                len(word) >= 2 and 
                not word.isdigit() and
                not any(word_lower == w.lower() for w in filtered_words)):
                filtered_words.append(word)
        
        # 评分系统：结合频率、词长和位置（文档开头的词通常更重要）
        word_scores = {}
        sentences = content.split('.')
        position_weight = 1.5  # 位置权重因子
        
        for idx, sentence in enumerate(sentences):
            # 随着句子位置后移，降低权重
            sentence_position_factor = position_weight * (1 - idx / len(sentences) * 0.5) 
            for word in filtered_words:
                if word.lower() in sentence.lower():
                    # 计算词得分: 基础分 + 长度加权 + 位置加权
                    base_score = 1.0
                    length_factor = min(len(word) / 3, 2.0)  # 较长的词分数更高，但有上限
                    
                    # 短语得分更高
                    phrase_bonus = 1.5 if ' ' in word else 1.0
                    
                    total_score = base_score * length_factor * sentence_position_factor * phrase_bonus
                    word_scores[word] = word_scores.get(word, 0) + total_score
        
        # 排序并选择最佳关键词
        sorted_words = sorted(word_scores.items(), key=lambda x: x[1], reverse=True)
        top_keywords = [word for word, score in sorted_words[:8]]  # 最多8个关键词
        
        # 如果没有找到足够的关键词，添加一些备选关键词
        if len(top_keywords) < 3:
            # 提取一些重要的名词
            important_nouns = re.findall(r'\b[A-Z][a-z]{2,15}\b', content)  # 专有名词
            important_nouns = [noun for noun in important_nouns if noun.lower() not in stop_words]
            top_keywords.extend(important_nouns[:5])
            
        # 去重并限制数量
        unique_keywords = []
        for kw in top_keywords:
            if kw not in unique_keywords and len(unique_keywords) < 8:
                unique_keywords.append(kw)
        
        return unique_keywords if unique_keywords else ["未分类主题"]
    except Exception as e:
        logger.error(f"提取关键词时出错: {e}")
        return ["未分类主题"]

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
        # 提取向量数据
        vectors = np.array([m['embedding'] for m in memories_with_embeddings])
        
        # 使用肘部法则确定最佳聚类数
        n_clusters = determine_optimal_clusters(vectors)
        logger.info(f"根据肘部法则确定的最佳聚类数: {n_clusters}")
        
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
            
            # 生成摘要和有意义的主题
            if combined_content:
                summary = await generate_content_summary(combined_content)
                cluster_data["summary"] = summary
                
                # 生成更有描述性的主题：使用关键词与摘要结合的方式
                if cluster_data["keywords"]:
                    # 关键词优先 - 使用前两个主要关键词
                    primary_keywords = cluster_data["keywords"][:2]
                    if len(primary_keywords) >= 2:
                        cluster_data["topic"] = f"{primary_keywords[0]} 与 {primary_keywords[1]}"
                    else:
                        cluster_data["topic"] = primary_keywords[0]
                else:
                    # 如果没有关键词，使用摘要
                    cluster_data["topic"] = summary[:50]
            
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


def determine_optimal_clusters(vectors: np.ndarray) -> int:
    """
    使用肘部法则确定最佳聚类数量
    
    参数:
        vectors: 向量数据数组
        
    返回:
        int: 最佳聚类数量
    """
    try:
        # 如果样本太少，直接返回小值
        n_samples = len(vectors)
        if n_samples <= 5:
            return max(2, n_samples - 1)  # 至少2个，最多n-1个
            
        # 设置可能的聚类数范围
        max_clusters = min(15, n_samples // 2)  # 不超过样本数的一半且不超过15
        min_clusters = 2  # 至少2个聚类
        
        if max_clusters <= min_clusters:
            return min_clusters
            
        # 计算不同k值的畸变度(inertia)
        distortions = []
        K = range(min_clusters, max_clusters + 1)
        
        # 对于每个可能的k值
        for k in K:
            try:
                kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
                kmeans.fit(vectors)
                distortions.append(kmeans.inertia_)
                
                # 可选：计算轮廓系数
                if k > 1 and n_samples > k:
                    try:
                        silhouette_avg = silhouette_score(vectors, kmeans.labels_)
                        logger.info(f"聚类数 k={k}, 轮廓系数: {silhouette_avg:.3f}")
                    except Exception as e:
                        logger.warning(f"计算轮廓系数时出错 (k={k}): {e}")
            except Exception as e:
                logger.warning(f"k={k} 时K-means聚类失败: {e}")
                continue
                
        # 没有得到有效结果时的后备选项
        if not distortions:
            logger.warning("无法计算畸变度，使用默认聚类数")
            return min(5, max(2, n_samples // 10))  # 默认策略
            
        # 使用肘部法则：计算曲线的二阶导数变化
        if len(distortions) <= 2:
            # 数据点不足以计算二阶导数
            return min_clusters
            
        # 一阶差分
        deltas = np.diff(distortions)
        # 二阶差分（导数的导数）
        delta_deltas = np.diff(deltas)
        
        # 找到二阶差分的最大点，即拐点
        elbow_index = np.argmax(delta_deltas) + 1  # 加回索引偏移
        optimal_k = min_clusters + elbow_index
        
        # 确保结果在有效范围内
        optimal_k = max(min_clusters, min(optimal_k, max_clusters))
        
        logger.info(f"肘部法则确定的最佳聚类数量: k={optimal_k}，畸变度值: {distortions}")
        return optimal_k
    except Exception as e:
        logger.error(f"确定最佳聚类数量时出错: {e}")
        # 错误情况下的默认值
        return min(5, max(2, len(vectors) // 10))

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
        n_buckets = min(10, max(2, len(sorted_memories) // 10))  # 允许最多10个时间聚类
        
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
            
            # 创建聚类并生成更有描述性的主题
            topic = f"时间段 {i+1}"
            
            # 如果有关键词，尝试使用关键词构建主题
            if keywords:
                # 关键词优先 - 使用前两个主要关键词
                primary_keywords = keywords[:2]
                if len(primary_keywords) >= 2:
                    topic = f"{primary_keywords[0]} 与 {primary_keywords[1]}"
                else:
                    topic = primary_keywords[0]
            # 如果有摘要但没有关键词，使用摘要
            elif summary:
                topic = summary[:50]
                
            clusters[cluster_id] = {
                "topic": topic,
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