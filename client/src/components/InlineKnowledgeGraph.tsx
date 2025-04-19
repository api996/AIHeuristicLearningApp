import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { X, RefreshCw } from "lucide-react";
import StaticKnowledgeGraph from "./StaticKnowledgeGraph";
import { preloadKnowledgeGraphData, getKnowledgeGraphData, clearKnowledgeGraphCache } from '@/lib/knowledge-graph-preloader';

interface KnowledgeNode {
  id: string;
  label: string;
  size: number;
  category?: string;
  clusterId?: string;
  color?: string;
}

interface KnowledgeLink {
  source: string;
  target: string;
  value: number;
  type?: string;
}

interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  links: KnowledgeLink[];
  version?: number;
}

interface InlineKnowledgeGraphProps {
  userId: number;
  isVisible: boolean;
  onClose: () => void;
}

/**
 * 内嵌全屏知识图谱组件
 * 简化设计，直接嵌入到学习轨迹页面
 */
const InlineKnowledgeGraph: React.FC<InlineKnowledgeGraphProps> = ({
  userId,
  isVisible,
  onClose
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<KnowledgeGraph | null>(null);
  
  // 加载知识图谱数据
  useEffect(() => {
    if (!isVisible) return;
    
    async function loadGraphData() {
      try {
        setIsLoading(true);
        setError(null);
        
        // 先尝试从缓存获取数据
        try {
          const data = await getKnowledgeGraphData(userId);
          if (data && Array.isArray(data.nodes)) {
            console.log('从缓存加载知识图谱数据:', data.nodes.length, '个节点');
            setGraphData(data);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('无法获取缓存数据:', e);
        }
        
        // 如果缓存不可用，从API获取
        const response = await fetch(`/api/learning-path/${userId}/knowledge-graph`);
        if (!response.ok) {
          throw new Error(`获取失败: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('获取到知识图谱数据:', data.nodes.length, '个节点');
        
        // 更新状态和缓存
        setGraphData(data);
        await preloadKnowledgeGraphData(userId);
        
      } catch (err) {
        console.error('加载知识图谱失败:', err);
        setError('无法加载知识图谱数据');
      } finally {
        setIsLoading(false);
      }
    }
    
    loadGraphData();
  }, [userId, isVisible]);
  
  // 刷新图谱数据
  const handleRefresh = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 清除缓存
      clearKnowledgeGraphCache(userId);
      
      // 从API获取新数据
      const response = await fetch(`/api/learning-path/${userId}/knowledge-graph`, {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`获取失败: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('刷新成功:', data.nodes.length, '个节点');
      
      // 更新状态和缓存
      setGraphData(data);
      await preloadKnowledgeGraphData(userId);
      
    } catch (err) {
      console.error('刷新知识图谱失败:', err);
      setError('刷新数据失败');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 如果不可见，不渲染任何内容
  if (!isVisible) return null;
  
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-gray-900 to-gray-950 text-white overflow-hidden">
      {/* 顶部导航 */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-center bg-gradient-to-b from-gray-900/80 to-transparent">
        <div className="flex items-center">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={onClose}
            className="text-white border-gray-700 hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </Button>
          <h1 className="ml-2 text-xl font-bold">知识连接图谱</h1>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh} 
          disabled={isLoading}
          className="bg-gray-800/70 text-white border-gray-700 hover:bg-gray-700"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>
      
      {/* 内容区域 */}
      <div className="w-full h-full pt-16">
        {isLoading ? (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-lg text-blue-400">加载知识图谱中...</p>
          </div>
        ) : error ? (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <p className="text-red-500 mb-2">{error}</p>
            <Button variant="outline" onClick={handleRefresh} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              重试
            </Button>
          </div>
        ) : graphData && graphData.nodes.length > 0 ? (
          <div className="w-full h-full">
            <StaticKnowledgeGraph
              nodes={graphData.nodes}
              links={graphData.links}
              width={window.innerWidth}
              height={window.innerHeight - 64}
              onNodeClick={(nodeId) => {
                const node = graphData.nodes.find(n => n.id === nodeId);
                if (node) {
                  console.log(`点击了节点: ${node.label || nodeId}`);
                  
                  // 提供节点类型和标签的弹窗
                  const nodeType = node.category === 'cluster' ? '主题' : 
                                 node.category === 'keyword' ? '关键词' : '记忆';
                  alert(`${nodeType}: ${node.label}`);
                }
              }}
            />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <p className="text-gray-400 mb-2">暂无足够数据生成知识图谱</p>
            <p className="text-sm text-gray-500">继续与AI交流以获取更多记忆数据</p>
          </div>
        )}
      </div>
      
      {/* 图例 */}
      <div className="absolute bottom-4 left-4 z-10 bg-gray-900/60 p-3 rounded-lg">
        <p className="text-sm font-medium mb-2">图例</p>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span className="text-xs text-gray-300">主题</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-xs text-gray-300">关键词</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span className="text-xs text-gray-300">记忆</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InlineKnowledgeGraph;