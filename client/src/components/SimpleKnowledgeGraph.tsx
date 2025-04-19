import React, { useRef, useEffect, useState } from 'react';
// @ts-ignore - 忽略d3模块的类型检查
import * as d3 from 'd3';

// 声明简化的d3类型，以便在代码中使用
declare global {
  interface Window {
    d3: any;
    _d3Selection: any;
    d3Selection: any;
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

interface SimpleKnowledgeGraphProps {
  nodes: Node[];
  links: Link[];
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
}

/**
 * 简单的知识图谱组件
 * 直接使用D3.js渲染，不依赖复杂的图谱库
 */
const SimpleKnowledgeGraph: React.FC<SimpleKnowledgeGraphProps> = ({
  nodes,
  links,
  width = 800,
  height = 600,
  onNodeClick
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 将d3添加到全局对象，以便d3-direct-patch.js可以访问它
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.d3 = d3;
      console.log("已将d3导出到全局window对象");
    }
  }, []);

  // 拖拽事件处理函数（声明在外部以避免提前引用）
  const handleDragStarted = (simulation: any) => (event: any, d: any) => {
    try {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      // 确保d.x和d.y存在
      d.fx = typeof d.x !== 'undefined' ? d.x : width / 2;
      d.fy = typeof d.y !== 'undefined' ? d.y : height / 2;
    } catch (err) {
      console.warn("拖拽开始事件处理错误:", err);
    }
  };

  const handleDragged = () => (event: any, d: any) => {
    try {
      // 确保event.x和event.y存在
      d.fx = typeof event.x !== 'undefined' ? event.x : d.fx;
      d.fy = typeof event.y !== 'undefined' ? event.y : d.fy;
    } catch (err) {
      console.warn("拖拽中事件处理错误:", err);
    }
  };

  const handleDragEnded = (simulation: any) => (event: any, d: any) => {
    try {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    } catch (err) {
      console.warn("拖拽结束事件处理错误:", err);
    }
  };

  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;

    try {
      // 清除之前的SVG内容
      d3.select(svgRef.current).selectAll("*").remove();

      // 创建一个包含ID映射的节点数组，以便正确关联链接
      const nodeMap = new Map<string, Node>();
      nodes.forEach(node => nodeMap.set(node.id, { ...node }));

      // 格式化链接数据，确保source和target指向节点对象
      const formattedLinks = links.map(link => ({
        ...link,
        source: typeof link.source === 'string' ? nodeMap.get(link.source) || link.source : link.source,
        target: typeof link.target === 'string' ? nodeMap.get(link.target) || link.target : link.target,
      }));

      // 创建SVG元素
      const svg = d3.select(svgRef.current)
        .attr('width', width)
        .attr('height', height)
        .style('background', 'transparent');

      // 创建一个容器以支持缩放和平移
      const container = svg.append('g');

      // 添加缩放行为
      const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event: any) => {
          try {
            // 确保event和transform存在
            if (event && event.transform) {
              container.attr('transform', event.transform);
            } else {
              // 使用默认变换
              const defaultTransform = { k: 1, x: 0, y: 0 };
              container.attr('transform', `translate(${defaultTransform.x},${defaultTransform.y}) scale(${defaultTransform.k})`);
            }
          } catch (err) {
            console.warn("缩放事件处理错误:", err);
          }
        });

      try {
        svg.call(zoom as any);
      } catch (err) {
        console.warn("应用缩放行为时出错:", err);
      }

      // 创建力导向模拟
      const simulation = d3.forceSimulation(nodes as any)
        .force('link', d3.forceLink(formattedLinks).id((d: any) => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-150))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius((d: any) => (d.size || 15) / 2 + 5));

      // 绘制链接
      const link = container.append('g')
        .selectAll('line')
        .data(formattedLinks)
        .enter()
        .append('line')
        .attr('stroke', (d: any) => d.color || 'rgba(59, 130, 246, 0.5)')
        .attr('stroke-width', (d: any) => d.strokeWidth || 1.5);

      // 创建节点组
      const node = container.append('g')
        .selectAll('.node')
        .data(nodes)
        .enter()
        .append('g')
        .attr('class', 'node')
        .on('click', function(event: any, d: any) {
          if (onNodeClick) {
            event.stopPropagation();
            onNodeClick(d.id);
          }
        })
        .call(d3.drag()
          .on('start', handleDragStarted(simulation))
          .on('drag', handleDragged())
          .on('end', handleDragEnded(simulation)) as any
        );

      // 添加节点圆形
      node.append('circle')
        .attr('r', (d: any) => (d.size || 15) / 15)
        .attr('fill', (d: any) => d.color || '#3b82f6')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5);

      // 添加节点标签
      node.append('text')
        .attr('dx', (d: any) => (d.size || 15) / 15 + 5)
        .attr('dy', '.35em')
        .attr('font-size', '10px')
        .attr('fill', '#ffffff')
        .text((d: any) => d.label || d.id);

      // 更新力导向模拟
      simulation.on('tick', () => {
        link
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);

        node
          .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
      });
    } catch (err: any) {
      console.error('知识图谱渲染错误:', err);
      setError(err.message || '图谱渲染失败');
    }
  }, [nodes, links, width, height, onNodeClick]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <p className="text-red-500 mb-2">图谱渲染错误</p>
        <p className="text-sm text-gray-400">{error}</p>
      </div>
    );
  }

  if (!nodes.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <p className="text-lg text-neutral-400">暂无足够数据生成知识图谱</p>
        <p className="text-sm text-neutral-500 max-w-md mx-auto mt-2 text-center">
          随着您的学习过程，系统将收集更多数据，并构建您的知识图谱
        </p>
      </div>
    );
  }

  return (
    <div className="knowledge-graph-container" style={{ width, height }}>
      <svg ref={svgRef} />
    </div>
  );
};

export default SimpleKnowledgeGraph;