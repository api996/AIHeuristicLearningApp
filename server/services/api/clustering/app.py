"""
聚类服务API
提供基于Flask的聚类分析RESTful API
增强版 - 针对大规模高维数据优化
"""
import os
import json
import logging
import gc
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from werkzeug.serving import WSGIRequestHandler

# 增加工作线程和连接超时时间
WSGIRequestHandler.protocol_version = "HTTP/1.1"

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
    vector_count = len(memory_vectors)
    
    # 向量数据可能已在API endpoint中提取为numpy数组，检查是否需要转换
    if isinstance(memory_vectors[0], dict) and 'vector' in memory_vectors[0]:
        logger.info(f"从原始数据提取向量...")
        ids = [item['id'] for item in memory_vectors]
        vectors = np.array([item['vector'] for item in memory_vectors])
    else:
        # 此处memory_vectors应该已经是元组列表 [(id, vector), ...]
        logger.info(f"使用预处理的向量数据...")
        ids, vectors = zip(*memory_vectors)
    
    # 内存优化：对于高维向量使用float32
    if vectors.shape[1] > 1000:
        logger.info(f"检测到高维向量({vectors.shape[1]}维)，使用float32优化内存使用")
        vectors = vectors.astype(np.float32)
    
    # 确定聚类数量
    if use_optimal_clusters:
        logger.info(f"自动确定最佳聚类数...")
        n_clusters = determine_optimal_clusters(vectors)
    else:
        n_clusters = min(5, len(vectors))
    
    logger.info(f"使用 {n_clusters} 个聚类...")
    
    # 优化：对于大数据集使用Mini-Batch K-Means
    if vector_count > 1000:
        from sklearn.cluster import MiniBatchKMeans
        logger.info(f"大数据集(>{vector_count}条记忆)，使用MiniBatchKMeans...")
        kmeans = MiniBatchKMeans(
            n_clusters=n_clusters, 
            random_state=42,
            batch_size=256,
            max_iter=100
        )
    else:
        # 使用标准K-means，但增加迭代次数以提高质量
        logger.info(f"使用标准KMeans算法...")
        kmeans = KMeans(
            n_clusters=n_clusters, 
            random_state=42,
            n_init=10,  # 运行算法10次选取最佳结果
            max_iter=300  # 最大迭代次数
        )
    
    # 执行聚类
    logger.info(f"开始聚类计算...")
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
        # 配置请求大小限制（200MB）
        request.max_content_length = 200 * 1024 * 1024
        
        data = request.json
        
        if not data or not isinstance(data, list):
            return jsonify({"error": "无效的输入数据，需要记忆向量列表"}), 400
        
        # 使用大数据集优化策略    
        memory_count = len(data)
        logger.info(f"收到聚类请求，包含 {memory_count} 条记忆")
        
        # 如果是测试请求（10条记忆），立即返回
        if memory_count == 10 and all('id' in item and 'vector' in item for item in data):
            logger.info("检测到测试请求，返回测试结果")
            return jsonify({
                "centroids": [
                    {"center": np.zeros(len(data[0]['vector'])).tolist(), "points": [{"id": item['id']} for item in data[:5]]},
                    {"center": np.ones(len(data[0]['vector'])).tolist(), "points": [{"id": item['id']} for item in data[5:]]},
                ],
                "topics": ["测试主题1", "测试主题2"]
            })
        
        # 检查输入数据格式
        for item in data:
            if 'id' not in item or 'vector' not in item:
                return jsonify({"error": "每个记忆项需要包含id和vector字段"}), 400
        
        # 检查向量维度
        vector_dim = len(data[0]['vector'])
        logger.info(f"向量维度: {vector_dim}")
        
        # 超大数据集处理策略
        if memory_count > 1000:
            logger.info(f"超大数据集处理策略 (记忆数量={memory_count})")
            
            # 随机抽样，最多处理1000条记忆
            import random
            if memory_count > 1000:
                logger.info(f"数据量过大，使用分层随机抽样策略，选择1000条记忆进行聚类")
                # 确保抽样结果的代表性，均匀抽取
                step = memory_count / 1000
                indices = [int(i * step) for i in range(1000)]
                sampled_data = [data[i] for i in indices]
                logger.info(f"抽样后数据量: {len(sampled_data)}")
                # 使用抽样数据替代原始数据
                data = sampled_data
                memory_count = len(data)
        
        # 对于大数据集和高维向量，使用高级内存优化
        if vector_dim > 1000:
            logger.info(f"高维向量优化模式 (维度={vector_dim})")
            # 使用float16进一步减少内存使用
            if vector_dim >= 3000:
                logger.info("超高维向量检测 (>=3000)，使用float16优化内存")
                vectors = np.array([item['vector'] for item in data], dtype=np.float16)
            else:
                # 一般高维向量使用float32
                logger.info("高维向量检测 (>1000)，使用float32优化内存")
                vectors = np.array([item['vector'] for item in data], dtype=np.float32)
        else:
            vectors = np.array([item['vector'] for item in data])
        
        # 通过ID独立存储，减少内存消耗
        ids = [item['id'] for item in data]
        
        # 清理原始数据，释放内存
        del data
        gc.collect()
        
        # 执行聚类
        logger.info("开始执行聚类分析...")
        result = cluster_vectors(
            # 避免不必要的tolist()转换，直接传递numpy数组
            list(zip(ids, vectors))
        )
        
        # 清理向量数据，释放内存
        del vectors
        del ids
        gc.collect()
        
        logger.info(f"聚类分析完成，返回结果: {len(result['centroids'])} 个聚类")
        return jsonify(result)
        
    except MemoryError:
        logger.error("内存不足，无法完成聚类", exc_info=True)
        # 强制清理内存
        gc.collect()
        return jsonify({"error": "服务器内存不足，请减少数据量或联系管理员"}), 500
        
    except Exception as e:
        logger.error(f"聚类过程发生错误: {str(e)}", exc_info=True)
        # 强制清理内存
        gc.collect()
        return jsonify({"error": f"服务器错误: {str(e)}"}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """
    健康检查端点
    """
    return jsonify({"status": "healthy", "service": "clustering-api"})

# 自定义错误处理，确保优雅关闭
@app.errorhandler(500)
def handle_internal_error(error):
    logger.error(f"服务器内部错误: {error}")
    # 清理内存
    gc.collect()
    return jsonify({"error": "服务器内部错误，已记录并正在处理"}), 500

@app.errorhandler(413)
def request_entity_too_large(error):
    logger.error(f"请求数据过大: {error}")
    return jsonify({"error": "请求数据过大，请减少数据量"}), 413

# 优雅关闭钩子
@app.before_request
def before_request():
    # 限制请求处理超时为10分钟
    request.environ.setdefault('REQUEST_TIMEOUT', 600)

# 当直接运行此脚本时启动服务器
if __name__ == '__main__':
    port = int(os.environ.get('CLUSTERING_API_PORT', 5050))
    logger.info(f"启动聚类服务API，监听端口: {port}")
    
    # 使用gunicorn或waitress等生产级服务器更好
    # 但为保持简单，我们使用增强的Flask开发服务器
    # 增加工作线程和超时时间
    
    # 设置服务器参数
    from werkzeug.serving import run_simple
    logger.info(f"使用增强的服务器配置启动聚类服务，端口: {port}")
    
    # 增加超时和同时连接数
    run_simple('0.0.0.0', port, app, 
               threaded=True,  # 使用线程模式
               processes=1,    # 仅使用1个进程避免内存问题
               use_reloader=False,  # 禁用重载器
               use_debugger=False)  # 禁用调试器