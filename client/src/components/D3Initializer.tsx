import { useEffect } from 'react';
import { loadD3AndApplyPatch } from '@/lib/d3-loader';

/**
 * D3初始化组件
 * 确保D3在应用启动时正确加载
 */
export default function D3Initializer() {
  useEffect(() => {
    console.log('正在初始化D3库...');
    
    // 确保D3全局可用
    const d3 = loadD3AndApplyPatch();
    
    if (d3) {
      console.log('D3库初始化成功');
    } else {
      console.error('D3库初始化失败，图谱功能可能不可用');
    }
    
    // 向控制台添加调试帮助信息
    if (typeof window !== 'undefined') {
      console.log('全局d3对象状态:', window.d3 ? '已加载' : '未加载');
    }
  }, []);
  
  // 仅执行初始化功能，不渲染任何内容
  return null;
}