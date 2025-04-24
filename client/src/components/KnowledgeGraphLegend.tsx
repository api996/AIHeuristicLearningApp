import React from 'react';
import { ArrowRight, ArrowLeft, ArrowUpDown, Info } from 'lucide-react';

/**
 * 知识图谱关系类型图例组件
 * 简化版显示不同颜色代表的关系类型和方向指示
 */
const KnowledgeGraphLegend: React.FC<{
  nodeCount?: number;  // 可选参数：节点数量
  linkCount?: number;  // 可选参数：连接数量
}> = ({ nodeCount, linkCount }) => {
  // 定义所有关系类型及其颜色
  const relationTypes = [
    { type: 'prerequisite', label: '前置知识', color: 'rgba(220, 38, 38, 0.7)', description: '学习B需要先掌握A的知识' },
    { type: 'contains', label: '包含关系', color: 'rgba(79, 70, 229, 0.7)', description: 'A是B的一部分或子集' },
    { type: 'applies', label: '应用关系', color: 'rgba(14, 165, 233, 0.7)', description: 'A应用了B的概念或方法' },
    { type: 'similar', label: '相似概念', color: 'rgba(34, 197, 94, 0.7)', description: 'A和B有相似的概念或方法' },
    { type: 'complements', label: '互补知识', color: 'rgba(245, 158, 11, 0.7)', description: 'A和B互相补充对方的知识' },
    { type: 'references', label: '引用关系', color: 'rgba(168, 85, 247, 0.7)', description: 'A引用或参考了B' },
    { type: 'related', label: '相关概念', color: 'rgba(139, 92, 246, 0.7)', description: 'A与B有关联但关系不明确' },
    { type: 'unrelated', label: '无直接关系', color: 'rgba(209, 213, 219, 0.7)', description: 'A与B之间没有明确关系' }
  ];

  // 定义方向类型
  const directionTypes = [
    { type: 'single', label: '单向关系', icon: <ArrowRight className="w-4 h-4" />, description: '从源节点指向目标节点' },
    { type: 'reverse', label: '反向关系', icon: <ArrowLeft className="w-4 h-4" />, description: '从目标节点指向源节点' },
    { type: 'bidirectional', label: '双向关系', icon: <ArrowUpDown className="w-4 h-4" />, description: '两个节点互相影响' }
  ];

  return (
    <div className="p-4 bg-black/60 text-white rounded-md shadow-md w-full mt-4 border border-blue-900/50">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-blue-300">知识图谱关系说明</h3>
        
        {/* 只有当提供了节点和连接数量时才显示统计信息 */}
        {(nodeCount !== undefined && linkCount !== undefined) && (
          <div className="flex items-center space-x-3 text-sm">
            <div className="px-2 py-1 bg-blue-900/30 rounded-md text-blue-200 flex items-center">
              <span className="font-medium mr-1">节点:</span> {nodeCount}
            </div>
            <div className="px-2 py-1 bg-indigo-900/30 rounded-md text-indigo-200 flex items-center">
              <span className="font-medium mr-1">连接:</span> {linkCount}
            </div>
          </div>
        )}
      </div>
      
      {/* 关系说明 */}
      <div className="mb-5 p-3 border border-blue-900/30 bg-blue-950/20 rounded-md">
        <div className="flex items-center gap-2 mb-2">
          <Info className="h-4 w-4 text-blue-400" />
          <span className="text-blue-300 font-medium">知识节点表示</span>
        </div>
        <p className="text-sm text-neutral-300 ml-6">
          图中的每个节点表示一个知识点或概念，节点大小反映其重要性
        </p>
      </div>
      
      {/* 关系类型图例 */}
      <div className="mb-4">
        <h4 className="text-sm text-blue-100 mb-2">关系类型</h4>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          {relationTypes.map((relation) => (
            <div key={relation.type} className="flex items-center gap-2">
              <div 
                className="w-6 h-2 rounded-full" 
                style={{ backgroundColor: relation.color }}
              />
              <span className="text-sm">{relation.label}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* 方向图例 */}
      <div>
        <h4 className="text-sm text-blue-100 mb-2">连接方向</h4>
        <div className="grid grid-cols-3 gap-4">
          {directionTypes.map((direction) => (
            <div key={direction.type} className="flex items-center gap-2">
              <div className="w-6 h-6 flex items-center justify-center bg-blue-900/40 rounded-full">
                {direction.icon}
              </div>
              <span className="text-sm">{direction.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraphLegend;