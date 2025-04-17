import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, UserCheck, Lock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// 系统配置类型
interface SystemConfig {
  id: number;
  key: string;
  value: string;
  description: string | null;
}

export const SystemSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 状态
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [loginEnabled, setLoginEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 加载系统配置
  const { data: configData, isLoading } = useQuery({
    queryKey: ["/api/system-config"],
    queryFn: async () => {
      const response = await fetch("/api/system-config");
      if (!response.ok) {
        throw new Error("加载系统配置失败");
      }
      return response.json();
    },
  });

  // 初始化开关状态
  useEffect(() => {
    if (configData) {
      const registrationConfig = configData.find((config: SystemConfig) => config.key === "registration_enabled");
      const loginConfig = configData.find((config: SystemConfig) => config.key === "login_enabled");
      
      setRegistrationEnabled(registrationConfig ? registrationConfig.value === "true" : true);
      setLoginEnabled(loginConfig ? loginConfig.value === "true" : true);
    }
  }, [configData]);

  // 更新系统配置
  const updateConfigMutation = useMutation({
    mutationFn: async (config: { key: string; value: string; description?: string }) => {
      const response = await fetch("/api/system-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        throw new Error("更新系统配置失败");
      }
      
      return response.json();
    },
    onSuccess: () => {
      // 更新缓存的系统配置数据
      queryClient.invalidateQueries({ queryKey: ["/api/system-config"] });
    }
  });

  // 保存所有配置
  const saveAllSettings = async () => {
    setIsSaving(true);
    
    try {
      // 更新注册开关
      await updateConfigMutation.mutateAsync({
        key: "registration_enabled",
        value: registrationEnabled ? "true" : "false",
        description: "是否允许新用户注册"
      });
      
      // 更新登录开关
      await updateConfigMutation.mutateAsync({
        key: "login_enabled",
        value: loginEnabled ? "true" : "false",
        description: "是否允许用户登录"
      });
      
      toast({
        title: "设置已保存",
        description: "系统配置更新成功",
      });
    } catch (error) {
      toast({
        title: "保存失败",
        description: "无法更新系统配置，请重试",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="pt-6">
            <p className="text-neutral-400">加载系统设置中...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <div className="flex items-center">
            <ShieldAlert className="h-6 w-6 text-yellow-500 mr-2" />
            <CardTitle className="text-white">系统安全设置</CardTitle>
          </div>
          <CardDescription>
            控制系统关键功能的开启和关闭，以应对高流量或潜在的攻击
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* 注册功能开关 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <UserCheck className="h-6 w-6 text-blue-500" />
                <div>
                  <Label htmlFor="registration-switch" className="text-white font-medium">
                    允许新用户注册
                  </Label>
                  <p className="text-sm text-neutral-400">
                    关闭此功能将阻止新用户注册，已有用户不受影响
                  </p>
                </div>
              </div>
              <Switch
                id="registration-switch"
                checked={registrationEnabled}
                onCheckedChange={setRegistrationEnabled}
              />
            </div>

            {/* 登录功能开关 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Lock className="h-6 w-6 text-green-500" />
                <div>
                  <Label htmlFor="login-switch" className="text-white font-medium">
                    允许用户登录
                  </Label>
                  <p className="text-sm text-neutral-400">
                    关闭此功能将阻止所有用户登录，紧急情况下使用
                  </p>
                </div>
              </div>
              <Switch
                id="login-switch"
                checked={loginEnabled}
                onCheckedChange={setLoginEnabled}
              />
            </div>

            {/* 保存按钮 */}
            <div className="flex justify-end mt-6">
              <Button 
                onClick={saveAllSettings} 
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSaving ? "保存中..." : "保存设置"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};