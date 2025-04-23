"""
聚类服务管理器
提供启动、停止和检查聚类服务状态的接口
"""
import os
import sys
import requests
import logging
import time
import random
from typing import Dict, Any, Optional

# 导入启动脚本
from start_service import start_service, stop_service, is_service_running

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# 服务配置
DEFAULT_PORT = 5050
BASE_URL = f"http://localhost:{DEFAULT_PORT}"

class ClusteringServiceManager:
    """聚类服务管理器"""
    
    def __init__(self, port: int = DEFAULT_PORT):
        """
        初始化服务管理器
        
        Args:
            port: 服务端口
        """
        self.port = port
        self.base_url = f"http://localhost:{port}"
        self._ensure_service_running()
    
    def _ensure_service_running(self) -> bool:
        """
        确保服务正在运行
        
        Returns:
            布尔值，表示服务是否成功运行
        """
        # 检查服务是否已经在运行
        if self._check_service_health():
            logger.info("聚类服务已经在运行")
            return True
        
        # 启动服务
        logger.info("聚类服务未运行，正在启动...")
        process = start_service(self.port)
        
        if process is None:
            logger.error("无法启动聚类服务")
            return False
        
        # 等待服务启动
        max_retries = 5
        for i in range(max_retries):
            if self._check_service_health():
                logger.info("聚类服务已成功启动")
                return True
            
            logger.info(f"等待聚类服务启动 ({i+1}/{max_retries})...")
            time.sleep(1)
        
        logger.error(f"聚类服务启动超时，无法连接到 {self.base_url}")
        return False
    
    def _check_service_health(self) -> bool:
        """
        检查服务健康状态
        
        Returns:
            布尔值，表示服务是否健康
        """
        try:
            response = requests.get(f"{self.base_url}/health", timeout=2)
            return response.status_code == 200
        except requests.RequestException:
            return False
    
    def cluster_vectors(self, memory_vectors: list) -> Optional[Dict[str, Any]]:
        """
        执行向量聚类
        
        Args:
            memory_vectors: 包含id和向量的记忆列表
        
        Returns:
            聚类结果字典，如果失败则返回None
        """
        # 确保服务正在运行
        if not self._ensure_service_running():
            logger.error("聚类服务未运行，无法执行聚类")
            return None
        
        # 调用聚类API
        try:
            logger.info(f"发送聚类请求，包含 {len(memory_vectors)} 条记忆...")
            response = requests.post(
                f"{self.base_url}/api/cluster",
                json=memory_vectors,
                timeout=300  # 5分钟超时，聚类可能需要较长时间
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"聚类成功，发现 {len(result['centroids'])} 个聚类")
                return result
            else:
                logger.error(f"聚类请求失败: HTTP {response.status_code} - {response.text}")
                return None
        
        except requests.RequestException as e:
            logger.error(f"聚类请求异常: {str(e)}")
            return None
    
    def shutdown(self) -> None:
        """
        关闭聚类服务
        """
        stop_service()

# 单例模式 - 全局服务管理器实例
_service_manager = None

def get_service_manager(port: int = DEFAULT_PORT) -> ClusteringServiceManager:
    """
    获取服务管理器单例
    
    Args:
        port: 服务端口
    
    Returns:
        ClusteringServiceManager实例
    """
    global _service_manager
    
    if _service_manager is None:
        _service_manager = ClusteringServiceManager(port)
    
    return _service_manager

# 提供直接的聚类函数调用接口
def cluster_vectors(memory_vectors: list) -> Optional[Dict[str, Any]]:
    """
    对记忆向量进行聚类的便捷函数
    
    Args:
        memory_vectors: 包含id和向量的记忆列表
    
    Returns:
        聚类结果字典，如果失败则返回None
    """
    manager = get_service_manager()
    return manager.cluster_vectors(memory_vectors)

# 当应用退出时关闭服务
def shutdown_service() -> None:
    """
    关闭聚类服务
    """
    global _service_manager
    
    if _service_manager is not None:
        logger.info("关闭聚类服务...")
        _service_manager.shutdown()
        _service_manager = None

# 测试函数
def test_clustering_service() -> bool:
    """
    测试聚类服务 - 注意: 此函数不会自动关闭服务
    
    Returns:
        布尔值，表示测试是否成功
    """
    # 创建测试数据
    test_vectors = []
    for i in range(10):
        # 生成随机向量(不使用numpy)
        vector = [random.random() for _ in range(10)]
        test_vectors.append({
            'id': f'test_{i}',
            'vector': vector
        })
    
    # 获取一个专用的服务管理器实例，以避免与其他实例冲突
    test_manager = ClusteringServiceManager(port=DEFAULT_PORT)
    
    # 执行聚类
    result = test_manager.cluster_vectors(test_vectors)
    
    if result is None:
        logger.error("聚类测试失败")
        return False
    
    logger.info(f"聚类测试成功，发现 {len(result['centroids'])} 个聚类")
    return True

# 如果直接运行此脚本，执行测试
if __name__ == '__main__':
    success = test_clustering_service()
    # 明确关闭服务，确保不会与实际应用冲突
    shutdown_service()
    
    if success:
        logger.info("测试成功完成")
        sys.exit(0)
    else:
        logger.error("测试失败")
        sys.exit(1)