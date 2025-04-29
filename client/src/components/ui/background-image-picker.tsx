/**
 * 背景图片选择器
 * 允许用户上传自定义背景图片或从预设图片中选择
 */
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, ImageIcon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";

// 预设的背景图片选项
const presetBackgrounds = [
  { id: "default", url: "/backgrounds/default-background.jpg", name: "默认背景" },
  { id: "landscape", url: "/backgrounds/landscape-background.jpg", name: "风景背景" },
  { id: "mobile", url: "/backgrounds/mobile-background.jpg", name: "移动背景" },
  { id: "portrait", url: "/backgrounds/portrait-background.jpg", name: "纵向背景" },
];

interface BackgroundImagePickerProps {
  onClose?: () => void;
}

export function BackgroundImagePicker({ onClose }: BackgroundImagePickerProps) {
  const { backgroundImage, setBackgroundImage, clearBackgroundImage, uploadBackgroundImage } = useTheme();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // 处理文件选择
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.includes('image')) {
      toast({
        title: "文件类型错误",
        description: "请选择图片文件（JPG、PNG等）",
        variant: "destructive",
      });
      return;
    }

    // 验证文件大小
    if (file.size > 5 * 1024 * 1024) { // 5MB
      toast({
        title: "文件过大",
        description: "背景图片不能超过5MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);
      await uploadBackgroundImage(file);
      toast({
        title: "上传成功",
        description: "背景图片已更新",
      });
      if (onClose) onClose();
    } catch (error) {
      console.error("Background upload error:", error);
      toast({
        title: "上传失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // 清除文件输入，以便再次选择同一文件时触发变化事件
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 选择预设背景
  const selectPresetBackground = (url: string) => {
    // 创建一个符合BackgroundImage格式的对象
    const bgImage = {
      fileId: url.split('/').pop() || 'preset-background',
      url: url
    };
    setBackgroundImage(bgImage);
    toast({
      title: "背景已更改",
      description: "已应用预设背景图片",
    });
    if (onClose) onClose();
  };

  // 清除背景
  const handleClearBackground = () => {
    clearBackgroundImage();
    toast({
      title: "背景已移除",
      description: "恢复为默认背景",
    });
  };

  // 触发文件选择对话框
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-2 block font-medium">自定义背景</Label>
        <div className="flex flex-col space-y-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <Button 
            variant="outline" 
            onClick={triggerFileInput}
            disabled={isUploading}
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            {isUploading ? "正在上传..." : "上传图片"}
          </Button>
          
          {backgroundImage && (
            <Button 
              variant="ghost" 
              onClick={handleClearBackground}
              className="w-full mt-2"
            >
              <X className="mr-2 h-4 w-4" />
              移除背景
            </Button>
          )}
        </div>
      </div>

      <div>
        <Label className="mb-2 block font-medium">预设背景</Label>
        <div className="grid grid-cols-2 gap-2">
          {presetBackgrounds.map((bg) => (
            <Card 
              key={bg.id} 
              className={`overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-primary ${backgroundImage && backgroundImage.url === bg.url ? 'ring-2 ring-primary' : ''}`}
              onClick={() => selectPresetBackground(bg.url)}
            >
              <CardContent className="p-0 relative aspect-video">
                <div 
                  className="w-full h-full" 
                  style={{
                    backgroundImage: `url(${bg.url})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center"
                  }}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-background/80 p-1 text-xs text-center">
                  {bg.name}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        <p className="mb-2">提示：文件大小不应超过5MB，支持JPG、PNG等常见图片格式</p>
      </div>
    </div>
  );
}
