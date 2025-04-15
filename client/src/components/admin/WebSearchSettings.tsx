/**
 * 网络搜索设置组件
 * 用于管理Google Serper API网络搜索设置
 */

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  Loader2,
} from "lucide-react";

// 网络搜索设置接口
interface WebSearchSettings {
  enabled: boolean;
  configured: boolean;
  cacheExpiryMinutes?: number;
}

// 测试结果接口
interface TestResult {
  success: boolean;
  results?: any[];
  count?: number;
  error?: string;
}

export function WebSearchSettings() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  // 默认设置
  const defaultSettings: WebSearchSettings = {
    enabled: false,
    configured: false,
    cacheExpiryMinutes: 60
  };
  
  const [settings, setSettings] = useState<WebSearchSettings>(defaultSettings);
  const [testQuery, setTestQuery] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [cacheMinutes, setCacheMinutes] = useState(60);
  
  // 加载设置
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        
        const response = await apiRequest("/api/web-search/status", "GET", {
          userId: user.userId,
        });
        
        if (response) {
          setSettings(response);
        }
      } catch (error) {
        toast({
          title: "错误",
          description: "加载网络搜索设置失败",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSettings();
  }, [toast]);
  
  // 保存设置
  const saveSettings = async () => {
    try {
      setIsSaving(true);
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      
      const response = await apiRequest("/api/web-search/enable", "POST", {
        userId: user.userId,
        enabled: settings.enabled
      });
      
      if (response && response.success) {
        setSettings({
          ...settings,
          ...response
        });
        
        toast({
          title: "成功",
          description: `网络搜索功能已${response.enabled ? '启用' : '禁用'}`,
        });
      } else if (response && !response.configured) {
        toast({
          title: "配置错误",
          description: "未配置Serper API密钥，无法启用网络搜索",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "错误",
        description: "保存网络搜索设置失败",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // 更新缓存时间
  const updateCacheTime = async () => {
    try {
      setIsSaving(true);
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      
      const response = await apiRequest("/api/web-search/cache-expiry", "POST", {
        userId: user.userId,
        minutes: cacheMinutes
      });
      
      if (response && response.success) {
        setSettings({
          ...settings,
          cacheExpiryMinutes: response.cacheExpiryMinutes
        });
        
        toast({
          title: "成功",
          description: `缓存过期时间已设置为 ${response.cacheExpiryMinutes} 分钟`,
        });
      }
    } catch (error) {
      toast({
        title: "错误",
        description: "更新缓存时间失败",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // 测试网络搜索
  const testSearch = async () => {
    if (!testQuery) {
      toast({
        title: "请输入测试查询",
        description: "请输入要搜索的内容",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsTesting(true);
      setTestResult(null);
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      
      const response = await apiRequest("/api/web-search/test", "POST", {
        userId: user.userId,
        query: testQuery
      });
      
      setTestResult(response);
      
      if (response && response.success) {
        toast({
          title: "测试成功",
          description: `找到 ${response.count || 0} 条搜索结果`,
        });
      } else if (response && !response.configured) {
        toast({
          title: "配置错误",
          description: "未配置Serper API密钥，无法执行搜索",
          variant: "destructive",
        });
      } else {
        toast({
          title: "测试失败",
          description: response.error || "未知错误",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "错误",
        description: "测试网络搜索失败",
        variant: "destructive",
      });
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : "未知错误"
      });
    } finally {
      setIsTesting(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4">
      <Card className="bg-neutral-900 border-neutral-800 mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">网络搜索设置</CardTitle>
            {!settings.configured && (
              <Badge variant="outline" className="bg-yellow-900/30 text-yellow-400 border-yellow-800">
                <AlertTriangle className="h-3 w-3 mr-1" />
                未配置API密钥
              </Badge>
            )}
            {settings.configured && (
              <Badge variant="outline" className="bg-green-900/30 text-green-400 border-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                API密钥已配置
              </Badge>
            )}
          </div>
          <CardDescription>
            使用Google Serper API为AI对话提供实时网络搜索功能，保持回答的时效性
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-white">启用网络搜索</h3>
                  <p className="text-neutral-400 text-sm">
                    当启用此功能时，AI可以通过网络搜索获取实时信息
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  disabled={!settings.configured || isSaving}
                  onCheckedChange={(checked) => {
                    setSettings({ ...settings, enabled: checked });
                  }}
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>
              
              {!settings.configured && (
                <div className="rounded-md bg-yellow-900/20 p-4 border border-yellow-800/50">
                  <div className="flex">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-500">API密钥未配置</h3>
                      <div className="mt-2 text-sm text-neutral-400">
                        <p>
                          请在环境变量中配置 <code className="bg-neutral-800 px-1 py-0.5 rounded">SERPER_API_KEY</code> 以启用网络搜索功能。
                        </p>
                        <a
                          href="https://serper.dev/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-blue-500 hover:text-blue-400 mt-2"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          获取Serper API密钥
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <Separator className="bg-neutral-800" />
              
              <div>
                <h3 className="text-lg font-medium text-white mb-2">缓存设置</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <Label htmlFor="cache-time" className="text-neutral-300">
                        缓存过期时间 ({cacheMinutes} 分钟)
                      </Label>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        onClick={updateCacheTime}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        保存
                      </Button>
                    </div>
                    <div className="flex items-center gap-4">
                      <Clock className="h-4 w-4 text-neutral-500" />
                      <Slider
                        id="cache-time"
                        min={10}
                        max={1440}
                        step={10}
                        value={[cacheMinutes]}
                        onValueChange={(value) => setCacheMinutes(value[0])}
                        className="flex-1"
                      />
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      设置搜索结果的缓存时间，较短的时间可保持信息新鲜度，较长的时间可减少API调用
                    </p>
                  </div>
                </div>
              </div>
              
              <Separator className="bg-neutral-800" />
              
              <div>
                <h3 className="text-lg font-medium text-white mb-4">测试搜索功能</h3>
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="输入测试查询..."
                    value={testQuery}
                    onChange={(e) => setTestQuery(e.target.value)}
                    disabled={isTesting || !settings.configured}
                    className="bg-neutral-800 border-neutral-700"
                  />
                  <Button
                    onClick={testSearch}
                    disabled={isTesting || !testQuery || !settings.configured}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isTesting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Search className="h-4 w-4 mr-2" />
                    )}
                    测试
                  </Button>
                </div>
                
                {testResult && (
                  <div className={`p-4 rounded-md ${
                    testResult.success 
                      ? "bg-green-900/20 border border-green-800/50" 
                      : "bg-red-900/20 border border-red-800/50"
                  }`}>
                    {testResult.success ? (
                      <>
                        <div className="flex items-center text-green-500 mb-2">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          <span className="font-medium">搜索成功</span>
                        </div>
                        <p className="text-neutral-300 mb-2">
                          找到 {testResult.count || 0} 条结果
                        </p>
                        {testResult.results && testResult.results.length > 0 && (
                          <div className="mt-2 max-h-60 overflow-y-auto rounded bg-neutral-800 p-3">
                            {testResult.results.map((result, index) => (
                              <div key={index} className="mb-3 pb-3 border-b border-neutral-700 last:border-0">
                                <h4 className="font-medium text-white">{result.title}</h4>
                                <p className="text-sm text-neutral-400 my-1">{result.snippet}</p>
                                {result.url && (
                                  <a 
                                    href={result.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-500 hover:text-blue-400 flex items-center mt-1"
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    {result.url}
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center text-red-500 mb-2">
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          <span className="font-medium">搜索失败</span>
                        </div>
                        <p className="text-neutral-300">{testResult.error}</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t border-neutral-800 pt-4">
          <div className="text-sm text-neutral-500 flex items-center">
            <Search className="h-3 w-3 mr-1" />
            网络搜索由 Google Serper API 提供支持
          </div>
          <Button
            onClick={saveSettings}
            disabled={isLoading || isSaving || !settings.configured}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            保存设置
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}