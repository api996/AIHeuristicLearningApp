
import os
import google.generativeai as genai
from dotenv import load_dotenv
from typing import List
import numpy as np

# 加载环境变量
load_dotenv()

# 初始化Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("缺少GEMINI_API_KEY环境变量")

genai.configure(api_key=GEMINI_API_KEY)

class EmbeddingService:
    """提供文本嵌入服务"""
    
    def __init__(self):
        # 初始化embedding模型
        self.model_name = "gemini-embedding-exp-03-07"
        
    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        获取文本的嵌入向量
        
        Args:
            texts: 需要嵌入的文本列表
            
        Returns:
            嵌入向量列表
        """
        try:
            embeddings = []
            # 分批处理以避免请求过大
            batch_size = 10
            for i in range(0, len(texts), batch_size):
                batch_texts = texts[i:i+batch_size]
                result = genai.embed_content(
                    model=self.model_name,
                    content=batch_texts,
                    task_type="retrieval_document"
                )
                
                # 将结果添加到列表中
                for embedding in result.embeddings:
                    embeddings.append(embedding.values)
                    
            return embeddings
        except Exception as e:
            print(f"嵌入生成错误: {str(e)}")
            # 出错时返回空向量
            return [[] for _ in texts]
    
    async def similarity(self, text1: str, text2: str) -> float:
        """
        计算两个文本之间的相似度
        
        Args:
            text1: 第一个文本
            text2: 第二个文本
            
        Returns:
            相似度分数 (0-1)
        """
        embeddings = await self.get_embeddings([text1, text2])
        if not embeddings or not embeddings[0] or not embeddings[1]:
            return 0.0
            
        # 计算余弦相似度
        vec1 = np.array(embeddings[0])
        vec2 = np.array(embeddings[1])
        
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
            
        return dot_product / (norm1 * norm2)

# 创建服务实例
embedding_service = EmbeddingService()
