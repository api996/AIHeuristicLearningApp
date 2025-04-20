"""
高性能聚类服务
使用scikit-learn优化的K-means聚类，针对高维向量进行优化
"""

import os
import json
import logging
from typing import List, Dict, Any, Union, Optional

# 配置日志记录
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('python_clustering_service')

# 导入科学计算库
try:
    import numpy as np
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import normalize
    # 标记可用状态
    SKLEARN_AVAILABLE = True
    logger.info("scikit-learn和numpy已成功导入")
except ImportError as e:
    logger.error(f"导入scikit-learn或numpy失败: {e}")
    SKLEARN_AVAILABLE = False

class ClusteringService:
    """提供基于scikit-learn的高性能聚类服务"""

    def __init__(self):
        self.sklearn_available = SKLEARN_AVAILABLE
        if SKLEARN_AVAILABLE:
            logger.info("K-means聚类服务初始化成功，使用scikit-learn优化实现")
        else:
            logger.warning("K-means聚类服务初始化成功，但scikit-learn不可用")

    def is_sklearn_available(self) -> bool:
        """检查scikit-learn是否可用"""
        return self.sklearn_available

    def determine_optimal_k(self, data_size: int) -> int:
        """
        动态确定最优聚类数量
        与TypeScript版本保持一致的逻辑
        """
        if data_size < 10:
            return max(2, data_size // 2)
        elif data_size < 30:
            return max(3, data_size // 6)
        elif data_size < 100:
            return max(4, data_size // 15)
        else:
            return max(5, data_size // 30)

    def cluster_vectors(
        self, 
        vectors: List[Dict[str, Any]], 
        n_clusters: Optional[int] = None,
        use_cosine_distance: bool = True
    ) -> Dict[str, Any]:
        """
        使用K-means聚类向量
        
        Args:
            vectors: 包含id和vector字段的向量对象列表
            n_clusters: 聚类数量（如果为None则自动确定）
            use_cosine_distance: 是否使用余弦距离（否则使用欧氏距离）
            
        Returns:
            聚类结果字典，包含质心和聚类分配
        """
        if not self.sklearn_available:
            logger.error("scikit-learn不可用，无法执行聚类")
            return {"error": "scikit-learn不可用，请使用TypeScript实现"}
            
        if not vectors or len(vectors) < 2:
            logger.warning(f"向量数量不足，无法执行聚类: {len(vectors) if vectors else 0}个向量")
            return {"error": "向量数量不足，无法执行聚类"}
            
        try:
            # 提取向量和ID
            vector_data = []
            vector_ids = []
            
            for idx, item in enumerate(vectors):
                if "id" not in item or "vector" not in item:
                    logger.warning(f"警告: 向量项缺少id或vector字段: {item}")
                    continue
                    
                if not isinstance(item["vector"], list):
                    logger.warning(f"警告: 向量格式错误，应为数组: {type(item['vector'])}")
                    continue
                    
                vector_data.append(item["vector"])
                vector_ids.append(item["id"])
                
            if len(vector_data) < 2:
                logger.error("有效向量数量不足，无法执行聚类")
                return {"error": "有效向量数量不足，无法执行聚类"}
                
            # 转换为numpy数组
            vectors_array = np.array(vector_data, dtype=np.float32)
            logger.info(f"向量数据已转换为numpy数组, 形状: {vectors_array.shape}")
            
            # 动态确定聚类数
            if n_clusters is None:
                n_clusters = self.determine_optimal_k(len(vectors_array))
                logger.info(f"自动确定聚类数量: k = {n_clusters}")
            
            # 根据距离度量选择聚类方法
            if use_cosine_distance:
                # 余弦距离要求向量归一化
                vectors_array = normalize(vectors_array, axis=1)
                metric = 'cosine'
                logger.info("使用余弦距离度量")
            else:
                metric = 'euclidean'
                logger.info("使用欧氏距离度量")
                
            # 创建并执行K-means
            kmeans = KMeans(
                n_clusters=n_clusters,
                init='k-means++',
                n_init=10,
                max_iter=300,
                tol=0.0001,
                random_state=42,
                algorithm='elkan' if use_cosine_distance else 'auto'
            )
            
            # 训练模型并预测聚类
            logger.info(f"开始K-means聚类，数据维度: {vectors_array.shape}")
            cluster_labels = kmeans.fit_predict(vectors_array)
            
            # 获取质心
            centroids = kmeans.cluster_centers_
            
            # 构建结果（与TypeScript版本兼容的格式）
            result = {
                "centroids": [],
                "iterations": int(kmeans.n_iter_),
                "inertia": float(kmeans.inertia_)
            }
            
            # 为每个质心创建记录
            for i in range(n_clusters):
                # 找出属于这个聚类的所有点
                cluster_points = []
                for j, label in enumerate(cluster_labels):
                    if label == i:
                        cluster_points.append({
                            "id": vector_ids[j],
                            "index": j
                        })
                
                # 添加聚类记录
                result["centroids"].append({
                    "id": i,
                    "vector": centroids[i].tolist(),
                    "points": cluster_points
                })
            
            logger.info(f"K-means聚类完成，找到 {n_clusters} 个聚类，迭代次数: {kmeans.n_iter_}")
            return result
            
        except Exception as e:
            logger.error(f"聚类过程出错: {str(e)}", exc_info=True)
            import traceback
            logger.error(traceback.format_exc())
            return {"error": f"聚类失败: {str(e)}"}

# 创建服务实例
clustering_service = ClusteringService()