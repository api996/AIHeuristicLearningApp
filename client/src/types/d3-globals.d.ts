/**
 * D3全局对象类型声明文件
 * 这个文件为项目中使用的全局D3对象提供类型声明
 */

// 向全局Window接口添加d3和相关对象
interface Window {
  /**
   * 全局D3对象
   */
  d3: any;
  
  /**
   * 兼容性D3选择对象，用于处理旧版D3代码
   */
  d3Selection: {
    d3: any;
    event: any;
    mouse: (container: any) => [number, number];
    setEvent: (event: any) => void;
    transform: {
      k: number;
      x: number;
      y: number;
    };
  };
  
  /**
   * 内部使用的D3选择对象
   */
  _d3Selection: {
    d3?: any;
    event?: any;
    transform?: {
      k: number;
      x: number;
      y: number;
    };
  };
  
  /**
   * D3补丁初始化状态标志
   */
  _d3PatchInitialized?: boolean;
  
  /**
   * 加载D3并应用补丁的全局函数
   */
  loadD3AndApplyPatch?: () => boolean;
}