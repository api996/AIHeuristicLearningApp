import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ZoomIn, ZoomOut, Maximize, Minimize } from "lucide-react";
import SimpleKnowledgeGraph from "@/components/SimpleKnowledgeGraph";

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

  // 放大图谱 - 使用一个全局变量存储当前的缩放级别
  const handleZoomIn = () => {
    setZoomLevel(prev => {
      const newLevel = Math.min(prev + 0.2, 3);
      // 设置CSS变量，让组件使用
      if (graphContainerRef.current) {
        graphContainerRef.current.style.setProperty('--graph-scale', newLevel.toString());
      }
      return newLevel;
    });
  };

  // 缩小图谱
  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const newLevel = Math.max(prev - 0.2, 0.5);
      // 设置CSS变量，让组件使用
      if (graphContainerRef.current) {
        graphContainerRef.current.style.setProperty('--graph-scale', newLevel.toString());
      }
      return newLevel;
    });
  };

  // 切换全屏模式 - 改进的移动设备兼容版本
  const toggleFullScreen = () => {
    if (!isFullScreen) {
      // 先尝试使用标准方法进入全屏
      try {
        // 获取更大的父容器来确保全屏模式工作
        const cardContainer = document.querySelector('.card-container-for-fullscreen');
        if (cardContainer instanceof HTMLElement && cardContainer.requestFullscreen) {
          cardContainer.requestFullscreen()
            .then(() => {
              console.log("进入全屏模式");
              setIsFullScreen(true);
            })
            .catch(err => {
              console.error("全屏模式错误 (卡片容器):", err);
              tryFallbackFullscreen();
            });
          return;
        } else {
          tryFallbackFullscreen();
        }
      } catch (err) {
        console.error("全屏模式初始尝试错误:", err);
        tryFallbackFullscreen();
      }
    } else {
      try {
        if (document.exitFullscreen) {
          document.exitFullscreen();
          console.log("退出全屏模式");
        }
        // 无论成功与否都更新状态
        setIsFullScreen(false);
      } catch (error) {
        console.error("退出全屏错误:", error);
        setIsFullScreen(false); // 强制状态更新
      }
    }
  };

  // 回退全屏策略
  const tryFallbackFullscreen = () => {
    // 尝试最内层图形容器
    const graphContainer = document.querySelector('.knowledge-graph-container');
    if (graphContainer instanceof HTMLElement && graphContainer.requestFullscreen) {
      graphContainer.requestFullscreen()
        .then(() => {
          console.log("使用图形容器进入全屏模式");
          setIsFullScreen(true);
        })
        .catch(err => {
          console.error("图形容器全屏模式错误:", err);
          // 尝试使用引用的容器
          if (graphContainerRef.current?.requestFullscreen) {
            graphContainerRef.current.requestFullscreen()
              .then(() => {
                console.log("使用引用容器进入全屏模式");
                setIsFullScreen(true);
              })
              .catch(err2 => {
                console.error("引用容器全屏模式错误:", err2);
                // 最后尝试使用最外层容器
                const outerContainer = document.querySelector('.container');
                if (outerContainer instanceof HTMLElement && outerContainer.requestFullscreen) {
                  outerContainer.requestFullscreen()
                    .catch(err3 => {
                      console.error("最外层容器全屏模式错误:", err3);
                      // 手动设置全屏状态
                      setIsFullScreen(true);
                    });
                } else {
                  // 手动设置全屏状态
                  setIsFullScreen(true);
                }
              });
          }
        });
    } else if (graphContainerRef.current?.requestFullscreen) {
      // 回退到graphContainerRef
      graphContainerRef.current.requestFullscreen()
        .catch(err => {
          console.error("引用容器全屏模式错误:", err);
          // 手动设置全屏状态
          setIsFullScreen(true);
        });
    } else {
      // 如果所有方法都失败，手动切换全屏状态
      console.log("所有全屏方法都失败，手动设置全屏状态");
      setIsFullScreen(true);
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
      // 强制禁用D3 zoom行为，避免与_d3Selection.event.transform冲突
      disableLinkForce: false,
      // 使用自定义的D3实例 (v5)，而不是组件内置的
      useGlobalD3: true
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
      size: node.size * 5, // 使用固定倍率，缩放由组件内部控制
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
    <div className="container mx-auto py-4 px-2 md:px-6 flex flex-col min-h-screen overflow-y-auto knowledge-graph-detail-page">
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
          <Button 
            variant="outline" 
            size="icon" 
            onClick={toggleFullScreen}
            className="fullscreen-toggle"
          >
            {isFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </Button>
        </div>
      </div>

      {/* 给Card添加card-container-for-fullscreen类，作为高优先级全屏容器 */}
      <Card className="flex-1 overflow-auto card-container-for-fullscreen">
        <CardContent 
          className="p-2 md:p-6 h-full overflow-auto" 
          ref={graphContainerRef}
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="rounded-lg border border-blue-900/50 bg-gradient-to-b from-blue-950/30 to-purple-950/20 p-2 md:p-6 h-full overflow-visible">
            <h1 className="text-xl font-bold mb-4 text-blue-300">我的知识图谱</h1>
            
            {knowledgeGraph && knowledgeGraph.nodes.length > 0 ? (
              <div 
                className="w-full h-[70vh] relative overflow-visible touch-manipulation" 
                style={{
                  touchAction: 'manipulation',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                  height: isFullScreen ? '90vh' : '70vh'
                }}
              >
                <SimpleKnowledgeGraph
                  nodes={graphData.nodes}
                  links={graphData.links}
                  height={isFullScreen ? window.innerHeight - 120 : window.innerWidth < 768 ? window.innerHeight * 0.6 : 600}
                  width={isFullScreen ? window.innerWidth - 40 : window.innerWidth > 768 ? 800 : window.innerWidth - 40}
                  onNodeClick={onClickNode}
                  zoomLevel={zoomLevel}
                  isFullScreen={isFullScreen}
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
              <div className="flex flex-col md:flex-row flex-wrap justify-between items-start md:items-center mt-4 pt-4 border-t border-blue-900/30">
                <div className="text-sm text-neutral-300 mb-2 md:mb-0">
                  <span className="font-medium">节点数:</span> {knowledgeGraph.nodes.length}
                  <span className="mx-2">|</span>
                  <span className="font-medium">关联数:</span> {knowledgeGraph.links.length}
                </div>
                
                <div className="flex flex-wrap gap-2">
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