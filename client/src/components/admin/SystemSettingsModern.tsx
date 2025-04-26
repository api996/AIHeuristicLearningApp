import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Settings,
  Shield,
  LogIn,
  UserPlus,
  Server,
  Database,
  HardDrive,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  KeyRound,
} from "lucide-react";

interface SystemConfig {
  registration_enabled: boolean;
  login_enabled: boolean;
  system_maintenance_mode: boolean;
  memory_system_readonly: boolean;
  vector_search_enabled: boolean;
  knowledge_graph_enabled: boolean;
  rate_limiting_enabled: boolean;
  rate_limit_requests: number;
  rate_limit_window: number;
}

export function SystemSettingsModern() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("access");
  const [config, setConfig] = useState<SystemConfig>({
    registration_enabled: true,
    login_enabled: true,
    system_maintenance_mode: false,
    memory_system_readonly: false,
    vector_search_enabled: true,
    knowledge_graph_enabled: true,
    rate_limiting_enabled: true,
    rate_limit_requests: 100,
    rate_limit_window: 60,
  });

  const { toast } = useToast();

  // 获取系统配置
  const { data: systemConfig, isLoading } = useQuery({
    queryKey: ["/api/admin/system-config"],
    queryFn: async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await fetch(`/api/admin/system-config?userId=${user.userId}`);
      if (!response.ok) throw new Error("获取系统配置失败");
      return response.json();
    },
  });

  // 更新系统配置
  const updateConfigMutation = useMutation({
    mutationFn: async (newConfig: any) => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await fetch(`/api/admin/system-config?userId=${user.userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newConfig),
      });
      
      if (!response.ok) throw new Error("更新系统配置失败");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-config"] });
      toast({
        title: "设置已保存",
        description: "系统配置已成功更新",
      });
    },
    onError: (error) => {
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 获取系统状态
  const { data: systemStatus } = useQuery({
    queryKey: ["/api/admin/system-status"],
    queryFn: async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await fetch(`/api/admin/system-status?userId=${user.userId}`);
      if (!response.ok) throw new Error("获取系统状态失败");
      return response.json();
    },
  });

  // 初始化配置
  useEffect(() => {
    if (systemConfig) {
      setConfig({
        registration_enabled: systemConfig.registration_enabled || false,
        login_enabled: systemConfig.login_enabled || true,
        system_maintenance_mode: systemConfig.system_maintenance_mode || false,
        memory_system_readonly: systemConfig.memory_system_readonly || false,
        vector_search_enabled: systemConfig.vector_search_enabled || true,
        knowledge_graph_enabled: systemConfig.knowledge_graph_enabled || true,
        rate_limiting_enabled: systemConfig.rate_limiting_enabled || true,
        rate_limit_requests: systemConfig.rate_limit_requests || 100,
        rate_limit_window: systemConfig.rate_limit_window || 60,
      });
    }
  }, [systemConfig]);

  // 保存配置
  const handleSaveConfig = () => {
    updateConfigMutation.mutate(config);
  };

  return (
    <div className="space-y-6 fade-in">
      {/* 标题和描述 */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          系统安全设置
        </h2>
        <p className="text-neutral-400">
          控制用户访问权限和系统安全设置，保护系统免受高流量或潜在攻击
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-neutral-800 mb-4">
          <TabsTrigger value="access" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Shield className="h-4 w-4 mr-2" />
            访问控制
          </TabsTrigger>
          <TabsTrigger value="memory" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Database className="h-4 w-4 mr-2" />
            记忆系统
          </TabsTrigger>
          <TabsTrigger value="system" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Server className="h-4 w-4 mr-2" />
            系统状态
          </TabsTrigger>
        </TabsList>

        {/* 访问控制选项卡 */}
        <TabsContent value="access">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card className="admin-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center">
                    <UserPlus className="mr-2 h-5 w-5 text-blue-500" />
                    用户注册控制
                  </CardTitle>
                  <Switch
                    checked={config.registration_enabled}
                    onCheckedChange={(checked) => setConfig({ ...config, registration_enabled: checked })}
                    className="data-[state=checked]:bg-blue-600"
                  />
                </div>
                <CardDescription>
                  控制新用户是否可以注册账户
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center p-3 rounded-md bg-blue-950/20 text-sm">
                  <AlertCircle className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
                  <p className="text-blue-200">
                    {config.registration_enabled
                      ? "注册功能当前已开启，新用户可以创建账户"
                      : "注册功能当前已关闭，只有管理员可以创建新用户"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="admin-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center">
                    <LogIn className="mr-2 h-5 w-5 text-green-500" />
                    用户登录控制
                  </CardTitle>
                  <Switch
                    checked={config.login_enabled}
                    onCheckedChange={(checked) => setConfig({ ...config, login_enabled: checked })}
                    className="data-[state=checked]:bg-green-600"
                  />
                </div>
                <CardDescription>
                  控制用户是否可以登录系统
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center p-3 rounded-md bg-green-950/20 text-sm">
                  <AlertCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <p className="text-green-200">
                    {config.login_enabled
                      ? "登录功能当前已开启，用户可以正常访问系统"
                      : "登录功能当前已关闭，所有用户将无法登录（包括管理员）"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="admin-card md:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center">
                    <Shield className="mr-2 h-5 w-5 text-amber-500" />
                    访问限流控制
                  </CardTitle>
                  <Switch
                    checked={config.rate_limiting_enabled}
                    onCheckedChange={(checked) => setConfig({ ...config, rate_limiting_enabled: checked })}
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>
                <CardDescription>
                  设置API请求速率限制，防止滥用和过载
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rate_limit_requests" className="text-white">最大请求数量</Label>
                    <Input
                      id="rate_limit_requests"
                      type="number"
                      value={config.rate_limit_requests}
                      onChange={(e) => setConfig({ ...config, rate_limit_requests: parseInt(e.target.value) })}
                      disabled={!config.rate_limiting_enabled}
                      className="bg-neutral-800 border-neutral-700"
                    />
                    <p className="text-xs text-neutral-400">
                      在时间窗口内允许的最大请求数量
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rate_limit_window" className="text-white">时间窗口（秒）</Label>
                    <Input
                      id="rate_limit_window"
                      type="number"
                      value={config.rate_limit_window}
                      onChange={(e) => setConfig({ ...config, rate_limit_window: parseInt(e.target.value) })}
                      disabled={!config.rate_limiting_enabled}
                      className="bg-neutral-800 border-neutral-700"
                    />
                    <p className="text-xs text-neutral-400">
                      限流计算的时间窗口，单位为秒
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 记忆系统选项卡 */}
        <TabsContent value="memory">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card className="admin-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center">
                    <HardDrive className="mr-2 h-5 w-5 text-purple-500" />
                    记忆系统模式
                  </CardTitle>
                  <Switch
                    checked={config.memory_system_readonly}
                    onCheckedChange={(checked) => setConfig({ ...config, memory_system_readonly: checked })}
                    className="data-[state=checked]:bg-purple-600"
                  />
                </div>
                <CardDescription>
                  {config.memory_system_readonly ? "只读模式" : "读写模式"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center p-3 rounded-md bg-purple-950/20 text-sm">
                  <AlertCircle className="h-5 w-5 text-purple-500 mr-2 flex-shrink-0" />
                  <p className="text-purple-200">
                    {config.memory_system_readonly
                      ? "记忆系统当前为只读模式，不会创建新的记忆条目"
                      : "记忆系统当前为读写模式，可以正常创建新的记忆条目"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="admin-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center">
                    <Database className="mr-2 h-5 w-5 text-blue-500" />
                    向量搜索功能
                  </CardTitle>
                  <Switch
                    checked={config.vector_search_enabled}
                    onCheckedChange={(checked) => setConfig({ ...config, vector_search_enabled: checked })}
                    className="data-[state=checked]:bg-blue-600"
                  />
                </div>
                <CardDescription>
                  语义检索和记忆相似度搜索
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center p-3 rounded-md bg-blue-950/20 text-sm">
                  <AlertCircle className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
                  <p className="text-blue-200">
                    {config.vector_search_enabled
                      ? "向量搜索功能已启用，系统将使用语义相似度检索记忆"
                      : "向量搜索功能已禁用，系统将仅使用关键词匹配检索记忆"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="admin-card md:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center">
                    <KeyRound className="mr-2 h-5 w-5 text-amber-500" />
                    系统API密钥
                  </CardTitle>
                </div>
                <CardDescription>
                  管理用于外部服务集成的API密钥
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px] w-full">
                  <div className="space-y-4">
                    <div className="p-3 rounded-md bg-neutral-800">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-white">Gemini API</div>
                        <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">已配置</Badge>
                      </div>
                      <p className="text-xs text-neutral-400 mb-2">
                        用于生成式AI和语义向量嵌入
                      </p>
                      <Input
                        type="password"
                        value="************"
                        disabled
                        className="bg-neutral-900 border-neutral-700"
                      />
                    </div>
                    
                    <div className="p-3 rounded-md bg-neutral-800">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-white">DeepSeek API</div>
                        <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">已配置</Badge>
                      </div>
                      <p className="text-xs text-neutral-400 mb-2">
                        用于高级自然语言处理
                      </p>
                      <Input
                        type="password"
                        value="************"
                        disabled
                        className="bg-neutral-900 border-neutral-700"
                      />
                    </div>
                    
                    <div className="p-3 rounded-md bg-neutral-800">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-white">Grok API</div>
                        <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">已配置</Badge>
                      </div>
                      <p className="text-xs text-neutral-400 mb-2">
                        用于高级检索和内容生成
                      </p>
                      <Input
                        type="password"
                        value="************"
                        disabled
                        className="bg-neutral-900 border-neutral-700"
                      />
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 系统状态选项卡 */}
        <TabsContent value="system">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card className="admin-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center">
                    <Server className="mr-2 h-5 w-5 text-red-500" />
                    维护模式
                  </CardTitle>
                  <Switch
                    checked={config.system_maintenance_mode}
                    onCheckedChange={(checked) => setConfig({ ...config, system_maintenance_mode: checked })}
                    className="data-[state=checked]:bg-red-600"
                  />
                </div>
                <CardDescription>
                  系统维护模式，仅允许管理员访问
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center p-3 rounded-md bg-red-950/20 text-sm">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                  <p className="text-red-200">
                    {config.system_maintenance_mode
                      ? "维护模式已启用，普通用户将无法访问系统"
                      : "维护模式已禁用，所有用户可以正常访问系统"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="admin-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Database className="mr-2 h-5 w-5 text-blue-500" />
                  数据库状态
                </CardTitle>
                <CardDescription>
                  PostgreSQL 数据库连接状态
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-md bg-neutral-800">
                    <div className="flex items-center">
                      <div className="status-indicator online"></div>
                      <span className="text-white">连接状态</span>
                    </div>
                    <span className="text-green-400">正常</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-md bg-neutral-800">
                    <span className="text-white">记忆表数据量</span>
                    <span className="text-neutral-300">{systemStatus?.memory_count || "加载中..."}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-md bg-neutral-800">
                    <span className="text-white">向量表数据量</span>
                    <span className="text-neutral-300">{systemStatus?.embedding_count || "加载中..."}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="admin-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Settings className="mr-2 h-5 w-5 text-amber-500" />
                  API服务状态
                </CardTitle>
                <CardDescription>
                  外部API服务连接状态
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-md bg-neutral-800">
                    <div className="flex items-center">
                      <div className="status-indicator online"></div>
                      <span className="text-white">Gemini API</span>
                    </div>
                    <span className="text-green-400">正常</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-md bg-neutral-800">
                    <div className="flex items-center">
                      <div className="status-indicator online"></div>
                      <span className="text-white">DeepSeek API</span>
                    </div>
                    <span className="text-green-400">正常</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-md bg-neutral-800">
                    <div className="flex items-center">
                      <div className="status-indicator online"></div>
                      <span className="text-white">Grok API</span>
                    </div>
                    <span className="text-green-400">正常</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="admin-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Server className="mr-2 h-5 w-5 text-purple-500" />
                  系统资源使用
                </CardTitle>
                <CardDescription>
                  服务器资源使用状况
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white">CPU使用率</span>
                      <span className="text-sm text-neutral-400">{systemStatus?.cpu_usage || "0"}%</span>
                    </div>
                    <Progress value={systemStatus?.cpu_usage || 0} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white">内存使用率</span>
                      <span className="text-sm text-neutral-400">{systemStatus?.memory_usage || "0"}%</span>
                    </div>
                    <Progress value={systemStatus?.memory_usage || 0} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white">磁盘使用率</span>
                      <span className="text-sm text-neutral-400">{systemStatus?.disk_usage || "0"}%</span>
                    </div>
                    <Progress value={systemStatus?.disk_usage || 0} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end mt-6">
        <Button 
          onClick={handleSaveConfig}
          disabled={updateConfigMutation.isPending}
          className="w-full md:w-auto"
        >
          {updateConfigMutation.isPending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              保存设置
            </>
          )}
        </Button>
      </div>
    </div>
  );
}