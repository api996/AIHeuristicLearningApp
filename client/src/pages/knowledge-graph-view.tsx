import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import KnowledgeGraphComponent from '@/components/KnowledgeGraphView';
import { preloadGraphData, clearGraphCache } from '@/lib/unified-graph-preloader';

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
export default function KnowledgeGraphPage() {
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
  
  // 加载知识图谱数据 - 优化版，仅加载缓存数据，不触发后端处理
  useEffect(() => {
    if (!userId) return;
    
    let isMounted = true; // 防止组件卸载后设置状态
    
    async function loadGraphData() {
      try {
        setIsLoading(true);
        setError(null); // 重置错误状态
        
        // 从缓存加载数据，明确指定forceRefresh为false，不触发服务端重新计算
        // 这将优先使用本地存储的缓存，然后是内存缓存，仅在两者都不存在时才请求API
        console.log("从本地缓存加载知识图谱数据，不触发后端服务");
        const data = await preloadGraphData(userId as number, 'knowledge', false);
        
        if (isMounted && data && Array.isArray(data.nodes)) {
          console.log(`成功加载知识图谱数据: ${data.nodes.length}个节点, ${data.links.length}个连接, 从缓存=${data.fromCache ? '是' : '否'}`);
          setGraphData(data);
        } else if (isMounted) {
          console.warn('知识图谱数据可能存在问题:', data);
          setError('获取到的知识图谱数据格式无效');
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
    
    // 执行加载
    loadGraphData();
    
    // 清理函数
    return () => {
      isMounted = false;
    };
  }, [userId]);
  
  // 刷新数据 - 简化版
  const handleRefresh = async () => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      setError(null); // 重置错误状态
      
      // 清除缓存 - 清除两种类型的缓存以验证统一
      clearGraphCache(userId as number, 'knowledge');
      clearGraphCache(userId as number, 'topic');
      console.log('【测试】已清除两种类型的缓存，开始测试强制刷新主题图谱请求重定向...');
      
      // 使用Topic类型测试重定向
      console.log("【测试】有意使用'topic'类型请求强制刷新，验证统一路由重定向");
      const data = await preloadGraphData(userId as number, 'topic', true);
      
      // 验证数据结构
      if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
        console.error('获取到的数据格式无效:', data);
        throw new Error('知识图谱数据格式无效');
      }
      
      console.log(`【测试结果】成功通过统一路由器获取强制刷新知识图谱数据: ${data.nodes.length}个节点, ${data.links.length}个连接`);
      setGraphData(data);
    } catch (err: any) {
      console.error('刷新图谱失败:', err);
      setError('刷新数据失败: ' + (err?.message || '未知错误'));
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
        ) : userId ? (
          <div className="w-full h-full">
            {/* 使用新的知识图谱组件 */}
            <KnowledgeGraphComponent userId={userId} />
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