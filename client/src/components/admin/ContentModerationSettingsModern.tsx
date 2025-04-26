import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert,
  ShieldCheck,
  Ban,
  Info,
  Check,
  X,
  AlertTriangle,
  Settings,
  RefreshCw,
} from "lucide-react";

export function ContentModerationSettingsModern() {
  // 基本设置状态
  const [isEnabled, setIsEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [threshold, setThreshold] = useState(0.8);
  const [keyVisible, setKeyVisible] = useState(false);
  
  // 高级设置状态
  const [automodEnabled, setAutomodEnabled] = useState(false);
  const [logEnabled, setLogEnabled] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [customCategories, setCustomCategories] = useState("");
  
  const { toast } = useToast();

  // 获取当前设置
  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/admin/content-moderation/settings"],
    queryFn: async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await fetch(`/api/admin/content-moderation/settings?userId=${user.userId}`);
      if (!response.ok) throw new Error("Failed to fetch moderation settings");
      return response.json();
    },
  });

  // 更新设置
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await fetch(`/api/admin/content-moderation/settings?userId=${user.userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newSettings),
      });
      
      if (!response.ok) throw new Error("Failed to update settings");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "设置已更新",
        description: "内容审查设置已成功保存",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "更新失败",
        description: error.message || "无法保存内容审查设置",
        variant: "destructive",
      });
    },
  });

  // 初始化设置
  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.enabled || false);
      setApiKey(settings.apiKey || "");
      setThreshold(settings.threshold || 0.8);
      setAutomodEnabled(settings.automodEnabled || false);
      setLogEnabled(settings.logEnabled || true);
      setCustomCategories(settings.customCategories || "");
    }
  }, [settings]);

  // 保存设置
  const handleSaveSettings = () => {
    updateSettingsMutation.mutate({
      enabled: isEnabled,
      apiKey,
      threshold,
      automodEnabled,
      logEnabled,
      customCategories: customCategories.trim()
    });
  };

  // 测试设置
  const testSettingsMutation = useMutation({
    mutationFn: async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const response = await fetch(`/api/admin/content-moderation/test?userId=${user.userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey,
          testText: "This is a test message to verify the moderation API connection.",
        }),
      });
      
      if (!response.ok) throw new Error("API测试失败");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "连接成功",
        description: "OpenAI Moderation API连接测试通过",
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: "连接失败",
        description: error.message || "无法连接到OpenAI Moderation API",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6 fade-in">
      {/* 标题和说明 */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-amber-500" />
          内容审查设置
        </h2>
        <p className="text-neutral-400">
          配置OpenAI Moderation API用于过滤不当内容，保护用户体验和平台安全
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 基本设置 */}
        <Card className="admin-card md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center">
                <Settings className="mr-2 h-5 w-5 text-primary" />
                基本设置
              </CardTitle>
              <Switch
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
                className="data-[state=checked]:bg-green-600"
              />
            </div>
            <CardDescription>
              配置内容审查API和敏感度阈值
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="text-white">OpenAI API Key</Label>
              <div className="flex">
                <Input
                  id="apiKey"
                  type={keyVisible ? "text" : "password"}
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="bg-neutral-800 border-neutral-700 flex-1"
                  disabled={!isEnabled}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setKeyVisible(!keyVisible)}
                  className="ml-2"
                  disabled={!isEnabled}
                >
                  {keyVisible ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Info className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-neutral-500">
                OpenAI API密钥用于访问内容审查服务，确保密钥具有Moderation API访问权限
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="threshold" className="text-white">审查阈值</Label>
                <span className="text-sm text-neutral-400">
                  {Math.round(threshold * 100)}%
                </span>
              </div>
              <Slider
                id="threshold"
                min={0}
                max={1}
                step={0.01}
                value={[threshold]}
                onValueChange={(values) => setThreshold(values[0])}
                disabled={!isEnabled}
                className="py-2"
              />
              <div className="flex justify-between text-xs text-neutral-500">
                <span>宽松</span>
                <span>平衡</span>
                <span>严格</span>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                设置较高的阈值将仅标记可能性很高的违规内容，设置较低的阈值将增加检测敏感度但可能产生误报
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={!isEnabled || !apiKey || testSettingsMutation.isPending}
                onClick={() => testSettingsMutation.mutate()}
                className="flex-1"
              >
                {testSettingsMutation.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                测试连接
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 系统状态 */}
        <Card className="admin-card">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5 text-amber-500" />
              系统状态
            </CardTitle>
            <CardDescription>
              内容审查服务当前状态
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-neutral-400">服务状态</p>
                <div className="flex items-center">
                  <span className={`status-indicator ${isEnabled ? 'online' : 'offline'}`}></span>
                  <span className="font-medium text-white">
                    {isEnabled ? "已启用" : "已禁用"}
                  </span>
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-neutral-400">API连接</p>
                <div className="flex items-center">
                  <span className={`status-indicator ${apiKey ? 'online' : 'offline'}`}></span>
                  <span className="font-medium text-white">
                    {apiKey ? "已配置" : "未配置"}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-sm text-neutral-400">保护内容类别</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center p-2 rounded bg-neutral-800">
                  <Check className="h-3 w-3 text-green-500 mr-1" />
                  <span>暴力内容</span>
                </div>
                <div className="flex items-center p-2 rounded bg-neutral-800">
                  <Check className="h-3 w-3 text-green-500 mr-1" />
                  <span>仇恨言论</span>
                </div>
                <div className="flex items-center p-2 rounded bg-neutral-800">
                  <Check className="h-3 w-3 text-green-500 mr-1" />
                  <span>性相关内容</span>
                </div>
                <div className="flex items-center p-2 rounded bg-neutral-800">
                  <Check className="h-3 w-3 text-green-500 mr-1" />
                  <span>自残内容</span>
                </div>
                <div className="flex items-center p-2 rounded bg-neutral-800">
                  <Check className="h-3 w-3 text-green-500 mr-1" />
                  <span>骚扰内容</span>
                </div>
                <div className="flex items-center p-2 rounded bg-neutral-800">
                  <Check className="h-3 w-3 text-green-500 mr-1" />
                  <span>有害言论</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 高级设置 */}
      <Card className="admin-card">
        <CardHeader className="cursor-pointer" onClick={() => setShowDetails(!showDetails)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center">
              <Ban className="mr-2 h-5 w-5 text-red-500" />
              高级设置
            </CardTitle>
            <Button variant="ghost" size="icon">
              {showDetails ? <X className="h-4 w-4" /> : <Info className="h-4 w-4" />}
            </Button>
          </div>
          <CardDescription>
            配置自动审核和违规内容处理策略
          </CardDescription>
        </CardHeader>
        
        {showDetails && (
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-white">自动审核</Label>
                  <p className="text-xs text-neutral-500">
                    自动阻止违规内容，无需人工审核
                  </p>
                </div>
                <Switch
                  checked={automodEnabled}
                  onCheckedChange={setAutomodEnabled}
                  disabled={!isEnabled}
                  className="data-[state=checked]:bg-purple-600"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-white">记录违规内容</Label>
                  <p className="text-xs text-neutral-500">
                    保存被审查系统标记的内容以供后续分析
                  </p>
                </div>
                <Switch
                  checked={logEnabled}
                  onCheckedChange={setLogEnabled}
                  disabled={!isEnabled}
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="customCategories" className="text-white">自定义违规类别</Label>
                <Textarea
                  id="customCategories"
                  value={customCategories}
                  onChange={(e) => setCustomCategories(e.target.value)}
                  placeholder="每行输入一个自定义类别，例如：政治敏感&#13;&#10;商业推广&#13;&#10;不适宜教育内容"
                  className="h-24 bg-neutral-800 border-neutral-700"
                  disabled={!isEnabled}
                />
                <p className="text-xs text-neutral-500">
                  添加自定义关键词或类别，系统将额外检查这些内容
                </p>
              </div>
            </div>
          </CardContent>
        )}
        
        <CardFooter className="flex justify-end px-6 py-4">
          <Button
            onClick={handleSaveSettings}
            disabled={updateSettingsMutation.isPending}
            className="w-full sm:w-auto"
          >
            {updateSettingsMutation.isPending ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            保存设置
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}