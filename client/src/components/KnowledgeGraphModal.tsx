import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

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
}

interface KnowledgeGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: SimpleNode[];
  links: SimpleLink[];
}

/**
 * 知识图谱模态对话框组件
 * 使用静态预计算布局，性能优先，视觉效果简洁
 */
const KnowledgeGraphModal: React.FC<KnowledgeGraphModalProps> = ({
  isOpen,
  onClose,
  nodes,
  links
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // 绘制图谱
  useEffect(() => {
    if (!isOpen || !canvasRef.current || nodes.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 调整画布尺寸以匹配窗口大小
    const updateCanvasSize = () => {
      canvas.width = window.innerWidth - 40;
      canvas.height = window.innerHeight - 100;
      renderGraph();
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    // 渲染图形
    function renderGraph() {
      if (!ctx) return;
      
      // 清除画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const width = canvas.width;
      const height = canvas.height;
      
      // 计算布局 - 使用静态布局
      const centerX = width / 2;
      const centerY = height / 2;
      const positions: {[key: string]: {x: number, y: number}} = {};
      
      // 将节点分类
      const clusterNodes = nodes.filter(n => n.category === 'cluster');
      const keywordNodes = nodes.filter(n => n.category === 'keyword');
      const memoryNodes = nodes.filter(n => n.category === 'memory');
      
      // 布局算法: 主题节点在中心，关键词和记忆节点围绕各自的主题
      
      // 1. 放置主题节点
      const clusterRadius = Math.min(width, height) * 0.25;
      clusterNodes.forEach((node, i) => {
        const angle = (i / clusterNodes.length) * Math.PI * 2;
        positions[node.id] = {
          x: centerX + Math.cos(angle) * (clusterRadius * 0.6),
          y: centerY + Math.sin(angle) * (clusterRadius * 0.6)
        };
      });
      
      // 2. 构建节点关联图
      const nodeRelations: {[key: string]: string[]} = {};
      nodes.forEach(node => {
        nodeRelations[node.id] = [];
      });
      
      links.forEach(link => {
        const source = typeof link.source === 'string' ? link.source : '';
        const target = typeof link.target === 'string' ? link.target : '';
        
        if (source && target) {
          if (nodeRelations[source]) nodeRelations[source].push(target);
          if (nodeRelations[target]) nodeRelations[target].push(source);
        }
      });
      
      // 3. 为每个关键词找到关联的主题节点
      keywordNodes.forEach((node, i) => {
        // 查找与此关键词关联的主题节点
        const relatedClusters = clusterNodes.filter(cluster => 
          nodeRelations[node.id]?.includes(cluster.id) || 
          nodeRelations[cluster.id]?.includes(node.id)
        );
        
        if (relatedClusters.length > 0) {
          // 随机选择一个关联的主题
          const relatedCluster = relatedClusters[i % relatedClusters.length];
          const clusterPos = positions[relatedCluster.id];
          
          // 围绕主题放置关键词
          const keywordAngle = (i / keywordNodes.length) * Math.PI * 2;
          const keywordDistance = clusterRadius * 0.8;
          
          positions[node.id] = {
            x: clusterPos.x + Math.cos(keywordAngle) * keywordDistance,
            y: clusterPos.y + Math.sin(keywordAngle) * keywordDistance
          };
        } else {
          // 如果没有关联主题，在外圈放置
          const angle = (i / keywordNodes.length) * Math.PI * 2;
          positions[node.id] = {
            x: centerX + Math.cos(angle) * clusterRadius,
            y: centerY + Math.sin(angle) * clusterRadius
          };
        }
      });
      
      // 4. 为每个记忆节点找到关联的主题节点
      memoryNodes.forEach((node, i) => {
        // 查找与此记忆关联的主题节点
        const relatedClusters = clusterNodes.filter(cluster => 
          nodeRelations[node.id]?.includes(cluster.id) || 
          nodeRelations[cluster.id]?.includes(node.id)
        );
        
        if (relatedClusters.length > 0) {
          // 选择第一个关联的主题
          const relatedCluster = relatedClusters[0];
          const clusterPos = positions[relatedCluster.id];
          
          // 在主题周围均匀分布记忆节点
          const memoryIndex = memoryNodes.filter(m => 
            nodeRelations[m.id]?.includes(relatedCluster.id) || 
            nodeRelations[relatedCluster.id]?.includes(m.id)
          ).indexOf(node);
          
          const memoryCount = memoryNodes.filter(m => 
            nodeRelations[m.id]?.includes(relatedCluster.id) || 
            nodeRelations[relatedCluster.id]?.includes(m.id)
          ).length;
          
          const memoryAngle = ((memoryIndex / Math.max(1, memoryCount)) * Math.PI * 2) + Math.PI/4;
          const memoryDistance = clusterRadius * 1.2;
          
          positions[node.id] = {
            x: clusterPos.x + Math.cos(memoryAngle) * memoryDistance,
            y: clusterPos.y + Math.sin(memoryAngle) * memoryDistance
          };
        } else {
          // 如果没有关联主题，在最外圈放置
          const angle = (i / memoryNodes.length) * Math.PI * 2;
          positions[node.id] = {
            x: centerX + Math.cos(angle) * (clusterRadius * 1.5),
            y: centerY + Math.sin(angle) * (clusterRadius * 1.5)
          };
        }
      });
      
      // 5. 防止节点重叠的简单检测
      for (let i = 0; i < 3; i++) { // 简单迭代几次
        const minDistance = 30;
        
        Object.keys(positions).forEach(id1 => {
          Object.keys(positions).forEach(id2 => {
            if (id1 === id2) return;
            
            const pos1 = positions[id1];
            const pos2 = positions[id2];
            const dx = pos1.x - pos2.x;
            const dy = pos1.y - pos2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < minDistance) {
              const angle = Math.atan2(dy, dx);
              const adjustment = (minDistance - distance) / 2;
              
              positions[id1] = {
                x: pos1.x + Math.cos(angle) * adjustment,
                y: pos1.y + Math.sin(angle) * adjustment
              };
              
              positions[id2] = {
                x: pos2.x - Math.cos(angle) * adjustment,
                y: pos2.y - Math.sin(angle) * adjustment
              };
            }
          });
        });
      }
      
      // 确保所有节点在画布范围内
      const padding = 30;
      Object.keys(positions).forEach(id => {
        positions[id] = {
          x: Math.max(padding, Math.min(width - padding, positions[id].x)),
          y: Math.max(padding, Math.min(height - padding, positions[id].y))
        };
      });
      
      // 绘制连接线
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      
      links.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : '';
        const targetId = typeof link.target === 'string' ? link.target : '';
        
        const sourcePos = positions[sourceId];
        const targetPos = positions[targetId];
        
        if (sourcePos && targetPos) {
          // 发光效果
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(100, 180, 255, 0.15)';
          ctx.lineWidth = 4;
          ctx.moveTo(sourcePos.x, sourcePos.y);
          ctx.lineTo(targetPos.x, targetPos.y);
          ctx.stroke();
          
          // 主连接线
          ctx.beginPath();
          ctx.strokeStyle = link.type === 'contains' ? 'rgba(100, 150, 255, 0.8)' : 'rgba(255, 170, 100, 0.8)';
          ctx.lineWidth = 2;
          ctx.moveTo(sourcePos.x, sourcePos.y);
          ctx.lineTo(targetPos.x, targetPos.y);
          ctx.stroke();
        }
      });
      
      // 绘制节点
      nodes.forEach(node => {
        const pos = positions[node.id];
        if (!pos) return;
        
        // 获取节点样式
        let size = 10;
        let color = '#6366f1'; // 默认紫色
        
        if (node.category === 'cluster') {
          size = 18;
          color = '#3b82f6'; // 蓝色
        } else if (node.category === 'keyword') {
          size = 12;
          color = '#10b981'; // 绿色
        } else if (node.category === 'memory') {
          size = 8;
          color = '#f59e0b'; // 橙色
        }
        
        // 应用自定义尺寸
        if (node.size) {
          const normalizedSize = Math.max(5, Math.min(30, node.size / 5));
          if (node.category === 'cluster') {
            size = normalizedSize * 1.5;
          } else {
            size = normalizedSize;
          }
        }
        
        // 绘制节点圆形
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制边框
        ctx.beginPath();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
        ctx.stroke();
        
        // 绘制标签
        if (node.category === 'cluster' || node.category === 'keyword') {
          ctx.font = node.category === 'cluster' ? 'bold 14px Arial' : '12px Arial';
          ctx.fillStyle = 'white';
          ctx.textAlign = 'left';
          ctx.fillText(node.label, pos.x + size + 5, pos.y + 4);
        }
      });
      
      // 绘制图例
      const drawLegend = () => {
        const legendX = 20;
        let legendY = height - 90;
        const legendSpacing = 20;
        
        // 图例背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(legendX - 10, legendY - 15, 120, 85);
        
        // 图例标题
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.fillText('图例:', legendX, legendY);
        
        // 主题
        legendY += legendSpacing;
        ctx.beginPath();
        ctx.fillStyle = '#3b82f6';
        ctx.arc(legendX + 6, legendY - 4, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText('主题', legendX + 18, legendY);
        
        // 关键词
        legendY += legendSpacing;
        ctx.beginPath();
        ctx.fillStyle = '#10b981';
        ctx.arc(legendX + 6, legendY - 4, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.fillText('关键词', legendX + 18, legendY);
        
        // 记忆
        legendY += legendSpacing;
        ctx.beginPath();
        ctx.fillStyle = '#f59e0b';
        ctx.arc(legendX + 6, legendY - 4, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.fillText('记忆', legendX + 18, legendY);
      };
      
      drawLegend();
    }
    
    // 增加点击交互
    const handleClick = (e: MouseEvent) => {
      if (!ctx) return;
      
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      // 获取节点位置
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const positions: {[key: string]: {x: number, y: number}} = {};
      
      // 计算位置（与上面相同的算法）
      const clusterNodes = nodes.filter(n => n.category === 'cluster');
      const keywordNodes = nodes.filter(n => n.category === 'keyword');
      const memoryNodes = nodes.filter(n => n.category === 'memory');
      
      const clusterRadius = Math.min(width, height) * 0.25;
      clusterNodes.forEach((node, i) => {
        const angle = (i / clusterNodes.length) * Math.PI * 2;
        positions[node.id] = {
          x: centerX + Math.cos(angle) * (clusterRadius * 0.6),
          y: centerY + Math.sin(angle) * (clusterRadius * 0.6)
        };
      });
      
      // 检查点击是否在任何节点上
      for (const node of nodes) {
        const pos = positions[node.id];
        if (!pos) continue;
        
        let size = 10;
        if (node.category === 'cluster') size = 18;
        else if (node.category === 'keyword') size = 12;
        else if (node.category === 'memory') size = 8;
        
        const dx = pos.x - clickX;
        const dy = pos.y - clickY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= size) {
          const nodeType = node.category === 'cluster' ? '主题' : 
                        node.category === 'keyword' ? '关键词' : '记忆';
          alert(`${nodeType}: ${node.label}`);
          break;
        }
      }
    };
    
    canvas.addEventListener('click', handleClick);
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      canvas.removeEventListener('click', handleClick);
    };
  }, [isOpen, nodes, links]);
  
  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[90vh] p-0 bg-gray-900 border-gray-800">
        <div className="relative w-full h-full flex flex-col">
          {/* 顶部工具栏 */}
          <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
            <h2 className="text-lg font-semibold text-white">知识连接图谱</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* 画布容器 */}
          <div className="flex-grow relative overflow-hidden">
            <canvas 
              ref={canvasRef} 
              className="w-full h-full"
              style={{ background: 'linear-gradient(to bottom, #0f172a, #1e293b)' }}
            />
          </div>
          
          {/* 信息提示 */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-6 bg-gray-900/80 rounded-lg max-w-md">
                <p className="text-lg text-gray-300 mb-2">暂无足够数据生成知识图谱</p>
                <p className="text-sm text-gray-400">
                  继续与AI进行更多对话，系统将分析和构建您的知识关联图谱。
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KnowledgeGraphModal;