import os
import json
import re
from typing import List, Dict, Any, Optional
try:
    import numpy as np
except ImportError:
    # 回退到纯Python实现
    print("警告：无法导入numpy，将使用纯Python实现向量操作")
    class NumpyLinalg:
        @staticmethod
        def norm(vec):
            # 手动计算向量的L2范数
            return (sum(x*x for x in vec)) ** 0.5
            
    class NumpyFallback:
        def __init__(self):
            self.linalg = NumpyLinalg()
            
        def array(self, lst):
            return lst
            
        def dot(self, vec1, vec2):
            # 手动计算点积
            return sum(a*b for a, b in zip(vec1, vec2))
    
    np = NumpyFallback()
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
                # 使用3072维随机向量作为替代，保持与嵌入API相同的维度
                import random
                random_vec = [random.uniform(-0.01, 0.01) for _ in range(3072)]
                embeddings = [random_vec]
                print(f"生成3072维随机替代向量: {random_vec[:5]}...")

            # 生成内容摘要
            summary = self.generate_content_summary(content)

            # 提取关键词
            keywords = self.extract_keywords_from_text(content)

            # 创建记忆项，包含摘要和关键词
            memory_item = {
                "content": content,
                "type": type,
                "embedding": embeddings[0],
                "timestamp": datetime.now().isoformat(),
                "summary": summary,
                "keywords": keywords
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
                print(f"用户目录不存在: {user_dir}")
                return []

            # 获取查询的嵌入向量
            query_embeddings = await self.embedding_service.get_embeddings([query])
            if not query_embeddings or not query_embeddings[0]:
                print("无法获取查询的嵌入向量")
                return []

            query_vector = np.array(query_embeddings[0])
            print(f"查询向量维度: {len(query_vector)}")

            # 收集所有记忆并处理缺失字段
            memories = []
            for filename in os.listdir(user_dir):
                if filename.endswith('.json'):
                    file_path = os.path.join(user_dir, filename)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            memory = json.load(f)
                            
                            # 添加文件名作为ID
                            if "id" not in memory:
                                memory["id"] = filename.replace(".json", "")
                            
                            # 检查并生成缺失的字段
                            content = memory.get("content", "")
                            need_update = False
                            
                            # 如果没有summary字段，生成一个
                            if "summary" not in memory and content:
                                memory["summary"] = self.generate_content_summary(content)
                                need_update = True
                                print(f"为记忆生成摘要: {memory['summary'][:30]}...")
                            
                            # 如果没有keywords字段，生成一个
                            if "keywords" not in memory and content:
                                memory["keywords"] = self.extract_keywords_from_text(content)
                                need_update = True
                                print(f"为记忆生成关键词: {memory['keywords']}")
                            
                            # 如果有需要更新的字段，保存回文件
                            if need_update:
                                try:
                                    print(f"更新文件 {filename} 添加缺失字段")
                                    with open(file_path, 'w', encoding='utf-8') as f_write:
                                        json_str = json.dumps(memory, ensure_ascii=False)
                                        f_write.write(json_str)
                                except Exception as e:
                                    print(f"更新文件时出错: {str(e)}")
                            
                            memories.append(memory)
                    except Exception as e:
                        print(f"读取或处理记忆文件出错: {file_path}, 错误: {str(e)}")

            print(f"加载了 {len(memories)} 个记忆文件")
            
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
                                print(f"使用词汇重叠计算相似度: {similarity:.4f}")
                        else:
                            similarity = 0.0
                    else:
                        # 正常使用余弦相似度
                        similarity = self.cosine_similarity(query_vector, memory_vector)
                        print(f"使用余弦相似度: {similarity:.4f}")

                    scored_memories.append((memory, similarity))
                except Exception as e:
                    print(f"计算单个记忆相似度时出错: {str(e)}")
                    # 跳过有问题的记忆项

            # 按相似度降序排序
            scored_memories.sort(key=lambda x: x[1], reverse=True)
            print(f"排序后的记忆数量: {len(scored_memories)}")

            # 返回前limit个结果
            result = [memory for memory, similarity in scored_memories[:limit]]
            print(f"返回 {len(result)} 个相似记忆")
            return result
        except Exception as e:
            print(f"检索记忆时出错: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return []

    def cosine_similarity(self, vec1, vec2) -> float:
        """计算两个向量的余弦相似度"""
        try:
            # 确保向量维度匹配
            if len(vec1) != len(vec2):
                print(f"警告：向量维度不匹配，无法计算余弦相似度: {len(vec1)} vs {len(vec2)}")
                return 0.0
                
            # 计算点积
            if hasattr(np, 'dot'):
                dot_product = np.dot(vec1, vec2)
            else:
                # 手动计算点积
                dot_product = sum(a*b for a, b in zip(vec1, vec2))
            
            # 计算向量范数
            if hasattr(np, 'linalg') and hasattr(np.linalg, 'norm'):
                norm1 = np.linalg.norm(vec1)
                norm2 = np.linalg.norm(vec2)
            else:
                # 手动计算L2范数
                norm1 = (sum(x*x for x in vec1)) ** 0.5
                norm2 = (sum(x*x for x in vec2)) ** 0.5
            
            if norm1 == 0 or norm2 == 0:
                return 0.0

            return dot_product / (norm1 * norm2)
            
        except Exception as e:
            print(f"计算余弦相似度时出错: {str(e)}")
            return 0.0

    def generate_content_summary(self, content: str) -> str:
        """
        为内容生成简短摘要

        Args:
            content: 需要摘要的内容

        Returns:
            摘要文本
        """
        try:
            # 如果内容很短，直接返回
            if len(content) <= 100:
                return content

            # 分句
            sentences = re.split(r'[。！？.!?]+', content)
            sentences = [s.strip() for s in sentences if s.strip()]

            if not sentences:
                return content[:100] + ("..." if len(content) > 100 else "")

            # 选择重要句子作为摘要
            important_sentences = []

            # 1. 优先选择包含问题的句子（通常是用户的核心需求）
            question_patterns = ["什么", "如何", "为什么", "怎么", "是否", "能否", "可以", "请问", "?", "？", "how", "what", "why", "when", "where", "which"]
            for sentence in sentences:
                for pattern in question_patterns:
                    if pattern in sentence.lower():
                        important_sentences.append(sentence)
                        break

            # 2. 如果没有找到问题句，选择第一句话（通常包含主题）
            if not important_sentences and sentences:
                important_sentences.append(sentences[0])

            # 3. 如果第一句话太短，添加下一句
            if len(important_sentences) == 1 and len(important_sentences[0]) < 20 and len(sentences) > 1:
                important_sentences.append(sentences[1])

            # 组合摘要，确保不超过150字符
            summary = "；".join(important_sentences)
            if len(summary) > 150:
                summary = summary[:147] + "..."

            return summary

        except Exception as e:
            print(f"生成内容摘要时出错: {str(e)}")
            # 出错时返回简单截取
            return content[:100] + ("..." if len(content) > 100 else "")

    async def analyze_learning_path(self, user_id: int) -> Dict[str, Any]:
        """
        分析用户的学习轨迹，采用动态话题发现和语义分析

        Args:
            user_id: 用户ID

        Returns:
            学习轨迹分析结果 - 动态生成的知识记忆空间
        """
        try:
            print(f"开始分析用户 {user_id} 的学习轨迹...")
            user_dir = os.path.join(self.memory_dir, str(user_id))
            if not os.path.exists(user_dir):
                print(f"用户目录不存在: {user_dir}")
                return self.default_analysis()

            # 收集所有记忆
            memories = []
            memory_files = sorted(os.listdir(user_dir))  # 按文件名排序（通常包含时间戳）
            print(f"找到 {len(memory_files)} 个记忆文件")
            
            file_load_errors = 0
            for filename in memory_files:
                if filename.endswith('.json'):
                    file_path = os.path.join(user_dir, filename)
                    try:
                        # 使用带异常处理的方式读取文件
                        with open(file_path, 'r', encoding='utf-8') as f:
                            file_content = f.read()
                            # 检查文件内容是否为空
                            if not file_content.strip():
                                print(f"文件为空: {filename}")
                                continue
                                
                            try:
                                memory = json.loads(file_content)
                                # 添加文件名作为ID，方便后续引用
                                memory["id"] = filename.replace(".json", "")
                                content = memory.get("content", "")
                                
                                # 检查并处理缺失字段
                                need_update = False
                                
                                # 检查嵌入向量情况
                                if "embedding" in memory:
                                    embedding = memory["embedding"]
                                    if embedding:
                                        if len(embedding) < 5:
                                            print(f"警告：文件 {filename} 的向量过短: {len(embedding)}")
                                            need_update = True
                                        elif all(v == 0 for v in embedding[:5]):
                                            print(f"警告：文件 {filename} 的向量为零向量")
                                            need_update = True
                                        else:
                                            print(f"文件 {filename} 的向量正常，维度: {len(embedding)}")
                                    else:
                                        print(f"警告：文件 {filename} 的向量为空")
                                        need_update = True
                                else:
                                    print(f"警告：文件 {filename} 缺少embedding字段")
                                    need_update = True
                                    
                                # 检查summary字段
                                if "summary" not in memory and content:
                                    print(f"文件 {filename} 缺少summary字段，自动生成")
                                    memory["summary"] = self.generate_content_summary(content)
                                    need_update = True
                                    
                                # 检查keywords字段
                                if "keywords" not in memory and content:
                                    print(f"文件 {filename} 缺少keywords字段，自动生成")
                                    memory["keywords"] = self.extract_keywords_from_text(content)
                                    need_update = True
                                
                                # 如果有缺失字段，更新文件
                                if need_update and user_id is not None:
                                    try:
                                        user_dir = os.path.join(self.memory_dir, str(user_id))
                                        file_path = os.path.join(user_dir, filename)
                                        print(f"更新文件 {filename} 添加缺失字段")
                                        with open(file_path, 'w', encoding='utf-8') as f:
                                            json_str = json.dumps(memory, ensure_ascii=False)
                                            f.write(json_str)
                                    except Exception as e:
                                        print(f"更新文件时出错: {str(e)}")
                                
                                memories.append(memory)
                            except json.JSONDecodeError as e:
                                print(f"JSON解析错误(文件 {filename}): {str(e)}")
                                file_load_errors += 1
                    except Exception as e:
                        print(f"读取文件 {filename} 时出错: {str(e)}")
                        file_load_errors += 1

            print(f"成功加载了 {len(memories)} 个记忆，{file_load_errors} 个文件加载失败")
            if not memories:
                print("没有有效的记忆数据，返回默认分析结果")
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
            print(f"开始对 {len(memories)} 个记忆节点进行聚类分析...")
            topic_clusters = await self.cluster_memories(memories, user_id)
            print(f"聚类完成，发现 {len(topic_clusters)} 个主题群组")

            if not topic_clusters:
                print("警告：未能找到任何主题群组，将返回默认分析结果")
                return self.default_analysis()

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
        """从文本中提取关键词和主题短语，使用NLP技术提高可读性"""
        try:
            # 分词并过滤停用词
            words = text.lower().split()
            # 扩展的停用词表，包含更多常见词汇
            stopwords = {
                "的", "了", "和", "是", "在", "我", "有", "这", "个", "你", "们", "他", "她", "它", "一个", "就是",
                "不", "也", "为", "吗", "什么", "怎么", "如何", "那么", "这样", "那样", "一样", "所以", "因为",
                "可以", "能", "会", "要", "想", "需要", "应该", "可能", "或许", "大概", "比较", "非常", "很", "真的"
            }
            filtered_words = [w for w in words if w not in stopwords and len(w) > 1]

            # 计数并找出高频词
            word_counts = {}
            for word in filtered_words:
                if word not in word_counts:
                    word_counts[word] = 1
                else:
                    word_counts[word] += 1

            # 尝试识别有意义的组合词和短语(2-3个词的组合)
            phrases = []
            for i in range(len(words) - 1):
                if words[i] not in stopwords and words[i+1] not in stopwords:
                    bigram = words[i] + words[i+1]
                    phrases.append(bigram)

                if i < len(words) - 2 and words[i] not in stopwords and words[i+2] not in stopwords:
                    # 允许中间有一个停用词
                    trigram = words[i] + words[i+1] + words[i+2]
                    phrases.append(trigram)

            # 对短语计数
            phrase_counts = {}
            for phrase in phrases:
                if phrase not in phrase_counts:
                    phrase_counts[phrase] = 1
                else:
                    phrase_counts[phrase] += 1

            # 主题词汇相关性词典 - 帮助将关键词映射为可读的主题名
            topic_mappings = {
                # 学科映射
                "物理": "物理学", "数学": "数学", "化学": "化学", "生物": "生物学", 
                "编程": "计算机编程", "代码": "编程和开发", "程序": "程序设计", 
                "历史": "历史", "地理": "地理", "文学": "文学", "小说": "小说创作",
                "语言": "语言学习", "英语": "英语学习", "日语": "日语学习", "法语": "法语学习",
                "艺术": "艺术", "音乐": "音乐欣赏", "绘画": "绘画技巧", "设计": "设计理念",

                # AI/技术相关映射
                "ai": "人工智能", "机器学习": "机器学习", "深度学习": "深度学习",
                "神经网络": "神经网络", "python": "Python编程", "javascript": "JavaScript编程",
                "java": "Java编程", "c++": "C++编程", "数据": "数据分析", 
                "tensorflow": "TensorFlow框架", "pytorch": "PyTorch框架",
                "大模型": "大型语言模型", "gpt": "GPT模型", "chatgpt": "ChatGPT应用",
                "prompt": "提示词工程", "embedding": "嵌入技术", "向量": "向量数据库",
                "gemini": "Gemini模型", "api": "API设计与使用", "接口": "接口开发",

                # 学习行为映射
                "学习": "学习方法", "复习": "复习技巧", "记忆": "记忆技巧", "理解": "概念理解",
                "问题": "问题解决", "思考": "批判性思考", "分析": "分析方法", "写作": "写作技巧",
                "阅读": "阅读理解", "创作": "创作技巧", "探索": "知识探索", "项目": "项目管理",

                # 常见学习主题组合映射
                "如何学习": "学习方法", "知识点": "知识要点", "考试技巧": "考试准备",
                "重要概念": "核心概念", "难点解析": "难点解析", "实战案例": "实践应用",
                "入门教程": "入门指南", "高级技巧": "高级技术", "学习路径": "学习路线图",
                "debug": "调试技巧", "错误处理": "错误处理", "优化方法": "性能优化",
                "聊天机器人": "对话系统开发", "记忆系统": "记忆空间设计"
            }

            # 集合高频词和高频短语，优先选择可读性强的
            sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
            sorted_phrases = sorted(phrase_counts.items(), key=lambda x: x[1], reverse=True)

            # 提取高频且有意义的关键词 (优先使用映射表中的词或短语)
            keywords = []

            # 首先检查映射表中的关键词
            for word, _ in sorted_words[:20]:  # 考虑前20个高频词
                if word in topic_mappings:
                    # 使用映射表转换为可读主题名
                    readable_topic = topic_mappings[word]
                    if readable_topic not in keywords:
                        keywords.append(readable_topic)
                elif word_counts[word] > 1:  # 至少出现2次
                    keywords.append(word)

            # 如果关键词太少，添加有意义的短语
            if len(keywords) < 5:
                for phrase, count in sorted_phrases[:10]:
                    if count > 1 and len(phrase) > 3:  # 过滤太短的短语
                        # 检查短语是否能映射到可读主题
                        mapped = False
                        for key, value in topic_mappings.items():
                            if key in phrase:
                                if value not in keywords:
                                    keywords.append(value)
                                    mapped = True
                                    break

                        # 如果没有映射，直接添加短语
                        if not mapped and phrase not in keywords and len(keywords) < 8:
                            keywords.append(phrase)

            # 限制返回结果数量，保证可读性
            return keywords[:10]  

        except Exception as e:
            print(f"提取关键词时出错: {str(e)}")
            return ["学习主题"]  # 提供一个默认值而不是空列表

    async def cluster_memories(self, memories: List[Dict[str, Any]], user_id: Optional[int] = None) -> Dict[str, Dict[str, Any]]:
        """使用语义相似性对记忆进行聚类，发现主题"""
        try:
            if not memories:
                return {}

            # 为所有记忆内容生成嵌入向量（如果尚未有嵌入或嵌入为零向量）
            memory_texts = [mem.get("content", "") for mem in memories]

            # 检查哪些记忆需要重新生成嵌入（没有嵌入、嵌入是零向量或维度不正确）
            memories_need_embedding = []
            
            # 检查是否有任何记忆有正确的向量以确定预期维度
            expected_dim = 3072  # Gemini嵌入模型的默认维度
            for memory in memories:
                embedding = memory.get("embedding", [])
                # 找到第一个非零嵌入并记录其维度
                if embedding and not all(v == 0 for v in embedding[:10]):
                    expected_dim = len(embedding)
                    print(f"找到正常嵌入向量，维度为 {expected_dim}")
                    break
            
            for i, memory in enumerate(memories):
                embedding = memory.get("embedding", [])
                # 检查向量是否为以下情况之一:
                # 1. 空向量
                # 2. 维度不匹配
                # 3. 全是零或前10个元素是零
                if (not embedding) or (len(embedding) != expected_dim) or (all(v == 0 for v in embedding[:10])):
                    memories_need_embedding.append(i)
                    print(f"记忆 {memory.get('id', i)} 需要生成嵌入向量，原因：" + 
                          ("空向量" if not embedding else 
                           f"维度不匹配 (当前:{len(embedding)}, 预期:{expected_dim})" if len(embedding) != expected_dim else 
                           "全零向量"))

            # 如果有记忆需要重新生成嵌入
            if memories_need_embedding:
                try:
                    # 只为需要嵌入的记忆获取新向量
                    texts_to_embed = [memory_texts[i] for i in memories_need_embedding]
                    print(f"正在为 {len(texts_to_embed)} 个记忆生成嵌入向量...")
                    embeddings = await self.embedding_service.get_embeddings(texts_to_embed)

                    # 更新记忆对象的嵌入
                    for idx, embedding in zip(memories_need_embedding, embeddings):
                        memories[idx]["embedding"] = embedding
                        # 记录嵌入维度以便调试
                        print(f"生成嵌入向量成功，维度: {len(embedding)}" + 
                              (", 前5个值: " + str(embedding[:5]) if embedding else ", 嵌入为空"))

                        # 如果记忆有id，同时更新文件
                        if "id" in memories[idx]:
                            memory_id = memories[idx]["id"]
                            user_dir = os.path.join(self.memory_dir, str(user_id))
                            file_path = os.path.join(user_dir, f"{memory_id}.json")
                            if os.path.exists(file_path):
                                print(f"更新文件 {file_path} 的嵌入向量")
                                try:
                                    with open(file_path, 'w', encoding='utf-8') as f:
                                        json_str = json.dumps(memories[idx], ensure_ascii=False)
                                        f.write(json_str)
                                except Exception as e:
                                    print(f"更新记忆文件 {file_path} 时出错: {str(e)}")

                except Exception as e:
                    print(f"获取嵌入向量时出错: {str(e)}")
                    import traceback
                    print(traceback.format_exc())
                    # 继续执行，使用基于关键词的聚类

            # 方法一：基于语义相似性的聚类（如果有嵌入向量）
            clusters = {}

            # 收集所有可能的主题词
            all_keywords = set()
            print(f"开始提取关键词，共有 {len(memories)} 个记忆")
            
            # 预设一些通用关键词分类，确保即使提取不到足够关键词也能生成主题
            default_categories = {
                "英语学习": ["english", "learn", "language", "study"],
                "计算机编程": ["programming", "code", "python", "javascript"],
                "数学知识": ["math", "mathematics", "calculation"],
                "人工智能": ["ai", "artificial intelligence", "machine learning", "深度学习", "机器学习"],
                "学习方法": ["learning", "method", "strategy", "study"],
                "记忆技巧": ["memory", "memorize", "remember", "recall"]
            }
            
            # 添加这些默认分类的关键词到全局关键词集
            for category, keywords in default_categories.items():
                all_keywords.update(keywords)
            
            for i, memory in enumerate(memories):
                try:
                    content = memory.get("content", "").lower()
                    if not content:
                        print(f"记忆 {i} 没有内容字段或内容为空")
                        continue
                    
                    # 使用现有关键词或生成新的
                    if "keywords" in memory and memory["keywords"]:
                        keywords = memory["keywords"]
                    else:
                        print(f"提取记忆 {i} 的关键词，内容: {content[:30]}...")
                        keywords = self.extract_keywords_from_text(content)
                        # 如果关键词为空，尝试从内容中提取常见词
                        if not keywords:
                            words = content.split()
                            keywords = [w for w in words if len(w) > 3][:5]  # 简单取长度大于3的前5个词
                    
                    memory["keywords"] = keywords  # 更新记忆对象的关键词
                    print(f"记忆 {i} 的关键词: {keywords}")
                    all_keywords.update(keywords)
                except Exception as e:
                    print(f"处理记忆 {i} 的关键词时出错: {str(e)}")
            
            # 如果没有提取到足够的关键词，添加一些一般性的主题
            if len(all_keywords) < 5:
                print("关键词太少，添加一些通用主题")
                all_keywords.update(["学习主题", "英语学习", "知识探索", "人工智能", "学习方法"])
                
            print(f"共提取出 {len(all_keywords)} 个不同的关键词: {list(all_keywords)[:20]}")

            # 尝试将每个高频词作为一个潜在主题
            for keyword in list(all_keywords)[:20]:  # 限制主题数量
                # 计算该关键词与每个记忆的相关性
                related_memories = []
                keyword_relevance = []
                total_relevance = 0

                for memory in memories:
                    memory_id = memory.get("id", "")
                    content = memory.get("content", "").lower()

                    # 计算相关性（改进版 - 同时考虑关键词匹配和语义相似度）
                    relevance = 0

                    # 1. 关键词匹配相关性
                    keyword_match = 0
                    if keyword in content:
                        # 关键词出现的次数/总词数
                        keyword_match = content.count(keyword) / max(1, len(content.split()))

                    # 2. 检查是否有有效的嵌入向量可以计算语义相似度
                    embedding = memory.get("embedding", [])
                    semantic_match = 0

                    # 综合相关性计算 (以关键词匹配为主，如果后续有语义相似度则结合)
                    relevance = keyword_match

                    if relevance > 0:
                        keyword_relevance.append((memory_id, relevance))
                        total_relevance += relevance

                        if relevance > 0.005:  # 降低相关性阈值，捕获更多潜在相关内容
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
                        # 直接使用最有代表性的关键词作为主题名，避免使用斜线分隔
                        keywords_list = sorted(list(merged_keywords), key=len, reverse=True)

                        # 优先使用映射表中存在的关键词
                        mapped_keywords = []
                        for kw in keywords_list:
                            if kw in self.extract_keywords_from_text.__globals__.get('topic_mappings', {}):
                                mapped_keywords.append(kw)

                        if mapped_keywords:
                            # 使用映射表中的第一个关键词作为主题名
                            merged_name = mapped_keywords[0]
                        elif keywords_list:
                            # 否则使用最长的关键词
                            merged_name = keywords_list[0]
                        else:
                            # 默认主题名
                            merged_name = "学习主题"

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

            # 如果建议不足3条，添加一些通用建议            if len(suggestions) < 2:
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