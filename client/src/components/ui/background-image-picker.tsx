/**
 * 背景图片选择器
 * 允许用户上传自定义背景图片或从预设图片中选择
 */

import React, { useState } from 'react';
import { useTheme, BackgroundImage } from '../../contexts/ThemeContext';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Image, Upload, Check, X, RotateCcw } from 'lucide-react';

interface BackgroundImagePickerProps {
  onClose?: () => void;
}

export function BackgroundImagePicker({ onClose }: BackgroundImagePickerProps) {
  const { backgroundImage, setBackgroundImage, uploadBackgroundImage } = useTheme();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 预设背景图片
  const presetBackgrounds = [
    { id: 'default-light', url: '/backgrounds/light-background.jpg', name: '浅色空间' },
    { id: 'default-dark', url: '/backgrounds/dark-background.jpg', name: '深色空间' },
    { id: 'default-nature', url: '/backgrounds/nature-background.jpg', name: '自然风光' },
    { id: 'default-abstract', url: '/backgrounds/abstract-background.jpg', name: '抽象图案' },
    // 添加系统预设图片
  ];

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型和大小
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('仅支持 JPG, PNG, WEBP 和 GIF 格式的图片');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      setError('文件大小不能超过 5MB');
      return;
    }

    setError(null);
    setSelectedImage(file);

    // 创建预览 URL
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // 清理
    return () => URL.revokeObjectURL(objectUrl);
  };

  // 上传图片
  const handleUpload = async () => {
    if (!selectedImage) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + 10;
          return newProgress >= 90 ? 90 : newProgress;
        });
      }, 200);

      // 上传文件
      const newBackgroundImage = await uploadBackgroundImage(selectedImage);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // 设置新背景
      setBackgroundImage(newBackgroundImage);
      
      // 关闭选择器
      setTimeout(() => {
        if (onClose) onClose();
      }, 1000);
    } catch (err) {
      setError('上传失败: ' + (err instanceof Error ? err.message : '未知错误'));
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  // 选择预设背景
  const selectPresetBackground = (preset: {id: string, url: string}) => {
    // 预设图片使用特殊的 ID 格式，比如 'default-light'
    setBackgroundImage({
      fileId: preset.id,
      url: preset.url
    });
    
    if (onClose) onClose();
  };

  // 删除背景
  const removeBackground = () => {
    setBackgroundImage(null);
    if (onClose) onClose();
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-card shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Image className="mr-2" size={20} />
          背景图片设置
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {/* 当前背景信息 */}
        {backgroundImage && (
          <div className="mb-4 p-2 bg-muted rounded-md">
            <p className="text-sm mb-2">当前背景图片:</p>
            <div className="relative h-20 bg-cover bg-center rounded overflow-hidden">
              <img 
                src={backgroundImage.url} 
                alt="当前背景" 
                className="w-full h-full object-cover" 
              />
              <Button 
                variant="destructive" 
                size="icon" 
                className="absolute top-1 right-1" 
                onClick={removeBackground}
              >
                <X size={16} />
              </Button>
            </div>
          </div>
        )}
        
        {/* 上传新背景 */}
        <div className="space-y-3 mb-4">
          <Label htmlFor="background-image">上传新背景</Label>
          <Input 
            id="background-image" 
            type="file" 
            accept="image/jpeg,image/png,image/webp,image/gif" 
            onChange={handleFileChange} 
            disabled={isUploading}
          />
          
          {error && (
            <div className="text-destructive text-sm mt-1">{error}</div>
          )}
          
          {previewUrl && (
            <div className="mt-2">
              <p className="text-sm mb-1">预览:</p>
              <div className="relative h-40 bg-cover bg-center rounded overflow-hidden">
                <img 
                  src={previewUrl} 
                  alt="预览" 
                  className="w-full h-full object-cover" 
                />
              </div>
              
              {isUploading ? (
                <div className="mt-2">
                  <div className="w-full bg-muted rounded-full h-2 mt-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    正在上传... {uploadProgress}%
                  </p>
                </div>
              ) : (
                <Button 
                  className="w-full mt-2" 
                  onClick={handleUpload} 
                  disabled={!selectedImage}
                >
                  <Upload className="mr-2" size={16} />
                  上传图片
                </Button>
              )}
            </div>
          )}
        </div>
        
        {/* 预设背景选项 */}
        <div className="space-y-3">
          <Label>选择预设背景</Label>
          <div className="grid grid-cols-2 gap-2">
            {presetBackgrounds.map(bg => (
              <div 
                key={bg.id} 
                className="relative cursor-pointer rounded overflow-hidden group"
                onClick={() => selectPresetBackground(bg)}
              >
                <img 
                  src={bg.url} 
                  alt={bg.name} 
                  className="w-full h-20 object-cover"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs">{bg.name}</p>
                </div>
                {/* 如果是当前选中的背景，显示标记 */}
                {backgroundImage?.fileId === bg.id && (
                  <div className="absolute top-1 right-1 bg-primary rounded-full p-1">
                    <Check size={12} className="text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between border-t pt-4">
        <Button variant="outline" onClick={removeBackground}>
          <RotateCcw className="mr-2" size={16} />
          恢复默认
        </Button>
        <Button variant="outline" onClick={onClose}>
          关闭
        </Button>
      </CardFooter>
    </Card>
  );
}
