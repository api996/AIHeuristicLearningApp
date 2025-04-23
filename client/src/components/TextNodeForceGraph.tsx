import React, { useCallback, useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

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
  // 力导向图所需的属性
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
 * 使用React Force Graph实现，节点使用文本标签显示而不是圆形
 */
const TextNodeForceGraph: React.FC<TextNodeForceGraphProps> = ({
  nodes,
  links,
  width,
  height,
  onNodeClick
}) => {
  const graphRef = useRef<any>();
  const [isMounted, setIsMounted] = useState(false);
  const [graphData, setGraphData] = useState<{ nodes: any[], links: any[] }>({ nodes: [], links: [] });
  
  // 在组件挂载后设置状态
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // 转换输入数据为图形库所需格式
  useEffect(() => {
    if (!nodes || !links || !isMounted) return;
    
    // 处理节点数据
    const processedNodes = nodes.map(node => {
      // 根据节点类型设置颜色
      let nodeColor: string;
      let nodeSize: number = node.size || 10;
      
      switch (node.category) {
        case 'cluster':
          nodeColor = '#6366f1'; // 主题聚类 - 靛蓝色
          nodeSize = Math.max(nodeSize, 15);
          break;
        case 'keyword':
          nodeColor = '#10b981'; // 关键词 - 翠绿色
          nodeSize = Math.max(nodeSize, 10);
          break;
        case 'memory':
          nodeColor = '#f59e0b'; // 记忆 - 琥珀色
          nodeSize = Math.max(nodeSize, 8);
          break;
        default:
          nodeColor = '#9ca3af'; // 默认 - 灰色
          nodeSize = Math.max(nodeSize, 8);
      }
      
      return {
        ...node,
        // 使用传入的颜色或基于类别的默认颜色
        color: node.color || nodeColor,
        // 节点显示大小
        val: nodeSize
      };
    });
    
    // 处理连接数据
    const processedLinks = links.map(link => {
      let linkColor: string;
      let linkWidth: number = 1;
      let linkDashArray: string = "";
      
      // 根据连接类型设置样式
      switch (link.type) {
        case 'hierarchy':
          linkColor = '#4b5563';  // 层级关系 - 灰色
          linkWidth = 2;
          linkDashArray = "";     // 实线
          break;
        case 'proximity':
          linkColor = '#6366f1';  // 相似/邻近 - 靛蓝色
          linkWidth = 1.5;
          linkDashArray = "3, 3"; // 短虚线
          break;
        case 'semantic':
          linkColor = '#10b981';  // 语义关联 - 翠绿色
          linkWidth = 1.5;
          linkDashArray = "5, 5"; // 中虚线
          break;
        case 'temporal':
          linkColor = '#f59e0b';  // 时间关系 - 琥珀色
          linkWidth = 1;
          linkDashArray = "10, 5"; // 点划线
          break;
        default:
          linkColor = '#d1d5db';  // 默认 - 浅灰色
          linkWidth = 1;
          linkDashArray = "";     // 实线
      }
      
      // 使用value属性调整线宽
      if (link.value) {
        linkWidth = Math.max(1, Math.min(3, link.value));
      }
      
      return {
        ...link,
        // 使用传入的颜色或基于类型的默认颜色
        color: link.color || linkColor,
        // 设置线宽
        width: linkWidth,
        // 设置虚线样式
        dashArray: linkDashArray
      };
    });
    
    setGraphData({
      nodes: processedNodes,
      links: processedLinks
    });
  }, [nodes, links, isMounted]);
  
  // 处理节点点击
  const handleNodeClick = useCallback((node: GraphNode) => {
    if (onNodeClick) {
      onNodeClick(node.id);
    }
  }, [onNodeClick]);
  
  // 自定义节点渲染函数 - 使用文本标签而不是圆点
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const { x, y, label, val: size, color, category } = node;
    
    // 设置字体大小基于节点类型
    let fontSize;
    let fontWeight;
    
    if (category === 'cluster') {
      fontSize = 14;
      fontWeight = 'bold';
    } else if (category === 'keyword') {
      fontSize = 12;
      fontWeight = 'normal';
    } else {
      fontSize = 11;
      fontWeight = 'normal';
    }
    
    // 计算适合当前缩放级别的字体大小
    const scaledFontSize = Math.max(fontSize, fontSize / globalScale);
    ctx.font = `${fontWeight} ${scaledFontSize}px Arial, sans-serif`;
    
    // 设置文本和测量文本尺寸
    const text = label || node.id;
    const textWidth = ctx.measureText(text).width;
    const bckgDimensions = [textWidth + 10, scaledFontSize + 8].map(n => n / globalScale);
    
    // 绘制文本背景矩形
    ctx.fillStyle = `${color}30`; // 30是透明度，使背景半透明
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 / globalScale;
    
    // 绘制圆角矩形
    const rectX = x - bckgDimensions[0] / 2;
    const rectY = y - bckgDimensions[1] / 2;
    const rectWidth = bckgDimensions[0];
    const rectHeight = bckgDimensions[1];
    const cornerRadius = 4 / globalScale;
    
    ctx.beginPath();
    ctx.moveTo(rectX + cornerRadius, rectY);
    ctx.lineTo(rectX + rectWidth - cornerRadius, rectY);
    ctx.arcTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + cornerRadius, cornerRadius);
    ctx.lineTo(rectX + rectWidth, rectY + rectHeight - cornerRadius);
    ctx.arcTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - cornerRadius, rectY + rectHeight, cornerRadius);
    ctx.lineTo(rectX + cornerRadius, rectY + rectHeight);
    ctx.arcTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - cornerRadius, cornerRadius);
    ctx.lineTo(rectX, rectY + cornerRadius);
    ctx.arcTo(rectX, rectY, rectX + cornerRadius, rectY, cornerRadius);
    ctx.closePath();
    
    ctx.fill();
    ctx.stroke();
    
    // 绘制文本
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    
    // 为主题节点添加图标
    if (category === 'cluster') {
      // 绘制星形图标
      const iconSize = 7 / globalScale;
      const iconX = x + (textWidth / 2) / globalScale + 10 / globalScale;
      const iconY = y;
      
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5 - Math.PI / 2;
        const x1 = iconX + Math.cos(angle) * iconSize;
        const y1 = iconY + Math.sin(angle) * iconSize;
        if (i === 0) {
          ctx.moveTo(x1, y1);
        } else {
          ctx.lineTo(x1, y1);
        }
      }
      ctx.closePath();
      ctx.fill();
    }
  }, []);
  
  // 自定义链接渲染函数
  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const { source, target, color, width, dashArray } = link;
    
    if (!source || !target || !source.x || !target.x) return;
    
    const start = { x: source.x, y: source.y };
    const end = { x: target.x, y: target.y };
    
    // 计算线宽
    const lineWidth = width / globalScale;
    
    // 绘制连接线
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    
    // 设置虚线样式
    if (dashArray) {
      const dashPattern = dashArray.split(',').map(s => parseFloat(s) / globalScale);
      if (ctx.setLineDash) {
        ctx.setLineDash(dashPattern);
      }
    } else {
      if (ctx.setLineDash) {
        ctx.setLineDash([]);
      }
    }
    
    // 使用二次曲线绘制连接，增加曲率以提高可读性
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const ctrlX = midX + 20 / globalScale;
    const ctrlY = midY;
    
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(ctrlX, ctrlY, end.x, end.y);
    ctx.stroke();
    
    // 绘制箭头
    const headLength = 10 / globalScale;
    const headWidth = 5 / globalScale;
    
    // 计算箭头方向
    const dx = end.x - ctrlX;
    const dy = end.y - ctrlY;
    const angle = Math.atan2(dy, dx);
    
    // 计算箭头位置（在目标点附近但不重叠）
    const arrowX = end.x - headLength * Math.cos(angle);
    const arrowY = end.y - headLength * Math.sin(angle);
    
    // 绘制箭头
    ctx.beginPath();
    ctx.moveTo(arrowX - headLength * Math.cos(angle - Math.PI / 6), arrowY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(end.x, end.y);
    ctx.lineTo(arrowX - headLength * Math.cos(angle + Math.PI / 6), arrowY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.fillStyle = color;
    ctx.fill();
    
    // 恢复默认的线型
    if (ctx.setLineDash) {
      ctx.setLineDash([]);
    }
  }, []);
  
  // 当组件挂载后，调整图表
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      // 启动力布局的初始参数
      graphRef.current.d3Force('charge').strength((node: any) => {
        return node.category === 'cluster' ? -300 : -200;
      });
      
      graphRef.current.d3Force('link').distance((link: any) => {
        // 根据连接类型调整距离
        if (link.type === 'hierarchy') return 150;
        if (link.type === 'proximity') return 180;
        if (link.type === 'semantic') return 200;
        return 150;
      });
      
      // 添加碰撞避免力，防止节点重叠
      graphRef.current.d3Force('collide', (node: any) => {
        return node.category === 'cluster' ? 80 : 60;
      });
      
      // 避免使用所有屏幕空间，集中布局
      graphRef.current.d3Force('center').strength(0.05);
      
      // 初始缩放到合适比例
      graphRef.current.zoom(1.2, 600);
    }
  }, [graphData]);
  
  return (
    <div className="text-node-force-graph-container" style={{ width, height, overflow: 'hidden' }}>
      {graphData.nodes.length > 0 && (
        <ForceGraph2D
          ref={graphRef}
          width={width}
          height={height}
          graphData={graphData}
          nodeLabel="label"
          nodeVal="val"
          nodeColor="color"
          nodeCanvasObject={nodeCanvasObject}
          nodeCanvasObjectMode={() => 'replace'}
          linkCanvasObjectMode={() => 'replace'}
          linkCanvasObject={linkCanvasObject}
          linkColor="color"
          linkWidth="width"
          backgroundColor="transparent"
          onNodeClick={handleNodeClick}
          cooldownTicks={100}
          cooldownTime={10000}
          warmupTicks={50}
        />
      )}
    </div>
  );
};

export default TextNodeForceGraph;