import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Search, Globe } from "lucide-react";

// 定义响应类型
interface WebSearchStatusResponse {
  success: boolean;
  enabled: boolean;
  message?: string;
}

const WebSearchSettings = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();

  // 获取当前网络搜索状态
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/web-search/status');
        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }
        const data = await response.json() as WebSearchStatusResponse;
        if (data.success) {
          setIsEnabled(data.enabled);
        }
      } catch (error) {
        toast({
          title: "获取状态失败",
          description: "无法获取网络搜索状态，请稍后重试",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
  }, []);

  // 切换网络搜索状态
  const toggleWebSearch = async () => {
    try {
      setIsPending(true);
      const endpoint = isEnabled ? '/api/web-search/disable' : '/api/web-search/enable';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ${isEnabled ? 'disable' : 'enable'} web search`);
      }
      
      const data = await response.json() as WebSearchStatusResponse;
      
      if (data.success) {
        setIsEnabled(!isEnabled);
        toast({
          title: isEnabled ? "已禁用" : "已启用",
          description: isEnabled ? "网络搜索功能已成功禁用" : "网络搜索功能已成功启用",
          variant: "default"
        });
      }
    } catch (error) {
      toast({
        title: isEnabled ? "禁用失败" : "启用失败",
        description: `无法${isEnabled ? '禁用' : '启用'}网络搜索功能，请稍后重试`,
        variant: "destructive"
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          网络搜索
        </CardTitle>
        <CardDescription>
          启用后，AI将能够搜索互联网获取最新信息来回答问题
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h4 className="text-sm font-medium">网络搜索状态</h4>
            <p className="text-sm text-muted-foreground">
              {isEnabled ? '已启用' : '已禁用'}
            </p>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={toggleWebSearch}
            disabled={isLoading || isPending}
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <p className="text-sm text-muted-foreground">
          {isEnabled ? 
            '当前AI助手能够访问互联网搜索最新信息' : 
            '当前AI助手仅使用其训练数据回答问题'}
        </p>
      </CardFooter>
    </Card>
  );
};

export default WebSearchSettings;