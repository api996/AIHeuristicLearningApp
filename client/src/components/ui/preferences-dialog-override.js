/**
 * 偏好设置对话框在iPad设备上的交互修复
 * 
 * 这个文件解决iPad和平板设备上的偏好设置对话框无法点击的问题
 * 通过动态创建样式并修改Document中的对话框Overlay层的属性
 */

// 偏好设置对话框初始化后调用此函数
export function fixPreferencesDialogOnIPad() {
  // 检查是否为iPad或平板设备
  if (typeof document === 'undefined') return;
  
  const isIPad = document.documentElement.classList.contains('ipad-device');
  const isTablet = document.documentElement.classList.contains('tablet-device');
  
  if (!isIPad && !isTablet) return;
  
  // 创建特定的样式，仅针对偏好设置对话框的覆盖层
  setTimeout(() => {
    // 查找偏好设置对话框的覆盖层
    const dialogOverlays = document.querySelectorAll('[data-radix-dialog-overlay]');
    
    // 当对话框打开时，应用特殊处理
    dialogOverlays.forEach(overlay => {
      // 检查是否是偏好设置对话框的覆盖层
      const nearbyContent = overlay.nextElementSibling;
      
      if (nearbyContent && nearbyContent.classList.contains('preferences-dialog-content')) {
        // 只为偏好设置对话框的覆盖层禁用pointer-events
        overlay.style.pointerEvents = 'none';
        
        // 确保内容层可以接收事件
        if (nearbyContent) {
          nearbyContent.style.pointerEvents = 'auto';
          
          // 确保内容内的所有元素都可以接收点击事件
          const allElements = nearbyContent.querySelectorAll('*');
          allElements.forEach(el => {
            el.style.pointerEvents = 'auto';
            el.style.touchAction = 'auto';
          });
        }
      }
    });
  }, 100); // 轻微延迟以确保DOM完全加载
}

// 在对话框关闭时清理
export function cleanupPreferencesDialog() {
  // 这里可以添加任何需要的清理代码
  // 当前版本不需要特殊清理
}