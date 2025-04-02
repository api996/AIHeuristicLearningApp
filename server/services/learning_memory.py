
import os
import json
from typing import List, Dict, Any, Optional
import numpy as np
from datetime import datetime
from .embedding import EmbeddingService

# 初始化嵌入服务
embedding_service = EmbeddingService()

class LearningMemoryService:
    """提供学习轨迹记忆空间服务"""
    
    def __init__(self):
        # 使用绝对路径确保在任何工作目录下都能找到memory_space
        self.memory_dir = os.path.join(os.getcwd(), "memory_space")
        self.ensure_memory_dir()
        self.embedding_service = embedding_service
        print(f"初始化学习记忆服务，记忆目录: {self.memory_dir}")
        
    def ensure_memory_dir(self) -> None:
        """确保记忆空间目录存在"""
        if not os.path.exists(self.memory_dir):
            print(f"创建记忆目录: {self.memory_dir}")
            os.makedirs(self.memory_dir)
        else:
            print(f"记忆目录已存在: {self.memory_dir}")
            
    async def save_memory(self, user_id: int, content: str, type: str = "chat") -> None:
        """
        保存用户记忆到记忆空间
        
        Args:
            user_id: 用户ID
            content: 记忆内容
            type: 记忆类型 (chat, query, etc)
        """
        try:
            print(f"开始保存记忆: 用户ID={user_id}, 类型={type}, 内容长度={len(content)}")
            
            # 确保主记忆目录存在
            self.ensure_memory_dir()
            
            # 为用户创建目录
            user_dir = os.path.join(self.memory_dir, str(user_id))
            if not os.path.exists(user_dir):
                print(f"创建用户记忆目录: {user_dir}")
                os.makedirs(user_dir)
            else:
                print(f"用户记忆目录已存在: {user_dir}")
                
            # 获取内容的嵌入向量
            print("开始生成嵌入向量...")
            embeddings = await self.embedding_service.get_embeddings([content])
            if not embeddings or not embeddings[0]:
                print(f"无法为内容生成嵌入向量: {content[:50]}...")
                # 使用空向量继续保存，这样至少保存了文本内容
                embeddings = [[]]
                
            # 创建记忆项
            memory_item = {
                "content": content,
                "type": type,
                "embedding": embeddings[0],
                "timestamp": datetime.now().isoformat()
            }
            
            # 生成唯一文件名
            filename = f"{datetime.now().strftime('%Y%m%d%H%M%S%f')}.json"
            file_path = os.path.join(user_dir, filename)
            
            print(f"准备保存记忆到文件: {file_path}")
            
            # 保存到文件
            with open(file_path, 'w', encoding='utf-8') as f:
                json_str = json.dumps(memory_item, ensure_ascii=False)
                f.write(json_str)
                
            print(f"成功保存用户{user_id}的记忆到文件: {filename}")
            print(f"记忆内容摘要: {content[:50]}...")
            
            # 验证文件是否真的被保存
            if os.path.exists(file_path):
                file_size = os.path.getsize(file_path)
                print(f"确认文件已保存，大小为 {file_size} 字节")
            else:
                print(f"警告：文件似乎未被保存")
                
        except Exception as e:
            print(f"保存记忆时出错: {str(e)}")
            import traceback
            print(traceback.format_exc())
            
    async def retrieve_similar_memories(self, user_id: int, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        检索与查询相似的记忆
        
        Args:
            user_id: 用户ID
            query: 查询内容
            limit: 返回结果数量上限
            
        Returns:
            相似记忆列表
        """
        try:
            user_dir = os.path.join(self.memory_dir, str(user_id))
            if not os.path.exists(user_dir):
                return []
                
            # 获取查询的嵌入向量
            query_embeddings = await self.embedding_service.get_embeddings([query])
            if not query_embeddings or not query_embeddings[0]:
                return []
                
            query_vector = np.array(query_embeddings[0])
            
            # 收集所有记忆
            memories = []
            for filename in os.listdir(user_dir):
                if filename.endswith('.json'):
                    file_path = os.path.join(user_dir, filename)
                    with open(file_path, 'r', encoding='utf-8') as f:
                        memory = json.load(f)
                        memories.append(memory)
            
            # 计算相似度并排序
            scored_memories = []
            for memory in memories:
                # 确保有embedding字段，并且不为空
                if "embedding" not in memory or not memory["embedding"]:
                    print(f"跳过没有嵌入向量的记忆: {memory.get('content', '')[:30]}...")
                    continue
                    
                try:
                    memory_vector = np.array(memory["embedding"])
                    # 确保维度匹配，这是应对之前生成的替代向量和API生成的真实向量可能维度不同的问题
                    if len(memory_vector) != len(query_vector):
                        print(f"嵌入向量维度不匹配: 查询={len(query_vector)}, 记忆={len(memory_vector)}")
                        # 使用字符串匹配作为替代方案
                        if "content" in memory and memory["content"]:
                            query_words = set(query.lower().split())
                            memory_words = set(memory["content"].lower().split())
                            
                            if not query_words or not memory_words:
                                similarity = 0.0
                            else:
                                intersection = query_words.intersection(memory_words)
                                union = query_words.union(memory_words)
                                similarity = len(intersection) / max(1, len(union))
                        else:
                            similarity = 0.0
                    else:
                        # 正常使用余弦相似度
                        similarity = self.cosine_similarity(query_vector, memory_vector)
                        
                    scored_memories.append((memory, similarity))
                except Exception as e:
                    print(f"计算单个记忆相似度时出错: {str(e)}")
                    # 跳过有问题的记忆项
                
            # 按相似度降序排序
            scored_memories.sort(key=lambda x: x[1], reverse=True)
            
            # 返回前limit个结果
            return [memory for memory, _ in scored_memories[:limit]]
        except Exception as e:
            print(f"检索记忆时出错: {str(e)}")
            return []
            
    def cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """计算两个向量的余弦相似度"""
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
            
        return dot_product / (norm1 * norm2)
        
    async def analyze_learning_path(self, user_id: int) -> Dict[str, Any]:
        """
        分析用户的学习轨迹，采用动态话题发现和语义分析
        
        Args:
            user_id: 用户ID
            
        Returns:
            学习轨迹分析结果 - 动态生成的知识记忆空间
        """
        try:
            user_dir = os.path.join(self.memory_dir, str(user_id))
            if not os.path.exists(user_dir):
                return self.default_analysis()
                
            # 收集所有记忆
            memories = []
            memory_files = sorted(os.listdir(user_dir))  # 按文件名排序（通常包含时间戳）
            for filename in memory_files:
                if filename.endswith('.json'):
                    file_path = os.path.join(user_dir, filename)
                    with open(file_path, 'r', encoding='utf-8') as f:
                        memory = json.load(f)
                        # 添加文件名作为ID，方便后续引用
                        memory["id"] = filename.replace(".json", "")
                        memories.append(memory)
            
            if not memories:
                return self.default_analysis()
            
            # 知识图谱构建 - 记忆节点和语义关联
            knowledge_nodes = []
            semantic_links = []
            
            # STEP 1: 构建初始记忆节点（按时间顺序）
            for i, memory in enumerate(memories):
                content = memory.get("content", "").lower()
                timestamp = memory.get("timestamp", "")
                memory_id = memory.get("id", f"mem_{i}")
                
                # 提取该记忆中的关键主题词和重要概念
                keywords = self.extract_keywords_from_text(content)
                
                # 创建记忆节点
                node = {
                    "id": memory_id,
                    "content": content[:100] + "..." if len(content) > 100 else content,  # 截断显示
                    "timestamp": timestamp,
                    "keywords": keywords,
                    "type": "memory_node"
                }
                knowledge_nodes.append(node)
            
            # STEP 2: 对记忆节点进行聚类，发现主题群组
            topic_clusters = await self.cluster_memories(memories)
            
            # STEP 3: 为每个主题群组创建主题节点
            for topic_name, topic_data in topic_clusters.items():
                topic_node = {
                    "id": f"topic_{topic_name.replace(' ', '_')}",
                    "name": topic_name,
                    "relevance": topic_data["relevance"],
                    "type": "topic_node",
                    "related_memories": topic_data["memory_ids"],
                    "keywords": topic_data["keywords"]
                }
                knowledge_nodes.append(topic_node)
                
                # 建立主题与相关记忆之间的连接
                for memory_id in topic_data["memory_ids"]:
                    link = {
                        "source": topic_node["id"],
                        "target": memory_id,
                        "strength": self.calculate_relevance(topic_name, memory_id, memories)
                    }
                    semantic_links.append(link)
            
            # STEP 4: 构建主题之间的关联（如果它们共享相同的记忆或关键词）
            topic_nodes = [node for node in knowledge_nodes if node["type"] == "topic_node"]
            for i in range(len(topic_nodes)):
                for j in range(i+1, len(topic_nodes)):
                    topic1 = topic_nodes[i]
                    topic2 = topic_nodes[j]
                    
                    # 计算两个主题的关联度
                    relation_strength = self.calculate_topic_relation(topic1, topic2)
                    if relation_strength > 0.2:  # 仅保留强关联
                        link = {
                            "source": topic1["id"],
                            "target": topic2["id"],
                            "strength": relation_strength,
                            "type": "topic_relation"
                        }
                        semantic_links.append(link)
            
            # STEP 5: 提取学习进度数据（与之前逻辑类似，但基于新的主题聚类）
            progress = []
            topic_names = [node["name"] for node in knowledge_nodes if node.get("type") == "topic_node"]
            
            for topic_node in topic_nodes:
                topic_name = topic_node["name"]
                related_count = len(topic_node.get("related_memories", []))
                relevance = topic_node.get("relevance", 0)
                
                if related_count > 0:
                    progress.append({
                        "topic": topic_name,
                        "percentage": min(100, int(relevance * 100)),  # 转换为百分比
                        "memory_count": related_count
                    })
            
            # 按相关度排序
            progress.sort(key=lambda x: x["percentage"], reverse=True)
            
            # 生成更加上下文相关的学习建议
            suggestions = self.generate_dynamic_suggestions(progress, knowledge_nodes, semantic_links)
            
            # 返回完整的知识空间数据
            return {
                "topics": topic_names,
                "progress": progress[:10],  # 限制显示数量，避免界面过载
                "suggestions": suggestions,
                "knowledge_graph": {
                    "nodes": knowledge_nodes,
                    "links": semantic_links
                }
            }
            
        except Exception as e:
            print(f"分析学习轨迹时出错: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return self.default_analysis()
            
    def extract_keywords_from_text(self, text: str) -> List[str]:
        """从文本中提取关键词"""
        try:
            # 分词并过滤停用词
            words = text.lower().split()
            # 简单的停用词表（可以扩展）
            stopwords = {"的", "了", "和", "是", "在", "我", "有", "这", "个", "你", "们", "他", "她", "它", "一个", "就是"}
            filtered_words = [w for w in words if w not in stopwords and len(w) > 1]
            
            # 计数并找出高频词
            word_counts = {}
            for word in filtered_words:
                if word not in word_counts:
                    word_counts[word] = 1
                else:
                    word_counts[word] += 1
            
            # 按频率排序并返回前N个关键词
            sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
            keywords = [word for word, count in sorted_words[:10] if count > 1]  # 选择前10个高频词
            return keywords
        except Exception as e:
            print(f"提取关键词时出错: {str(e)}")
            return []
    
    async def cluster_memories(self, memories: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """使用语义相似性对记忆进行聚类，发现主题"""
        try:
            if not memories:
                return {}
                
            # 为所有记忆内容生成嵌入向量（如果尚未有嵌入）
            memory_texts = [mem.get("content", "") for mem in memories]
            embedding_present = all("embedding" in mem and mem["embedding"] for mem in memories)
            
            if not embedding_present:
                try:
                    # 获取新的嵌入向量
                    embeddings = await self.embedding_service.get_embeddings(memory_texts)
                    for i, embedding in enumerate(embeddings):
                        if i < len(memories):
                            memories[i]["embedding"] = embedding
                except Exception as e:
                    print(f"获取嵌入向量时出错: {str(e)}")
                    # 继续执行，使用基于关键词的聚类
            
            # 方法一：基于语义相似性的聚类（如果有嵌入向量）
            clusters = {}
            
            # 收集所有可能的主题词
            all_keywords = set()
            for memory in memories:
                content = memory.get("content", "").lower()
                keywords = self.extract_keywords_from_text(content)
                all_keywords.update(keywords)
            
            # 尝试将每个高频词作为一个潜在主题
            for keyword in list(all_keywords)[:20]:  # 限制主题数量
                # 计算该关键词与每个记忆的相关性
                related_memories = []
                keyword_relevance = []
                total_relevance = 0
                
                for memory in memories:
                    memory_id = memory.get("id", "")
                    content = memory.get("content", "").lower()
                    
                    # 计算相关性（简单版本 - 如果有嵌入可以用语义相似度）
                    relevance = 0
                    if keyword in content:
                        # 简单的相关性计算：关键词出现的次数/总词数
                        relevance = content.count(keyword) / max(1, len(content.split()))
                        keyword_relevance.append((memory_id, relevance))
                        total_relevance += relevance
                        
                        if relevance > 0.01:  # 相关性阈值
                            related_memories.append(memory_id)
                
                # 只保存有足够相关记忆的主题
                if len(related_memories) >= 1:
                    clusters[keyword] = {
                        "memory_ids": related_memories,
                        "relevance": total_relevance,
                        "keywords": [keyword]
                    }
            
            # 合并高度重叠的主题（避免冗余）
            merged_clusters = {}
            cluster_items = list(clusters.items())
            for i, (topic1, data1) in enumerate(cluster_items):
                if topic1 not in merged_clusters:
                    merged_set = set(data1["memory_ids"])
                    merged_keywords = set(data1["keywords"])
                    merged_relevance = data1["relevance"]
                    should_merge = False
                    
                    for j, (topic2, data2) in enumerate(cluster_items[i+1:], i+1):
                        if topic2 not in merged_clusters:
                            # 计算两个集合的Jaccard相似度
                            set2 = set(data2["memory_ids"])
                            if not merged_set or not set2:
                                continue
                                
                            jaccard = len(merged_set.intersection(set2)) / len(merged_set.union(set2))
                            
                            if jaccard > 0.5:  # 合并阈值
                                should_merge = True
                                merged_set.update(set2)
                                merged_keywords.update(data2["keywords"])
                                merged_relevance += data2["relevance"]
                                merged_clusters[topic2] = True  # 标记为已合并
                    
                    if should_merge or topic1 not in merged_clusters:
                        merged_name = "/".join(sorted(list(merged_keywords))[:3])  # 前3个关键词作为主题名
                        merged_clusters[topic1] = True
                        clusters[merged_name] = {
                            "memory_ids": list(merged_set),
                            "relevance": merged_relevance,
                            "keywords": list(merged_keywords)
                        }
            
            # 移除已合并的原始主题
            for topic in list(merged_clusters.keys()):
                if topic in clusters:
                    del clusters[topic]
            
            return clusters
            
        except Exception as e:
            print(f"聚类记忆时出错: {str(e)}")
            return {}
    
    def calculate_relevance(self, topic: str, memory_id: str, memories: List[Dict[str, Any]]) -> float:
        """计算主题和特定记忆之间的相关性强度"""
        try:
            # 简单实现 - 在真实场景中可以使用更复杂的算法
            memory = next((mem for mem in memories if mem.get("id") == memory_id), None)
            if not memory:
                return 0.0
                
            content = memory.get("content", "").lower()
            if topic.lower() in content:
                return 0.8  # 高相关
            return 0.5  # 中等相关（因为它已经在聚类中被识别为相关）
        except Exception as e:
            print(f"计算相关性时出错: {str(e)}")
            return 0.3  # 默认中低相关
    
    def calculate_topic_relation(self, topic1: Dict[str, Any], topic2: Dict[str, Any]) -> float:
        """计算两个主题之间的关联强度"""
        try:
            # 基于共享记忆计算关联
            memories1 = set(topic1.get("related_memories", []))
            memories2 = set(topic2.get("related_memories", []))
            
            if not memories1 or not memories2:
                return 0.0
                
            # 计算Jaccard相似度
            intersection = len(memories1.intersection(memories2))
            union = len(memories1.union(memories2))
            
            memory_similarity = intersection / max(1, union)
            
            # 基于关键词计算关联
            keywords1 = set(topic1.get("keywords", []))
            keywords2 = set(topic2.get("keywords", []))
            
            if keywords1 and keywords2:
                keyword_intersection = len(keywords1.intersection(keywords2))
                keyword_union = len(keywords1.union(keywords2))
                keyword_similarity = keyword_intersection / max(1, keyword_union)
            else:
                keyword_similarity = 0.0
                
            # 综合得分
            return 0.7 * memory_similarity + 0.3 * keyword_similarity
            
        except Exception as e:
            print(f"计算主题关联时出错: {str(e)}")
            return 0.0
            
    def generate_dynamic_suggestions(self, progress: List[Dict[str, Any]], 
                             nodes: List[Dict[str, Any]], 
                             links: List[Dict[str, Any]]) -> List[str]:
        """生成动态学习建议，基于知识图谱分析"""
        suggestions = []
        
        try:
            # 如果有进度数据
            if progress:
                # 找出进度最高的主题
                top_topics = [p for p in progress if p.get("percentage", 0) > 30]
                if top_topics:
                    top_topic = top_topics[0]["topic"]
                    suggestions.append(f"您对「{top_topic}」已有较深入的了解，可以继续探索相关高级概念")
                
                # 找出刚开始接触的主题
                emerging_topics = [p for p in progress if 5 <= p.get("percentage", 0) <= 20]
                if emerging_topics:
                    topic = emerging_topics[0]["topic"]
                    suggestions.append(f"「{topic}」是您最近开始探索的新领域，建议深入学习其基础概念")
                
                # 基于主题关联推荐相关主题
                if links and len(progress) >= 2:
                    topic_relations = [link for link in links if link.get("type") == "topic_relation"]
                    if topic_relations:
                        # 找出与高频主题相关，但目前进度较低的主题
                        main_topic_id = f"topic_{progress[0]['topic'].replace(' ', '_')}"
                        related_topics = [link["target"] for link in topic_relations 
                                        if link["source"] == main_topic_id and link["strength"] > 0.3]
                        
                        if related_topics:
                            # 从节点中找出这个主题的名称
                            for node in nodes:
                                if node.get("id") in related_topics:
                                    suggestions.append(f"由于您熟悉「{progress[0]['topic']}」，可以尝试学习相关的「{node.get('name', '相关主题')}」")
                                    break
            
            # 如果建议不足3条，添加一些通用建议
            if len(suggestions) < 2:
                suggestions.append("继续提问感兴趣的问题，系统会帮助您构建个性化的知识网络")
            
            if len(suggestions) < 3:
                suggestions.append("尝试深入探讨某个特定概念，这将帮助您形成更完整的知识结构")
            
            return suggestions[:3]  # 最多返回3条建议
            
        except Exception as e:
            print(f"生成动态建议时出错: {str(e)}")
            return ["继续探索您感兴趣的主题", "尝试提问不同领域的问题", "系统会基于您的对话历史动态调整推荐"]
    
    def default_analysis(self) -> Dict[str, Any]:
        """返回默认的学习轨迹分析"""
        return {
            "topics": [],
            "progress": [],
            "suggestions": [
                "开始提问关于您感兴趣的学习主题",
                "尝试询问特定领域的知识点",
                "持续对话会帮助系统更好地了解您的学习进度"
            ]
        }
    
    def generate_suggestions(self, progress: List[Dict[str, Any]]) -> List[str]:
        """根据学习进度生成建议"""
        suggestions = []
        
        # 找出进度最高的主题
        top_topics = [p for p in progress if p["percentage"] > 20]
        if top_topics:
            top_topic = top_topics[0]["topic"]
            suggestions.append(f"您在{top_topic}方面已有一定了解，可以继续深入学习")
        
        # 找出进度较低的主题
        low_topics = [p for p in progress if p["percentage"] < 10 and p["percentage"] > 0]
        if low_topics:
            low_topic = low_topics[0]["topic"]
            suggestions.append(f"可以更多地探索{low_topic}相关知识")
        
        # 找出未涉及的主题
        zero_topics = [p for p in progress if p["percentage"] == 0]
        if zero_topics and len(zero_topics) < len(progress):
            zero_topic = zero_topics[0]["topic"]
            suggestions.append(f"尝试了解{zero_topic}的基础知识")
        
        # 默认建议
        if len(suggestions) < 3:
            suggestions.append("持续提问可以帮助系统更准确地分析您的学习轨迹")
            suggestions.append("尝试询问特定领域的进阶知识点")
            suggestions.append("系统会根据您的对话历史动态调整学习路径建议")
        
        return suggestions[:3]  # 最多返回3条建议

# 创建服务实例
learning_memory_service = LearningMemoryService()
