/**
 * 设置面板
 * 用户可以在这里调整主题、字体大小、背景图片等设置
 */
import React, { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/contexts/ThemeContext";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { BackgroundImagePicker } from "./background-image-picker";

export function SettingsPanel() {
  const { theme, fontSize, setTheme, setFontSize, setBackgroundStyle } = useTheme();
  const [activeTab, setActiveTab] = useState("general");
  
  // 获取当前背景样式
  const currentStyle = document.documentElement.dataset.backgroundStyle || 'transparent';

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>用户偏好设置</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1">
              一般设置
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex-1">
              外观
            </TabsTrigger>
            <TabsTrigger value="background" className="flex-1">
              背景图片
            </TabsTrigger>
          </TabsList>

          {/* 一般设置 */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="autoSave">自动保存停留位置</Label>
                <Switch id="autoSave" defaultChecked />
              </div>
            </div>
          </TabsContent>

          {/* 外观设置 */}
          <TabsContent value="appearance" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">主题模式</Label>
                <RadioGroup
                  value={theme}
                  onValueChange={(val) => setTheme(val as "light" | "dark" | "system")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="light" />
                    <Label htmlFor="light">浅色模式</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="dark" />
                    <Label htmlFor="dark">深色模式</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="system" id="system" />
                    <Label htmlFor="system">系统模式</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="mb-2 block">字体大小</Label>
                <RadioGroup
                  value={fontSize}
                  onValueChange={(val) => setFontSize(val as "small" | "medium" | "large")}
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
            </div>
          </TabsContent>

          {/* 背景图片设置 */}
          <TabsContent value="background" className="mt-4">
            <BackgroundImagePicker />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
