
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
记忆文件清理脚本
用于检查和修复记忆空间中的JSON文件
"""

import os
import json
import re
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('memory_cleanup')

def is_valid_json(file_path: str) -> bool:
    """检查文件是否包含有效的JSON"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            json.load(f)
        return True
    except json.JSONDecodeError:
        return False
    except Exception as e:
        logger.error(f"检查JSON文件时发生错误: {str(e)}")
        return False

def fix_truncated_json(content: str) -> Dict[str, Any]:
    """尝试修复截断的JSON"""
    # 基本结构检查
    if not content.strip().startswith('{'):
        raise ValueError("内容不是有效的JSON对象")
    
    # 尝试创建有效的JSON结构
    fixed_content = content.strip()
    
    # 确保JSON对象关闭
    if not fixed_content.endswith('}'):
        fixed_content += '}'
    
    # 尝试解析
    try:
        data = json.loads(fixed_content)
        return data
    except json.JSONDecodeError as e:
        # 更复杂的修复尝试
        logger.debug(f"基本修复失败，尝试更深入的修复: {str(e)}")
        
        # 找到最后一个有效的属性
        pattern = r'("[\w_]+"\s*:\s*(?:"[^"]*"|\d+(?:\.\d+)?|true|false|null|\[.*?\]|{.*?}))'
        matches = list(re.finditer(pattern, fixed_content))
        
        if matches:
            # 取最后一个匹配的结束位置
            last_match_end = matches[-1].end()
            truncated_json = fixed_content[:last_match_end] + '}'
            
            try:
                data = json.loads(truncated_json)
                return data
            except json.JSONDecodeError:
                raise ValueError("无法修复JSON结构")
        else:
            raise ValueError("无法识别JSON属性")

def create_minimal_memory(file_path: str) -> Dict[str, Any]:
    """
    创建最小记忆对象，确保基本字段存在
    """
    # 从文件名提取可能的ID
    filename = os.path.basename(file_path)
    file_id = os.path.splitext(filename)[0]
    
    # 创建当前时间戳
    timestamp = datetime.now().isoformat()
    
    # 基础记忆对象
    return {
        "content": "记忆内容恢复失败，这是一个自动创建的占位记忆。",
        "type": "chat",
        "timestamp": timestamp,
        "embedding": [0.0] * 10,  # 创建10个0值的向量
        "summary": "自动恢复的记忆文件。",
        "keywords": ["自动恢复"],
        "id": file_id
    }

def scan_and_fix_memory_files(memory_dir: str, specific_user_id: Optional[str] = None) -> Dict[str, int]:
    """扫描并修复记忆文件
    
    Args:
        memory_dir: 记忆目录路径
        specific_user_id: 可选的特定用户ID，如果提供则只扫描该用户的记忆
    """
    stats = {
        "scanned": 0,
        "valid": 0,
        "fixed": 0,
        "created": 0,
        "failed": 0
    }
    
    if not os.path.exists(memory_dir):
        logger.warning(f"记忆目录不存在: {memory_dir}")
        return stats
    
    # 确定要处理的用户目录列表
    user_dirs = []
    if specific_user_id:
        # 如果指定了用户ID，只处理该用户
        user_path = os.path.join(memory_dir, str(specific_user_id))
        if os.path.isdir(user_path):
            user_dirs = [(str(specific_user_id), user_path)]
        else:
            logger.warning(f"指定的用户目录不存在: {user_path}")
            return stats
    else:
        # 否则遍历所有用户目录
        for user_dir in os.listdir(memory_dir):
            user_path = os.path.join(memory_dir, user_dir)
            if os.path.isdir(user_path):
                user_dirs.append((user_dir, user_path))
    
    logger.info(f"将处理 {len(user_dirs)} 个用户目录")
    
    # 处理每个用户目录
    for user_id, user_path in user_dirs:
        # 确保用户目录存在
        os.makedirs(user_path, exist_ok=True)
        
        # 处理用户目录中的所有文件
        user_files = [f for f in os.listdir(user_path) if f.endswith('.json')]
        logger.info(f"用户 {user_id} 有 {len(user_files)} 个记忆文件")
        
        for filename in user_files:
            file_path = os.path.join(user_path, filename)
            
            # 跳过目录
            if os.path.isdir(file_path):
                continue
                
            stats["scanned"] += 1
            
            # 检查文件是否为有效JSON
            if is_valid_json(file_path):
                stats["valid"] += 1
                continue
                
            logger.info(f"发现无效JSON文件: {file_path}")
            
            try:
                # 尝试读取并修复文件内容
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                try:
                    # 尝试修复JSON
                    fixed_data = fix_truncated_json(content)
                    
                    # 确保必要字段存在
                    required_fields = ["content", "type", "timestamp"]
                    for field in required_fields:
                        if field not in fixed_data:
                            if field == "content":
                                fixed_data[field] = "记忆内容已恢复，但可能不完整。"
                            elif field == "type":
                                fixed_data[field] = "chat"
                            elif field == "timestamp":
                                fixed_data[field] = datetime.now().isoformat()
                    
                    # 添加ID字段（如果不存在）
                    if "id" not in fixed_data:
                        fixed_data["id"] = os.path.splitext(filename)[0]
                    
                    # 保存修复后的文件
                    with open(file_path, 'w', encoding='utf-8') as f:
                        json.dump(fixed_data, f, ensure_ascii=False, indent=2)
                    
                    logger.info(f"成功修复文件: {file_path}")
                    stats["fixed"] += 1
                    
                except ValueError:
                    # 如果无法修复，创建最小记忆对象
                    minimal_memory = create_minimal_memory(file_path)
                    
                    with open(file_path, 'w', encoding='utf-8') as f:
                        json.dump(minimal_memory, f, ensure_ascii=False, indent=2)
                    
                    logger.info(f"使用最小记忆对象替换损坏文件: {file_path}")
                    stats["created"] += 1
                    
            except Exception as e:
                logger.error(f"处理文件 {file_path} 时出错: {str(e)}")
                stats["failed"] += 1
    
    return stats

def main():
    """主函数"""
    import argparse
    
    # 解析命令行参数
    parser = argparse.ArgumentParser(description='记忆文件修复工具')
    parser.add_argument('--memory-dir', default="memory_space", help='记忆文件目录路径')
    parser.add_argument('--user-id', help='指定要处理的用户ID')
    args = parser.parse_args()
    
    memory_dir = args.memory_dir
    user_id = args.user_id
    
    if user_id:
        logger.info(f"开始扫描用户 {user_id} 的记忆目录: {memory_dir}")
    else:
        logger.info(f"开始扫描所有用户的记忆目录: {memory_dir}")
    
    try:
        stats = scan_and_fix_memory_files(memory_dir, user_id)
        
        logger.info(f"记忆文件扫描完成:")
        logger.info(f"  扫描文件: {stats['scanned']}")
        logger.info(f"  有效文件: {stats['valid']}")
        logger.info(f"  已修复: {stats['fixed']}")
        logger.info(f"  已创建: {stats['created']}")
        logger.info(f"  修复失败: {stats['failed']}")
    except Exception as e:
        logger.error(f"记忆文件修复过程中发生错误: {str(e)}")

if __name__ == "__main__":
    main()
