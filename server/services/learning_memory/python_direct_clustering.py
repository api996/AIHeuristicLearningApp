#!/usr/bin/env python
"""
独立Python聚类服务
直接接收JSON数据执行聚类并返回结果，不需要JavaScript中间层
"""

import sys
import json
import numpy as np
from sklearn.cluster import KMeans
from pathlib import Path
import logging
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

def determine_optimal_clusters(vectors: np.ndarray) -> int:
    """
    根据向量数量动态确定最佳聚类数量
    不再使用轮廓系数，而是直接根据向量数量和预设规则确定
    
    参数:
        vectors: 向量数据数组
        
    返回:
        int: 最佳聚类数量
    """
    try:
        # 获取样本数量
        n_samples = len(vectors)
        logger.info(f"确定最佳聚类数 - 样本数量: {n_samples}")
        
        # 如果样本太少，直接返回小值
        if n_samples <= 10:
            min_clusters = max(2, n_samples // 2)
            logger.info(f"样本数量较少 ({n_samples}), 使用少量聚类: {min_clusters}")
            return min_clusters
            
        # ===== 新算法: 根据样本数量直接确定聚类数 =====
        
        # 对于大量向量(400+)，强制使用较多的聚类中心
        if n_samples >= 400:
            forced_min_clusters = 30
            logger.info(f"大数据集: 强制使用至少 {forced_min_clusters} 个聚类中心")
            
            # 使用向量数量的1/10作为初始聚类数
            dynamic_clusters = n_samples // 10
            logger.info(f"大数据集: 动态计算的聚类数(1/10): {dynamic_clusters}")
            
            # 取强制最小值和动态计算值的较大者
            initial_clusters = max(forced_min_clusters, dynamic_clusters)
        
        # 对于中等数量向量(100-400)
        elif n_samples >= 100:
            forced_min_clusters = 15
            logger.info(f"中等数据集: 使用至少 {forced_min_clusters} 个聚类中心")
            
            # 使用向量数量的1/8作为初始聚类数
            dynamic_clusters = n_samples // 8
            logger.info(f"中等数据集: 动态计算的聚类数(1/8): {dynamic_clusters}")
            
            # 取强制最小值和动态计算值的较大者
            initial_clusters = max(forced_min_clusters, dynamic_clusters)
        
        # 对于小数据集
        else:
            # 使用向量数量的1/5作为聚类数，但至少8个
            initial_clusters = max(8, n_samples // 5)
            logger.info(f"小数据集: 使用 {initial_clusters} 个聚类中心(1/5, 最小8)")
        
        # 确保聚类数不超过样本数的一半
        max_clusters = n_samples // 2
        if initial_clusters > max_clusters:
            logger.info(f"聚类数 {initial_clusters} 超过样本数一半({max_clusters})，调整为 {max_clusters}")
            initial_clusters = max_clusters
        
        # 设置绝对最小聚类数阈值，确保图谱不会太稀疏
        absolute_min_clusters = 10
        if initial_clusters < absolute_min_clusters and n_samples >= absolute_min_clusters * 2:
            logger.info(f"将聚类数从 {initial_clusters} 调整到最小值 {absolute_min_clusters}")
            initial_clusters = absolute_min_clusters
        
        logger.info(f"最终确定的聚类数: {initial_clusters}")
        return initial_clusters
        
    except Exception as e:
        logger.error(f"确定最佳聚类数出错: {e}")
        # 出错时返回一个合理的默认值，数据量越大聚类数越多
        default_clusters = min(25, max(10, len(vectors) // 20))
        logger.info(f"使用默认聚类数: {default_clusters}")
        return default_clusters

def cluster_vectors(vector_data):
    """
    对向量数据执行聚类
    参数:
        vector_data: 包含id和vector的对象列表
    返回:
        dict: 聚类结果
    """
    try:
        if not vector_data or len(vector_data) < 2:
            # 数据不足，返回空结果
            logger.warning("数据不足，无法执行聚类")
            return {"centroids": []}
        
        # 提取向量和ID
        ids = [item["id"] for item in vector_data]
        vectors = np.array([item["vector"] for item in vector_data])
        
        # 确定最佳聚类数量
        n_clusters = determine_optimal_clusters(vectors)
        logger.info(f"使用最佳聚类数量: {n_clusters}")
        
        # 执行KMeans聚类
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(vectors)
        centers = kmeans.cluster_centers_
        
        # 构建结果
        formatted_result = {}
        for i in range(n_clusters):
            # 找出属于该聚类的所有向量
            cluster_indices = np.where(labels == i)[0]
            cluster_ids = [ids[idx] for idx in cluster_indices]
            
            # 不设置任何预定义主题，让JavaScript层完全基于聚类内容进行智能分析
            # 留空此字段，以便JavaScript层可以识别需要生成主题
            topic_name = ""  # 直接留空，不使用任何占位符
            
            # JavaScript层将通过分析聚类中的实际内容来生成有意义的主题
            # 完全依赖GenAI对聚类向量和记忆内容的理解
            
            # 添加到结果中
            formatted_result[str(i)] = {
                "centroid": centers[i].tolist(), 
                "memory_ids": cluster_ids,
                "topic": topic_name,
                "cluster_id": str(i)
            }
            logger.info(f"聚类 {i}: {len(formatted_result[str(i)]['memory_ids'])} 个记忆")
        
        # 将结果转换为与API兼容的格式
        centroids = []
        for cluster_id, data in formatted_result.items():
            centroids.append({
                "center": data["centroid"],
                "points": [{"id": memory_id} for memory_id in data["memory_ids"]]
            })
        
        # 打印结果结构
        logger.info(f"输出格式化结果，包含 {len(formatted_result)} 个聚类")
        
        return {
            "centroids": centroids,
            "topics": [data["topic"] for data in formatted_result.values()]
        }
        
    except Exception as e:
        logger.error(f"聚类分析出错: {str(e)}")
        return {"centroids": []}

def main():
    """
    主函数，从命令行参数读取数据并执行聚类
    """
    try:
        # 检查参数
        if len(sys.argv) < 3:
            logger.error("使用方法: python python_direct_clustering.py <input_file> <output_file>")
            return 1
        
        input_file = sys.argv[1]
        output_file = sys.argv[2]
        
        # 读取输入文件
        with open(input_file, "r") as f:
            vector_data = json.load(f)
        
        # 执行聚类
        result = cluster_vectors(vector_data)
        
        # 写入结果
        with open(output_file, "w") as f:
            json.dump(result, f)
        
        logger.info(f"聚类完成，结果已写入: {output_file}")
        return 0
        
    except Exception as e:
        logger.error(f"执行聚类时出错: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())