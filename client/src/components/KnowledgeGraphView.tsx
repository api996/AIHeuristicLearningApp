/**
 * 知识图谱视图组件 
 * 统一图谱数据展示，使用新的unified-graph-preloader
 */
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronDown, Brain, Rocket, RotateCcw } from 'lucide-react';
import { 
  preloadGraphData, 
  GraphData 
} from '../lib/unified-graph-preloader';
import TextNodeForceGraph from './TextNodeForceGraph';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// 图谱类型选择器组件
const GraphTypeSelector = ({ 
  selectedType, 
  onChange,
  options
}: {
  selectedType: string;
  onChange: (type: string) => void;
  options: {value: string, label: string, icon?: React.ReactNode}[];
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="flex items-center justify-between w-44">
          <span className="flex items-center">
            {options.find(opt => opt.value === selectedType)?.icon}
            <span className="ml-2">{options.find(opt => opt.value === selectedType)?.label}</span>
          </span>
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-0">
        <div className="flex flex-col">
          {options.map((option) => (
            <Button
              key={option.value}
              variant={selectedType === option.value ? "secondary" : "ghost"}
              className="justify-start"
              onClick={() => onChange(option.value)}
            >
              {option.icon}
              <span className="ml-2">{option.label}</span>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// 主要组件接口定义
interface KnowledgeGraphViewProps {
  userId: number;
  className?: string;
}

// 主组件 - 统一后的知识图谱视图组件
export default function KnowledgeGraphView({ userId, className = '' }: KnowledgeGraphViewProps) {
  // 状态管理
  const [graphType, setGraphType] = useState<string>("3d"); // 默认使用3D模式
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 图表类型选择器选项 - 简化为单一3D模式
  const graphTypeOptions = [
    { 
      value: "3d", 
      label: "3D知识图谱", 
      icon: <Rocket className="h-4 w-4" /> 
    }
  ];

  // 加载知识图谱数据
  const loadGraphData = async (forceRefresh = false) => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await preloadGraphData(userId, 'knowledge', forceRefresh);
      setGraph(data);
    } catch (error) {
      console.error("加载知识图谱失败:", error);
      setError("无法加载知识图谱数据，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };
  
  // 处理强制刷新
  const handleRefresh = () => {
    loadGraphData(true);
  };
  
  // 在组件加载时预加载数据
  useEffect(() => {
    if (userId) {
      loadGraphData();
    }
  }, [userId]);

  // 渲染加载状态
  const renderLoading = () => (
    <div className="flex items-center justify-center h-40 w-full">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="mt-2 text-sm">数据加载中...</p>
      </div>
    </div>
  );

  // 渲染错误状态
  const renderError = (message: string, onRetry: () => void) => (
    <div className="flex flex-col items-center justify-center h-40 w-full">
      <p className="text-red-500 mb-4">{message}</p>
      <Button onClick={onRetry} variant="outline" size="sm">
        重试
      </Button>
    </div>
  );

  // 渲染空数据状态
  const renderEmpty = (message: string = "暂无图谱数据") => (
    <div className="flex items-center justify-center h-40 w-full">
      <p className="text-gray-500">{message}</p>
    </div>
  );

  // 渲染图谱内容
  const renderGraphContent = () => {
    if (isLoading) return renderLoading();
    if (error) return renderError(error, handleRefresh);
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
      return renderEmpty("暂无知识图谱数据，请尝试添加更多记忆");
    }

    // 统一使用3D图谱渲染
    return (
      <TextNodeForceGraph 
        nodes={graph.nodes} 
        links={graph.links}
        width={800}
        height={600}
      />
    );
  };

  return (
    <div className={`knowledge-graph-container border rounded-lg p-4 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium flex items-center">
          <Brain className="mr-2 h-5 w-5" />
          知识图谱
          {graph && graph.nodes && (
            <span className="ml-3 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-md">
              {graph.nodes.length} 节点 | {graph.links.length} 连接
            </span>
          )}
        </h3>
        
        <div className="flex space-x-2">
          <GraphTypeSelector 
            selectedType={graphType}
            onChange={setGraphType}
            options={graphTypeOptions}
          />
          
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RotateCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      
      <div className="knowledge-graph-content">
        {renderGraphContent()}
      </div>
      
      <div className="mt-4 p-3 bg-muted rounded-md text-sm">
        <p className="flex items-center">
          <Brain className="h-4 w-4 mr-1 text-blue-500" />
          <span className="font-semibold">知识图谱：</span>
          <span className="ml-1">智能分析您的学习记忆数据，展示各知识点之间的关系，构建个性化知识连接网络。</span>
        </p>
      </div>
    </div>
  );
}