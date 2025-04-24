import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, BookOpen, Brain, BarChart3, Network, ArrowLeftCircle, RefreshCw, Maximize, Minimize, Sparkles, HelpCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from "wouter";
import TextNodeForceGraph from "@/components/TextNodeForceGraph";
// 导入学习轨迹页面的iPad滚动修复CSS
import "@/components/ui/learning-path-fixes.css";
// 导入知识图谱样式
import "@/components/ui/knowledge-graph-fixes.css";
// 导入知识图谱预加载器
import { preloadKnowledgeGraphData } from '@/lib/knowledge-graph-preloader';
// 导入知识图谱图例组件
import KnowledgeGraphLegend from '@/components/KnowledgeGraphLegend';

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
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [graphData, setGraphData] = useState<KnowledgeGraph | null>(null);

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

  // 注意：知识图谱数据加载已经移至下面的useEffect中，这里不再需要单独的预加载

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
  
  // 加载知识图谱数据 - 使用预加载和自定义state管理方案
  useEffect(() => {
    if (user?.userId) {
      // 设置加载状态
      setIsGraphLoading(true);
      
      // 使用预加载函数获取数据
      preloadKnowledgeGraphData(user.userId)
        .then(data => {
          // 成功获取数据后，更新状态
          setGraphData(data);
          console.log(`知识图谱数据加载成功: ${data.nodes.length}个节点, ${data.links.length}个连接`);
        })
        .catch(err => {
          console.error("知识图谱数据加载失败:", err);
        })
        .finally(() => {
          // 无论成功失败，都结束加载状态
          setIsGraphLoading(false);
        });
    }
  }, [user?.userId]);

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
      {/* 改进后的顶部布局 - 标题在最上方，按钮在下方 */}
      <div 
        className="sticky top-0 z-10 bg-opacity-80 backdrop-blur-md"
        style={{
          backgroundColor: 'rgba(13, 17, 23, 0.8)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 10,
          marginBottom: '16px',
          padding: '8px 0'
        }}
      >
        {/* 标题部分 - 水平布局 */}
        <div className="flex items-center justify-center mb-2">
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-1.5 rounded-lg mr-2">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-bold">我的学习轨迹</h1>
        </div>
        
        {/* 按钮行 - 仅包含按钮 */}
        <div className="flex gap-2 justify-center">
          <Button 
            variant="default" 
            size="sm"
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => setLocation(`/memory-space`)}
          >
            <BookOpen size={16} />
            <span>记忆空间</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            className="flex items-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700"
            onClick={navigateBack}
          >
            <ArrowLeftCircle size={16} />
            <span>返回聊天</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">总览</TabsTrigger>
          <TabsTrigger value="knowledge-graph">知识图谱</TabsTrigger>
          <TabsTrigger value="graph-rules">图谱规则</TabsTrigger>
          <TabsTrigger value="suggestions">学习建议</TabsTrigger>
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
                  <BarChart3 className="mr-2" /> 学习分布
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
                    <p>暂无学习分布数据</p>
                    <p className="text-sm mt-1">随着您的持续学习，这里将显示您的分布</p>
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

        {/* 学习分布标签页 */}
        <TabsContent value="progress">
          <Card>
            <CardHeader>
              <CardTitle>详细学习分布</CardTitle>
              <CardDescription>各主题学习分布分析</CardDescription>
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
                  <p className="text-lg">暂无详细学习分布数据</p>
                  <p className="text-sm mt-2">随着您的持续学习，这里将显示更详细的学习分布</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 图谱规则标签页 - 新增 */}
        <TabsContent value="graph-rules">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Info className="mr-2 h-5 w-5" /> 知识图谱说明
              </CardTitle>
              <CardDescription>了解知识图谱中不同关系类型与颜色的含义</CardDescription>
            </CardHeader>
            <CardContent className="card-content">
              <div className="p-4 border rounded-lg bg-black/30 mb-5">
                <h3 className="text-lg font-medium text-blue-300 mb-3">知识图谱简介</h3>
                <p className="text-neutral-300 mb-3">
                  知识图谱是对您学习过程中涉及的概念、主题和它们之间关系的可视化表示。它能帮助您理解不同知识点之间的联系，发现学习路径，并更好地组织知识结构。
                </p>
                <div className="flex items-start text-neutral-300 space-y-2 flex-col mb-3">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-blue-400" />
                    <span className="font-medium">如何使用:</span> 
                  </div>
                  <ul className="list-disc pl-10 space-y-1 text-sm text-neutral-300">
                    <li>点击节点查看详细信息</li>
                    <li>拖动节点可以调整布局</li>
                    <li>滚轮可以缩放图表</li>
                    <li>点击"刷新数据"可更新最新的知识结构</li>
                  </ul>
                </div>
              </div>
              
              {/* 使用独立的图例组件 */}
              <KnowledgeGraphLegend />
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

        {/* 知识图谱标签页 - 高性能优化版 */}
        <TabsContent value="knowledge-graph">
          {isGraphLoading ? (
            // 加载状态 - 使用骨架屏减少加载时的布局偏移
            <div className="relative h-[calc(100vh-200px)] w-full">
              <div className="absolute inset-0 bg-gradient-to-b from-blue-950/30 to-purple-950/20 rounded-lg border border-blue-900/20 p-4">
                <div className="flex justify-between items-center mb-3 p-2 bg-gray-900/60 rounded-md backdrop-blur-sm">
                  <div className="h-8 w-48 bg-gray-800/70 rounded animate-pulse"></div>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-20 bg-gray-800/70 rounded animate-pulse"></div>
                  </div>
                </div>
                
                <div className="h-[calc(100%-60px)] w-full flex flex-col items-center justify-center">
                  <div className="w-16 h-16 border-t-4 border-b-4 border-indigo-500 rounded-full animate-spin mb-4"></div>
                  <div className="text-indigo-400 font-medium text-center mb-2">正在加载知识图谱</div>
                  <div className="text-gray-400 text-sm max-w-md text-center">
                    绘制知识连接，优化展示效果...
                  </div>
                </div>
              </div>
            </div>
          ) : graphData?.nodes && graphData.nodes.length > 0 ? (
            <div className="relative h-[calc(100vh-200px)] w-full">
              {/* 全屏模式下的知识图谱 */}
              <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/40 to-purple-950/30 rounded-lg border border-indigo-900/30 p-4 overflow-hidden">
                {/* 顶部操作栏 */}
                <div className="flex justify-between items-center mb-3 p-2 bg-gray-900/80 rounded-md backdrop-blur-sm">
                  <div className="flex items-center">
                    <div className="bg-indigo-600 rounded-full p-1 mr-2">
                      <Network className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="text-lg font-medium text-white">知识连接图谱</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="bg-gray-800/70 text-white border-gray-700 hover:bg-gray-700"
                      onClick={() => {
                        if (user?.userId) {
                          setIsGraphLoading(true);
                          // 刷新知识图谱数据 - 使用真实聚类结果
                          fetch(`/api/learning-path/${user.userId}/knowledge-graph?refresh=true&use_real_clusters=true`, {
                            headers: { 'Cache-Control': 'no-cache' }
                          })
                            .then(res => res.json())
                            .then(data => {
                              console.log(`知识图谱数据刷新成功: ${data.nodes.length}个节点`);
                              // 预加载新数据并刷新本地缓存
                              preloadKnowledgeGraphData(user.userId, true)
                                .then((data) => {
                                  // 使用新加载的数据更新状态，而不是重新加载整个页面
                                  if (data && data.nodes && data.links) {
                                    setGraphData(data);
                                  }
                                  setIsGraphLoading(false);
                                });
                            })
                            .catch(err => {
                              console.error("知识图谱数据刷新失败:", err);
                              alert("刷新知识图谱失败，请稍后再试");
                              setIsGraphLoading(false);
                            });
                        }
                      }}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${isGraphLoading ? 'animate-spin' : ''}`} />
                      刷新数据
                    </Button>
                  </div>
                </div>
                
                {/* 知识图谱可视化区域 */}
                <div className="h-[calc(100%-60px)] w-full relative rounded-lg bg-indigo-950/10 border border-indigo-900/10 overflow-hidden">
                  <div className="absolute inset-0" style={{ backdropFilter: 'blur(2px)' }}>
                    {/* 使用优化后的文本节点力导向图 */}
                    <TextNodeForceGraph
                      nodes={graphData?.nodes || []}
                      links={graphData?.links || []}
                      width={window.innerWidth - 80} // 留出边距
                      height={window.innerHeight - 280} // 留出页面头部和底部的空间
                      onNodeClick={(nodeId) => {
                        const node = graphData?.nodes?.find((n: any) => n.id === nodeId);
                        if (node) {
                          console.log(`点击了节点: ${node.label || nodeId}`);
                          
                          // 提供更美观的节点信息展示，不使用原生alert
                          const nodeType = node.category === 'cluster' ? '主题' : 
                                          node.category === 'keyword' ? '关键词' : '记忆';
                          
                          // 使用自定义样式而非alert
                          const infoDiv = document.createElement('div');
                          infoDiv.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-900/90 p-4 rounded-lg border border-indigo-500 z-50 max-w-md backdrop-blur-md shadow-lg';
                          infoDiv.style.animation = 'fadeIn 0.2s ease-out';
                          
                          let typeColor = node.category === 'cluster' ? 'text-indigo-400' : 
                                        node.category === 'keyword' ? 'text-emerald-400' : 'text-amber-400';
                          
                          infoDiv.innerHTML = `
                            <div class="flex items-center mb-2">
                              <div class="h-3 w-3 rounded-full ${node.category === 'cluster' ? 'bg-indigo-500' : 
                                                              node.category === 'keyword' ? 'bg-emerald-500' : 'bg-amber-500'} mr-2"></div>
                              <span class="${typeColor} font-medium">${nodeType}</span>
                            </div>
                            <div class="text-white text-lg font-bold mb-1">${node.label}</div>
                            <div class="flex justify-end mt-3">
                              <button class="bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1 rounded text-sm">关闭</button>
                            </div>
                          `;
                          
                          document.body.appendChild(infoDiv);
                          
                          // 点击关闭或点击外部区域关闭
                          const closeBtn = infoDiv.querySelector('button');
                          const closeInfo = () => {
                            infoDiv.style.animation = 'fadeOut 0.2s ease-out forwards';
                            setTimeout(() => {
                              if (document.body.contains(infoDiv)) {
                                document.body.removeChild(infoDiv);
                              }
                            }, 200);
                          };
                          
                          closeBtn?.addEventListener('click', closeInfo);
                          document.addEventListener('click', function onDocClick(e) {
                            if (!infoDiv.contains(e.target as Node)) {
                              closeInfo();
                              document.removeEventListener('click', onDocClick);
                            }
                          }, { once: true });
                          
                          // 自动消失
                          setTimeout(closeInfo, 4000);
                        }
                      }}
                    />
                  </div>
                </div>
                
                {/* 组合图例和统计信息，使界面更简洁 */}
                <div className="absolute bottom-4 left-4 z-10 bg-gray-900/80 p-3 rounded-lg backdrop-blur-sm border border-gray-800 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-white">知识节点统计</p>
                    <p className="text-xs text-gray-400">
                      {graphData?.nodes?.length || 0}个节点 | {graphData?.links?.length || 0}个连接
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                      <span className="text-xs text-gray-300">主题</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                      <span className="text-xs text-gray-300">关键词</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                      <span className="text-xs text-gray-300">记忆</span>
                    </div>
                  </div>
                </div>
                
                {/* 帮助提示 */}
                <div className="absolute top-20 right-4 z-10 bg-gray-900/70 p-2 rounded-lg text-xs text-gray-400 backdrop-blur-sm border border-indigo-900/20">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    点击节点查看详细信息
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