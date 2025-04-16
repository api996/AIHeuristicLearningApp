import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { Navbar } from '@/components/ui/navbar';

// 类型定义
interface Memory {
  id: string;
  content: string;
  type: string;
  timestamp: string;
  summary: string;
  keywords: string[];
}

interface MemoryCluster {
  id: string;
  topic: string;
  count: number;
  percentage: number;
  memoryIds?: string[];
  representativeMemory?: Memory;
}

const MemorySpace: React.FC = () => {
  const { toast } = useToast();
  const { userId } = useAuth();
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('all');
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  
  // 直接从localStorage加载用户信息
  const [localUserId, setLocalUserId] = useState<number | null>(null);
  
  // 这个函数会直接从localStorage获取用户ID，不依赖useAuth
  const getUserFromLocalStorage = useCallback(() => {
    const storedUser = localStorage.getItem("user");
    console.log('直接获取localStorage中的用户数据:', storedUser ? '存在' : '不存在');
    
    if (!storedUser) return null;
    
    try {
      const parsed = JSON.parse(storedUser);
      if (parsed && parsed.userId) {
        console.log('已从localStorage加载用户ID:', parsed.userId);
        return parsed.userId;
      }
    } catch (e) {
      console.error('解析localStorage用户数据失败:', e);
    }
    return null;
  }, []);
  
  // 初始化时加载用户信息
  useEffect(() => {
    console.log('Memory Space 组件加载');
    console.log('Current location:', location);
    console.log('useAuth 提供的用户ID:', userId);
    
    const localId = getUserFromLocalStorage();
    setLocalUserId(localId);
    
    // 如果localStorage中没有用户信息，跳转到登录页
    if (!localId) {
      console.log('Memory Space: 本地存储中没有用户信息，跳转到登录页面');
      setLocation('/login');
    }
  }, [location, userId, setLocation, getUserFromLocalStorage]);

  // 获取用户记忆列表
  const { 
    data: memoriesData, 
    isLoading: isLoadingMemories,
    refetch: refetchMemories
  } = useQuery({
    queryKey: ['/api/memory-space', localUserId || userId],
    // 使用localUserId或userId中任一有效值
    enabled: !!(localUserId || userId),
    select: (data) => {
      return data || { memories: [] };
    }
  });

  // 获取记忆聚类
  const { 
    data: clustersData, 
    isLoading: isLoadingClusters 
  } = useQuery({
    queryKey: ['/api/memory-space', localUserId || userId, 'clusters'],
    // 使用localUserId或userId中任一有效值
    enabled: !!(localUserId || userId),
    select: (data) => {
      return data || { topics: [] };
    }
  });

  // 搜索相似记忆
  const { 
    mutate: searchMemories,
    data: searchResults,
    isPending: isSearching,
    reset: resetSearch
  } = useMutation({
    mutationFn: async (query: string) => {
      // 使用localUserId或userId中任一有效值
      const effectiveUserId = localUserId || userId;
      console.log('搜索记忆使用的用户ID:', effectiveUserId);
      
      const response = await apiRequest(
        'POST',
        `/api/memory-space/${effectiveUserId}/search`,
        { query, limit: 10 }
      );
      return response.json();
    }
  });

  // 修复记忆数据
  const {
    mutate: repairMemories,
    isPending: isRepairing
  } = useMutation({
    mutationFn: async () => {
      // 使用localUserId或userId中任一有效值
      const effectiveUserId = localUserId || userId;
      console.log('修复记忆使用的用户ID:', effectiveUserId);
      
      return apiRequest(
        'POST',
        `/api/memory-space/${effectiveUserId}/repair`
      );
    },
    onSuccess: (data) => {
      toast({
        title: '记忆修复完成',
        description: data.message || `已整理 ${data.count} 条记忆数据`,
      });
      refetchMemories();
    },
    onError: () => {
      toast({
        title: '记忆修复失败',
        description: '无法整理记忆数据，请稍后再试',
        variant: 'destructive'
      });
    }
  });

  // 记忆列表(处理搜索结果或全部记忆)
  const memories = searchResults?.results || memoriesData?.memories || [];
  
  // 按选中的聚类过滤记忆
  const filteredMemories = selectedCluster 
    ? memories.filter(memory => {
        const cluster = (clustersData?.topics || []).find(c => c.id === selectedCluster);
        return cluster?.memoryIds?.includes(memory.id);
      })
    : memories;

  // 执行搜索
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      resetSearch();
      return;
    }
    searchMemories(searchQuery);
  };

  // 切换到记忆详情
  const handleMemoryClick = (memory: Memory) => {
    setSelectedMemory(memory);
  };

  // 返回到记忆列表
  const handleBackToList = () => {
    setSelectedMemory(null);
  };

  // 处理记忆修复
  const handleRepairMemories = () => {
    repairMemories();
  };

  // 格式化日期显示
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 提前返回，不调用setState（已在useEffect中处理）
  // 只要任一用户ID存在就渲染内容
  const effectiveUserId = localUserId || userId;
  if (!effectiveUserId) {
    console.log('没有有效的用户ID，不渲染内容');
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto py-6 flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">记忆空间</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRepairMemories} disabled={isRepairing}>
              {isRepairing ? <Spinner className="mr-2 h-4 w-4" /> : null}
              整理记忆数据
            </Button>
          </div>
        </div>

        <Tabs 
          value={selectedTab} 
          onValueChange={setSelectedTab}
          className="flex-1 flex flex-col"
        >
          <div className="flex justify-between items-center">
            <TabsList>
              <TabsTrigger value="all">所有记忆</TabsTrigger>
              <TabsTrigger value="clusters">主题聚类</TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              <Input
                placeholder="搜索记忆..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-60"
              />
              <Button size="icon" onClick={handleSearch} disabled={isSearching}>
                {isSearching ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* 所有记忆标签页 */}
          <TabsContent value="all" className="flex-1 mt-4">
            {isLoadingMemories ? (
              <div className="flex justify-center items-center h-64">
                <Spinner className="h-8 w-8" />
              </div>
            ) : selectedMemory ? (
              // 记忆详情视图
              <div className="mt-4">
                <Button variant="ghost" onClick={handleBackToList} className="mb-4">
                  &larr; 返回记忆列表
                </Button>
                <Card>
                  <CardHeader>
                    <CardTitle>记忆详情</CardTitle>
                    <CardDescription>
                      {formatDate(selectedMemory.timestamp)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold mb-1">摘要</h4>
                      <p className="text-muted-foreground">{selectedMemory.summary}</p>
                    </div>
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold mb-1">内容</h4>
                      <div className="p-4 border rounded-md bg-muted/30 whitespace-pre-wrap">
                        {selectedMemory.content}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold mb-1">关键词</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedMemory.keywords?.map((keyword, idx) => (
                          <Badge key={idx} variant="secondary">{keyword}</Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              // 记忆列表视图
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {searchResults && (
                  <div className="md:col-span-2 lg:col-span-3 mb-2">
                    <Badge variant="outline" className="mb-2">
                      搜索结果: {searchResults.results.length} 条记忆
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => resetSearch()}>
                      清除搜索
                    </Button>
                  </div>
                )}
                
                {selectedCluster && (
                  <div className="md:col-span-2 lg:col-span-3 mb-2">
                    <Badge variant="outline" className="mb-2">
                      主题: {(clustersData?.topics || []).find(c => c.id === selectedCluster)?.topic}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCluster(null)}>
                      显示所有记忆
                    </Button>
                  </div>
                )}
                
                {filteredMemories.length === 0 ? (
                  <div className="md:col-span-2 lg:col-span-3 flex flex-col justify-center items-center h-64 gap-4">
                    <p className="text-muted-foreground">没有找到记忆数据</p>
                    <p className="text-sm text-muted-foreground max-w-md text-center">
                      您可以通过与系统交互来创建记忆，记忆会自动保存下来并进行分析。当积累5条或更多记忆后，系统将能够进行主题聚类分析。
                    </p>
                    <Button variant="outline" onClick={() => setLocation('/')}>开始新对话</Button>
                  </div>
                ) : (
                  filteredMemories.map((memory) => (
                    <Card 
                      key={memory.id} 
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => handleMemoryClick(memory)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{memory.summary.slice(0, 50)}{memory.summary.length > 50 ? '...' : ''}</CardTitle>
                        <CardDescription>{formatDate(memory.timestamp)}</CardDescription>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {memory.content}
                        </p>
                      </CardContent>
                      <CardFooter>
                        <div className="flex flex-wrap gap-1">
                          {memory.keywords?.slice(0, 3).map((keyword, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                          {memory.keywords?.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{memory.keywords.length - 3}
                            </Badge>
                          )}
                        </div>
                      </CardFooter>
                    </Card>
                  ))
                )}
              </div>
            )}
          </TabsContent>

          {/* 聚类标签页 */}
          <TabsContent value="clusters" className="flex-1 mt-4">
            {isLoadingClusters ? (
              <div className="flex justify-center items-center h-64">
                <Spinner className="h-8 w-8" />
              </div>
            ) : (clustersData?.topics?.length || 0) === 0 ? (
              <div className="flex justify-center items-center h-64 flex-col gap-4">
                <p className="text-muted-foreground">没有足够的记忆数据进行聚类分析</p>
                <p className="text-sm text-muted-foreground max-w-md text-center">
                  需要至少5条记忆数据才能形成有意义的主题聚类。目前已有 {memoriesData?.memories?.length || 0} 条记忆，
                  再创建 {Math.max(0, 5 - (memoriesData?.memories?.length || 0))} 条即可启用此功能。
                </p>
                <div className="flex gap-2">
                  <Button onClick={handleRepairMemories} disabled={isRepairing}>
                    {isRepairing ? <Spinner className="mr-2 h-4 w-4" /> : null}
                    整理记忆数据
                  </Button>
                  <Button variant="outline" onClick={() => setLocation('/')}>开始新对话</Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(clustersData?.topics || []).map((cluster) => (
                  <Card 
                    key={cluster.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => {
                      setSelectedCluster(cluster.id);
                      setSelectedTab('all');
                    }}
                  >
                    <CardHeader>
                      <CardTitle>{cluster.topic}</CardTitle>
                      <CardDescription>
                        {cluster.count} 条记忆 · {cluster.percentage}%
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {cluster.representativeMemory && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {cluster.representativeMemory.summary}
                        </p>
                      )}
                    </CardContent>
                    <CardFooter>
                      <Button variant="ghost" size="sm">
                        查看记忆
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MemorySpace;