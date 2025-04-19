import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, BookOpen, Brain, BarChart3, Network, ArrowLeftCircle, RefreshCw, Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from "wouter";
import StaticKnowledgeGraph from "@/components/StaticKnowledgeGraph";
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

  // 在页面加载后立即开始预加载知识图谱数据
  useEffect(() => {
    if (user?.userId) {
      // 在组件挂载时开始预加载知识图谱数据，无需等待用户点击
      console.log("学习轨迹页面预加载知识图谱数据...");
      
      // 立即开始异步预加载，不阻塞页面渲染
      preloadKnowledgeGraphData(user.userId)
        .then(data => {
          console.log(`知识图谱数据预加载成功: ${data.nodes.length}个节点, ${data.links.length}个连接`);
        })
        .catch(err => {
          console.error("知识图谱数据预加载失败:", err);
        });
    }
  }, [user?.userId]);

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
  
  // 获取知识图谱数据 - 使用预加载与缓存策略
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const { data: knowledgeGraph } = useQuery({
    queryKey: ["/api/learning-path/knowledge-graph", user?.userId],
    queryFn: async () => {
      try {
        setIsGraphLoading(true);
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
      } finally {
        setIsGraphLoading(false);
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

  return (
    <div 
      className="container mx-auto py-8 learning-path-container"
      style={{
        height: 'calc(100vh - 80px)', // 减去导航栏高度
        overflowY: 'scroll', // 强制使用滚动条
        WebkitOverflowScrolling: 'touch', // iOS滚动优化
        scrollbarWidth: 'thin', // Firefox
        position: 'relative',
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      <div 
        className="flex justify-between items-center mb-8"
        style={{
          position: 'sticky',
          top: 0,
          backgroundColor: 'rgba(13, 17, 23, 0.8)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 10,
          padding: '10px 0'
        }}
      >
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

        {/* 总览标签页 */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BookOpen className="mr-2" /> 学习主题
                </CardTitle>
                <CardDescription>您的主要学习方向</CardDescription>
              </CardHeader>
              <CardContent className="card-content">
                {learningPath?.topics && learningPath.topics.length > 0 ? (
                  <div className="space-y-4">
                    {learningPath.topics.map((topic: any) => (
                      <div 
                        key={topic.id} 
                        className="p-3 border rounded-md flex justify-between items-center hover:bg-neutral-800/30 transition-colors"
                      >
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full bg-blue-500 mr-3`}></div>
                          <span className="font-medium">{topic.topic}</span>
                        </div>
                        <div className="flex items-center">
                          <div className={`px-2 py-1 text-xs rounded-full 
                            ${topic.percentage > 50 ? 'bg-blue-900/30 text-blue-400' : 'bg-neutral-800 text-neutral-400'}`}>
                            {topic.percentage}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-neutral-400">
                    <BookOpen className="h-12 w-12 mb-3 opacity-20" />
                    <p>暂无学习主题数据</p>
                    <p className="text-sm mt-1">开始与AI对话，系统将自动分析您的学习主题</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="mr-2" /> 学习进度
                </CardTitle>
                <CardDescription>您在各领域的学习深度</CardDescription>
              </CardHeader>
              <CardContent className="card-content">
                {learningPath?.progress && learningPath.progress.length > 0 ? (
                  <div className="space-y-4">
                    {learningPath.progress.map((item: any, index: number) => {
                      // 根据进度值确定颜色
                      const value = item.percentage || item.score || 0;
                      let color;
                      if (value >= 75) color = "text-green-400 bg-green-900/30";
                      else if (value >= 50) color = "text-blue-400 bg-blue-900/30";
                      else if (value >= 25) color = "text-yellow-400 bg-yellow-900/30";
                      else color = "text-neutral-400 bg-neutral-800";
                      
                      return (
                        <div 
                          key={index} 
                          className="p-3 border rounded-md hover:bg-neutral-800/30 transition-colors"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">{item.topic || item.category}</span>
                            <div className={`px-2.5 py-1 text-xs rounded-full ${color}`}>
                              {value}%
                            </div>
                          </div>
                          {item.change !== undefined && (
                            <div className="text-xs text-neutral-400 mt-1">
                              较上次{item.change > 0 ? 
                                <span className="text-green-400">提升 {Math.abs(item.change)}%</span> : 
                                <span className="text-red-400">下降 {Math.abs(item.change)}%</span>
                              }
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-neutral-400">
                    <BarChart3 className="h-12 w-12 mb-3 opacity-20" />
                    <p>暂无学习进度数据</p>
                    <p className="text-sm mt-1">随着您的持续学习，这里将显示您的进度</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>学习建议</CardTitle>
              <CardDescription>基于您的学习记录生成的个性化建议</CardDescription>
            </CardHeader>
            <CardContent className="card-content">
              {learningPath?.suggestions && learningPath.suggestions.length > 0 ? (
                <div className="space-y-3">
                  {learningPath.suggestions.map((suggestion: string, index: number) => (
                    <div 
                      key={index} 
                      className="p-3 border rounded-md hover:bg-neutral-800/30 transition-colors flex items-start"
                    >
                      <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-1.5 rounded-full mr-3 shrink-0 mt-0.5">
                        <ArrowRight className="h-4 w-4 text-white" />
                      </div>
                      <div className="text-neutral-200">{suggestion}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-neutral-400">
                  <svg width="60" height="60" viewBox="0 0 24 24" fill="none" className="mb-3 opacity-20">
                    <path d="M12 16V10M12 8H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p>暂无学习建议</p>
                  <p className="text-sm mt-1">随着您的学习进展，系统将生成针对性的学习建议</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 学习进度标签页 */}
        <TabsContent value="progress">
          <Card>
            <CardHeader>
              <CardTitle>详细学习进度</CardTitle>
              <CardDescription>各主题学习深度分析</CardDescription>
            </CardHeader>
            <CardContent className="card-content">
              {learningPath?.progress && learningPath.progress.length > 0 ? (
                <div className="space-y-6">
                  {learningPath.progress.map((item: any, index: number) => {
                    // 根据进度值确定颜色
                    const value = item.percentage || item.score || 0;
                    let color, bgColor;
                    if (value >= 75) {
                      color = "text-green-400";
                      bgColor = "from-green-900/20 to-green-800/10";
                    } else if (value >= 50) {
                      color = "text-blue-400";
                      bgColor = "from-blue-900/20 to-blue-800/10";
                    } else if (value >= 25) {
                      color = "text-yellow-400";
                      bgColor = "from-yellow-900/20 to-yellow-800/10";
                    } else {
                      color = "text-neutral-400";
                      bgColor = "from-neutral-800/20 to-neutral-700/10";
                    }
                    
                    return (
                      <div key={index} className="border rounded-lg overflow-hidden">
                        <div className={`p-4 bg-gradient-to-b ${bgColor}`}>
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium">{item.topic || item.category}</h3>
                            <div className={`px-3 py-1 rounded-full text-sm ${color} bg-black/20`}>
                              {value}% 掌握
                            </div>
                          </div>
                          
                          <div className="mt-4 relative">
                            <div className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  value >= 75 ? "bg-green-500" :
                                  value >= 50 ? "bg-blue-500" :
                                  value >= 25 ? "bg-yellow-500" : "bg-neutral-500"
                                }`}
                                style={{ width: `${value}%` }}
                              ></div>
                            </div>
                            
                            {item.change !== undefined && (
                              <div className="mt-3 flex items-center">
                                {item.change > 0 ? (
                                  <div className="text-xs text-green-400 flex items-center">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                      <path d="m18 15-6-6-6 6"/>
                                    </svg>
                                    <span>较上次提升 {Math.abs(item.change)}%</span>
                                  </div>
                                ) : (
                                  <div className="text-xs text-red-400 flex items-center">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                      <path d="m6 9 6 6 6-6"/>
                                    </svg>
                                    <span>较上次下降 {Math.abs(item.change)}%</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                  <BarChart3 className="h-16 w-16 mb-4 opacity-20" />
                  <p className="text-lg">暂无详细学习进度数据</p>
                  <p className="text-sm mt-2">随着您的持续学习，这里将显示更详细的学习进展</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 学习建议标签页 */}
        <TabsContent value="suggestions">
          <Card>
            <CardHeader>
              <CardTitle>个性化学习建议</CardTitle>
              <CardDescription>基于您的学习模式生成的建议</CardDescription>
            </CardHeader>
            <CardContent className="card-content">
              {learningPath?.suggestions && learningPath.suggestions.length > 0 ? (
                <div className="space-y-5">
                  {learningPath.suggestions.map((suggestion: string, index: number) => (
                    <div 
                      key={index} 
                      className="border rounded-lg overflow-hidden"
                    >
                      <div className="p-4 bg-gradient-to-b from-blue-900/20 to-purple-900/10">
                        <div className="flex items-start">
                          <div className="bg-gradient-to-br from-blue-500 to-purple-600 w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 mr-4">
                            {index + 1}
                          </div>
                          <div className="text-neutral-200 pt-1">
                            {suggestion}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="mb-4 opacity-20">
                    <path d="M9.51445 4.59997C13.0003 0.329972 21.0003 5.59997 14.0145 10.9C7.02868 16.2 15.0287 21.4 18.5145 17.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 19C5 17 3.5 13 7.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 8C5 8.83333 7 11.2 7 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p className="text-lg">暂无学习建议</p>
                  <p className="text-sm mt-2">系统会根据您的学习模式和内容生成专属建议</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 知识图谱标签页 - 全屏化增强版 */}
        <TabsContent value="knowledge-graph">
          {knowledgeGraph?.nodes && knowledgeGraph.nodes.length > 0 ? (
            <div className="relative h-[calc(100vh-200px)] w-full">
              {/* 全屏模式下的知识图谱 */}
              <div className="absolute inset-0 bg-gradient-to-b from-blue-950/60 to-purple-950/40 rounded-lg border border-blue-900/30 p-4">
                {/* 顶部操作栏 */}
                <div className="flex justify-between items-center mb-3 p-2 bg-gray-900/80 rounded-md backdrop-blur-sm">
                  <div className="flex items-center">
                    <Network className="h-5 w-5 mr-2 text-blue-400" />
                    <h3 className="text-lg font-medium text-white">知识连接图谱</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="bg-gray-800/70 text-white border-gray-700 hover:bg-gray-700"
                      onClick={() => {
                        if (user?.userId) {
                          // 刷新知识图谱数据
                          fetch(`/api/learning-path/${user.userId}/knowledge-graph?refresh=true`, {
                            headers: { 'Cache-Control': 'no-cache' }
                          })
                            .then(res => res.json())
                            .then(data => {
                              console.log(`知识图谱数据刷新成功: ${data.nodes.length}个节点`);
                              // 强制刷新页面以显示新数据
                              window.location.reload();
                            })
                            .catch(err => {
                              console.error("知识图谱数据刷新失败:", err);
                              alert("刷新知识图谱失败，请稍后再试");
                            });
                        }
                      }}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      刷新
                    </Button>
                    {user?.userId === 6 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-gray-800/70 text-white border-gray-700 hover:bg-gray-700"
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
                      >
                        生成测试数据
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* 知识图谱可视化区域 */}
                <div className="h-[calc(100%-60px)] w-full relative overflow-hidden rounded-lg">
                  <StaticKnowledgeGraph
                    nodes={knowledgeGraph.nodes}
                    links={knowledgeGraph.links}
                    width={window.innerWidth - 80} // 留出边距
                    height={window.innerHeight - 280} // 留出页面头部和底部的空间
                    onNodeClick={(nodeId) => {
                      const node = knowledgeGraph.nodes.find(n => n.id === nodeId);
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
                
                {/* 图例说明 */}
                <div className="absolute bottom-4 left-4 z-10 bg-gray-900/60 p-3 rounded-lg">
                  <p className="text-sm font-medium mb-2 text-white">图例</p>
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
                
                {/* 统计信息 */}
                <div className="absolute bottom-4 right-4 z-10 bg-gray-900/60 p-3 rounded-lg">
                  <div className="text-sm text-gray-300">
                    <span className="font-medium">节点数:</span> {knowledgeGraph.nodes.length}
                    <span className="mx-2">|</span>
                    <span className="font-medium">关联数:</span> {knowledgeGraph.links.length}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Network className="mr-2" /> 知识关联图谱
                </CardTitle>
                <CardDescription>
                  您的知识主题和它们之间的关联
                </CardDescription>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}