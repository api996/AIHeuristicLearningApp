import React, { useEffect, useRef } from 'react';

interface KnowledgeNode {
  id: string;
  label: string;
  size: number;
  category?: string;
  clusterId?: string;
  color?: string;
  x?: number;
  y?: number;
}

interface KnowledgeLink {
  source: string;
  target: string;
  value: number;
  type?: string;
}

interface StaticKnowledgeGraphProps {
  nodes: KnowledgeNode[];
  links: KnowledgeLink[];
  width: number | string;
  height: number | string;
  onNodeClick?: (nodeId: string) => void;
}

/**
 * 静态知识图谱组件
 * 使用原生Canvas渲染，不依赖于D3.js力导向布局
 */
const StaticKnowledgeGraph: React.FC<StaticKnowledgeGraphProps> = ({
  nodes,
  links,
  width,
  height,
  onNodeClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const nodesMapRef = useRef<Map<string, { x: number; y: number; radius: number }>>(new Map());
  
  // 计算canvas的实际尺寸
  const getDimensions = () => {
    if (!containerRef.current) return { width: 800, height: 600 };
    
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    
    return {
      width: typeof width === 'number' ? width : containerWidth,
      height: typeof height === 'number' ? height : containerHeight
    };
  };
  
  // 静态布局计算（预先指定位置）
  const calculateStaticLayout = (nodes: KnowledgeNode[], canvasWidth: number, canvasHeight: number) => {
    const map = new Map<string, { x: number; y: number; radius: number }>();
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    // 根据节点类型分组
    const clusterNodes = nodes.filter(n => n.category === 'cluster');
    const keywordNodes = nodes.filter(n => n.category === 'keyword');
    const memoryNodes = nodes.filter(n => n.category === 'memory');
    
    // 集群节点放在中心区域
    const clusterRadius = Math.min(canvasWidth, canvasHeight) * 0.25;
    clusterNodes.forEach((node, index) => {
      const angle = (index / clusterNodes.length) * Math.PI * 2;
      const radius = node.size / 5; // 节点半径
      const distance = clusterRadius * 0.7; // 距中心的距离
      
      map.set(node.id, {
        x: centerX + Math.cos(angle) * distance * 0.8,
        y: centerY + Math.sin(angle) * distance,
        radius
      });
    });
    
    // 关键词节点放在中间环
    const keywordRadius = clusterRadius * 1.6;
    keywordNodes.forEach((node, index) => {
      const angle = (index / keywordNodes.length) * Math.PI * 2;
      const radius = node.size / 8; // 节点半径
      const distance = keywordRadius; // 距中心的距离
      
      map.set(node.id, {
        x: centerX + Math.cos(angle) * distance * 0.9,
        y: centerY + Math.sin(angle) * distance * 0.8,
        radius
      });
    });
    
    // 记忆节点放在外环
    const memoryRadius = keywordRadius * 1.3;
    memoryNodes.forEach((node, index) => {
      const angle = (index / memoryNodes.length) * Math.PI * 2;
      const radius = node.size / 10; // 节点半径
      const distance = memoryRadius; // 距中心的距离
      
      map.set(node.id, {
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        radius
      });
    });
    
    return map;
  };
  
  // 根据节点类型获取颜色
  const getNodeColor = (node: KnowledgeNode) => {
    if (node.color) return node.color;
    
    switch (node.category) {
      case 'cluster':
        return '#3b82f6'; // 蓝色
      case 'keyword':
        return '#22c55e'; // 绿色
      case 'memory':
        return '#eab308'; // 黄色
      default:
        return '#64748b'; // 灰色
    }
  };
  
  // 渲染图谱
  const renderGraph = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = getDimensions();
    
    // 设置canvas尺寸
    canvas.width = width;
    canvas.height = height;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 如果没有节点，则不渲染
    if (nodes.length === 0) return;
    
    // 计算节点位置（如果尚未计算）
    if (nodesMapRef.current.size === 0) {
      nodesMapRef.current = calculateStaticLayout(nodes, width, height);
    }
    
    // 绘制连接线
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
    ctx.lineWidth = 1;
    
    links.forEach(link => {
      const sourceNode = nodesMapRef.current.get(link.source);
      const targetNode = nodesMapRef.current.get(link.target);
      
      if (sourceNode && targetNode) {
        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);
        ctx.stroke();
      }
    });
    
    // 绘制节点
    nodes.forEach(node => {
      const position = nodesMapRef.current.get(node.id);
      if (!position) return;
      
      const { x, y, radius } = position;
      
      // 绘制节点外圈
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = getNodeColor(node);
      ctx.fill();
      
      // 绘制节点内圈（视觉效果）
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fill();
      
      // 绘制标签（对于较大的节点）
      if (radius > 12) {
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label.substring(0, 8), x, y);
      }
    });
  };
  
  // 处理点击事件
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !onNodeClick) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 检查点击是否落在任何节点上
    for (const node of nodes) {
      const position = nodesMapRef.current.get(node.id);
      if (!position) continue;
      
      const distance = Math.sqrt(
        Math.pow(position.x - x, 2) + Math.pow(position.y - y, 2)
      );
      
      if (distance <= position.radius) {
        onNodeClick(node.id);
        break;
      }
    }
  };
  
  // 初始化和渲染图谱
  useEffect(() => {
    // 重置节点位置缓存
    nodesMapRef.current = new Map();
    
    // 渲染图谱
    renderGraph();
    
    // 设置动画循环
    const animate = () => {
      renderGraph();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    // 清理
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [nodes, links, width, height]);
  
  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      nodesMapRef.current = new Map(); // 重置位置缓存以重新计算
      renderGraph();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return (
    <div 
      ref={containerRef}
      style={{ 
        width: width, 
        height: height,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          backgroundColor: 'transparent',
        }}
      />
    </div>
  );
};

export default StaticKnowledgeGraph;