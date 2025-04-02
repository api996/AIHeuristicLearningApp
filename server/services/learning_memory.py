
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
        self.memory_dir = "memory_space"
        self.ensure_memory_dir()
        self.embedding_service = embedding_service
        
    def ensure_memory_dir(self) -> None:
        """确保记忆空间目录存在"""
        if not os.path.exists(self.memory_dir):
            os.makedirs(self.memory_dir)
            
    async def save_memory(self, user_id: int, content: str, type: str = "chat") -> None:
        """
        保存用户记忆到记忆空间
        
        Args:
            user_id: 用户ID
            content: 记忆内容
            type: 记忆类型 (chat, query, etc)
        """
        try:
            # 为用户创建目录
            user_dir = os.path.join(self.memory_dir, str(user_id))
            if not os.path.exists(user_dir):
                os.makedirs(user_dir)
                
            # 获取内容的嵌入向量
            embeddings = await self.embedding_service.get_embeddings([content])
            if not embeddings or not embeddings[0]:
                print(f"无法为内容生成嵌入向量: {content[:50]}...")
                return
                
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
            
            # 保存到文件
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(memory_item, f, ensure_ascii=False)
                
            print(f"成功保存用户{user_id}的记忆：{content[:50]}...")
        except Exception as e:
            print(f"保存记忆时出错: {str(e)}")
            
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
                memory_vector = np.array(memory["embedding"])
                similarity = self.cosine_similarity(query_vector, memory_vector)
                scored_memories.append((memory, similarity))
                
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
                
            # 定义主题关键词
            topic_keywords = {
                "高等数学": ["微积分", "导数", "积分", "微分方程", "极限", "连续", "收敛", "级数"],
                "线性代数": ["矩阵", "向量", "特征值", "特征向量", "线性变换", "行列式", "线性空间"],
                "概率统计": ["概率", "统计", "分布", "期望", "方差", "假设检验", "回归分析"],
                "编程基础": ["算法", "数据结构", "编程", "代码", "函数", "变量", "类", "对象"],
                "机器学习": ["模型", "训练", "预测", "神经网络", "分类", "聚类", "回归", "强化学习"]
            }
            
            # 分析主题出现情况
            topic_counts = {}
            for topic, keywords in topic_keywords.items():
                topic_counts[topic] = 0
                for memory in memories:
                    content = memory["content"].lower()
                    for keyword in keywords:
                        if keyword.lower() in content:
                            topic_counts[topic] += 1
                            break
            
            # 计算主题进度
            total_memories = len(memories)
            progress = []
            for topic, count in topic_counts.items():
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
                "topics": list(topic_keywords.keys()),
                "progress": progress,
                "suggestions": suggestions
            }
        except Exception as e:
            print(f"分析学习轨迹时出错: {str(e)}")
            return self.default_analysis()
    
    def default_analysis(self) -> Dict[str, Any]:
        """返回默认的学习轨迹分析"""
        return {
            "topics": ["高等数学", "线性代数", "概率统计", "编程基础", "机器学习"],
            "progress": [
                {"topic": "高等数学", "percentage": 0},
                {"topic": "线性代数", "percentage": 0},
                {"topic": "概率统计", "percentage": 0},
                {"topic": "编程基础", "percentage": 0},
                {"topic": "机器学习", "percentage": 0}
            ],
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
