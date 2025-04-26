import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  BarChart4,
  LineChart,
  PieChart,
  History,
  CalendarDays,
  Filter,
  Download,
} from "lucide-react";

interface FeedbackData {
  modelName: string;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  totalCount: number;
}

interface MessageData {
  id: string;
  userId: number;
  username: string;
  messageContent: string;
  feedbackType: "positive" | "negative" | "neutral";
  createdAt: string;
  modelName: string;
}

export function FeedbackAnalyticsModern() {
  const [activeTab, setActiveTab] = useState("summary");
  const [activePeriod, setActivePeriod] = useState("7days");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // 获取反馈数据
  const { data: feedbackData, isLoading: loadingFeedback } = useQuery({
    queryKey: ["/api/admin/feedback-stats", activePeriod],
    queryFn: async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await fetch(`/api/admin/feedback-stats?userId=${user.userId}&period=${activePeriod}`);
      if (!response.ok) throw new Error("获取反馈数据失败");
      return response.json();
    },
  });

  // 获取最近的消息反馈
  const { data: recentFeedback, isLoading: loadingMessages } = useQuery({
    queryKey: ["/api/admin/recent-feedback", activePeriod, selectedModel],
    queryFn: async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      let url = `/api/admin/recent-feedback?userId=${user.userId}&period=${activePeriod}`;
      if (selectedModel) {
        url += `&modelName=${selectedModel}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error("获取反馈消息失败");
      return response.json();
    },
  });

  // 计算模型得分和百分比
  const calculateModelScore = (data: FeedbackData) => {
    if (data.totalCount === 0) return 0;
    return ((data.positiveCount - data.negativeCount) / data.totalCount) * 100;
  };

  const calculatePositivePercentage = (data: FeedbackData) => {
    if (data.totalCount === 0) return 0;
    return (data.positiveCount / data.totalCount) * 100;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 模拟数据（实际应用中，这应该来自API）
  const sampleFeedbackData: FeedbackData[] = [
    {
      modelName: "Gemini",
      positiveCount: 145,
      negativeCount: 12,
      neutralCount: 43,
      totalCount: 200
    },
    {
      modelName: "DeepSeek",
      positiveCount: 87,
      negativeCount: 8,
      neutralCount: 25,
      totalCount: 120
    },
    {
      modelName: "Grok",
      positiveCount: 63,
      negativeCount: 5,
      neutralCount: 17,
      totalCount: 85
    }
  ];

  const sampleMessageData: MessageData[] = [
    {
      id: "msg1",
      userId: 1,
      username: "user1",
      messageContent: "我非常喜欢这个解释，帮我理解了复杂的概念。",
      feedbackType: "positive",
      createdAt: new Date().toISOString(),
      modelName: "Gemini"
    },
    {
      id: "msg2",
      userId: 2,
      username: "user2",
      messageContent: "这个回答有些混乱，没有正确回答我的问题。",
      feedbackType: "negative",
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      modelName: "DeepSeek"
    },
    {
      id: "msg3",
      userId: 3,
      username: "user3",
      messageContent: "谢谢你的建议，很有帮助。",
      feedbackType: "positive",
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      modelName: "Gemini"
    },
    {
      id: "msg4",
      userId: 4,
      username: "user4",
      messageContent: "这个例子很好地解释了我的问题。",
      feedbackType: "positive",
      createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      modelName: "Grok"
    },
    {
      id: "msg5",
      userId: 5,
      username: "user5",
      messageContent: "解释不够清晰，还需要更多例子。",
      feedbackType: "neutral",
      createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
      modelName: "DeepSeek"
    }
  ];

  // 使用模拟数据替代API数据（仅在开发阶段）
  const modelData = feedbackData || sampleFeedbackData;
  const messageData = recentFeedback || sampleMessageData;

  return (
    <div className="space-y-6 fade-in">
      {/* 标题和描述 */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <ThumbsUp className="h-6 w-6 text-primary" />
          用户反馈分析
        </h2>
        <p className="text-neutral-400">
          分析用户对不同AI模型回复的反馈数据，优化AI表现和用户体验
        </p>
      </div>

      {/* 时间范围选择器 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-neutral-400">时间范围:</span>
        <div className="flex bg-neutral-800 rounded-md overflow-hidden">
          <Button
            variant="ghost"
            size="sm"
            className={`rounded-none ${activePeriod === '7days' ? 'bg-primary/20 text-primary' : 'text-neutral-400'}`}
            onClick={() => setActivePeriod('7days')}
          >
            近7天
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`rounded-none ${activePeriod === '30days' ? 'bg-primary/20 text-primary' : 'text-neutral-400'}`}
            onClick={() => setActivePeriod('30days')}
          >
            近30天
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`rounded-none ${activePeriod === '90days' ? 'bg-primary/20 text-primary' : 'text-neutral-400'}`}
            onClick={() => setActivePeriod('90days')}
          >
            近90天
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`rounded-none ${activePeriod === 'all' ? 'bg-primary/20 text-primary' : 'text-neutral-400'}`}
            onClick={() => setActivePeriod('all')}
          >
            全部
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">筛选</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">导出</span>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-neutral-800 mb-6">
          <TabsTrigger value="summary" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <BarChart4 className="h-4 w-4 mr-2" />
            总体概览
          </TabsTrigger>
          <TabsTrigger value="models" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <PieChart className="h-4 w-4 mr-2" />
            模型对比
          </TabsTrigger>
          <TabsTrigger value="messages" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <MessageSquare className="h-4 w-4 mr-2" />
            消息反馈
          </TabsTrigger>
          <TabsTrigger value="trends" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <LineChart className="h-4 w-4 mr-2" />
            趋势分析
          </TabsTrigger>
        </TabsList>

        {/* 总体概览选项卡 */}
        <TabsContent value="summary">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 总反馈数量卡片 */}
            <Card className="admin-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-950/30 flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="flex items-center gap-2 text-neutral-400 text-sm">
                    <History className="h-4 w-4" />
                    <span>{activePeriod === '7days' ? '7天' : activePeriod === '30days' ? '30天' : activePeriod === '90days' ? '90天' : '全部'}</span>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white">
                  {modelData.reduce((acc, curr) => acc + curr.totalCount, 0)}
                </h3>
                <p className="text-neutral-400 text-sm">总反馈数量</p>
              </CardContent>
            </Card>

            {/* 积极反馈数量卡片 */}
            <Card className="admin-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-green-950/30 flex items-center justify-center">
                    <ThumbsUp className="h-6 w-6 text-green-500" />
                  </div>
                  <div className="px-2 py-1 rounded bg-green-950/30 text-green-400 text-xs font-medium">
                    {Math.round(modelData.reduce((acc, curr) => acc + curr.positiveCount, 0) / modelData.reduce((acc, curr) => acc + curr.totalCount, 0) * 100)}%
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white">
                  {modelData.reduce((acc, curr) => acc + curr.positiveCount, 0)}
                </h3>
                <p className="text-neutral-400 text-sm">积极反馈</p>
              </CardContent>
            </Card>

            {/* 消极反馈数量卡片 */}
            <Card className="admin-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-red-950/30 flex items-center justify-center">
                    <ThumbsDown className="h-6 w-6 text-red-500" />
                  </div>
                  <div className="px-2 py-1 rounded bg-red-950/30 text-red-400 text-xs font-medium">
                    {Math.round(modelData.reduce((acc, curr) => acc + curr.negativeCount, 0) / modelData.reduce((acc, curr) => acc + curr.totalCount, 0) * 100)}%
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white">
                  {modelData.reduce((acc, curr) => acc + curr.negativeCount, 0)}
                </h3>
                <p className="text-neutral-400 text-sm">消极反馈</p>
              </CardContent>
            </Card>

            {/* 模型表现卡片 */}
            <Card className="admin-card md:col-span-3">
              <CardHeader>
                <CardTitle className="text-white">模型反馈表现</CardTitle>
                <CardDescription>各模型反馈满意度比较</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {modelData.map((model) => (
                    <div key={model.modelName} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center mr-3">
                            {model.modelName === "Gemini" ? (
                              <span className="text-blue-500 text-sm font-medium">G</span>
                            ) : model.modelName === "DeepSeek" ? (
                              <span className="text-purple-500 text-sm font-medium">D</span>
                            ) : (
                              <span className="text-amber-500 text-sm font-medium">X</span>
                            )}
                          </div>
                          <span className="text-white">{model.modelName}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <ThumbsUp className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-neutral-400">{model.positiveCount}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <ThumbsDown className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-neutral-400">{model.negativeCount}</span>
                          </div>
                          <span className="text-white font-medium">
                            {calculatePositivePercentage(model).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex">
                        <div 
                          className="h-2 bg-green-500 rounded-l-full"
                          style={{ width: `${calculatePositivePercentage(model)}%` }}
                        ></div>
                        <div 
                          className="h-2 bg-neutral-600"
                          style={{ width: `${(model.neutralCount / model.totalCount) * 100}%` }}
                        ></div>
                        <div 
                          className="h-2 bg-red-500 rounded-r-full"
                          style={{ width: `${(model.negativeCount / model.totalCount) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 模型对比选项卡 */}
        <TabsContent value="models">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {modelData.map((model) => (
              <Card key={model.modelName} className="admin-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center mr-3">
                        {model.modelName === "Gemini" ? (
                          <span className="text-blue-500 text-sm font-medium">G</span>
                        ) : model.modelName === "DeepSeek" ? (
                          <span className="text-purple-500 text-sm font-medium">D</span>
                        ) : (
                          <span className="text-amber-500 text-sm font-medium">X</span>
                        )}
                      </div>
                      {model.modelName}
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setSelectedModel(model.modelName)}>
                      详情
                    </Button>
                  </div>
                  <CardDescription>
                    总反馈数: {model.totalCount}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-3 rounded-lg bg-neutral-800/50">
                      <div className="text-xl font-bold text-green-400">{model.positiveCount}</div>
                      <div className="text-xs text-neutral-400">积极反馈</div>
                    </div>
                    <div className="p-3 rounded-lg bg-neutral-800/50">
                      <div className="text-xl font-bold text-neutral-400">{model.neutralCount}</div>
                      <div className="text-xs text-neutral-400">中性反馈</div>
                    </div>
                    <div className="p-3 rounded-lg bg-neutral-800/50">
                      <div className="text-xl font-bold text-red-400">{model.negativeCount}</div>
                      <div className="text-xs text-neutral-400">消极反馈</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-400">满意度评分</span>
                      <span className="text-white font-medium">{calculateModelScore(model).toFixed(1)}</span>
                    </div>
                    <Progress 
                      value={calculatePositivePercentage(model)} 
                      className="h-2" 
                    />
                    <div className="flex justify-between text-xs text-neutral-500">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="admin-card md:col-span-2">
              <CardHeader>
                <CardTitle className="text-white">模型表现比较</CardTitle>
                <CardDescription>
                  基于用户反馈的各模型表现排名
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center">
                  <div className="text-neutral-500 flex flex-col items-center">
                    <BarChart4 className="h-10 w-10 mb-2" />
                    <p>详细比较图表将在未来版本中推出</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 消息反馈选项卡 */}
        <TabsContent value="messages">
          <Card className="admin-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">最近反馈消息</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedModel(null)} disabled={!selectedModel}>
                    {selectedModel ? `清除 ${selectedModel} 筛选` : '全部模型'}
                  </Button>
                </div>
              </div>
              <CardDescription>
                {selectedModel 
                  ? `显示 ${selectedModel} 模型的用户反馈` 
                  : '所有模型的用户反馈消息'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {messageData.map((message) => (
                    <div 
                      key={message.id} 
                      className={`p-4 rounded-lg ${
                        message.feedbackType === 'positive' ? 'bg-green-950/20 border-l-4 border-green-500' : 
                        message.feedbackType === 'negative' ? 'bg-red-950/20 border-l-4 border-red-500' : 
                        'bg-neutral-800/70 border-l-4 border-neutral-600'
                      }`}
                    >
                      <div className="flex justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center">
                            <span className="text-primary text-sm font-medium">
                              {message.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-white">{message.username}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-neutral-400">
                            <CalendarDays className="h-3 w-3 inline mr-1" />
                            {formatDate(message.createdAt)}
                          </div>
                          <div className="px-2 py-1 rounded bg-neutral-800 text-xs">
                            {message.modelName}
                          </div>
                          {message.feedbackType === 'positive' ? (
                            <ThumbsUp className="h-4 w-4 text-green-500" />
                          ) : message.feedbackType === 'negative' ? (
                            <ThumbsDown className="h-4 w-4 text-red-500" />
                          ) : (
                            <MessageSquare className="h-4 w-4 text-neutral-500" />
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-neutral-200">
                        {message.messageContent}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
            <CardFooter className="flex justify-center py-4">
              <Button variant="outline">加载更多</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* 趋势分析选项卡 */}
        <TabsContent value="trends">
          <Card className="admin-card">
            <CardHeader>
              <CardTitle className="text-white">反馈趋势分析</CardTitle>
              <CardDescription>
                时间序列分析显示不同时期的反馈变化趋势
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center">
                <div className="text-neutral-500 flex flex-col items-center">
                  <LineChart className="h-10 w-10 mb-2" />
                  <p>趋势分析图表将在未来版本中推出</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}