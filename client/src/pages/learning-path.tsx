import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, BookOpen, Brain, BarChart3, Network } from "lucide-react";

export default function LearningPath() {
  const [userId, setUserId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // 从localStorage获取用户信息
  useEffect(() => {
    try {
      const storedUserId = localStorage.getItem("userId");
      const storedUserRole = localStorage.getItem("userRole");
      if (storedUserId) {
        setUserId(parseInt(storedUserId));
      }
      if (storedUserRole) {
        setUserRole(storedUserRole);
      }
    } catch (error) {
      console.error("获取用户信息失败:", error);
    }
  }, []);

  // 获取学习轨迹数据
  const { data: learningPath, isLoading, error } = useQuery({
    queryKey: ["/api/learning-path", userId],
    queryFn: async () => {
      const response = await fetch(`/api/learning-path/${userId}`);
      if (!response.ok) {
        throw new Error("获取学习轨迹失败");
      }
      return response.json();
    },
    enabled: !!userId,
  });

  // 如果用户未登录，显示提示信息
  if (!userId) {
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

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 flex items-center">
        <Brain className="mr-2" /> 我的学习轨迹
      </h1>

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
                      <div key={topic.id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{topic.topic}</span>
                          <span>{topic.percentage}%</span>
                        </div>
                        <Progress value={topic.percentage} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">暂无学习主题数据</p>
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
                    {learningPath.progress.map((item: any, index: number) => (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{item.topic || item.category}</span>
                          <span>{item.percentage || item.score}%</span>
                        </div>
                        <Progress value={item.percentage || item.score} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">暂无学习进度数据</p>
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
                <ul className="space-y-2">
                  {learningPath.suggestions.map((suggestion: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <ArrowRight className="h-5 w-5 mr-2 shrink-0 text-primary" />
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">暂无学习建议</p>
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
                  {learningPath.progress.map((item: any, index: number) => (
                    <div key={index}>
                      <h3 className="text-lg font-medium mb-2">
                        {item.topic || item.category}
                      </h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>掌握程度</span>
                          <span>{item.percentage || item.score}%</span>
                        </div>
                        <Progress value={item.percentage || item.score} />
                        {item.change !== undefined && (
                          <p className="text-sm text-muted-foreground">
                            较上次{item.change > 0 ? "提升" : "下降"}了 
                            {Math.abs(item.change)}%
                          </p>
                        )}
                      </div>
                      {index < learningPath.progress.length - 1 && (
                        <Separator className="my-4" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  继续学习和提问，系统将记录您的学习进度
                </p>
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
                <div className="space-y-6">
                  {learningPath.suggestions.map((suggestion: string, index: number) => (
                    <div key={index} className="p-4 border rounded-lg bg-card">
                      <div className="flex items-start">
                        <div className="bg-primary w-8 h-8 rounded-full flex items-center justify-center text-primary-foreground shrink-0 mr-4">
                          {index + 1}
                        </div>
                        <div>
                          <p>{suggestion}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  继续学习以获取个性化建议
                </p>
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
                <div className="h-[500px] flex items-center justify-center">
                  {/* 这里实际应该使用 ECharts 或其他图表库进行可视化 */}
                  <p className="text-muted-foreground">
                    知识图谱可视化将在后续版本中实现
                  </p>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-muted-foreground">
                    暂无足够数据生成知识图谱
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}