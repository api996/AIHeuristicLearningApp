import React, { useCallback, useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

// 图谱节点类型
interface GraphNode {
  id: string;
  label: string;
  category?: string;
  size?: number;
  color?: string; // 可选，为节点指定特定颜色
  x?: number;     // 节点位置 x 坐标
  y?: number;     // 节点位置 y 坐标
}

// 图谱连接类型
interface GraphLink {
  source: string;
  target: string;
  type?: string;
  value?: number;
  color?: string; // 可选，为连接指定特定颜色
  bidirectional?: boolean; // 是否为双向关系
  reason?: string; // 关系说明
  strength?: number; // 关系强度
  learningOrder?: string; // 学习顺序建议
}

// 图谱组件属性
interface ForceGraphKnowledgeGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
  onBackgroundClick?: () => void;
  highlightedNodeId?: string;
}

/**
 * 专业的力导向图知识图谱组件
 * 使用 react-force-graph-2d 实现，提供更专业的图形可视化
 */
const ForceGraphKnowledgeGraph: React.FC<ForceGraphKnowledgeGraphProps> = ({
  nodes,
  links,
  width = 800,
  height = 600,
  onNodeClick,
  onBackgroundClick,
  highlightedNodeId
}) => {
  const graphRef = useRef<any>();
  const [graphData, setGraphData] = useState<{ nodes: any[], links: any[] }>({ nodes: [], links: [] });
  // 内联设备检测
  const [isMobile, setIsMobile] = useState<boolean>(false);
  
  // 辅助函数：绘制箭头
  const drawArrow = useCallback((
    ctx: CanvasRenderingContext2D, 
    fromX: number, 
    fromY: number, 
    toX: number, 
    toY: number, 
    color: string, 
    width: number, 
    globalScale: number
  ) => {
    // 计算箭头方向
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);
    
    // 箭头大小，随缩放和线宽调整
    const arrowSize = (7 + width) / globalScale;
    
    // 绘制箭头
    ctx.save();
    ctx.beginPath();
    ctx.translate(toX, toY);
    ctx.rotate(angle);
    ctx.moveTo(0, 0);
    ctx.lineTo(-arrowSize, -arrowSize / 2);
    ctx.lineTo(-arrowSize, arrowSize / 2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }, []);
  
  // 设备检测逻辑
  useEffect(() => {
    const checkIfMobile = () => {
      const userAgent = navigator.userAgent;
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const isMobileDevice = mobileRegex.test(userAgent);
      const isTablet = /(iPad|Android(?!.*Mobile))/i.test(userAgent);
      
      // 如果是平板，不视为移动设备
      setIsMobile(isMobileDevice && !isTablet);
      
      if (isMobileDevice) {
        console.log("检测到移动设备，应用性能优化");
      }
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  // 转换输入数据为图形库所需格式
  useEffect(() => {
    if (!nodes || !links) return;
    
    // 处理节点数据
    const processedNodes = nodes.map(node => {
      // 根据节点类型设置颜色和尺寸
      let nodeColor: string;
      let nodeSize: number = 6;
      
      switch (node.category) {
        case 'cluster':
          nodeColor = 'rgba(59, 130, 246, 0.8)'; // 主题聚类 - 蓝色
          nodeSize = 12;
          break;
        case 'keyword':
          nodeColor = 'rgba(16, 185, 129, 0.8)'; // 关键词 - 绿色
          nodeSize = 8;
          break;
        case 'memory':
          nodeColor = 'rgba(245, 158, 11, 0.8)'; // 记忆 - 橙色
          nodeSize = 5;
          break;
        default:
          nodeColor = 'rgba(139, 92, 246, 0.8)'; // 默认 - 紫色
          nodeSize = 7;
      }
      
      // 如果有指定尺寸，根据类型适当调整
      if (node.size) {
        if (node.category === 'cluster') {
          nodeSize = Math.min(Math.log2(node.size + 1) * 2 + 10, 25);
        } else {
          nodeSize = Math.min(node.size * 0.5 + 5, 15);
        }
      }
      
      // 如果该节点被高亮，增加尺寸
      if (node.id === highlightedNodeId) {
        nodeSize *= 1.5;
      }
      
      return {
        ...node,
        // 使用传入的颜色或基于类别的默认颜色
        color: node.color || nodeColor,
        // 使用指定尺寸或基于类别的默认尺寸
        val: nodeSize
      };
    });
    
    // 处理连接数据
    const processedLinks = links.map(link => {
      let linkColor: string;
      let linkWidth: number = 1;
      
      // 使用与后端一致的关系类型和颜色
      switch (link.type) {
        case 'prerequisite':
          linkColor = 'rgba(220, 38, 38, 0.7)'; // 前置知识 - 深红色
          linkWidth = 2;
          break;
        case 'contains':
          linkColor = 'rgba(59, 102, 241, 0.7)'; // 包含关系 - 靛蓝色
          linkWidth = 2;
          break;
        case 'applies':
          linkColor = 'rgba(14, 165, 233, 0.7)'; // 应用关系 - 天蓝色
          linkWidth = 1.5;
          break;
        case 'similar':
          linkColor = 'rgba(16, 185, 129, 0.7)'; // 相似概念 - 绿色
          linkWidth = 1.5;
          break;
        case 'complements':
          linkColor = 'rgba(245, 158, 11, 0.7)'; // 互补知识 - 琥珀色
          linkWidth = 1.5;
          break;
        case 'references':
          linkColor = 'rgba(139, 92, 246, 0.7)'; // 引用关系 - 紫色
          linkWidth = 1.5;
          break;
        case 'related':
          linkColor = 'rgba(79, 70, 229, 0.7)'; // 相关概念 - 靛紫色
          linkWidth = 1.2;
          break;
        case 'unrelated':
          linkColor = 'rgba(156, 163, 175, 0.5)'; // 无直接关系 - 浅灰色
          linkWidth = 0.8;
          break;
        case 'proximity':
          linkColor = 'rgba(249, 115, 22, 0.7)'; // 接近关系 - 橙色
          linkWidth = 1;
          break;
        default:
          linkColor = 'rgba(156, 163, 175, 0.7)'; // 默认 - 灰色
          linkWidth = 1;
      }
      
      // 使用link.value调整线宽
      if (link.value) {
        linkWidth = Math.max(1, link.value * 3);
      }
      
      // 如果源节点或目标节点被高亮，增加连接线宽度
      if (link.source === highlightedNodeId || link.target === highlightedNodeId) {
        linkWidth *= 2;
      }
      
      return {
        ...link,
        // 使用传入的颜色或基于类型的默认颜色
        color: link.color || linkColor,
        // 设置线宽
        width: linkWidth
      };
    });
    
    setGraphData({
      nodes: processedNodes,
      links: processedLinks
    });
  }, [nodes, links, highlightedNodeId]);
  
  // 处理节点点击
  const handleNodeClick = useCallback((node: GraphNode) => {
    if (onNodeClick) {
      onNodeClick(node.id);
    }
  }, [onNodeClick]);
  
  // 处理背景点击
  const handleBackgroundClick = useCallback(() => {
    if (onBackgroundClick) {
      onBackgroundClick();
    }
  }, [onBackgroundClick]);
  
  // 设置移动设备上性能相关配置
  const getMobileConfig = useCallback(() => {
    if (isMobile) {
      return {
        cooldownTicks: 50,       // 减少物理模拟计算量
        cooldownTime: 3000,      // 缩短布局稳定时间
        warmupTicks: 10,         // 减少预热时间
        linkDirectionalParticles: 0, // 禁用粒子效果以提高性能
      };
    } else {
      return {
        cooldownTicks: 100,
        cooldownTime: 15000,
        warmupTicks: 50,
        linkDirectionalParticles: 2, // 在桌面上启用粒子效果
      };
    }
  }, [isMobile]);
  
  useEffect(() => {
    // 当组件挂载后，调整图形
    if (graphRef.current) {
      // 启动力布局的模拟
      graphRef.current.d3Force('charge').strength(-120);
      graphRef.current.d3Force('link').distance((link: any) => {
        // 根据连接类型调整距离
        if (link.type === 'contains') return 80;
        if (link.type === 'related') return 120;
        return 100;
      });
      
      // 如果有高亮节点，居中显示
      if (highlightedNodeId) {
        const node = graphData.nodes.find(n => n.id === highlightedNodeId);
        if (node && graphRef.current) {
          graphRef.current.centerAt(node.x, node.y, 1000);
          graphRef.current.zoom(2, 1000);
        }
      }
    }
  }, [graphData, highlightedNodeId]);
  
  // 节点标签渲染
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const { x, y, id, label, val: size, color } = node;
    const fontSize = node.category === 'cluster' ? 14 : 12;
    
    // 不同的缩放级别显示不同级别的细节
    if (globalScale < 0.4 && node.category !== 'cluster') {
      // 低缩放级别只显示小点，不显示标签
      ctx.beginPath();
      ctx.arc(x, y, size / globalScale, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      return;
    }
    
    // 绘制节点
    ctx.beginPath();
    ctx.arc(x, y, size / globalScale, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    
    // 绘制边框
    ctx.strokeStyle = id === highlightedNodeId ? 'white' : 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = (id === highlightedNodeId ? 2 : 1) / globalScale;
    ctx.stroke();
    
    // 只为主题聚类和高亮节点显示标签
    if (node.category === 'cluster' || id === highlightedNodeId) {
      // 计算适合当前缩放级别的字体大小
      const scaledFontSize = Math.max(fontSize, fontSize / globalScale);
      ctx.font = `${node.category === 'cluster' ? 'bold' : 'normal'} ${scaledFontSize}px Arial`;
      
      // 为标签添加背景
      const textWidth = ctx.measureText(label).width;
      const bckgDimensions = [textWidth + 8, scaledFontSize + 4].map(n => n / globalScale);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(
        x - bckgDimensions[0] / 2,
        y - bckgDimensions[1] / 2,
        bckgDimensions[0],
        bckgDimensions[1]
      );
      
      // 绘制文本
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'white';
      ctx.fillText(label, x, y);
    }
  }, [highlightedNodeId]);
  
  // 链接标签渲染
  const linkCanvasObject = useCallback((link: GraphLink & {source: any; target: any; width: number}, ctx: CanvasRenderingContext2D, globalScale: number) => {
    // 获取连接的源和目标节点
    const sourceNode = graphData.nodes.find(n => n.id === link.source.id || n.id === link.source);
    const targetNode = graphData.nodes.find(n => n.id === link.target.id || n.id === link.target);
    
    if (!sourceNode || !targetNode) return;
    
    // 使用自定义绘制
    const start = { x: sourceNode.x || 0, y: sourceNode.y || 0 };
    const end = { x: targetNode.x || 0, y: targetNode.y || 0 };
    
    // 计算线宽
    const width = link.width / globalScale;
    
    // 计算发光效果的宽度
    const glowWidth = width + 2 / globalScale;
    
    // 绘制发光效果
    ctx.beginPath();
    // 使用默认颜色或link.color
    const color = link.color || 'rgba(100, 100, 100, 0.7)';
    ctx.strokeStyle = color.replace(/[\d.]+\)$/, '0.3)');
    ctx.lineWidth = glowWidth;
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    
    // 绘制主线
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    
    // 如果是双向关系，绘制两侧箭头
    if (link.bidirectional) {
      // 计算线段长度
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      // 计算单位向量
      const ux = dx / length;
      const uy = dy / length;
      
      // 从源到目标的箭头（在目标端）
      drawArrow(ctx, 
        end.x - ux * 15 / globalScale, 
        end.y - uy * 15 / globalScale, 
        end.x, end.y, 
        color, width, globalScale);
      
      // 从目标到源的箭头（在源端）
      drawArrow(ctx, 
        start.x + ux * 15 / globalScale, 
        start.y + uy * 15 / globalScale, 
        start.x, start.y, 
        color, width, globalScale);
    } else {
      // 仅在目标端绘制单向箭头
      drawArrow(ctx, 
        start.x + (end.x - start.x) * 0.85, 
        start.y + (end.y - start.y) * 0.85, 
        end.x, end.y, 
        color, width, globalScale);
    }
    
    // 如果鼠标在链接附近，显示关系标签
    if (link.reason && highlightedNodeId && 
        (link.source === highlightedNodeId || link.target === highlightedNodeId)) {
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      
      // 绘制关系说明背景
      const fontSize = 12 / globalScale;
      ctx.font = `${fontSize}px Arial`;
      const textWidth = ctx.measureText(link.reason).width;
      const padding = 4 / globalScale;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(
        midX - textWidth / 2 - padding,
        midY - fontSize / 2 - padding,
        textWidth + padding * 2,
        fontSize + padding * 2
      );
      
      // 绘制关系说明
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(link.reason, midX, midY);
    }
  }, [graphData, highlightedNodeId, drawArrow]);
  
  return (
    <div className="knowledge-graph-container">
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
          linkCanvasObjectMode={() => 'replace'}
          linkCanvasObject={linkCanvasObject}
          linkColor="color"
          linkWidth="width"
          backgroundColor="#111827"
          onNodeClick={handleNodeClick}
          onBackgroundClick={handleBackgroundClick}
          {...getMobileConfig()}
        />
      )}
    </div>
  );
};

export default ForceGraphKnowledgeGraph;