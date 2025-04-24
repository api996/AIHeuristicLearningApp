import React from 'react';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, ArrowLeft, ArrowUpDown } from 'lucide-react';

interface KnowledgeGraphLegendProps {
  className?: string;
  showBidirectional?: boolean;
}

/**
 * 知识图谱关系类型图例组件
 * 显示不同颜色代表的关系类型和方向指示
 */
const KnowledgeGraphLegend: React.FC<KnowledgeGraphLegendProps> = ({ 
  className = '',
  showBidirectional = true 
}) => {
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

  // 定义节点类型
  const nodeTypes = [
    { type: 'cluster', label: '主题', color: '#3b82f6', description: '主要知识点或聚类中心' },
    { type: 'keyword', label: '关键词', color: '#10b981', description: '重要术语或概念' },
    { type: 'memory', label: '记忆', color: '#f59e0b', description: '学习记忆或对话片段' }
  ];

  return (
    <Card className={`p-3 bg-black/60 text-white rounded-md shadow-md max-w-md ${className}`}>
      <div className="text-sm font-medium mb-2">知识图谱图例</div>
      
      {/* 关系类型图例 */}
      <div className="mb-3">
        <div className="text-xs text-gray-300 mb-1">关系类型</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {relationTypes.map((relation) => (
            <div key={relation.type} className="flex items-center gap-2">
              <div 
                className="w-4 h-1 rounded-full" 
                style={{ backgroundColor: relation.color }}
              />
              <span className="text-xs">{relation.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 节点类型图例 */}
      <div className="mb-3">
        <div className="text-xs text-gray-300 mb-1">节点类型</div>
        <div className="grid grid-cols-3 gap-2">
          {nodeTypes.map((node) => (
            <div key={node.type} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: node.color }}
              />
              <span className="text-xs">{node.label}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* 方向图例，仅在showBidirectional为true时显示 */}
      {showBidirectional && (
        <div>
          <div className="text-xs text-gray-300 mb-1">方向指示</div>
          <div className="grid grid-cols-3 gap-2">
            {directionTypes.map((direction) => (
              <div key={direction.type} className="flex items-center gap-2">
                <div className="w-6 h-6 flex items-center justify-center bg-gray-800/60 rounded-full">
                  {direction.icon}
                </div>
                <span className="text-xs">{direction.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 更多详细说明 - 可展开部分 */}
      <details className="mt-3">
        <summary className="text-xs text-blue-300 cursor-pointer">查看关系详细解释</summary>
        <div className="mt-2 space-y-2 text-xs text-gray-300">
          {relationTypes.map((relation) => (
            <div key={`detail-${relation.type}`}>
              <div className="flex items-center gap-2 font-medium text-white">
                <div 
                  className="w-3 h-3" 
                  style={{ backgroundColor: relation.color }}
                />
                {relation.label}
              </div>
              <p className="ml-5 text-gray-400">{relation.description}</p>
            </div>
          ))}
        </div>
      </details>
    </Card>
  );
};

export default KnowledgeGraphLegend;