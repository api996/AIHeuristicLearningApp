import React, { useEffect, useRef } from 'react';

// 使用forceGraph的简单实现，避免TypeScript错误
interface Node {
  id: string;
  label: string;
  color: string;
  size: number;
}

interface Link {
  source: string;
  target: string;
  color?: string;
}

interface SimpleD3GraphProps {
  nodes: Node[];
  links: Link[];
  width?: number;
  height?: number;
  zoomLevel?: number;
  onNodeClick?: (nodeId: string) => void;
}

const SimpleD3Graph: React.FC<SimpleD3GraphProps> = ({
  nodes,
  links,
  width = window.innerWidth,
  height = window.innerHeight,
  zoomLevel = 1,
  onNodeClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // 清除现有内容
    containerRef.current.innerHTML = '';
    
    // 添加新的svg元素
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width.toString());
    svg.setAttribute('height', height.toString());
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.style.overflow = 'visible';
    
    // 创建一个主容器组
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${width/2}, ${height/2}) scale(${zoomLevel})`);
    svg.appendChild(g);
    
    // 添加连接线
    links.forEach(link => {
      const source = nodes.find(n => n.id === link.source);
      const target = nodes.find(n => n.id === link.target);
      
      if (source && target) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        // 设置随机初始位置，后续会通过拖动调整
        const x1 = Math.random() * width;
        const y1 = Math.random() * height;
        const x2 = Math.random() * width;
        const y2 = Math.random() * height;
        
        line.setAttribute('x1', x1.toString());
        line.setAttribute('y1', y1.toString());
        line.setAttribute('x2', x2.toString());
        line.setAttribute('y2', y2.toString());
        line.setAttribute('stroke', link.color || 'rgba(59, 130, 246, 0.5)');
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('data-source', link.source);
        line.setAttribute('data-target', link.target);
        
        g.appendChild(line);
      }
    });
    
    // 添加节点
    nodes.forEach((node, index) => {
      const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      nodeGroup.setAttribute('class', 'node');
      nodeGroup.setAttribute('data-id', node.id);
      
      // 随机位置
      const x = Math.random() * width - width/2;
      const y = Math.random() * height - height/2;
      nodeGroup.setAttribute('transform', `translate(${x}, ${y})`);
      
      // 创建圆形节点
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', node.size.toString());
      circle.setAttribute('fill', node.color);
      circle.setAttribute('stroke', '#ffffff');
      circle.setAttribute('stroke-width', '2');
      nodeGroup.appendChild(circle);
      
      // 添加标签
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('dy', (node.size + 15).toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#ffffff');
      text.setAttribute('font-size', '10');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('pointer-events', 'none');
      text.textContent = node.label;
      nodeGroup.appendChild(text);
      
      // 添加点击事件
      nodeGroup.addEventListener('click', () => {
        if (onNodeClick) {
          onNodeClick(node.id);
        }
      });
      
      // 添加拖拽功能
      let isDragging = false;
      let startX: number, startY: number;
      
      nodeGroup.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault();
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        // 拖拽事件
        const handleMouseMove = (e: MouseEvent) => {
          if (!isDragging) return;
          
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          startX = e.clientX;
          startY = e.clientY;
          
          // 获取当前位置并更新
          const transform = nodeGroup.getAttribute('transform') || '';
          const currentPos = parseTransform(transform);
          nodeGroup.setAttribute('transform', `translate(${currentPos.x + dx/zoomLevel}, ${currentPos.y + dy/zoomLevel})`);
          
          // 更新相关的边
          updateConnectedLinks(node.id, currentPos.x + dx/zoomLevel, currentPos.y + dy/zoomLevel);
        };
        
        const handleMouseUp = () => {
          isDragging = false;
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      });
      
      g.appendChild(nodeGroup);
    });
    
    // 处理触摸事件
    let touchScale = 1;
    let touchStartDistance = 0;
    
    svg.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        touchStartDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });
    
    svg.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        
        if (touchStartDistance > 0) {
          const newScale = touchScale * (currentDistance / touchStartDistance);
          if (newScale >= 0.5 && newScale <= 3) {
            g.setAttribute('transform', `translate(${width/2}, ${height/2}) scale(${newScale})`);
          }
        }
        
        touchStartDistance = currentDistance;
      }
    });
    
    // 添加整体拖拽
    let isDraggingSvg = false;
    let svgStartX: number, svgStartY: number;
    let svgTranslateX = width/2, svgTranslateY = height/2;
    
    svg.addEventListener('mousedown', (e) => {
      if ((e.target as Element).tagName !== 'circle') {
        isDraggingSvg = true;
        svgStartX = e.clientX;
        svgStartY = e.clientY;
        
        const handleMouseMove = (e: MouseEvent) => {
          if (!isDraggingSvg) return;
          
          const dx = e.clientX - svgStartX;
          const dy = e.clientY - svgStartY;
          svgStartX = e.clientX;
          svgStartY = e.clientY;
          
          svgTranslateX += dx;
          svgTranslateY += dy;
          
          g.setAttribute('transform', `translate(${svgTranslateX}, ${svgTranslateY}) scale(${zoomLevel})`);
        };
        
        const handleMouseUp = () => {
          isDraggingSvg = false;
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }
    });
    
    // 添加滚轮缩放
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.5, Math.min(3, zoomLevel + delta));
      
      g.setAttribute('transform', `translate(${svgTranslateX}, ${svgTranslateY}) scale(${newZoom})`);
    });
    
    containerRef.current.appendChild(svg);
    
    // 更新连接线的位置
    function updateConnectedLinks(nodeId: string, x: number, y: number) {
      const lines = g.querySelectorAll('line');
      
      lines.forEach(line => {
        const source = line.getAttribute('data-source');
        const target = line.getAttribute('data-target');
        
        if (source === nodeId) {
          line.setAttribute('x1', x.toString());
          line.setAttribute('y1', y.toString());
        }
        
        if (target === nodeId) {
          line.setAttribute('x2', x.toString());
          line.setAttribute('y2', y.toString());
        }
      });
    }
    
    // 解析transform属性
    function parseTransform(transform: string) {
      const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
      if (match) {
        return {
          x: parseFloat(match[1]),
          y: parseFloat(match[2])
        };
      }
      return { x: 0, y: 0 };
    }
    
  }, [nodes, links, width, height, zoomLevel, onNodeClick]);
  
  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        touchAction: 'none'
      }} 
      className="simple-d3-graph-container"
    />
  );
};

export default SimpleD3Graph;