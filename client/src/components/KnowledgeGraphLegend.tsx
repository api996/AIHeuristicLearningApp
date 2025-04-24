import React from 'react';

// 关系类型定义及颜色
const relationTypes = [
  { type: 'prerequisite', label: '前置知识', color: 'rgba(220, 38, 38, 0.7)' },
  { type: 'contains', label: '包含关系', color: 'rgba(59, 102, 241, 0.7)' },
  { type: 'applies', label: '应用关系', color: 'rgba(14, 165, 233, 0.7)' },
  { type: 'similar', label: '相似概念', color: 'rgba(16, 185, 129, 0.7)' },
  { type: 'complements', label: '互补知识', color: 'rgba(245, 158, 11, 0.7)' },
  { type: 'references', label: '引用关系', color: 'rgba(139, 92, 246, 0.7)' },
  { type: 'related', label: '相关概念', color: 'rgba(79, 70, 229, 0.7)' },
  { type: 'unrelated', label: '无直接关系', color: 'rgba(156, 163, 175, 0.5)' }
];

interface KnowledgeGraphLegendProps {
  className?: string;
  showBidirectional?: boolean;
}

/**
 * 知识图谱图例组件
 * 显示不同关系类型的颜色表示
 */
const KnowledgeGraphLegend: React.FC<KnowledgeGraphLegendProps> = ({ 
  className = '',
  showBidirectional = true
}) => {
  return (
    <div className={`p-3 rounded-lg bg-gray-900/70 backdrop-blur-sm text-sm ${className}`}>
      <h4 className="text-white font-medium mb-2 text-center">关系类型图例</h4>
      <div className="grid grid-cols-2 gap-2">
        {relationTypes.map(relation => (
          <div key={relation.type} className="flex items-center gap-2">
            <div 
              className="w-4 h-2 rounded-full" 
              style={{ backgroundColor: relation.color }}
            />
            <span className="text-gray-200 text-xs">{relation.label}</span>
          </div>
        ))}
      </div>
      
      {showBidirectional && (
        <div className="mt-3 border-t border-gray-700 pt-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <svg viewBox="0 0 24 24" width="16" height="16" className="inline-block">
                <line x1="4" y1="12" x2="20" y2="12" stroke="white" strokeWidth="2"/>
                <polygon points="16,8 20,12 16,16" fill="white"/>
                <polygon points="8,8 4,12 8,16" fill="white"/>
              </svg>
              <span className="text-gray-200 text-xs">双向关系</span>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <svg viewBox="0 0 24 24" width="16" height="16" className="inline-block">
                <line x1="4" y1="12" x2="20" y2="12" stroke="white" strokeWidth="2"/>
                <polygon points="16,8 20,12 16,16" fill="white"/>
              </svg>
              <span className="text-gray-200 text-xs">单向关系</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraphLegend;