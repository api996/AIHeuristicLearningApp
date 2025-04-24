import React, { useCallback, useEffect, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { Network } from 'lucide-react';
import SpriteText from 'three-spritetext';

// 节点类型定义
interface GraphNode {
  id: string;
  label: string;
  size: number;
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
  value: number;
  type?: string;
  color?: string;
}

// 组件属性类型定义
interface TextNodeForceGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  width: number;
  height: number;
  onNodeClick?: (nodeId: string) => void;
}

/**
 * 3D文本节点力导向图组件
 * 使用React Force Graph 3D实现，纯文本节点的3D效果
 */
const TextNodeForceGraph: React.FC<TextNodeForceGraphProps> = ({
  nodes,
  links,
  width,
  height,
  onNodeClick
}) => {
  const graphRef = useRef<any>();
  const [isMounted, setIsMounted] = useState(false);
  const [graphData, setGraphData] = useState<{ nodes: any[], links: any[] }>({ nodes: [], links: [] });
  
  // 在组件挂载后设置状态
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // 转换输入数据为图形库所需格式
  useEffect(() => {
    if (!nodes || !links || !isMounted) return;
    
    // 处理节点数据
    const processedNodes = nodes.map(node => {
      // 根据节点类型设置颜色
      let nodeColor: string;
      let nodeSize: number = node.size || 10;
      
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
        // 根据连接类型设置样式
        switch (link.type) {
          case 'prerequisite':
            linkColor = 'rgba(220, 38, 38, 0.7)'; // 前置知识 - 深红色
            linkWidth = 2;
            break;
          case 'contains':
            linkColor = 'rgba(79, 70, 229, 0.7)'; // 包含关系 - 靛蓝色
            linkWidth = 2;
            break;
          case 'applies':
            linkColor = 'rgba(14, 165, 233, 0.7)'; // 应用关系 - 天蓝色
            linkWidth = 1.6;
            break;
          case 'similar':
            linkColor = 'rgba(34, 197, 94, 0.7)'; // 相似概念 - 绿色
            linkWidth = 1.5;
            break;
          case 'complements':
            linkColor = 'rgba(245, 158, 11, 0.7)'; // 互补知识 - 琥珀色
            linkWidth = 1.5;
            break;
          case 'references':
            linkColor = 'rgba(168, 85, 247, 0.7)'; // 引用关系 - 紫色
            linkWidth = 1.8;
            break;
          case 'related':
            linkColor = 'rgba(139, 92, 246, 0.7)'; // 相关概念 - 紫色
            linkWidth = 1.5;
            break;
          default:
            linkColor = 'rgba(209, 213, 219, 0.7)';  // 默认 - 浅灰色
            linkWidth = 1;
        }
      }
      
      // 使用value属性调整线宽
      if (link.value) {
        linkWidth = Math.max(1, Math.min(3, link.value));
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
  }, [nodes, links, isMounted]);
  
  // 处理节点点击
  const handleNodeClick = useCallback((node: GraphNode) => {
    if (onNodeClick) {
      onNodeClick(node.id);
    }
  }, [onNodeClick]);
  
  // 自定义节点渲染函数 - 纯文本精灵
  const nodeThreeObject = useCallback((node: any) => {
    // 创建文本精灵 - 只显示文本没有背景或边框
    const sprite = new SpriteText(node.label);
    
    // 使用节点自带的颜色属性，这样每个主题都能有不同颜色
    sprite.color = node.color || 
                  (node.category === 'cluster' ? '#6366f1' : // 主题聚类 - 靛蓝色
                   node.category === 'keyword' ? '#10b981' : // 关键词 - 翠绿色
                   node.category === 'memory' ? '#f59e0b' : // 记忆 - 琥珀色
                   '#ffffff'); // 默认白色
                   
    sprite.backgroundColor = 'rgba(0,0,0,0)'; // 透明背景
    sprite.fontWeight = node.category === 'cluster' ? 'bold' : 'normal'; // 主题使用粗体
    sprite.textHeight = node.category === 'cluster' ? 10 : 6; // 主题使用更大字号
    sprite.fontFace = '"Arial", sans-serif';
    
    return sprite;
  }, []);
  
  // 当组件挂载后，调整图表
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      // 启动力布局的初始参数
      graphRef.current.d3Force('charge').strength((node: any) => {
        return node.category === 'cluster' ? -500 : -300;
      });
      
      graphRef.current.d3Force('link').distance((link: any) => {
        // 根据连接类型调整距离
        if (link.type === 'hierarchy') return 150;
        if (link.type === 'proximity') return 180;
        if (link.type === 'semantic') return 200;
        return 150;
      });
      
      // 初始缩放到合适比例
      setTimeout(() => {
        if (graphRef.current) {
          graphRef.current.cameraPosition({ z: 300 }, { x: 0, y: 0, z: 0 }, 1000);
        }
      }, 500);
    }
  }, [graphData]);
  
  // 自定义链接粒子渲染 - 根据是否为双向关系动态调整粒子数量和速度
  const linkDirectionalParticlesAccessor = useCallback((link: any) => {
    // 双向关系使用更多的粒子
    return link.bidirectional ? 4 : 2;
  }, []);

  // 自定义链接粒子宽度
  const linkDirectionalParticleWidthAccessor = useCallback((link: any) => {
    // 双向关系使用更宽的粒子
    return link.bidirectional ? 2 : 1.5;
  }, []);

  // 自定义链接粒子速度
  const linkDirectionalParticleSpeedAccessor = useCallback((link: any) => {
    // 双向关系使用更快的粒子
    return link.bidirectional ? 0.015 : 0.01;
  }, []);

  return (
    <div className="text-node-force-graph-container" style={{ width, height, overflow: 'hidden' }}>
      {graphData.nodes.length > 0 ? (
        <ForceGraph3D
          ref={graphRef}
          width={width}
          height={height}
          graphData={graphData}
          nodeThreeObject={nodeThreeObject}
          nodeThreeObjectExtend={false} // 完全替换节点默认渲染
          linkColor="color"
          linkWidth="width"
          linkOpacity={0.7} // 略微增加不透明度
          backgroundColor="rgba(0,0,0,0)" // 透明背景
          
          // 使用动态粒子设置更清晰地显示双向关系
          linkDirectionalParticles={linkDirectionalParticlesAccessor}
          linkDirectionalParticleWidth={linkDirectionalParticleWidthAccessor}
          linkDirectionalParticleSpeed={linkDirectionalParticleSpeedAccessor}
          
          onNodeClick={handleNodeClick}
          showNavInfo={false} // 不显示导航信息
          enableNodeDrag={true} // 允许拖拽节点
          enableNavigationControls={true} // 允许导航控制
          controlType="orbit" // 轨道控制类型
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

export default TextNodeForceGraph;