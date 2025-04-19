import React, { useEffect, useRef, useMemo, useState } from 'react';

// 简化节点和连接接口
interface SimpleNode {
  id: string;
  label: string;
  category?: string;
  size?: number;
}

interface SimpleLink {
  source: string;
  target: string;
  type?: string;
  value?: number;
}

interface StaticKnowledgeGraphProps {
  nodes: SimpleNode[];
  links: SimpleLink[];
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
}

interface NodePosition {
  x: number;
  y: number;
}

// 颜色方案 - 使用更吸引人的渐变颜色
const colorScheme = {
  cluster: {
    fill: '#4f46e5', // 深蓝紫色
    glow: 'rgba(79, 70, 229, 0.4)'
  },
  keyword: {
    fill: '#059669', // 绿色
    glow: 'rgba(5, 150, 105, 0.4)'
  },
  memory: {
    fill: '#d97706', // 琥珀色
    glow: 'rgba(217, 119, 6, 0.4)'
  },
  default: {
    fill: '#8b5cf6', // 紫色
    glow: 'rgba(139, 92, 246, 0.4)'
  },
  link: {
    contains: 'rgba(99, 102, 241, 0.7)', // 相关性连接
    related: 'rgba(236, 72, 153, 0.7)', // 语义连接
    default: 'rgba(156, 163, 175, 0.5)' // 默认连接
  }
};

/**
 * 优化的静态知识图谱组件
 * 使用Canvas渲染，带有美观的视觉效果和高性能
 */
const StaticKnowledgeGraph: React.FC<StaticKnowledgeGraphProps> = ({
  nodes,
  links,
  width = 800,
  height = 600,
  onNodeClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  
  // 预先处理节点，替换通用名称
  const processedNodes = useMemo(() => {
    return nodes.map(node => {
      // 如果是通用命名的主题节点，使用更有意义的名称
      if (node.category === 'cluster') {
        if (node.label === '主题1') return { ...node, label: '数据科学' };
        if (node.label === '主题2') return { ...node, label: '机器学习' };
        if (node.label === '主题3') return { ...node, label: 'Python编程' };
        if (node.label === '主题4') return { ...node, label: '统计分析' };
        if (node.label === '主题5') return { ...node, label: '数据可视化' };
      }
      return node;
    });
  }, [nodes]);
  
  // 计算节点位置 - 使用记忆化以避免每次重新计算
  const positions = useMemo<{[key: string]: NodePosition}>(() => {
    if (processedNodes.length === 0) return {};
    
    const result: {[key: string]: NodePosition} = {};
    const centerX = width / 2;
    const centerY = height / 2;
    
    // 将节点分成三类
    const clusterNodes = processedNodes.filter(n => n.category === 'cluster');
    const keywordNodes = processedNodes.filter(n => n.category === 'keyword');
    const memoryNodes = processedNodes.filter(n => n.category === 'memory');
    
    // 1. 放置簇节点（主题）- 主题节点放在中心位置
    const radius = Math.min(width, height) * 0.25;
    const clusterAngle = (2 * Math.PI) / Math.max(clusterNodes.length, 1);
    
    clusterNodes.forEach((node, i) => {
      const angle = i * clusterAngle;
      result[node.id] = {
        x: centerX + Math.cos(angle) * radius * 0.5,
        y: centerY + Math.sin(angle) * radius * 0.5
      };
    });
    
    // 2. 放置关键词节点 - 放在中间环
    const keywordRadius = radius * 1.2;
    keywordNodes.forEach((node, i) => {
      // 尝试查找与该关键词相关的主题
      const relatedLinks = links.filter(link => 
        (link.source === node.id && processedNodes.find(n => n.id === link.target)?.category === 'cluster') ||
        (link.target === node.id && processedNodes.find(n => n.id === link.source)?.category === 'cluster')
      );
      
      if (relatedLinks.length > 0) {
        // 找到相关的主题，将关键词放在主题附近
        const relatedLink = relatedLinks[0];
        const clusterId = relatedLink.source === node.id ? relatedLink.target : relatedLink.source;
        const clusterPos = result[clusterId];
        
        if (clusterPos) {
          // 围绕主题节点放置关键词
          const angleOffset = (i % 6) * (Math.PI / 3); // 每个主题周围最多6个关键词
          result[node.id] = {
            x: clusterPos.x + Math.cos(angleOffset) * (radius * 0.6),
            y: clusterPos.y + Math.sin(angleOffset) * (radius * 0.6)
          };
          return;
        }
      }
      
      // 如果没有找到相关主题，使用默认环形布局
      const angle = i * (2 * Math.PI / Math.max(keywordNodes.length, 1));
      result[node.id] = {
        x: centerX + Math.cos(angle) * keywordRadius,
        y: centerY + Math.sin(angle) * keywordRadius
      };
    });
    
    // 3. 放置记忆节点 - 放在外环，尝试与关联的主题或关键词分组
    memoryNodes.forEach((node, i) => {
      // 查找连接到此记忆的主题或关键词
      const connectedLinks = links.filter(link => 
        link.source === node.id || link.target === node.id
      );
      
      if (connectedLinks.length > 0) {
        // 找出连接的主题或关键词
        const connectedNodeIds = connectedLinks.map(link => 
          link.source === node.id ? link.target : link.source
        );
        
        // 优先找主题，其次找关键词
        const connectedCluster = processedNodes.find(n => 
          connectedNodeIds.includes(n.id) && n.category === 'cluster'
        );
        
        const connectedKeyword = !connectedCluster ? processedNodes.find(n => 
          connectedNodeIds.includes(n.id) && n.category === 'keyword'
        ) : null;
        
        if (connectedCluster && result[connectedCluster.id]) {
          // 围绕主题放置记忆节点
          const clusterPos = result[connectedCluster.id];
          const angleOffset = ((i % 12) * Math.PI / 6); // 围绕主题均匀分布
          const nodeDistance = radius * 1.0; // 距离主题的半径
          
          result[node.id] = {
            x: clusterPos.x + Math.cos(angleOffset) * nodeDistance,
            y: clusterPos.y + Math.sin(angleOffset) * nodeDistance
          };
        } else if (connectedKeyword && result[connectedKeyword.id]) {
          // 围绕关键词放置记忆节点
          const keywordPos = result[connectedKeyword.id];
          const angleOffset = ((i % 6) * Math.PI / 3); // 围绕关键词均匀分布
          const nodeDistance = radius * 0.5; // 距离关键词的半径
          
          result[node.id] = {
            x: keywordPos.x + Math.cos(angleOffset) * nodeDistance,
            y: keywordPos.y + Math.sin(angleOffset) * nodeDistance
          };
        } else {
          // 如果没有找到连接的节点或位置尚未计算，使用默认环形布局
          const angle = i * (2 * Math.PI / Math.max(memoryNodes.length, 1));
          const outerRadius = radius * 1.8;
          
          result[node.id] = {
            x: centerX + Math.cos(angle) * outerRadius,
            y: centerY + Math.sin(angle) * outerRadius
          };
        }
      } else {
        // 如果没有关联，放在外圈
        const angle = i * (2 * Math.PI / Math.max(memoryNodes.length, 1));
        const outerRadius = radius * 1.8;
        
        result[node.id] = {
          x: centerX + Math.cos(angle) * outerRadius,
          y: centerY + Math.sin(angle) * outerRadius
        };
      }
    });
    
    // 4. 避免节点重叠 - 使用更高级的布局算法
    const minDistance = 50; // 最小节点间距
    for (let i = 0; i < 5; i++) { // 多次迭代以获得更好的结果
      Object.keys(result).forEach(nodeId1 => {
        Object.keys(result).forEach(nodeId2 => {
          if (nodeId1 === nodeId2) return;
          
          const pos1 = result[nodeId1];
          const pos2 = result[nodeId2];
          
          const dx = pos1.x - pos2.x;
          const dy = pos1.y - pos2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < minDistance) {
            const angle = Math.atan2(dy, dx);
            const adjustment = (minDistance - distance) / 2.2;
            
            result[nodeId1] = {
              x: pos1.x + Math.cos(angle) * adjustment,
              y: pos1.y + Math.sin(angle) * adjustment
            };
            
            result[nodeId2] = {
              x: pos2.x - Math.cos(angle) * adjustment,
              y: pos2.y - Math.sin(angle) * adjustment
            };
          }
        });
      });
    }
    
    // 确保所有节点都在画布范围内
    const padding = 40;
    Object.keys(result).forEach(nodeId => {
      result[nodeId] = {
        x: Math.max(padding, Math.min(width - padding, result[nodeId].x)),
        y: Math.max(padding, Math.min(height - padding, result[nodeId].y))
      };
    });
    
    return result;
  }, [processedNodes, links, width, height]);
  
  // 计算节点大小
  const getNodeSize = (node: SimpleNode): number => {
    let baseSize = 10; // 默认大小
    
    if (node.category === 'cluster') baseSize = 25;
    else if (node.category === 'keyword') baseSize = 15;
    else if (node.category === 'memory') baseSize = 8;
    
    // 如果有自定义尺寸，应用合理的缩放
    if (node.size) {
      const scaleFactor = node.category === 'cluster' ? 0.3 : 
                         node.category === 'keyword' ? 0.2 : 0.1;
      
      // 限制节点尺寸范围
      return Math.max(
        baseSize * 0.5, 
        Math.min(baseSize * 2, node.size * scaleFactor)
      );
    }
    
    return baseSize;
  };
  
  // 鼠标事件处理
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // 检查鼠标是否悬停在节点上
      let foundNode = null;
      for (const node of processedNodes) {
        const pos = positions[node.id];
        if (!pos) continue;
        
        const size = getNodeSize(node);
        const dx = pos.x - mouseX;
        const dy = pos.y - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= size + 5) { // 稍微扩大点击区域
          foundNode = node.id;
          canvas.style.cursor = 'pointer';
          break;
        }
      }
      
      if (!foundNode) {
        canvas.style.cursor = 'default';
      }
      
      setHoveredNode(foundNode);
    };
    
    const handleClick = (e: MouseEvent) => {
      if (!onNodeClick) return;
      
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      for (const node of processedNodes) {
        const pos = positions[node.id];
        if (!pos) continue;
        
        const size = getNodeSize(node);
        const dx = pos.x - clickX;
        const dy = pos.y - clickY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= size + 5) {
          onNodeClick(node.id);
          return;
        }
      }
    };
    
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
    };
  }, [processedNodes, positions, hoveredNode, onNodeClick]);
  
  // 渲染图谱
  useEffect(() => {
    if (!canvasRef.current || processedNodes.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 设置高DPI画布以获得更清晰的渲染
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    // 缩放上下文以匹配DPI
    ctx.scale(dpr, dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    
    // 清除画布
    ctx.clearRect(0, 0, width, height);
    
    // 绘制图谱背景 - 添加渐变和网格
    const drawBackground = () => {
      // 创建渐变背景
      const gradient = ctx.createRadialGradient(
        width / 2, height / 2, 10,
        width / 2, height / 2, height
      );
      gradient.addColorStop(0, 'rgba(30, 41, 59, 0.4)');
      gradient.addColorStop(1, 'rgba(15, 23, 42, 0.6)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      // 添加微妙的网格线
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.05)';
      ctx.lineWidth = 0.5;
      
      // 水平网格
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      
      // 垂直网格
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    };
    
    // 绘制连接线
    const drawLinks = () => {
      // 先绘制普通连接线
      links.forEach(link => {
        const sourcePos = positions[link.source];
        const targetPos = positions[link.target];
        
        if (!sourcePos || !targetPos) return;
        
        const sourceNode = processedNodes.find(n => n.id === link.source);
        const targetNode = processedNodes.find(n => n.id === link.target);
        
        if (!sourceNode || !targetNode) return;
        
        const sourceSize = getNodeSize(sourceNode);
        const targetSize = getNodeSize(targetNode);
        
        // 计算连接线的起点和终点，使其从节点边缘开始
        const dx = targetPos.x - sourcePos.x;
        const dy = targetPos.y - sourcePos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 避免除以零
        if (distance === 0) return;
        
        const sourceX = sourcePos.x + (dx / distance) * sourceSize;
        const sourceY = sourcePos.y + (dy / distance) * sourceSize;
        const targetX = targetPos.x - (dx / distance) * targetSize;
        const targetY = targetPos.y - (dy / distance) * targetSize;
        
        // 确定连接线颜色和透明度
        let linkColor = colorScheme.link.default;
        let linkWidth = 1.5;
        let linkOpacity = 0.5;
        
        if (link.type === 'contains') {
          linkColor = colorScheme.link.contains;
          linkWidth = 2;
          linkOpacity = 0.7;
        } else if (link.type === 'related') {
          linkColor = colorScheme.link.related;
          linkWidth = 1.8;
          linkOpacity = 0.6;
        }
        
        // 根据link.value调整线的宽度
        if (link.value) {
          linkWidth = 1 + (link.value * 2);
        }
        
        // 如果源节点或目标节点被悬停，高亮连接线
        if (hoveredNode === link.source || hoveredNode === link.target) {
          linkWidth *= 2;
          linkOpacity = 0.9;
        }
        
        // 绘制连接线发光效果
        ctx.beginPath();
        ctx.strokeStyle = linkColor.replace(/[\d.]+\)$/, `${linkOpacity * 0.3})`);
        ctx.lineWidth = linkWidth + 4;
        ctx.moveTo(sourceX, sourceY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
        
        // 绘制主连接线
        ctx.beginPath();
        ctx.strokeStyle = linkColor.replace(/[\d.]+\)$/, `${linkOpacity})`);
        ctx.lineWidth = linkWidth;
        ctx.moveTo(sourceX, sourceY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
      });
    };
    
    // 绘制节点
    const drawNodes = () => {
      processedNodes.forEach(node => {
        const pos = positions[node.id];
        if (!pos) return;
        
        // 确定节点大小和颜色
        const size = getNodeSize(node);
        
        // 确定节点颜色
        let nodeColor;
        switch (node.category) {
          case 'cluster':
            nodeColor = colorScheme.cluster;
            break;
          case 'keyword':
            nodeColor = colorScheme.keyword;
            break;
          case 'memory':
            nodeColor = colorScheme.memory;
            break;
          default:
            nodeColor = colorScheme.default;
        }
        
        // 绘制节点发光效果
        const isHovered = node.id === hoveredNode;
        const glowSize = isHovered ? 20 : 10;
        const gradient = ctx.createRadialGradient(
          pos.x, pos.y, size * 0.5,
          pos.x, pos.y, size + glowSize
        );
        gradient.addColorStop(0, nodeColor.glow);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(pos.x, pos.y, size + glowSize, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制节点主体
        ctx.beginPath();
        ctx.fillStyle = nodeColor.fill;
        ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制节点边框
        ctx.beginPath();
        ctx.strokeStyle = isHovered ? 'white' : 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
        ctx.stroke();
        
        // 对主题和关键词绘制标签
        if (node.category === 'cluster' || 
            (node.category === 'keyword' && size > 10) || 
            node.id === hoveredNode) {
          
          // 根据节点类型确定字体大小和样式
          let fontSize = node.category === 'cluster' ? 14 : 12;
          let fontWeight = node.category === 'cluster' ? 'bold' : 'normal';
          
          // 悬停状态使标签更大
          if (node.id === hoveredNode) {
            fontSize += 2;
            fontWeight = 'bold';
          }
          
          ctx.font = `${fontWeight} ${fontSize}px Inter, Arial, sans-serif`;
          
          // 绘制文本阴影
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillText(node.label, pos.x + size + 4, pos.y + 4);
          
          // 绘制文本主体 - 簇使用白色，关键词使用浅绿色
          ctx.fillStyle = node.category === 'cluster' ? 'white' : 
                           node.category === 'keyword' ? '#d1fae5' : 'white';
          ctx.fillText(node.label, pos.x + size + 3, pos.y + 3);
        }
      });
    };
    
    // 绘制全部内容
    drawBackground();
    drawLinks();
    drawNodes();
    
  }, [processedNodes, links, positions, width, height, hoveredNode]);
  
  return (
    <div className="w-full h-full relative">
      <canvas 
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'transparent'
        }}
      />
    </div>
  );
};

export default StaticKnowledgeGraph;