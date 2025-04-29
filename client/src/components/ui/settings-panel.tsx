/**
 * 设置面板
 * 用户可以在这里调整主题、字体大小、背景图片等设置
 */

import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from './dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { Button } from './button';
import { Label } from './label';
import { RadioGroup, RadioGroupItem } from './radio-group';
import { FontSize, Theme, useTheme } from '../../contexts/ThemeContext';
import { BackgroundImagePicker } from './background-image-picker';
import { Moon, Sun, Image, Type, Settings } from 'lucide-react';

export function SettingsPanel() {
  const { fontSize, theme, setFontSize, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  
  const handleFontSizeChange = (value: string) => {
    setFontSize(value as FontSize);
  };
  
  const handleThemeChange = (value: string) => {
    setTheme(value as Theme);
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
          <span className="sr-only">设置</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>用户偏好设置</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="theme" className="mt-5">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="theme">
              <Sun className="h-4 w-4 mr-2" /> 主题
            </TabsTrigger>
            <TabsTrigger value="font">
              <Type className="h-4 w-4 mr-2" /> 字体
            </TabsTrigger>
            <TabsTrigger value="background">
              <Image className="h-4 w-4 mr-2" /> 背景
            </TabsTrigger>
          </TabsList>
          
          {/* 主题设置选项卡 */}
          <TabsContent value="theme" className="space-y-4 py-4">
            <div className="space-y-4">
              <h4 className="text-sm font-medium">选择主题模式</h4>
              <RadioGroup
                value={theme}
                onValueChange={handleThemeChange}
                className="grid grid-cols-3 gap-4"
              >
                <div>
                  <RadioGroupItem 
                    value="light" 
                    id="theme-light" 
                    className="peer sr-only" 
                  />
                  <Label
                    htmlFor="theme-light"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Sun className="h-6 w-6 mb-3" />
                    浅色主题
                  </Label>
                </div>
                
                <div>
                  <RadioGroupItem 
                    value="dark" 
                    id="theme-dark" 
                    className="peer sr-only" 
                  />
                  <Label
                    htmlFor="theme-dark"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Moon className="h-6 w-6 mb-3" />
                    深色主题
                  </Label>
                </div>
                
                <div>
                  <RadioGroupItem 
                    value="system" 
                    id="theme-system" 
                    className="peer sr-only" 
                  />
                  <Label
                    htmlFor="theme-system"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <div className="flex">
                      <Sun className="h-6 w-6" />
                      <Moon className="h-6 w-6 ml-2" />
                    </div>
                    <div className="mt-3">跟随系统</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </TabsContent>
          
          {/* 字体设置选项卡 */}
          <TabsContent value="font" className="space-y-4 py-4">
            <div className="space-y-4">
              <h4 className="text-sm font-medium">选择字体大小</h4>
              <RadioGroup
                value={fontSize}
                onValueChange={handleFontSizeChange}
                className="grid grid-cols-3 gap-4"
              >
                <div>
                  <RadioGroupItem 
                    value="small" 
                    id="font-small" 
                    className="peer sr-only" 
                  />
                  <Label
                    htmlFor="font-small"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Type className="h-5 w-5 mb-3" />
                    <span className="text-sm">小号字体</span>
                  </Label>
                </div>
                
                <div>
                  <RadioGroupItem 
                    value="medium" 
                    id="font-medium" 
                    className="peer sr-only" 
                  />
                  <Label
                    htmlFor="font-medium"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Type className="h-6 w-6 mb-3" />
                    <span className="text-base">中号字体</span>
                  </Label>
                </div>
                
                <div>
                  <RadioGroupItem 
                    value="large" 
                    id="font-large" 
                    className="peer sr-only" 
                  />
                  <Label
                    htmlFor="font-large"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Type className="h-7 w-7 mb-3" />
                    <span className="text-lg">大号字体</span>
                  </Label>
                </div>
              </RadioGroup>
              
              <div className="mt-6 space-y-2">
                <h5 className="text-sm font-medium">文字示例</h5>
                <div className="rounded-md border border-border p-4 space-y-3">
                  <p>这是一个示例文本，用于展示当前选择的字体大小效果。你可以通过调整字体大小来获得最佳的阅读体验。</p>
                  <p className="text-sm text-muted-foreground">这是一个辅助文本，用于展示次要内容的字体效果。</p>
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* 背景设置选项卡 */}
          <TabsContent value="background" className="py-4">
            <BackgroundImagePicker onClose={() => setOpen(false)} />
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
