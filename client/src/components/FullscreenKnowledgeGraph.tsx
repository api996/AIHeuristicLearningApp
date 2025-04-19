import { useEffect, useRef, useState } from 'react';

// 使用任意类型来避免TypeScript错误，因为我们需要使用d3的一些高级功能
// @ts-ignore
import * as d3Raw from 'd3';
const d3 = d3Raw as any;

interface Node {
  id: string;
  label: string;
  color: string;
  size: number;
  category?: string;
  x?: number;
  y?: number;
}

interface Link {
  source: string;
  target: string;
  color?: string;
  strokeWidth?: number;
}

interface FullscreenKnowledgeGraphProps {
  nodes: Node[];
  links: Link[];
  onNodeClick?: (nodeId: string) => void;
  width?: number;
  height?: number;
  zoomLevel?: number;
}

const FullscreenKnowledgeGraph = ({
  nodes,
  links,
  onNodeClick,
  width = window.innerWidth,
  height = window.innerHeight,
  zoomLevel = 1,
}: FullscreenKnowledgeGraphProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: zoomLevel });
  
  // 适应不同设备屏幕尺寸
  const adjustedWidth = width || window.innerWidth;
  const adjustedHeight = height || window.innerHeight;
  
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;
    
    // 清除之前的图形
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    // 创建主SVG容器
    const container = svg
      .attr("width", adjustedWidth)
      .attr("height", adjustedHeight)
      .append("g")
      .attr("class", "container")
      .attr("transform", `translate(${transform.x}, ${transform.y}) scale(${transform.k})`);
    
    // 创建力导向图布局
    const simulation = d3.forceSimulation()
      .nodes(nodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink().id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(adjustedWidth / 2, adjustedHeight / 2))
      .force("collision", d3.forceCollide().radius((d: any) => (d.size || 10) * 1.2));
    
    // 准备连接线数据，确保source和target是对象引用
    const linkData = links.map(link => {
      const source = nodes.find(node => node.id === link.source) || { id: link.source };
      const target = nodes.find(node => node.id === link.target) || { id: link.target };
      return { ...link, source, target };
    });
    
    // 创建连接线
    const link = container.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(linkData)
      .enter()
      .append("line")
      .attr("stroke", d => d.color || "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => d.strokeWidth || 1);
    
    // 创建节点
    const node = container.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node-group")
      .call(d3.drag<SVGGElement, any>()
        .on("start", dragStarted)
        .on("drag", dragged)
        .on("end", dragEnded))
      .on("click", function(event, d) {
        if (!dragging && onNodeClick) {
          event.stopPropagation();
          onNodeClick(d.id);
        }
      });
    
    // 添加节点圆形
    node.append("circle")
      .attr("r", d => d.size || 5)
      .attr("fill", d => d.color)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);
    
    // 添加文本标签
    node.append("text")
      .attr("dy", d => (d.size || 5) + 7)
      .attr("text-anchor", "middle")
      .text(d => d.label)
      .attr("fill", "#fff")
      .attr("font-size", "10px")
      .attr("font-weight", "500")
      .attr("font-family", "system-ui, sans-serif")
      .attr("pointer-events", "none")
      .attr("text-shadow", "0 1px 2px rgba(0,0,0,0.8)")
      .attr("user-select", "none");
    
    // 力导向图更新
    simulation.nodes(nodes as d3.SimulationNodeDatum[])
      .on("tick", ticked);
    
    (simulation.force("link") as d3.ForceLink<d3.SimulationNodeDatum, d3.SimulationLinkDatum<d3.SimulationNodeDatum>>)
      .links(linkData as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[]);
    
    // 添加缩放行为
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", zoomed);
    
    svg.call(zoom);
    
    // 设置初始缩放级别
    if (zoomLevel !== 1) {
      svg.call(zoom.transform, d3.zoomIdentity.scale(zoomLevel));
    }
    
    // 更新节点和连接线位置
    function ticked() {
      link
        .attr("x1", d => (d.source as any).x)
        .attr("y1", d => (d.source as any).y)
        .attr("x2", d => (d.target as any).x)
        .attr("y2", d => (d.target as any).y);
      
      node.attr("transform", d => `translate(${d.x || 0}, ${d.y || 0})`);
    }
    
    // 处理缩放事件
    function zoomed(event: d3.D3ZoomEvent<SVGSVGElement, unknown>) {
      container.attr("transform", event.transform.toString());
      setTransform({ 
        x: event.transform.x, 
        y: event.transform.y, 
        k: event.transform.k 
      });
    }
    
    // 拖拽开始
    function dragStarted(event: d3.D3DragEvent<SVGGElement, any, any>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
      setDragging(false);
    }
    
    // 拖拽中
    function dragged(event: d3.D3DragEvent<SVGGElement, any, any>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
      setDragging(true);
    }
    
    // 拖拽结束
    function dragEnded(event: d3.D3DragEvent<SVGGElement, any, any>) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
      
      // 给拖拽状态一个短暂的延迟，避免触发点击事件
      setTimeout(() => {
        setDragging(false);
      }, 100);
    }
    
    // 清理函数
    return () => {
      simulation.stop();
    };
  }, [nodes, links, adjustedWidth, adjustedHeight, onNodeClick, transform.x, transform.y, transform.k]);
  
  // 更新缩放级别
  useEffect(() => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4]);
      
      svg.call(zoom.transform, d3.zoomIdentity.translate(transform.x, transform.y).scale(zoomLevel));
      setTransform(prev => ({ ...prev, k: zoomLevel }));
    }
  }, [zoomLevel]);
  
  return (
    <div className="fullscreen-graph-container" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <svg
        ref={svgRef}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'visible',
          touchAction: 'none'
        }}
        className="d3-graph"
      ></svg>
    </div>
  );
};

export default FullscreenKnowledgeGraph;