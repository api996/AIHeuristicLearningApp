import React, { useEffect, useRef, useState } from 'react';

// 简化的节点和连接类型
interface GraphNode {
  id: string;
  label: string;
  category?: string;
  color?: string;
  size?: number;
}

interface GraphLink {
  source: string;
  target: string;
  type?: string;
}

interface QuickGraphViewProps {
  nodes: GraphNode[];
  links: GraphLink[];
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
}

// 极简高性能知识图谱视图组件
const QuickGraphView: React.FC<QuickGraphViewProps> = ({
  nodes,
  links,
  width = 800,
  height = 600,
  onNodeClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 基本配置
  const colors = {
    cluster: '#3b82f6', // 蓝色
    keyword: '#10b981', // 绿色
    memory: '#f59e0b',  // 橙色
    default: '#6366f1'  // 紫色
  };
  
  // 获取节点颜色
  const getNodeColor = (node: GraphNode) => {
    if (node.color) return node.color;
    return node.category && colors[node.category as keyof typeof colors] 
      ? colors[node.category as keyof typeof colors] 
      : colors.default;
  };
  
  // 获取节点大小
  const getNodeSize = (node: GraphNode) => {
    const baseSize = node.size || 10;
    if (node.category === 'cluster') return baseSize * 0.4;
    if (node.category === 'keyword') return baseSize * 0.3;
    return baseSize * 0.25;
  };

  useEffect(() => {
    if (!canvasRef.current || !nodes.length) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 执行预计算 - 使用预设的几何排列而不是真正的力导向算法
    const positions: {[key: string]: {x: number, y: number}} = {};
    
    // 1. 首先放置主题节点 (簇)
    const clusterNodes = nodes.filter(n => n.category === 'cluster');
    const angle = (2 * Math.PI) / Math.max(1, clusterNodes.length);
    const radius = Math.min(width, height) * 0.3; // 主题节点放在圆环上
    
    clusterNodes.forEach((node, i) => {
      positions[node.id] = {
        x: width/2 + radius * Math.cos(i * angle),
        y: height/2 + radius * Math.sin(i * angle)
      };
    });
    
    // 2. 围绕主题节点放置其他节点
    const centerX = width / 2;
    const centerY = height / 2;
    
    nodes.forEach(node => {
      // 跳过已经放置的节点
      if (positions[node.id]) return;
      
      // 找到连接到此节点的所有链接
      const connectedLinks = links.filter(
        link => link.source === node.id || link.target === node.id
      );
      
      // 如果没有连接，则放在中心附近的随机位置
      if (connectedLinks.length === 0) {
        const angle = Math.random() * 2 * Math.PI;
        const r = Math.random() * radius * 0.5;
        positions[node.id] = {
          x: centerX + r * Math.cos(angle),
          y: centerY + r * Math.sin(angle)
        };
        return;
      }
      
      // 找到连接到的簇节点
      let connectedCluster: string | null = null;
      
      for (const link of connectedLinks) {
        // 查找连接到的簇节点
        let clusterId: string | undefined;
        
        if (link.source !== node.id) {
          const sourceNode = nodes.find(n => n.id === link.source);
          if (sourceNode?.category === 'cluster') clusterId = sourceNode.id;
        }
        
        if (link.target !== node.id) {
          const targetNode = nodes.find(n => n.id === link.target);
          if (targetNode?.category === 'cluster') clusterId = targetNode.id;
        }
        
        if (clusterId) {
          connectedCluster = clusterId;
          break;
        }
      }
      
      // 如果连接到簇，则在簇周围放置
      if (connectedCluster && positions[connectedCluster]) {
        const clusterPos = positions[connectedCluster];
        const angle = Math.random() * 2 * Math.PI;
        const clusterRadius = getNodeSize(clusterNodes.find(n => n.id === connectedCluster) || {category: 'cluster'} as GraphNode);
        const distance = clusterRadius * 6 + Math.random() * 30;
        
        positions[node.id] = {
          x: clusterPos.x + distance * Math.cos(angle),
          y: clusterPos.y + distance * Math.sin(angle)
        };
      } else {
        // 否则，放在中心附近
        const angle = Math.random() * 2 * Math.PI;
        const r = Math.random() * radius * 0.7;
        positions[node.id] = {
          x: centerX + r * Math.cos(angle),
          y: centerY + r * Math.sin(angle)
        };
      }
    });
    
    // 避免位置重叠 - 简单的碰撞检测
    for (let i = 0; i < 5; i++) { // 运行几次迭代即可
      const adjustPosition = (nodeId: string) => {
        const pos = positions[nodeId];
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        const nodeRadius = getNodeSize(node);
        
        Object.entries(positions).forEach(([otherId, otherPos]) => {
          if (otherId === nodeId) return;
          
          const otherNode = nodes.find(n => n.id === otherId);
          if (!otherNode) return;
          
          const otherRadius = getNodeSize(otherNode);
          const minDistance = (nodeRadius + otherRadius) * 2.5;
          
          const dx = pos.x - otherPos.x;
          const dy = pos.y - otherPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < minDistance) {
            const angle = Math.atan2(dy, dx);
            const pushDistance = (minDistance - distance) / 2;
            
            // 移动两个节点，防止重叠
            positions[nodeId] = {
              x: pos.x + pushDistance * Math.cos(angle),
              y: pos.y + pushDistance * Math.sin(angle)
            };
            
            positions[otherId] = {
              x: otherPos.x - pushDistance * Math.cos(angle),
              y: otherPos.y - pushDistance * Math.sin(angle)
            };
          }
        });
      };
      
      // 首先处理簇节点，然后处理其他节点
      clusterNodes.forEach(node => adjustPosition(node.id));
      nodes.filter(n => n.category !== 'cluster').forEach(node => adjustPosition(node.id));
    }
    
    // 确保所有节点都在画布范围内
    const padding = 20;
    Object.keys(positions).forEach(nodeId => {
      const pos = positions[nodeId];
      pos.x = Math.max(padding, Math.min(width - padding, pos.x));
      pos.y = Math.max(padding, Math.min(height - padding, pos.y));
    });
    
    // 首先绘制连接
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    links.forEach(link => {
      const sourcePos = positions[link.source];
      const targetPos = positions[link.target];
      
      if (!sourcePos || !targetPos) return;
      
      // 绘制发光效果背景线
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.15)';
      ctx.lineWidth = 5;
      ctx.moveTo(sourcePos.x, sourcePos.y);
      ctx.lineTo(targetPos.x, targetPos.y);
      ctx.stroke();
      
      // 绘制主线
      ctx.beginPath();
      ctx.strokeStyle = link.type === 'contains' ? 'rgba(150, 200, 255, 0.8)' : 'rgba(255, 180, 100, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.moveTo(sourcePos.x, sourcePos.y);
      ctx.lineTo(targetPos.x, targetPos.y);
      ctx.stroke();
    });
    
    // 然后绘制节点
    nodes.forEach(node => {
      const pos = positions[node.id];
      if (!pos) return;
      
      const radius = getNodeSize(node);
      
      // 绘制节点
      ctx.beginPath();
      ctx.fillStyle = getNodeColor(node);
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // 绘制边框
      ctx.beginPath();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // 绘制标签 (仅主题节点有标签)
      if (node.category === 'cluster') {
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 0.5;
        ctx.strokeText(node.label, pos.x + radius + 3, pos.y + 4);
        ctx.fillText(node.label, pos.x + radius + 3, pos.y + 4);
      }
    });
    
    // 绘制完成，更新状态
    setIsLoading(false);
    
    // 处理点击事件 - 只有当onNodeClick存在时
    if (onNodeClick) {
      const handleClick = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 检查是否点击了节点
        for (const node of nodes) {
          const pos = positions[node.id];
          if (!pos) continue;
          
          const radius = getNodeSize(node);
          const dx = pos.x - x;
          const dy = pos.y - y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance <= radius) {
            onNodeClick(node.id);
            break;
          }
        }
      };
      
      canvas.addEventListener('click', handleClick);
      
      return () => {
        canvas.removeEventListener('click', handleClick);
      };
    }
  }, [nodes, links, width, height, onNodeClick]);
  
  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = width;
        canvasRef.current.height = height;
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [width, height]);
  
  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-lg">
          <div className="text-lg text-blue-400 font-medium">加载知识图谱中...</div>
        </div>
      )}
      <canvas 
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full"
      />
      
      {/* 图例 */}
      <div className="absolute bottom-2 left-2 z-10 flex flex-col gap-1 bg-gray-900/50 p-2 rounded text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-white/80">主题</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-white/80">关键词</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span className="text-white/80">记忆</span>
        </div>
      </div>
    </div>
  );
};

export default QuickGraphView;