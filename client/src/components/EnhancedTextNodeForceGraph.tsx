import React, { useCallback, useEffect, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { Network } from 'lucide-react';
import SpriteText from 'three-spritetext';

// 节点类型定义
interface GraphNode {
  id: string;
  label: string;
  size?: number;
  category?: string; 
  clusterId?: string;
  color?: string;
  x?: number;
  y?: number;
  z?: number;
}

// 连接类型定义
interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  value?: number;
  type?: string;
  color?: string;
  bidirectional?: boolean;
  reason?: string;
  strength?: number;
  learningOrder?: string;
  width?: number;
}

// 组件属性类型定义
interface EnhancedTextNodeForceGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  width: number;
  height: number;
  onNodeClick?: (nodeId: string) => void;
  onBackgroundClick?: () => void;
  highlightedNodeId?: string;
}

/**
 * 增强版3D文本节点力导向图组件
 * 结合TextNodeForceGraph和ForceGraph3DKnowledgeGraph的最佳特性
 * - 使用纯文本节点显示（不显示圆圈）
 * - 支持丰富的3D交互功能
 * - 支持详细的关系染色
 */
const EnhancedTextNodeForceGraph: React.FC<EnhancedTextNodeForceGraphProps> = ({
  nodes,
  links,
  width,
  height,
  onNodeClick,
  onBackgroundClick,
  highlightedNodeId
}) => {
  const graphRef = useRef<any>();
  const [isMounted, setIsMounted] = useState(false);
  const [graphData, setGraphData] = useState<{ nodes: any[], links: any[] }>({ nodes: [], links: [] });
  
  // 内联设备检测
  const [isMobile, setIsMobile] = useState<boolean>(false);
  
  // 在组件挂载后设置状态
  useEffect(() => {
    setIsMounted(true);
    
    // 检测设备类型
    const checkIfMobile = () => {
      const userAgent = navigator.userAgent;
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const isMobileDevice = mobileRegex.test(userAgent);
      const isTablet = /(iPad|Android(?!.*Mobile))/i.test(userAgent);
      
      // 如果是平板，不视为移动设备
      setIsMobile(isMobileDevice && !isTablet);
      
      if (isMobileDevice) {
        console.log("检测到移动设备，应用3D图谱性能优化");
      }
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      setIsMounted(false);
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  // 转换输入数据为图形库所需格式
  useEffect(() => {
    if (!nodes || !links || !isMounted) return;
    
    // 处理节点数据
    const processedNodes = nodes.map(node => {
      // 根据节点类型设置颜色
      let nodeColor: string;
      let nodeSize: number = node.size || 8;
      
      switch (node.category) {
        case 'cluster':
          nodeColor = '#6366f1'; // 主题聚类 - 靛蓝色
          nodeSize = Math.max(nodeSize, 15);
          break;
        case 'keyword':
          nodeColor = '#10b981'; // 关键词 - 翠绿色
          nodeSize = Math.max(nodeSize, 10);
          break;
        case 'memory':
          nodeColor = '#f59e0b'; // 记忆 - 琥珀色
          nodeSize = Math.max(nodeSize, 8);
          break;
        default:
          nodeColor = '#9ca3af'; // 默认 - 灰色
          nodeSize = Math.max(nodeSize, 8);
      }
      
      // 如果该节点被高亮，增加尺寸
      if (node.id === highlightedNodeId) {
        nodeSize *= 1.5;
        // 增加亮度
        nodeColor = node.category === 'cluster' ? '#60a5fa' : 
                    node.category === 'keyword' ? '#34d399' : 
                    node.category === 'memory' ? '#fbbf24' : 
                    '#a78bfa';
      }
      
      return {
        ...node,
        // 使用传入的颜色或基于类别的默认颜色
        color: node.color || nodeColor,
        // 节点显示大小
        val: nodeSize,
        // 确保节点有初始z坐标
        z: node.z || Math.random() * 50 - 25
      };
    });
    
    // 处理连接数据
    const processedLinks = links.map(link => {
      let linkColor: string;
      let linkWidth: number = 1;
      
      // 确保双向关系标志被正确设置
      const isBidirectional = !!link.bidirectional;
      
      // 首先检查是否已有颜色属性，如果有则优先使用
      if (link.color) {
        linkColor = link.color;
      } else {
        // 根据连接类型设置样式 - 结合两个组件的最佳颜色方案
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
            linkWidth = 1.5;
            break;
          case 'unrelated':
            linkColor = 'rgba(156, 163, 175, 0.5)'; // 无直接关系 - 浅灰色
            linkWidth = 0.8;
            break;
          default:
            linkColor = 'rgba(156, 163, 175, 0.7)'; // 默认 - 灰色
            linkWidth = 1;
        }
      }
      
      // 使用value或strength属性调整线宽
      if (link.value) {
        linkWidth = Math.max(1, Math.min(3, link.value));
      } else if (link.strength) {
        linkWidth = Math.max(1, Math.min(3, link.strength / 3));
      }
      
      // 如果源节点或目标节点被高亮，增加连接线宽度
      if ((link.source === highlightedNodeId || 
           (typeof link.source !== 'string' && link.source.id === highlightedNodeId)) || 
          (link.target === highlightedNodeId || 
           (typeof link.target !== 'string' && link.target.id === highlightedNodeId))) {
        linkWidth *= 1.5;
      }
      
      return {
        ...link,
        color: linkColor,
        width: linkWidth
      };
    });
    
    setGraphData({
      nodes: processedNodes,
      links: processedLinks
    });
  }, [nodes, links, isMounted, highlightedNodeId]);
  
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
  
  // 自定义节点渲染函数 - 纯文本精灵
  const nodeThreeObject = useCallback((node: any) => {
    // 创建文本精灵 - 只显示文本没有背景或边框
    const sprite = new SpriteText(node.label);
    
    // 使用节点自带的颜色属性
    sprite.color = node.color;
    
    // 根据节点类型设置样式
    if (node.category === 'cluster') {
      sprite.textHeight = 10;
      sprite.fontWeight = 'bold';
      sprite.backgroundColor = 'rgba(0,0,0,0.2)';
    } else {
      sprite.textHeight = 6;
      sprite.fontWeight = 'normal';
      sprite.backgroundColor = 'rgba(0,0,0,0)'; // 透明背景
    }
    
    // 如果是高亮节点，使用更明显的字体
    if (node.id === highlightedNodeId) {
      sprite.textHeight += 2;
      sprite.fontWeight = 'bold';
      sprite.backgroundColor = 'rgba(0,0,0,0.3)';
    }
    
    sprite.fontFace = '"Arial", sans-serif';
    
    return sprite;
  }, [highlightedNodeId]);
  
  // 设置移动设备上性能相关配置
  const getMobileConfig = useCallback(() => {
    if (isMobile) {
      return {
        cooldownTicks: 50,       // 减少物理模拟计算量
        cooldownTime: 3000,      // 缩短布局稳定时间
        warmupTicks: 10,         // 减少预热时间
      };
    } else {
      return {
        cooldownTicks: 100,
        cooldownTime: 15000,
        warmupTicks: 50,
      };
    }
  }, [isMobile]);
  
  // 当组件挂载后，调整图表
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      // 启动力布局的初始参数
      graphRef.current.d3Force('charge').strength((node: any) => {
        return node.category === 'cluster' ? -500 : -300;
      });
      
      graphRef.current.d3Force('link').distance((link: any) => {
        // 根据连接类型调整距离
        if (link.type === 'prerequisite') return 100;
        if (link.type === 'contains') return 80;
        if (link.type === 'applies') return 100;
        if (link.type === 'similar') return 90;
        return 120;
      });
      
      // 如果有高亮节点，居中显示
      if (highlightedNodeId) {
        const node = graphData.nodes.find(n => n.id === highlightedNodeId);
        if (node && graphRef.current) {
          // 3D版本的居中和缩放
          graphRef.current.cameraPosition(
            { x: node.x, y: node.y, z: 150 }, // 相机位置
            { x: node.x, y: node.y, z: 0 },   // 目标位置 (节点位置)
            1000                             // 过渡时间
          );
        }
      } else {
        // 初始缩放到合适比例
        setTimeout(() => {
          if (graphRef.current) {
            graphRef.current.cameraPosition({ z: 300 }, { x: 0, y: 0, z: 0 }, 1000);
          }
        }, 500);
      }
    }
  }, [graphData, highlightedNodeId]);
  
  // 链接标签渲染 - 在3D版本，我们使用粒子效果表示关系
  const linkDirectionalParticlesAccessor = useCallback((link: any) => {
    // 如果链接涉及高亮节点，增加粒子数量
    if ((typeof link.source === 'string' ? link.source : link.source.id) === highlightedNodeId || 
        (typeof link.target === 'string' ? link.target : link.target.id) === highlightedNodeId) {
      return link.bidirectional ? 6 : 4;
    }
    return link.bidirectional ? 4 : 2;
  }, [highlightedNodeId]);
  
  // 调整粒子大小
  const linkDirectionalParticleWidthAccessor = useCallback((link: any) => {
    // 双向关系使用更宽的粒子
    return link.bidirectional ? 2 : 1.5;
  }, []);
  
  // 调整粒子速度
  const linkDirectionalParticleSpeedAccessor = useCallback((link: any) => {
    return 0.01 + (link.strength || 1) * 0.002;
  }, []);
  
  // 链接的标签 - 当鼠标悬停时显示
  const linkLabelAccessor = useCallback((link: any) => {
    let label = '';
    if (link.label) label += link.label;
    if (link.reason) label += link.reason ? ` - ${link.reason}` : '';
    if (link.learningOrder) label += ` (${link.learningOrder})`;
    return label;
  }, []);

  return (
    <div className="enhanced-text-node-force-graph" style={{ width, height, overflow: 'hidden' }}>
      {graphData.nodes.length > 0 ? (
        <ForceGraph3D
          ref={graphRef}
          width={width}
          height={height}
          graphData={graphData}
          nodeThreeObject={nodeThreeObject}
          nodeThreeObjectExtend={false} // 完全替换节点默认渲染
          
          // 节点相关配置
          nodeVal="val"
          nodeColor="color"
          nodeOpacity={0.9}
          
          // 链接相关配置
          linkColor="color"
          linkWidth="width"
          linkOpacity={0.7}
          linkLabel={linkLabelAccessor}
          
          // 粒子效果
          linkDirectionalParticles={linkDirectionalParticlesAccessor}
          linkDirectionalParticleWidth={linkDirectionalParticleWidthAccessor}
          linkDirectionalParticleSpeed={linkDirectionalParticleSpeedAccessor}
          
          // 背景和交互
          backgroundColor="rgba(0,0,0,0)" // 透明背景
          onNodeClick={handleNodeClick}
          onBackgroundClick={handleBackgroundClick}
          showNavInfo={false} // 不显示导航信息
          enableNodeDrag={true} // 允许拖拽节点
          enableNavigationControls={true} // 允许导航控制
          controlType={"orbit" as "orbit"} // 轨道控制类型，使用类型断言确保类型安全
          
          // 性能设置
          {...getMobileConfig()}
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center text-gray-400">
            <Network className="mr-2" /> 
            加载中...
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedTextNodeForceGraph;