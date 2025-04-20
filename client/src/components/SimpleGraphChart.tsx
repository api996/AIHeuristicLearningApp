import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

// 确保window.d3存在
declare global {
  interface Window {
    d3: any;
    _d3Selection: any;
    d3Selection: any;
    loadD3AndApplyPatch?: () => void;
  }
}

interface Node {
  id: string;
  label: string;
  color: string;
  size: number;
  x?: number;
  y?: number;
  category?: string;
}

interface Link {
  source: string | Node;
  target: string | Node;
  color?: string;
  strokeWidth?: number;
}

interface SimpleGraphChartProps {
  nodes: Node[];
  links: Link[];
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
  zoomLevel?: number;
  isFullScreen?: boolean;
  enableZoom?: boolean;
  enableDrag?: boolean;
}

/**
 * 简化版的知识图谱组件
 * 直接使用D3.js渲染
 */
const SimpleGraphChart: React.FC<SimpleGraphChartProps> = ({
  nodes,
  links,
  width = 800,
  height = 500,
  onNodeClick,
  zoomLevel = 1,
  isFullScreen = false,
  enableZoom = true,
  enableDrag = true,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);

  // 用于处理节点拖拽的辅助函数
  const handleDragStarted = (simulation: any) => {
    return function(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    };
  };

  const handleDragged = () => {
    return function(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    };
  };

  const handleDragEnded = (simulation: any) => {
    return function(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    };
  };

  // 主要渲染函数
  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;

    try {
      // 清除之前的SVG内容
      d3.select(svgRef.current).selectAll("*").remove();
      console.log(`开始渲染知识图谱: ${nodes.length}个节点, ${links.length}个连接`);

      // 预处理数据
      const nodesCopy = JSON.parse(JSON.stringify(nodes));
      const linksCopy = JSON.parse(JSON.stringify(links));
      
      // 创建节点映射
      const nodeMap = new Map();
      nodesCopy.forEach((node: any) => nodeMap.set(node.id, node));
      
      // 格式化连接
      const formattedLinks = linksCopy.map((link: any) => ({
        ...link,
        source: typeof link.source === 'string' ? nodeMap.get(link.source) || link.source : link.source,
        target: typeof link.target === 'string' ? nodeMap.get(link.target) || link.target : link.target,
      }));

      // 创建SVG容器
      const svg = d3.select(svgRef.current);
      const container = svg.append('g');

      // 创建力导向图布局
      const simulation = d3.forceSimulation(nodesCopy)
        .force('link', d3.forceLink(formattedLinks).id((d: any) => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius((d: any) => Math.max(10, (d.size || 15) / 5) + 5));

      // 如果启用缩放
      if (enableZoom) {
        const zoom = d3.zoom()
          .scaleExtent([0.1, 5])
          .on('zoom', (event: any) => {
            if (event && event.transform) {
              container.attr('transform', 
                `translate(${event.transform.x}, ${event.transform.y}) scale(${event.transform.k})`
              );
            }
          });
        
        svg.call(zoom as any);
        
        // 设置初始缩放
        svg.transition().duration(500)
          .call((zoom as any).transform, 
            d3.zoomIdentity.translate(width/2, height/2).scale(zoomLevel || 0.9)
          );
      }

      // 绘制连接线
      const link = container.append('g')
        .selectAll('.link')
        .data(formattedLinks)
        .enter()
        .append('line')
        .attr('class', 'link')
        .attr('stroke', (d: any) => d.color || '#aabbcc')
        .attr('stroke-width', (d: any) => d.strokeWidth || 1.5);

      // 创建节点组
      const node = container.append('g')
        .selectAll('.node')
        .data(nodesCopy)
        .enter()
        .append('g')
        .attr('class', 'node')
        .on('click', function(event: MouseEvent, d: any) {
          if (onNodeClick) {
            event.stopPropagation();
            onNodeClick(d.id);
          }
        });

      // 启用节点拖拽
      if (enableDrag) {
        node.call(d3.drag()
          .on('start', handleDragStarted(simulation))
          .on('drag', handleDragged())
          .on('end', handleDragEnded(simulation)) as any
        );
      }

      // 添加节点圆形
      node.append('circle')
        .attr('r', (d: any) => Math.max(5, (d.size || 15) / 10))
        .attr('fill', (d: any) => d.color || '#3b82f6')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5);

      // 添加节点标签
      node.append('text')
        .attr('dx', (d: any) => Math.max(5, (d.size || 15) / 10) + 5)
        .attr('dy', '.35em')
        .attr('font-size', '12px')
        .attr('fill', '#ffffff')
        .attr('stroke', 'rgba(0,0,0,0.5)')
        .attr('stroke-width', 0.3)
        .text((d: any) => d.label || d.id);

      // 更新力导向模拟
      simulation.on('tick', () => {
        // 更新连接线位置
        link
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);

        // 更新节点位置
        node
          .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
      });
    } catch (err: any) {
      console.error('知识图谱渲染错误:', err);
      setError(err.message || '图谱渲染失败');
    }
  }, [nodes, links, width, height, onNodeClick, zoomLevel, enableZoom, enableDrag]);

  // 为移动设备添加触摸事件处理
  useEffect(() => {
    if (!svgRef.current) return;
    
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        return false;
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        return false;
      }
    };
    
    const svgElement = svgRef.current;
    svgElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    svgElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    
    return () => {
      svgElement.removeEventListener('touchstart', handleTouchStart);
      svgElement.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // 错误显示
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <p className="text-red-500 mb-2">图谱渲染错误</p>
        <p className="text-sm text-gray-400">{error}</p>
      </div>
    );
  }

  // 无数据显示
  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    console.log("SimpleGraphChart: 无有效节点数据");
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <p className="text-lg text-neutral-400">暂无足够数据生成知识图谱</p>
        <p className="text-sm text-neutral-500 max-w-md mx-auto mt-2 text-center">
          随着您的学习过程，系统将收集更多数据，并构建您的知识图谱
        </p>
      </div>
    );
  }
  
  // 计算适合的尺寸
  const adjustedHeight = isFullScreen ? height : Math.min(height, window.innerHeight * 0.7);
  const adjustedWidth = isFullScreen ? width : Math.min(width, window.innerWidth - 20);

  // 组件渲染
  return (
    <div 
      className={`knowledge-graph-container ${isFullScreen ? 'fullscreened-graph' : ''}`}
      style={{
        width: adjustedWidth, 
        height: adjustedHeight,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '8px',
        background: 'rgba(15, 23, 42, 0.8)',
      }}
    >
      <svg 
        ref={svgRef} 
        width={adjustedWidth} 
        height={adjustedHeight}
        viewBox={`0 0 ${width} ${height}`}
        style={{ 
          width: '100%', 
          height: '100%', 
          userSelect: 'none',
          touchAction: 'none',
        }}
      ></svg>
    </div>
  );
};

export default SimpleGraphChart;