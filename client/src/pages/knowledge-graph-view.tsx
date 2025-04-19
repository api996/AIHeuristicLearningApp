import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import SimpleKnowledgeGraph from '@/components/SimpleKnowledgeGraph';
import { ArrowLeft, ZoomIn, ZoomOut, Sun, Moon, RotateCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import '../components/ui/knowledge-graph-view.css';

interface KnowledgeGraphViewProps {}

interface GraphNode {
  id: string;
  name: string; // API返回的节点名称
  label?: string; // 用于显示的标签（由name转换）
  type: 'cluster' | 'keyword' | 'memory';
  group?: number;
  desc?: string;
  size?: number;
  color?: string;
}

interface GraphLink {
  source: string;
  target: string;
  value?: number;
  label?: string;
}

interface KnowledgeGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export default function KnowledgeGraphView({}: KnowledgeGraphViewProps) {
  const { toast } = useToast();
  const { userId } = useParams();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [colorScheme, setColorScheme] = useState<'dark' | 'light'>('dark');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  
  // 设置页面样式
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.backgroundColor = colorScheme === 'dark' ? '#030712' : '#f8fafc';
    
    // 清理函数
    return () => {
      document.body.style.overflow = '';
      document.body.style.backgroundColor = '';
    };
  }, [colorScheme]);
  
  // 加载知识图谱数据
  const { data: knowledgeGraph, isLoading, error } = useQuery<KnowledgeGraphData>({
    queryKey: [`/api/learning-path/${userId}/knowledge-graph`],
    enabled: !!userId,
  });
  
  // 缩放控制
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.2, 3));
  };
  
  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.2, 0.5));
  };
  
  // 点击节点
  const onClickNode = (nodeId: string) => {
    if (!knowledgeGraph) return;
    
    const node = knowledgeGraph.nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      toast({
        title: `${node.type === 'cluster' ? '主题' : node.type === 'keyword' ? '关键词' : '记忆'}: ${node.name}`,
        description: node.desc || '无描述',
        duration: 3000,
      });
    }
  };
  
  // 转换数据为图谱格式
  const graphData = {
    nodes: knowledgeGraph?.nodes.map(node => ({
      ...node,
      size: node.type === 'cluster' ? 15 : node.type === 'keyword' ? 10 : 8,
      color: node.type === 'cluster' ? '#3b82f6' : 
             node.type === 'keyword' ? '#10b981' : 
             '#eab308'
    })) || [],
    links: knowledgeGraph?.links.map(link => ({
      ...link,
      color: 'rgba(59, 130, 246, 0.5)'
    })) || []
  };
  
  return (
    <div className={`knowledge-graph-view-page ${colorScheme === 'light' ? 'light-mode' : ''}`}>
      {/* 专注模式顶部控制栏 */}
      <div className="graph-control-bar">
        <Link to="/learning-path">
          <button className="graph-button">
            <ArrowLeft className="mr-1" />
            <span className="text-sm">返回</span>
          </button>
        </Link>
        
        <div className="flex gap-2">
          <button className="graph-button" onClick={handleZoomIn}>
            <ZoomIn size={14} />
          </button>
          <button className="graph-button" onClick={handleZoomOut}>
            <ZoomOut size={14} />
          </button>
          <button 
            className="graph-button" 
            onClick={() => setColorScheme(prev => prev === 'dark' ? 'light' : 'dark')}
          >
            {colorScheme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        </div>
      </div>
      
      {/* 图谱区域 - 全屏专注模式 */}
      <div className="fullscreen-graph-container" ref={graphContainerRef}>
        {/* 背景光效 */}
        <div className="glow-effect"></div>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <RotateCw size={24} className="animate-spin text-blue-300" />
              <div className="text-blue-300">正在生成知识图谱...</div>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <div className="text-red-300">加载失败</div>
              <button className="graph-button mt-2" onClick={() => window.location.reload()}>
                <RotateCw size={14} className="mr-1" />
                <span className="text-xs">重试</span>
              </button>
            </div>
          </div>
        ) : knowledgeGraph && knowledgeGraph.nodes.length > 0 ? (
          <SimpleKnowledgeGraph
            nodes={graphData.nodes.map(node => ({
              id: node.id,
              label: node.name,
              size: node.size,
              color: node.color,
              category: node.type
            }))}
            links={graphData.links}
            height={window.innerHeight}
            width={window.innerWidth}
            onNodeClick={onClickNode}
            zoomLevel={zoomLevel}
            isFullScreen={true}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-lg text-blue-300">暂无足够数据生成知识图谱</p>
            <p className="text-sm text-blue-400/60 max-w-md mx-auto mt-2 text-center">
              随着您的学习过程，系统将收集更多数据，并构建您的知识图谱，展示概念之间的关联
            </p>
          </div>
        )}
      </div>
      
      {/* 图例 - 简化且有样式的版本 */}
      {knowledgeGraph && knowledgeGraph.nodes.length > 0 && (
        <div className="graph-legend">
          {['cluster', 'keyword', 'memory'].map(category => (
            <div key={category} className="graph-legend-item">
              <div 
                className="graph-legend-dot" 
                style={{ 
                  backgroundColor: category === 'cluster' ? '#3b82f6' : 
                                   category === 'keyword' ? '#10b981' : 
                                   '#eab308'
                }}
              ></div>
              <span className="graph-legend-text">
                {category === 'cluster' ? '主题' : 
                 category === 'keyword' ? '关键词' : '记忆'}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* 节点信息提示 - 当有选中节点时显示 */}
      {selectedNode && (
        <div 
          className="node-info-tooltip"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="node-info-title">
            {selectedNode.type === 'cluster' ? '主题' : 
             selectedNode.type === 'keyword' ? '关键词' : '记忆'}: {selectedNode.name}
          </div>
          <div className="node-info-desc">
            {selectedNode.desc || '没有详细描述'}
          </div>
        </div>
      )}
    </div>
  );
}