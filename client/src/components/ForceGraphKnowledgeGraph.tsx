import React, { useCallback, useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Tooltip } from "@/components/ui/tooltip";
import { TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

// 图谱节点类型
interface GraphNode {
  id: string;
  label: string;
  category?: string;
  size?: number;
  color?: string; // 可选，为节点指定特定颜色
  x?: number;     // 节点位置 x 坐标
  y?: number;     // 节点位置 y 坐标
  clusterId?: string; // 聚类ID
}

// 图谱连接类型
interface GraphLink {
  source: any; // 可以是字符串或对象
  target: any; // 可以是字符串或对象
  type?: string;
  value?: number;
  color?: string; // 可选，为连接指定特定颜色
  label?: string; // 关系标签
  reason?: string; // 关系原因
  strength?: number; // 关系强度
  learningOrder?: string; // 学习顺序
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
  
  // 添加连接关系信息对话框状态
  const [selectedLink, setSelectedLink] = useState<GraphLink | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState<boolean>(false);
  const [highlightedLink, setHighlightedLink] = useState<GraphLink | null>(null);
  
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
      
      switch (link.type) {
        case 'contains':
          linkColor = 'rgba(59, 130, 246, 0.7)'; // 包含关系 - 蓝色
          linkWidth = 2;
          break;
        case 'related':
          linkColor = 'rgba(16, 185, 129, 0.7)'; // 相关关系 - 绿色
          linkWidth = 1.5;
          break;
        case 'proximity':
          linkColor = 'rgba(245, 158, 11, 0.7)'; // 接近关系 - 橙色
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
  
  // 计算主题分布占比
  const calculateTopicPercentage = (link: GraphLink): number => {
    // 根据连接的源和目标节点计算它们在图中的比重
    // 首先获取源节点和目标节点
    const sourceNode = typeof link.source === 'string' 
      ? graphData.nodes.find(n => n.id === link.source) 
      : graphData.nodes.find(n => n.id === (link.source as any)?.id);
    
    const targetNode = typeof link.target === 'string'
      ? graphData.nodes.find(n => n.id === link.target)
      : graphData.nodes.find(n => n.id === (link.target as any)?.id);
    
    if (!sourceNode || !targetNode) return 50; // 默认值
    
    // 计算这两个节点的大小总和占所有节点大小总和的百分比
    const nodeSizeSum = graphData.nodes.reduce((sum, node) => sum + (node.size || 5), 0);
    const currentNodesSizeSum = (sourceNode.size || 5) + (targetNode.size || 5);
    
    // 转换为百分比 (0-100)
    const percentage = (currentNodesSizeSum / nodeSizeSum) * 100;
    
    // 限制范围在10-90之间，确保有意义的显示效果
    return Math.max(10, Math.min(90, percentage));
  };

  // 设置移动设备上性能相关配置 - 优化配置以提高交互性
  const getMobileConfig = useCallback(() => {
    if (isMobile) {
      return {
        cooldownTicks: 30,       // 减少物理模拟计算量
        cooldownTime: 2000,      // 缩短布局稳定时间
        warmupTicks: 5,          // 减少预热时间
        linkDirectionalParticles: 0, // 禁用粒子效果以提高性能
        linkDirectionalArrowLength: 0, // 禁用箭头
        linkDirectionalArrowRelPos: 0, // 禁用箭头位置
        nodeRelSize: 10,         // 增大节点相对尺寸
        d3AlphaDecay: 0.02,      // 更快的布局收敛
        d3VelocityDecay: 0.1,    // 更灵活的节点运动
        dagMode: undefined,      // 禁用有向无环图模式
        dagLevelDistance: 0,     // 禁用层级距离
        dagNodeFilter: undefined, // 禁用节点过滤
        rendererConfig: {
          precision: 'lowp',     // 低精度渲染以提高性能
          antialias: false,      // 禁用抗锯齿以提高性能
          alpha: true,           // 启用透明通道
          preserveDrawingBuffer: false, // 不保留绘图缓冲区
        },
        minZoom: 0.5,            // 设置最小缩放
        maxZoom: 3,              // 设置最大缩放
        enableZoomInteraction: true, // 启用缩放交互
        enableNodeDrag: true,    // 启用节点拖拽
        enablePanInteraction: true, // 启用平移交互
      };
    } else {
      return {
        cooldownTicks: 80,       // 为桌面设备保留更多的物理模拟
        cooldownTime: 8000,      // 更长的布局稳定时间
        warmupTicks: 30,         // 更多的预热时间
        linkDirectionalParticles: 2, // 在桌面上启用粒子效果
        linkDirectionalParticleWidth: 2, // 粒子宽度
        linkDirectionalParticleSpeed: 0.005, // 粒子速度
        nodeRelSize: 8,          // 节点相对大小
        d3AlphaDecay: 0.015,     // 正常的布局收敛
        d3VelocityDecay: 0.08,   // 更平滑的节点运动
        rendererConfig: {
          precision: 'mediump',  // 中等精度渲染
          antialias: true,       // 启用抗锯齿
          alpha: true,           // 启用透明通道
          preserveDrawingBuffer: true, // 保留绘图缓冲区以便截图
        },
        minZoom: 0.3,            // 设置最小缩放
        maxZoom: 5,              // 设置最大缩放
      };
    }
  }, [isMobile, graphData.nodes]);
  
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
  
  // 链接标签渲染 - 完全重写以增强可点击性
  const linkCanvasObject = useCallback((link: GraphLink & {source: any; target: any; width: number}, ctx: CanvasRenderingContext2D, globalScale: number) => {
    // 获取连接的源和目标节点
    const sourceNode = graphData.nodes.find(n => n.id === link.source.id || n.id === link.source);
    const targetNode = graphData.nodes.find(n => n.id === link.target.id || n.id === link.target);
    
    if (!sourceNode || !targetNode) return;
    
    // 使用自定义绘制
    const start = { x: sourceNode.x || 0, y: sourceNode.y || 0 };
    const end = { x: targetNode.x || 0, y: targetNode.y || 0 };
    
    // 计算中点
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    // 确定连接宽度 - 大幅增加 (关键改动)
    const width = Math.max(5, (link.width || 1)) / globalScale;
    
    // 设置连接颜色
    const color = link.color || 'rgba(100, 100, 100, 0.7)';
    
    // 检查是否是当前高亮的连接
    const isHighlighted = highlightedLink && 
      ((typeof highlightedLink.source === 'string' ? highlightedLink.source : highlightedLink.source) === (typeof link.source === 'object' ? link.source.id : link.source)) && 
      ((typeof highlightedLink.target === 'string' ? highlightedLink.target : highlightedLink.target) === (typeof link.target === 'object' ? link.target.id : link.target));
    
    // 绘制隐形的更宽的线用于检测点击 (关键改动)
    // 这条线是完全透明的，但会增加连接的可点击区域
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0,0,0,0)'; // 完全透明
    ctx.lineWidth = width * 4; // 非常宽的点击区域
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    
    // 绘制连接的主线
    ctx.beginPath();
    ctx.strokeStyle = isHighlighted ? color.replace(/[\d.]+\)$/, '0.9)') : color;
    ctx.lineWidth = isHighlighted ? width * 1.5 : width;
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    
    // 绘制中点指示器 (强化视觉提示)
    // 明显增大中点指示器尺寸并添加动画效果
    const dotSize = (isHighlighted ? 15 : 10) / globalScale;
    
    // 绘制一个更大的外圈以增加可点击区域
    ctx.beginPath();
    ctx.arc(midX, midY, dotSize * 1.5, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.01)'; // 几乎透明
    ctx.fill();
    
    // 绘制交互指示点 - 使用明亮的颜色使其明显可见
    ctx.beginPath();
    ctx.arc(midX, midY, dotSize, 0, 2 * Math.PI);
    
    // 对于高亮连接使用白色加发光效果，否则使用半透明白色
    if (isHighlighted) {
      // 添加发光效果
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    }
    
    ctx.fill();
    ctx.shadowBlur = 0; // 重置阴影效果
    
    // 中心点添加边框使其更明显
    ctx.beginPath();
    ctx.arc(midX, midY, dotSize, 0, 2 * Math.PI);
    ctx.strokeStyle = color.replace(/[\d.]+\)$/, '0.9)');
    ctx.lineWidth = 2 / globalScale;
    ctx.stroke();
    
    // 仅在悬停或缩放足够大时显示标签
    if ((link.label || link.type) && (isHighlighted || globalScale > 0.6)) {
      // 显示关系标签
      const labelText = link.label || link.type || "相关";
      
      // 使用更大更明显的字体
      const fontSize = isHighlighted ? 16 : 14;
      const scaledFontSize = Math.max(fontSize, fontSize / globalScale);
      ctx.font = `${isHighlighted ? 'bold' : 'normal'} ${scaledFontSize}px Arial`;
      
      // 为标签添加背景使其更明显
      const textWidth = ctx.measureText(labelText).width;
      const bckgDimensions = [textWidth + 16, scaledFontSize + 10].map(n => n / globalScale);
      
      // 带有边框的标签背景
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(
        midX - bckgDimensions[0] / 2,
        midY - bckgDimensions[1] / 2 - dotSize - (bckgDimensions[1] / 2), // 将标签放在点的上方
        bckgDimensions[0],
        bckgDimensions[1]
      );
      
      // 添加边框使标签更明显
      ctx.strokeStyle = color.replace(/[\d.]+\)$/, '0.6)');
      ctx.lineWidth = 1 / globalScale;
      ctx.strokeRect(
        midX - bckgDimensions[0] / 2,
        midY - bckgDimensions[1] / 2 - dotSize - (bckgDimensions[1] / 2),
        bckgDimensions[0],
        bckgDimensions[1]
      );
      
      // 绘制文本
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'white';
      ctx.fillText(
        labelText,
        midX,
        midY - dotSize - (bckgDimensions[1] / 2)
      );
    }
    
    // 在中点文字提示点击功能
    if (isHighlighted && globalScale > 0.5) {
      ctx.font = `${12 / globalScale}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'white';
      ctx.fillText("点击查看", midX, midY + dotSize + (12 / globalScale));
    }
  }, [graphData, highlightedLink]);
  
  // 处理链接点击
  const handleLinkClick = useCallback((link: any) => {
    console.log("边点击事件触发:", link);
    
    // 确保link有正确的类型格式
    const processedLink: GraphLink = {
      source: typeof link.source === 'object' ? link.source.id : link.source,
      target: typeof link.target === 'object' ? link.target.id : link.target,
      type: link.type,
      value: link.value,
      color: link.color,
      label: link.label,
      reason: link.reason,
      strength: link.strength,
      learningOrder: link.learningOrder
    };
    
    // 查找完整的源节点和目标节点信息，以便在对话框中显示更详细的数据
    const sourceNode = typeof link.source === 'object' ? link.source : 
      graphData.nodes.find(n => n.id === link.source);
    
    const targetNode = typeof link.target === 'object' ? link.target : 
      graphData.nodes.find(n => n.id === link.target);
    
    // 如果找到节点，添加更详细的标签信息
    if (sourceNode && sourceNode.label) {
      processedLink.source = sourceNode.label;
    }
    
    if (targetNode && targetNode.label) {
      processedLink.target = targetNode.label;
    }
    
    // 添加触觉反馈，如果设备支持
    if (navigator.vibrate && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(50); // 短暂的振动反馈
      } catch (e) {
        // 忽略不支持振动API的设备
      }
    }
    
    // 高亮当前连接
    setHighlightedLink(processedLink);
    
    // 显示对话框
    setSelectedLink(processedLink);
    setShowLinkDialog(true);
  }, [graphData]);
  
  // 处理链接悬停
  const handleLinkHover = useCallback((link: any | null) => {
    if (link) {
      const processedLink: GraphLink = {
        source: typeof link.source === 'object' ? link.source.id : link.source,
        target: typeof link.target === 'object' ? link.target.id : link.target,
        type: link.type,
        color: link.color,
        value: link.value,
        label: link.label,
        reason: link.reason,
        strength: link.strength,
        learningOrder: link.learningOrder
      };
      setHighlightedLink(processedLink);
    } else {
      setHighlightedLink(null);
    }
  }, []);
  
  // 关闭对话框
  const handleCloseDialog = useCallback(() => {
    setShowLinkDialog(false);
    setSelectedLink(null);
  }, []);
  
  // 添加自定义点击事件处理
  useEffect(() => {
    if (graphRef.current) {
      // 获取canvas元素
      const canvas = graphRef.current.canvas();
      if (!canvas) return;
      
      // 添加自定义点击事件
      const handleCanvasClick = (event: MouseEvent) => {
        const graphInstance = graphRef.current;
        if (!graphInstance) return;
        
        // 获取画布位置
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // 将屏幕坐标转换为图形坐标
        const pos = graphInstance.screen2GraphCoords(x, y);
        
        // 检查点击是否在连接上
        // 获取所有连接
        const links = graphData.links;
        
        let closestLink: any = null;
        let minDistance = Infinity;
        let minMidPointDistance = Infinity;
        
        links.forEach((link: any) => {
          // 获取源节点和目标节点
          const sourceNode = typeof link.source === 'object' ? link.source : 
            graphData.nodes.find((n: any) => n.id === link.source);
          
          const targetNode = typeof link.target === 'object' ? link.target : 
            graphData.nodes.find((n: any) => n.id === link.target);
          
          if (!sourceNode || !targetNode) return;
          
          // 计算源和目标的位置
          const source = { x: sourceNode.x || 0, y: sourceNode.y || 0 };
          const target = { x: targetNode.x || 0, y: targetNode.y || 0 };
          
          // 计算中点
          const midPoint = {
            x: (source.x + target.x) / 2,
            y: (source.y + target.y) / 2
          };
          
          // 计算点击点到中点的距离
          const midPointDist = Math.sqrt(
            Math.pow(pos.x - midPoint.x, 2) + 
            Math.pow(pos.y - midPoint.y, 2)
          );
          
          // 特别判断中点附近的点击 (优先检查中点)
          if (midPointDist < 20 && midPointDist < minMidPointDistance) {
            closestLink = link;
            minMidPointDistance = midPointDist;
            return; // 如果点击在中点附近，立即选择该连接
          }
          
          // 计算点击点到线段的距离 (备用方案)
          // 源自: https://stackoverflow.com/questions/849211
          const a = pos.x - source.x;
          const b = pos.y - source.y;
          const c = target.x - source.x;
          const d = target.y - source.y;
          
          const dot = a * c + b * d;
          const len_sq = c * c + d * d;
          let param = -1;
          
          if (len_sq !== 0) param = dot / len_sq;
          
          let xx, yy;
          
          if (param < 0) {
            xx = source.x;
            yy = source.y;
          } else if (param > 1) {
            xx = target.x;
            yy = target.y;
          } else {
            xx = source.x + param * c;
            yy = source.y + param * d;
          }
          
          const dx = pos.x - xx;
          const dy = pos.y - yy;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // 如果距离小于阈值且小于当前最小距离
          if (distance < 15 && distance < minDistance) {
            closestLink = link;
            minDistance = distance;
          }
        });
        
        // 如果找到最近的连接，触发点击事件
        if (closestLink) {
          console.log("自定义点击检测：检测到连接点击", closestLink);
          handleLinkClick(closestLink);
          event.stopPropagation(); // 阻止事件冒泡
        }
      };
      
      // 添加点击事件监听器
      canvas.addEventListener('click', handleCanvasClick);
      
      // 在组件卸载时移除事件监听器
      return () => {
        canvas.removeEventListener('click', handleCanvasClick);
      };
    }
  }, [graphData, handleLinkClick]);
  
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
          onLinkHover={handleLinkHover as any}
          onBackgroundClick={handleBackgroundClick}
          linkHoverPrecision={8}    // 增加链接悬停检测精度
          enablePointerInteraction={true}
          {...getMobileConfig()}
        />
      )}
      
      {/* 连接关系信息对话框 */}
      <Dialog open={showLinkDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-md border-t-4" style={{ borderTopColor: selectedLink?.color || 'rgba(59, 130, 246, 0.8)' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>知识关联详情</span>
              {selectedLink && (
                <Badge 
                  variant="outline" 
                  className="ml-2 animate-fadeIn" 
                  style={{ 
                    borderColor: selectedLink.color || 'rgba(59, 130, 246, 0.8)',
                    color: selectedLink.color ? selectedLink.color.replace(/[\d.]+\)$/, '1)') : 'rgba(59, 130, 246, 1)'
                  }}
                >
                  {selectedLink.type || '相关关系'}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedLink && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-medium">主题分布占比:</span>
                <div className="flex items-center">
                  <div className="w-24 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full transition-all duration-500 ease-out" 
                      style={{ 
                        width: `${calculateTopicPercentage(selectedLink)}%`,
                        background: selectedLink.color || 'rgba(59, 130, 246, 0.8)'
                      }}
                    ></div>
                  </div>
                  <span className="text-sm ml-2 font-medium">{Math.round(calculateTopicPercentage(selectedLink))}%</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4 mt-2">
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg hover:shadow-md transition-shadow duration-300">
                  <div className="p-2 rounded-full" style={{ background: `${selectedLink.color?.replace(/[\d.]+\)$/, '0.2)') || 'rgba(59, 130, 246, 0.2)'}` }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: selectedLink.color || 'rgba(59, 130, 246, 0.8)' }}><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/></svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">关联主题</h4>
                    <div className="flex gap-2 mt-1 flex-wrap items-center">
                      <Badge 
                        className="py-1 text-base transition-colors hover:bg-indigo-200 dark:hover:bg-indigo-800"
                        style={{ 
                          background: 'rgba(99, 102, 241, 0.1)', 
                          color: 'rgb(79, 70, 229)', 
                          borderColor: 'rgba(99, 102, 241, 0.2)' 
                        }}
                      >
                        {typeof selectedLink.source === 'string' ? selectedLink.source : (selectedLink.source as any)?.label || (selectedLink.source as any)?.id}
                      </Badge>
                      <span className="text-gray-400 px-1">→</span>
                      <Badge 
                        className="py-1 text-base transition-colors hover:bg-violet-200 dark:hover:bg-violet-800"
                        style={{ 
                          background: 'rgba(139, 92, 246, 0.1)', 
                          color: 'rgb(109, 40, 217)', 
                          borderColor: 'rgba(139, 92, 246, 0.2)' 
                        }}
                      >
                        {typeof selectedLink.target === 'string' ? selectedLink.target : (selectedLink.target as any)?.label || (selectedLink.target as any)?.id}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg hover:shadow-md transition-shadow duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-300"><path d="m12 8-9.04 9.06a2.82 2.82 0 1 0 3.98 3.98L16 12"/><circle cx="17" cy="7" r="5"/></svg>
                  </div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">学习建议</h4>
                </div>
                <div className="rounded-md p-2 text-sm mt-1 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
                  {selectedLink.learningOrder || '可同时学习这两个主题，它们相互补充'}
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg hover:shadow-md transition-shadow duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-300"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  </div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">关系解释</h4>
                </div>
                <div className="rounded-md p-2 text-sm mt-1 whitespace-pre-line bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                  {selectedLink.reason || '这些主题在学习过程中存在关联，帮助你构建更完整的知识体系。'}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ForceGraphKnowledgeGraph;