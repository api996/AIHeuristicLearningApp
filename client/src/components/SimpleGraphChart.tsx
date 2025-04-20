import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

// 简化的节点接口
interface Node {
  id: string;
  label: string;
  color?: string;
  size?: number;
  category?: string;
}

// 简化的连接接口
interface Link {
  source: string;
  target: string;
  color?: string;
  value?: number;
}

interface SimpleGraphChartProps {
  nodes: Node[];
  links: Link[];
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
  zoomLevel?: number;
  isFullScreen?: boolean;
}

/**
 * 简化的知识图谱组件 - 不依赖D3.js
 * 直接使用Canvas实现高性能渲染
 */
const SimpleGraphChart: React.FC<SimpleGraphChartProps> = ({
  nodes,
  links,
  width = 800,
  height = 600,
  onNodeClick,
  zoomLevel = 1,
  isFullScreen = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNodeIndex, setDraggedNodeIndex] = useState<number | null>(null);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(zoomLevel);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // 模拟节点位置的状态
  const [nodePositions, setNodePositions] = useState<{x: number, y: number, vx: number, vy: number}[]>([]);
  
  // 根据类别定义颜色
  const getCategoryColor = (category?: string) => {
    if (category === 'cluster') return '#3b82f6'; // 蓝色
    if (category === 'keyword') return '#10b981'; // 绿色
    if (category === 'memory') return '#f59e0b';  // 橙色
    return '#6366f1'; // 默认紫色
  };
  
  // 根据类别定义节点大小
  const getNodeSize = (category?: string, size?: number) => {
    const baseSize = size || 10;
    if (category === 'cluster') return baseSize * 1.5;
    if (category === 'keyword') return baseSize * 1.2;
    return baseSize;
  };

  // 初始化节点位置
  useEffect(() => {
    if (!nodes.length) return;
    
    // 使用黄金角分布计算初始位置
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;
    
    const newPositions = nodes.map((node, i) => {
      // 根据类别和索引计算角度
      let angleOffset = 0;
      if (node.category === 'cluster') angleOffset = 0;
      else if (node.category === 'keyword') angleOffset = 2;
      else angleOffset = 4;
      
      // 黄金角分布
      const angle = (i * 0.618033988749895 + angleOffset) * Math.PI * 2;
      
      // 计算距离
      let distance = radius;
      if (node.category === 'cluster') distance *= 0.5; // 集群靠近中心
      
      // 计算位置
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      
      return { 
        x, y, 
        vx: 0, 
        vy: 0 
      };
    });
    
    setNodePositions(newPositions);
    setIsLoading(false);
  }, [nodes, width, height]);

  // 力导向模拟
  useEffect(() => {
    if (!nodes.length || !nodePositions.length || nodePositions.length !== nodes.length) return;
    
    // 力导向参数
    const repulsionStrength = 500; // 排斥力强度
    const springLength = 100;      // 弹簧自然长度
    const springStrength = 0.05;   // 弹簧强度
    const damping = 0.8;           // 阻尼系数
    const centerStrength = 0.01;   // 中心引力强度
    
    // 力导向模拟
    const simulation = () => {
      // 复制当前位置状态
      const newPositions = [...nodePositions];
      
      // 更新每个节点位置
      for (let i = 0; i < nodes.length; i++) {
        // 跳过正在拖拽的节点
        if (isDragging && draggedNodeIndex === i) continue;
        
        // 重置力
        let fx = 0, fy = 0;
        
        // 排斥力 (节点间)
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          
          const dx = newPositions[i].x - newPositions[j].x;
          const dy = newPositions[i].y - newPositions[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          // 添加一个最小距离避免除零错误
          const minDistance = Math.max(1, getNodeSize(nodes[i].category, nodes[i].size) + 
                                         getNodeSize(nodes[j].category, nodes[j].size));
          
          if (distance < minDistance * 2) {
            const strength = repulsionStrength / (distance * distance);
            fx += (dx / distance) * strength;
            fy += (dy / distance) * strength;
          }
        }
        
        // 弹簧力 (连接)
        for (const link of links) {
          // 安全地获取source和target ID
          const sourceId = typeof link.source === 'string' ? link.source : 
                         (typeof link.source === 'object' && link.source && 'id' in link.source) ? link.source.id as string : '';
          const targetId = typeof link.target === 'string' ? link.target : 
                         (typeof link.target === 'object' && link.target && 'id' in link.target) ? link.target.id as string : '';
          
          if (sourceId === nodes[i].id) {
            const targetIndex = nodes.findIndex(node => node.id === targetId);
            if (targetIndex >= 0) {
              const dx = newPositions[i].x - newPositions[targetIndex].x;
              const dy = newPositions[i].y - newPositions[targetIndex].y;
              const distance = Math.sqrt(dx * dx + dy * dy) || 1;
              
              fx -= (dx / distance) * (distance - springLength) * springStrength;
              fy -= (dy / distance) * (distance - springLength) * springStrength;
            }
          } else if (targetId === nodes[i].id) {
            const sourceIndex = nodes.findIndex(node => node.id === sourceId);
            if (sourceIndex >= 0) {
              const dx = newPositions[i].x - newPositions[sourceIndex].x;
              const dy = newPositions[i].y - newPositions[sourceIndex].y;
              const distance = Math.sqrt(dx * dx + dy * dy) || 1;
              
              fx -= (dx / distance) * (distance - springLength) * springStrength;
              fy -= (dy / distance) * (distance - springLength) * springStrength;
            }
          }
        }
        
        // 中心引力
        const centerX = width / 2;
        const centerY = height / 2;
        fx += (centerX - newPositions[i].x) * centerStrength;
        fy += (centerY - newPositions[i].y) * centerStrength;
        
        // 类别特定行为
        if (nodes[i].category === 'cluster') {
          // 集群节点强烈吸引到中心
          fx += (centerX - newPositions[i].x) * centerStrength * 3;
          fy += (centerY - newPositions[i].y) * centerStrength * 3;
        }
        
        // 更新速度 (带阻尼)
        newPositions[i].vx = (newPositions[i].vx + fx) * damping;
        newPositions[i].vy = (newPositions[i].vy + fy) * damping;
        
        // 更新位置
        newPositions[i].x += newPositions[i].vx;
        newPositions[i].y += newPositions[i].vy;
        
        // 限制在画布内
        newPositions[i].x = Math.max(10, Math.min(width - 10, newPositions[i].x));
        newPositions[i].y = Math.max(10, Math.min(height - 10, newPositions[i].y));
      }
      
      // 更新状态
      setNodePositions(newPositions);
    };
    
    // 启动模拟
    const intervalId = setInterval(simulation, 16); // ~60fps
    
    // 10秒后降低更新频率以节省性能
    const slowDownId = setTimeout(() => {
      clearInterval(intervalId);
      setInterval(simulation, 100); // 降低到10fps
    }, 5000);
    
    return () => {
      clearInterval(intervalId);
      clearTimeout(slowDownId);
    };
  }, [nodes, links, nodePositions, width, height, isDragging, draggedNodeIndex]);

  // 绘制图形
  useEffect(() => {
    if (!canvasRef.current || !nodes.length || !nodePositions.length) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 应用缩放和平移
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(scale, scale);
    
    // 绘制连接线
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    for (const link of links) {
      // 安全地获取source和target ID
      const sourceId = typeof link.source === 'string' ? link.source : 
                     (typeof link.source === 'object' && link.source && 'id' in link.source) ? link.source.id as string : '';
      const targetId = typeof link.target === 'string' ? link.target : 
                     (typeof link.target === 'object' && link.target && 'id' in link.target) ? link.target.id as string : '';
      
      const sourceIndex = nodes.findIndex(node => node.id === sourceId);
      const targetIndex = nodes.findIndex(node => node.id === targetId);
      
      if (sourceIndex >= 0 && targetIndex >= 0) {
        const sourcePos = nodePositions[sourceIndex];
        const targetPos = nodePositions[targetIndex];
        
        // 绘制发光效果
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(100, 180, 255, 0.2)';
        ctx.lineWidth = 4;
        ctx.moveTo(sourcePos.x, sourcePos.y);
        ctx.lineTo(targetPos.x, targetPos.y);
        ctx.stroke();
        
        // 绘制主线
        ctx.beginPath();
        ctx.strokeStyle = link.color || 'rgba(150, 200, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.moveTo(sourcePos.x, sourcePos.y);
        ctx.lineTo(targetPos.x, targetPos.y);
        ctx.stroke();
      }
    }
    
    // 绘制节点
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const pos = nodePositions[i];
      
      // 确定节点大小和颜色
      const size = getNodeSize(node.category, node.size);
      const color = node.color || getCategoryColor(node.category);
      
      // 绘制节点
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
      
      // 绘制标签
      ctx.font = '12px Arial';
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 0.5;
      ctx.strokeText(node.label, pos.x + size + 5, pos.y + 4);
      ctx.fillText(node.label, pos.x + size + 5, pos.y + 4);
    }
    
    ctx.restore();
  }, [nodes, links, nodePositions, scale, pan, width, height]);

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

  // 处理鼠标事件
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    
    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / scale;
      const y = (e.clientY - rect.top - pan.y) / scale;
      
      // 检查是否点击了节点
      for (let i = 0; i < nodes.length; i++) {
        const pos = nodePositions[i];
        const size = getNodeSize(nodes[i].category, nodes[i].size);
        
        const dx = pos.x - x;
        const dy = pos.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= size) {
          setIsDragging(true);
          setDraggedNodeIndex(i);
          setLastMousePos({ x: e.clientX, y: e.clientY });
          return;
        }
      }
      
      // 如果没有点击节点，则平移整个图表
      setIsDragging(true);
      setDraggedNodeIndex(null);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      
      if (draggedNodeIndex !== null) {
        // 拖动节点
        setNodePositions(prev => {
          const newPositions = [...prev];
          
          // 更新位置
          const rect = canvas.getBoundingClientRect();
          newPositions[draggedNodeIndex].x = (e.clientX - rect.left - pan.x) / scale;
          newPositions[draggedNodeIndex].y = (e.clientY - rect.top - pan.y) / scale;
          
          // 重置速度
          newPositions[draggedNodeIndex].vx = 0;
          newPositions[draggedNodeIndex].vy = 0;
          
          return newPositions;
        });
      } else {
        // 平移整个图表
        setPan(prev => ({
          x: prev.x + dx,
          y: prev.y + dy
        }));
      }
      
      setLastMousePos({ x: e.clientX, y: e.clientY });
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (isDragging && draggedNodeIndex !== null && onNodeClick) {
        // 检查是否是点击而不是拖动
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        const moveDistance = Math.sqrt(dx * dx + dy * dy);
        
        if (moveDistance < 5) {
          // 认为是点击事件
          onNodeClick(nodes[draggedNodeIndex].id);
        }
      }
      
      setIsDragging(false);
      setDraggedNodeIndex(null);
    };
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      // 计算新缩放比例
      const delta = -e.deltaY * 0.01;
      const newScale = Math.max(0.1, Math.min(5, scale + delta));
      
      // 获取鼠标相对于画布的位置
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // 计算新的平移值，使缩放以鼠标位置为中心
      const newPan = {
        x: x - (x - pan.x) * (newScale / scale),
        y: y - (y - pan.y) * (newScale / scale)
      };
      
      setScale(newScale);
      setPan(newPan);
    };
    
    // 添加事件监听器
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    
    // 移动端触摸事件
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = (touch.clientX - rect.left - pan.x) / scale;
        const y = (touch.clientY - rect.top - pan.y) / scale;
        
        // 检查是否触摸了节点
        for (let i = 0; i < nodes.length; i++) {
          const pos = nodePositions[i];
          const size = getNodeSize(nodes[i].category, nodes[i].size);
          
          const dx = pos.x - x;
          const dy = pos.y - y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance <= size) {
            setIsDragging(true);
            setDraggedNodeIndex(i);
            setLastMousePos({ x: touch.clientX, y: touch.clientY });
            return;
          }
        }
        
        // 如果没有触摸节点，则平移整个图表
        setIsDragging(true);
        setDraggedNodeIndex(null);
        setLastMousePos({ x: touch.clientX, y: touch.clientY });
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      e.preventDefault();
      
      const touch = e.touches[0];
      const dx = touch.clientX - lastMousePos.x;
      const dy = touch.clientY - lastMousePos.y;
      
      if (draggedNodeIndex !== null) {
        // 拖动节点
        setNodePositions(prev => {
          const newPositions = [...prev];
          
          // 更新位置
          const rect = canvas.getBoundingClientRect();
          newPositions[draggedNodeIndex].x = (touch.clientX - rect.left - pan.x) / scale;
          newPositions[draggedNodeIndex].y = (touch.clientY - rect.top - pan.y) / scale;
          
          // 重置速度
          newPositions[draggedNodeIndex].vx = 0;
          newPositions[draggedNodeIndex].vy = 0;
          
          return newPositions;
        });
      } else {
        // 平移整个图表
        setPan(prev => ({
          x: prev.x + dx,
          y: prev.y + dy
        }));
      }
      
      setLastMousePos({ x: touch.clientX, y: touch.clientY });
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      if (isDragging && draggedNodeIndex !== null && onNodeClick) {
        // 如果是短暂触摸，视为点击
        onNodeClick(nodes[draggedNodeIndex].id);
      }
      
      setIsDragging(false);
      setDraggedNodeIndex(null);
    };
    
    // 添加触摸事件监听器
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      // 移除事件监听器
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [nodes, links, nodePositions, scale, pan, isDragging, draggedNodeIndex, lastMousePos, onNodeClick]);

  // 应用缩放级别
  useEffect(() => {
    setScale(zoomLevel);
  }, [zoomLevel]);

  // 刷新图表
  const refreshGraph = () => {
    // 重置缩放和平移
    setScale(1);
    setPan({ x: 0, y: 0 });
    
    // 重新计算节点位置
    if (nodes.length) {
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.35;
      
      const newPositions = nodes.map((node, i) => {
        // 根据类别和索引计算角度
        let angleOffset = 0;
        if (node.category === 'cluster') angleOffset = 0;
        else if (node.category === 'keyword') angleOffset = 2;
        else angleOffset = 4;
        
        // 黄金角分布
        const angle = (i * 0.618033988749895 + angleOffset) * Math.PI * 2;
        
        // 计算距离
        let distance = radius;
        if (node.category === 'cluster') distance *= 0.5; // 集群靠近中心
        
        // 计算位置
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        
        return { 
          x, y, 
          vx: 0, 
          vy: 0 
        };
      });
      
      setNodePositions(newPositions);
    }
  };

  // 错误状态
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <p className="text-red-500 mb-2">图谱渲染错误</p>
        <p className="text-sm text-gray-400">{error}</p>
        <button 
          className="mt-4 px-3 py-1 bg-blue-500 text-white rounded-md text-sm"
          onClick={refreshGraph}
        >
          重试
        </button>
      </div>
    );
  }

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-black/10 rounded-lg">
        <div className="animate-pulse bg-blue-500/20 p-5 rounded-full mb-4">
          <svg className="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p className="text-lg text-blue-400 font-medium">正在加载知识图谱...</p>
        <p className="text-sm text-white/70 max-w-xs mx-auto mt-2 text-center">
          正在计算节点位置和关系，这可能需要几秒钟
        </p>
      </div>
    );
  }

  // 空数据状态
  if (!nodes.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <p className="text-neutral-300">暂无知识图谱数据</p>
      </div>
    );
  }

  // 渲染图表
  return (
    <div 
      ref={containerRef}
      className={`knowledge-graph-container ${isFullScreen ? 'fullscreened-graph' : ''}`}
      style={{
        width: '100%', 
        height: '100%',
        maxWidth: '100%',
        maxHeight: isFullScreen ? '100vh' : '70vh',
        touchAction: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        overflow: 'hidden',
        position: 'relative',
        borderRadius: '0.5rem'
      }}
    >
      <canvas 
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: '100%',
          height: '100%'
        }}
      />
      
      {/* 控制按钮 */}
      <div className="absolute top-2 right-2 z-10">
        <button 
          className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-white rounded-full"
          onClick={refreshGraph}
          title="刷新图谱"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      
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

export default SimpleGraphChart;