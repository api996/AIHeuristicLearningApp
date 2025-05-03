import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';
import { useLocation } from 'wouter';
import MemoryFixButton from '@/components/ui/MemoryFixButton';
import { Loader2, RefreshCw } from 'lucide-react';

interface KnowledgeGraphData {
  nodes: any[];
  links: any[];
  topics: any[];
  suggestions: string[];
}

const MemoryGraph: React.FC = () => {
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // 从会话存储或其他来源获取用户ID
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUserId(userData.id);
      } catch (e) {
        console.error('解析用户数据错误:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (userId) {
      loadKnowledgeGraph(userId);
    }
  }, [userId]);

  const loadKnowledgeGraph = async (uid: number) => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/learning-path?userId=${uid}`);
      setGraphData(response.data);
    } catch (error) {
      console.error('加载知识图谱错误:', error);
      toast({
        title: '加载错误',
        description: '无法加载知识图谱数据',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (userId) {
      loadKnowledgeGraph(userId);
    }
  };

  // 测试是否有足够的节点来渲染
  const hasGraphData = graphData && graphData.nodes && graphData.nodes.length > 0;

  return (
    <div className="container mx-auto py-6">
      <Card className="w-full shadow-lg">
        <CardHeader className="bg-primary/10">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">记忆知识图谱</CardTitle>
              <CardDescription>
                基于您的对话历史生成的知识主题分布
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {userId && (
                <MemoryFixButton 
                  userId={userId} 
                  onComplete={handleRefresh}
                />
              )}
              <Button 
                onClick={handleRefresh}
                disabled={loading}
                variant="outline"
                className="flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                刷新
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex justify-center items-center h-[60vh]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-lg">加载知识图谱...</span>
            </div>
          ) : hasGraphData ? (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>知识主题分布</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {graphData?.topics.map((topic, index) => (
                          <div key={index} className="flex flex-col">
                            <div className="flex justify-between text-sm mb-1">
                              <span>{topic.topic}</span>
                              <span>{Math.round(topic.percentage * 100)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                              <div
                                className="bg-primary h-2.5 rounded-full"
                                style={{ width: `${topic.percentage * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <div>
                  <Card>
                    <CardHeader>
                      <CardTitle>学习建议</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc pl-5 space-y-2">
                        {graphData?.suggestions.map((suggestion, index) => (
                          <li key={index} className="text-sm">{suggestion}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>知识连接</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <div className="text-center p-6">
                    {graphData?.nodes.length} 个知识节点, {graphData?.links.length} 个连接
                    <div className="mt-4 text-sm text-muted-foreground">
                      请在桌面端查看完整知识图谱可视化
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center p-10">
              <h3 className="text-xl font-semibold mb-4">暂无足够数据生成知识图谱</h3>
              <p className="text-muted-foreground mb-6">
                当您有了足够的对话数据后，系统将自动生成知识图谱。或者您可以尝试修复现有记忆数据。
              </p>
              
              {userId && (
                <div className="flex justify-center">
                  <MemoryFixButton 
                    userId={userId} 
                    onComplete={handleRefresh}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MemoryGraph;