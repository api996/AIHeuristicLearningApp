
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
虚假记忆文件清理脚本
用于删除之前创建的测试/虚假记忆文件，保留真实记忆数据
"""

import os
import json
import logging
from typing import List, Dict, Any, Set
from datetime import datetime

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('memory_cleanup')

def is_fake_memory(content: str) -> bool:
    """
    检查记忆内容是否为自动生成的虚假记忆
    """
    fake_patterns = [
        "这是一个自动创建的占位记忆",
        "记忆内容恢复失败",
        "自动恢复的记忆文件",
        "测试记忆",
        "记忆内容已恢复，但可能不完整"
    ]
    
    for pattern in fake_patterns:
        if pattern in content:
            return True
    
    return False

def delete_fake_memories(memory_dir: str) -> Dict[str, int]:
    """
    删除虚假记忆文件
    
    Args:
        memory_dir: 记忆目录路径
    
    Returns:
        统计信息字典
    """
    stats = {
        "scanned": 0,
        "deleted": 0,
        "preserved": 0,
        "users_processed": 0
    }
    
    if not os.path.exists(memory_dir):
        logger.warning(f"记忆目录不存在: {memory_dir}")
        return stats
    
    # 遍历所有用户目录
    for user_dir in os.listdir(memory_dir):
        user_path = os.path.join(memory_dir, user_dir)
        
        # 跳过非目录文件
        if not os.path.isdir(user_path):
            continue
            
        logger.info(f"处理用户 {user_dir} 的记忆文件...")
        stats["users_processed"] += 1
        
        # 获取所有记忆文件
        memory_files = [f for f in os.listdir(user_path) if f.endswith('.json')]
        
        for filename in memory_files:
            file_path = os.path.join(user_path, filename)
            stats["scanned"] += 1
            
            try:
                # 读取文件内容
                with open(file_path, 'r', encoding='utf-8') as f:
                    try:
                        data = json.load(f)
                        
                        # 检查是否为虚假记忆
                        if "content" in data and is_fake_memory(data["content"]):
                            logger.info(f"删除虚假记忆文件: {file_path}")
                            os.remove(file_path)
                            stats["deleted"] += 1
                        else:
                            stats["preserved"] += 1
                    except json.JSONDecodeError:
                        # JSON解析错误，视为无效文件
                        logger.warning(f"无效的JSON文件，将删除: {file_path}")
                        os.remove(file_path)
                        stats["deleted"] += 1
            except Exception as e:
                logger.error(f"处理文件 {file_path} 时出错: {str(e)}")
    
    return stats

def main():
    """主函数"""
    import argparse
    
    # 解析命令行参数
    parser = argparse.ArgumentParser(description='虚假记忆文件清理工具')
    parser.add_argument('--memory-dir', default="memory_space", help='记忆文件目录路径')
    args = parser.parse_args()
    
    memory_dir = args.memory_dir
    
    logger.info(f"开始清理虚假记忆文件，目录: {memory_dir}")
    
    try:
        stats = delete_fake_memories(memory_dir)
        
        logger.info("清理完成！统计信息:")
        logger.info(f"  处理用户数: {stats['users_processed']}")
        logger.info(f"  扫描文件数: {stats['scanned']}")
        logger.info(f"  删除文件数: {stats['deleted']}")
        logger.info(f"  保留文件数: {stats['preserved']}")
        
    except Exception as e:
        logger.error(f"清理过程中发生错误: {str(e)}")

if __name__ == "__main__":
    main()
