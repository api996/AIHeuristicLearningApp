import os
import sys
import json
import time
from typing import List, Dict, Any, Optional
from collections import deque

try:
    import numpy as np
except ImportError:
    print("错误：numpy 未安装，这个库对于向量操作是必需的")
    sys.exit(1)

try:
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    print("警告：scikit-learn 未安装，将使用基本向量操作")
    # 如果缺少sklearn，定义一个基本的余弦相似度函数
    def cosine_similarity_basic(vec1, vec2):
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return dot_product / (norm1 * norm2)
    
    # 重写cosine_similarity
    def cosine_similarity(X, Y=None):
        if Y is None:
            Y = X
        result = np.zeros((len(X), len(Y)))
        for i, x in enumerate(X):
            for j, y in enumerate(Y):
                result[i, j] = cosine_similarity_basic(x, y)
        return result

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("警告：dotenv 未安装，将直接从环境变量读取")
    def load_dotenv():
        pass

try:
    import google.generativeai as genai
except ImportError:
    print("严重错误：google.generativeai 未安装")
    sys.exit(1)  # 直接退出，不使用备用实现

# 加载环境变量
load_dotenv()

# 初始化Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("缺少GEMINI_API_KEY环境变量")

# 配置API密钥
genai.configure(api_key=GEMINI_API_KEY)

class EmbeddingService:
    """提供文本嵌入服务 - 优化版本，减少API调用"""

    def __init__(self):
        # 使用最新的Gemini嵌入模型
        self.model_name = "models/gemini-embedding-exp-03-07"  # 添加models/前缀以符合API要求
        # 添加向量缓存，减少重复嵌入请求
        self._vector_cache = {}
        self._cache_size = 0
        self._max_cache_size = 1000  # 最大缓存1000个向量
        # 文本长度限制，过长的文本将被截断以降低API调用成本
        self._max_text_length = 1000  # 限制文本长度为1000字符
        
        # 添加API速率限制
        self._minute_request_limit = 5  # 每分钟最大请求数
        self._day_request_limit = 100   # 每天最大请求数
        self._minute_requests = deque()  # 记录过去一分钟的请求时间
        self._day_requests = deque()    # 记录过去24小时的请求时间
        
        print(f"嵌入服务初始化: 使用模型={self.model_name}, 最大缓存={self._max_cache_size}, 文本长度限制={self._max_text_length}")
        print(f"API速率限制: 每分钟{self._minute_request_limit}请求, 每天{self._day_request_limit}请求")
        
    def _preprocess_text(self, text):
        """
        预处理文本，包括截断过长的文本
        """
        if not text:
            return ""
        
        # 截断过长文本
        if len(text) > self._max_text_length:
            text = text[:self._max_text_length]
            
        # 清理文本（移除多余空格和特殊字符）
        text = " ".join(text.split())
        return text
        
    def _get_cache_key(self, text):
        """
        生成缓存键，使用文本的哈希值
        """
        import hashlib
        # 使用MD5哈希作为缓存键
        return hashlib.md5(text.encode()).hexdigest()
        
    def _cache_vector(self, key, vector):
        """
        将向量保存到缓存，并管理缓存大小
        """
        # 如果缓存已满，清除最早的条目
        if len(self._vector_cache) >= self._max_cache_size:
            oldest_key = next(iter(self._vector_cache))
            self._vector_cache.pop(oldest_key)
            print(f"缓存已满，移除最早条目: {oldest_key[:8]}...")
            
        # 添加到缓存
        self._vector_cache[key] = vector
        print(f"向量已缓存，键: {key[:8]}..., 缓存大小: {len(self._vector_cache)}")
        
    def _check_rate_limits(self):
        """
        检查API速率限制，如果超出限制则等待或抛出错误
        
        Returns:
            bool: 是否可以继续执行API调用
            
        Raises:
            ValueError: 如果达到每日限制
        """
        current_time = time.time()
        minute_ago = current_time - 60
        day_ago = current_time - 86400  # 24小时前
        
        # 清理过期的请求记录
        while self._minute_requests and self._minute_requests[0] < minute_ago:
            self._minute_requests.popleft()
            
        while self._day_requests and self._day_requests[0] < day_ago:
            self._day_requests.popleft()
            
        # 检查每日限制
        if len(self._day_requests) >= self._day_request_limit:
            error_msg = f"已达到每日API请求限制({self._day_request_limit}次)，请等待24小时后重试"
            print(error_msg)
            raise ValueError(error_msg)
            
        # 检查每分钟限制，如果超出限制则等待
        if len(self._minute_requests) >= self._minute_request_limit:
            oldest = self._minute_requests[0]
            wait_time = 61 - (current_time - oldest)  # 等待时间略多于1分钟，确保最早的请求过期
            
            if wait_time > 0:
                print(f"已达到每分钟API请求限制，将等待{wait_time:.1f}秒后重试...")
                time.sleep(wait_time)
                # 重新检查速率限制
                return self._check_rate_limits()
                
        # 记录此次请求
        self._minute_requests.append(current_time)
        self._day_requests.append(current_time)
        print(f"API请求计数: 分钟内{len(self._minute_requests)}/{self._minute_request_limit}, 24小时内{len(self._day_requests)}/{self._day_request_limit}")
        
        return True

    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        获取文本的嵌入向量 - 优化版本，包含缓存、长度限制和批处理

        Args:
            texts: 需要嵌入的文本列表

        Returns:
            嵌入向量列表
        """
        try:
            if not texts:
                print("警告: 传入的文本列表为空")
                return []

            # 清理和预处理文本
            processed_texts = [self._preprocess_text(text) for text in texts]
            
            # 初始化结果列表
            embeddings = []
            texts_to_embed = []
            indices_to_embed = []
            
            # 检查缓存，收集未缓存的文本
            for i, text in enumerate(processed_texts):
                # 尝试从缓存获取
                cache_key = self._get_cache_key(text)
                if cache_key in self._vector_cache:
                    print(f"[缓存命中] 文本: {text[:20]}...")
                    embeddings.append(self._vector_cache[cache_key])
                else:
                    # 缓存未命中，需要嵌入
                    texts_to_embed.append(text)
                    indices_to_embed.append(i)
                    # 占位，稍后填充
                    embeddings.append(None)
            
            # 如果有未缓存的文本，进行嵌入
            if texts_to_embed:
                print(f"需要嵌入的文本数量: {len(texts_to_embed)}")
                
                # 分批处理以避免请求过大
                batch_size = 5  # 减小批次大小，降低单次请求负担
                for i in range(0, len(texts_to_embed), batch_size):
                    batch_texts = texts_to_embed[i:i+batch_size]
                    batch_indices = indices_to_embed[i:i+batch_size]
                    print(f"嵌入批次 {i//batch_size + 1}/{(len(texts_to_embed) + batch_size - 1)//batch_size}，文本数量: {len(batch_texts)}")
                    
                    # 为每个文本生成向量
                    for j, text in enumerate(batch_texts):
                        idx = batch_indices[j]
                        try:
                            # 调用API获取嵌入向量
                            print(f"处理文本 {j+1}/{len(batch_texts)}: {text[:20]}...")
                            
                            # 检查API速率限制
                            self._check_rate_limits()
                            
                            # 使用API进行嵌入
                            result = genai.embed_content(
                                model=self.model_name,
                                content=text,
                                task_type="retrieval_document"
                            )
                            
                            # 解析嵌入结果
                            if not isinstance(result, dict) or "embedding" not in result:
                                print(f"错误：嵌入结果格式不正确: {result}")
                                raise ValueError(f"嵌入结果格式不正确")
                                
                            vector = result["embedding"]
                            if not vector or all(v == 0 for v in vector[:10]):
                                print(f"警告：生成的嵌入向量似乎都是0或为空")
                                raise ValueError("生成的嵌入向量无效")
                                
                            print(f"嵌入向量生成成功，维度: {len(vector)}, 前5个值: {vector[:5]}")
                            
                            # 保存到缓存
                            cache_key = self._get_cache_key(text)
                            self._cache_vector(cache_key, vector)
                            
                            # 更新结果列表
                            embeddings[idx] = vector
                            
                        except Exception as e:
                            error_msg = f"处理文本时出错: {str(e)}"
                            print(error_msg)
                            # 不再生成随机替代向量，而是向上抛出错误
                            raise ValueError(error_msg)

            return embeddings
        except Exception as e:
            error_msg = f"嵌入生成错误: {str(e)}"
            print(error_msg)
            # 不再使用随机向量替代，而是向上抛出错误
            raise ValueError(error_msg)

    async def similarity(self, text1: str, text2: str) -> float:
        """
        计算两个文本之间的相似度

        Args:
            text1: 第一个文本
            text2: 第二个文本

        Returns:
            相似度分数 (0-1)
            
        Raises:
            ValueError: 如果计算过程中出现错误
        """
        if not text1 or not text2:
            error_msg = "相似度计算错误：需要两个非空文本"
            print(error_msg)
            raise ValueError(error_msg)
        
        try:
            # get_embeddings 现在会在失败时抛出错误
            embeddings = await self.get_embeddings([text1, text2])

            # 验证嵌入向量
            if not embeddings or len(embeddings) < 2:
                error_msg = "无法获取两个文本的嵌入向量"
                print(error_msg)
                raise ValueError(error_msg)

            # 验证向量维度
            expected_dim = 3072
            if len(embeddings[0]) != expected_dim or len(embeddings[1]) != expected_dim:
                error_msg = f"嵌入向量维度异常 [{len(embeddings[0])}, {len(embeddings[1])}], 期望: {expected_dim}"
                print(error_msg)
                raise ValueError(error_msg)

            # 正常情况：使用scikit-learn计算余弦相似度
            try:
                # 尝试使用sklearn的余弦相似度（更高效）
                vec1 = np.array(embeddings[0]).reshape(1, -1)
                vec2 = np.array(embeddings[1]).reshape(1, -1)
                sim = cosine_similarity(vec1, vec2)[0][0]
                return float(sim)
            except Exception as sklearn_error:
                print(f"使用scikit-learn计算相似度失败: {sklearn_error}，回退到基本实现")
                
                # 回退到基本余弦相似度实现 - 这是数学上等价的，只是实现方法不同
                vec1 = np.array(embeddings[0])
                vec2 = np.array(embeddings[1])
                
                # 使用安全的点积与范数计算
                try:
                    dot_product = np.dot(vec1, vec2)
                except Exception as dot_error:
                    # 如果numpy dot 失败，使用纯Python实现
                    print(f"numpy点积计算失败: {dot_error}，使用Python实现")
                    dot_product = sum(v1*v2 for v1, v2 in zip(vec1, vec2))
                
                try:
                    norm1 = np.linalg.norm(vec1)
                    norm2 = np.linalg.norm(vec2)
                except Exception as norm_error:
                    # 如果numpy norm 失败，使用纯Python实现
                    print(f"numpy范数计算失败: {norm_error}，使用Python实现")
                    norm1 = (sum(v*v for v in vec1)) ** 0.5
                    norm2 = (sum(v*v for v in vec2)) ** 0.5

                if norm1 == 0 or norm2 == 0:
                    error_msg = "嵌入向量范数为零，无法计算相似度"
                    print(error_msg)
                    raise ValueError(error_msg)

                similarity = dot_product / (norm1 * norm2)
                print(f"计算相似度成功: {similarity}")
                return similarity

        except Exception as e:
            error_msg = f"计算相似度时出错: {str(e)}"
            print(error_msg)
            raise ValueError(error_msg)
            
    def embed_single_text(self, text: str) -> Optional[List[float]]:
        """
        为单个文本生成嵌入向量（同步版本，供CLI调用）
        
        Args:
            text: 要嵌入的文本
            
        Returns:
            嵌入向量或None（如果失败）
        """
        if not text:
            error_msg = "错误: 文本为空"
            print(error_msg)
            raise ValueError(error_msg)
            
        try:
            # 预处理文本
            processed_text = self._preprocess_text(text)
            
            # 检查缓存
            cache_key = self._get_cache_key(processed_text)
            if cache_key in self._vector_cache:
                print(f"[缓存命中] 文本: {processed_text[:20]}...")
                vector = self._vector_cache[cache_key]
                
                # 验证向量维度
                expected_dim = 3072
                if len(vector) != expected_dim:
                    error_msg = f"缓存的向量维度异常: {len(vector)}, 期望: {expected_dim}"
                    print(error_msg)
                    raise ValueError(error_msg)
                    
                return vector
                
            # 生成嵌入
            print(f"处理文本: {processed_text[:20]}...")
            
            # 检查API速率限制
            self._check_rate_limits()
            
            result = genai.embed_content(
                model=self.model_name,
                content=processed_text,
                task_type="retrieval_document"
            )
            
            # 解析结果
            if not isinstance(result, dict) or "embedding" not in result:
                error_msg = "错误：嵌入结果格式不正确"
                print(error_msg)
                raise ValueError(error_msg)
                
            vector = result["embedding"]
            
            # 验证向量维度
            expected_dim = 3072
            if len(vector) != expected_dim:
                error_msg = f"嵌入向量维度异常: {len(vector)}, 期望: {expected_dim}"
                print(error_msg)
                raise ValueError(error_msg)
            
            # 保存到缓存
            self._cache_vector(cache_key, vector)
            
            return vector
        except Exception as e:
            error_msg = f"嵌入生成错误: {str(e)}"
            print(error_msg)
            raise ValueError(error_msg)

    def calculate_similarity(self, text1: str, text2: str) -> float:
        """
        计算两个文本之间的余弦相似度（同步版本，供CLI调用）
        
        Args:
            text1: 第一个文本
            text2: 第二个文本
            
        Returns:
            相似度分数（0-1之间）
        
        Raises:
            ValueError: 如果计算过程中发生错误
        """
        if not text1 or not text2:
            error_msg = "相似度计算错误：需要两个非空文本"
            print(error_msg)
            raise ValueError(error_msg)
            
        # 生成嵌入 - embed_single_text现在会抛出错误而不是返回None
        embedding1 = self.embed_single_text(text1)
        embedding2 = self.embed_single_text(text2)
            
        # 计算余弦相似度
        try:
            # 尝试使用sklearn的余弦相似度
            vec1 = np.array(embedding1).reshape(1, -1)
            vec2 = np.array(embedding2).reshape(1, -1)
            sim = cosine_similarity(vec1, vec2)[0][0]
            return float(sim)
        except Exception as e:
            # 仍然保留这个回退，因为它只是计算方法的变化，而不是使用随机数据
            try:
                print(f"使用scikit-learn计算相似度失败: {e}，回退到基本实现")
                # 回退到基本实现 - 数学上等价，只是实现方式不同
                vec1 = np.array(embedding1)
                vec2 = np.array(embedding2)
                
                dot_product = np.dot(vec1, vec2)
                norm1 = np.linalg.norm(vec1)
                norm2 = np.linalg.norm(vec2)
                
                if norm1 == 0 or norm2 == 0:
                    error_msg = "嵌入向量范数为零，无法计算相似度"
                    print(error_msg)
                    raise ValueError(error_msg)
                    
                similarity = dot_product / (norm1 * norm2)
                print(f"计算相似度成功: {similarity}")
                return similarity
            except Exception as inner_error:
                error_msg = f"相似度计算完全失败: {inner_error}"
                print(error_msg)
                raise ValueError(error_msg)

# 创建服务实例
embedding_service = EmbeddingService()

# 命令行接口处理
if __name__ == "__main__":
    # 从标准输入读取JSON数据
    try:
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"error": "没有输入数据"}))
            sys.exit(1)
            
        # 解析输入
        data = json.loads(input_data)
        operation = data.get("operation", "")
        
        # 处理不同的操作
        if operation == "embed":
            # 嵌入单个文本
            text = data.get("text", "")
            if not text:
                print(json.dumps({"error": "文本为空"}))
                sys.exit(1)
            
            try:
                embedding = embedding_service.embed_single_text(text)
                print(json.dumps({"embedding": embedding}))
            except Exception as e:
                print(json.dumps({"error": f"嵌入生成失败: {str(e)}"}))
                
        elif operation == "similarity":
            # 计算两个文本的相似度
            text1 = data.get("text1", "")
            text2 = data.get("text2", "")
            
            if not text1 or not text2:
                print(json.dumps({"error": "需要两个非空文本"}))
                sys.exit(1)
            
            try:
                similarity = embedding_service.calculate_similarity(text1, text2)
                print(json.dumps({"similarity": similarity}))
            except Exception as e:
                print(json.dumps({"error": f"相似度计算失败: {str(e)}"}))
                sys.exit(1)
            
        else:
            print(json.dumps({"error": f"未知操作: {operation}"}))
            
    except json.JSONDecodeError:
        print(json.dumps({"error": "输入不是有效的JSON"}))
    except Exception as e:
        print(json.dumps({"error": f"处理请求时出错: {str(e)}"}))