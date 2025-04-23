#!/usr/bin/env python
"""
测试肘部法则最佳聚类数量确定功能
"""

import os
import sys
import numpy as np
import logging
import asyncio
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.datasets import make_blobs

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('test_optimal_clusters')

def determine_optimal_clusters(vectors):
    """
    使用轮廓系数确定最佳聚类数量 - 从learning_memory_service.py复制的更新函数
    """
    try:
        # 如果样本太少，直接返回小值
        n_samples = len(vectors)
        if n_samples <= 5:
            return max(2, n_samples - 1)  # 至少2个，最多n-1个
            
        # 设置可能的聚类数范围
        max_clusters = min(15, n_samples // 2)  # 不超过样本数的一半且不超过15
        min_clusters = 2  # 至少2个聚类
        
        if max_clusters <= min_clusters:
            return min_clusters
        
        # 计算轮廓系数
        silhouette_scores = []
        distortions = []
        K = range(min_clusters, max_clusters + 1)
        
        # 对于每个可能的k值
        for k in K:
            try:
                kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
                labels = kmeans.fit_predict(vectors)
                distortions.append(kmeans.inertia_)
                
                # 计算轮廓系数
                if k > 1 and n_samples > k:
                    try:
                        silhouette_avg = silhouette_score(vectors, labels)
                        silhouette_scores.append(silhouette_avg)
                        logger.info(f"聚类数 k={k}, 轮廓系数: {silhouette_avg:.3f}")
                    except Exception as e:
                        logger.warning(f"计算轮廓系数时出错 (k={k}): {e}")
                        silhouette_scores.append(-1)  # 错误情况使用无效值
                else:
                    silhouette_scores.append(-1)  # k=1时轮廓系数无意义
            except Exception as e:
                logger.warning(f"k={k} 时K-means聚类失败: {e}")
                silhouette_scores.append(-1)
                distortions.append(float('inf'))
                continue
        
        # 没有得到有效结果时的后备选项
        if not any(score > 0 for score in silhouette_scores):
            logger.warning("无法计算有效的轮廓系数，回退到使用畸变度评估")
            if len(distortions) > 2:
                # 使用肘部法则：通过畸变度的一阶差分变化率确定
                drops = np.diff(distortions) / np.array(distortions[:-1])
                elbow_index = np.argmax(drops) if np.any(drops > 0.5) else 0
                optimal_k = min_clusters + elbow_index
                logger.info(f"根据畸变度变化率确定最佳聚类数: k={optimal_k}")
            else:
                optimal_k = min(5, max(2, n_samples // 10))
                logger.info(f"使用默认聚类数: k={optimal_k}")
            return optimal_k
        
        # 找到轮廓系数最大的k值
        valid_scores = [(i, score) for i, score in enumerate(silhouette_scores) if score > 0]
        if valid_scores:
            best_index, best_score = max(valid_scores, key=lambda x: x[1])
            optimal_k = min_clusters + best_index
            logger.info(f"轮廓系数最大的聚类数: k={optimal_k}, 轮廓系数: {best_score:.3f}")
            
            # 确保结果在有效范围内
            optimal_k = max(min_clusters, min(optimal_k, max_clusters))
            return optimal_k
        else:
            # 兜底策略
            optimal_k = min(5, max(2, n_samples // 10))
            logger.info(f"无有效轮廓系数，使用默认聚类数: k={optimal_k}")
            return optimal_k
            
    except Exception as e:
        logger.error(f"确定最佳聚类数量时出错: {e}")
        # 错误情况下的默认值
        return min(5, max(2, len(vectors) // 10))

def test_with_synthetic_data():
    """测试合成数据集的最佳聚类数确定"""
    logger.info("生成合成数据集进行测试")
    
    test_cases = [
        {"name": "3个明显聚类", "n_samples": 300, "centers": 3, "std": 0.7},
        {"name": "5个明显聚类", "n_samples": 500, "centers": 5, "std": 0.8},
        {"name": "7个明显聚类", "n_samples": 700, "centers": 7, "std": 0.6},
        {"name": "10个明显聚类", "n_samples": 1000, "centers": 10, "std": 0.5},
        {"name": "12个明显聚类", "n_samples": 1200, "centers": 12, "std": 0.5},
        {"name": "不明显聚类", "n_samples": 500, "centers": 6, "std": 2.5},
    ]
    
    for tc in test_cases:
        logger.info(f"测试场景: {tc['name']}")
        
        # 生成测试数据
        X, y = make_blobs(
            n_samples=tc["n_samples"], 
            centers=tc["centers"], 
            cluster_std=tc["std"],
            random_state=42
        )
        
        # 测试最佳聚类数确定
        optimal_k = determine_optimal_clusters(X)
        logger.info(f"实际聚类数: {tc['centers']}, 算法确定的最佳聚类数: {optimal_k}")
        
        # 基本验证
        if abs(optimal_k - tc["centers"]) <= 2:
            logger.info("✅ 测试通过: 确定的聚类数接近实际聚类数")
        else:
            logger.warning("❌ 测试失败: 确定的聚类数与实际聚类数相差较大")
            
        logger.info("=" * 50)

def test_with_high_dimensional_data():
    """测试高维向量的聚类数确定"""
    logger.info("生成高维向量数据进行测试")
    
    # 3072维向量 (Gemini 向量嵌入维度)
    # 4个聚类，每个聚类50个样本，噪声较小
    n_features = 3072
    n_clusters = 4
    n_samples_per_cluster = 50
    
    # 生成高维中心点
    centers = np.random.randn(n_clusters, n_features)
    
    # 为每个中心生成样本
    vectors = []
    for i in range(n_clusters):
        # 生成该聚类的样本，添加少量噪声
        cluster_samples = centers[i] + np.random.randn(n_samples_per_cluster, n_features) * 0.1
        vectors.append(cluster_samples)
    
    # 合并所有样本
    X = np.vstack(vectors)
    
    logger.info(f"生成的高维数据形状: {X.shape}")
    
    # 测试最佳聚类数确定
    optimal_k = determine_optimal_clusters(X)
    logger.info(f"实际聚类数: {n_clusters}, 算法确定的最佳聚类数: {optimal_k}")
    
    # 基本验证
    if abs(optimal_k - n_clusters) <= 1:
        logger.info("✅ 测试通过: 高维数据测试确定的聚类数接近实际聚类数")
    else:
        logger.warning("❌ 测试失败: 高维数据测试确定的聚类数与实际聚类数相差较大")

if __name__ == "__main__":
    # 测试合成数据集
    test_with_synthetic_data()
    
    # 测试高维向量
    test_with_high_dimensional_data()