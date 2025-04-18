/**
 * JSON解析工具函数
 * 用于从文本中提取和解析JSON对象
 */

import { log } from "../vite";

/**
 * 尝试从文本中提取和解析JSON对象
 * 
 * @param text 可能包含JSON的文本
 * @returns 解析后的对象，如果解析失败则返回null
 */
export function parseAsJSON(text: string): any | null {
  if (!text) return null;
  
  try {
    // 首先尝试直接解析整个文本
    return JSON.parse(text);
  } catch (e) {
    // 如果直接解析失败，尝试提取文本中的JSON部分
    try {
      // 查找JSON对象开始和结束标记
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // 查找JSON数组开始和结束标记
      const arrayMatch = text.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        return JSON.parse(arrayMatch[0]);
      }
      
      // 查找包含代码块中的JSON
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        return JSON.parse(codeBlockMatch[1].trim());
      }
      
      log("无法从文本中提取JSON", "json_parser");
      return null;
    } catch (innerError) {
      log(`JSON解析错误: ${innerError}`, "json_parser");
      return null;
    }
  }
}

/**
 * 格式化对象为漂亮的JSON字符串
 * 
 * @param obj 要格式化的对象
 * @returns 格式化的JSON字符串
 */
export function formatJSON(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    log(`JSON格式化错误: ${e}`, "json_parser");
    return String(obj);
  }
}