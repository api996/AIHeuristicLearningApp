"""
学习记忆分析服务
负责聚类分析与轨迹生成
"""

import asyncio
import json
import logging
import re

# 配置日志格式
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('learning_memory_service')

async def analyze_learning_path(user_id):
    """
    分析用户的学习轨迹
    
    参数:
        user_id: 用户ID
    
    返回:
        dict: 包含学习轨迹分析结果的字典
    """
    try:
        logger.info(f"开始分析用户 {user_id} 的学习轨迹")
        
        # 简单的后备实现，实际上轨迹分析会回退到JS实现
        # 这个文件仅用于确保import不会失败
        return {
            "topics": [],
            "progress": [],
            "suggestions": [
                "继续添加更多学习内容以生成个性化学习轨迹",
                "需要至少5条记忆数据才能进行有效的主题聚类分析"
            ],
            "knowledge_graph": {
                "nodes": [],
                "links": []
            }
        }
    except Exception as e:
        logger.error(f"分析学习轨迹时出错: {e}")
        raise

async def generate_content_summary(content):
    """
    为内容生成摘要
    
    参数:
        content: 需要总结的文本内容
    
    返回:
        str: 生成的摘要文本
    """
    try:
        logger.info(f"生成内容摘要，文本长度: {len(content)}")
        
        # 如果内容太短，直接返回原文
        if len(content) < 50:
            return content
        
        # 简单的摘要生成方法：取第一句话，如果它足够短的话
        # 否则截取前50个字符
        first_sentence_match = re.search(r'^([^.!?。！？]+[.!?。！？])', content)
        if first_sentence_match:
            first_sentence = first_sentence_match.group(1)
            if len(first_sentence) <= 100:
                return first_sentence
        
        # 如果没有找到第一句话或者第一句话太长，截取开头
        return content[:50] + ('...' if len(content) > 50 else '')
    except Exception as e:
        logger.error(f"生成内容摘要时出错: {e}")
        return content[:50] + ('...' if len(content) > 50 else '')

async def extract_keywords(content):
    """
    从内容中提取关键词
    
    参数:
        content: 需要提取关键词的文本内容
    
    返回:
        list: 关键词列表
    """
    try:
        logger.info(f"提取关键词，文本长度: {len(content)}")
        
        # 这里只是一个简单示例实现，实际应用中应该使用NLP库
        common_words = {'的', '是', '在', '了', '和', '有', '与', '又', '也', 
                        'the', 'is', 'a', 'an', 'of', 'to', 'in', 'for', 'with'}
        
        # 分词 - 中文按字符，英文按空格
        chinese_words = re.findall(r'[\u4e00-\u9fa5]{2,6}', content)
        english_words = re.findall(r'[a-zA-Z]{3,15}', content)
        
        # 过滤常用词和短单词
        filtered_words = [word for word in chinese_words + english_words 
                         if word.lower() not in common_words and len(word) >= 2]
        
        # 计算频率
        word_freq = {}
        for word in filtered_words:
            word_freq[word] = word_freq.get(word, 0) + 1
        
        # 取频率最高的8个关键词
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        keywords = [word for word, freq in sorted_words[:8]]
        
        return keywords if keywords else ["未知主题"]
    except Exception as e:
        logger.error(f"提取关键词时出错: {e}")
        return ["未知主题"]

# 为了兼容性添加此别名函数
async def extract_keywords_from_text(content):
    """
    从文本中提取关键词（extract_keywords的别名函数）
    
    参数:
        content: 需要提取关键词的文本内容
    
    返回:
        list: 关键词列表
    """
    return await extract_keywords(content)