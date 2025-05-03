import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, UserCheck, Lock, ImageIcon, Upload } from "lucide-react";
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
  
  // 用于文件上传的引用
  const landscapeFileInputRef = useRef<HTMLInputElement>(null);
  const portraitFileInputRef = useRef<HTMLInputElement>(null);

  // 状态
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [loginEnabled, setLoginEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState<{
    landscape: boolean;
    portrait: boolean;
  }>({ landscape: false, portrait: false });
  const [backgroundInfo, setBackgroundInfo] = useState<{
    landscape: { exists: boolean; url: string; size?: number; modifiedAt?: Date };
    portrait: { exists: boolean; url: string; size?: number; modifiedAt?: Date };
  }>({
    landscape: { exists: false, url: '' },
    portrait: { exists: false, url: '' },
  });

  // 加载系统配置
  const { data: configData, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["/api/system-config"],
    queryFn: async () => {
      const response = await fetch("/api/system-config");
      if (!response.ok) {
        throw new Error("加载系统配置失败");
      }
      return response.json();
    },
  });
  
  // 加载背景图片信息
  const { data: backgroundData, isLoading: isLoadingBackgrounds } = useQuery({
    queryKey: ["/api/files/admin/default-background"],
    queryFn: async () => {
      const response = await fetch("/api/files/admin/default-background");
      if (!response.ok) {
        throw new Error("加载背景图片信息失败");
      }
      return response.json();
    },
  });
  
  // 当背景数据加载完成后设置状态
  useEffect(() => {
    if (backgroundData) {
      setBackgroundInfo({
        landscape: backgroundData.landscape || { exists: false, url: '' },
        portrait: backgroundData.portrait || { exists: false, url: '' },
      });
    }
  }, [backgroundData]);

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

  // 上传背景图片
  const uploadBackground = async (file: File, type: 'landscape' | 'portrait') => {
    // 检查文件类型
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "文件类型不支持",
        description: "请上传JPG, PNG, WEBP或GIF格式的图片",
        variant: "destructive",
      });
      return;
    }

    // 检查文件大小
    if (file.size > 10 * 1024 * 1024) { // 10MB
      toast({
        title: "文件过大",
        description: "请上传10MB以内的图片",
        variant: "destructive",
      });
      return;
    }

    // 设置上传状态
    setIsUploading(prev => ({ ...prev, [type]: true }));

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const response = await fetch('/api/files/admin/default-background', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`上传失败: ${response.statusText}`);
      }

      const result = await response.json();

      // 更新背景信息
      queryClient.invalidateQueries({ queryKey: ["/api/files/admin/default-background"] });

      toast({
        title: `${type === 'landscape' ? '横屏' : '竖屏'}背景已更新`,
        description: "默认背景图片已成功更新",
      });

      // 更新本地状态，添加随机查询参数以避免缓存
      setBackgroundInfo(prev => ({
        ...prev,
        [type]: { 
          exists: true, 
          url: `${result.originalUrl}?v=${Date.now()}`
        }
      }));

    } catch (error) {
      console.error("上传背景图片失败:", error);
      toast({
        title: "上传失败",
        description: "无法上传背景图片，请重试",
        variant: "destructive",
      });
    } finally {
      setIsUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  // 触发文件选择对话框
  const triggerFileInput = (type: 'landscape' | 'portrait') => {
    if (type === 'landscape' && landscapeFileInputRef.current) {
      landscapeFileInputRef.current.click();
    } else if (type === 'portrait' && portraitFileInputRef.current) {
      portraitFileInputRef.current.click();
    }
  };

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'landscape' | 'portrait') => {
    const file = e.target.files?.[0];
    if (file) {
      uploadBackground(file, type);
    }
    // 重置输入，以便可以选择相同的文件
    e.target.value = '';
  };

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

  // 加载状态判断
  const isLoading = isLoadingConfig || isLoadingBackgrounds;

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
    <div className="container mx-auto px-4 py-8 space-y-8 system-settings-grid">
      {/* 安全设置卡片 */}
      <Card className="bg-neutral-900 border-neutral-800 system-settings-card">
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

      {/* 默认背景图片设置卡片 */}
      <Card className="bg-neutral-900 border-neutral-800 system-settings-card">
        <CardHeader>
          <div className="flex items-center">
            <ImageIcon className="h-6 w-6 text-purple-500 mr-2" />
            <CardTitle className="text-white">默认背景图片管理</CardTitle>
          </div>
          <CardDescription>
            设置系统默认的横屏和竖屏背景图片，将用于新用户或未设置背景的用户
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 横屏背景图片设置 */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-medium text-white">横屏背景图片</h3>
                <p className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">桌面端</p>
              </div>
              
              <div className="relative rounded-lg overflow-hidden bg-neutral-800 border border-neutral-700 aspect-video">
                {backgroundInfo.landscape.exists ? (
                  <img 
                    src={backgroundInfo.landscape.url || '/backgrounds/landscape-background.jpg'}
                    alt="横屏默认背景"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-500">
                    <p>未设置默认背景</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center">
                <div className="text-sm text-neutral-400">
                  {backgroundInfo.landscape.exists && backgroundInfo.landscape.modifiedAt && (
                    <p>
                      更新于: {new Date(backgroundInfo.landscape.modifiedAt).toLocaleString()}
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => triggerFileInput('landscape')}
                  disabled={isUploading.landscape}
                  className="bg-purple-600 hover:bg-purple-700"
                  size="sm"
                >
                  {isUploading.landscape ? (
                    <div className="flex items-center space-x-1">
                      <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                      <span>上传中...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1">
                      <Upload className="h-4 w-4" />
                      <span>更换背景</span>
                    </div>
                  )}
                </Button>
              </div>
            </div>

            {/* 竖屏背景图片设置 */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-medium text-white">竖屏背景图片</h3>
                <p className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded">移动端</p>
              </div>
              
              <div className="relative rounded-lg overflow-hidden bg-neutral-800 border border-neutral-700 aspect-[9/16]">
                {backgroundInfo.portrait.exists ? (
                  <img 
                    src={backgroundInfo.portrait.url || '/backgrounds/portrait-background.jpg'}
                    alt="竖屏默认背景"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-500">
                    <p>未设置默认背景</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center">
                <div className="text-sm text-neutral-400">
                  {backgroundInfo.portrait.exists && backgroundInfo.portrait.modifiedAt && (
                    <p>
                      更新于: {new Date(backgroundInfo.portrait.modifiedAt).toLocaleString()}
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => triggerFileInput('portrait')}
                  disabled={isUploading.portrait}
                  className="bg-purple-600 hover:bg-purple-700"
                  size="sm"
                >
                  {isUploading.portrait ? (
                    <div className="flex items-center space-x-1">
                      <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                      <span>上传中...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1">
                      <Upload className="h-4 w-4" />
                      <span>更换背景</span>
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* 隐藏的文件输入 */}
          <input
            type="file"
            ref={landscapeFileInputRef}
            onChange={(e) => handleFileChange(e, 'landscape')}
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            className="hidden"
          />
          <input
            type="file"
            ref={portraitFileInputRef}
            onChange={(e) => handleFileChange(e, 'portrait')}
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            className="hidden"
          />
        </CardContent>
      </Card>
    </div>
  );
};