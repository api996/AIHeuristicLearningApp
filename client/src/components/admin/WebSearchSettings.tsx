import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Search, Globe } from "lucide-react";

const WebSearchSettings = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const queryClient = useQueryClient();

  // 获取当前网络搜索状态
  const { data, isLoading } = useQuery({
    queryKey: ['/api/web-search/status'],
    onSuccess: (data) => {
      if (data.success) {
        setIsEnabled(data.enabled);
      }
    },
    onError: () => {
      toast({
        title: "获取状态失败",
        description: "无法获取网络搜索状态，请稍后重试",
        variant: "destructive"
      });
    }
  });

  // 启用网络搜索
  const enableMutation = useMutation({
    mutationFn: () => apiRequest('/api/web-search/enable', 'POST'),
    onSuccess: (data) => {
      if (data.success) {
        setIsEnabled(true);
        toast({
          title: "已启用",
          description: "网络搜索功能已成功启用",
          variant: "default"
        });
        queryClient.invalidateQueries({ queryKey: ['/api/web-search/status'] });
      }
    },
    onError: () => {
      toast({
        title: "启用失败",
        description: "无法启用网络搜索功能，请检查服务器配置",
        variant: "destructive"
      });
    }
  });

  // 禁用网络搜索
  const disableMutation = useMutation({
    mutationFn: () => apiRequest('/api/web-search/disable', 'POST'),
    onSuccess: (data) => {
      if (data.success) {
        setIsEnabled(false);
        toast({
          title: "已禁用",
          description: "网络搜索功能已成功禁用",
          variant: "default"
        });
        queryClient.invalidateQueries({ queryKey: ['/api/web-search/status'] });
      }
    },
    onError: () => {
      toast({
        title: "禁用失败",
        description: "无法禁用网络搜索功能，请稍后重试",
        variant: "destructive"
      });
    }
  });
  
  // 切换网络搜索状态
  const toggleWebSearch = () => {
    if (isEnabled) {
      disableMutation.mutate();
    } else {
      enableMutation.mutate();
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
            disabled={isLoading || enableMutation.isPending || disableMutation.isPending}
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