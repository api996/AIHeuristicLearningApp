#!/usr/bin/env python
"""
聚类API服务启动脚本
"""

import os
import sys
import subprocess
import logging
import signal
import atexit

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger('service_starter')

# 聚类API进程
clustering_process = None

def start_clustering_service():
    """
    启动聚类API服务
    """
    global clustering_process
    
    try:
        # 获取当前脚本的目录
        script_dir = os.path.dirname(os.path.abspath(__file__))
        app_path = os.path.join(script_dir, 'app.py')
        
        # 设置端口（避免与其他服务冲突）
        port = int(os.environ.get('CLUSTERING_API_PORT', 5001))
        os.environ['CLUSTERING_API_PORT'] = str(port)
        
        logger.info(f"启动聚类API服务，端口: {port}, 路径: {app_path}")
        
        # 启动Flask应用 - 添加更多调试信息和错误处理
        try:
            # 确保app.py存在
            if not os.path.exists(app_path):
                logger.error(f"无法找到Flask应用文件: {app_path}")
                return False
                
            # 确保我们使用的Python可以导入所需的依赖
            try:
                import numpy
                import sklearn
                import flask
                logger.info(f"已确认所需依赖存在: numpy={numpy.__version__}, sklearn={sklearn.__version__}, flask={flask.__version__}")
            except ImportError as e:
                logger.error(f"缺少必要的Python依赖: {e}")
                logger.info("正在尝试自动安装缺失的依赖...")
                subprocess.run([sys.executable, "-m", "pip", "install", "numpy", "scikit-learn", "flask"])
                
            # 设置更详细的环境以帮助调试
            env_copy = os.environ.copy()
            env_copy['PYTHONUNBUFFERED'] = '1'  # 确保输出不缓冲
            
            logger.info(f"正在启动Flask应用: {app_path}, Python路径: {sys.executable}")
            
            # 使用subprocess启动Flask应用
            clustering_process = subprocess.Popen(
                [sys.executable, app_path],
                env=env_copy,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True
            )
            
            # 立即读取一小段输出，看看是否有明显错误
            stderr_output = ''
            try:
                stderr_output = clustering_process.stderr.readline()
                if stderr_output:
                    logger.warning(f"Flask应用启动时输出错误: {stderr_output}")
            except:
                pass
                
        except Exception as e:
            logger.error(f"启动Flask应用时发生异常: {str(e)}")
            return False
        
        if clustering_process.poll() is None:
            logger.info(f"聚类API服务已启动，PID: {clustering_process.pid}")
            return True
        else:
            logger.error(f"聚类API服务启动失败，退出码: {clustering_process.returncode}")
            return False
    
    except Exception as e:
        logger.error(f"启动聚类API服务时出错: {e}")
        return False

def stop_clustering_service():
    """
    停止聚类API服务
    """
    global clustering_process
    
    if clustering_process is not None:
        logger.info(f"正在停止聚类API服务，PID: {clustering_process.pid}")
        
        try:
            # 尝试优雅终止
            clustering_process.terminate()
            clustering_process.wait(timeout=5)
            logger.info("聚类API服务已优雅终止")
        except subprocess.TimeoutExpired:
            # 如果超时，强制终止
            logger.warning("聚类API服务未响应终止信号，强制终止")
            clustering_process.kill()
        
        clustering_process = None

def handle_exit():
    """
    处理脚本退出事件
    """
    stop_clustering_service()

# 注册退出处理函数
atexit.register(handle_exit)

# 处理信号
def signal_handler(sig, frame):
    logger.info(f"收到信号 {sig}，正在停止服务")
    stop_clustering_service()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def main():
    """
    主函数
    """
    logger.info("正在启动聚类服务...")
    
    # 启动聚类服务
    success = start_clustering_service()
    
    if success:
        logger.info("聚类服务已成功启动，按Ctrl+C停止")
        
        # 保持主进程运行
        try:
            # 监控子进程，如果异常退出则重启
            while True:
                if clustering_process.poll() is not None:
                    logger.warning(f"聚类服务意外终止，退出码: {clustering_process.returncode}，正在重启...")
                    start_clustering_service()
                
                # 避免CPU占用过高
                import time
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("收到用户中断，正在停止服务")
            stop_clustering_service()
    else:
        logger.error("无法启动聚类服务，退出")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())