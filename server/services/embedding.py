
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
        # 初始化embedding模型 - 使用Gemini模型但格式正确
        self.model_name = "models/embedding-001"
        
    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        获取文本的嵌入向量
        
        Args:
            texts: 需要嵌入的文本列表
            
        Returns:
            嵌入向量列表
        """
        try:
            if not texts:
                print("警告: 传入的文本列表为空")
                return []
                
            embeddings = []
            # 分批处理以避免请求过大
            batch_size = 10
            for i in range(0, len(texts), batch_size):
                batch_texts = texts[i:i+batch_size]
                print(f"使用嵌入模型: {self.model_name}，请求嵌入向量，文本数量: {len(batch_texts)}")
                try:
                    result = genai.embed_content(
                        model=self.model_name,
                        content=batch_texts,
                        task_type="retrieval_document"
                    )
                    
                    if result and hasattr(result, 'embeddings') and result.embeddings:
                        print(f"嵌入向量生成成功，维度: {len(result.embeddings[0].values) if result.embeddings else '未知'}")
                        
                        # 将结果添加到列表中
                        for embedding in result.embeddings:
                            embeddings.append(embedding.values)
                    else:
                        print(f"警告: API返回了空结果或无效结果")
                        for _ in batch_texts:
                            embeddings.append([])
                except Exception as batch_error:
                    print(f"处理批次 {i} 时出错: {str(batch_error)}")
                    # 为这个批次中的每个文本添加空向量
                    for _ in batch_texts:
                        embeddings.append([])
                    
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
