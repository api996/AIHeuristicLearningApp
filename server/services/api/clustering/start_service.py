"""
聚类服务启动脚本
用于启动Flask API服务
"""
import os
import sys
import subprocess
import time
import signal
import logging
import atexit

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# 服务配置
DEFAULT_PORT = 5050
FLASK_APP_PATH = os.path.join(os.path.dirname(__file__), 'app.py')

# 存储进程引用
flask_process = None

def start_service(port=DEFAULT_PORT):
    """
    启动Flask聚类服务
    
    Args:
        port: 服务端口
    
    Returns:
        服务进程
    """
    global flask_process
    
    # 确保旧进程已关闭
    stop_service()
    
    # 检查端口是否可用
    port = int(port)
    
    # 启动Flask应用
    logger.info(f"启动聚类服务API，监听端口: {port}")
    
    env = os.environ.copy()
    env['CLUSTERING_API_PORT'] = str(port)
    
    # 使用subprocess启动服务
    flask_process = subprocess.Popen(
        [sys.executable, FLASK_APP_PATH],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # 注册退出时的清理函数
    atexit.register(stop_service)
    
    # 等待服务启动
    time.sleep(1)
    
    # 检查进程是否成功启动
    if flask_process.poll() is not None:
        # 进程已退出
        stdout, stderr = flask_process.communicate()
        logger.error(f"聚类服务启动失败！\n输出: {stdout}\n错误: {stderr}")
        flask_process = None
        return None
    
    logger.info(f"聚类服务已成功启动，PID: {flask_process.pid}")
    return flask_process

def stop_service():
    """
    停止Flask聚类服务
    """
    global flask_process
    
    if flask_process is not None:
        logger.info(f"正在停止聚类服务 (PID: {flask_process.pid})...")
        
        try:
            # 尝试优雅地关闭进程
            flask_process.terminate()
            
            # 等待进程结束
            try:
                flask_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                # 如果超时，强制关闭
                logger.warning("聚类服务未及时响应终止信号，强制关闭...")
                flask_process.kill()
            
            logger.info("聚类服务已停止")
        except Exception as e:
            logger.error(f"停止聚类服务时出错: {str(e)}")
        
        flask_process = None

def is_service_running():
    """
    检查服务是否正在运行
    
    Returns:
        布尔值，表示服务是否运行
    """
    global flask_process
    
    if flask_process is None:
        return False
    
    # 检查进程是否仍在运行
    return flask_process.poll() is None

# 如果直接运行此脚本，启动服务
if __name__ == '__main__':
    port = os.environ.get('CLUSTERING_API_PORT', DEFAULT_PORT)
    
    try:
        # 启动服务
        proc = start_service(port)
        
        if proc is not None:
            # 保持脚本运行，直到收到中断信号
            try:
                while is_service_running():
                    time.sleep(1)
            except KeyboardInterrupt:
                logger.info("收到中断信号，正在停止服务...")
            finally:
                stop_service()
        else:
            logger.error("服务启动失败，退出脚本")
            sys.exit(1)
    
    except Exception as e:
        logger.error(f"启动服务时出错: {str(e)}")
        sys.exit(1)