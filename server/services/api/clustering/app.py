"""
聚类服务Flask API
作为Python聚类模块的HTTP包装器，避免文件系统交互
"""

from flask import Flask, request, jsonify
import logging
import sys
import os

# 导入聚类功能
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))
from learning_memory.python_direct_clustering import cluster_vectors

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger('clustering_api')

app = Flask(__name__)

@app.route('/api/cluster', methods=['POST'])
def api_cluster():
    """
    聚类API端点
    接收包含ID和向量的JSON数据，返回聚类结果
    """
    try:
        # 获取请求数据
        data = request.json
        
        if not data or not isinstance(data, list):
            logger.error("无效的请求数据格式")
            return jsonify({"error": "无效的请求数据格式，应为包含id和vector的对象数组"}), 400
        
        # 验证数据格式
        for item in data:
            if not isinstance(item, dict) or 'id' not in item or 'vector' not in item:
                logger.error("请求数据格式错误")
                return jsonify({"error": "每个数据项必须包含id和vector字段"}), 400
        
        logger.info(f"收到聚类请求，数据项数量: {len(data)}")
        
        # 调用聚类函数
        result = cluster_vectors(data)
        
        logger.info(f"聚类完成，返回 {len(result.get('centroids', []))} 个聚类")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"处理聚类请求时出错: {e}")
        return jsonify({"error": f"处理请求时出错: {str(e)}"}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """
    健康检查端点
    """
    return jsonify({"status": "healthy"})

if __name__ == '__main__':
    # 获取端口
    port = int(os.environ.get('CLUSTERING_API_PORT', 5001))
    logger.info(f"启动聚类API服务，端口: {port}")
    
    # 启动服务
    app.run(host='0.0.0.0', port=port)