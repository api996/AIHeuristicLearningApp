import React, { useEffect, useState } from 'react';
import { preloadGraphData } from '@/lib/unified-graph-preloader';

export default function GraphTest() {
  const [graphData, setGraphData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 从URL参数获取用户ID，默认为6
  const userId = 6;

  useEffect(() => {
    async function loadGraphData() {
      try {
        setIsLoading(true);
        console.log("开始测试加载知识图谱数据...");
        
        const data = await preloadGraphData(userId, 'knowledge');
        console.log("加载到的图谱数据:", data);
        
        setGraphData(data);
      } catch (err) {
        console.error("加载图谱数据失败:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    }

    loadGraphData();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">知识图谱数据测试</h1>
      
      {isLoading ? (
        <div className="text-blue-500">加载中...</div>
      ) : error ? (
        <div className="text-red-500">错误: {error}</div>
      ) : !graphData ? (
        <div className="text-yellow-500">没有获取到数据</div>
      ) : (
        <div>
          <div className="bg-green-100 p-4 rounded mb-4">
            <h2 className="text-xl font-bold text-green-800">成功加载数据!</h2>
            <p>节点数量: {graphData.nodes?.length || 0}</p>
            <p>连接数量: {graphData.links?.length || 0}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-bold mb-2">节点示例:</h3>
              <pre className="bg-gray-100 p-2 rounded overflow-auto max-h-60">
                {JSON.stringify(graphData.nodes?.slice(0, 3), null, 2)}
              </pre>
            </div>
            
            <div>
              <h3 className="text-lg font-bold mb-2">连接示例:</h3>
              <pre className="bg-gray-100 p-2 rounded overflow-auto max-h-60">
                {JSON.stringify(graphData.links?.slice(0, 3), null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}