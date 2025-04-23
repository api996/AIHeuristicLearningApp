import React, { useCallback, useEffect, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { Network } from 'lucide-react';
import * as THREE from 'three';
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
  // 力导向图所需的属性
  fx?: number | null;
  fy?: number | null;
  fz?: number | null;
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
 * 使用React Force Graph 3D实现，为节点提供3D效果
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
      
      // 根据连接类型设置样式
      switch (link.type) {
        case 'hierarchy':
          linkColor = '#4b5563';  // 层级关系 - 灰色
          linkWidth = 2;
          break;
        case 'proximity':
          linkColor = '#6366f1';  // 相似/邻近 - 靛蓝色
          linkWidth = 1.5;
          break;
        case 'semantic':
          linkColor = '#10b981';  // 语义关联 - 翠绿色
          linkWidth = 1.5;
          break;
        case 'temporal':
          linkColor = '#f59e0b';  // 时间关系 - 琥珀色
          linkWidth = 1;
          break;
        default:
          linkColor = '#d1d5db';  // 默认 - 浅灰色
          linkWidth = 1;
      }
      
      // 使用value属性调整线宽
      if (link.value) {
        linkWidth = Math.max(1, Math.min(3, link.value));
      }
      
      return {
        ...link,
        color: link.color || linkColor,
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
  
  // 自定义节点渲染函数 - 使用3D文本对象
  const nodeThreeObject = useCallback((node: any) => {
    // 创建一个组，用于包含所有对象
    const group = new THREE.Group();
    
    // 自定义节点形状，不同类别使用不同形状
    let geometry;
    let material;
    
    const color = new THREE.Color(node.color);
    
    switch(node.category) {
      case 'cluster':
        // 主题使用发光的球体
        geometry = new THREE.SphereGeometry(node.val * 0.8);
        material = new THREE.MeshLambertMaterial({ 
          color: node.color,
          emissive: color,
          emissiveIntensity: 0.4,
          transparent: true,
          opacity: 0.8
        });
        break;
      case 'keyword':
        // 关键词使用八面体
        geometry = new THREE.OctahedronGeometry(node.val * 0.7);
        material = new THREE.MeshLambertMaterial({ 
          color: node.color,
          transparent: true,
          opacity: 0.9
        });
        break;
      case 'memory':
        // 记忆使用立方体
        geometry = new THREE.BoxGeometry(node.val * 0.6, node.val * 0.6, node.val * 0.6);
        material = new THREE.MeshPhongMaterial({ 
          color: node.color,
          shininess: 100,
          transparent: true,
          opacity: 0.85
        });
        break;
      default:
        // 默认使用圆环
        geometry = new THREE.TorusGeometry(node.val * 0.5, node.val * 0.2);
        material = new THREE.MeshLambertMaterial({ 
          color: node.color,
          transparent: true,
          opacity: 0.7
        });
    }
    
    // 创建形状对象并添加到组
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
    
    // 为较大节点创建文本精灵
    const isLargeNode = node.val > 10;
    if (isLargeNode || node.category === 'cluster') {
      const sprite = new SpriteText(node.label);
      sprite.color = node.color;
      sprite.textHeight = node.category === 'cluster' ? 8 : 5;
      sprite.position.set(0, node.val * 1.2, 0);
      group.add(sprite);
    }
    
    return group;
  }, []);
  
  // 当组件挂载后，调整图表
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      // 启动力布局的初始参数
      graphRef.current.d3Force('charge').strength((node: any) => {
        return node.category === 'cluster' ? -300 : -200;
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
        graphRef.current.cameraPosition({ z: 250 }, { x: 0, y: 0, z: 0 }, 1000);
      }, 500);
    }
  }, [graphData]);
  
  return (
    <div className="text-node-force-graph-container relative" style={{ width, height, overflow: 'hidden' }}>
      {graphData.nodes.length > 0 ? (
        <ForceGraph3D
          ref={graphRef}
          width={width}
          height={height}
          graphData={graphData}
          nodeThreeObject={nodeThreeObject}
          nodeThreeObjectExtend={false}
          linkColor="color"
          linkWidth="width"
          linkOpacity={0.6}
          backgroundColor="rgba(0,0,0,0)"
          onNodeClick={handleNodeClick}
          showNavInfo={false}
          enableNodeDrag={true}
          enableNavigationControls={true}
          controlType="orbit"
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