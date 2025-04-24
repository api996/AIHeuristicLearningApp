import React, { useCallback, useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useDeviceDetect } from '@/hooks/useDeviceDetect';

// 图谱节点类型
interface GraphNode {
  id: string;
  label?: string;
  category?: string;
  size?: number;
  color?: string;
  x?: number;
  y?: number;
}

// 图谱连接类型
interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type?: string;
  value?: number;
  label?: string;
  reason?: string;
  color?: string;
}

// 图谱组件属性
interface TextNodeKnowledgeGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
  onBackgroundClick?: () => void;
  highlightedNodeId?: string;
}

/**
 * 使用纯文本节点的知识图谱组件
 * 基于react-force-graph-2d实现，但不使用圆形节点，而是直接渲染文本
 */
const TextNodeKnowledgeGraph: React.FC<TextNodeKnowledgeGraphProps> = ({
  nodes,
  links,
  width = 800,
  height = 600,
  onNodeClick,
  onBackgroundClick,
  highlightedNodeId
}) => {
  const graphRef = useRef<any>();
  // 定义内部处理过的节点和连接类型
  interface ProcessedNode extends GraphNode {
    label: string;
    color: string;
    size: number;
  }
  
  interface ProcessedLink {
    source: ProcessedNode | { id: string };
    target: ProcessedNode | { id: string };
    type?: string;
    value?: number;
    label?: string;
    reason?: string;
    color: string;
    width: number;
    labelText: string | undefined; // 允许undefined以避免类型错误
    reasonText: string;
  }
  
  const [graphData, setGraphData] = useState<{ 
    nodes: ProcessedNode[], 
    links: ProcessedLink[]
  }>({ nodes: [], links: [] });
  const { isMobile } = useDeviceDetect();
  
  // 转换输入数据为图形库所需格式
  useEffect(() => {
    if (!nodes || !links) return;
    
    // 处理节点数据 - 为节点添加必要的属性
    const processedNodes: ProcessedNode[] = nodes.map(node => {
      // 根据节点类型设置颜色
      let nodeColor: string;
      
      switch (node.category) {
        case 'cluster':
          nodeColor = '#3b82f6'; // 主题聚类 - 蓝色
          break;
        case 'keyword':
          nodeColor = '#10b981'; // 关键词 - 绿色
          break;
        case 'memory':
          nodeColor = '#f59e0b'; // 记忆 - 橙色
          break;
        default:
          nodeColor = '#8b5cf6'; // 默认 - 紫色
      }
      
      // 如果该节点被高亮，使用明亮的颜色
      if (node.id === highlightedNodeId) {
        // 增加亮度
        nodeColor = node.category === 'cluster' ? '#60a5fa' : 
                    node.category === 'keyword' ? '#34d399' : 
                    node.category === 'memory' ? '#fbbf24' : 
                    '#a78bfa';
      }
      
      return {
        ...node,
        // 确保有标签
        label: node.label || node.id,
        // 使用传入的颜色或基于类别的默认颜色
        color: node.color || nodeColor,
        // 虽然我们显示纯文本，但仍需要大小属性用于力导向计算
        size: node.size || 5
      };
    });
    
    // 处理连接数据
    const processedLinks: ProcessedLink[] = links.map(link => {
      let linkColor: string;
      let linkWidth: number = 1;
      
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
          linkWidth = 1.6;
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
          linkWidth = 1.8;
          break;
        case 'related':
          linkColor = 'rgba(79, 70, 229, 0.7)'; // 相关概念 - 靛紫色
          linkWidth = 1.2;
          break;
        case 'unrelated':
          linkColor = 'rgba(156, 163, 175, 0.5)'; // 无直接关系 - 浅灰色
          linkWidth = 0.8;
          break;
        default:
          linkColor = 'rgba(156, 163, 175, 0.7)'; // 默认 - 灰色
          linkWidth = 0.5;
      }
      
      // 使用link.value调整线宽
      if (link.value) {
        linkWidth = Math.max(0.5, link.value * 3);
      }
      
      // 如果源节点或目标节点被高亮，增加连接线宽度和不透明度
      if (link.source === highlightedNodeId || link.target === highlightedNodeId) {
        linkWidth *= 2;
        // 增加不透明度
        linkColor = linkColor.replace(/[\d.]+\)$/, '0.9)');
      }
      
      // 标准化source和target
      // 如果是字符串ID，需要找到对应的节点对象
      let source: ProcessedNode | { id: string } = typeof link.source === 'string' 
        ? { id: link.source } 
        : link.source as ProcessedNode;
      
      let target: ProcessedNode | { id: string } = typeof link.target === 'string' 
        ? { id: link.target } 
        : link.target as ProcessedNode;
      
      // 如果是字符串ID，尝试查找对应的节点对象
      if (typeof link.source === 'string') {
        const foundNode = processedNodes.find(n => n.id === link.source);
        if (foundNode) {
          source = foundNode;
        }
      }
      
      if (typeof link.target === 'string') {
        const foundNode = processedNodes.find(n => n.id === link.target);
        if (foundNode) {
          target = foundNode;
        }
      }
      
      return {
        ...link,
        source,
        target,
        color: link.color || linkColor,
        width: linkWidth,
        // 添加标签信息用于悬停显示
        labelText: link.label || link.type || '连接',
        reasonText: link.reason || ''
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
        cooldownTicks: 50,
        cooldownTime: 3000,
        warmupTicks: 10,
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
        if (link.type === 'references') return 100;
        if (link.type === 'applies') return 120;
        if (link.type === 'similar') return 110;
        return 150;
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
  
  // 节点文本渲染 - 使用纯文本而非圆形节点
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const { x, y, label, color, category } = node;
    
    // 根据节点类型和视图缩放调整文本大小
    const fontSize = category === 'cluster' ? 
                    Math.max(16, 16 / globalScale) :
                    Math.max(12, 12 / globalScale);
    
    // 设置字体
    ctx.font = `${category === 'cluster' ? 'bold' : 'normal'} ${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 测量文本宽度以创建背景
    const textWidth = ctx.measureText(label).width;
    const bckgDimensions = [textWidth + 8, fontSize + 4].map(n => n);
    
    // 绘制文本背景 - 半透明效果
    const bgColor = color.replace('rgb', 'rgba').replace(')', ', 0.2)');
    ctx.fillStyle = bgColor;
    ctx.fillRect(
      x - bckgDimensions[0] / 2,
      y - bckgDimensions[1] / 2,
      bckgDimensions[0],
      bckgDimensions[1]
    );
    
    // 绘制文本轮廓 - 增强可见性
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(
      x - bckgDimensions[0] / 2,
      y - bckgDimensions[1] / 2,
      bckgDimensions[0],
      bckgDimensions[1]
    );
    
    // 绘制文本
    ctx.fillStyle = color;
    ctx.fillText(label, x, y);
  }, []);
  
  // 链接标签渲染
  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    if (!link.source || !link.target) return;
    
    // 获取起点和终点
    const start = { x: link.source.x || 0, y: link.source.y || 0 };
    const end = { x: link.target.x || 0, y: link.target.y || 0 };
    
    // 计算线宽
    const width = link.width;
    
    // 计算发光效果的宽度
    const glowWidth = width + 1;
    
    // 绘制发光效果 - 比线本身稍宽，颜色更淡一些
    ctx.beginPath();
    const glowColor = link.color.replace(/[\d.]+\)$/, '0.3)');
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = glowWidth;
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    
    // 绘制主线
    ctx.beginPath();
    ctx.strokeStyle = link.color;
    ctx.lineWidth = width;
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    
    // 如果有关系类型，在线条中间绘制小标签
    if (link.labelText && globalScale > 1.5) {
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      
      // 计算文本大小
      const fontSize = Math.max(10, 10 / globalScale);
      ctx.font = `${fontSize}px Sans-Serif`;
      
      // 测量文本宽度
      const textWidth = ctx.measureText(link.labelText).width;
      
      // 画文本背景
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(
        midX - textWidth / 2 - 2,
        midY - fontSize / 2 - 2,
        textWidth + 4,
        fontSize + 4
      );
      
      // 画文本
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(link.labelText, midX, midY);
    }
  }, []);
  
  return (
    <div className="knowledge-graph-container">
      {graphData.nodes.length > 0 && (
        <ForceGraph2D
          ref={graphRef}
          width={width}
          height={height}
          graphData={graphData}
          nodeRelSize={1} // 使用相对小一些的节点大小，因为我们主要展示文本
          nodeCanvasObject={nodeCanvasObject} // 使用自定义节点渲染函数
          nodeCanvasObjectMode={() => 'replace'} // 完全替换默认节点渲染
          linkCanvasObjectMode={() => 'replace'} // 完全替换默认连接线渲染
          linkCanvasObject={linkCanvasObject} // 使用自定义连接线渲染函数
          linkCurvature={0.1} // 轻微弯曲连接线，使并行连接可见
          linkDirectionalArrowLength={2} // 短箭头
          linkDirectionalArrowRelPos={0.7} // 箭头位置
          linkLabel={(link: any) => `${link.labelText || ''}: ${link.reasonText || ''}`} // 连接线悬停提示
          backgroundColor="#111827" // 深色背景
          onNodeClick={handleNodeClick}
          onBackgroundClick={handleBackgroundClick}
          {...getMobileConfig()}
        />
      )}
    </div>
  );
};

export default TextNodeKnowledgeGraph;