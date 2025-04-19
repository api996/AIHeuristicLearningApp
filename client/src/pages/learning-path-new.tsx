import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, BookOpen, Brain, BarChart3, Network, ArrowLeftCircle, RefreshCw, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from "wouter";
import SimpleKnowledgeGraph from "@/components/SimpleKnowledgeGraph";
import KnowledgeGraphModal from "@/components/KnowledgeGraphModal";
// 导入学习轨迹页面的iPad滚动修复CSS
import "@/components/ui/learning-path-fixes.css";
// 导入知识图谱样式
import "@/components/ui/knowledge-graph-fixes.css";
// 导入知识图谱预加载器
import { preloadKnowledgeGraphData } from '@/lib/knowledge-graph-preloader';

// 定义知识图谱节点类型
interface KnowledgeNode {
  id: string;
  label: string;
  size: number;
  category?: string;
  clusterId?: string;
  color?: string;
  x?: number;
  y?: number;
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

export default function LearningPath() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<{userId: number; role: string; username?: string} | null>(null);
  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false);

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

  // 获取学习轨迹数据
  const { data: learningPath, isLoading, error } = useQuery({
    queryKey: ["/api/learning-path", user?.userId, user?.role],
    queryFn: async () => {
      const response = await fetch(`/api/learning-path/${user?.userId}?role=${user?.role}`);
      if (!response.ok) {
        throw new Error("获取学习轨迹失败");
      }
      return response.json();
    },
    enabled: !!user?.userId,
  });
  
  // 预加载知识图谱数据
  useEffect(() => {
    if (user?.userId) {
      console.log("学习轨迹页面预加载知识图谱数据...");
      preloadKnowledgeGraphData(user.userId)
        .then(data => {
          console.log(`知识图谱数据预加载成功: ${data.nodes.length}个节点, ${data.links.length}个连接`);
        })
        .catch(err => {
          console.error("知识图谱数据预加载失败:", err);
        });
    }
  }, [user?.userId]);
  
  // 获取知识图谱数据 - 使用预加载与缓存策略
  const { data: knowledgeGraph } = useQuery({
    queryKey: ["/api/learning-path/knowledge-graph", user?.userId],
    queryFn: async () => {
      try {
        // 优先使用已预加载的数据
        console.log("从预加载缓存获取知识图谱数据...");
        const cachedData = await preloadKnowledgeGraphData(user?.userId || 0);
        return cachedData;
      } catch (err) {
        // 回退到标准请求
        console.log("缓存获取失败，直接请求知识图谱数据...");
        const response = await fetch(`/api/learning-path/${user?.userId}/knowledge-graph`);
        if (!response.ok) {
          throw new Error("获取知识图谱失败");
        }
        return response.json();
      }
    },
    enabled: !!user?.userId,
  });

  // 如果用户未登录，显示提示信息
  if (!user?.userId) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>请先登录</CardTitle>
            <CardDescription>登录后才能查看您的学习轨迹</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // 如果正在加载，显示加载提示
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>正在加载</CardTitle>
            <CardDescription>正在分析您的学习数据...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // 如果出现错误，显示错误信息
  if (error) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>加载失败</CardTitle>
            <CardDescription>获取学习轨迹数据时出错</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {(error as Error).message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 返回聊天页面
  const navigateBack = () => {
    setLocation("/");
  };
  
  // 知识图谱标签页内容
  const renderKnowledgeGraphTab = () => {
    return (
      <TabsContent value="knowledge-graph">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Network className="mr-2" /> 知识连接图谱
            </CardTitle>
            <CardDescription>可视化您的学习关联</CardDescription>
          </CardHeader>
          <CardContent className="card-content">
            {knowledgeGraph && knowledgeGraph.nodes && knowledgeGraph.nodes.length > 0 ? (
              <div className="space-y-6">
                <div className="rounded-lg overflow-hidden">
                  <h3 className="text-lg text-blue-300 flex items-center">
                    <Network className="h-5 w-5 mr-2 text-blue-400" />
                    知识图谱可视化
                  </h3>
                  
                  <div className="relative">
                    <div className="flex flex-col h-[400px] w-full relative overflow-hidden border border-blue-900/50 rounded-lg p-4 bg-blue-950/30">
                      {knowledgeGraph && knowledgeGraph.nodes && knowledgeGraph.nodes.length > 0 ? (
                        <>
                          <div className="h-[350px] w-full knowledge-graph-container">
                            <SimpleKnowledgeGraph
                              nodes={knowledgeGraph.nodes.map((node: KnowledgeNode) => ({
                                id: node.id,
                                color: node.category === 'cluster' ? '#3b82f6' : 
                                      node.category === 'keyword' ? '#10b981' : 
                                      node.category === 'memory' ? '#f59e0b' : '#6366f1',
                                size: node.size * 200, // 预览图尺寸小一些
                                label: node.label,
                                category: node.category
                              }))}
                              links={knowledgeGraph.links.map((link: KnowledgeLink) => ({
                                source: link.source,
                                target: link.target,
                                strokeWidth: link.value * 2,
                                color: 'rgba(59, 130, 246, 0.5)'
                              }))}
                              height={350}
                              width={window.innerWidth > 768 ? 800 : window.innerWidth - 60}
                            />
                          </div>
                          <div className="mt-4 flex justify-center gap-2 flex-wrap">
                            <Button
                              onClick={() => setIsGraphModalOpen(true)}
                              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                            >
                              <Maximize className="h-4 w-4" />
                              查看全屏知识图谱
                            </Button>
                            {user?.userId === 6 && (
                              <Button
                                onClick={async () => {
                                  try {
                                    const response = await fetch(`/api/test-data/generate-graph/6?count=35`);
                                    const result = await response.json();
                                    if (result.success) {
                                      alert(`测试数据生成成功：${result.message}`);
                                      // 刷新页面以加载新数据
                                      window.location.reload();
                                    } else {
                                      alert(`测试数据生成失败：${result.message}`);
                                    }
                                  } catch (error) {
                                    console.error('生成测试数据失败:', error);
                                    alert('生成测试数据时发生错误，请查看控制台');
                                  }
                                }}
                                variant="secondary"
                              >
                                生成测试数据
                              </Button>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full w-full">
                          <p className="text-lg text-neutral-400">知识图谱数据不足</p>
                          <p className="text-sm text-neutral-500 max-w-md mx-auto mt-2 text-center">
                            继续与AI对话，系统将自动分析您的学习主题并构建知识图谱
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center border-t border-blue-900/30 pt-4 mt-2">
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
                </div>
              </div>
            ) : (
              <div className="h-[400px] rounded-lg border border-neutral-800 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" className="mx-auto opacity-20">
                    <path d="M14 12C14 14.7614 11.7614 17 9 17H7C4.23858 17 2 14.7614 2 12C2 9.23858 4.23858 7 7 7H7.5M10 12C10 9.23858 12.2386 7 15 7H17C19.7614 7 22 9.23858 22 12C22 14.7614 19.7614 17 17 17H16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <p className="text-lg text-neutral-400">暂无足够数据生成知识图谱</p>
                  <p className="text-sm text-neutral-500 max-w-md mx-auto">
                    随着您的学习过程，系统将收集更多数据，并构建您的知识图谱，展示概念之间的关联
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    );
  };

  return (
    <>
      <div className="container mx-auto py-8 learning-path-container"
        style={{
          height: 'calc(100vh - 80px)',
          overflowY: 'scroll',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          position: 'relative',
          padding: '16px',
          boxSizing: 'border-box'
        }}>
        <div className="flex justify-between items-center mb-8"
          style={{
            position: 'sticky',
            top: 0,
            backgroundColor: 'rgba(13, 17, 23, 0.8)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 10,
            padding: '10px 0'
          }}>
          <div className="flex items-center">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg mr-3">
              <Brain className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold">我的学习轨迹</h1>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="default" 
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setLocation(`/memory-space`)}
            >
              <BookOpen size={18} />
              <span>打开记忆空间</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700"
              onClick={navigateBack}
            >
              <ArrowLeftCircle size={18} />
              <span>返回聊天</span>
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="overview">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">总览</TabsTrigger>
            <TabsTrigger value="progress">学习进度</TabsTrigger>
            <TabsTrigger value="suggestions">学习建议</TabsTrigger>
            <TabsTrigger value="knowledge-graph">知识图谱</TabsTrigger>
          </TabsList>
          
          {/* 其他标签页内容 */}
          <TabsContent value="overview">
            {/* 现有总览内容 */}
            <div className="text-center p-6">
              <h2 className="text-xl">总览内容</h2>
            </div>
          </TabsContent>
          
          <TabsContent value="progress">
            {/* 现有进度内容 */}
            <div className="text-center p-6">
              <h2 className="text-xl">进度内容</h2>
            </div>
          </TabsContent>
          
          <TabsContent value="suggestions">
            {/* 现有建议内容 */}
            <div className="text-center p-6">
              <h2 className="text-xl">建议内容</h2>
            </div>
          </TabsContent>
          
          {/* 知识图谱标签页 */}
          {renderKnowledgeGraphTab()}
        </Tabs>
      </div>
      
      {/* 全屏知识图谱模态对话框 */}
      {knowledgeGraph && knowledgeGraph.nodes && knowledgeGraph.links && (
        <KnowledgeGraphModal 
          isOpen={isGraphModalOpen}
          onClose={() => setIsGraphModalOpen(false)}
          nodes={knowledgeGraph.nodes.map((node) => ({
            id: node.id,
            label: node.label,
            category: node.category,
            size: node.size
          }))}
          links={knowledgeGraph.links.map((link) => ({
            source: link.source,
            target: link.target,
            type: link.type
          }))}
        />
      )}
    </>
  );
}