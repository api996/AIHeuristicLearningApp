
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
        分析用户的学习轨迹
        
        Args:
            user_id: 用户ID
            
        Returns:
            学习轨迹分析结果
        """
        try:
            user_dir = os.path.join(self.memory_dir, str(user_id))
            if not os.path.exists(user_dir):
                return self.default_analysis()
                
            # 收集所有记忆
            memories = []
            for filename in os.listdir(user_dir):
                if filename.endswith('.json'):
                    file_path = os.path.join(user_dir, filename)
                    with open(file_path, 'r', encoding='utf-8') as f:
                        memory = json.load(f)
                        memories.append(memory)
            
            if not memories:
                return self.default_analysis()
                
            # 常用学科关键词，用于主题发现
            subject_keywords = {
                "数学": ["数学", "微积分", "导数", "积分", "方程", "极限", "连续", "收敛", "级数", "数列", "函数", "几何"],
                "物理": ["物理", "牛顿", "力学", "能量", "电磁", "热力学", "光学", "相对论", "量子", "电子", "原子"],
                "化学": ["化学", "元素", "分子", "原子", "反应", "化合物", "酸碱", "氧化", "还原", "溶液", "周期表"],
                "生物": ["生物", "细胞", "DNA", "基因", "蛋白质", "进化", "生态", "遗传", "代谢", "光合作用"],
                "计算机": ["编程", "算法", "数据结构", "代码", "软件", "函数", "变量", "类", "对象", "网络", "数据库"],
                "医学": ["医学", "疾病", "治疗", "药物", "症状", "检查", "手术", "健康", "解剖", "生理"],
                "历史": ["历史", "朝代", "国家", "战争", "文明", "革命", "政治", "文化", "人物", "年代", "时期"],
                "地理": ["地理", "地形", "气候", "地图", "国家", "城市", "河流", "山脉", "海洋", "洲", "天气"],
                "经济": ["经济", "市场", "金融", "投资", "货币", "股票", "通货膨胀", "需求", "供给", "宏观", "微观"],
                "艺术": ["艺术", "绘画", "音乐", "文学", "雕塑", "建筑", "设计", "创作", "表演", "美学"]
            }
            
            # 动态发现主题 - 先分析已知的主题
            known_topics = {}
            for subject, keywords in subject_keywords.items():
                known_topics[subject] = 0
                for memory in memories:
                    content = memory["content"].lower()
                    for keyword in keywords:
                        if keyword.lower() in content:
                            known_topics[subject] += 1
                            break
            
            # 过滤掉零提及的主题
            active_topics = {topic: count for topic, count in known_topics.items() if count > 0}
            
            # 如果没有找到已知主题，尝试从内容中提取可能的主题
            custom_topics = {}
            if not active_topics:
                # 提取用户常用词汇作为可能的主题
                all_words = []
                for memory in memories:
                    content = memory["content"].lower()
                    # 仅保留字母词汇，过滤掉标点、数字等
                    words = [word for word in content.split() if word.isalpha() and len(word) > 1]
                    all_words.extend(words)
                
                # 统计词频
                word_counts = {}
                for word in all_words:
                    if word not in word_counts:
                        word_counts[word] = 1
                    else:
                        word_counts[word] += 1
                
                # 提取高频词作为可能的主题（可能是学习领域）
                sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
                for word, count in sorted_words[:5]:  # 取前5个高频词作为自定义主题
                    if count > 1:  # 至少出现2次
                        custom_topics[word] = count
            
            # 合并已知主题和自定义主题
            final_topics = {**active_topics, **custom_topics}
            
            # 如果仍然没有发现主题，返回默认分析
            if not final_topics:
                return self.default_analysis()
            
            # 计算主题进度
            total_memories = len(memories)
            progress = []
            for topic, count in final_topics.items():
                percentage = round((count / max(1, total_memories)) * 100)
                progress.append({
                    "topic": topic,
                    "percentage": percentage
                })
            
            # 排序进度，按百分比降序
            progress.sort(key=lambda x: x["percentage"], reverse=True)
            
            # 生成建议
            suggestions = self.generate_suggestions(progress)
            
            return {
                "topics": list(final_topics.keys()),
                "progress": progress,
                "suggestions": suggestions
            }
        except Exception as e:
            print(f"分析学习轨迹时出错: {str(e)}")
            return self.default_analysis()
    
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
