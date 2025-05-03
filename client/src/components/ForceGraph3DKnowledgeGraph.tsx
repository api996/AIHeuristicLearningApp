import React, { useCallback, useEffect, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';

// 图谱节点类型
interface GraphNode {
  id: string;
  label: string;
  category?: string;
  size?: number;
  color?: string;
  x?: number;
  y?: number;
  z?: number;
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
  strength?: number;
  learningOrder?: string;
  bidirectional?: boolean;
}

// 图谱组件属性
interface ForceGraph3DKnowledgeGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
  onBackgroundClick?: () => void;
  highlightedNodeId?: string;
}

/**
 * 3D力导向图知识图谱组件
 * 使用react-force-graph-3d实现，提供沉浸式3D可视化体验
 */
const ForceGraph3DKnowledgeGraph: React.FC<ForceGraph3DKnowledgeGraphProps> = ({
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
        console.log("检测到移动设备，应用3D图谱性能优化");
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
          nodeColor = '#3b82f6'; // 主题聚类 - 蓝色
          nodeSize = 12;
          break;
        case 'keyword':
          nodeColor = '#10b981'; // 关键词 - 绿色
          nodeSize = 8;
          break;
        case 'memory':
          nodeColor = '#f59e0b'; // 记忆 - 橙色
          nodeSize = 5;
          break;
        default:
          nodeColor = '#8b5cf6'; // 默认 - 紫色
          nodeSize = 7;
      }
      
      // 如果有指定尺寸，根据类型适当调整
      if (node.size) {
        if (node.category === 'cluster') {
          nodeSize = Math.min(Math.log2(node.size + 1) * 1.5 + 8, 20);
        } else {
          nodeSize = Math.min(node.size * 0.4 + 4, 12);
        }
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
        // 使用指定尺寸或基于类别的默认尺寸
        val: nodeSize
      };
    });
    
    // 处理连接数据
    const processedLinks = links.map(link => {
      let linkColor: string;
      let linkWidth: number = 1;
      
      // 使用与后端一致的关系类型和颜色
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
          linkWidth = 1.5;
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
          linkWidth = 1.5;
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
          linkWidth = 1;
      }
      
      // 使用link.value调整线宽
      if (link.value) {
        linkWidth = Math.max(1, link.value * 2);
      }
      
      // 如果源节点或目标节点被高亮，增加连接线宽度
      if (link.source === highlightedNodeId || link.target === highlightedNodeId) {
        linkWidth *= 1.5;
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
  
  // 设置移动设备上性能相关配置
  const getMobileConfig = useCallback(() => {
    if (isMobile) {
      return {
        cooldownTicks: 50,       // 减少物理模拟计算量
        cooldownTime: 3000,      // 缩短布局稳定时间
        warmupTicks: 10,         // 减少预热时间
        // 已在组件标签中通过linkDirectionalParticlesAccessor定义，不在此重复定义
      };
    } else {
      return {
        cooldownTicks: 100,
        cooldownTime: 15000,
        warmupTicks: 50,
        // 已在组件标签中通过linkDirectionalParticlesAccessor定义，不在此重复定义
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
      }
    }
  }, [graphData, highlightedNodeId]);
  
  // 节点3D对象渲染
  const nodeThreeObject = useCallback((node: any) => {
    const sprite = new SpriteText(node.label);
    sprite.color = node.color;
    sprite.textHeight = node.category === 'cluster' ? 8 : 6;
    sprite.fontWeight = node.category === 'cluster' ? 'bold' : 'normal';
    sprite.backgroundColor = node.category === 'cluster' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0)';
    
    // 如果是高亮节点，使用更明显的字体
    if (node.id === highlightedNodeId) {
      sprite.textHeight += 2;
      sprite.fontWeight = 'bold';
      sprite.backgroundColor = 'rgba(0,0,0,0.3)';
    }
    
    return sprite;
  }, [highlightedNodeId]);
  
  // 链接标签渲染 - 在3D版本，我们可以使用粒子效果表示关系
  const linkDirectionalParticlesAccessor = useCallback((link: any) => {
    // 如果链接涉及高亮节点，增加粒子数量
    if (link.source.id === highlightedNodeId || link.target.id === highlightedNodeId) {
      return link.bidirectional ? 6 : 4;
    }
    return link.bidirectional ? 3 : 2;
  }, [highlightedNodeId]);
  
  // 调整粒子大小
  const linkDirectionalParticleWidthAccessor = useCallback((link: any) => {
    return link.width * 1.5;
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
  
  // 合并配置，确保性能设置不会覆盖粒子效果
  const finalConfig = {
    // 基础设置
    width,
    height,
    graphData,
    
    // 节点相关配置
    nodeThreeObject: nodeThreeObject,
    nodeThreeObjectExtend: false,
    nodeVal: "val",
    nodeColor: "color",
    nodeOpacity: 0.9,
    
    // 链接相关配置
    linkColor: "color",
    linkWidth: "width",
    linkOpacity: 0.7,
    linkLabel: linkLabelAccessor,
    
    // 粒子效果
    linkDirectionalParticles: linkDirectionalParticlesAccessor,
    linkDirectionalParticleWidth: linkDirectionalParticleWidthAccessor,
    linkDirectionalParticleSpeed: linkDirectionalParticleSpeedAccessor,
    
    // 背景和交互
    backgroundColor: "#111827",
    onNodeClick: handleNodeClick,
    onBackgroundClick: handleBackgroundClick,
    controlType: "orbit",
    
    // 性能设置 (通过扩展合并)
    ...getMobileConfig()
  };

  return (
    <div className="knowledge-graph-3d-container relative">
      {graphData.nodes.length > 0 && (
        <ForceGraph3D
          ref={graphRef}
          {...finalConfig}
        />
      )}
    </div>
  );
};

export default ForceGraph3DKnowledgeGraph;