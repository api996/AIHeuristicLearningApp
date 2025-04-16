import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, BookOpen, Brain, BarChart3, Network, ArrowLeftCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

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
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
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
              <CardContent>
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
              <CardContent>
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
            <CardContent>
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
            <CardContent>
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
            <CardContent>
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

        {/* 知识图谱标签页 */}
        <TabsContent value="knowledge-graph">
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
              {learningPath?.knowledge_graph?.nodes && 
               learningPath.knowledge_graph.nodes.length > 0 ? (
                <div className="h-[500px] rounded-lg border border-blue-900/50 bg-gradient-to-b from-blue-950/20 to-purple-950/10 p-6">
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-3">
                      <div className="bg-blue-900/30 w-16 h-16 rounded-full mx-auto flex items-center justify-center">
                        <Network className="h-8 w-8 text-blue-400" />
                      </div>
                      <h3 className="text-lg text-blue-300">知识图谱可视化</h3>
                      <p className="text-sm text-neutral-400 max-w-lg">
                        系统已收集了您的学习数据，知识图谱可视化功能将在后续版本中提供，敬请期待！
                      </p>
                      <div className="pt-2 pb-1">
                        <div className="h-2 w-48 mx-auto bg-neutral-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-blue-600 animate-pulse" style={{width: '35%'}}></div>
                        </div>
                        <p className="text-xs text-neutral-500 mt-2">开发进度: 35%</p>
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
      </Tabs>
    </div>
  );
}