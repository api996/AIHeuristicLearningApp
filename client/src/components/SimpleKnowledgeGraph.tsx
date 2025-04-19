import React, { useRef, useEffect, useState } from 'react';
// 直接导入d3作为any类型以避免TypeScript错误
import * as d3Raw from 'd3';
// 类型转换为any，解决TypeScript类型检查错误
const d3 = d3Raw as any;
// 导入D3补丁文件路径（注意：我们不直接导入，只是确保它被加载）
// '../lib/d3-patch';

// 声明简化的d3类型，以便在代码中使用
declare global {
  interface Window {
    d3: any;
    _d3Selection: any;
    d3Selection: any;
    loadD3AndApplyPatch?: () => void; // 添加函数类型定义
  }
}

interface Node {
  id: string;
  label: string;
  color: string;
  size: number;
  x?: number;
  y?: number;
  category?: string;
}

interface Link {
  source: string | Node;
  target: string | Node;
  color?: string;
  strokeWidth?: number;
}

interface SimpleKnowledgeGraphProps {
  nodes: Node[];
  links: Link[];
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
  zoomLevel?: number; // 添加缩放级别属性
  isFullScreen?: boolean; // 添加全屏状态属性
}

/**
 * 简单的知识图谱组件
 * 直接使用D3.js渲染，不依赖复杂的图谱库
 */
const SimpleKnowledgeGraph: React.FC<SimpleKnowledgeGraphProps> = ({
  nodes,
  links,
  width = 800,
  height = 600,
  onNodeClick,
  zoomLevel = 1,
  isFullScreen = false
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 确保D3补丁正确应用
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // 直接设置全局d3对象
        window.d3 = d3;
        
        // 初始化必要的全局对象 - 不依赖补丁文件
        if (!window._d3Selection) {
          window._d3Selection = { d3: d3, event: null, transform: { k: 1, x: 0, y: 0 } };
          console.log("SimpleKnowledgeGraph: 创建了_d3Selection全局对象");
        } else {
          window._d3Selection.d3 = d3;
          console.log("SimpleKnowledgeGraph: 更新了_d3Selection.d3引用");
        }
        
        if (!window.d3Selection) {
          window.d3Selection = {
            d3: d3,
            event: null,
            transform: { k: 1, x: 0, y: 0 },
            mouse: function(container: any) {
              return [0, 0];
            },
            setEvent: function(event: any) {
              this.event = event;
            }
          };
          console.log("SimpleKnowledgeGraph: 创建了d3Selection全局对象");
        }
        
        // 直接应用D3补丁，不使用全局函数
        if (window.d3 && window._d3Selection) {
          window._d3Selection.d3 = window.d3;
          console.log("SimpleKnowledgeGraph: 内置补丁已应用");
        }
        
        // 标记组件已加载
        console.log("SimpleKnowledgeGraph组件已加载并初始化D3全局对象");
      } catch (err) {
        console.error("初始化D3全局对象时出错:", err);
      }
    }
  }, []);

  // 强化的拖拽事件处理函数
  const handleDragStarted = (simulation: any) => (event: any, d: any) => {
    try {
      // 确保事件和节点对象存在
      if (!event) event = {};
      if (!d) d = { x: width / 2, y: height / 2 };
      
      // 设置力学模拟的活跃度
      if (typeof event.active !== 'undefined' && !event.active) {
        try {
          simulation.alphaTarget(0.3).restart();
        } catch (e) {
          console.warn("重启模拟失败:", e);
        }
      }
      
      // 设置节点的固定位置 (fx, fy) 以实现拖拽效果
      d.fx = typeof d.x !== 'undefined' ? d.x : width / 2;
      d.fy = typeof d.y !== 'undefined' ? d.y : height / 2;
      
      // 记录初始拖拽位置
      console.log("开始拖拽节点:", { id: d.id, x: d.fx, y: d.fy });
    } catch (err) {
      console.warn("拖拽开始事件处理错误:", err);
    }
  };

  const handleDragged = () => (event: any, d: any) => {
    try {
      // 检查事件和节点对象是否存在
      if (!event) event = {};
      if (!d) return;
      
      // 获取事件中的坐标
      // D3的不同版本可能使用不同的属性名称
      const x = typeof event.x !== 'undefined' ? event.x : 
               (event.dx && d.fx ? d.fx + event.dx : d.fx);
      const y = typeof event.y !== 'undefined' ? event.y :
               (event.dy && d.fy ? d.fy + event.dy : d.fy);
      
      // 更新节点位置
      if (typeof x !== 'undefined') d.fx = x;
      if (typeof y !== 'undefined') d.fy = y;
    } catch (err) {
      console.warn("拖拽中事件处理错误:", err);
    }
  };

  const handleDragEnded = (simulation: any) => (event: any, d: any) => {
    try {
      // 确保事件和节点对象存在
      if (!event) event = {};
      if (!d) return;
      
      // 减小力学模拟的活跃度
      if (typeof event.active !== 'undefined' && !event.active) {
        try {
          simulation.alphaTarget(0);
        } catch (e) {
          console.warn("设置模拟活跃度失败:", e);
        }
      }
      
      // 释放节点，让它再次自由移动
      d.fx = null;
      d.fy = null;
      
      console.log("结束拖拽节点:", d.id);
    } catch (err) {
      console.warn("拖拽结束事件处理错误:", err);
    }
  };

  // 响应缩放级别和全屏状态变化
  useEffect(() => {
    if (!svgRef.current) return;
    
    console.log(`图谱更新: 缩放=${zoomLevel}, 全屏=${isFullScreen}`);
    
    // 获取SVG元素
    const svg = d3.select(svgRef.current);
    
    // 根据全屏状态更新SVG尺寸
    if (isFullScreen) {
      svg.attr('width', window.innerWidth - 40)
         .attr('height', window.innerHeight - 120);
    } else {
      svg.attr('width', width)
         .attr('height', height);
    }
    
    // 应用缩放级别（使用transform属性直接缩放容器）
    try {
      const g = svg.select('g');
      if (!g.empty()) {
        // 获取当前的transform属性
        const currentTransform = g.attr('transform') || '';
        // 提取平移部分，保留平移但更新缩放
        const translateMatch = currentTransform.match(/translate\(([^)]+)\)/);
        const translate = translateMatch ? translateMatch[1] : width/2 + ',' + height/2;
        // 应用新的缩放
        g.attr('transform', `translate(${translate}) scale(${zoomLevel})`);
      }
    } catch (err) {
      console.warn("应用缩放级别时出错:", err);
    }
  }, [zoomLevel, isFullScreen, width, height]);

  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;

    try {
      // 清除之前的SVG内容
      d3.select(svgRef.current).selectAll("*").remove();

      // 创建一个包含ID映射的节点数组，以便正确关联链接
      const nodeMap = new Map<string, Node>();
      nodes.forEach(node => nodeMap.set(node.id, { ...node }));

      // 格式化链接数据，确保source和target指向节点对象
      const formattedLinks = links.map(link => ({
        ...link,
        source: typeof link.source === 'string' ? nodeMap.get(link.source) || link.source : link.source,
        target: typeof link.target === 'string' ? nodeMap.get(link.target) || link.target : link.target,
      }));

      // 创建SVG元素
      const svg = d3.select(svgRef.current)
        .attr('width', width)
        .attr('height', height)
        .style('background', 'transparent');

      // 创建一个容器以支持缩放和平移
      const container = svg.append('g');

      // 创建力导向模拟 - 改进力参数
      const simulation = d3.forceSimulation(nodes as any)
        // 链接距离更大，使节点分布更开
        .force('link', d3.forceLink(formattedLinks).id((d: any) => d.id).distance(150))
        // 增加排斥力，使节点更加分散
        .force('charge', d3.forceManyBody().strength(-300))
        // 保持在中心位置
        .force('center', d3.forceCenter(width / 2, height / 2))
        // 增加碰撞半径，防止节点重叠
        .force('collision', d3.forceCollide().radius((d: any) => Math.max(10, (d.size || 15) / 5) + 10))
        // 增加X、Y方向的力，使图谱更加展开
        .force('x', d3.forceX(width / 2).strength(0.05))
        .force('y', d3.forceY(height / 2).strength(0.05));

      // 增强版缩放行为 - 完全重写以提供更好的用户体验
      try {
        // 定义默认和当前变换
        const defaultTransform = { k: 1, x: width / 2, y: height / 2 };
        let currentTransform = { ...defaultTransform };
        
        // 创建缩放控制器
        const zoom = d3.zoom()
          .scaleExtent([0.1, 8]) // 更大的缩放范围
          .on('zoom', function(event: any) {
            // 处理缩放事件
            try {
              if (event && event.transform) {
                // 保存当前变换
                currentTransform = event.transform;
                
                // 应用变换到容器
                container.attr('transform', 
                  `translate(${currentTransform.x},${currentTransform.y}) scale(${currentTransform.k})`
                );
                
                // 在全屏模式下显示缩放级别指示器
                if (isFullScreen) {
                  const indicator = svg.select('#zoom-indicator');
                  if (!indicator.empty()) {
                    indicator.text(`缩放: ${currentTransform.k.toFixed(1)}x`);
                  }
                }
              }
            } catch (err) {
              console.warn("缩放事件处理错误:", err);
              // 如果发生错误，恢复默认变换
              container.attr('transform', `translate(0,0) scale(1)`);
            }
          });
        
        // 应用缩放行为
        svg.call(zoom as any);
        
        // 添加缩放按钮和指示器（仅在全屏模式下）
        if (isFullScreen) {
          // 添加缩放级别指示器
          svg.append('text')
            .attr('id', 'zoom-indicator')
            .attr('x', 10)
            .attr('y', 25)
            .attr('font-size', '12px')
            .attr('fill', 'rgba(255,255,255,0.7)')
            .text(`缩放: 1.0x`);
            
          // 添加控制按钮组
          const controlsGroup = svg.append('g')
            .attr('transform', 'translate(10, 50)')
            .attr('class', 'zoom-controls');
            
          // 放大按钮
          controlsGroup.append('circle')
            .attr('cx', 15)
            .attr('cy', 15)
            .attr('r', 15)
            .attr('fill', 'rgba(59, 130, 246, 0.5)')
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .attr('cursor', 'pointer')
            .on('click', () => {
              svg.transition().duration(300).call(
                zoom.scaleBy as any, 1.3
              );
            });
            
          // 放大符号
          controlsGroup.append('text')
            .attr('x', 15)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('fill', 'white')
            .attr('font-size', '18px')
            .attr('cursor', 'pointer')
            .text('+');
            
          // 缩小按钮
          controlsGroup.append('circle')
            .attr('cx', 15)
            .attr('cy', 55)
            .attr('r', 15)
            .attr('fill', 'rgba(59, 130, 246, 0.5)')
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .attr('cursor', 'pointer')
            .on('click', () => {
              svg.transition().duration(300).call(
                zoom.scaleBy as any, 0.7
              );
            });
            
          // 缩小符号
          controlsGroup.append('text')
            .attr('x', 15)
            .attr('y', 60)
            .attr('text-anchor', 'middle')
            .attr('fill', 'white')
            .attr('font-size', '18px')
            .attr('cursor', 'pointer')
            .text('-');
            
          // 重置按钮
          controlsGroup.append('circle')
            .attr('cx', 15)
            .attr('cy', 95)
            .attr('r', 15)
            .attr('fill', 'rgba(59, 130, 246, 0.5)')
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .attr('cursor', 'pointer')
            .on('click', () => {
              svg.transition().duration(500).call(
                zoom.transform as any, d3.zoomIdentity.translate(width/2, height/2).scale(1)
              );
            });
            
          // 重置符号
          controlsGroup.append('text')
            .attr('x', 15)
            .attr('y', 100)
            .attr('text-anchor', 'middle')
            .attr('fill', 'white')
            .attr('font-size', '14px')
            .attr('cursor', 'pointer')
            .text('R');
        }
        
        // 不再需要预热，删除此部分
        
        // 应用初始缩放级别
        if (zoomLevel && zoomLevel !== 1) {
          // 使用平滑过渡动画
          svg.transition().duration(750)
            .call((zoom as any).transform, d3.zoomIdentity.translate(width/2, height/2).scale(zoomLevel));
        } else {
          // 初始化适当的缩放和位置，让整个图谱可见
          setTimeout(() => {
            try {
              // 计算自动缩放级别，确保图谱完全可见
              const autoZoom = nodes.length > 15 ? 0.8 : nodes.length > 8 ? 0.9 : 1.0;
              svg.transition().duration(750)
                .call((zoom as any).transform, d3.zoomIdentity.translate(width/2, height/2).scale(autoZoom));
            } catch (e) {
              console.warn("应用自动缩放失败:", e);
            }
          }, 300);
        }
      } catch (err) {
        console.warn("设置增强缩放行为时出错:", err);
      }

      // 绘制连接线 - 增强版
      const link = container.append('g')
        .selectAll('line')
        .data(formattedLinks)
        .enter()
        .append('line')
        .attr('stroke', (d: any) => d.color || 'rgba(100, 180, 255, 0.7)') // 更亮更明显的颜色
        .attr('stroke-width', (d: any) => d.strokeWidth || 2.5) // 增加线宽
        .attr('stroke-opacity', 0.8) // 增加不透明度
        .attr('stroke-linecap', 'round'); // 圆角线帽

      // 创建节点组 - 增强版
      const node = container.append('g')
        .selectAll('.node')
        .data(nodes)
        .enter()
        .append('g')
        .attr('class', 'node')
        .on('click', function(event: MouseEvent, d: any) {
          if (onNodeClick) {
            event.stopPropagation();
            onNodeClick(d.id);
          }
        })
        .call(d3.drag()
          .on('start', handleDragStarted(simulation))
          .on('drag', handleDragged())
          .on('end', handleDragEnded(simulation)) as any
        );

      // 添加节点圆形 - 调整大小使其更明显
      node.append('circle')
        .attr('r', (d: any) => Math.max(5, (d.size || 15) / 10)) // 最小半径为5px，更大的节点
        .attr('fill', (d: any) => d.color || '#3b82f6')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5);

      // 添加节点标签 - 改进显示
      node.append('text')
        .attr('dx', (d: any) => Math.max(5, (d.size || 15) / 10) + 5) // 与圆形大小匹配
        .attr('dy', '.35em')
        .attr('font-size', '12px') // 增大字体
        .attr('fill', '#ffffff')
        .attr('stroke', 'rgba(0,0,0,0.5)') // 添加描边使文字更清晰
        .attr('stroke-width', 0.3)
        .text((d: any) => d.label || d.id);

      // 更新力导向模拟
      simulation.on('tick', () => {
        link
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);

        node
          .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
      });
    } catch (err: any) {
      console.error('知识图谱渲染错误:', err);
      setError(err.message || '图谱渲染失败');
    }
  }, [nodes, links, width, height, onNodeClick]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <p className="text-red-500 mb-2">图谱渲染错误</p>
        <p className="text-sm text-gray-400">{error}</p>
      </div>
    );
  }

  // 更精确地检测是否有有效节点
  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    // 添加更详细的日志，帮助调试
    console.log("SimpleKnowledgeGraph: 无有效节点数据", {
      nodesExists: !!nodes,
      isArray: Array.isArray(nodes),
      length: nodes ? nodes.length : 0,
      nodesData: nodes
    });
    
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <p className="text-lg text-neutral-400">暂无足够数据生成知识图谱</p>
        <p className="text-sm text-neutral-500 max-w-md mx-auto mt-2 text-center">
          随着您的学习过程，系统将收集更多数据，并构建您的知识图谱
        </p>
      </div>
    );
  }
  
  // 添加确认日志
  console.log("SimpleKnowledgeGraph: 准备渲染知识图谱，节点数=", nodes.length, "连接数=", links.length);

  // 添加触摸事件处理，增强iPad兼容性
  useEffect(() => {
    if (!svgRef.current) return;
    
    // 为SVG添加触摸事件处理
    const handleTouchEvent = (e: TouchEvent) => {
      // 确保触摸事件不会导致页面滚动
      if (e.touches.length > 0) {
        e.preventDefault();
      }
    };
    
    const svgElement = svgRef.current;
    svgElement.addEventListener('touchstart', handleTouchEvent, { passive: false });
    svgElement.addEventListener('touchmove', handleTouchEvent, { passive: false });
    
    return () => {
      svgElement.removeEventListener('touchstart', handleTouchEvent);
      svgElement.removeEventListener('touchmove', handleTouchEvent);
    };
  }, []);

  // 适应移动端的尺寸计算
  const adjustedHeight = isFullScreen ? height : Math.min(height, window.innerHeight * 0.7);
  const adjustedWidth = isFullScreen ? width : Math.min(width, window.innerWidth - 20);
  
  return (
    <div 
      className={`knowledge-graph-container ${isFullScreen ? 'fullscreened-graph' : ''}`}
      // 添加触摸操作CSS支持
      style={{
        width: adjustedWidth, 
        height: adjustedHeight,
        maxWidth: '100%',
        maxHeight: isFullScreen ? '100vh' : '70vh',
        touchAction: 'manipulation',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        overflow: 'visible',
        position: 'relative'
      }}
    >
      <svg 
        ref={svgRef} 
        style={{
          width: '100%',
          height: '100%',
          overflow: 'visible',
          touchAction: 'manipulation'
        }}
      />
    </div>
  );
};

export default SimpleKnowledgeGraph;