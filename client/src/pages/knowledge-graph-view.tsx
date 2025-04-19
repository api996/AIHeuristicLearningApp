import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import SimpleKnowledgeGraph from '@/components/SimpleKnowledgeGraph';
import { ArrowLeft, ZoomIn, ZoomOut, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface KnowledgeGraphViewProps {}

interface GraphNode {
  id: string;
  name: string;
  type: 'cluster' | 'keyword' | 'memory';
  group?: number;
  desc?: string;
  size?: number;
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
    <div className="knowledge-graph-view-page fixed inset-0 overflow-hidden bg-gradient-to-br from-blue-950 to-slate-900 flex flex-col">
      {/* 最小化的顶部导航 */}
      <div className="absolute top-0 left-0 right-0 z-10 p-2 flex justify-between">
        <Link to="/learning-path">
          <Button variant="outline" size="sm" className="bg-blue-950/50 border-blue-900/50 text-blue-200 shadow-md">
            <ArrowLeft size={16} className="mr-1" />
            返回
          </Button>
        </Link>
        
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={handleZoomIn} className="h-8 w-8 bg-blue-950/50 border-blue-900/50 text-blue-200 shadow-md">
            <ZoomIn size={14} />
          </Button>
          <Button variant="outline" size="icon" onClick={handleZoomOut} className="h-8 w-8 bg-blue-950/50 border-blue-900/50 text-blue-200 shadow-md">
            <ZoomOut size={14} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setColorScheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className="h-8 w-8 bg-blue-950/50 border-blue-900/50 text-blue-200 shadow-md"
          >
            <Info size={14} />
          </Button>
        </div>
      </div>
      
      {/* 图谱区域 */}
      <div className="flex-1 w-full h-full" ref={graphContainerRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-blue-300">加载知识图谱中...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-300">加载失败</div>
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
            <p className="text-sm text-blue-400/60 max-w-md mx-auto mt-2">
              随着您的学习过程，系统将收集更多数据，并构建您的知识图谱，展示概念之间的关联
            </p>
          </div>
        )}
      </div>
      
      {/* 图例 - 悬浮在底部 */}
      {knowledgeGraph && knowledgeGraph.nodes.length > 0 && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-3 p-2 rounded-full bg-blue-950/70 border border-blue-900/50 shadow-lg">
          {['cluster', 'keyword', 'memory'].map(category => (
            <div key={category} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded-full ${
                category === 'cluster' ? 'bg-blue-500' : 
                category === 'keyword' ? 'bg-green-500' : 
                'bg-yellow-500'
              }`}></div>
              <span className="text-xs text-blue-200">
                {category === 'cluster' ? '主题' : 
                 category === 'keyword' ? '关键词' : '记忆'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}