import React, { useEffect, useRef } from 'react';

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
}

interface StaticKnowledgeGraphProps {
  nodes: SimpleNode[];
  links: SimpleLink[];
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
}

/**
 * 静态知识图谱组件
 * 使用预先计算好的布局，不使用复杂的力导向计算
 */
const StaticKnowledgeGraph: React.FC<StaticKnowledgeGraphProps> = ({
  nodes,
  links,
  width = 800,
  height = 600,
  onNodeClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // 渲染图谱
  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 设置画布大小
    canvas.width = width;
    canvas.height = height;
    
    // 清除画布
    ctx.clearRect(0, 0, width, height);
    
    // 计算布局 - 使用简单的几何布局
    const centerX = width / 2;
    const centerY = height / 2;
    const positions: {[key: string]: {x: number, y: number}} = {};
    
    // 将节点分成三类
    const clusterNodes = nodes.filter(n => n.category === 'cluster');
    const keywordNodes = nodes.filter(n => n.category === 'keyword');
    const memoryNodes = nodes.filter(n => n.category === 'memory');
    
    // 布局策略: 簇节点放在中心，关键词和记忆节点围绕相关的簇布局
    
    // 1. 放置簇节点（主题）
    const radius = Math.min(width, height) * 0.25;
    const clusterAngle = (2 * Math.PI) / Math.max(clusterNodes.length, 1);
    
    clusterNodes.forEach((node, i) => {
      // 将簇节点放在一个圆上
      const angle = i * clusterAngle;
      positions[node.id] = {
        x: centerX + Math.cos(angle) * radius * 0.6,
        y: centerY + Math.sin(angle) * radius * 0.6
      };
    });
    
    // 2. 放置关键词节点
    const keywordRadius = radius * 1.2;
    keywordNodes.forEach((node, i) => {
      const angle = i * (2 * Math.PI / Math.max(keywordNodes.length, 1));
      positions[node.id] = {
        x: centerX + Math.cos(angle) * keywordRadius,
        y: centerY + Math.sin(angle) * keywordRadius
      };
    });
    
    // 3. 放置记忆节点 - 尝试放在与之相连的簇附近
    memoryNodes.forEach((node, i) => {
      // 查找连接到此节点的簇
      let connectedCluster = null;
      for (const link of links) {
        if (link.target === node.id) {
          const sourceNode = nodes.find(n => n.id === link.source);
          if (sourceNode?.category === 'cluster') {
            connectedCluster = sourceNode;
            break;
          }
        } else if (link.source === node.id) {
          const targetNode = nodes.find(n => n.id === link.target);
          if (targetNode?.category === 'cluster') {
            connectedCluster = targetNode;
            break;
          }
        }
      }
      
      if (connectedCluster && positions[connectedCluster.id]) {
        // 放在关联的簇附近
        const clusterPos = positions[connectedCluster.id];
        const angle = (i % 8) * (Math.PI / 4); // 将节点均匀分布在簇周围
        const nodeRadius = radius * 0.8;
        
        positions[node.id] = {
          x: clusterPos.x + Math.cos(angle) * nodeRadius,
          y: clusterPos.y + Math.sin(angle) * nodeRadius
        };
      } else {
        // 如果没有关联的簇，放在外圈
        const angle = i * (2 * Math.PI / Math.max(memoryNodes.length, 1));
        const outerRadius = radius * 1.5;
        
        positions[node.id] = {
          x: centerX + Math.cos(angle) * outerRadius,
          y: centerY + Math.sin(angle) * outerRadius
        };
      }
    });
    
    // 4. 简单的碰撞检测和调整
    const minDistance = 40; // 最小节点间距
    for (let i = 0; i < 3; i++) { // 简单迭代几次
      Object.keys(positions).forEach(nodeId1 => {
        Object.keys(positions).forEach(nodeId2 => {
          if (nodeId1 === nodeId2) return;
          
          const pos1 = positions[nodeId1];
          const pos2 = positions[nodeId2];
          
          const dx = pos1.x - pos2.x;
          const dy = pos1.y - pos2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < minDistance) {
            const angle = Math.atan2(dy, dx);
            const adjustment = (minDistance - distance) / 2;
            
            positions[nodeId1] = {
              x: pos1.x + Math.cos(angle) * adjustment,
              y: pos1.y + Math.sin(angle) * adjustment
            };
            
            positions[nodeId2] = {
              x: pos2.x - Math.cos(angle) * adjustment,
              y: pos2.y - Math.sin(angle) * adjustment
            };
          }
        });
      });
    }
    
    // 确保所有节点都在画布范围内
    const padding = 30;
    Object.keys(positions).forEach(nodeId => {
      positions[nodeId] = {
        x: Math.max(padding, Math.min(width - padding, positions[nodeId].x)),
        y: Math.max(padding, Math.min(height - padding, positions[nodeId].y))
      };
    });
    
    // 绘制图谱
    // 1. 首先绘制连接线
    links.forEach(link => {
      const sourcePos = positions[link.source];
      const targetPos = positions[link.target];
      
      if (!sourcePos || !targetPos) return;
      
      // 绘制连接线发光效果
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.2)';
      ctx.lineWidth = 5;
      ctx.moveTo(sourcePos.x, sourcePos.y);
      ctx.lineTo(targetPos.x, targetPos.y);
      ctx.stroke();
      
      // 绘制主连接线
      ctx.beginPath();
      ctx.strokeStyle = link.type === 'contains' ? 'rgba(100, 150, 255, 0.8)' : 'rgba(255, 170, 100, 0.8)';
      ctx.lineWidth = 2;
      ctx.moveTo(sourcePos.x, sourcePos.y);
      ctx.lineTo(targetPos.x, targetPos.y);
      ctx.stroke();
    });
    
    // 2. 然后绘制节点
    nodes.forEach(node => {
      const pos = positions[node.id];
      if (!pos) return;
      
      // 根据节点类型确定大小和颜色
      let size = 10;
      let color = '#6366f1'; // 默认紫色
      
      if (node.category === 'cluster') {
        size = 20;
        color = '#3b82f6'; // 蓝色
      } else if (node.category === 'keyword') {
        size = 12;
        color = '#10b981'; // 绿色
      } else if (node.category === 'memory') {
        size = 8;
        color = '#f59e0b'; // 橙色
      }
      
      // 应用节点自定义尺寸（如有）
      if (node.size) {
        // 对尺寸进行一些归一化处理，避免节点过大或过小
        const normalizedSize = Math.max(5, Math.min(30, node.size / 5));
        if (node.category === 'cluster') {
          size = normalizedSize * 1.5;
        } else {
          size = normalizedSize;
        }
      }
      
      // 绘制节点圆形
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.fill();
      
      // 绘制边框
      ctx.beginPath();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1.5;
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.stroke();
      
      // 只给簇节点和关键词节点绘制标签
      if (node.category === 'cluster' || node.category === 'keyword') {
        ctx.font = node.category === 'cluster' ? 'bold 14px Arial' : '12px Arial';
        
        // 文本阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillText(node.label, pos.x + size + 3, pos.y + 3);
        
        // 文本主体
        ctx.fillStyle = 'white';
        ctx.fillText(node.label, pos.x + size + 2, pos.y + 2);
      }
    });
    
    // 绘制图例
    const drawLegend = () => {
      const legendX = 20;
      let legendY = height - 90;
      const legendSpacing = 20;
      
      // 添加半透明背景
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(legendX - 10, legendY - 15, 120, 85);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px Arial';
      ctx.fillText('图例:', legendX, legendY);
      
      // 主题
      legendY += legendSpacing;
      ctx.beginPath();
      ctx.fillStyle = '#3b82f6';
      ctx.arc(legendX + 6, legendY - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.fillText('主题', legendX + 18, legendY);
      
      // 关键词
      legendY += legendSpacing;
      ctx.beginPath();
      ctx.fillStyle = '#10b981';
      ctx.arc(legendX + 6, legendY - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.fillText('关键词', legendX + 18, legendY);
      
      // 记忆
      legendY += legendSpacing;
      ctx.beginPath();
      ctx.fillStyle = '#f59e0b';
      ctx.arc(legendX + 6, legendY - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.fillText('记忆', legendX + 18, legendY);
    };
    
    drawLegend();
    
    // 添加点击事件处理
    if (onNodeClick) {
      const handleClick = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        // 检查是否点击了节点
        for (const node of nodes) {
          const pos = positions[node.id];
          if (!pos) continue;
          
          // 获取节点半径
          let radius = 10;
          if (node.category === 'cluster') radius = 20;
          else if (node.category === 'keyword') radius = 12;
          else if (node.category === 'memory') radius = 8;
          
          // 自定义尺寸
          if (node.size) {
            const normalizedSize = Math.max(5, Math.min(30, node.size / 5));
            if (node.category === 'cluster') {
              radius = normalizedSize * 1.5;
            } else {
              radius = normalizedSize;
            }
          }
          
          // 检查点击是否在节点内
          const dx = pos.x - clickX;
          const dy = pos.y - clickY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance <= radius) {
            onNodeClick(node.id);
            return;
          }
        }
      };
      
      canvas.addEventListener('click', handleClick);
      
      return () => {
        canvas.removeEventListener('click', handleClick);
      };
    }
  }, [nodes, links, width, height, onNodeClick]);
  
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