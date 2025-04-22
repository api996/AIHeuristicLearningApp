import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import StaticKnowledgeGraph from '@/components/StaticKnowledgeGraph';
import { preloadKnowledgeGraphData, getKnowledgeGraphData, clearKnowledgeGraphCache } from '@/lib/knowledge-graph-preloader';

interface SimpleNode {
  id: string;
  label: string;
  category?: string;
  size?: number;
}

interface SimpleLink {
  source: string;
  target: string;
  type?: string;
}

interface KnowledgeGraph {
  nodes: SimpleNode[];
  links: SimpleLink[];
  version?: number;
}

// 创建一个超简化的知识图谱视图页面，专注于性能和视觉效果
export default function KnowledgeGraphView() {
  const [, setLocation] = useLocation();
  const [userId, setUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<KnowledgeGraph | null>(null);
  
  // 初始化 - 从URL参数获取用户ID
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlUserId = urlParams.get('userId');
      
      if (urlUserId) {
        setUserId(parseInt(urlUserId));
      } else {
        // 尝试从localStorage获取用户信息
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUserId(parsedUser.userId);
        } else {
          throw new Error('未找到用户ID');
        }
      }
    } catch (error) {
      console.error('获取用户ID失败:', error);
      setError('无法获取用户信息');
    }
  }, []);
  
  // 加载知识图谱数据
  useEffect(() => {
    if (!userId) return;
    
    let isMounted = true; // 防止组件卸载后设置状态
    
    async function loadGraphData() {
      try {
        setIsLoading(true);
        setError(null); // 重置错误状态
        
        // 使用内置重试机制的函数获取数据
        let data;
        try {
          // 先尝试获取预加载/缓存数据
          if (userId !== null) {
            data = await getKnowledgeGraphData(userId);
            if (data && Array.isArray(data.nodes)) {
              console.log(`已获取缓存的知识图谱数据: ${data.nodes.length}个节点`);
              if (isMounted) {
                setGraphData(data);
                setIsLoading(false);
              }
              return;
            }
          }
        } catch (e) {
          console.warn('无法获取预加载数据，将直接从API获取:', e);
        }
        
        // 如果没有预加载数据或获取失败，直接从API获取
        console.log('缓存获取失败，直接请求知识图谱数据...');
        
        try {
          // 添加随机参数避免浏览器缓存
          const timestamp = Date.now();
          const rand = Math.floor(Math.random() * 1000000);
          const response = await fetch(`/api/learning-path/${userId}/knowledge-graph?t=${timestamp}&r=${rand}`, {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          });
          
          if (!response.ok) {
            throw new Error(`获取失败: ${response.status}`);
          }
          
          data = await response.json();
          console.log(`成功获取知识图谱数据: ${data.nodes?.length || 0}个节点`);
          
          // 验证数据结构
          if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
            console.error('API返回的数据格式无效:', data);
            throw new Error('API返回的数据格式无效');
          }
          
          if (isMounted) {
            setGraphData(data);
          }
          
          // 更新缓存 (后台进行，不阻塞UI)
          if (userId !== null && isMounted) {
            setTimeout(() => {
              preloadKnowledgeGraphData(userId, true).catch(e => {
                console.warn('缓存更新失败，但不影响当前显示:', e);
              });
            }, 100);
          }
        } catch (apiError) {
          console.error('直接API获取失败:', apiError);
          throw apiError; // 重新抛出以便被外层捕获
        }
      } catch (err: any) {
        console.error('加载知识图谱失败:', err);
        if (isMounted) {
          setError('无法加载知识图谱数据: ' + (err?.message || '未知错误'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    
    loadGraphData();
    
    // 清理函数
    return () => {
      isMounted = false;
    };
  }, [userId]);
  
  // 刷新数据
  const handleRefresh = async () => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      setError(null); // 重置错误状态
      
      // 清除缓存
      clearKnowledgeGraphCache(userId);
      console.log('已清除缓存，正在刷新知识图谱数据...');
      
      // 防止浏览器缓存
      const timestamp = Date.now();
      const rand = Math.floor(Math.random() * 1000000);
      
      // 从API获取新数据
      const response = await fetch(
        `/api/learning-path/${userId}/knowledge-graph?t=${timestamp}&r=${rand}`, 
        {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`获取失败: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // 验证数据结构
      if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
        console.error('API返回的数据格式无效:', data);
        throw new Error('API返回的数据格式无效');
      }
      
      console.log(`刷新成功: ${data.nodes.length}个节点, ${data.links.length}个连接`);
      setGraphData(data);
      
      // 在后台更新缓存，不阻塞UI
      if (userId !== null) {
        setTimeout(() => {
          preloadKnowledgeGraphData(userId, true).catch(e => {
            console.warn('缓存更新失败，但不影响当前显示:', e);
          });
        }, 100);
      }
    } catch (err: any) {
      console.error('刷新知识图谱失败:', err);
      setError('刷新数据失败: ' + (err?.message || '未知错误'));
      
      // 防止失败后用户被困住，添加返回选项
      setTimeout(() => {
        if (!graphData || graphData.nodes.length === 0) {
          console.log('刷新失败且无数据，提供返回选项');
        }
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-gray-950 text-white overflow-hidden">
      {/* 顶部导航 */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-center bg-gradient-to-b from-gray-900/80 to-transparent">
        <div className="flex items-center">
          <Link href="/learning-path">
            <Button variant="outline" size="icon" className="text-white border-gray-700 hover:bg-gray-800">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="ml-2 text-xl font-bold">知识连接图谱</h1>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh} 
          disabled={isLoading}
          className="bg-gray-800/70 text-white border-gray-700 hover:bg-gray-700"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>
      
      {/* 内容区域 */}
      <div className="w-full h-full pt-16">
        {isLoading ? (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-lg text-blue-400">加载知识图谱中...</p>
          </div>
        ) : error ? (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <p className="text-red-500 mb-2">{error}</p>
            <div className="flex space-x-4 mt-4">
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                重试
              </Button>
              <Link href="/learning-path">
                <Button variant="outline" className="border-yellow-600 text-yellow-500 hover:bg-yellow-900/20">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  返回学习轨迹
                </Button>
              </Link>
            </div>
          </div>
        ) : graphData && graphData.nodes.length > 0 ? (
          <div className="w-full h-full">
            <StaticKnowledgeGraph
              nodes={graphData.nodes}
              links={graphData.links}
              width={window.innerWidth}
              height={window.innerHeight - 64}
              onNodeClick={(nodeId) => {
                const node = graphData.nodes.find(n => n.id === nodeId);
                if (node) {
                  console.log(`点击了节点: ${node.label || nodeId}`);
                  
                  // 提供节点类型和标签的弹窗
                  const nodeType = node.category === 'cluster' ? '主题' : 
                                 node.category === 'keyword' ? '关键词' : '记忆';
                  alert(`${nodeType}: ${node.label}`);
                }
              }}
            />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <p className="text-gray-400 mb-2">暂无足够数据生成知识图谱</p>
            <p className="text-sm text-gray-500 mb-6">继续与AI交流以获取更多记忆数据</p>
            <Link href="/learning-path">
              <Button variant="outline" className="mt-2 border-blue-600 text-blue-500 hover:bg-blue-900/20">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回学习轨迹
              </Button>
            </Link>
          </div>
        )}
      </div>
      
      {/* 图例 */}
      <div className="absolute bottom-4 left-4 z-10 bg-gray-900/60 p-3 rounded-lg">
        <p className="text-sm font-medium mb-2">图例</p>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span className="text-xs text-gray-300">主题</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-xs text-gray-300">关键词</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span className="text-xs text-gray-300">记忆</span>
          </div>
        </div>
      </div>
    </div>
  );
}