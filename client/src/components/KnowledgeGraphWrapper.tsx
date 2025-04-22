import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore 忽略类型检查
import { Graph } from "react-d3-graph";

interface KnowledgeNode {
  id: string;
  label: string;
  color: string;
  size: number;
  symbolType?: string;
  category?: string;
}

interface KnowledgeLink {
  source: string;
  target: string;
  strokeWidth?: number;
  color?: string;
}

interface KnowledgeGraphData {
  nodes: KnowledgeNode[];
  links: KnowledgeLink[];
}

interface KnowledgeGraphWrapperProps {
  data: KnowledgeGraphData;
  height?: number;
  width?: number;
  isMobile?: boolean;
  onClickNode?: (nodeId: string) => void;
}

/**
 * 知识图谱包装组件
 * 用于处理react-d3-graph和D3 v5之间的兼容性问题
 */
const KnowledgeGraphWrapper: React.FC<KnowledgeGraphWrapperProps> = ({
  data,
  height = 600,
  width = 900,
  isMobile = false,
  onClickNode,
}) => {
  const graphRef = useRef<HTMLDivElement>(null);
  const [errorState, setErrorState] = useState<string | null>(null);

  // 图谱配置
  const graphConfig = {
    nodeHighlightBehavior: true,
    directed: true,
    d3: {
      gravity: -150,
      linkLength: isMobile ? 80 : 120,
      alphaTarget: 0.1,
      // 强制使用全局D3实例
      useGlobalD3: true,
    },
    node: {
      color: "#3b82f6",
      size: 300,
      highlightStrokeColor: 'white',
      fontSize: 12,
      fontColor: 'white',
      labelProperty: "label",
      renderLabel: !isMobile, // 移动设备上不显示标签，避免拥挤
    },
    link: {
      highlightColor: 'white',
      color: 'rgba(59, 130, 246, 0.5)',
      strokeWidth: 2,
      renderLabel: false,
    },
    height: height,
    width: width,
  };

  // 确保全局_d3Selection对象初始化
  useEffect(() => {
    // 确保全局_d3Selection对象存在
    if (typeof window !== 'undefined' && !window._d3Selection) {
      window._d3Selection = {
        event: {
          transform: { k: 1, x: 0, y: 0 }
        }
      };
      console.log("KnowledgeGraphWrapper: 全局_d3Selection对象已初始化");
    }
  }, []);

  // 处理渲染错误
  useEffect(() => {
    try {
      if (errorState) {
        console.error("知识图谱渲染错误:", errorState);
        
        // 尝试恢复 - 确保全局D3对象存在
        if (typeof window !== 'undefined') {
          if (!window.d3 && typeof d3 !== 'undefined') {
            window.d3 = d3;
            console.log("已恢复全局d3对象");
          }
          
          if (!window._d3Selection) {
            window._d3Selection = {
              event: {
                transform: { k: 1, x: 0, y: 0 }
              }
            };
            console.log("已恢复全局_d3Selection对象");
          }
          
          // 延迟清除错误状态，尝试恢复
          setTimeout(() => {
            setErrorState(null);
          }, 2000);
        }
      }
    } catch (err) {
      console.error("渲染错误处理失败:", err);
    }
  }, [errorState]);

  // 渲染图谱
  return (
    <div ref={graphRef} className="knowledge-graph-container">
      {errorState ? (
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <p className="text-lg text-red-500">图谱渲染失败</p>
          <p className="text-sm text-neutral-400">{errorState}</p>
        </div>
      ) : (
        <div className="knowledge-graph">
          {data.nodes.length > 0 ? (
            <React.Fragment>
              {/* 使用错误边界捕获渲染异常 */}
              <ErrorBoundary onError={(error) => setErrorState(error.message)}>
                <Graph
                  id="knowledge-graph"
                  data={data}
                  config={graphConfig}
                  onClickNode={onClickNode}
                />
              </ErrorBoundary>
            </React.Fragment>
          ) : (
            <div className="flex flex-col items-center justify-center h-[50vh]">
              <p className="text-lg text-neutral-400">暂无足够数据生成知识图谱</p>
              <p className="text-sm text-neutral-500 max-w-md mx-auto mt-2">
                随着您的学习过程，系统将收集更多数据，并构建您的知识图谱
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 简单的错误边界组件
class ErrorBoundary extends React.Component<{
  onError: (error: Error) => void;
  children: React.ReactNode;
}> {
  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    return this.props.children;
  }
}

export default KnowledgeGraphWrapper;