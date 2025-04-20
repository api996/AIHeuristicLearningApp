/**
 * 摘要生成服务模块
 * 负责使用Gemini API生成内容摘要和提取关键词
 */

import { spawn } from 'child_process';
import { SummarizerOptions, SummaryResult } from './types';
import { log } from '../../vite';

/**
 * 使用Gemini API生成文本摘要
 * 
 * @param text 需要摘要的文本内容
 * @param options 摘要选项
 * @returns 摘要结果，包含摘要文本和关键词
 */
export async function summarizeText(
  text: string,
  options: SummarizerOptions = {}
): Promise<SummaryResult> {
  const maxLength = options.maxLength || 150;
  const includeKeywords = options.includeKeywords ?? true;
  
  try {
    log(`[summarizer] 开始生成摘要, 文本长度: ${text.length}`);
    
    // 如果文本很短，直接返回原文作为摘要
    if (text.length <= maxLength) {
      return {
        summary: text,
        keywords: includeKeywords ? extractKeywordsSimple(text) : undefined
      };
    }
    
    // 调用Python服务生成摘要
    const pythonProcess = spawn('python3', ['-c', `
import asyncio
import sys
import json
sys.path.append('server')
from services.learning_memory import learning_memory_service

async def generate_summary():
    # 使用现有服务生成摘要（必须await异步函数）
    summary = await learning_memory_service.generate_content_summary("""${text.replace(/"/g, '\\"')}""")
    keywords = await learning_memory_service.extract_keywords_from_text("""${text.replace(/"/g, '\\"')}""")
    
    # 转换为JSON输出
    result = {
        "summary": summary,
        "keywords": keywords
    }
    print(json.dumps(result, ensure_ascii=False))

asyncio.run(generate_summary())
    `]);
    
    let output = '';
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    return new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          log(`[summarizer] Python进程退出，代码: ${code}`);
          // 如果Python处理失败，使用简单摘要方法作为后备
          resolve({
            summary: generateSummarySimple(text, maxLength),
            keywords: includeKeywords ? extractKeywordsSimple(text) : undefined
          });
        } else {
          try {
            const result = JSON.parse(output.trim());
            log(`[summarizer] 成功生成摘要，长度: ${result.summary.length}`);
            resolve({
              summary: result.summary,
              keywords: result.keywords
            });
          } catch (error) {
            log(`[summarizer] 解析摘要结果失败: ${error}`);
            // 解析失败时使用简单方法
            resolve({
              summary: generateSummarySimple(text, maxLength),
              keywords: includeKeywords ? extractKeywordsSimple(text) : undefined
            });
          }
        }
      });
      
      pythonProcess.stderr.on('data', (data) => {
        log(`[summarizer] Python错误: ${data}`);
      });
      
      pythonProcess.on('error', (error) => {
        log(`[summarizer] 启动Python进程失败: ${error}`);
        // 如果无法启动Python，使用简单方法
        resolve({
          summary: generateSummarySimple(text, maxLength),
          keywords: includeKeywords ? extractKeywordsSimple(text) : undefined
        });
      });
    });
  } catch (error) {
    log(`[summarizer] 生成摘要时遇到错误: ${error}`);
    // 出现任何错误时，使用简单方法作为后备
    return {
      summary: generateSummarySimple(text, maxLength),
      keywords: includeKeywords ? extractKeywordsSimple(text) : undefined
    };
  }
}

/**
 * 生成简单的文本摘要（后备方法）
 * 
 * @param text 原始文本
 * @param maxLength 最大长度
 * @returns 生成的摘要
 */
function generateSummarySimple(text: string, maxLength = 150): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  // 尝试在句号处截断
  const sentences = text.split(/(?<=[.!?])\s+/);
  let summary = '';
  
  for (const sentence of sentences) {
    if ((summary + sentence).length <= maxLength) {
      summary += sentence + ' ';
    } else {
      break;
    }
  }
  
  // 如果没有找到合适的句子截断点，直接截断
  if (!summary) {
    summary = text.substring(0, maxLength) + '...';
  }
  
  return summary.trim();
}

/**
 * 简单提取文本中的关键词（后备方法）
 * 
 * @param text 原始文本
 * @returns 提取的关键词列表
 */
function extractKeywordsSimple(text: string): string[] {
  // 移除常见停用词和标点符号
  const stopwords = new Set([
    '的', '了', '和', '是', '在', '我', '有', '你', '他', '她', '它',
    'the', 'a', 'an', 'and', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to'
  ]);
  
  // 清理文本并分词
  const cleanText = text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
  const words = cleanText.split(/\s+/);
  
  // 提取非停用词并计数
  const wordCount: {[key: string]: number} = {};
  for (const word of words) {
    if (word.length > 1 && !stopwords.has(word)) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
  }
  
  // 按出现频率排序并返回前10个
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(entry => entry[0]);
}

/**
 * 批量生成摘要
 * 
 * @param texts 需要生成摘要的文本列表
 * @param options 摘要选项
 * @returns 摘要结果列表
 */
export async function batchSummarize(
  texts: string[],
  options: SummarizerOptions = {}
): Promise<SummaryResult[]> {
  const promises = texts.map(text => summarizeText(text, options));
  return Promise.all(promises);
}