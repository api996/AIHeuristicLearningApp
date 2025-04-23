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
    优化版本：使用PCA降维和采样减少计算量
    
    Args:
        vectors: 向量列表
        min_clusters: 最小聚类数
        max_clusters: 最大聚类数  
        min_force_clusters: 当向量数量超过阈值时的最小聚类数
        force_min_threshold: 强制使用最小聚类数的阈值
        
    Returns:
        最佳聚类数量
    """
    from sklearn.decomposition import PCA
    
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
    
    # 对于中等大小的数据集，或高维数据使用PCA降维和轮廓系数
    vector_dimension = len(vectors[0])
    
    # 如果向量维度过高，使用PCA降维
    reduced_vectors = vectors
    if vector_dimension > 100:
        # 降维到100维，保留主要信息
        logger.info(f"向量维度较高 ({vector_dimension}), 使用PCA降维到100维")
        pca = PCA(n_components=100)
        reduced_vectors = pca.fit_transform(vectors)
    
    # 如果样本数量过多，使用采样减少计算量
    sample_vectors = reduced_vectors
    max_sample_size = 1000  # 最大样本数量
    if sample_count > max_sample_size:
        logger.info(f"样本数量过多 ({sample_count}), 采样 {max_sample_size} 条用于评估")
        # 使用等间距采样而不是随机采样，保持数据分布
        indices = np.linspace(0, sample_count-1, max_sample_size, dtype=int)
        sample_vectors = np.array([reduced_vectors[i] for i in indices])
    
    # 使用轮廓系数确定最佳聚类数量
    max_score = -1
    best_n_clusters = min_clusters
    
    # 自适应步长，根据数据量调整尝试的聚类数
    max_attempt = min(max_clusters, sample_count // 5)
    step = max(1, (max_attempt - min_clusters) // 10)  # 动态步长
    
    for n_clusters in range(min_clusters, max_attempt + 1, step):
        if n_clusters >= len(sample_vectors):
            break
            
        # 使用更高效的MiniBatchKMeans进行大数据集聚类
        if len(sample_vectors) > 10000:
            from sklearn.cluster import MiniBatchKMeans
            kmeans = MiniBatchKMeans(n_clusters=n_clusters, 
                                     random_state=42, 
                                     batch_size=1000)
        else:
            kmeans = KMeans(n_clusters=n_clusters, 
                            random_state=42,
                            n_init=10)  # 减少初始化次数
            
        cluster_labels = kmeans.fit_predict(sample_vectors)
        
        # 至少需要2个以上的聚类才能计算轮廓系数
        unique_labels = np.unique(cluster_labels)
        if len(unique_labels) > 1:
            try:
                # 对于非常大的数据集，使用采样计算轮廓系数
                if len(sample_vectors) > 5000:
                    # 从每个聚类中抽取样本计算轮廓系数
                    sample_indices = []
                    for label in unique_labels:
                        label_indices = np.where(cluster_labels == label)[0]
                        # 每个聚类最多取100个样本
                        n_samples = min(100, len(label_indices))
                        if n_samples > 0:
                            sample_idx = np.random.choice(label_indices, n_samples, replace=False)
                            sample_indices.extend(sample_idx)
                    
                    if len(sample_indices) >= 2:
                        score = silhouette_score(
                            sample_vectors[sample_indices], 
                            cluster_labels[sample_indices]
                        )
                else:
                    score = silhouette_score(sample_vectors, cluster_labels)
                
                logger.info(f"聚类数 {n_clusters}: 轮廓系数 = {score:.4f}")
                
                if score > max_score:
                    max_score = score
                    best_n_clusters = n_clusters
            except Exception as e:
                logger.warning(f"计算轮廓系数时出错 (n_clusters={n_clusters}): {str(e)}")
                continue
    
    # 如果轮廓分析失败，使用经验公式
    if best_n_clusters == min_clusters and max_score == -1:
        best_n_clusters = min(30, max(5, int(np.sqrt(sample_count / 2))))
        logger.warning(f"轮廓分析失败，使用经验公式确定聚类数: {best_n_clusters}")
    
    logger.info(f"使用最佳聚类数量: {best_n_clusters}")
    return best_n_clusters

def cluster_vectors(memory_vectors, use_optimal_clusters=True):
    """
    使用K-means算法对记忆向量进行聚类 - 优化版本
    
    Args:
        memory_vectors: 包含id和向量的记忆列表
        use_optimal_clusters: 是否自动确定最佳聚类数
        
    Returns:
        聚类结果字典，包含中心点和主题
    """
    try:
        # 提取向量数据
        vectors = np.array([item['vector'] for item in memory_vectors])
        ids = [item['id'] for item in memory_vectors]
        
        vector_count = len(vectors)
        vector_dim = len(vectors[0]) if vector_count > 0 else 0
        logger.info(f"处理聚类请求 - 向量数量: {vector_count}, 维度: {vector_dim}")
        
        # 数据验证
        if vector_count == 0:
            logger.warning("没有有效的向量数据，返回空结果")
            return {
                "centroids": [],
                "topics": []
            }
        
        # 确定聚类数量
        if use_optimal_clusters:
            n_clusters = determine_optimal_clusters(vectors)
        else:
            n_clusters = min(5, len(vectors))
        
        # 为大数据集选择更高效的聚类算法
        if vector_count > 10000:
            from sklearn.cluster import MiniBatchKMeans
            logger.info(f"使用MiniBatchKMeans进行大规模聚类 (n={vector_count})")
            kmeans = MiniBatchKMeans(
                n_clusters=n_clusters, 
                random_state=42,
                batch_size=1000,
                max_iter=100
            )
        else:
            # 使用标准KMeans但优化参数
            logger.info(f"使用标准KMeans进行聚类 (n={vector_count})")
            kmeans = KMeans(
                n_clusters=n_clusters, 
                random_state=42,
                n_init=10,  # 减少初始化次数
                algorithm='elkan'  # 对于密集数据更快
            )
        
        # 执行聚类
        labels = kmeans.fit_predict(vectors)
        centroids = kmeans.cluster_centers_
        
        # 组织聚类结果
        clusters = []
        for i in range(n_clusters):
            # 找出属于当前聚类的所有点
            indices = np.where(labels == i)[0]
            points = [{"id": ids[idx]} for idx in indices]
            
            # 如果聚类为空，跳过（理论上不应该发生，但为了稳健性）
            if len(points) == 0:
                logger.warning(f"聚类 {i} 没有包含任何点，跳过")
                continue
                
            logger.info(f"聚类 {i}: {len(points)} 个记忆 ({len(points)/vector_count*100:.1f}%)")
            
            # 添加聚类信息
            clusters.append({
                "center": centroids[i].tolist(),
                "points": points
            })
        
        # 生成默认主题名称
        topics = [f"主题 {i}" for i in range(len(clusters))]
        
        logger.info(f"完成聚类，输出 {len(clusters)} 个有效聚类")
        
        # 返回结果
        return {
            "centroids": clusters,
            "topics": topics
        }
        
    except Exception as e:
        logger.error(f"聚类过程发生异常: {str(e)}", exc_info=True)
        # 尝试使用更简单的方法重试
        try:
            logger.info("尝试使用备用聚类方法...")
            
            # 简化版聚类，避免异常情况
            vectors = np.array([item['vector'] for item in memory_vectors])
            ids = [item['id'] for item in memory_vectors]
            
            # 使用固定聚类数
            n_clusters = min(5, len(vectors))
            kmeans = KMeans(n_clusters=n_clusters)
            labels = kmeans.fit_predict(vectors)
            
            # 构建结果
            clusters = []
            for i in range(n_clusters):
                indices = np.where(labels == i)[0]
                points = [{"id": ids[idx]} for idx in indices]
                
                if len(points) > 0:
                    clusters.append({
                        "center": kmeans.cluster_centers_[i].tolist(),
                        "points": points
                    })
            
            topics = [f"备用主题 {i}" for i in range(len(clusters))]
            
            logger.info(f"备用聚类方法成功，生成 {len(clusters)} 个聚类")
            return {
                "centroids": clusters,
                "topics": topics
            }
            
        except Exception as e2:
            logger.error(f"备用聚类方法也失败: {str(e2)}", exc_info=True)
            # 返回错误状态
            raise Exception(f"聚类算法错误: {str(e)}, 备用方法错误: {str(e2)}")

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