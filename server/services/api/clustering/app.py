"""
聚类服务API
提供基于Flask的聚类分析RESTful API
使用优化的clustering_core.py作为核心算法
"""
import os
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

# 导入核心聚类算法
from clustering_core import cluster_vectors, process_large_dataset

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