
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

# 配置API密钥
genai.configure(api_key=GEMINI_API_KEY)

class EmbeddingService:
    """提供文本嵌入服务"""
    
    def __init__(self):
        # 使用最新的Gemini嵌入模型
        self.model_name = "models/embedding-001"  # 最新的通用嵌入模型
        
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
                    # 使用正确的API调用方式获取嵌入向量
                    for text in batch_texts:
                        print(f"处理文本: {text[:30]}...")
                        try:
                            # 使用最新版本的Gemini嵌入API
                            print(f"尝试使用Embedding模型: {self.model_name}")
                            
                            # 由于嵌入API可能有变动，我们需要适配不同的可能调用方式
                            try:
                                # 尝试方法 1: 直接使用嵌入模型
                                result = genai.embed_content(model=self.model_name, content=text)
                                print("Method 1 - Direct embedding succeeded")
                            except Exception as e1:
                                print(f"Method 1 failed: {str(e1)}")
                                try:
                                    # 尝试方法 2: 使用GenerativeModel
                                    embedding_model = genai.GenerativeModel(self.model_name)
                                    result = embedding_model.embed_content(text)
                                    print("Method 2 - GenerativeModel succeeded")
                                except Exception as e2:
                                    print(f"Method 2 failed: {str(e2)}")
                                    # 如果真的无法获取嵌入，使用简单的单位向量作为替代
                                    # 这只是一个临时解决方案，在实际应用中应该有更好的回退机制
                                    print("使用简单向量作为替代")
                                    embeddings.append([1.0] * 10)  # 使用10维单位向量作为替代
                                    continue
                                    
                            # 处理可能的多种返回格式
                            if result:
                                if hasattr(result, 'embedding'):
                                    # 旧格式: 有embedding属性的对象
                                    print(f"嵌入向量生成成功，维度: {len(result.embedding)}")
                                    embeddings.append(result.embedding)
                                elif isinstance(result, dict) and 'embedding' in result:
                                    # 新格式: 包含embedding键的字典
                                    print(f"嵌入向量生成成功(字典格式)，维度: {len(result['embedding'])}")
                                    embeddings.append(result['embedding'])
                                elif isinstance(result, dict) and 'embeddings' in result:
                                    # 新格式: 包含embeddings键的字典
                                    if result['embeddings'] and len(result['embeddings']) > 0:
                                        print(f"嵌入向量生成成功(embeddings列表)，维度: {len(result['embeddings'][0])}")
                                        embeddings.append(result['embeddings'][0])
                                    else:
                                        print("警告: embeddings列表为空")
                                        embeddings.append([0.1] * 10)
                                else:
                                    # 未知格式
                                    print(f"警告: API返回了未知格式的结果")
                                    print(f"结果类型: {type(result)}")
                                    if isinstance(result, dict):
                                        print(f"结果键: {list(result.keys())}")
                                    else:
                                        print(f"结果属性: {dir(result)}")
                                    # 使用简单向量作为替代
                                    embeddings.append([0.1] * 10)  # 使用10维向量作为替代
                            else:
                                print(f"警告: API返回了空结果")
                                # 使用简单向量作为替代
                                embeddings.append([0.1] * 10)  # 使用10维向量作为替代
                        except Exception as e:
                            print(f"文本嵌入错误: {str(e)}")
                            # 创建一个简单的替代向量
                            embeddings.append([0.0] * 10)
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
