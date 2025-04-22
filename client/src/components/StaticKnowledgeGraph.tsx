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

interface GraphTransform {
  translateX: number;
  translateY: number;
  scale: number;
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
  
  // 加载状态
  const [isInitializing, setIsInitializing] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // 使用节点数量状态来解决循环依赖问题
  const [nodeCount, setNodeCount] = useState(0);

  // 在初始渲染后平滑过渡到显示图谱，但确保数据完全加载
  useEffect(() => {
    // 使用节点数量作为触发条件
    if (nodes.length === 0) {
      // 如果没有数据，保持加载状态
      setIsInitializing(true);
      return;
    }
    
    // 设置节点数量以便后续效果使用
    setNodeCount(nodes.length);
    
    console.log("知识图谱节点数据已加载，启动渐变动画:", nodes.length, "个节点");
    
    // 创建进度动画
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        const newProgress = prev + 2;
        return newProgress > 100 ? 100 : newProgress;
      });
    }, 20);
    
    // 当节点加载完毕且进度达到100%时，取消加载状态
    const timer = setTimeout(() => {
      clearInterval(progressInterval);
      setLoadingProgress(100);
      
      // 再等待短暂时间确保进度动画完成，然后显示图谱
      setTimeout(() => {
        console.log("知识图谱加载动画完成，开始渲染图谱");
        setIsInitializing(false);
      }, 200);
    }, 800);
    
    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [nodes.length]); // 依赖于原始节点数据的变化，而不是处理后的
  
  // 添加拖动和缩放状态
  const [transform, setTransform] = useState<GraphTransform>({
    translateX: 0,
    translateY: 0,
    scale: 1
  });
  
  // 存储拖动状态
  const dragRef = useRef({
    isDragging: false,
    lastX: 0,
    lastY: 0
  });
  
  // 用于在渲染循环中应用当前的变换
  const currentTransformRef = useRef(transform);
  
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
  
  // 更新当前变换的引用
  useEffect(() => {
    currentTransformRef.current = transform;
  }, [transform]);
  
  // 计算节点大小 - 增大节点尺寸以适应文本显示
  const getNodeSize = (node: SimpleNode): number => {
    let baseSize = 10; // 默认大小
    
    // 增大主题节点尺寸，以便直接在节点上显示文本
    if (node.category === 'cluster') baseSize = 35; // 显著增大主题节点
    else if (node.category === 'keyword') baseSize = 20;
    else if (node.category === 'memory') baseSize = 10;
    
    // 如果有自定义尺寸，应用合理的缩放
    if (node.size) {
      const scaleFactor = node.category === 'cluster' ? 0.3 : 
                         node.category === 'keyword' ? 0.2 : 0.1;
      
      // 限制节点尺寸范围，但保持最小尺寸较大
      return Math.max(
        baseSize * 0.7, 
        Math.min(baseSize * 2, node.size * scaleFactor)
      );
    }
    
    return baseSize;
  };
  
  // 鼠标和触摸事件处理 - 增加拖拽和缩放功能
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    
    // 获取变换后的鼠标坐标
    const getTransformedCoordinates = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      
      // 应用反向变换以获取实际坐标
      const inverseScale = 1 / transform.scale;
      const transformedX = (x - transform.translateX) * inverseScale;
      const transformedY = (y - transform.translateY) * inverseScale;
      
      return { x: transformedX, y: transformedY };
    };
    
    // 鼠标移动处理
    const handleMouseMove = (e: MouseEvent) => {
      const { x: mouseX, y: mouseY } = getTransformedCoordinates(e.clientX, e.clientY);
      
      // 检查是否在拖动中
      if (dragRef.current.isDragging) {
        const dx = e.clientX - dragRef.current.lastX;
        const dy = e.clientY - dragRef.current.lastY;
        
        // 更新上次位置
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
        
        // 更新平移
        setTransform(prev => ({
          ...prev,
          translateX: prev.translateX + dx,
          translateY: prev.translateY + dy
        }));
        
        return;
      }
      
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
        canvas.style.cursor = dragRef.current.isDragging ? 'grabbing' : 'grab'; // 更改光标样式
      }
      
      setHoveredNode(foundNode);
    };
    
    // 鼠标点击处理
    const handleClick = (e: MouseEvent) => {
      // 只有非拖动状态下才处理点击
      if (dragRef.current.isDragging) return;
      
      if (!onNodeClick) return;
      
      const { x: clickX, y: clickY } = getTransformedCoordinates(e.clientX, e.clientY);
      
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
    
    // 鼠标按下事件 - 启动拖动
    const handleMouseDown = (e: MouseEvent) => {
      // 检查是否点击在节点上，如果是则不启动拖动
      const { x: mouseX, y: mouseY } = getTransformedCoordinates(e.clientX, e.clientY);
      
      // 检查是否点击在节点上
      for (const node of processedNodes) {
        const pos = positions[node.id];
        if (!pos) continue;
        
        const size = getNodeSize(node);
        const dx = pos.x - mouseX;
        const dy = pos.y - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= size + 5) {
          // 点击在节点上，不启动拖动
          return;
        }
      }
      
      // 启动拖动
      dragRef.current = {
        isDragging: true,
        lastX: e.clientX,
        lastY: e.clientY
      };
      
      canvas.style.cursor = 'grabbing';
    };
    
    // 鼠标释放事件 - 结束拖动
    const handleMouseUp = () => {
      dragRef.current.isDragging = false;
      canvas.style.cursor = 'grab';
    };
    
    // 鼠标离开事件 - 结束拖动
    const handleMouseLeave = () => {
      dragRef.current.isDragging = false;
      canvas.style.cursor = 'grab';
    };
    
    // 鼠标滚轮事件 - 处理缩放
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      // 获取鼠标在缩放前的坐标
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // 根据滚轮方向确定缩放方向
      const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.max(0.1, Math.min(5, transform.scale * scaleFactor));
      
      // 根据鼠标位置调整平移量，使缩放中心在鼠标位置
      const oldScale = transform.scale;
      const newTranslateX = transform.translateX + (mouseX - transform.translateX) * (1 - newScale / oldScale);
      const newTranslateY = transform.translateY + (mouseY - transform.translateY) * (1 - newScale / oldScale);
      
      setTransform({
        scale: newScale,
        translateX: newTranslateX,
        translateY: newTranslateY
      });
    };
    
    // 触摸事件处理
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        // 单指触摸 - 开始拖动
        const touch = e.touches[0];
        
        // 检查是否点击在节点上，如果是则不启动拖动
        const { x: touchX, y: touchY } = getTransformedCoordinates(touch.clientX, touch.clientY);
        
        // 检查是否点击在节点上
        for (const node of processedNodes) {
          const pos = positions[node.id];
          if (!pos) continue;
          
          const size = getNodeSize(node);
          const dx = pos.x - touchX;
          const dy = pos.y - touchY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance <= size + 5) {
            // 点击在节点上，不启动拖动
            return;
          }
        }
        
        dragRef.current = {
          isDragging: true,
          lastX: touch.clientX,
          lastY: touch.clientY
        };
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // 防止页面滚动
      
      if (e.touches.length === 1 && dragRef.current.isDragging) {
        // 单指触摸 - 拖动
        const touch = e.touches[0];
        
        const dx = touch.clientX - dragRef.current.lastX;
        const dy = touch.clientY - dragRef.current.lastY;
        
        // 更新上次位置
        dragRef.current.lastX = touch.clientX;
        dragRef.current.lastY = touch.clientY;
        
        // 更新平移
        setTransform(prev => ({
          ...prev,
          translateX: prev.translateX + dx,
          translateY: prev.translateY + dy
        }));
      } else if (e.touches.length === 2) {
        // 双指触摸 - 缩放 (简化实现)
        // 这里可以添加更复杂的手势处理
      }
    };
    
    const handleTouchEnd = () => {
      // 触摸结束
      dragRef.current.isDragging = false;
    };
    
    // 添加所有事件监听器
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('wheel', handleWheel);
    
    // 触摸事件
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      // 移除所有事件监听器
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('wheel', handleWheel);
      
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [processedNodes, positions, hoveredNode, onNodeClick, transform]);
  
  // 创建渲染动画循环
  useEffect(() => {
    if (!canvasRef.current || processedNodes.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 设置高DPI画布以获得更清晰的渲染
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    // 绘制加载动画函数
    const drawLoadingIndicator = () => {
      if (!ctx) return;
      
      // 清除画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 保存当前状态并应用DPI缩放
      ctx.save();
      ctx.scale(dpr, dpr);
      
      // 绘制半透明背景
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.fillRect(0, 0, width, height);
      
      // 绘制进度条背景
      const barWidth = width * 0.4;
      const barHeight = 8;
      const barX = (width - barWidth) / 2;
      const barY = height / 2 + 40;
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barWidth, barHeight, 4);
      ctx.fill();
      
      // 绘制进度条
      const progressWidth = (loadingProgress / 100) * barWidth;
      const gradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
      gradient.addColorStop(0, '#3b82f6');
      gradient.addColorStop(1, '#8b5cf6');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(barX, barY, progressWidth, barHeight, 4);
      ctx.fill();
      
      // 绘制加载文本
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.font = '16px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('正在加载知识图谱', width / 2, height / 2 - 20);
      
      // 绘制性能提示
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '13px Inter, system-ui, sans-serif';
      ctx.fillText(`优化的3072维向量聚类`, width / 2, height / 2 + 10);
      
      // 绘制进度百分比
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.fillText(`${loadingProgress}%`, width / 2, height / 2 + 65);
      
      // 绘制周围的装饰性粒子
      const time = Date.now() / 1000;
      for (let i = 0; i < 8; i++) {
        const angle = time * 1.5 + (i * Math.PI / 4);
        const radius = 60 + Math.sin(time * 2) * 5;
        const x = width / 2 + Math.cos(angle) * radius;
        const y = height / 2 - 60 + Math.sin(angle) * radius * 0.5;
        
        const particleSize = 4 + Math.sin(time * 3 + i) * 2;
        const alpha = 0.5 + Math.sin(time * 2 + i) * 0.3;
        
        ctx.fillStyle = `hsla(${i * 45}, 80%, 60%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, particleSize, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    };
    
    // 缩放上下文以匹配DPI
    ctx.scale(dpr, dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    
    // 创建渲染函数 - 支持变换和缩放
    const render = () => {
      // 清除画布
      ctx.clearRect(0, 0, width, height);
      
      // 应用变换
      const { translateX, translateY, scale } = currentTransformRef.current;
      
      // 保存当前上下文状态
      ctx.save();
      
      // 应用平移和缩放
      ctx.translate(translateX, translateY);
      ctx.scale(scale, scale);
      
      // 如果在初始化状态，绘制加载动画，但最多显示2秒
      // 这样可以确保即使数据还没完全准备好，界面也能响应
      if (isInitializing && loadingProgress < 95) {
        drawLoadingIndicator();
        // 强制继续渲染图形，确保不会卡在加载画面
        setTimeout(() => {
          if (canvasRef.current) {
            setIsInitializing(false);
          }
        }, 2000);
      }
      
      // 绘制图谱背景 - 添加渐变和网格
      const drawBackground = () => {
        // 创建渐变背景 - 根据当前变换调整位置
        const centerX = (width / 2 - translateX) / scale;
        const centerY = (height / 2 - translateY) / scale;
        const gradientRadius = Math.max(width, height) / scale;
        
        const gradient = ctx.createRadialGradient(
          centerX, centerY, 10 / scale,
          centerX, centerY, gradientRadius
        );
        gradient.addColorStop(0, 'rgba(30, 41, 59, 0.4)');
        gradient.addColorStop(1, 'rgba(15, 23, 42, 0.6)');
        
        // 填充背景
        ctx.fillStyle = gradient;
        ctx.fillRect(-translateX / scale, -translateY / scale, width / scale, height / scale);
        
        // 添加微妙的网格线 - 考虑变换
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.05)';
        ctx.lineWidth = 0.5 / scale; // 调整线宽以适应缩放
        
        // 计算可见区域的边界
        const visibleLeft = -translateX / scale;
        const visibleTop = -translateY / scale;
        const visibleRight = (width - translateX) / scale;
        const visibleBottom = (height - translateY) / scale;
        
        // 根据当前比例调整网格大小
        const gridSize = 40 / Math.sqrt(scale);
        
        // 水平网格线
        for (let y = Math.floor(visibleTop / gridSize) * gridSize; y < visibleBottom; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(visibleLeft, y);
          ctx.lineTo(visibleRight, y);
          ctx.stroke();
        }
        
        // 垂直网格线
        for (let x = Math.floor(visibleLeft / gridSize) * gridSize; x < visibleRight; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, visibleTop);
          ctx.lineTo(x, visibleBottom);
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
          let linkWidth = 1.5 / scale; // 调整线宽以适应缩放
          let linkOpacity = 0.5;
          
          if (link.type === 'contains') {
            linkColor = colorScheme.link.contains;
            linkWidth = 2 / scale;
            linkOpacity = 0.7;
          } else if (link.type === 'related') {
            linkColor = colorScheme.link.related;
            linkWidth = 1.8 / scale;
            linkOpacity = 0.6;
          }
          
          // 根据link.value调整线的宽度
          if (link.value) {
            linkWidth = (1 + (link.value * 2)) / scale;
          }
          
          // 如果源节点或目标节点被悬停，高亮连接线
          if (hoveredNode === link.source || hoveredNode === link.target) {
            linkWidth *= 2;
            linkOpacity = 0.9;
          }
          
          // 绘制连接线发光效果
          ctx.beginPath();
          ctx.strokeStyle = linkColor.replace(/[\d.]+\)$/, `${linkOpacity * 0.3})`);
          ctx.lineWidth = linkWidth + (4 / scale);
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
          const glowSize = isHovered ? 20 / scale : 10 / scale;
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
          ctx.lineWidth = isHovered ? 2 / scale : 1 / scale;
          ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
          ctx.stroke();
          
          // 文本显示 - 现在直接在节点上显示文本，而不是旁边
          if (node.category === 'cluster' || 
              (node.category === 'keyword' && size > 10) || 
              node.id === hoveredNode) {
            
            // 根据节点类型确定字体大小和样式
            let fontSize = node.category === 'cluster' ? 14 : 12;
            fontSize = Math.max(fontSize / scale, fontSize * 0.7); // 调整字体大小但防止过小
            
            let fontWeight = node.category === 'cluster' ? 'bold' : 'normal';
            
            // 悬停状态使标签更大
            if (node.id === hoveredNode) {
              fontSize *= 1.2;
              fontWeight = 'bold';
            }
            
            ctx.font = `${fontWeight} ${fontSize}px Inter, Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // 检测设备尺寸并调整文本显示策略
            const isMobile = window.innerWidth <= 768;
            
            // 根据节点类型调整文本渲染
            if (node.category === 'cluster') {
              // 给主题节点文本添加暗色背景使文字更易读
              // 确保文本宽度不超过一个合理的范围，特别是在移动设备上
              let displayLabel = node.label;
              if (isMobile && displayLabel.length > 8) {
                // 在移动设备上，如果标签太长就缩短它
                displayLabel = displayLabel.substring(0, 7) + '…';
              }
              
              const textWidth = ctx.measureText(displayLabel).width;
              const padding = 6;
              const bgHeight = fontSize * 1.4;
              
              // 使用半透明黑色背景
              ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              ctx.fillRect(
                pos.x - textWidth/2 - padding, 
                pos.y - bgHeight/2, 
                textWidth + padding*2, 
                bgHeight
              );
              
              // 绘制文本主体 - 确保文本总是横向显示
              ctx.fillStyle = 'white';
              ctx.fillText(displayLabel, pos.x, pos.y);
              
              // 在移动设备上，如果原标签被缩短，则在悬停时显示完整标签
              if (isHovered && displayLabel !== node.label) {
                const fullTextWidth = ctx.measureText(node.label).width;
                // 显示完整标签的提示框
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.fillRect(
                  pos.x - fullTextWidth/2 - padding, 
                  pos.y + size + padding, 
                  fullTextWidth + padding*2, 
                  bgHeight
                );
                ctx.fillStyle = 'white';
                ctx.fillText(node.label, pos.x, pos.y + size + padding + bgHeight/2);
              }
            } else if (isHovered || node.category === 'keyword') {
              // 对悬停节点和关键词绘制标签 - 显示在节点旁边
              ctx.textAlign = 'left';
              
              // 绘制文本阴影
              ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              ctx.fillText(node.label, pos.x + size + 4, pos.y + 4);
              
              // 绘制文本主体
              ctx.fillStyle = node.category === 'keyword' ? '#d1fae5' : 'white';
              ctx.fillText(node.label, pos.x + size + 3, pos.y + 3);
            }
          }
        });
      };
      
      // 绘制全部内容
      drawBackground();
      drawLinks();
      drawNodes();
      
      // 添加缩放控制器UI
      const drawZoomControls = () => {
        // 恢复原始变换以在固定位置绘制控制器
        ctx.restore();
        ctx.save();
        
        // 在画布右下角绘制缩放控制器
        const controlSize = 36;
        const margin = 16;
        const rightPos = width - margin - controlSize;
        const bottomPos = height - margin - controlSize * 2 - margin;
        
        // 放大按钮
        ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        
        // 放大按钮背景
        ctx.beginPath();
        ctx.roundRect(rightPos, bottomPos, controlSize, controlSize, 8);
        ctx.fill();
        ctx.stroke();
        
        // 放大图标
        ctx.beginPath();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.moveTo(rightPos + controlSize * 0.3, bottomPos + controlSize * 0.5);
        ctx.lineTo(rightPos + controlSize * 0.7, bottomPos + controlSize * 0.5);
        ctx.moveTo(rightPos + controlSize * 0.5, bottomPos + controlSize * 0.3);
        ctx.lineTo(rightPos + controlSize * 0.5, bottomPos + controlSize * 0.7);
        ctx.stroke();
        
        // 缩小按钮
        ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        
        // 缩小按钮背景
        ctx.beginPath();
        ctx.roundRect(rightPos, bottomPos + controlSize + margin, controlSize, controlSize, 8);
        ctx.fill();
        ctx.stroke();
        
        // 缩小图标
        ctx.beginPath();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.moveTo(rightPos + controlSize * 0.3, bottomPos + controlSize + margin + controlSize * 0.5);
        ctx.lineTo(rightPos + controlSize * 0.7, bottomPos + controlSize + margin + controlSize * 0.5);
        ctx.stroke();
        
        // 保存变换按钮区域
        const zoomInBounds = {
          x: rightPos,
          y: bottomPos,
          width: controlSize,
          height: controlSize,
          action: 'zoomIn'
        };
        
        const zoomOutBounds = {
          x: rightPos,
          y: bottomPos + controlSize + margin,
          width: controlSize,
          height: controlSize,
          action: 'zoomOut'
        };
        
        return { zoomInBounds, zoomOutBounds };
      };
      
      const controls = drawZoomControls();
      
      // 恢复上下文状态
      ctx.restore();
      
      // 将控制按钮区域保存到组件实例，以供点击处理使用
      // 使用类型断言来避免TypeScript错误
      (canvas as any).zoomControls = controls;
    };
    
    // 启动渲染循环
    let animationFrameId: number;
    
    const animate = () => {
      render();
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    
    // 清理
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [processedNodes, links, positions, width, height, hoveredNode]);
  
  // 处理缩放按钮点击
  const handleControlClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !(canvas as any).zoomControls) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const { zoomInBounds, zoomOutBounds } = (canvas as any).zoomControls;
    
    // 检查是否点击了放大按钮
    if (
      clickX >= zoomInBounds.x && 
      clickX <= zoomInBounds.x + zoomInBounds.width &&
      clickY >= zoomInBounds.y && 
      clickY <= zoomInBounds.y + zoomInBounds.height
    ) {
      // 放大操作
      setTransform(prev => ({
        ...prev,
        scale: Math.min(5, prev.scale * 1.2)
      }));
    }
    
    // 检查是否点击了缩小按钮
    if (
      clickX >= zoomOutBounds.x && 
      clickX <= zoomOutBounds.x + zoomOutBounds.width &&
      clickY >= zoomOutBounds.y && 
      clickY <= zoomOutBounds.y + zoomOutBounds.height
    ) {
      // 缩小操作
      setTransform(prev => ({
        ...prev,
        scale: Math.max(0.1, prev.scale / 1.2)
      }));
    }
  };
  
  return (
    <div className="w-full h-full relative">
      <canvas 
        ref={canvasRef}
        onClick={handleControlClick}
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