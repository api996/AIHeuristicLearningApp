import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { useQueryClient } from '@tanstack/react-query';

interface UserSettings {
  id?: number;
  userId?: number;
  theme?: string;
  font_size?: string;
  background_file?: string | null;
  primary_color?: string;
  background_style?: string;
  ui_radius?: number;
}

// 用于测试新的个性化设置系统
export default function TestPreferencesPage() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<number>(6); // 默认用户ID
  const [settings, setSettings] = useState<UserSettings>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 加载用户设置
  async function loadSettings() {
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch(`/api/user-settings/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setMessage('设置加载成功');
      } else {
        setMessage('加载设置失败：' + (await response.text()));
      }
    } catch (error) {
      setMessage('加载设置出错：' + error);
    } finally {
      setLoading(false);
    }
  }

  // 保存用户设置
  async function saveSettings() {
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch(`/api/user-settings/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          theme: settings.theme,
          font_size: settings.font_size,
          background_file: settings.background_file,
          primary_color: settings.primary_color,
          background_style: settings.background_style,
          ui_radius: settings.ui_radius
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setMessage('设置保存成功');
        
        // 刷新缓存以确保其他组件获取新设置
        queryClient.invalidateQueries({queryKey: ['/api/user-settings']});
      } else {
        setMessage('保存设置失败：' + (await response.text()));
      }
    } catch (error) {
      setMessage('保存设置出错：' + error);
    } finally {
      setLoading(false);
    }
  }

  // 组件加载时获取设置
  useEffect(() => {
    loadSettings();
  }, [userId]);

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">个性化偏好设置测试</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>用户设置</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <Label htmlFor="userId">用户ID</Label>
                <div className="flex gap-2">
                  <Input 
                    id="userId" 
                    type="number" 
                    value={userId} 
                    onChange={(e) => setUserId(parseInt(e.target.value) || 1)}
                  />
                  <Button onClick={loadSettings} disabled={loading}>
                    加载设置
                  </Button>
                </div>
              </div>
              
              <div>
                <Label className="mb-2 block">主题</Label>
                <RadioGroup 
                  value={settings.theme || 'system'}
                  onValueChange={(value) => setSettings({...settings, theme: value})}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="light" />
                    <Label htmlFor="light">亮色</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="dark" />
                    <Label htmlFor="dark">暗色</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="system" id="system" />
                    <Label htmlFor="system">系统</Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div>
                <Label className="mb-2 block">字体大小</Label>
                <RadioGroup 
                  value={settings.font_size || 'medium'}
                  onValueChange={(value) => setSettings({...settings, font_size: value})}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="small" id="small" />
                    <Label htmlFor="small">小</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="medium" />
                    <Label htmlFor="medium">中</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="large" id="large" />
                    <Label htmlFor="large">大</Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div>
                <Label htmlFor="primary_color">主题颜色</Label>
                <div className="flex gap-3 items-center">
                  <Input 
                    id="primary_color" 
                    type="color" 
                    value={settings.primary_color || '#0deae4'} 
                    onChange={(e) => setSettings({...settings, primary_color: e.target.value})}
                    className="w-24 h-10"
                  />
                  <span className="text-sm">{settings.primary_color || '#0deae4'}</span>
                </div>
              </div>
              
              <div>
                <Label className="mb-2 block">背景样式</Label>
                <RadioGroup 
                  value={settings.background_style || 'blur'}
                  onValueChange={(value) => setSettings({...settings, background_style: value})}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="blur" id="blur" />
                    <Label htmlFor="blur">模糊</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="solid" id="solid" />
                    <Label htmlFor="solid">纯色</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="transparent" id="transparent" />
                    <Label htmlFor="transparent">透明</Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div>
                <Label htmlFor="ui_radius" className="mb-2 block">界面圆角 ({settings.ui_radius || 8}px)</Label>
                <Slider
                  id="ui_radius"
                  min={0}
                  max={20}
                  step={1}
                  value={[settings.ui_radius || 8]}
                  onValueChange={([value]) => setSettings({...settings, ui_radius: value})}
                />
              </div>
              
              <Button onClick={saveSettings} disabled={loading} className="w-full">
                保存设置
              </Button>
              
              {message && (
                <div className={`p-3 rounded ${message.includes('成功') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {message}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>预览</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">当前设置:</h3>
                <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto text-sm">
                  {JSON.stringify(settings, null, 2)}
                </pre>
              </div>
              
              <div className="border p-4 rounded-lg">
                <h3 className="font-semibold mb-3">主题预览</h3>
                <div 
                  className="w-full h-40 rounded-lg flex items-center justify-center" 
                  style={{ 
                    backgroundColor: settings.primary_color || '#0deae4', 
                    borderRadius: `${settings.ui_radius || 8}px`
                  }}
                >
                  <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
                    样式预览
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
