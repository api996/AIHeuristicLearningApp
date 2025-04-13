import os
import json
import re
import sys
from typing import List, Dict, Any

def extract_keywords_simple(text: str) -> List[str]:
    """提供一个简单的关键词提取函数"""
    # 分词并过滤停用词
    words = text.lower().split()
    # 简单的中英文停用词表
    stopwords = {
        "的", "了", "和", "是", "在", "我", "有", "这", "个", "你", "们", "他", "她", "它", 
        "the", "and", "is", "in", "to", "of", "a", "for", "that", "you", "it"
    }
    
    filtered_words = [w for w in words if w not in stopwords and len(w) > 1]
    
    # 取出现频率最高的几个词作为关键词
    word_counts = {}
    for word in filtered_words:
        word_counts[word] = word_counts.get(word, 0) + 1
    
    sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
    keywords = [word for word, _ in sorted_words[:8]]
    
    return keywords

def generate_summary_simple(content: str) -> str:
    """简单地生成内容摘要"""
    if len(content) <= 100:
        return content
    
    # 简单地取前100个字符
    return content[:100] + "..."

def update_memory_files(user_id: int):
    """更新指定用户ID的所有记忆文件，添加缺失字段"""
    memory_dir = "memory_space"
    user_dir = os.path.join(memory_dir, str(user_id))
    
    if not os.path.exists(user_dir):
        print(f"用户目录不存在: {user_dir}")
        return
    
    print(f"正在处理用户 {user_id} 的记忆文件...")
    files = [f for f in os.listdir(user_dir) if f.endswith('.json')]
    print(f"找到 {len(files)} 个记忆文件")
    
    updated_count = 0
    error_count = 0
    
    for filename in files:
        file_path = os.path.join(user_dir, filename)
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                try:
                    memory = json.load(f)
                    content = memory.get("content", "")
                    need_update = False
                    
                    # 添加ID字段（如果没有）
                    if "id" not in memory:
                        memory["id"] = filename.replace(".json", "")
                        need_update = True
                    
                    # 添加summary字段（如果没有）
                    if "summary" not in memory and content:
                        memory["summary"] = generate_summary_simple(content)
                        print(f"为文件 {filename} 添加摘要: {memory['summary'][:30]}...")
                        need_update = True
                    
                    # 添加keywords字段（如果没有）
                    if "keywords" not in memory and content:
                        memory["keywords"] = extract_keywords_simple(content)
                        print(f"为文件 {filename} 添加关键词: {memory['keywords']}")
                        need_update = True
                    
                    # 保存更新后的文件
                    if need_update:
                        with open(file_path, 'w', encoding='utf-8') as f_write:
                            json_str = json.dumps(memory, ensure_ascii=False)
                            f_write.write(json_str)
                        updated_count += 1
                        print(f"已更新文件: {filename}")
                    
                except json.JSONDecodeError as e:
                    print(f"JSON解析错误(文件 {filename}): {str(e)}")
                    error_count += 1
        except Exception as e:
            print(f"处理文件 {filename} 时出错: {str(e)}")
            error_count += 1
    
    print(f"处理完成。已更新 {updated_count} 个文件，{error_count} 个文件处理失败。")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        try:
            user_id = int(sys.argv[1])
            update_memory_files(user_id)
        except ValueError:
            print("错误：用户ID必须是整数")
    else:
        print("用法: python update_memory_files.py <用户ID>")
#!/usr/bin/env python3
"""
记忆文件系统更新工具
用于修复记忆文件格式和数据结构
"""

import os
import json
import sys
import glob

def main():
    """更新记忆文件系统的主函数"""
    print("开始更新记忆文件系统...")
    
    # 获取项目根目录
    project_root = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    memory_dir = os.path.join(project_root, "memory_space")
    
    # 检查记忆目录是否存在
    if not os.path.exists(memory_dir):
        print(f"创建记忆目录: {memory_dir}")
        os.makedirs(memory_dir)
        print("记忆空间已创建，系统准备就绪")
        return
    
    # 获取所有用户目录
    user_dirs = [d for d in os.listdir(memory_dir) 
                if os.path.isdir(os.path.join(memory_dir, d))]
    
    if not user_dirs:
        print("记忆空间中没有用户记录，系统准备就绪")
        return
    
    print(f"找到 {len(user_dirs)} 个用户记忆目录")
    fixed_files = 0
    error_files = 0
    
    # 处理每个用户目录
    for user_dir in user_dirs:
        user_path = os.path.join(memory_dir, user_dir)
        print(f"处理用户 {user_dir} 的记忆文件...")
        
        # 获取所有JSON文件
        json_files = glob.glob(os.path.join(user_path, "*.json"))
        print(f"  发现 {len(json_files)} 个记忆文件")
        
        # 处理每个文件
        for json_file in json_files:
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # 检查文件是否完整
                if not content.strip():
                    print(f"  警告: 文件为空 {os.path.basename(json_file)}")
                    continue
                
                try:
                    # 尝试解析JSON
                    memory = json.loads(content)
                    need_update = False
                    
                    # 确保有ID字段
                    if "id" not in memory:
                        memory["id"] = os.path.basename(json_file).replace(".json", "")
                        need_update = True
                    
                    # 确保有summary字段
                    if "summary" not in memory and "content" in memory:
                        # 简单的摘要生成逻辑
                        text = memory.get("content", "")
                        summary = text[:100] + ("..." if len(text) > 100 else "")
                        memory["summary"] = summary
                        need_update = True
                    
                    # 确保有keywords字段
                    if "keywords" not in memory:
                        memory["keywords"] = []
                        need_update = True
                    
                    # 确保embedding字段格式正确
                    if "embedding" in memory:
                        embedding = memory["embedding"]
                        if not isinstance(embedding, list):
                            print(f"  修复: {os.path.basename(json_file)} 中的embedding不是列表")
                            memory["embedding"] = []
                            need_update = True
                    else:
                        memory["embedding"] = []
                        need_update = True
                    
                    # 如果需要更新，写回文件
                    if need_update:
                        with open(json_file, 'w', encoding='utf-8') as f:
                            json.dump(memory, f, ensure_ascii=False, indent=2)
                        fixed_files += 1
                        print(f"  已修复: {os.path.basename(json_file)}")
                
                except json.JSONDecodeError as e:
                    error_files += 1
                    print(f"  错误: 无法解析JSON {os.path.basename(json_file)} - {str(e)}")
                    
                    # 尝试修复不完整的JSON文件
                    if content.endswith('", "id":'):
                        # 文件被截断，尝试补全
                        filename = os.path.basename(json_file).replace(".json", "")
                        fixed_content = content + f' "{filename}"}}'
                        try:
                            # 验证修复后的内容
                            json.loads(fixed_content)
                            # 写回文件
                            with open(json_file, 'w', encoding='utf-8') as f:
                                f.write(fixed_content)
                            print(f"  已修复不完整的JSON: {os.path.basename(json_file)}")
                            fixed_files += 1
                            error_files -= 1
                        except:
                            print(f"  无法修复不完整的JSON: {os.path.basename(json_file)}")
            
            except Exception as e:
                error_files += 1
                print(f"  处理文件时出错: {os.path.basename(json_file)} - {str(e)}")
    
    print(f"记忆文件系统更新完成:")
    print(f"- 修复了 {fixed_files} 个文件")
    print(f"- 发现 {error_files} 个无法修复的文件")
    print("系统准备就绪")

if __name__ == "__main__":
    main()
