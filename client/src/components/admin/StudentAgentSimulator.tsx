import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
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
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from '@/components/ui/dialog';

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
  grade_level: string;
  cognitive_level: string;
  motivation_level: string;
  learning_style: string;
  personality_trait: string;
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
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [newAgentName, setNewAgentName] = useState('');

  // 获取所有用户（不包括管理员）
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await fetch(`/api/users?userId=${user.userId || 1}`);
      if (!response.ok) {
        throw new Error('获取用户列表失败');
      }
      const data = await response.json();
      return (data || []).filter((user: User) => user.role !== 'admin');
    },
  });

  // 获取所有学生智能体预设
  const { data: presets = [], isLoading: loadingPresets } = useQuery({
    queryKey: ['/api/student-agent/presets'],
    queryFn: async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await fetch(`/api/student-agent/presets?userId=${user.userId || 1}`);
      if (!response.ok) {
        throw new Error('获取预设失败');
      }
      const data = await response.json();
      return data?.presets || [];
    },
  });

  // 开始模拟会话
  const startSimulationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPreset || !selectedUser) {
        throw new Error('请选择学生智能体预设和用户');
      }
      
      const adminUser = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await fetch('/api/student-agent-simulator/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          presetId: selectedPreset,
          userId: selectedUser,
          adminUserId: adminUser.userId || 1, // 管理员用户ID，用于权限验证
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
    <Card className="w-full student-agent-simulator">
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
            <TabsTrigger value="presets">智能体预设</TabsTrigger>
          </TabsList>
          
          <TabsContent value="setup">
            <div className="grid gap-4">
              <div className="flex justify-end">
                <Button 
                  onClick={() => startSimulationMutation.mutate()}
                  disabled={!selectedPreset || !selectedUser || startSimulationMutation.isPending}
                >
                  {startSimulationMutation.isPending ? '启动中...' : '启动模拟会话'}
                </Button>
              </div>
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
                        {preset.name} - {preset.subject} ({preset.grade_level})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="user">选择用户账户</Label>
                  <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs"
                        onClick={() => {
                          if (selectedPreset) {
                            const preset = presets.find((p: StudentAgentPreset) => p.id === selectedPreset);
                            if (preset) {
                              setNewAgentName(preset.name);
                            }
                          }
                        }}
                      >
                        为智能体创建账户
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>创建智能体专用账户</DialogTitle>
                        <DialogDescription>
                          创建一个新的用户账户用于学生智能体模拟。账户名将基于智能体名称。
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="agentName">智能体名称</Label>
                          <Input
                            id="agentName"
                            placeholder="输入智能体名称"
                            value={newAgentName}
                            onChange={(e) => setNewAgentName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newUsername">账户用户名</Label>
                          <Input
                            id="newUsername"
                            placeholder="用户名"
                            value={newUsername || `agent_${newAgentName.toLowerCase().replace(/\s+/g, '_')}`}
                            onChange={(e) => setNewUsername(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          type="submit"
                          onClick={async () => {
                            // 简单验证
                            if (!newAgentName || !newUsername) {
                              toast({
                                title: "无法创建账户",
                                description: "请输入智能体名称和用户名",
                                variant: "destructive"
                              });
                              return;
                            }
                            
                            try {
                              // 获取管理员ID
                              const adminUser = JSON.parse(localStorage.getItem("user") || "{}");
                              
                              // 创建新用户
                              const response = await fetch('/api/users', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                  username: newUsername || `agent_${newAgentName.toLowerCase().replace(/\s+/g, '_')}`,
                                  password: 'password123', // 默认密码
                                  role: 'user',
                                  adminId: adminUser.userId || 1
                                })
                              });
                              
                              if (!response.ok) {
                                throw new Error('创建用户失败');
                              }
                              
                              const data = await response.json();
                              
                              toast({
                                title: "账户创建成功",
                                description: `已为智能体 ${newAgentName} 创建用户账户`,
                              });
                              
                              // 关闭对话框
                              setIsCreateUserDialogOpen(false);
                              
                              // 刷新用户列表
                              queryClient.invalidateQueries({ queryKey: ['/api/users'] });
                              
                              // 选择新创建的用户
                              if (data && data.id) {
                                setSelectedUser(data.id);
                              }
                              
                              // 重置表单
                              setNewUsername('');
                              setNewAgentName('');
                              
                            } catch (error: any) {
                              toast({
                                title: "创建账户失败",
                                description: error.message || "发生未知错误",
                                variant: "destructive"
                              });
                            }
                          }}
                        >
                          创建账户
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
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
                        <div>{presets.find((p: StudentAgentPreset) => p.id === selectedPreset)?.grade_level}</div>
                        
                        <div className="font-medium">认知能力:</div>
                        <div>{presets.find((p: StudentAgentPreset) => p.id === selectedPreset)?.cognitive_level}</div>
                        
                        <div className="font-medium">学习动机:</div>
                        <div>{presets.find((p: StudentAgentPreset) => p.id === selectedPreset)?.motivation_level}</div>
                        
                        <div className="font-medium">学习风格:</div>
                        <div>{presets.find((p: StudentAgentPreset) => p.id === selectedPreset)?.learning_style}</div>
                        
                        <div className="font-medium">性格特征:</div>
                        <div>{presets.find((p: StudentAgentPreset) => p.id === selectedPreset)?.personality_trait}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="presets">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">学生智能体预设列表</h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    window.open('/admin/student-agent-presets', '_blank');
                  }}
                >
                  创建新预设
                </Button>
              </div>
              
              {loadingPresets ? (
                <div className="text-center py-4">
                  正在加载预设...
                </div>
              ) : presets && presets.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {presets.map((preset: StudentAgentPreset) => (
                    <Card key={preset.id} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{preset.name}</CardTitle>
                        <CardDescription>
                          {preset.subject} ({preset.grade_level})
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                          <div className="font-medium">认知能力:</div>
                          <div>{preset.cognitive_level}</div>
                          
                          <div className="font-medium">学习动机:</div>
                          <div>{preset.motivation_level}</div>
                          
                          <div className="font-medium">学习风格:</div>
                          <div>{preset.learning_style}</div>
                          
                          <div className="font-medium">性格特征:</div>
                          <div>{preset.personality_trait}</div>
                        </div>
                        
                        <Separator className="my-2" />
                        
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {preset.description || "无详细描述"}
                        </p>
                      </CardContent>
                      <CardFooter className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedPreset(preset.id);
                            setActiveTab('setup');
                            // 如果预设名称中没有特殊字符，则自动生成用户名
                            if (!/[^\w\s]/.test(preset.name)) {
                              setNewAgentName(preset.name);
                              // 提示创建
                              toast({
                                title: "预设已选择",
                                description: `您可以使用"为智能体创建账户"来为此预设创建专用账户。`,
                              });
                            }
                          }}
                        >
                          选择
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                            >
                              详情
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{preset.name} - 预设详情</DialogTitle>
                              <DialogDescription>
                                {preset.subject} ({preset.grade_level}) - {preset.description}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <h4 className="font-medium mb-2">基本信息</h4>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="font-medium">学科:</div>
                                    <div>{preset.subject}</div>
                                    
                                    <div className="font-medium">年级:</div>
                                    <div>{preset.grade_level}</div>
                                    
                                    <div className="font-medium">认知能力:</div>
                                    <div>{preset.cognitive_level}</div>
                                    
                                    <div className="font-medium">学习动机:</div>
                                    <div>{preset.motivation_level}</div>
                                    
                                    <div className="font-medium">学习风格:</div>
                                    <div>{preset.learning_style}</div>
                                    
                                    <div className="font-medium">性格特征:</div>
                                    <div>{preset.personality_trait}</div>
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="font-medium mb-2">KWLQ学习记录</h4>
                                  <div className="bg-muted p-2 rounded text-xs">
                                    <div><span className="font-medium">已知(K):</span> {preset.kwlqTemplate?.K.join(', ') || '无'}</div>
                                    <div><span className="font-medium">想学(W):</span> {preset.kwlqTemplate?.W.join(', ') || '无'}</div>
                                    <div><span className="font-medium">已学(L):</span> {preset.kwlqTemplate?.L.join(', ') || '无'}</div>
                                    <div><span className="font-medium">疑问(Q):</span> {preset.kwlqTemplate?.Q.join(', ') || '无'}</div>
                                  </div>
                                </div>
                              </div>
                              
                              <Separator />
                              
                              <div>
                                <h4 className="font-medium mb-2">系统提示词</h4>
                                <div className="bg-muted p-3 rounded text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                                  {preset.systemPrompt?.substring(0, 500)}...
                                </div>
                              </div>
                              
                              <Separator />
                              
                              <div className="flex justify-end">
                                <Button 
                                  onClick={() => {
                                    setSelectedPreset(preset.id);
                                    setActiveTab('setup');
                                    setNewAgentName(preset.name);
                                  }}
                                >
                                  使用此预设
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  尚未创建任何预设
                </div>
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
                          onClick={() => {
                            if (session.userId) {
                              // 在新窗口中打开该用户的记忆列表
                              window.open(`/admin/memories?userId=${session.userId}`, '_blank');
                            } else {
                              toast({
                                title: "无法查看记忆",
                                description: "无法确定用户ID，请尝试重新启动模拟",
                                variant: "destructive"
                              });
                            }
                          }}
                        >
                          查看记忆
                        </Button>
                        
                        <Button 
                          variant={session.status === 'running' ? 'destructive' : 'secondary'} 
                          size="sm"
                          disabled={session.status !== 'running' && session.status !== 'completed'}
                          onClick={() => {
                            if (session.status === 'running') {
                              // 模拟停止模拟会话
                              setActiveSessions(prev => 
                                prev.map(s => s.id === session.id ? {
                                  ...s,
                                  status: 'completed',
                                  endTime: new Date().toISOString(),
                                  simulationLog: [
                                    ...(s.simulationLog || []),
                                    `[${new Date().toLocaleTimeString()}] 管理员手动停止会话`
                                  ]
                                } : s)
                              );
                              toast({
                                title: "会话已停止",
                                description: "学生智能体模拟会话已手动停止"
                              });
                            } else {
                              // 模拟移除会话记录
                              setActiveSessions(prev => prev.filter(s => s.id !== session.id));
                              toast({
                                title: "会话已移除",
                                description: "学生智能体模拟会话记录已移除"
                              });
                            }
                          }}
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
          <div className="w-full flex flex-col space-y-2">
            {(!selectedPreset || !selectedUser) && (
              <div className="text-sm text-amber-500 mb-2">
                请选择学生智能体预设和用户账户
              </div>
            )}
            <div className="flex justify-between items-center">
              <Button 
                variant="default"
                size="lg"
                className="w-full md:w-auto"
                disabled={!selectedPreset || !selectedUser || startSimulationMutation.isPending}
                onClick={() => startSimulationMutation.mutate()}
              >
                {startSimulationMutation.isPending ? (
                  <>
                    <span className="mr-2">正在启动...</span>
                    <span className="animate-spin">⏳</span>
                  </>
                ) : (
                  <>
                    <span className="mr-2">开始模拟会话</span>
                    <span>▶</span>
                  </>
                )}
              </Button>
            </div>
          </div>
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