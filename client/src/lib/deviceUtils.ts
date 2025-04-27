/**
 * 设备检测实用工具
 * 提供设备类型检测和特定优化功能
 */

/**
 * 检测设备是否为iPad
 * 用于适配iPad特定样式
 */
export function isIpadDevice(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return (
    (ua.includes('ipad')) || 
    (ua.includes('macintosh') && 'ontouchend' in document)
  );
}

/**
 * 检测设备是否为iPhone
 * 用于适配iPhone特定样式
 */
export function isIphoneDevice(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('iphone');
}

/**
 * 检测设备是否为移动设备
 */
export function isMobileDevice(): boolean {
  return isIpadDevice() || isIphoneDevice() || /android|webos|blackberry|windows phone/i.test(navigator.userAgent);
}

/**
 * 检测设备是否支持触摸
 */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}