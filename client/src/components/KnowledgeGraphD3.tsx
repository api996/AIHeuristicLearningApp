import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { RefreshCw } from 'lucide-react';

interface Node {
  id: string;
  label: string;
  color?: string;
  size?: number;
  x?: number;
  y?: number;
  category?: string;
  clusterId?: string;
}

interface Link {
  source: string | Node;
  target: string | Node;
  color?: string;
  strokeWidth?: number;
  value?: number;
  type?: string;
}

interface KnowledgeGraphD3Props {
  nodes: Node[];
  links: Link[];
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
  zoomLevel?: number;
  isFullScreen?: boolean;
}

/**
 * 优化的知识图谱组件 - 使用D3.js
 * 专注于性能与交互体验
 */
const KnowledgeGraphD3: React.FC<KnowledgeGraphD3Props> = ({
  nodes,
  links,
  width = 800,
  height = 600,
  onNodeClick,
  zoomLevel = 1,
  isFullScreen = false
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // 使用useEffect渲染图谱
  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;

    try {
      // 清除之前的SVG内容
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      
      console.log(`开始渲染知识图谱: ${nodes.length}个节点, ${links.length}个连接`);

      // 预处理数据 - 深拷贝避免修改原始数据
      const nodesCopy = JSON.parse(JSON.stringify(nodes));
      const linksCopy = JSON.parse(JSON.stringify(links));
      
      // 为节点添加初始位置 - 使用黄金角分布避免重叠
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.35;
      
      // 将不同类别的节点分开放置
      nodesCopy.forEach((node: any, i: number) => {
        // 基于节点类别和索引计算角度
        let angleOffset = 0;
        if (node.category === 'cluster') angleOffset = 0;
        else if (node.category === 'keyword') angleOffset = 2;
        else angleOffset = 4;
        
        // 使用黄金角分布获得更均匀的分布
        const angle = (i * 0.618033988749895 + angleOffset) * Math.PI * 2;
        
        // 计算节点初始位置
        let distance = radius;
        if (node.category === 'cluster') distance *= 0.5; // 集群靠近中心
        
        node.x = centerX + Math.cos(angle) * distance;
        node.y = centerY + Math.sin(angle) * distance;
        
        // 设置初始速度为0
        node.vx = 0;
        node.vy = 0;
      });

      // 创建节点ID映射
      const nodeMap = new Map<string, any>();
      nodesCopy.forEach((node: any) => nodeMap.set(node.id, node));

      // 格式化连接数据
      const formattedLinks = linksCopy.map((link: any) => ({
        ...link,
        source: typeof link.source === 'string' ? nodeMap.get(link.source) : link.source,
        target: typeof link.target === 'string' ? nodeMap.get(link.target) : link.target,
      }));

      // 设置容器和SVG
      svg.attr('width', width)
         .attr('height', height)
         .attr('overflow', 'visible')
         .style('background', 'transparent');

      // 创建缩放容器
      const container = svg.append('g');

      // 设置力导向模拟
      const simulation = d3.forceSimulation(nodesCopy)
        .alpha(0.5)
        .alphaDecay(0.04)
        .alphaMin(0.001)
        // 链接力
        .force('link', d3.forceLink(formattedLinks)
          .id((d: any) => d.id)
          .distance((d: any) => {
            // 动态链接长度
            const baseDistance = 100;
            const sourceSize = d.source.size || 10;
            const targetSize = d.target.size || 10;
            // 主题节点有更长的连接
            const typeMultiplier = (d.source.category === 'cluster' || d.target.category === 'cluster') ? 1.5 : 1;
            return baseDistance * typeMultiplier * (1 + Math.log10((sourceSize + targetSize) / 20));
          })
          .strength(0.2) // 较弱的连接强度
        )
        // 排斥力
        .force('charge', d3.forceManyBody()
          .strength((d: any) => {
            // 集群节点有更强的斥力
            return d.category === 'cluster' ? -500 : -200;
          })
          .distanceMax(500) // 限制最大距离提高性能
        )
        // 中心引力
        .force('center', d3.forceCenter(width / 2, height / 2))
        // 碰撞检测
        .force('collision', d3.forceCollide()
          .radius((d: any) => {
            // 根据节点类型和大小调整碰撞半径
            const baseRadius = Math.max(5, (d.size || 15) / 8);
            return d.category === 'cluster' ? baseRadius * 2 : baseRadius * 1.2;
          })
          .strength(0.8)
        )
        // 保持节点在画布内
        .force('x', d3.forceX(width / 2).strength(0.05))
        .force('y', d3.forceY(height / 2).strength(0.05))
        // 分类布局力 - 使不同类型节点保持在不同区域
        .force('category', () => {
          for (let i = 0, n = nodesCopy.length; i < n; ++i) {
            const curr = nodesCopy[i];
            if (curr.category === 'cluster') {
              // 集群节点向中心移动
              const dx = centerX - curr.x;
              const dy = centerY - curr.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > 0) {
                curr.vx += dx * 0.01;
                curr.vy += dy * 0.01;
              }
            } else if (curr.category === 'keyword') {
              // 关键词节点在中间区域
              const dist = Math.sqrt(Math.pow(curr.x - centerX, 2) + Math.pow(curr.y - centerY, 2));
              if (dist > radius * 0.5) {
                curr.vx += (centerX - curr.x) * 0.005;
                curr.vy += (centerY - curr.y) * 0.005;
              }
            }
          }
        });

      // 创建缩放行为
      const zoom = d3.zoom()
        .scaleExtent([0.1, 8])
        .on('zoom', (event) => {
          container.attr('transform', event.transform);
        });

      // 应用缩放行为
      svg.call(zoom as any);

      // 初始缩放设置
      if (zoomLevel !== 1) {
        svg.transition().duration(500)
          .call((zoom as any).transform, d3.zoomIdentity.translate(width/2, height/2).scale(zoomLevel).translate(-width/2, -height/2));
      }

      // 绘制连接线 - 双层效果
      // 绘制辅助高亮层
      container.append('g')
        .selectAll('.link-highlight')
        .data(formattedLinks)
        .enter()
        .append('line')
        .attr('class', 'link-highlight')
        .attr('stroke', 'rgba(100, 180, 255, 0.3)')
        .attr('stroke-width', (d: any) => (d.strokeWidth || 2.5) * 3)
        .attr('stroke-linecap', 'round')
        .attr('filter', 'blur(3px)');
        
      // 绘制主连接线
      const link = container.append('g')
        .selectAll('.link-main')
        .data(formattedLinks)
        .enter()
        .append('line')
        .attr('class', 'link-main')
        .attr('stroke', (d: any) => {
          // 根据连接类型设置颜色
          if (d.type === 'contains') return 'rgba(100, 180, 255, 0.8)';
          if (d.type === 'related') return 'rgba(255, 180, 100, 0.8)';
          return d.color || 'rgba(150, 200, 255, 0.8)';
        })
        .attr('stroke-width', (d: any) => d.strokeWidth || 3)
        .attr('stroke-opacity', 0.9)
        .attr('stroke-linecap', 'round');

      // 创建节点组
      const node = container.append('g')
        .selectAll('.node')
        .data(nodesCopy)
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('data-category', (d: any) => d.category || 'default')
        .on('click', function(event: MouseEvent, d: any) {
          if (onNodeClick) {
            event.stopPropagation();
            onNodeClick(d.id);
          }
        })
        .call(d3.drag()
          .on('start', dragStarted)
          .on('drag', dragged)
          .on('end', dragEnded) as any
        );

      // 添加节点圆形
      node.append('circle')
        .attr('r', (d: any) => {
          // 根据节点类型设置不同大小
          if (d.category === 'cluster') return Math.max(8, (d.size || 30) / 5);
          if (d.category === 'keyword') return Math.max(5, (d.size || 20) / 8);
          return Math.max(4, (d.size || 15) / 10);
        })
        .attr('fill', (d: any) => {
          // 根据节点类型设置不同颜色
          if (d.category === 'cluster') return d.color || '#3b82f6';
          if (d.category === 'keyword') return d.color || '#10b981';
          if (d.category === 'memory') return d.color || '#f59e0b';
          return d.color || '#6366f1';
        })
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5);

      // 添加节点标签
      node.append('text')
        .attr('dx', (d: any) => {
          // 根据节点类型调整标签位置
          if (d.category === 'cluster') return Math.max(8, (d.size || 30) / 5) + 5;
          return Math.max(5, (d.size || 15) / 10) + 5;
        })
        .attr('dy', '.35em')
        .attr('font-size', (d: any) => d.category === 'cluster' ? '14px' : '12px')
        .attr('fill', '#ffffff')
        .attr('stroke', 'rgba(0,0,0,0.5)')
        .attr('stroke-width', 0.3)
        .text((d: any) => d.label || d.id);

      // 拖拽事件处理函数
      function dragStarted(event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0.2).restart();
        d.fx = d.x;
        d.fy = d.y;
        
        // 记录拖拽开始时间和位置
        d._dragStartTime = new Date().getTime();
        d._dragDistance = 0;
        d._lastDragX = d.x;
        d._lastDragY = d.y;
      }

      function dragged(event: any, d: any) {
        d.fx = event.x;
        d.fy = event.y;
        
        // 计算拖拽距离
        if (d._lastDragX !== undefined) {
          const dx = event.x - d._lastDragX;
          const dy = event.y - d._lastDragY;
          d._dragDistance = (d._dragDistance || 0) + Math.sqrt(dx*dx + dy*dy);
          d._lastDragX = event.x;
          d._lastDragY = event.y;
        }
      }

      function dragEnded(event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0);
        
        // 短暂点击与拖拽的区分
        const dragDuration = new Date().getTime() - (d._dragStartTime || 0);
        const shortDrag = dragDuration < 300;
        const shortDistance = (d._dragDistance || 0) < 10;
        
        // 根据节点类型和交互方式决定是否保持固定
        if (d.category === 'cluster') {
          // 集群节点暂时保持固定
          setTimeout(() => {
            d.fy = null;  // 只释放垂直约束
          }, 5000);
        } else if (shortDrag && shortDistance) {
          // 短暂点击，临时固定
          setTimeout(() => {
            d.fx = null;
            d.fy = null;
          }, 3000);
        } else {
          // 正常拖拽，立即释放
          d.fx = null;
          d.fy = null;
        }
        
        // 清除临时数据
        delete d._dragStartTime;
        delete d._dragDistance;
        delete d._lastDragX;
        delete d._lastDragY;
      }

      // 更新力导向模拟
      simulation.on('tick', () => {
        // 更新连接线位置
        link
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);
          
        // 更新辅助高亮线
        container.selectAll('.link-highlight')
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);
        
        // 更新节点位置
        node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
      });
      
      // 标记组件已准备就绪
      setIsReady(true);
      
    } catch (err: any) {
      console.error('知识图谱渲染错误:', err);
      setError(err.message || '图谱渲染失败');
    }
  }, [nodes, links, width, height, onNodeClick, zoomLevel, isFullScreen]);

  // 手动刷新图谱
  const refreshGraph = () => {
    if (!svgRef.current) return;
    
    try {
      console.log('手动刷新知识图谱...');
      // 清空SVG并重新触发渲染
      d3.select(svgRef.current).selectAll('*').remove();
      setIsReady(false);
      
      // 短暂延迟后重新渲染
      setTimeout(() => {
        setError(null);
      }, 50);
    } catch (err) {
      console.error('刷新图谱失败:', err);
    }
  };

  // 错误状态展示
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <p className="text-red-500 mb-2">图谱渲染错误</p>
        <p className="text-sm text-gray-400">{error}</p>
        <button 
          className="mt-4 px-3 py-1 bg-blue-500 text-white rounded-md text-sm"
          onClick={refreshGraph}
        >
          重试
        </button>
      </div>
    );
  }

  // 无数据状态
  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <p className="text-neutral-300">暂无知识图谱数据</p>
      </div>
    );
  }

  // 正常渲染状态
  return (
    <div 
      ref={containerRef}
      className={`knowledge-graph-container ${isFullScreen ? 'fullscreened-graph' : ''}`}
      style={{
        width: '100%', 
        height: '100%',
        maxWidth: '100%',
        maxHeight: isFullScreen ? '100vh' : '70vh',
        touchAction: 'manipulation',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        overflow: 'visible',
        position: 'relative'
      }}
    >
      {/* SVG容器 */}
      <svg 
        ref={svgRef} 
        style={{
          width: '100%',
          height: '100%',
          overflow: 'visible',
          touchAction: 'manipulation'
        }}
      />
      
      {/* 控制按钮 */}
      <div className="absolute top-2 right-2 z-10">
        <button 
          className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-white rounded-full"
          onClick={refreshGraph}
          title="刷新图谱"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      
      {/* 加载指示器 - 只在尚未准备好时显示 */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
          <div className="p-4 bg-gray-800/80 rounded-lg flex flex-col items-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-2"></div>
            <p className="text-sm text-white">加载知识图谱...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraphD3;