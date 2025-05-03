#!/usr/bin/env python3
"""
直接嵌入脚本 - 读取文本文件，生成嵌入，将结果写入JSON文件
"""

import sys
import os
import json
import traceback

# 添加父目录到系统路径
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
sys.path.append(parent_dir)

# 导入嵌入服务
try:
    from services.embedding import EmbeddingService
    print(f"成功导入嵌入服务类")
    embedding_service = EmbeddingService()
    
    # 检查命令行参数
    if len(sys.argv) != 3:
        print("错误: 需要两个参数: 输入文件路径和输出文件路径")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    # 检查文件是否存在
    if not os.path.exists(input_file):
        print(f"错误: 找不到输入文件 {input_file}")
        sys.exit(1)
    
    # 读取文本内容
    with open(input_file, 'r', encoding='utf-8') as f:
        text = f.read()
    
    print(f"读取文本成功，长度: {len(text)}")
    
    # 生成嵌入
    print(f"开始生成嵌入...")
    embedding = embedding_service.embed_single_text(text)
    
    # 检查嵌入是否为None
    if embedding is None:
        raise ValueError("嵌入生成失败，返回了None")
    
    dimensions = len(embedding)
    
    # 将结果写入输出文件
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            "success": True,
            "embedding": embedding,
            "dimensions": dimensions
        }, f)
    
    print(f"嵌入生成成功，维度: {dimensions}")
    sys.exit(0)
    
except Exception as e:
    traceback.print_exc()
    
    # 写入错误信息到输出文件
    try:
        with open(sys.argv[2], 'w', encoding='utf-8') as f:
            json.dump({
                "success": False,
                "error": str(e)
            }, f)
    except:
        pass
    
    print(f"错误: {e}")
    sys.exit(1)