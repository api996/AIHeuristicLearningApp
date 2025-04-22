import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThumbsUp, ThumbsDown, Users, Activity, BarChart4 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// 颜色常量
const COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

interface FeedbackStatistics {
  totalMessages: number;
  totalFeedback: number;
  likesCount: number;
  dislikesCount: number;
  feedbackPercentage: number;
  userFeedbackStats: {
    userId: number;
    username: string;
    totalFeedback: number;
    likes: number;
    dislikes: number;
    feedbackRate: number;
  }[];
  modelFeedbackStats: {
    model: string;
    totalMessages: number;
    likes: number;
    dislikes: number;
    likeRate: number;
  }[];
  recentFeedback: {
    id: number;
    userId: number;
    username: string;
    chatId: number;
    content: string;
    feedback: string;
    model: string;
    createdAt: string;
  }[];
}

// 获取模型名称缩写（用于显示）
const getModelDisplayName = (model: string): string => {
  if (!model) return "未指定";
  
  // 各种模型的缩写
  if (model.includes("gemini")) return "Gemini";
  if (model.includes("gpt")) return "GPT";
  if (model.includes("grok")) return "Grok";
  if (model.includes("deepseek")) return "DeepSeek";
  if (model.includes("deep")) return "Deep";
  if (model.includes("claude")) return "Claude";
  
  // 保留原名
  return model;
};

// 格式化日期
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

// 加载骨架屏
const LoadingSkeleton = () => (
  <div className="space-y-4">
    <Card className="bg-neutral-900 border-neutral-800">
      <CardHeader>
        <Skeleton className="h-6 w-48 bg-neutral-800" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24 bg-neutral-800" />
          <Skeleton className="h-24 bg-neutral-800" />
          <Skeleton className="h-24 bg-neutral-800" />
          <Skeleton className="h-24 bg-neutral-800" />
        </div>
      </CardContent>
    </Card>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <Skeleton className="h-6 w-40 bg-neutral-800" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 bg-neutral-800" />
        </CardContent>
      </Card>
      
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <Skeleton className="h-6 w-40 bg-neutral-800" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 bg-neutral-800" />
        </CardContent>
      </Card>
    </div>
    
    <Card className="bg-neutral-900 border-neutral-800">
      <CardHeader>
        <Skeleton className="h-6 w-40 bg-neutral-800" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-80 bg-neutral-800" />
      </CardContent>
    </Card>
  </div>
);

// 反馈统计组件
export function FeedbackAnalytics() {
  const [recentTab, setRecentTab] = useState<"all" | "like" | "dislike">("all");
  
  // 获取反馈统计数据
  const { data: stats, isLoading, error } = useQuery<FeedbackStatistics>({
    queryKey: ["/api/admin/feedback-stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/feedback-stats");
      if (!response.ok) {
        throw new Error("Failed to fetch feedback statistics");
      }
      return response.json();
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  
  if (error || !stats) {
    return (
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-white">反馈统计加载失败</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400">
            {error instanceof Error ? error.message : "加载反馈统计数据时发生错误"}
          </p>
        </CardContent>
      </Card>
    );
  }

  // 准备图表数据
  const pieChartData = [
    { name: "喜欢", value: stats.likesCount, color: "#10b981" },
    { name: "不喜欢", value: stats.dislikesCount, color: "#ef4444" }
  ];
  
  // 准备模型反馈统计图表数据
  const modelChartData = stats.modelFeedbackStats.map(model => ({
    name: getModelDisplayName(model.model),
    总消息: model.totalMessages,
    喜欢: model.likes,
    不喜欢: model.dislikes,
    喜欢率: Math.round(model.likeRate * 100)
  }));
  
  // 根据当前标签过滤最近反馈
  const filteredRecentFeedback = stats.recentFeedback.filter(feedback => {
    if (recentTab === "all") return true;
    return feedback.feedback === recentTab;
  });

  return (
    <div className="space-y-6">
      {/* 总体统计卡片 */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-white">反馈统计概览</CardTitle>
          <CardDescription>AI助手回答的反馈数据分析</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-neutral-800 p-4 rounded-lg flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-gray-400 text-sm">总消息数</p>
                <Activity className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-white mt-2">{stats.totalMessages}</p>
              <p className="text-sm text-gray-400 mt-1">AI助手发送的总消息数</p>
            </div>
            
            <div className="bg-neutral-800 p-4 rounded-lg flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-gray-400 text-sm">收到反馈</p>
                <BarChart4 className="h-4 w-4 text-purple-500" />
              </div>
              <p className="text-2xl font-bold text-white mt-2">{stats.totalFeedback}</p>
              <div className="mt-1">
                <Progress 
                  value={stats.feedbackPercentage} 
                  className="h-1.5 bg-gray-700"
                />
                <p className="text-sm text-gray-400 mt-1">反馈率 {stats.feedbackPercentage.toFixed(1)}%</p>
              </div>
            </div>
            
            <div className="bg-neutral-800 p-4 rounded-lg flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-gray-400 text-sm">喜欢</p>
                <ThumbsUp className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-white mt-2">{stats.likesCount}</p>
              <div className="mt-1">
                <Progress 
                  value={(stats.likesCount / (stats.totalFeedback || 1)) * 100} 
                  className="h-1.5 bg-gray-700"
                />
                <p className="text-sm text-gray-400 mt-1">
                  占比 {stats.totalFeedback ? ((stats.likesCount / stats.totalFeedback) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
            
            <div className="bg-neutral-800 p-4 rounded-lg flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-gray-400 text-sm">不喜欢</p>
                <ThumbsDown className="h-4 w-4 text-red-500" />
              </div>
              <p className="text-2xl font-bold text-white mt-2">{stats.dislikesCount}</p>
              <div className="mt-1">
                <Progress 
                  value={(stats.dislikesCount / (stats.totalFeedback || 1)) * 100} 
                  className="h-1.5 bg-gray-700"
                />
                <p className="text-sm text-gray-400 mt-1">
                  占比 {stats.totalFeedback ? ((stats.dislikesCount / stats.totalFeedback) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 反馈饼图 */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-white">反馈分布</CardTitle>
            <CardDescription>用户对AI回答的反馈比例</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => 
                      `${name}: ${(percent * 100).toFixed(1)}%`
                    }
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}个`, "数量"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 模型统计图表 */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-white">按模型分析</CardTitle>
            <CardDescription>不同AI模型的反馈情况对比</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={modelChartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#27272a', borderColor: '#3f3f46' }}
                    formatter={(value, name) => 
                      [name === "喜欢率" ? `${value}%` : value, name]
                    }
                  />
                  <Legend />
                  <Bar dataKey="喜欢" fill="#10b981" />
                  <Bar dataKey="不喜欢" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 用户反馈统计 */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-white">用户反馈统计</CardTitle>
          <CardDescription>按用户分组的反馈情况</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-gray-400">用户</TableHead>
                  <TableHead className="text-gray-400">反馈总数</TableHead>
                  <TableHead className="text-gray-400">喜欢</TableHead>
                  <TableHead className="text-gray-400">不喜欢</TableHead>
                  <TableHead className="text-gray-400">喜欢率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.userFeedbackStats.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-500" />
                      <span className="text-white">{user.username}</span>
                    </TableCell>
                    <TableCell>{user.totalFeedback}</TableCell>
                    <TableCell className="text-green-500">{user.likes}</TableCell>
                    <TableCell className="text-red-500">{user.dislikes}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={user.feedbackRate * 100} 
                          className="h-2 w-24 bg-gray-700" 
                        />
                        <span>{(user.feedbackRate * 100).toFixed(1)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 最近反馈 */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-white">最近反馈消息</CardTitle>
              <CardDescription>用户对AI回答的最新反馈</CardDescription>
            </div>
            <Tabs value={recentTab} onValueChange={(v) => setRecentTab(v as any)} className="w-full sm:w-auto">
              <TabsList className="bg-neutral-800">
                <TabsTrigger value="all">全部</TabsTrigger>
                <TabsTrigger value="like">喜欢</TabsTrigger>
                <TabsTrigger value="dislike">不喜欢</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRecentFeedback.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              暂无反馈数据
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRecentFeedback.map((item) => (
                <div key={item.id} className="bg-neutral-800 p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-300">{item.username}</span>
                      <Badge className={item.feedback === "like" ? "bg-green-700" : "bg-red-700"}>
                        {item.feedback === "like" ? (
                          <ThumbsUp className="h-3 w-3 mr-1" />
                        ) : (
                          <ThumbsDown className="h-3 w-3 mr-1" />
                        )}
                        {item.feedback === "like" ? "喜欢" : "不喜欢"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{getModelDisplayName(item.model)}</Badge>
                      <span className="text-xs text-gray-400">{formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                  <div className="text-gray-300 text-sm mt-1 whitespace-pre-wrap">
                    {item.content.length > 150 
                      ? `${item.content.substring(0, 150)}...` 
                      : item.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}