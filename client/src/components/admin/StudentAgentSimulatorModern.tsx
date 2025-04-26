import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Brain,
  GraduationCap,
  MessageSquare,
  UserCircle,
  PlayCircle,
  Clock,
  CheckCircle,
  XCircle,
  PauseCircle,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// 类型定义
interface User {
  id: number;
  username: string;
  role: string;
}

interface StudentAgentPreset {
  id: number;
  name: string;
  subject: string;
  gradeLevel: string;
  cognitiveLevel: string;
  motivationLevel: string;
  learningStyle: string;
  personalityTrait: string;
}

interface SimulationSession {
  id: string;
  userId: number;
  username: string;
  presetId: number;
  presetName: string;
  startTime: string;
  endTime?: string;
  messageCount: number;
  status: "waiting" | "running" | "completed" | "failed";
  simulationLog?: string[];
}

// 创建会话返回类型
interface NewSession {
  id: string;
  userId: number;
  username: string;
  presetId: number;
  presetName: string;
  startTime: string;
  messageCount: number;
  status: "running";
  simulationLog: string[];
}

export function StudentAgentSimulatorModern() {
  const queryClient = useQueryClient();
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [initialPrompt, setInitialPrompt] = useState<string>("你好，我想学习中文");
  const [maxMessages, setMaxMessages] = useState<number>(20);
  const [activeTab, setActiveTab] = useState<string>("setup");
  const [activeSessions, setActiveSessions] = useState<SimulationSession[]>([]);

  // 获取预设列表
  const { data: presets, isLoading: loadingPresets } = useQuery({
    queryKey: ["/api/student-agent/presets"],
    queryFn: async () => {
      const response = await fetch("/api/student-agent/presets?userId=1");
      if (!response.ok) throw new Error("Failed to fetch presets");
      return response.json();
    },
  });

  // 获取用户列表
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await fetch(`/api/users?userId=${user.userId}`);
      if (!response.ok) throw new Error("Failed to fetch users");
      const allUsers = await response.json();
      return allUsers.filter((user: User) => user.role !== "admin");
    },
  });

  // 启动模拟会话
  const startSimulationMutation = useMutation({
    mutationFn: async (): Promise<SimulationSession> => {
      // 实际应用中，这里应该向服务器发送请求启动模拟会话
      // 目前只是模拟这个过程
      
      // 确保非空值
      if (selectedUser === null || selectedPreset === null) {
        throw new Error("用户ID和预设ID不能为空");
      }
      
      return {
        id: `sim-${Date.now()}`,
        userId: selectedUser,
        username: users?.find((u: User) => u.id === selectedUser)?.username || "未知用户",
        presetId: selectedPreset,
        presetName: presets?.find((p: StudentAgentPreset) => p.id === selectedPreset)?.name || "未知预设",
        startTime: new Date().toISOString(),
        messageCount: 0,
        status: "running",
        simulationLog: [`[${new Date().toLocaleTimeString()}] 会话已启动`],
      };
    },
    onSuccess: (newSession) => {
      // 添加新会话到活动会话列表
      setActiveSessions(prev => [...prev, newSession]);
      // 自动切换到会话列表标签页
      setActiveTab("sessions");
      // 清空表单
      setInitialPrompt("你好，我想学习中文");
    },
  });

  // 模拟目前未实现的API - 实际应用中应该通过WebSocket或轮询获取
  useEffect(() => {
    const interval = setInterval(() => {
      // 更新活动会话状态 (模拟)
      setActiveSessions(prev => 
        prev.map(session => {
          if (session.status === 'running') {
            // 随机增加消息数，模拟进度
            const newCount = Math.min(session.messageCount + Math.floor(Math.random() * 2), maxMessages);
            
            // 如果达到最大消息数，标记为完成
            const isCompleted = newCount >= maxMessages;
            
            // 添加日志消息
            const newLog = [
              ...(session.simulationLog || []),
            ];
            
            if (newCount > session.messageCount) {
              newLog.push(`[${new Date().toLocaleTimeString()}] 生成了新消息，当前进度 ${newCount}/${maxMessages}`);
            }
            
            // isCompleted 确定是否已完成，添加完成日志
            if (isCompleted) {
              newLog.push(`[${new Date().toLocaleTimeString()}] 会话已完成`);
            }
            
            return {
              ...session,
              messageCount: newCount,
              status: isCompleted ? 'completed' : 'running',
              endTime: isCompleted ? new Date().toISOString() : undefined,
              simulationLog: newLog
            };
          }
          return session;
        })
      );
    }, 3000);

    return () => clearInterval(interval);
  }, [maxMessages]);

  return (
    <div className="space-y-6 fade-in">
      {/* 标题和说明 */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          学生智能体模拟器
        </h2>
        <p className="text-neutral-400">
          创建、测试和评估虚拟学生智能体，以验证和改进教学系统的适应性
        </p>
      </div>

      <Card className="admin-card">
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 bg-neutral-800">
              <TabsTrigger value="setup" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <Brain className="h-4 w-4 mr-2" />
                模拟设置
              </TabsTrigger>
              <TabsTrigger value="sessions" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <MessageSquare className="h-4 w-4 mr-2" />
                活动会话
                {activeSessions.length > 0 && 
                  <Badge variant="secondary" className="ml-2 bg-primary/20 text-primary">{activeSessions.length}</Badge>
                }
              </TabsTrigger>
            </TabsList>
            
            {/* 设置面板 */}
            <TabsContent value="setup">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="preset" className="text-white">选择学生智能体预设</Label>
                    <Select 
                      value={selectedPreset?.toString() || ''} 
                      onValueChange={(value) => setSelectedPreset(parseInt(value, 10))}
                      disabled={loadingPresets}
                    >
                      <SelectTrigger id="preset" className="bg-neutral-800 border-neutral-700">
                        <SelectValue placeholder="选择学生智能体预设" />
                      </SelectTrigger>
                      <SelectContent>
                        {presets?.map((preset: StudentAgentPreset) => (
                          <SelectItem key={preset.id} value={preset.id.toString()}>
                            {preset.name} - {preset.subject} ({preset.gradeLevel})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="user" className="text-white">选择用户账户</Label>
                    <Select 
                      value={selectedUser?.toString() || ''} 
                      onValueChange={(value) => setSelectedUser(parseInt(value, 10))}
                      disabled={loadingUsers}
                    >
                      <SelectTrigger id="user" className="bg-neutral-800 border-neutral-700">
                        <SelectValue placeholder="选择用户账户" />
                      </SelectTrigger>
                      <SelectContent>
                        {users?.map((user: User) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="maxMessages" className="text-white">最大消息数量</Label>
                    <Input 
                      id="maxMessages" 
                      type="number" 
                      min="5" 
                      max="50"
                      value={maxMessages}
                      onChange={(e) => setMaxMessages(parseInt(e.target.value, 10))}
                      className="bg-neutral-800 border-neutral-700"
                    />
                    <p className="text-xs text-neutral-400">
                      设置模拟会话中的最大消息数量 (5-50)
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="initialPrompt" className="text-white">初始提示词</Label>
                    <Textarea 
                      id="initialPrompt" 
                      value={initialPrompt}
                      onChange={(e) => setInitialPrompt(e.target.value)}
                      rows={3}
                      className="bg-neutral-800 border-neutral-700 resize-none"
                    />
                    <p className="text-xs text-neutral-400">
                      学生智能体将使用这个提示开始对话
                    </p>
                  </div>
                  
                  <Button 
                    className="w-full mt-4"
                    disabled={!selectedPreset || !selectedUser || startSimulationMutation.isPending}
                    onClick={() => startSimulationMutation.mutate()}
                  >
                    {startSimulationMutation.isPending ? 
                      <>
                        <Clock className="mr-2 h-4 w-4 animate-spin" />
                        正在启动...
                      </> : 
                      <>
                        <PlayCircle className="mr-2 h-4 w-4" />
                        开始模拟会话
                      </>
                    }
                  </Button>
                </div>
                
                <div>
                  {selectedPreset && presets ? (
                    <Card className="bg-neutral-900/50 border-neutral-800">
                      <CardHeader className="pb-2">
                        <div className="flex items-center">
                          <GraduationCap className="h-5 w-5 text-primary mr-2" />
                          <CardTitle className="text-lg text-white">预设详情</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {presets.find((p: StudentAgentPreset) => p.id === selectedPreset) && (
                          <div className="grid grid-cols-2 gap-y-3 text-sm">
                            <div className="font-medium text-white">学科:</div>
                            <div className="text-neutral-300">{presets.find((p: StudentAgentPreset) => p.id === selectedPreset)?.subject}</div>
                            
                            <div className="font-medium text-white">年级:</div>
                            <div className="text-neutral-300">{presets.find((p: StudentAgentPreset) => p.id === selectedPreset)?.gradeLevel}</div>
                            
                            <div className="font-medium text-white">认知能力:</div>
                            <div className="text-neutral-300">{presets.find((p: StudentAgentPreset) => p.id === selectedPreset)?.cognitiveLevel}</div>
                            
                            <div className="font-medium text-white">学习动机:</div>
                            <div className="text-neutral-300">{presets.find((p: StudentAgentPreset) => p.id === selectedPreset)?.motivationLevel}</div>
                            
                            <div className="font-medium text-white">学习风格:</div>
                            <div className="text-neutral-300">{presets.find((p: StudentAgentPreset) => p.id === selectedPreset)?.learningStyle}</div>
                            
                            <div className="font-medium text-white">性格特征:</div>
                            <div className="text-neutral-300">{presets.find((p: StudentAgentPreset) => p.id === selectedPreset)?.personalityTrait}</div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-6 bg-neutral-900/30 rounded-lg border border-dashed border-neutral-800">
                      <GraduationCap className="h-12 w-12 text-neutral-700 mb-4" />
                      <p className="text-neutral-500 text-center">
                        选择一个智能体预设来查看详细配置信息
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            {/* 会话列表面板 */}
            <TabsContent value="sessions">
              {activeSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 bg-neutral-900/30 rounded-lg border border-dashed border-neutral-800">
                  <MessageSquare className="h-12 w-12 text-neutral-700 mb-4" />
                  <p className="text-neutral-500 text-center mb-4">
                    尚未启动任何模拟会话
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => setActiveTab("setup")}
                  >
                    创建新模拟
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeSessions.map((session) => (
                    <Card 
                      key={session.id} 
                      className={cn(
                        "admin-card student-agent-card",
                        session.status === 'running' ? 'running' : 
                        session.status === 'completed' ? 'completed' : 
                        session.status === 'failed' ? 'failed' : ''
                      )}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <UserCircle className="h-5 w-5 text-primary" />
                            <CardTitle className="text-base text-white">
                              {session.presetName} → {session.username}
                            </CardTitle>
                          </div>
                          <Badge variant={
                            session.status === 'running' ? 'default' : 
                            session.status === 'completed' ? 'secondary' : 
                            session.status === 'failed' ? 'destructive' : 
                            'outline'
                          }>
                            {session.status === 'running' ? 
                              <span className="flex items-center">
                                <span className="animate-pulse mr-1.5 h-1.5 w-1.5 rounded-full bg-primary"></span>
                                运行中
                              </span> : 
                             session.status === 'completed' ? 
                              <span className="flex items-center">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                已完成
                              </span> : 
                             session.status === 'failed' ? 
                              <span className="flex items-center">
                                <XCircle className="h-3 w-3 mr-1" />
                                失败
                              </span> : 
                              <span className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                等待中
                              </span>
                            }
                          </Badge>
                        </div>
                        <CardDescription>
                          会话ID: {session.id} | 开始时间: {new Date(session.startTime).toLocaleString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-neutral-400">进度:</span>
                            <span className="text-neutral-300">{session.messageCount}/{maxMessages}</span>
                          </div>
                          <Progress 
                            value={(session.messageCount / maxMessages) * 100} 
                            className={`h-2 ${
                              session.status === 'running' ? "bg-primary" : 
                              session.status === 'completed' ? "bg-green-500" : 
                              "bg-neutral-500"
                            }`}
                          />
                          
                          <Separator className="my-2" />
                          
                          <div className="max-h-32 overflow-y-auto text-xs bg-neutral-800/50 p-2 rounded scrollbar-hide">
                            {session.simulationLog?.map((log, index) => (
                              <div key={index} className="pb-1 text-neutral-400">
                                {log}
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter>
                        <div className="flex justify-between w-full">
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled={session.status !== 'completed'}
                            className="text-xs"
                          >
                            <Brain className="h-3.5 w-3.5 mr-1" />
                            查看记忆
                          </Button>
                          
                          <Button 
                            variant={session.status === 'running' ? 'destructive' : 'secondary'} 
                            size="sm"
                            disabled={session.status !== 'running'}
                            className="text-xs"
                          >
                            {session.status === 'running' ? 
                              <>
                                <PauseCircle className="h-3.5 w-3.5 mr-1" />
                                停止
                              </> : 
                              <>
                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                移除
                              </>
                            }
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}