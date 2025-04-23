"""
聚类服务API
提供基于Flask的聚类分析RESTful API
"""
import os
import json
import logging
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# 创建Flask应用
app = Flask(__name__)
CORS(app)  # 允许跨域请求

def determine_optimal_clusters(vectors, min_clusters=3, max_clusters=40, min_force_clusters=30, force_min_threshold=400):
    """
    使用轮廓系数确定最佳聚类数量，并为大数据集强制使用更多聚类
    
    Args:
        vectors: 向量列表
        min_clusters: 最小聚类数
        max_clusters: 最大聚类数  
        min_force_clusters: 当向量数量超过阈值时的最小聚类数
        force_min_threshold: 强制使用最小聚类数的阈值
        
    Returns:
        最佳聚类数量
    """
    sample_count = len(vectors)
    logger.info(f"确定最佳聚类数 - 样本数量: {sample_count}")
    
    # 对于小数据集使用较少的聚类
    if sample_count < 20:
        best_n_clusters = max(2, min(5, sample_count // 2))
        logger.info(f"样本数量较少 ({sample_count}), 使用少量聚类: {best_n_clusters}")
        return best_n_clusters
        
    # 对于大数据集强制使用更多聚类
    if sample_count >= force_min_threshold:
        # 计算建议的聚类数 - 每50条记忆至少分为一组，但不超过40组
        suggested_clusters = min(max_clusters, max(min_force_clusters, sample_count // 50))
        logger.info(f"样本数量较多 ({sample_count}), 强制使用更多聚类: {suggested_clusters}")
        return suggested_clusters
    
    # 对于中等大小的数据集使用轮廓系数
    max_score = -1
    best_n_clusters = min_clusters
    
    # 限制尝试的聚类数量范围，避免过度计算
    max_attempt = min(max_clusters, sample_count // 5)
    step = max(1, (max_attempt - min_clusters) // 10)  # 动态步长
    
    for n_clusters in range(min_clusters, max_attempt + 1, step):
        if n_clusters >= sample_count:
            break
            
        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        cluster_labels = kmeans.fit_predict(vectors)
        
        # 至少需要2个以上的聚类才能计算轮廓系数
        if len(np.unique(cluster_labels)) > 1:
            score = silhouette_score(vectors, cluster_labels)
            logger.info(f"聚类数 {n_clusters}: 轮廓系数 = {score:.4f}")
            
            if score > max_score:
                max_score = score
                best_n_clusters = n_clusters
    
    logger.info(f"使用最佳聚类数量: {best_n_clusters}")
    return best_n_clusters

def cluster_vectors(memory_vectors, use_optimal_clusters=True):
    """
    使用K-means算法对记忆向量进行聚类
    
    Args:
        memory_vectors: 包含id和向量的记忆列表
        use_optimal_clusters: 是否自动确定最佳聚类数
        
    Returns:
        聚类结果字典，包含中心点和主题
    """
    # 提取向量数据
    vectors = np.array([item['vector'] for item in memory_vectors])
    ids = [item['id'] for item in memory_vectors]
    
    # 确定聚类数量
    if use_optimal_clusters:
        n_clusters = determine_optimal_clusters(vectors)
    else:
        n_clusters = min(5, len(vectors))
    
    # 执行聚类
    kmeans = KMeans(n_clusters=n_clusters, random_state=42)
    labels = kmeans.fit_predict(vectors)
    centroids = kmeans.cluster_centers_
    
    # 组织聚类结果
    clusters = []
    for i in range(n_clusters):
        # 找出属于当前聚类的所有点
        indices = np.where(labels == i)[0]
        points = [{"id": ids[idx]} for idx in indices]
        
        logger.info(f"聚类 {i}: {len(points)} 个记忆")
        
        # 添加聚类信息
        clusters.append({
            "center": centroids[i].tolist(),
            "points": points
        })
    
    # 生成默认主题名称
    topics = [f"主题 {i}" for i in range(n_clusters)]
    
    logger.info(f"输出格式化结果，包含 {n_clusters} 个聚类")
    
    # 返回结果
    return {
        "centroids": clusters,
        "topics": topics
    }

@app.route('/api/cluster', methods=['POST'])
def api_cluster():
    """
    聚类API端点
    
    输入:
        JSON格式的记忆向量列表，每个包含id和vector字段
        
    输出:
        JSON格式的聚类结果，包含中心点和主题
    """
    try:
        data = request.json
        
        if not data or not isinstance(data, list):
            return jsonify({"error": "无效的输入数据，需要记忆向量列表"}), 400
            
        logger.info(f"收到聚类请求，包含 {len(data)} 条记忆")
        
        # 检查输入数据格式
        for item in data:
            if 'id' not in item or 'vector' not in item:
                return jsonify({"error": "每个记忆项需要包含id和vector字段"}), 400
        
        # 执行聚类
        result = cluster_vectors(data)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"聚类过程发生错误: {str(e)}", exc_info=True)
        return jsonify({"error": f"服务器错误: {str(e)}"}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """
    健康检查端点
    """
    return jsonify({"status": "healthy", "service": "clustering-api"})

# 当直接运行此脚本时启动服务器
if __name__ == '__main__':
    port = int(os.environ.get('CLUSTERING_API_PORT', 5050))
    logger.info(f"启动聚类服务API，监听端口: {port}")
    app.run(host='0.0.0.0', port=port, debug=False)