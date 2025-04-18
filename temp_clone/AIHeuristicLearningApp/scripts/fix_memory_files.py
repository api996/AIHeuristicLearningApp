
#!/usr/bin/env python3
"""
修复内存文件脚本
用于扫描和修复memory_space目录中可能存在的损坏或不完整的记忆文件
"""

import os
import json
import sys
import re
from datetime import datetime

def is_valid_json(file_path):
    """检查文件是否包含有效的JSON"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            if not content:
                return False, "文件为空"
            json.loads(content)
            return True, "JSON有效"
    except json.JSONDecodeError as e:
        return False, f"JSON解析错误: {str(e)}"
    except Exception as e:
        return False, f"读取错误: {str(e)}"

def fix_truncated_json(content):
    """尝试修复截断的JSON"""
    # 检查是否是典型的截断JSON（缺少结束括号）
    if content.count('{') > content.count('}'):
        missing_braces = content.count('{') - content.count('}')
        return content + ('}' * missing_braces)
    return content

def scan_and_fix_memory_files(memory_dir):
    """扫描并修复记忆文件"""
    print(f"开始扫描记忆目录: {memory_dir}")
    
    if not os.path.exists(memory_dir):
        print(f"记忆目录不存在: {memory_dir}")
        return
    
    total_files = 0
    fixed_files = 0
    problematic_files = 0
    
    # 遍历所有用户目录
    for user_id in os.listdir(memory_dir):
        user_dir = os.path.join(memory_dir, user_id)
        if not os.path.isdir(user_dir):
            continue
            
        print(f"\n检查用户 {user_id} 的记忆文件...")
        
        # 扫描该用户的所有记忆文件
        for filename in os.listdir(user_dir):
            if not filename.endswith('.json'):
                continue
                
            total_files += 1
            file_path = os.path.join(user_dir, filename)
            
            # 检查文件是否有效
            is_valid, error_msg = is_valid_json(file_path)
            
            if not is_valid:
                problematic_files += 1
                print(f"问题文件 {filename}: {error_msg}")
                
                # 尝试修复文件
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read().strip()
                    
                    # 如果文件为空，创建一个基本的记忆结构
                    if not content:
                        content = '{"content": "这是一个修复后的记忆文件", "type": "restored", "timestamp": "' + datetime.now().isoformat() + '"}'
                    else:
                        # 尝试修复截断的JSON
                        fixed_content = fix_truncated_json(content)
                        
                        # 尝试验证修复后的内容
                        try:
                            json.loads(fixed_content)
                            content = fixed_content
                            print(f"成功修复JSON结构: {filename}")
                        except json.JSONDecodeError:
                            # 如果还是无法修复，尝试匹配部分JSON
                            json_match = re.search(r'(\{[^}]*\})', content)
                            if json_match:
                                partial_json = json_match.group(1)
                                try:
                                    # 验证提取的JSON是否有效
                                    json.loads(partial_json)
                                    content = partial_json
                                    print(f"提取了部分有效JSON: {filename}")
                                except:
                                    # 如果还是无效，创建一个基本结构
                                    content = '{"content": "这是一个从损坏文件中恢复的记忆", "type": "restored", "timestamp": "' + datetime.now().isoformat() + '"}'
                                    print(f"无法修复，创建基本结构: {filename}")
                            else:
                                # 创建基本结构
                                content = '{"content": "这是一个从损坏文件中恢复的记忆", "type": "restored", "timestamp": "' + datetime.now().isoformat() + '"}'
                                print(f"无法修复，创建基本结构: {filename}")
                    
                    # 备份原文件
                    backup_path = file_path + '.bak'
                    os.rename(file_path, backup_path)
                    
                    # 写入修复后的内容
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                        
                    fixed_files += 1
                    print(f"已修复并备份文件: {filename}")
                    
                except Exception as e:
                    print(f"修复文件 {filename} 时出错: {str(e)}")
    
    print(f"\n扫描完成: 总文件数: {total_files}, 修复文件数: {fixed_files}, 有问题文件数: {problematic_files}")

if __name__ == "__main__":
    # 获取项目根目录
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    memory_dir = os.path.join(project_root, "memory_space")
    
    print(f"记忆目录设置为: {memory_dir}")
    scan_and_fix_memory_files(memory_dir)
#!/usr/bin/env python3
"""
记忆文件修复脚本
用于检查和修复记忆空间中的JSON文件
"""

import os
import json
import re
import sys

def fix_memory_files(memory_dir='memory_space'):
    """
    检查和修复记忆空间中的JSON文件
    
    Args:
        memory_dir: 记忆空间目录
    """
    print(f"开始检查记忆文件，目录: {memory_dir}")
    
    # 检查记忆目录是否存在
    if not os.path.exists(memory_dir):
        print(f"错误: 记忆目录不存在: {memory_dir}")
        return
    
    # 统计信息
    stats = {
        'total_files': 0,
        'error_files': 0,
        'fixed_files': 0,
        'skipped_files': 0,
    }
    
    # 遍历用户目录
    for user_dir in os.listdir(memory_dir):
        user_path = os.path.join(memory_dir, user_dir)
        
        # 跳过非目录文件
        if not os.path.isdir(user_path):
            continue
            
        print(f"检查用户 {user_dir} 的记忆文件")
        
        # 遍历记忆文件
        for filename in os.listdir(user_path):
            if not filename.endswith('.json'):
                continue
                
            file_path = os.path.join(user_path, filename)
            stats['total_files'] += 1
            
            try:
                # 读取文件内容
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # 尝试解析JSON
                try:
                    memory_data = json.loads(content)
                    # 检查必要字段
                    required_fields = ['content', 'type', 'embedding']
                    missing_fields = [field for field in required_fields if field not in memory_data]
                    
                    if missing_fields:
                        print(f"文件 {file_path} 缺少必要字段: {missing_fields}")
                        stats['error_files'] += 1
                        # 如果只缺少embedding字段，添加空向量
                        if missing_fields == ['embedding']:
                            memory_data['embedding'] = [0.0] * 10  # 添加小的占位向量
                            with open(file_path, 'w', encoding='utf-8') as f:
                                json.dump(memory_data, f, ensure_ascii=False)
                            print(f"已修复文件 {file_path}")
                            stats['fixed_files'] += 1
                    else:
                        # 检查embedding字段是否为空或损坏
                        embedding = memory_data.get('embedding', [])
                        if not embedding or (isinstance(embedding, list) and len(embedding) < 10):
                            print(f"文件 {file_path} 的embedding字段异常")
                            stats['error_files'] += 1
                            # 添加默认向量
                            memory_data['embedding'] = [0.0] * 10
                            with open(file_path, 'w', encoding='utf-8') as f:
                                json.dump(memory_data, f, ensure_ascii=False)
                            print(f"已修复文件 {file_path} 的embedding字段")
                            stats['fixed_files'] += 1
                            
                except json.JSONDecodeError as e:
                    print(f"文件 {file_path} 不是有效的JSON: {str(e)}")
                    stats['error_files'] += 1
                    
                    # 尝试修复JSON格式
                    if len(content) > 0:
                        # 简单尝试：找到最后一个完整的JSON对象
                        match = re.search(r'(\{[^{]*\})', content)
                        if match:
                            fixed_json = match.group(1)
                            try:
                                # 验证修复后的JSON是否有效
                                test_data = json.loads(fixed_json)
                                # 写回文件
                                with open(file_path, 'w', encoding='utf-8') as f:
                                    f.write(fixed_json)
                                print(f"已修复文件 {file_path} 的JSON格式")
                                stats['fixed_files'] += 1
                            except:
                                print(f"无法修复文件 {file_path}")
                    
            except Exception as e:
                print(f"处理文件 {file_path} 时发生错误: {str(e)}")
                stats['error_files'] += 1
    
    # 打印统计信息
    print("\n修复完成，统计信息:")
    print(f"总文件数: {stats['total_files']}")
    print(f"错误文件数: {stats['error_files']}")
    print(f"修复文件数: {stats['fixed_files']}")
    print(f"跳过文件数: {stats['skipped_files']}")

if __name__ == "__main__":
    # 可以指定记忆目录或使用默认值
    memory_dir = sys.argv[1] if len(sys.argv) > 1 else 'memory_space'
    fix_memory_files(memory_dir)
