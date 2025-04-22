/**
 * 主题/知识图谱切换视图组件
 * 提供在传统知识图谱和智能主题图谱之间切换的功能
 */
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Rocket, Brain, RotateCcw, ChevronDown, Sparkles } from 'lucide-react';
import { 
  preloadKnowledgeGraphData, 
  KnowledgeGraphData 
} from '../lib/knowledge-graph-preloader';
import { 
  preloadTopicGraphData, 
  TopicGraphData 
} from '../lib/topic-graph-preloader';
import TextNodeKnowledgeGraph from './TextNodeKnowledgeGraph';
import ForceGraphKnowledgeGraph from './ForceGraphKnowledgeGraph';
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
interface TopicGraphToggleViewProps {
  userId: number;
  className?: string;
}

// 主组件
export default function TopicGraphToggleView({ userId, className = '' }: TopicGraphToggleViewProps) {
  // 状态管理
  const [activeTab, setActiveTab] = useState<string>("knowledge");
  const [graphType, setGraphType] = useState<string>("text");
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraphData | null>(null);
  const [topicGraph, setTopicGraph] = useState<TopicGraphData | null>(null);
  const [isLoadingKnowledge, setIsLoadingKnowledge] = useState<boolean>(false);
  const [isLoadingTopic, setIsLoadingTopic] = useState<boolean>(false);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const [topicError, setTopicError] = useState<string | null>(null);

  // 图表类型选择器选项
  const graphTypeOptions = [
    { 
      value: "text", 
      label: "文本节点", 
      icon: <Brain className="h-4 w-4" /> 
    },
    { 
      value: "force", 
      label: "力导向图", 
      icon: <Rocket className="h-4 w-4" /> 
    }
  ];

  // 加载知识图谱数据
  const loadKnowledgeGraph = async (forceRefresh = false) => {
    if (!userId) return;
    
    try {
      setIsLoadingKnowledge(true);
      setKnowledgeError(null);
      
      const data = await preloadKnowledgeGraphData(userId, forceRefresh);
      setKnowledgeGraph(data);
    } catch (error) {
      console.error("加载知识图谱失败:", error);
      setKnowledgeError("无法加载知识图谱数据，请稍后重试");
    } finally {
      setIsLoadingKnowledge(false);
    }
  };
  
  // 加载主题图谱数据
  const loadTopicGraph = async (forceRefresh = false) => {
    if (!userId) return;
    
    try {
      setIsLoadingTopic(true);
      setTopicError(null);
      
      const data = await preloadTopicGraphData(userId, forceRefresh);
      setTopicGraph(data);
    } catch (error) {
      console.error("加载主题图谱失败:", error);
      setTopicError("无法加载主题图谱数据，请稍后重试");
    } finally {
      setIsLoadingTopic(false);
    }
  };
  
  // 处理强制刷新
  const handleRefreshKnowledge = () => {
    loadKnowledgeGraph(true);
  };
  
  const handleRefreshTopic = () => {
    loadTopicGraph(true);
  };
  
  // 在组件加载时预加载数据
  useEffect(() => {
    if (userId) {
      loadKnowledgeGraph();
    }
  }, [userId]);
  
  // 当切换到主题图谱标签时加载主题图谱数据
  useEffect(() => {
    if (activeTab === "topic" && userId && !topicGraph && !isLoadingTopic) {
      loadTopicGraph();
    }
  }, [activeTab, userId, topicGraph, isLoadingTopic]);

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

  // 渲染知识图谱内容
  const renderKnowledgeGraphContent = () => {
    if (isLoadingKnowledge) return renderLoading();
    if (knowledgeError) return renderError(knowledgeError, handleRefreshKnowledge);
    if (!knowledgeGraph || !knowledgeGraph.nodes || knowledgeGraph.nodes.length === 0) {
      return renderEmpty("暂无知识图谱数据，请尝试添加更多记忆");
    }

    if (graphType === "text") {
      return (
        <TextNodeKnowledgeGraph 
          nodes={knowledgeGraph.nodes} 
          links={knowledgeGraph.links}
        />
      );
    } else {
      return (
        <ForceGraphKnowledgeGraph 
          nodes={knowledgeGraph.nodes} 
          links={knowledgeGraph.links}
        />
      );
    }
  };

  // 渲染主题图谱内容
  const renderTopicGraphContent = () => {
    if (isLoadingTopic) return renderLoading();
    if (topicError) return renderError(topicError, handleRefreshTopic);
    if (!topicGraph || !topicGraph.nodes || topicGraph.nodes.length === 0) {
      return renderEmpty("暂无主题图谱数据，请尝试添加更多记忆或刷新");
    }

    // 主题图谱和知识图谱共用相同的可视化组件
    if (graphType === "text") {
      return (
        <TextNodeKnowledgeGraph 
          nodes={topicGraph.nodes} 
          links={topicGraph.links}
        />
      );
    } else {
      return (
        <ForceGraphKnowledgeGraph 
          nodes={topicGraph.nodes} 
          links={topicGraph.links}
        />
      );
    }
  };

  return (
    <div className={`knowledge-graph-container border rounded-lg p-4 ${className}`}>
      <Tabs defaultValue="knowledge" value={activeTab} onValueChange={setActiveTab}>
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="knowledge">标准知识图谱</TabsTrigger>
            <TabsTrigger value="topic" className="flex items-center">
              <Sparkles className="h-4 w-4 mr-1" />
              智能主题图谱
            </TabsTrigger>
          </TabsList>
          
          <div className="flex space-x-2">
            <GraphTypeSelector 
              selectedType={graphType}
              onChange={setGraphType}
              options={graphTypeOptions}
            />
            
            <Button 
              variant="outline" 
              size="icon" 
              onClick={activeTab === "knowledge" ? handleRefreshKnowledge : handleRefreshTopic}
              disabled={activeTab === "knowledge" ? isLoadingKnowledge : isLoadingTopic}
            >
              <RotateCcw className={`h-4 w-4 ${(activeTab === "knowledge" ? isLoadingKnowledge : isLoadingTopic) ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        <TabsContent value="knowledge" className="mt-0">
          {renderKnowledgeGraphContent()}
        </TabsContent>
        
        <TabsContent value="topic" className="mt-0">
          {renderTopicGraphContent()}
        </TabsContent>
      </Tabs>
      
      {activeTab === "topic" && (
        <div className="mt-4 p-3 bg-muted rounded-md text-sm">
          <p className="flex items-center">
            <Sparkles className="h-4 w-4 mr-1 text-yellow-500" />
            <span className="font-semibold">智能主题图谱：</span>
            <span className="ml-1">使用Gemini 2.0 Flash模型智能分析记忆数据，自动提取主题概念和它们之间的关系，构建更贴近人类认知的知识连接。</span>
          </p>
        </div>
      )}
    </div>
  );
}