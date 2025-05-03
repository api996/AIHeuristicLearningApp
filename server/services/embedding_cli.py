#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
嵌入向量生成CLI工具 - 简化版
调用Gemini API生成嵌入向量，支持从命令行或文件读取文本
"""

import os
import sys
import json
import argparse
from typing import List, Dict, Any, Optional
import time

try:
    import numpy as np
except ImportError:
    print("错误：numpy 未安装，这个库对于向量操作是必需的")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("警告：dotenv 未安装，将直接从环境变量读取")
    def load_dotenv():
        pass

try:
    import google.generativeai as genai
except ImportError:
    print("严重错误：google.generativeai 未安装")
    sys.exit(1)  # 直接退出，不使用备用实现

# 加载环境变量
load_dotenv()

# 初始化Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print(json.dumps({"success": False, "error": "缺少GEMINI_API_KEY环境变量"}))
    sys.exit(1)

# 配置API密钥
genai.configure(api_key=GEMINI_API_KEY)

def embed_text(text: str) -> List[float]:
    """
    使用Gemini API生成文本的嵌入向量
    """
    if not text or text.strip() == "":
        print(json.dumps({"success": False, "error": "文本为空"}))
        return []
    
    try:
        # 防止过长文本，截断到1000字符
        if len(text) > 1000:
            text = text[:1000]
            
        # 使用模型生成嵌入向量
        model_name = "models/gemini-embedding-exp-03-07"
        result = genai.embed_content(
            model=model_name,
            content=text,
            task_type="retrieval_document"
        )
        
        # 验证结果
        if not isinstance(result, dict) or "embedding" not in result:
            print(json.dumps({"success": False, "error": "API返回格式不正确"}))
            return []
            
        embedding = result["embedding"]
        if not embedding or len(embedding) == 0:
            print(json.dumps({"success": False, "error": "生成的嵌入向量为空"}))
            return []
            
        return embedding
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        return []

def main():
    # 解析命令行参数
    parser = argparse.ArgumentParser(description="生成文本的嵌入向量")
    parser.add_argument("--text", type=str, help="要嵌入的文本")
    parser.add_argument("--file", type=str, help="包含要嵌入文本的文件路径")
    args = parser.parse_args()
    
    # 检查参数有效性
    if not args.text and not args.file:
        print(json.dumps({"success": False, "error": "必须提供--text或--file参数"}))
        return 1
        
    # 获取文本内容
    text = ""
    if args.text:
        text = args.text
    elif args.file:
        try:
            with open(args.file, "r", encoding="utf-8") as f:
                text = f.read()
        except Exception as e:
            print(json.dumps({"success": False, "error": f"读取文件失败: {str(e)}"}))
            return 1
    
    # 生成嵌入向量
    embedding = embed_text(text)
    if not embedding:
        return 1
        
    # 输出结果
    result = {
        "success": True,
        "embedding": embedding,
        "dimensions": len(embedding)
    }
    print(json.dumps(result))
    return 0

if __name__ == "__main__":
    sys.exit(main())
