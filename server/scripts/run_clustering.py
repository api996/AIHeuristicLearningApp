#!/usr/bin/env python
"""
高维向量聚类命令行工具
此脚本接受JSON格式的向量数据作为输入，执行K-means聚类，并输出结果
"""

import sys
import json
import traceback

# 添加项目根目录到Python路径，确保可以导入模块
sys.path.append('.')
sys.path.append('./server')

def main():
    """主函数：读取输入JSON、执行聚类、输出结果JSON"""
    # 检查参数
    if len(sys.argv) != 3:
        print(json.dumps({"error": "用法: python run_clustering.py <input_file> <output_file>"}))
        sys.exit(1)
        
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    try:
        # 从文件读取向量数据
        with open(input_file, 'r', encoding='utf-8') as f:
            input_data = json.load(f)
            
        # 确保输入是包含id和vector的对象数组
        if not isinstance(input_data, list) or not all('id' in item and 'vector' in item for item in input_data):
            raise ValueError("输入数据必须是包含'id'和'vector'字段的对象数组")

        # 导入聚类服务
        try:
            from services.clustering import clustering_service
            
            # 直接执行聚类，无需异步
            result = clustering_service.cluster_vectors(input_data, use_cosine_distance=True)
            
            # 将结果写入输出文件
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
                
            # 成功完成
            print(f"聚类完成，结果已写入: {output_file}")
            sys.exit(0)
            
        except ImportError as e:
            error_result = {
                "error": f"导入聚类服务失败: {str(e)}",
                "traceback": traceback.format_exc()
            }
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(error_result, f, ensure_ascii=False, indent=2)
            print(f"导入错误: {str(e)}")
            sys.exit(1)
            
    except Exception as e:
        # 处理任何异常
        error_result = {
            "error": f"聚类过程出错: {str(e)}",
            "traceback": traceback.format_exc()
        }
        
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(error_result, f, ensure_ascii=False, indent=2)
        except:
            print(json.dumps(error_result))
            
        print(f"执行错误: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()