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