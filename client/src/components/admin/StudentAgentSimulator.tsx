import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: number;
  username: string;
  role: string;
}

interface StudentAgentPreset {
  id: number;
  name: string;
  description: string;
  subject: string;
  gradeLevel: string;
  cognitiveLevel: string;
  motivationLevel: string;
  learningStyle: string;
  personalityTrait: string;
}

interface SimulationSession {
  id: number;
  presetId: number;
  presetName: string;
  userId: number;
  username: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  messageCount: number;
  startTime: string;
  endTime?: string;
  simulationLog?: string[];
}

export function StudentAgentSimulator() {
  const { toast } = useToast();
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [maxMessages, setMaxMessages] = useState(10);
  const [initialPrompt, setInitialPrompt] = useState("你好，我想学习一些新知识。");
  const [activeSessions, setActiveSessions] = useState<SimulationSession[]>([]);
  const [activeTab, setActiveTab] = useState('setup');

  // 获取所有用户（不包括管理员）
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['/api/users'],
    select: (data: any) => (data || []).filter((user: User) => user.role !== 'admin'),
  });

  // 获取所有学生智能体预设
  const { data: presets = [], isLoading: loadingPresets } = useQuery({
    queryKey: ['/api/student-agent/presets'],
    select: (data: any) => data?.presets || [],
  });

  // 开始模拟会话
  const startSimulationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPreset || !selectedUser) {
        throw new Error('请选择学生智能体预设和用户');
      }
      
      const response = await fetch('/api/student-agent/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          presetId: selectedPreset,
          userId: selectedUser,
          maxMessages: maxMessages,
          initialPrompt: initialPrompt
        })
      });
      
      if (!response.ok) {
        throw new Error('启动模拟失败');
      }
      
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: '模拟会话已开始',
        description: `已为用户 ${data.username || '未知'} 启动学生智能体模拟会话`,
      });
      setActiveTab('sessions');
      
      // 添加新会话到活动会话列表
      setActiveSessions(prev => [
        {
          id: data.sessionId || Date.now(),
          presetId: selectedPreset || 0,
          presetName: presets.find((p: StudentAgentPreset) => p.id === selectedPreset)?.name || '未知预设',
          userId: selectedUser || 0,
          username: users.find((u: User) => u.id === selectedUser)?.username || '未知用户',
          status: 'running',
          messageCount: 0,
          startTime: new Date().toISOString(),
          simulationLog: [`[${new Date().toLocaleTimeString()}] 会话已开始`]
        },
        ...prev
      ]);
    },
    onError: (error: any) => {
      toast({
        title: '启动模拟会话失败',
        description: error.message || '发生未知错误',
        variant: 'destructive'
      });
    }
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
    <Card className="w-full">
      <CardHeader>
        <CardTitle>学生智能体模拟器</CardTitle>
        <CardDescription>
          使用学生智能体模拟真实用户与系统的对话，生成学习数据和记忆
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="setup">模拟设置</TabsTrigger>
            <TabsTrigger value="sessions">
              活动会话
              {activeSessions.length > 0 && 
                <Badge variant="secondary" className="ml-2">{activeSessions.length}</Badge>
              }
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="setup">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="preset">选择学生智能体预设</Label>
                <Select 
                  value={selectedPreset?.toString() || ''} 
                  onValueChange={(value) => setSelectedPreset(parseInt(value, 10))}
                  disabled={loadingPresets}
                >
                  <SelectTrigger id="preset">
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
                <Label htmlFor="user">选择用户账户</Label>
                <Select 
                  value={selectedUser?.toString() || ''} 
                  onValueChange={(value) => setSelectedUser(parseInt(value, 10))}
                  disabled={loadingUsers}
                >
                  <SelectTrigger id="user">
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
                <Label htmlFor="maxMessages">最大消息数量</Label>
                <Input 
                  id="maxMessages" 
                  type="number" 
                  min="5" 
                  max="50"
                  value={maxMessages}
                  onChange={(e) => setMaxMessages(parseInt(e.target.value, 10))}
                />
                <p className="text-sm text-muted-foreground">
                  设置模拟会话中的最大消息数量 (5-50)
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="initialPrompt">初始提示词</Label>
                <Textarea 
                  id="initialPrompt" 
                  value={initialPrompt}
                  onChange={(e) => setInitialPrompt(e.target.value)}
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">
                  学生智能体将使用这个提示开始对话
                </p>
              </div>
              
              {selectedPreset && presets && (
                <Card className="bg-muted/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">预设详情</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {presets.find((p: StudentAgentPreset) => p.id === selectedPreset) && (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="font-medium">学科:</div>
                        <div>{presets.find((p: StudentAgentPreset) => p.id === selectedPreset)?.subject}</div>
                        
                        <div className="font-medium">年级:</div>
                        <div>{presets.find((p: StudentAgentPreset) => p.id === selectedPreset)?.gradeLevel}</div>
                        
                        <div className="font-medium">认知能力:</div>
                        <div>{presets.find((p: StudentAgentPreset) => p.id === selectedPreset)?.cognitiveLevel}</div>
                        
                        <div className="font-medium">学习动机:</div>
                        <div>{presets.find((p: StudentAgentPreset) => p.id === selectedPreset)?.motivationLevel}</div>
                        
                        <div className="font-medium">学习风格:</div>
                        <div>{presets.find((p: StudentAgentPreset) => p.id === selectedPreset)?.learningStyle}</div>
                        
                        <div className="font-medium">性格特征:</div>
                        <div>{presets.find((p: StudentAgentPreset) => p.id === selectedPreset)?.personalityTrait}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="sessions">
            {activeSessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                尚未启动任何模拟会话
              </div>
            ) : (
              <div className="space-y-4">
                {activeSessions.map((session) => (
                  <Card key={session.id} className={session.status === 'running' ? 'border-primary' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-base">
                          {session.presetName} → {session.username}
                        </CardTitle>
                        <Badge variant={
                          session.status === 'running' ? 'default' : 
                          session.status === 'completed' ? 'secondary' : 
                          session.status === 'failed' ? 'destructive' : 
                          'outline'
                        }>
                          {session.status === 'running' ? '运行中' : 
                           session.status === 'completed' ? '已完成' : 
                           session.status === 'failed' ? '失败' : '等待中'}
                        </Badge>
                      </div>
                      <CardDescription>
                        会话ID: {session.id} | 开始时间: {new Date(session.startTime).toLocaleString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>进度:</span>
                          <span>{session.messageCount}/{maxMessages}</span>
                        </div>
                        <Progress value={(session.messageCount / maxMessages) * 100} />
                        
                        <Separator className="my-2" />
                        
                        <div className="max-h-32 overflow-y-auto text-xs bg-muted p-2 rounded">
                          {session.simulationLog?.map((log, index) => (
                            <div key={index} className="pb-1">
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
                        >
                          查看记忆
                        </Button>
                        
                        <Button 
                          variant={session.status === 'running' ? 'destructive' : 'secondary'} 
                          size="sm"
                          disabled={session.status !== 'running'}
                        >
                          {session.status === 'running' ? '停止' : '移除'}
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
      
      <CardFooter className="flex justify-between">
        {activeTab === 'setup' && (
          <Button 
            disabled={!selectedPreset || !selectedUser || startSimulationMutation.isPending}
            onClick={() => startSimulationMutation.mutate()}
          >
            {startSimulationMutation.isPending ? '正在启动...' : '开始模拟会话'}
          </Button>
        )}
        
        {activeTab === 'sessions' && (
          <Button variant="outline" onClick={() => setActiveTab('setup')}>
            创建新模拟
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}