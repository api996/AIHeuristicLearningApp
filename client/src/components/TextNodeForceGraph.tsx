import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
// 不单独导入d3的方法，直接使用d3命名空间，避免运行时错误
import { Sparkles } from 'lucide-react';

// 为D3拖拽事件添加类型定义
interface D3DragEvent {
  active: boolean;
  sourceEvent: MouseEvent;
  subject: any;
  x: number;
  y: number;
}

// 节点类型定义
interface GraphNode {
  id: string;
  label: string;
  size: number;
  category?: string; 
  clusterId?: string;
  color?: string;
  x?: number;
  y?: number;
  // D3力导向图所需的属性
  fx?: number | null;
  fy?: number | null;
}

// 连接类型定义
interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  value: number;
  type?: string;
  color?: string;
}

// 组件属性类型定义
interface TextNodeForceGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  width: number;
  height: number;
  onNodeClick?: (nodeId: string) => void;
}

/**
 * 文本节点力导向图组件
 * 使用D3.js实现，节点使用文本标签显示而不是圆形
 */
const TextNodeForceGraph: React.FC<TextNodeForceGraphProps> = ({
  nodes,
  links,
  width,
  height,
  onNodeClick
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // 在组件挂载后设置状态
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // 主要图表渲染逻辑
  useEffect(() => {
    if (!svgRef.current || !isMounted || !nodes.length) return;

    // 清除之前的图表
    d3.select(svgRef.current).selectAll("*").remove();

    // 创建SVG容器
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto;");

    // 添加缩放和平移功能
    const g = svg.append("g");
    
    // 安全地应用 zoom 行为，处理可能的事件类型兼容性问题
    const handleZoom = (event: any) => {
      // 确保 event 和 event.transform 存在
      if (event && event.transform) {
        g.attr("transform", `translate(${event.transform.x}, ${event.transform.y}) scale(${event.transform.k})`);
      }
    };
    
    try {
      const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
        .extent([[0, 0], [width, height]])
        .scaleExtent([0.25, 5])
        .on("zoom", handleZoom);
        
      svg.call(zoomBehavior);
    } catch (error) {
      console.error("Error applying zoom behavior:", error);
    }

    // 定义节点颜色映射
    const categoryColors: Record<string, string> = {
      'cluster': '#6366f1', // 主题 - 靛蓝色
      'keyword': '#10b981', // 关键词 - 翠绿色 
      'memory': '#f59e0b',  // 记忆 - 琥珀色
      'default': '#9ca3af'  // 默认 - 灰色
    };
    
    // 定义连接线样式映射
    const linkStyles: Record<string, { stroke: string, strokeDasharray: string }> = {
      'hierarchy': { stroke: '#4b5563', strokeDasharray: '0' },        // 层级关系 - 实线
      'proximity': { stroke: '#6366f1', strokeDasharray: '3,3' },      // 相似/邻近 - 短虚线
      'semantic': { stroke: '#10b981', strokeDasharray: '5,5' },       // 语义关联 - 中虚线
      'temporal': { stroke: '#f59e0b', strokeDasharray: '10,5' },      // 时间关系 - 点划线
      'default': { stroke: '#d1d5db', strokeDasharray: '0' }           // 默认 - 实线灰色
    };

    // 深拷贝节点和链接，避免修改原始数据
    const nodesData = JSON.parse(JSON.stringify(nodes)) as GraphNode[];
    const linksData = JSON.parse(JSON.stringify(links)) as GraphLink[];

    // 创建力导向模拟
    const simulation = d3.forceSimulation<GraphNode, GraphLink>(nodesData)
      .force("link", d3.forceLink<GraphNode, GraphLink>(linksData)
        .id(d => d.id)
        .distance(d => 150 - (d.value || 0) * 70)) // 链接距离基于关系强度
      .force("charge", d3.forceManyBody().strength(-100))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(d => Math.sqrt(d.size || 10) * 3 + 15)); // 避免节点重叠

    // 创建箭头标记定义
    svg.append("defs").selectAll("marker")
      .data(["hierarchy", "proximity", "semantic", "temporal", "default"])
      .enter().append("marker")
      .attr("id", d => `arrow-${d}`)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 18)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", d => linkStyles[d].stroke)
      .attr("d", "M0,-5L10,0L0,5");

    // 创建连接线 - 使用不同样式表示不同类型的关系
    const link = g.append("g")
      .attr("stroke-opacity", 0.6)
      .selectAll("path")
      .data(linksData)
      .enter().append("path")
      .attr("stroke", d => {
        const type = d.type || 'default';
        return linkStyles[type]?.stroke || linkStyles.default.stroke;
      })
      .attr("stroke-width", d => Math.max(1, Math.min(3, d.value || 1)))
      .attr("stroke-dasharray", d => {
        const type = d.type || 'default';
        return linkStyles[type]?.strokeDasharray || linkStyles.default.strokeDasharray;
      })
      .attr("marker-end", d => `url(#arrow-${d.type || 'default'})`);

    // 创建节点组 - 包含背景和文本
    const node = g.append("g")
      .selectAll(".node")
      .data(nodesData)
      .enter().append("g")
      .attr("class", "node")
      .attr("cursor", "pointer")
      .on("click", (event, d) => {
        if (onNodeClick) onNodeClick(d.id);
      })
      .call(d3.drag<SVGGElement, GraphNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
      );

    // 为节点添加文本背景矩形
    node.append("rect")
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("fill", d => {
        // 使用节点自带颜色或根据类别选择颜色
        if (d.color) return d.color;
        const category = d.category || 'default';
        return `${categoryColors[category]}30`; // 30是透明度，使背景半透明
      })
      .attr("stroke", d => {
        if (d.color) return d.color;
        const category = d.category || 'default';
        return categoryColors[category];
      })
      .attr("stroke-width", 1.5);

    // 为节点添加文本标签
    const text = node.append("text")
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("fill", d => {
        const category = d.category || 'default';
        return categoryColors[category];
      })
      .style("font-weight", d => d.category === 'cluster' ? 'bold' : 'normal')
      .style("font-size", d => {
        // 根据节点大小或类别动态调整字体大小
        if (d.category === 'cluster') return '14px';
        if (d.category === 'keyword') return '12px';
        return '11px';
      })
      .text(d => d.label || d.id)
      .each(function() {
        // 获取文本实际宽度，为背景矩形设置尺寸
        const bbox = this.getBBox();
        const parent = this.parentNode;
        const rect = parent?.querySelector('rect');
        if (rect) {
          d3.select(rect)
            .attr("x", bbox.x - 8)
            .attr("y", bbox.y - 4)
            .attr("width", bbox.width + 16)
            .attr("height", bbox.height + 8);
        }
      });

    // 添加节点类别图标（如：主题节点带闪光图标）
    node.filter(d => d.category === 'cluster')
      .append("path")
      .attr("d", "M11 1L15 4L18 2L16 7L20 9L15 11L15 15L11 12L7 15L9 11L5 8L10 7L11 1Z") // 星星路径
      .attr("transform", function() {
        const textEl = this.parentNode?.querySelector('text');
        if (textEl) {
          const bbox = textEl.getBBox();
          return `translate(${bbox.x + bbox.width + 10}, ${bbox.y + bbox.height/2 - 7}) scale(0.7)`;
        }
        return "";
      })
      .attr("fill", "#6366f1");
      
    // 模拟更新函数
    simulation.on("tick", () => {
      // 更新连接线路径，添加安全检查
      link.attr("d", d => {
        const source = d.source as GraphNode;
        const target = d.target as GraphNode;
        
        // 确保坐标存在，否则使用默认坐标
        const sx = source.x !== undefined ? source.x : width / 3;
        const sy = source.y !== undefined ? source.y : height / 3;
        const tx = target.x !== undefined ? target.x : width * 2 / 3;
        const ty = target.y !== undefined ? target.y : height * 2 / 3;
        
        // 使用二次曲线绘制连接，增加曲率以提高可读性
        return `M${sx},${sy}Q${(sx + tx) / 2 + 20},${(sy + ty) / 2}${tx},${ty}`;
      });

      // 更新节点位置，添加安全检查
      node.attr("transform", d => {
        const nx = d.x !== undefined ? d.x : width / 2;
        const ny = d.y !== undefined ? d.y : height / 2;
        return `translate(${nx},${ny})`;
      });
    });

    // 拖拽开始函数 - 使用自定义的D3DragEvent接口
    function dragstarted(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      // 添加安全检查
      if (d.x !== undefined && d.y !== undefined) {
        d.fx = d.x;
        d.fy = d.y;
      }
    }

    // 拖拽中函数 - 使用自定义的D3DragEvent接口
    function dragged(event: any, d: GraphNode) {
      // 添加安全检查
      if (event && event.x !== undefined && event.y !== undefined) {
        d.fx = event.x;
        d.fy = event.y;
      }
    }

    // 拖拽结束函数 - 使用自定义的D3DragEvent接口
    function dragended(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0);
      // 松开时释放固定位置
      d.fx = null;
      d.fy = null;
    }

    // 组件卸载时停止模拟
    return () => {
      simulation.stop();
    };
  }, [isMounted, nodes, links, width, height, onNodeClick]);

  return (
    <div className="text-node-force-graph-container" style={{ width, height, overflow: 'hidden' }}>
      <svg ref={svgRef} width={width} height={height} className="text-node-graph"></svg>
    </div>
  );
};

export default TextNodeForceGraph;