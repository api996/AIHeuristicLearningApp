import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldAlert, Shield, CheckCircle } from "lucide-react";

interface ModerationSettings {
  enabled: boolean;
  threshold: number;
  blockUserInput: boolean;
  blockModelOutput: boolean;
}

interface ModerationTestResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  categoryScores: Record<string, number>;
  error?: string;
}

export function ContentModerationSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ModerationSettings>({
    enabled: false,
    threshold: 0.7,
    blockUserInput: true,
    blockModelOutput: true,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [testText, setTestText] = useState<string>("");
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<ModerationTestResult | null>(null);

  // 获取当前设置
  useEffect(() => {
    async function fetchSettings() {
      try {
        setIsLoading(true);
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const response = await fetch(`/api/admin/content-moderation/settings?userId=${user.userId}`);
        
        if (!response.ok) {
          throw new Error("获取设置失败");
        }
        
        const data = await response.json();
        if (data.success && data.settings) {
          setSettings(data.settings);
        }
      } catch (error) {
        toast({
          title: "错误",
          description: "无法获取内容审查设置",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchSettings();
  }, [toast]);

  // 保存设置
  const saveSettings = async () => {
    try {
      setIsSaving(true);
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      
      const response = await apiRequest("/api/admin/content-moderation/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.userId,
          ...settings,
        }),
      });

      if (response.success) {
        toast({
          title: "成功",
          description: "内容审查设置已保存",
        });
      } else {
        throw new Error(response.message || "保存失败");
      }
    } catch (error) {
      toast({
        title: "错误",
        description: "保存设置失败",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 测试内容审查
  const testModeration = async () => {
    if (!testText.trim()) {
      toast({
        title: "警告",
        description: "请输入测试文本",
        variant: "default",
      });
      return;
    }

    try {
      setIsTesting(true);
      setTestResult(null);
      
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      
      const response = await apiRequest("/api/admin/content-moderation/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.userId,
          text: testText,
        }),
      });

      if (response.success && response.result) {
        setTestResult(response.result);
      } else {
        throw new Error(response.message || "测试失败");
      }
    } catch (error) {
      toast({
        title: "错误",
        description: "内容审查测试失败",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 渲染测试结果
  const renderTestResult = () => {
    if (!testResult) return null;

    if (testResult.error) {
      return (
        <div className="mt-4 p-4 bg-neutral-800 rounded-md border border-red-600">
          <div className="text-red-500 font-medium mb-2 flex items-center">
            <ShieldAlert className="h-5 w-5 mr-2" />
            测试错误
          </div>
          <p className="text-sm text-neutral-300">{testResult.error}</p>
        </div>
      );
    }

    const flaggedCategories = Object.entries(testResult.categories)
      .filter(([_, isFlagged]) => isFlagged)
      .map(([category]) => category);

    return (
      <div className={`mt-4 p-4 rounded-md border ${testResult.flagged ? 'bg-neutral-800 border-red-600' : 'bg-neutral-900 border-green-600'}`}>
        <div className={`font-medium mb-2 flex items-center ${testResult.flagged ? 'text-red-500' : 'text-green-500'}`}>
          {testResult.flagged ? (
            <>
              <ShieldAlert className="h-5 w-5 mr-2" />
              内容被标记为不适当
            </>
          ) : (
            <>
              <CheckCircle className="h-5 w-5 mr-2" />
              内容通过审查
            </>
          )}
        </div>
        
        <div className="mt-3">
          <p className="text-sm text-neutral-400 mb-2">分类结果:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(testResult.categoryScores).map(([category, score]) => (
              <Badge key={category} variant={score > settings.threshold ? "destructive" : "secondary"}>
                {category}: {(score * 100).toFixed(1)}%
              </Badge>
            ))}
          </div>
        </div>
        
        {testResult.flagged && (
          <div className="mt-3">
            <p className="text-sm text-neutral-400 mb-1">触发分类:</p>
            <div className="flex flex-wrap gap-2">
              {flaggedCategories.map((category) => (
                <Badge key={category} variant="destructive">{category}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center">
                <Shield className="h-5 w-5 mr-2 text-blue-500" />
                内容审查设置
              </CardTitle>
              <CardDescription>
                使用OpenAI的Moderation API对用户输入和模型输出进行内容审查
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="moderation-enabled" className="text-sm text-neutral-400">
                {settings.enabled ? "已启用" : "已禁用"}
              </Label>
              <Switch
                id="moderation-enabled"
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
              />
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* 审查阈值设置 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-neutral-300">内容审查阈值: {settings.threshold.toFixed(2)}</Label>
              <span className="text-xs text-neutral-500">
                {settings.threshold < 0.3 ? "严格" : settings.threshold > 0.8 ? "宽松" : "平衡"}
              </span>
            </div>
            <Slider
              value={[settings.threshold]}
              min={0.1}
              max={0.9}
              step={0.05}
              onValueChange={(value) => setSettings({ ...settings, threshold: value[0] })}
              className="w-full"
            />
            <p className="text-xs text-neutral-500 mt-1">
              降低阈值会增加审查严格程度，提高阈值则更为宽松。推荐设置在0.5-0.8之间。
            </p>
          </div>
          
          {/* 审查行为设置 */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-medium text-neutral-300">审查行为</h3>
            
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <p className="text-sm text-neutral-200">阻止违规用户输入</p>
                <p className="text-xs text-neutral-500 mt-1">
                  如果启用，含有不适当内容的用户输入将被阻止，并返回警告
                </p>
              </div>
              <Switch
                checked={settings.blockUserInput}
                onCheckedChange={(checked) => setSettings({ ...settings, blockUserInput: checked })}
              />
            </div>
            
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm text-neutral-200">阻止违规模型输出</p>
                <p className="text-xs text-neutral-500 mt-1">
                  如果启用，含有不适当内容的模型回复将被阻止，并返回警告
                </p>
              </div>
              <Switch
                checked={settings.blockModelOutput}
                onCheckedChange={(checked) => setSettings({ ...settings, blockModelOutput: checked })}
              />
            </div>
          </div>
        </CardContent>
        
        <CardFooter>
          <Button 
            onClick={saveSettings} 
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 ml-auto"
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            保存设置
          </Button>
        </CardFooter>
      </Card>
      
      {/* 审查测试工具 */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-white">内容审查测试</CardTitle>
          <CardDescription>
            测试内容审查功能，查看在当前阈值设置下内容会被如何分类
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="test-content" className="text-sm text-neutral-300 mb-2 block">
              测试文本
            </Label>
            <Textarea
              id="test-content"
              placeholder="输入要测试的文本内容..."
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="bg-neutral-800 border-neutral-700 text-neutral-200"
              rows={4}
            />
          </div>
          
          {renderTestResult()}
        </CardContent>
        
        <CardFooter>
          <Button 
            onClick={testModeration} 
            disabled={isTesting || !testText.trim()}
            className="bg-neutral-700 hover:bg-neutral-600 ml-auto"
          >
            {isTesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            测试内容
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}