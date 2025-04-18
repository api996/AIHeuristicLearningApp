import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ZoomIn, ZoomOut, Maximize, Minimize } from "lucide-react";
// @ts-ignore 忽略类型检查
import { Graph } from "react-d3-graph";

// 定义知识图谱节点类型
interface KnowledgeNode {
  id: string;
  label: string;
  size: number;
  category?: string;
  clusterId?: string;
  color?: string;
}

// 定义知识图谱连接类型
interface KnowledgeLink {
  source: string;
  target: string;
  value: number;
  type?: string;
}

// 知识图谱数据结构
interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  links: KnowledgeLink[];
  version?: number;
}

export default function KnowledgeGraphDetail() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<{userId: number; role: string; username?: string} | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  // 从localStorage获取用户信息
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        // 如果用户未登录，重定向到登录页面
        setLocation("/login");
      }
    } catch (error) {
      console.error("获取用户信息失败:", error);
    }
  }, [setLocation]);

  // 获取知识图谱数据
  const { data: knowledgeGraph, isLoading, error } = useQuery<KnowledgeGraph>({
    queryKey: ["/api/learning-path/knowledge-graph", user?.userId],
    queryFn: async () => {
      const response = await fetch(`/api/learning-path/${user?.userId}/knowledge-graph`);
      if (!response.ok) {
        throw new Error("获取知识图谱失败");
      }
      return response.json();
    },
    enabled: !!user?.userId,
  });

  // 放大图谱
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.2, 3));
  };

  // 缩小图谱
  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.2, 0.5));
  };

  // 切换全屏模式
  const toggleFullScreen = () => {
    if (!isFullScreen) {
      if (graphContainerRef.current?.requestFullscreen) {
        graphContainerRef.current.requestFullscreen().catch(err => {
          console.error("全屏模式错误:", err);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => {
          console.error("退出全屏模式错误:", err);
        });
      }
    }
  };

  // 监听全屏状态变化
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
    };
  }, []);

  // 适配移动设备的配置
  const isMobile = window.innerWidth < 768;
  const graphConfig = {
    nodeHighlightBehavior: true,
    directed: true,
    d3: {
      gravity: -150,
      linkLength: isMobile ? 80 : 120,
      alphaTarget: 0.1,
    },
    node: {
      color: "#3b82f6",
      size: 300,
      highlightStrokeColor: 'white',
      fontSize: 12,
      fontColor: 'white',
      labelProperty: "label",
      renderLabel: !isMobile, // 移动设备上不显示标签，避免拥挤
    },
    link: {
      highlightColor: 'white',
      color: 'rgba(59, 130, 246, 0.5)',
      strokeWidth: 2,
      renderLabel: false,
    },
    height: isMobile ? window.innerHeight * 0.7 : 600,
    width: isMobile ? window.innerWidth * 0.95 : 900,
  };

  // 处理节点点击
  const onClickNode = (nodeId: string) => {
    if (knowledgeGraph) {
      const node = knowledgeGraph.nodes.find(n => n.id === nodeId);
      if (node) {
        console.log("点击了节点:", node);
        // 这里可以添加节点点击后的操作，比如显示详情
      }
    }
  };

  // 如果用户未登录，显示提示信息
  if (!user?.userId) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Card className="w-[400px]">
          <CardContent className="pt-6">
            <p className="text-center">请先登录后查看知识图谱</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 如果正在加载，显示加载提示
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Card className="w-[400px]">
          <CardContent className="pt-6">
            <p className="text-center">正在加载知识图谱...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 如果出现错误，显示错误信息
  if (error) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Card className="w-[400px]">
          <CardContent className="pt-6">
            <p className="text-center">加载知识图谱失败</p>
            <p className="text-center text-sm text-muted-foreground mt-2">
              {(error as Error).message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 转换数据格式
  const graphData = {
    nodes: knowledgeGraph?.nodes.map(node => ({
      id: node.id,
      color: node.category === 'cluster' ? '#3b82f6' : 
             node.category === 'keyword' ? '#10b981' : 
             node.category === 'memory' ? '#f59e0b' : '#6366f1',
      size: node.size * 300 * zoomLevel, // 应用缩放级别
      symbolType: "circle",
      label: node.label,
      category: node.category
    })) || [],
    links: knowledgeGraph?.links.map(link => ({
      source: link.source,
      target: link.target,
      strokeWidth: link.value * 3,
      color: 'rgba(59, 130, 246, 0.5)'
    })) || []
  };

  return (
    <div className="container mx-auto py-4 px-2 md:px-6 flex flex-col min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <Link to="/learning-path">
          <Button variant="outline" className="flex items-center gap-2">
            <ArrowLeft size={16} />
            <span>返回学习轨迹</span>
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleZoomIn}>
            <ZoomIn size={16} />
          </Button>
          <Button variant="outline" size="icon" onClick={handleZoomOut}>
            <ZoomOut size={16} />
          </Button>
          <Button variant="outline" size="icon" onClick={toggleFullScreen}>
            {isFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </Button>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-2 md:p-6 h-full" ref={graphContainerRef}>
          <div className="rounded-lg border border-blue-900/50 bg-gradient-to-b from-blue-950/30 to-purple-950/20 p-2 md:p-6 h-full">
            <h1 className="text-xl font-bold mb-4 text-blue-300">我的知识图谱</h1>
            
            {knowledgeGraph && knowledgeGraph.nodes.length > 0 ? (
              <div 
                className="w-full h-[70vh] relative overflow-hidden" 
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
              >
                <Graph
                  id="knowledge-graph-detail"
                  data={graphData}
                  config={{
                    ...graphConfig,
                    height: isFullScreen ? window.innerHeight - 120 : graphConfig.height,
                    width: isFullScreen ? window.innerWidth - 40 : graphConfig.width,
                    d3: {
                      ...graphConfig.d3,
                      // 禁用d3缩放功能，我们使用自己的缩放控制
                      disableLinkForce: false,
                      useWindowScale: false,
                    }
                  }}
                  onClickNode={onClickNode}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[50vh]">
                <p className="text-lg text-neutral-400">暂无足够数据生成知识图谱</p>
                <p className="text-sm text-neutral-500 max-w-md mx-auto mt-2">
                  随着您的学习过程，系统将收集更多数据，并构建您的知识图谱，展示概念之间的关联
                </p>
              </div>
            )}
            
            {knowledgeGraph && knowledgeGraph.nodes.length > 0 && (
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-blue-900/30">
                <div className="text-sm text-neutral-300">
                  <span className="font-medium">节点数:</span> {knowledgeGraph.nodes.length}
                  <span className="mx-2">|</span>
                  <span className="font-medium">关联数:</span> {knowledgeGraph.links.length}
                </div>
                
                <div className="flex gap-2">
                  {['cluster', 'keyword', 'memory'].map(category => (
                    <div key={category} className="flex items-center gap-1">
                      <div className={`w-3 h-3 rounded-full ${
                        category === 'cluster' ? 'bg-blue-500' : 
                        category === 'keyword' ? 'bg-green-500' : 
                        'bg-yellow-500'
                      }`}></div>
                      <span className="text-xs text-neutral-400">
                        {category === 'cluster' ? '主题' : 
                         category === 'keyword' ? '关键词' : '记忆'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}