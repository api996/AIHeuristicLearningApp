"""
向量嵌入服务Flask API
作为Python嵌入服务的HTTP包装器，避免命令行调用限制
"""

from flask import Flask, request, jsonify
import logging
import sys
import os
import json
import time
import traceback

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger('embedding_api')

# 导入嵌入服务 - 修改系统路径以便导入
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
sys.path.append(parent_dir)
logger.info(f"添加父目录到系统路径: {parent_dir}")

try:
    from server.services.embedding import EmbeddingService
    logger.info("成功导入嵌入服务类")
except ImportError as e:
    logger.error(f"导入嵌入服务失败: {e}")
    traceback.print_exc()
    sys.exit(1)

# 创建Flask应用
app = Flask(__name__)

# 初始化嵌入服务
embedding_service = EmbeddingService()
logger.info("嵌入服务已初始化")

@app.route('/api/embed', methods=['POST'])
def api_embed():
    """
    文本嵌入API端点
    接收文本内容，返回向量嵌入
    """
    try:
        # 获取请求数据
        data = request.json
        
        if not data or not isinstance(data, dict) or 'text' not in data:
            logger.error("无效的请求数据格式")
            return jsonify({"success": False, "error": "无效的请求数据格式，必须包含text字段"}), 400
        
        text = data['text']
        if not text or not isinstance(text, str) or len(text.strip()) == 0:
            logger.error("无效的文本内容")
            return jsonify({"success": False, "error": "文本内容不能为空"}), 400
            
        logger.info(f"收到嵌入请求，文本长度: {len(text)}")
        
        # 调用嵌入服务生成向量嵌入
        embedding = embedding_service.embed_single_text(text)
        
        if embedding is None:
            logger.error("嵌入生成失败")
            return jsonify({"success": False, "error": "嵌入生成失败"}), 500
        
        # 构造响应
        result = {
            "success": True,
            "embedding": embedding,
            "dimensions": len(embedding)
        }
        
        logger.info(f"嵌入生成成功，维度: {len(embedding)}")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"处理嵌入请求时出错: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/similarity', methods=['POST'])
def api_similarity():
    """
    文本相似度计算API端点
    接收两个文本，返回它们的相似度
    """
    try:
        # 获取请求数据
        data = request.json
        
        if not data or not isinstance(data, dict) or 'text1' not in data or 'text2' not in data:
            logger.error("无效的请求数据格式")
            return jsonify({"success": False, "error": "无效的请求数据格式，必须包含text1和text2字段"}), 400
        
        text1 = data['text1']
        text2 = data['text2']
        
        if not text1 or not text2:
            logger.error("文本内容不能为空")
            return jsonify({"success": False, "error": "文本内容不能为空"}), 400
            
        logger.info(f"收到相似度计算请求，文本1长度: {len(text1)}, 文本2长度: {len(text2)}")
        
        # 调用嵌入服务计算相似度
        similarity = embedding_service.calculate_similarity(text1, text2)
        
        # 构造响应
        result = {
            "success": True,
            "similarity": similarity
        }
        
        logger.info(f"相似度计算成功: {similarity}")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"处理相似度请求时出错: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """
    健康检查端点 - 简化版
    """
    # 只返回服务运行状态，不执行实际API调用
    return jsonify({"status": "healthy", "service": "running"})

if __name__ == '__main__':
    # 获取端口
    port = int(os.environ.get('EMBEDDING_API_PORT', 9003))
    logger.info(f"启动向量嵌入API服务，端口: {port}")
    
    # 启动服务
    app.run(host='0.0.0.0', port=port)