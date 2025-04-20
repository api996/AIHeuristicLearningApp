import React, { useEffect, useRef, useState } from 'react';

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

interface SimpleD3GraphProps {
  nodes: Node[];
  links: Link[];
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
  zoomLevel?: number;
  isFullScreen?: boolean;
}

/**
 * 简单D3图谱组件
 * 不依赖于TypeScript类型定义
 */
const SimpleD3Graph: React.FC<SimpleD3GraphProps> = ({
  nodes,
  links,
  width = 800,
  height = 500,
  onNodeClick,
  zoomLevel = 1,
  isFullScreen = false
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);

  // 主要渲染函数
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;
    
    // 确保d3可用
    if (typeof window === 'undefined' || !window.d3) {
      console.error('D3不可用，无法渲染图谱');
      setError('D3库未加载，请刷新页面');
      return;
    }
    
    // 使用全局d3对象
    const d3 = window.d3;
    
    try {
      // 清除之前的内容
      d3.select(svgRef.current).selectAll('*').remove();
      
      // 创建节点数据副本
      const nodesCopy = JSON.parse(JSON.stringify(nodes));
      const linksCopy = JSON.parse(JSON.stringify(links));
      
      // 创建节点映射
      const nodeMap = new Map();
      nodesCopy.forEach((node) => nodeMap.set(node.id, node));
      
      // 格式化连接
      const formattedLinks = linksCopy.map((link) => ({
        ...link,
        source: typeof link.source === 'string' ? nodeMap.get(link.source) || link.source : link.source,
        target: typeof link.target === 'string' ? nodeMap.get(link.target) || link.target : link.target
      }));
      
      // 创建SVG容器
      const svg = d3.select(svgRef.current);
      const container = svg.append('g');
      
      // 设置缩放
      const zoom = d3.zoom()
        .scaleExtent([0.1, 5])
        .on('zoom', function(event) {
          container.attr('transform', event.transform);
        });
      
      svg.call(zoom);
      
      // 设置初始缩放
      svg.call(zoom.transform, d3.zoomIdentity.translate(width/2, height/2).scale(zoomLevel));
      
      // 创建力导向图
      const simulation = d3.forceSimulation(nodesCopy)
        .force('link', d3.forceLink(formattedLinks).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(25));
      
      // 绘制连接线
      const link = container.append('g')
        .selectAll('line')
        .data(formattedLinks)
        .enter()
        .append('line')
        .attr('stroke', d => d.color || '#aabbcc')
        .attr('stroke-width', d => d.strokeWidth || 1.5);
      
      // 绘制节点
      const node = container.append('g')
        .selectAll('.node')
        .data(nodesCopy)
        .enter()
        .append('g')
        .attr('class', 'node')
        .call(d3.drag()
          .on('start', function(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', function(event, d) {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', function(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }))
        .on('click', function(event, d) {
          if (onNodeClick) {
            event.stopPropagation();
            onNodeClick(d.id);
          }
        });
      
      // 添加节点圆形
      node.append('circle')
        .attr('r', d => Math.max(5, (d.size || 15) / 10))
        .attr('fill', d => d.color || '#3b82f6')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1);
      
      // 添加标签
      node.append('text')
        .attr('dx', 10)
        .attr('dy', '.35em')
        .text(d => d.label || d.id)
        .attr('fill', '#ffffff')
        .attr('font-size', '12px');
      
      // 更新布局
      simulation.on('tick', function() {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        
        node
          .attr('transform', d => `translate(${d.x},${d.y})`);
      });
      
    } catch (err) {
      console.error('知识图谱渲染错误:', err);
      setError(err.message || '图谱渲染失败');
    }
  }, [nodes, links, width, height, onNodeClick, zoomLevel]);
  
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
  if (!nodes || nodes.length === 0) {
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

export default SimpleD3Graph;