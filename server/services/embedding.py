import os
from typing import List
from dotenv import load_dotenv
import numpy as np
import google.generativeai as genai

# 加载环境变量
load_dotenv()

# 初始化Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("缺少GEMINI_API_KEY环境变量")

# 配置API密钥
genai.configure(api_key=GEMINI_API_KEY)

class EmbeddingService:
    """提供文本嵌入服务"""

    def __init__(self):
        # 使用最新的Gemini嵌入模型
        self.model_name = "models/gemini-embedding-exp-03-07"  # 添加models/前缀以符合API要求

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

                for text in batch_texts:
                    print(f"处理文本: {text[:30]}...")
                    try:
                        # 使用更新后的API方法获取嵌入向量
                        print(f"调用genai.embed_content(model={self.model_name}, content={text[:20]}...)")
                        
                        # 使用新API进行嵌入
                        result = genai.embed_content(
                            model=self.model_name,
                            content=text,
                            task_type="retrieval_document"
                        )
                        
                        # 解析嵌入结果
                        # 新API返回的是字典结构，嵌入向量在"embedding"键下
                        if not isinstance(result, dict) or "embedding" not in result:
                            print(f"错误：嵌入结果格式不正确: {result}")
                            raise ValueError(f"嵌入结果未返回预期格式: {result}")
                            
                        vector = result["embedding"]
                        if not vector or all(v == 0 for v in vector[:10]):
                            print(f"警告：生成的嵌入向量似乎都是0或为空")
                            raise ValueError("生成的嵌入向量无效")
                            
                        print(f"嵌入向量生成成功，维度: {len(vector)}, 前5个值: {vector[:5]}")
                        embeddings.append(vector)

                    except Exception as e:
                        print(f"处理文本时出错: {str(e)}")
                        # 创建一个简单的替代向量，使用正确的维度3072而不是768
                        print("生成替代嵌入向量...")
                        embeddings.append([0.0] * 3072)

            return embeddings
        except Exception as e:
            print(f"嵌入生成错误: {str(e)}")
            # 出错时返回空向量
            # 出错时返回10维的小随机向量而不是空向量
            import random
            fallback_vectors = []
            for _ in texts:
                # 创建一个小的随机向量，这样即使API失败，也能有基本的分析功能
                fallback_vector = [random.uniform(-0.1, 0.1) for _ in range(10)]
                fallback_vectors.append(fallback_vector)
            print(f"使用随机向量替代，数量: {len(fallback_vectors)}")
            return fallback_vectors

    async def similarity(self, text1: str, text2: str) -> float:
        """
        计算两个文本之间的相似度

        Args:
            text1: 第一个文本
            text2: 第二个文本

        Returns:
            相似度分数 (0-1)
        """
        try:
            embeddings = await self.get_embeddings([text1, text2])

            # 安全检查
            if not embeddings or len(embeddings) < 2:
                print("无法获取两个文本的嵌入向量")
                return 0.0

            # 确保我们有两个非空向量
            if not embeddings[0] or not embeddings[1]:
                print("获取到空的嵌入向量")
                # 使用字符串匹配作为回退机制
                # 注意：这只是一个简单的替代方案，不如余弦相似度准确
                common_words1 = set(text1.lower().split())
                common_words2 = set(text2.lower().split())
                if not common_words1 or not common_words2:
                    return 0.0

                intersection = common_words1.intersection(common_words2)
                union = common_words1.union(common_words2)

                # 计算Jaccard相似度作为替代
                return len(intersection) / max(1, len(union))

            # 正常情况：计算余弦相似度
            vec1 = np.array(embeddings[0])
            vec2 = np.array(embeddings[1])

            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)

            if norm1 == 0 or norm2 == 0:
                print("嵌入向量范数为零")
                return 0.0

            similarity = dot_product / (norm1 * norm2)
            print(f"计算相似度成功: {similarity}")
            return similarity

        except Exception as e:
            print(f"计算相似度时出错: {str(e)}")
            return 0.0

# 创建服务实例
embedding_service = EmbeddingService()