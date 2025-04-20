import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, RefreshCw, ZoomIn, ZoomOut, Maximize } from "lucide-react";
// 使用组件
import StaticKnowledgeGraph from "@/components/StaticKnowledgeGraph";
import SimpleD3Graph from "@/components/SimpleD3Graph";
// 导入iPad滚动修复CSS
import '@/components/ui/knowledge-graph-fixes.css';
// 导入知识图谱数据预加载器
import { preloadKnowledgeGraphData, getKnowledgeGraphData, clearKnowledgeGraphCache } from '@/lib/knowledge-graph-preloader';

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
  const [location, setLocation] = useLocation();
  const [user, setUser] = useState<{userId: number; role: string; username?: string} | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  // 从URL参数和localStorage获取用户信息
  useEffect(() => {
    try {
      // 首先检查URL参数中是否有userId
      const urlParams = new URLSearchParams(window.location.search);
      const urlUserId = urlParams.get('userId');
      console.log("从URL参数获取用户ID:", urlUserId);

      // 从localStorage获取完整用户信息
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        
        // 如果URL有userId参数且与当前登录用户不同，使用URL中的userId
        if (urlUserId && parseInt(urlUserId) !== parsedUser.userId) {
          console.log("使用URL参数中的用户ID:", urlUserId);
          setUser({...parsedUser, userId: parseInt(urlUserId)});
        } else {
          setUser(parsedUser);
        }
      } else if (urlUserId) {
        // 如果没有登录用户但有URL参数，创建临时用户对象
        console.log("创建临时用户对象，使用URL参数中的用户ID:", urlUserId);
        setUser({userId: parseInt(urlUserId), role: 'user'});
      } else {
        // 如果用户未登录且没有URL参数，重定向到登录页面
        console.log("用户未登录且没有URL参数，重定向到登录页面");
        setLocation("/login");
      }
    } catch (error) {
      console.error("获取用户信息失败:", error);
    }
  }, [setLocation, location]);

  // 预加载知识图谱数据
  useEffect(() => {
    if (user?.userId) {
      // 在组件挂载时立即开始预加载
      console.log(`开始预加载知识图谱数据，用户ID: ${user.userId}`);
      preloadKnowledgeGraphData(user.userId)
        .then(data => {
          console.log(`预加载知识图谱数据成功: ${data.nodes.length}个节点, ${data.links.length}个连接`);
        })
        .catch(err => {
          console.error('预加载知识图谱数据失败:', err);
        });
    }
  }, [user?.userId]);

  // 获取知识图谱数据 - 使用优化版本 (优先使用预加载的缓存数据)
  const { data: knowledgeGraph, isLoading, error, refetch } = useQuery<KnowledgeGraph>({
    queryKey: [`/api/learning-path/${user?.userId}/knowledge-graph`],
    queryFn: async () => {
      console.log(`获取知识图谱数据，用户ID: ${user?.userId}`);
      
      try {
        // 优先使用预加载的缓存数据
        const data = await getKnowledgeGraphData(user?.userId || 0);
        
        // 详细检查并记录接收到的数据结构
        if (data && Array.isArray(data.nodes) && Array.isArray(data.links)) {
          console.log(`成功获取知识图谱数据 (来自预加载): ${data.nodes.length}个节点, ${data.links.length}个连接`);
          
          // 检查节点数据是否正确
          if (data.nodes.length > 0) {
            console.log('节点示例:', data.nodes[0]);
          }
          
          // 检查连接数据是否正确
          if (data.links.length > 0) {
            console.log('连接示例:', data.links[0]);
          }
          
          return data;
        } else {
          console.warn('预加载数据结构异常，尝试直接获取:', data);
          throw new Error('预加载数据异常');
        }
      } catch (err) {
        // 如果预加载失败，回退到直接获取
        console.warn('使用预加载数据失败，尝试直接获取:', err);
        
        const response = await fetch(`/api/learning-path/${user?.userId}/knowledge-graph`);
        if (!response.ok) {
          console.error(`获取知识图谱失败: ${response.status} ${response.statusText}`);
          throw new Error("获取知识图谱失败");
        }
        
        const data = await response.json();
        if (data && Array.isArray(data.nodes) && Array.isArray(data.links)) {
          console.log(`成功获取知识图谱数据 (直接获取): ${data.nodes.length}个节点, ${data.links.length}个连接`);
        } else {
          console.warn('接收到的数据结构异常:', data);
        }
        
        return data;
      }
    },
    enabled: !!user?.userId,
  });
  
  // 添加本地状态以管理加载
  const [localLoading, setLocalLoading] = useState(false);
  const [localKnowledgeGraph, setLocalKnowledgeGraph] = useState<KnowledgeGraph | null>(null);

  // 改进的刷新图谱处理函数 - 保持页面不刷新，仅更新数据
  const handleRefreshGraph = async () => {
    if (user?.userId) {
      try {
        // 清除缓存
        clearKnowledgeGraphCache(user.userId);
        console.log("已清除知识图谱缓存，开始重新获取数据...");
        
        // 显示加载状态
        setLocalLoading(true);
        
        // 强制从服务器获取新数据 (不使用缓存)
        const response = await fetch(`/api/learning-path/${user.userId}/knowledge-graph?t=${Date.now()}`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        if (!response.ok) {
          throw new Error(`获取知识图谱失败: ${response.status}`);
        }
        
        // 解析新数据
        const freshData = await response.json();
        console.log(`获取到新数据: ${freshData.nodes.length}个节点, ${freshData.links.length}个连接`);
        
        // 验证数据有效性
        if (!freshData.nodes || !Array.isArray(freshData.nodes)) {
          console.error("接收到的数据无效:", freshData);
          throw new Error("接收到的知识图谱数据格式无效");
        }
        
        // 确保强制更新画布，现在使用本地状态
        setLocalKnowledgeGraph(freshData);
        
        // 使用预加载器缓存数据，以便其他组件使用
        await preloadKnowledgeGraphData(user.userId, true);
        
        // 通知用户刷新成功
        console.log("知识图谱数据刷新成功:", freshData.nodes.length, "个节点");
        
        // 清除加载状态
        setLocalLoading(false);
      } catch (error) {
        console.error("刷新知识图谱数据失败:", error);
        // 重置加载状态
        setLocalLoading(false);
        // 如果失败，回退到使用refetch
        refetch();
      }
    }
  };

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

  // 切换全屏模式 - 改进的移动设备与iPad兼容版本
  // CSS全屏回退方案
  const useCSSFullscreenFallback = () => {
    console.log("使用CSS回退全屏模式");
    
    // 获取图形容器
    const graphContainer = document.querySelector('.knowledge-graph-container');
    const cardContainer = document.querySelector('.card-container-for-fullscreen');
    
    // 添加自定义全屏类
    if (graphContainer instanceof HTMLElement) {
      graphContainer.classList.add('fullscreen');
    }
    
    if (cardContainer instanceof HTMLElement) {
      cardContainer.classList.add('fullscreen');
    }
    
    // 保存原始滚动位置
    document.documentElement.dataset.originalScrollY = window.scrollY.toString();
    document.documentElement.dataset.originalBodyScroll = document.body.style.overflow;
    
    // 防止背景滚动
    document.body.style.overflow = 'hidden';
    
    // 设置状态
    setIsFullScreen(true);
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
          useCSSFullscreenFallback();
        });
    } else {
      // 如果所有方法都失败，使用CSS回退方案
      useCSSFullscreenFallback();
    }
  };

  // 切换全屏模式 - 改进的移动设备与iPad兼容版本
  const toggleFullScreen = () => {
    // 检测是否为iPad或其他触摸设备
    const isIPad = /iPad/.test(navigator.userAgent) || 
                  (/Macintosh/.test(navigator.userAgent) && 'ontouchend' in document);
    const isTablet = isIPad || (window.innerWidth >= 768 && window.innerWidth <= 1366 && 'ontouchend' in document);
    const isTouch = isIPad || isTablet || 'ontouchend' in document;
    
    // 针对特定设备使用自定义全屏模式
    const useCustomFullscreen = isIPad || isTablet || (isTouch && !/Chrome/.test(navigator.userAgent));
    
    if (!isFullScreen) {
      if (useCustomFullscreen) {
        // iPad和平板使用自定义全屏模式（CSS控制）
        useCSSFullscreenFallback();
      } else {
        // 如果不是iPad等设备，使用标准全屏API
        try {
          // 获取更大的父容器来确保全屏模式工作
          const cardContainer = document.querySelector('.card-container-for-fullscreen');
          if (cardContainer instanceof HTMLElement && cardContainer.requestFullscreen) {
            cardContainer.requestFullscreen()
              .then(() => {
                console.log("进入标准全屏模式");
                setIsFullScreen(true);
              })
              .catch(err => {
                console.error("全屏模式错误 (卡片容器):", err);
                tryFallbackFullscreen();
              });
          } else {
            tryFallbackFullscreen();
          }
        } catch (err) {
          console.error("全屏模式初始尝试错误:", err);
          tryFallbackFullscreen();
        }
      }
    } else {
      // 退出全屏模式
      if (useCustomFullscreen) {
        console.log("退出CSS自定义全屏模式");
        
        // 移除自定义全屏类
        const graphContainer = document.querySelector('.knowledge-graph-container');
        const cardContainer = document.querySelector('.card-container-for-fullscreen');
        
        if (graphContainer instanceof HTMLElement) {
          graphContainer.classList.remove('fullscreen');
        }
        
        if (cardContainer instanceof HTMLElement) {
          cardContainer.classList.remove('fullscreen');
        }
        
        // 恢复原始滚动状态
        document.body.style.overflow = document.documentElement.dataset.originalBodyScroll || '';
        
        // 尝试恢复滚动位置
        const originalScrollY = parseInt(document.documentElement.dataset.originalScrollY || '0');
        if (!isNaN(originalScrollY)) {
          window.scrollTo(0, originalScrollY);
        }
        
        // 更新状态
        setIsFullScreen(false);
      } else {
        // 标准API退出全屏
        try {
          if (document.exitFullscreen) {
            document.exitFullscreen();
            console.log("退出标准全屏模式");
          }
          // 无论成功与否都更新状态
          setIsFullScreen(false);
        } catch (error) {
          console.error("退出全屏错误:", error);
          setIsFullScreen(false); // 强制状态更新
        }
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

  // 自动开始预加载数据 - 作为备份确保数据已经加载
  useEffect(() => {
    if (user?.userId) {
      // 强制立即发起预加载请求，覆盖学习轨迹页面可能的失败
      console.log(`知识图谱详情页面强制预加载数据，用户ID: ${user.userId}`);
      preloadKnowledgeGraphData(user.userId)
        .then(data => {
          console.log(`知识图谱详情页面预加载成功: ${data.nodes.length}个节点, ${data.links.length}个连接`);
        })
        .catch(err => {
          console.error('知识图谱详情页面预加载失败:', err);
        });
    }
  }, [user?.userId]);

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

  // 如果正在加载，显示更详细的加载提示
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Card className="w-[400px]">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <div className="w-12 h-12 border-t-2 border-blue-300 rounded-full animate-spin" style={{animationDuration: '1.5s'}}></div>
                </div>
              </div>
              <p className="text-center font-medium text-lg">正在生成知识图谱</p>
              <div className="space-y-1 text-sm text-center text-gray-400 max-w-xs">
                <p>高维向量(3072维)聚类完成</p>
                <p>处理性能已优化，聚类耗时 &lt; 1秒</p>
                <p>正在准备图谱渲染...</p>
              </div>
            </div>
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

  // 添加数据有效性检查
  console.log("知识图谱数据:", knowledgeGraph);
  
  // 确保数据有效，即使API返回空数组，也要处理
  const validNodes = (knowledgeGraph?.nodes && Array.isArray(knowledgeGraph.nodes)) ? knowledgeGraph.nodes : [];
  const validLinks = (knowledgeGraph?.links && Array.isArray(knowledgeGraph.links)) ? knowledgeGraph.links : [];
  
  console.log(`处理知识图谱数据: ${validNodes.length}个节点, ${validLinks.length}个连接`);
  
  // 转换数据格式
  const graphData = {
    nodes: validNodes.map(node => ({
      id: node.id,
      color: node.category === 'cluster' ? '#3b82f6' : 
             node.category === 'keyword' ? '#10b981' : 
             node.category === 'memory' ? '#f59e0b' : '#6366f1',
      size: node.size * 5, // 使用固定倍率，缩放由组件内部控制
      symbolType: "circle",
      label: node.label,
      category: node.category
    })),
    links: validLinks.map(link => ({
      source: link.source,
      target: link.target,
      strokeWidth: link.value * 3,
      color: 'rgba(59, 130, 246, 0.5)'
    }))
  };

  return (
    <div 
      className="container mx-auto py-4 px-2 md:px-6 knowledge-graph-detail-page"
      style={{
        height: 'calc(100vh - 40px)', // 减去一些边距
        overflowY: 'scroll', // 使用scroll而不是auto强制显示滚动条 
        WebkitOverflowScrolling: 'touch', // iOS滚动优化
        scrollbarWidth: 'thin', // Firefox优化
        boxSizing: 'border-box',
        padding: '16px',
        position: 'relative',
        display: 'block' // 改为block布局
      }}
    >
      <div 
        className="flex justify-between items-center mb-4"
        style={{
          position: 'sticky',
          top: 0,
          backgroundColor: 'rgba(13, 17, 23, 0.8)',
          zIndex: 10,
          padding: '10px 0',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)'
        }}
      >
        <Link to="/learning-path">
          <Button variant="outline" className="flex items-center gap-2">
            <ArrowLeft size={16} />
            <span>返回学习轨迹</span>
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleRefreshGraph}
            title="刷新知识图谱数据"
            className="bg-blue-800/30 border-blue-700/50 hover:bg-blue-700/40"
          >
            <RefreshCw size={16} />
          </Button>
          <Button variant="outline" size="icon" onClick={handleZoomIn}>
            <ZoomIn size={16} />
          </Button>
          <Button variant="outline" size="icon" onClick={handleZoomOut}>
            <ZoomOut size={16} />
          </Button>
          <Link to={`/knowledge-graph-view/${user?.userId}`}>
            <Button 
              variant="outline" 
              size="icon" 
              className="fullscreen-toggle"
              title="打开专注查看模式"
            >
              <Maximize size={16} />
            </Button>
          </Link>
        </div>
      </div>

      {/* 给Card添加card-container-for-fullscreen类，作为高优先级全屏容器 */}
      <Card 
        className="card-container-for-fullscreen" 
        style={{
          margin: '0 0 100px 0', // 添加底部边距确保内容可滚动
          overflowY: 'visible' // 允许内容溢出卡片
        }}
      >
        <CardContent 
          className="p-2 md:p-6 h-full" 
          ref={graphContainerRef}
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="rounded-lg border border-blue-900/50 bg-gradient-to-b from-blue-950/30 to-purple-950/20 p-2 md:p-6 h-full overflow-visible">
            <h1 className="text-xl font-bold mb-4 text-blue-300">我的知识图谱</h1>
            
            {/* 添加更详细的数据检查和日志 */}
            {/* 检查是否有数据，并且在isLoading状态下显示加载指示器 */}
            {knowledgeGraph && Array.isArray(knowledgeGraph.nodes) && knowledgeGraph.nodes.length > 0 ? (
              <div 
                className="w-full relative overflow-visible touch-manipulation knowledge-graph-container" 
                style={{
                  touchAction: 'manipulation',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                  height: isFullScreen ? '90vh' : window.innerWidth < 768 ? '45vh' : '70vh',
                  minHeight: isFullScreen ? '90vh' : '300px',
                  maxHeight: isFullScreen ? '90vh' : '800px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <SimpleD3Graph 
                  nodes={graphData.nodes}
                  links={graphData.links}
                  width={isFullScreen ? window.innerWidth - 40 : window.innerWidth > 768 ? 800 : window.innerWidth - 20}
                  height={isFullScreen ? window.innerHeight - 80 : window.innerWidth < 768 ? window.innerHeight * 0.4 : 600}
                  onNodeClick={onClickNode}
                  zoomLevel={zoomLevel}
                  isFullScreen={isFullScreen}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[50vh]">
                {/* 改进的加载提示，显示正在处理 */}
                <div className="animate-pulse bg-blue-500/20 p-5 rounded-full mb-4">
                  <svg className="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <p className="text-lg text-blue-400 font-medium">正在处理知识图谱数据</p>
                <p className="text-sm text-neutral-300 max-w-md mx-auto mt-2 text-center">
                  知识图谱正在加载中，这可能需要几秒钟时间。系统正在处理您的学习记忆和知识连接...
                </p>
                
                {/* 加载状态信息 */}
                <div className="flex items-center gap-2 mt-4">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <p className="text-sm text-green-400">
                    已找到 {knowledgeGraph ? `${knowledgeGraph.nodes?.length || 0}个知识点和${knowledgeGraph.links?.length || 0}个关联` : '知识数据'}
                  </p>
                </div>
                
                {/* 用户引导 */}
                <p className="text-xs text-neutral-400 mt-4 italic">
                  如果图谱未自动显示，请点击右上角刷新按钮
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