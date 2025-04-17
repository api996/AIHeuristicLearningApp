import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Upload, Image as ImageIcon, RefreshCw, X } from "lucide-react";

interface BackgroundUploaderProps {
  userId: number;
  onBackgroundChange?: (url: string) => void;
}

export function BackgroundUploader({ userId, onBackgroundChange }: BackgroundUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentBackground, setCurrentBackground] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [userBackgrounds, setUserBackgrounds] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // 获取当前背景
  useEffect(() => {
    fetchCurrentBackground();
  }, [userId]);

  // 获取用户上传的背景列表
  useEffect(() => {
    if (isOpen) {
      fetchUserBackgrounds();
    }
  }, [isOpen, userId]);

  const fetchCurrentBackground = async () => {
    try {
      const response = await axios.get('/api/files/background');
      if (response.data && response.data.url) {
        setCurrentBackground(response.data.url);
        if (onBackgroundChange) {
          onBackgroundChange(response.data.url);
        }
      }
    } catch (error) {
      console.error('获取当前背景失败:', error);
    }
  };

  const fetchUserBackgrounds = async () => {
    try {
      console.log('正在获取背景列表...');
      // 确保只获取当前用户的背景
      const response = await axios.get(`/api/files/list?type=background&userId=${userId}`, {
        withCredentials: true
      });
      if (response.data && response.data.files) {
        console.log('获取到的背景列表:', response.data.files);
        setUserBackgrounds(response.data.files);
      }
    } catch (error) {
      console.error('获取背景列表失败:', error);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      
      // 创建预览
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadBackground = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('fileType', 'background');

    try {
      const response = await axios.post('/api/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data && response.data.url) {
        setCurrentBackground(response.data.url);
        if (onBackgroundChange) {
          onBackgroundChange(response.data.url);
        }
        toast({
          title: "背景上传成功",
          description: "您的新背景已设置",
        });
        
        // 清除预览和选择
        setSelectedFile(null);
        setPreviewUrl(null);
        
        // 刷新背景列表
        fetchUserBackgrounds();
      }
    } catch (error) {
      console.error('上传背景失败:', error);
      toast({
        title: "上传失败",
        description: "背景图片上传失败，请重试",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const selectBackground = async (url: string) => {
    setCurrentBackground(url);
    if (onBackgroundChange) {
      onBackgroundChange(url);
    }
    setIsOpen(false);
  };

  const deleteBackground = async (fileId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    try {
      await axios.delete(`/api/files/${fileId}`);
      toast({
        title: "删除成功",
        description: "背景图片已删除",
      });
      
      // 刷新背景列表
      fetchUserBackgrounds();
    } catch (error) {
      console.error('删除背景失败:', error);
      toast({
        title: "删除失败",
        description: "无法删除背景图片，请重试",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex gap-2 items-center">
          <ImageIcon size={16} />
          <span>更换背景</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>背景设置</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {/* 上传新背景 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">上传新背景</h3>
            <div className="flex flex-col gap-2">
              <div 
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                onClick={() => document.getElementById('background-upload')?.click()}
              >
                {previewUrl ? (
                  <div className="relative">
                    <img 
                      src={previewUrl} 
                      alt="预览" 
                      className="max-h-[200px] mx-auto rounded-md object-cover" 
                    />
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="absolute top-1 right-1 bg-black/40 hover:bg-black/60 text-white rounded-full h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewUrl(null);
                        setSelectedFile(null);
                      }}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                ) : (
                  <div className="py-4 flex flex-col items-center">
                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">
                      点击选择图片或拖拽图片到此处
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      支持 JPG, PNG, WEBP 格式，最大 10MB
                    </p>
                  </div>
                )}
                <input
                  id="background-upload"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>
              
              <Button 
                onClick={uploadBackground} 
                disabled={!selectedFile || isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    上传中...
                  </>
                ) : '上传背景'}
              </Button>
            </div>
          </div>
          
          {/* 已有背景列表 */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">我的背景</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2"
                onClick={fetchUserBackgrounds}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                刷新
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {/* 默认背景 - 根据当前屏幕方向显示 */}
              <Card 
                className={`relative cursor-pointer overflow-hidden ${
                  currentBackground.includes('landscape-background') || currentBackground.includes('default-background') 
                    ? 'ring-2 ring-[#0deae4]' : ''
                }`}
                onClick={() => {
                  const isPortrait = window.matchMedia("(orientation: portrait)").matches;
                  selectBackground(isPortrait 
                    ? '/backgrounds/portrait-background.jpg' 
                    : '/backgrounds/landscape-background.jpg');
                }}
              >
                <div className="aspect-video relative">
                  <img 
                    src={window.matchMedia("(orientation: portrait)").matches 
                      ? "/backgrounds/portrait-background.jpg" 
                      : "/backgrounds/landscape-background.jpg"} 
                    alt="默认背景" 
                    className="w-full h-full object-cover" 
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 text-center">
                    默认背景
                  </div>
                </div>
              </Card>
              
              {/* 用户上传的背景 */}
              {userBackgrounds.map((bg) => (
                <Card 
                  key={bg.fileId} 
                  className={`relative cursor-pointer overflow-hidden ${
                    currentBackground === bg.publicUrl ? 'ring-2 ring-[#0deae4]' : ''
                  }`}
                  onClick={() => selectBackground(bg.publicUrl)}
                >
                  <div className="aspect-video relative">
                    <img 
                      src={bg.publicUrl} 
                      alt="背景" 
                      className="w-full h-full object-cover" 
                    />
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="absolute top-1 right-1 bg-black/40 hover:bg-black/60 text-white rounded-full h-6 w-6"
                      onClick={(e) => deleteBackground(bg.fileId, e)}
                    >
                      <X size={12} />
                    </Button>
                  </div>
                </Card>
              ))}
              
              {userBackgrounds.length === 0 && (
                <div className="col-span-2 text-center py-4 text-sm text-gray-500">
                  暂无自定义背景，请上传新背景
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}